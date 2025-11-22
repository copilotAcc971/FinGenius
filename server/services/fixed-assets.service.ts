/**
 * Fixed Assets Service
 * 
 * IAS 16 (Property, Plant and Equipment) compliant fixed asset management
 * Handles depreciation calculations, asset lifecycle, and journal entry generation
 * 
 * Core Features:
 * - Straight-line and declining balance depreciation methods
 * - Automatic asset code generation (FA-YYYY-00001)
 * - Monthly depreciation processing with journal entries
 * - Asset disposal with gain/loss calculation
 * - Multi-tenant isolation
 */

import Decimal from 'decimal.js';
import { db } from '../db';
import {
  fixedAssets,
  fixedAssetDepreciation,
  assetSequences,
  journalEntries,
  journalEntryLegs,
  accounts,
  type FixedAsset,
  type InsertFixedAsset,
  type FixedAssetDepreciation as FixedAssetDepreciationType,
  type InsertFixedAssetDepreciation,
  type JournalEntry,
  type JournalEntryLeg,
} from '@shared/schema';
import { eq, and, sql, desc, gte, lte, or, isNull } from 'drizzle-orm';
import { JournalEntryService } from './journal-entry.service';
import { enhancedAuditLogger } from './audit-logger.service';
import { BusinessRulesError } from './business-rules.service';

// Configure Decimal.js for financial precision
Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP
});

export interface DepreciationScheduleItem {
  periodDate: Date;
  depreciationAmount: string;
  accumulatedDepreciation: string;
  bookValue: string;
  isPartialYear: boolean;
}

export interface AssetDisposalResult {
  disposalGainLoss: string;
  journalEntryId: string;
  finalBookValue: string;
  accumulatedDepreciation: string;
}

export interface DepreciationCalculation {
  annualDepreciation: string;
  monthlyDepreciation: string;
  depreciationToDate: string;
  currentBookValue: string;
}

export class FixedAssetsService {
  /**
   * Generate next asset code
   * Format: FA-YYYY-00001
   */
  static async generateAssetCode(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `FA-${year}`;

    // Get or create the sequence
    const [sequence] = await db
      .select()
      .from(assetSequences)
      .where(
        and(
          eq(assetSequences.tenantId, tenantId),
          eq(assetSequences.prefix, prefix)
        )
      )
      .limit(1);

    let nextNumber = 1;

    if (sequence) {
      // Update existing sequence
      nextNumber = sequence.lastSequence + 1;
      await db
        .update(assetSequences)
        .set({
          lastSequence: nextNumber,
          updatedAt: new Date()
        })
        .where(eq(assetSequences.id, sequence.id));
    } else {
      // Create new sequence for this year
      await db
        .insert(assetSequences)
        .values({
          id: crypto.randomUUID(),
          tenantId,
          prefix,
          lastSequence: nextNumber,
          createdAt: new Date(),
          updatedAt: new Date()
        });
    }

    // Format with leading zeros (5 digits)
    const formattedNumber = String(nextNumber).padStart(5, '0');
    return `${prefix}-${formattedNumber}`;
  }

  /**
   * Calculate straight-line depreciation
   * Formula: (Acquisition Cost - Salvage Value) / Useful Life Years
   */
  static calculateStraightLineDepreciation(
    acquisitionCost: string | number,
    salvageValue: string | number,
    usefulLifeYears: string | number
  ): DepreciationCalculation {
    const cost = new Decimal(acquisitionCost);
    const salvage = new Decimal(salvageValue);
    const years = new Decimal(usefulLifeYears);

    // Depreciable amount = Cost - Salvage Value
    const depreciableAmount = cost.sub(salvage);

    // Annual depreciation
    const annualDepreciation = years.gt(0) 
      ? depreciableAmount.div(years)
      : new Decimal(0);

    // Monthly depreciation
    const monthlyDepreciation = annualDepreciation.div(12);

    return {
      annualDepreciation: annualDepreciation.toFixed(2),
      monthlyDepreciation: monthlyDepreciation.toFixed(2),
      depreciationToDate: '0.00', // Will be calculated based on actual periods
      currentBookValue: cost.toFixed(2)
    };
  }

  /**
   * Calculate declining balance depreciation
   * Formula: Book Value × Depreciation Rate
   */
  static calculateDecliningBalanceDepreciation(
    currentBookValue: string | number,
    depreciationRate: string | number,
    salvageValue: string | number
  ): DepreciationCalculation {
    const bookValue = new Decimal(currentBookValue);
    const rate = new Decimal(depreciationRate).div(100); // Convert percentage to decimal
    const salvage = new Decimal(salvageValue);

    // Annual depreciation = Book Value × Rate
    let annualDepreciation = bookValue.mul(rate);

    // Ensure we don't depreciate below salvage value
    const maxDepreciation = bookValue.sub(salvage);
    if (annualDepreciation.gt(maxDepreciation)) {
      annualDepreciation = maxDepreciation.gt(0) ? maxDepreciation : new Decimal(0);
    }

    // Monthly depreciation
    const monthlyDepreciation = annualDepreciation.div(12);

    return {
      annualDepreciation: annualDepreciation.toFixed(2),
      monthlyDepreciation: monthlyDepreciation.toFixed(2),
      depreciationToDate: '0.00',
      currentBookValue: bookValue.toFixed(2)
    };
  }

  /**
   * Generate full depreciation schedule for an asset
   */
  static generateDepreciationSchedule(
    asset: FixedAsset,
    startDate?: Date,
    endDate?: Date
  ): DepreciationScheduleItem[] {
    const schedule: DepreciationScheduleItem[] = [];
    
    const acquisitionDate = new Date(asset.acquisitionDate);
    const scheduleStart = startDate || acquisitionDate;
    const scheduleEnd = endDate || new Date(
      acquisitionDate.getFullYear() + Number(asset.usefulLifeYears),
      acquisitionDate.getMonth(),
      acquisitionDate.getDate()
    );

    let currentDate = new Date(scheduleStart);
    let accumulatedDepreciation = new Decimal(asset.accumulatedDepreciation || 0);
    let currentBookValue = new Decimal(asset.acquisitionCost).sub(accumulatedDepreciation);
    const salvageValue = new Decimal(asset.salvageValue || 0);

    // No depreciation for 'none' method
    if (asset.depreciationMethod === 'none') {
      return [];
    }

    while (currentDate <= scheduleEnd && currentBookValue.gt(salvageValue)) {
      let periodDepreciation: Decimal;
      
      if (asset.depreciationMethod === 'straight-line') {
        const depreciableAmount = new Decimal(asset.acquisitionCost).sub(salvageValue);
        const annualDepreciation = depreciableAmount.div(asset.usefulLifeYears);
        
        // Check if this is a partial year
        const isFirstYear = currentDate.getFullYear() === acquisitionDate.getFullYear();
        const isLastYear = currentDate.getFullYear() === scheduleEnd.getFullYear();
        
        if (isFirstYear || isLastYear) {
          // Calculate partial year depreciation
          const monthsInYear = isFirstYear
            ? 12 - acquisitionDate.getMonth()
            : scheduleEnd.getMonth() + 1;
          periodDepreciation = annualDepreciation.mul(monthsInYear).div(12);
        } else {
          periodDepreciation = annualDepreciation;
        }
      } else if (asset.depreciationMethod === 'declining-balance') {
        const rate = new Decimal(asset.decliningBalanceRate || 0).div(100);
        periodDepreciation = currentBookValue.mul(rate);
      } else {
        periodDepreciation = new Decimal(0);
      }

      // Ensure we don't depreciate below salvage value
      const maxDepreciation = currentBookValue.sub(salvageValue);
      if (periodDepreciation.gt(maxDepreciation)) {
        periodDepreciation = maxDepreciation.gt(0) ? maxDepreciation : new Decimal(0);
      }

      accumulatedDepreciation = accumulatedDepreciation.add(periodDepreciation);
      currentBookValue = new Decimal(asset.acquisitionCost).sub(accumulatedDepreciation);

      schedule.push({
        periodDate: new Date(currentDate),
        depreciationAmount: periodDepreciation.toFixed(2),
        accumulatedDepreciation: accumulatedDepreciation.toFixed(2),
        bookValue: currentBookValue.toFixed(2),
        isPartialYear: currentDate.getFullYear() === acquisitionDate.getFullYear() ||
                      currentDate.getFullYear() === scheduleEnd.getFullYear()
      });

      // Move to next year
      currentDate.setFullYear(currentDate.getFullYear() + 1);
    }

    return schedule;
  }

  /**
   * Process monthly depreciation for all active assets
   */
  static async processMonthlyDepreciation(
    tenantId: string,
    processingDate: Date = new Date()
  ): Promise<{ 
    processedAssets: number; 
    totalDepreciation: string;
    journalEntryIds: string[];
  }> {
    // Get all active assets that should be depreciated
    const activeAssets = await db
      .select()
      .from(fixedAssets)
      .where(
        and(
          eq(fixedAssets.tenantId, tenantId),
          eq(fixedAssets.status, 'active'),
          lte(fixedAssets.acquisitionDate, processingDate)
        )
      );

    let processedAssets = 0;
    let totalDepreciation = new Decimal(0);
    const journalEntryIds: string[] = [];

    for (const asset of activeAssets) {
      if (asset.depreciationMethod === 'none') {
        continue;
      }

      // Check if depreciation already processed for this month
      const existingDepreciation = await db
        .select()
        .from(fixedAssetDepreciation)
        .where(
          and(
            eq(fixedAssetDepreciation.fixedAssetId, asset.id),
            gte(fixedAssetDepreciation.periodDate, 
              new Date(processingDate.getFullYear(), processingDate.getMonth(), 1)),
            lte(fixedAssetDepreciation.periodDate,
              new Date(processingDate.getFullYear(), processingDate.getMonth() + 1, 0))
          )
        )
        .limit(1);

      if (existingDepreciation.length > 0) {
        continue; // Already processed for this month
      }

      // Calculate monthly depreciation
      let monthlyDepreciation: Decimal;
      const currentBookValue = new Decimal(asset.currentBookValue || asset.acquisitionCost);
      const salvageValue = new Decimal(asset.salvageValue || 0);
      
      if (currentBookValue.lte(salvageValue)) {
        continue; // Already fully depreciated
      }

      if (asset.depreciationMethod === 'straight-line') {
        const depreciableAmount = new Decimal(asset.acquisitionCost).sub(salvageValue);
        const annualDepreciation = depreciableAmount.div(asset.usefulLifeYears);
        monthlyDepreciation = annualDepreciation.div(12);
      } else if (asset.depreciationMethod === 'declining-balance') {
        const rate = new Decimal(asset.decliningBalanceRate || 0).div(100);
        const annualDepreciation = currentBookValue.mul(rate);
        monthlyDepreciation = annualDepreciation.div(12);
      } else {
        monthlyDepreciation = new Decimal(0);
      }

      // Ensure we don't depreciate below salvage value
      const maxDepreciation = currentBookValue.sub(salvageValue);
      if (monthlyDepreciation.gt(maxDepreciation)) {
        monthlyDepreciation = maxDepreciation.gt(0) ? maxDepreciation : new Decimal(0);
      }

      if (monthlyDepreciation.lte(0)) {
        continue;
      }

      // Create journal entry for depreciation
      const journalEntry = await this.createDepreciationJournalEntry(
        tenantId,
        asset,
        monthlyDepreciation.toFixed(2),
        processingDate
      );

      // Record depreciation
      const newAccumulatedDepreciation = new Decimal(asset.accumulatedDepreciation || 0)
        .add(monthlyDepreciation);
      const newBookValue = new Decimal(asset.acquisitionCost)
        .sub(newAccumulatedDepreciation);

      await db.insert(fixedAssetDepreciation).values({
        id: crypto.randomUUID(),
        tenantId,
        fixedAssetId: asset.id,
        periodDate: processingDate,
        depreciationAmount: monthlyDepreciation.toFixed(2),
        accumulatedDepreciation: newAccumulatedDepreciation.toFixed(2),
        bookValue: newBookValue.toFixed(2),
        journalEntryId: journalEntry.id,
        createdAt: new Date()
      });

      // Update asset with new accumulated depreciation and book value
      await db
        .update(fixedAssets)
        .set({
          accumulatedDepreciation: newAccumulatedDepreciation.toFixed(2),
          currentBookValue: newBookValue.toFixed(2),
          status: newBookValue.lte(salvageValue) ? 'fully-depreciated' : 'active',
          updatedAt: new Date()
        })
        .where(eq(fixedAssets.id, asset.id));

      processedAssets++;
      totalDepreciation = totalDepreciation.add(monthlyDepreciation);
      journalEntryIds.push(journalEntry.id);
    }

    await enhancedAuditLogger.logAction({
      userId: 'system',
      tenantId,
      action: 'PROCESS_MONTHLY_DEPRECIATION',
      resource: 'fixed_assets',
      resourceId: null,
      details: {
        processingDate,
        processedAssets,
        totalDepreciation: totalDepreciation.toFixed(2),
        journalEntryIds
      }
    });

    return {
      processedAssets,
      totalDepreciation: totalDepreciation.toFixed(2),
      journalEntryIds
    };
  }

  /**
   * Create journal entry for depreciation expense
   */
  static async createDepreciationJournalEntry(
    tenantId: string,
    asset: FixedAsset,
    depreciationAmount: string,
    date: Date
  ): Promise<JournalEntry> {
    const entryNumber = await JournalEntryService.generateEntryNumber(tenantId);

    // Ensure we have the required accounts
    if (!asset.depreciationExpenseAccountId || !asset.accumulatedDepreciationAccountId) {
      throw new BusinessRulesError('Depreciation accounts not configured for asset');
    }

    // Create journal entry
    const [journalEntry] = await db
      .insert(journalEntries)
      .values({
        id: crypto.randomUUID(),
        tenantId,
        entryNumber,
        date,
        description: `Monthly depreciation for ${asset.name} (${asset.assetCode})`,
        reference: `DEP-${asset.assetCode}`,
        status: 'posted',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    // Create journal entry legs
    const legs = [
      {
        id: crypto.randomUUID(),
        tenantId,
        journalEntryId: journalEntry.id,
        accountId: asset.depreciationExpenseAccountId,
        debit: depreciationAmount,
        credit: null,
        description: 'Depreciation expense',
        createdAt: new Date()
      },
      {
        id: crypto.randomUUID(),
        tenantId,
        journalEntryId: journalEntry.id,
        accountId: asset.accumulatedDepreciationAccountId,
        debit: null,
        credit: depreciationAmount,
        description: 'Accumulated depreciation',
        createdAt: new Date()
      }
    ];

    await db.insert(journalEntryLegs).values(legs);

    return journalEntry;
  }

  /**
   * Handle asset disposal with gain/loss calculation
   */
  static async handleAssetDisposal(
    tenantId: string,
    assetId: string,
    disposalDate: Date,
    disposalAmount: string,
    disposalAccountId?: string
  ): Promise<AssetDisposalResult> {
    const [asset] = await db
      .select()
      .from(fixedAssets)
      .where(
        and(
          eq(fixedAssets.id, assetId),
          eq(fixedAssets.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!asset) {
      throw new BusinessRulesError('Asset not found');
    }

    if (asset.status === 'disposed') {
      throw new BusinessRulesError('Asset is already disposed');
    }

    // Calculate final depreciation up to disposal date
    const lastDepreciation = await db
      .select()
      .from(fixedAssetDepreciation)
      .where(eq(fixedAssetDepreciation.fixedAssetId, assetId))
      .orderBy(desc(fixedAssetDepreciation.periodDate))
      .limit(1);

    // Calculate any remaining depreciation up to disposal date
    let finalAccumulatedDepreciation = new Decimal(asset.accumulatedDepreciation || 0);
    const monthsSinceLastDepreciation = lastDepreciation.length > 0
      ? Math.floor((disposalDate.getTime() - lastDepreciation[0].periodDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
      : Math.floor((disposalDate.getTime() - asset.acquisitionDate.getTime()) / (1000 * 60 * 60 * 24 * 30));

    if (monthsSinceLastDepreciation > 0 && asset.depreciationMethod !== 'none') {
      // Process any outstanding depreciation
      const depResult = await this.processMonthlyDepreciation(tenantId, disposalDate);
      
      // Refresh asset data
      const [updatedAsset] = await db
        .select()
        .from(fixedAssets)
        .where(eq(fixedAssets.id, assetId))
        .limit(1);
      
      finalAccumulatedDepreciation = new Decimal(updatedAsset.accumulatedDepreciation || 0);
    }

    // Calculate gain/loss on disposal
    const acquisitionCost = new Decimal(asset.acquisitionCost);
    const bookValue = acquisitionCost.sub(finalAccumulatedDepreciation);
    const disposalValue = new Decimal(disposalAmount);
    const gainLoss = disposalValue.sub(bookValue);

    // Create journal entry for disposal
    const entryNumber = await JournalEntryService.generateEntryNumber(tenantId);
    
    const [journalEntry] = await db
      .insert(journalEntries)
      .values({
        id: crypto.randomUUID(),
        tenantId,
        entryNumber,
        date: disposalDate,
        description: `Disposal of ${asset.name} (${asset.assetCode})`,
        reference: `DISP-${asset.assetCode}`,
        status: 'posted',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    // Create journal entry legs for disposal
    const legs = [];

    // 1. Credit the asset account (remove asset cost)
    legs.push({
      id: crypto.randomUUID(),
      tenantId,
      journalEntryId: journalEntry.id,
      accountId: asset.assetAccountId,
      debit: null,
      credit: acquisitionCost.toFixed(2),
      description: 'Remove asset cost',
      createdAt: new Date()
    });

    // 2. Debit accumulated depreciation (remove accumulated depreciation)
    if (finalAccumulatedDepreciation.gt(0)) {
      legs.push({
        id: crypto.randomUUID(),
        tenantId,
        journalEntryId: journalEntry.id,
        accountId: asset.accumulatedDepreciationAccountId,
        debit: finalAccumulatedDepreciation.toFixed(2),
        credit: null,
        description: 'Remove accumulated depreciation',
        createdAt: new Date()
      });
    }

    // 3. Debit cash/bank account (disposal proceeds)
    if (disposalAccountId) {
      legs.push({
        id: crypto.randomUUID(),
        tenantId,
        journalEntryId: journalEntry.id,
        accountId: disposalAccountId,
        debit: disposalValue.toFixed(2),
        credit: null,
        description: 'Disposal proceeds',
        createdAt: new Date()
      });
    }

    // 4. Record gain or loss
    if (!gainLoss.isZero()) {
      // Need to get or create gain/loss account
      const gainLossAccount = await this.getOrCreateGainLossAccount(tenantId, gainLoss.gt(0));
      
      legs.push({
        id: crypto.randomUUID(),
        tenantId,
        journalEntryId: journalEntry.id,
        accountId: gainLossAccount.id,
        debit: gainLoss.lt(0) ? gainLoss.abs().toFixed(2) : null,
        credit: gainLoss.gt(0) ? gainLoss.toFixed(2) : null,
        description: gainLoss.gt(0) ? 'Gain on disposal' : 'Loss on disposal',
        createdAt: new Date()
      });
    }

    await db.insert(journalEntryLegs).values(legs);

    // Update asset status
    await db
      .update(fixedAssets)
      .set({
        status: 'disposed',
        disposalDate,
        disposalAmount: disposalValue.toFixed(2),
        updatedAt: new Date()
      })
      .where(eq(fixedAssets.id, assetId));

    await enhancedAuditLogger.logAction({
      userId: 'system',
      tenantId,
      action: 'DISPOSE_FIXED_ASSET',
      resource: 'fixed_assets',
      resourceId: assetId,
      details: {
        assetCode: asset.assetCode,
        disposalDate,
        disposalAmount: disposalValue.toFixed(2),
        bookValue: bookValue.toFixed(2),
        gainLoss: gainLoss.toFixed(2),
        journalEntryId: journalEntry.id
      }
    });

    return {
      disposalGainLoss: gainLoss.toFixed(2),
      journalEntryId: journalEntry.id,
      finalBookValue: bookValue.toFixed(2),
      accumulatedDepreciation: finalAccumulatedDepreciation.toFixed(2)
    };
  }

  /**
   * Get or create gain/loss on disposal account
   */
  private static async getOrCreateGainLossAccount(
    tenantId: string,
    isGain: boolean
  ): Promise<{ id: string }> {
    const accountCode = isGain ? 'GAIN_DISPOSAL' : 'LOSS_DISPOSAL';
    const accountName = isGain ? 'Gain on Asset Disposal' : 'Loss on Asset Disposal';
    const accountType = isGain ? 'revenue' : 'expense';

    let [account] = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          eq(accounts.code, accountCode)
        )
      )
      .limit(1);

    if (!account) {
      [account] = await db
        .insert(accounts)
        .values({
          id: crypto.randomUUID(),
          tenantId,
          code: accountCode,
          name: accountName,
          type: accountType,
          subtype: isGain ? 'other_income' : 'other_expense',
          normalBalance: isGain ? 'credit' : 'debit',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
    }

    return account;
  }

  /**
   * Calculate accumulated depreciation to date
   */
  static async calculateAccumulatedDepreciation(
    assetId: string,
    upToDate: Date = new Date()
  ): Promise<string> {
    const depreciationRecords = await db
      .select()
      .from(fixedAssetDepreciation)
      .where(
        and(
          eq(fixedAssetDepreciation.fixedAssetId, assetId),
          lte(fixedAssetDepreciation.periodDate, upToDate)
        )
      );

    const total = depreciationRecords.reduce((acc, record) => {
      return acc.add(new Decimal(record.depreciationAmount));
    }, new Decimal(0));

    return total.toFixed(2);
  }

  /**
   * Calculate current book value
   */
  static calculateBookValue(
    acquisitionCost: string | number,
    accumulatedDepreciation: string | number
  ): string {
    const cost = new Decimal(acquisitionCost);
    const depreciation = new Decimal(accumulatedDepreciation);
    const bookValue = cost.sub(depreciation);
    
    return bookValue.toFixed(2);
  }

  /**
   * Get depreciation schedule for an asset
   */
  static async getDepreciationSchedule(
    assetId: string,
    tenantId: string
  ): Promise<FixedAssetDepreciationType[]> {
    return await db
      .select()
      .from(fixedAssetDepreciation)
      .where(
        and(
          eq(fixedAssetDepreciation.fixedAssetId, assetId),
          eq(fixedAssetDepreciation.tenantId, tenantId)
        )
      )
      .orderBy(fixedAssetDepreciation.periodDate);
  }
}