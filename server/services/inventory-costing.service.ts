/**
 * Inventory Costing Service
 * 
 * IAS 2 (Inventories) compliant inventory valuation service
 * Implements FIFO and Weighted Average costing methods
 * 
 * Core Features:
 * - FIFO (First-In-First-Out) costing with layer tracking
 * - Weighted Average costing with real-time recalculation
 * - Lower of cost or NRV (Net Realizable Value) assessment
 * - Cost of Goods Sold (COGS) calculation
 * - Multi-tenant isolation
 * - Integration with journal entries for COGS posting
 */

import Decimal from 'decimal.js';
import { db } from '../db';
import {
  inventoryCostLayers,
  inventoryCostHistory,
  stockMovements,
  items,
  journalEntries,
  journalEntryLegs,
  accounts,
  type InventoryCostLayer,
  type InsertInventoryCostLayer,
  type InventoryCostHistory,
  type InsertInventoryCostHistory,
  type StockMovement,
  type InsertStockMovement,
  type Item,
} from '@shared/schema';
import { eq, and, sql, desc, asc, gte, lte, or, isNull, not } from 'drizzle-orm';
import { JournalEntryService } from './journal-entry.service';
import { enhancedAuditLogger } from './audit-logger.service';
import { BusinessRulesError } from './business-rules.service';
import { withTransaction } from '../accounting/service';

// Configure Decimal.js for financial precision
Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP
});

export interface CostCalculationResult {
  costOfGoodsSold: string;
  unitCost: string;
  costLayers?: Array<{
    layerId: string;
    quantity: string;
    unitCost: string;
    amount: string;
  }>;
  method: 'FIFO' | 'weighted_average';
}

export interface InventoryValuation {
  itemId: string;
  itemName: string;
  quantityOnHand: string;
  costingMethod: 'FIFO' | 'weighted_average';
  unitCost: string;
  totalValue: string;
  fifoLayers?: Array<{
    layerId: string;
    purchaseDate: Date;
    quantity: string;
    unitCost: string;
    value: string;
  }>;
  lastUpdated: Date;
}

export interface NRVAssessmentResult {
  itemId: string;
  cost: string;
  netRealizableValue: string;
  writeDownRequired: boolean;
  writeDownAmount: string;
  valuationBasis: 'cost' | 'nrv';
}

export interface CostLayerConsumption {
  layerId: string;
  quantityConsumed: string;
  unitCost: string;
  totalCost: string;
}

export class InventoryCostingService {
  /**
   * Create a new cost layer for FIFO tracking
   */
  static async createCostLayer(
    itemId: string,
    quantity: string | number,
    unitCost: string | number,
    purchaseDate: Date,
    referenceType: string,
    referenceId: string | null,
    tenantId: string
  ): Promise<InventoryCostLayer> {
    const qty = new Decimal(quantity);
    const cost = new Decimal(unitCost);
    const totalCost = qty.mul(cost);

    const [layer] = await db
      .insert(inventoryCostLayers)
      .values({
        id: crypto.randomUUID(),
        tenantId,
        itemId,
        purchaseDate,
        quantity: qty.toFixed(4),
        quantityRemaining: qty.toFixed(4),
        unitCost: cost.toFixed(4),
        totalCost: totalCost.toFixed(4),
        referenceType,
        referenceId,
        isFullyConsumed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Log audit trail
    await enhancedAuditLogger.logInventoryActivity({
      tenantId,
      activityType: 'cost_layer_created',
      itemId,
      details: {
        layerId: layer.id,
        quantity: qty.toFixed(4),
        unitCost: cost.toFixed(4),
        totalCost: totalCost.toFixed(4),
        referenceType,
        referenceId,
      },
    });

    return layer;
  }

  /**
   * Get available FIFO cost layers for an item
   */
  static async getAvailableCostLayers(
    itemId: string,
    tenantId: string
  ): Promise<InventoryCostLayer[]> {
    const layers = await db
      .select()
      .from(inventoryCostLayers)
      .where(
        and(
          eq(inventoryCostLayers.tenantId, tenantId),
          eq(inventoryCostLayers.itemId, itemId),
          eq(inventoryCostLayers.isFullyConsumed, false)
        )
      )
      .orderBy(asc(inventoryCostLayers.purchaseDate)); // FIFO order

    return layers;
  }

  /**
   * Calculate FIFO cost for a quantity of items
   */
  static async calculateFIFOCost(
    itemId: string,
    quantity: string | number,
    tenantId: string
  ): Promise<CostCalculationResult> {
    const requestedQty = new Decimal(quantity);
    const layers = await this.getAvailableCostLayers(itemId, tenantId);
    
    if (layers.length === 0) {
      throw new BusinessRulesError('No cost layers available for FIFO calculation');
    }

    let remainingQty = requestedQty;
    let totalCost = new Decimal(0);
    const layersUsed: CostLayerConsumption[] = [];

    // Consume layers in FIFO order
    for (const layer of layers) {
      if (remainingQty.lte(0)) break;

      const availableQty = new Decimal(layer.quantityRemaining);
      const layerUnitCost = new Decimal(layer.unitCost);
      
      const qtyToConsume = Decimal.min(remainingQty, availableQty);
      const costFromLayer = qtyToConsume.mul(layerUnitCost);
      
      totalCost = totalCost.add(costFromLayer);
      remainingQty = remainingQty.sub(qtyToConsume);
      
      layersUsed.push({
        layerId: layer.id,
        quantityConsumed: qtyToConsume.toFixed(4),
        unitCost: layerUnitCost.toFixed(4),
        totalCost: costFromLayer.toFixed(4),
      });
    }

    if (remainingQty.gt(0)) {
      throw new BusinessRulesError(`Insufficient inventory. Requested: ${requestedQty.toFixed(4)}, Available: ${requestedQty.sub(remainingQty).toFixed(4)}`);
    }

    const unitCost = totalCost.div(requestedQty);

    return {
      costOfGoodsSold: totalCost.toFixed(4),
      unitCost: unitCost.toFixed(4),
      costLayers: layersUsed.map(l => ({
        layerId: l.layerId,
        quantity: l.quantityConsumed,
        unitCost: l.unitCost,
        amount: l.totalCost,
      })),
      method: 'FIFO',
    };
  }

  /**
   * Consume FIFO cost layers for a sale or consumption
   */
  static async consumeFIFOLayers(
    itemId: string,
    quantity: string | number,
    tenantId: string,
    trx?: any
  ): Promise<CostLayerConsumption[]> {
    const dbClient = trx || db;
    const requestedQty = new Decimal(quantity);
    const layers = await this.getAvailableCostLayers(itemId, tenantId);
    
    let remainingQty = requestedQty;
    const consumptions: CostLayerConsumption[] = [];

    for (const layer of layers) {
      if (remainingQty.lte(0)) break;

      const availableQty = new Decimal(layer.quantityRemaining);
      const qtyToConsume = Decimal.min(remainingQty, availableQty);
      const newRemaining = availableQty.sub(qtyToConsume);
      
      // Update layer
      await dbClient
        .update(inventoryCostLayers)
        .set({
          quantityRemaining: newRemaining.toFixed(4),
          isFullyConsumed: newRemaining.lte(0),
          updatedAt: new Date(),
        })
        .where(eq(inventoryCostLayers.id, layer.id));
      
      consumptions.push({
        layerId: layer.id,
        quantityConsumed: qtyToConsume.toFixed(4),
        unitCost: layer.unitCost,
        totalCost: qtyToConsume.mul(new Decimal(layer.unitCost)).toFixed(4),
      });
      
      remainingQty = remainingQty.sub(qtyToConsume);
    }

    if (remainingQty.gt(0)) {
      throw new BusinessRulesError(`Insufficient inventory for FIFO consumption`);
    }

    return consumptions;
  }

  /**
   * Get current weighted average cost for an item
   */
  static async getWeightedAverageCost(
    itemId: string,
    tenantId: string
  ): Promise<{ averageCost: string; totalQuantity: string; totalValue: string }> {
    // Get the latest cost history entry
    const [latest] = await db
      .select()
      .from(inventoryCostHistory)
      .where(
        and(
          eq(inventoryCostHistory.tenantId, tenantId),
          eq(inventoryCostHistory.itemId, itemId),
          eq(inventoryCostHistory.costingMethod, 'weighted_average')
        )
      )
      .orderBy(desc(inventoryCostHistory.date))
      .limit(1);

    if (latest && latest.weightedAverageCost) {
      return {
        averageCost: latest.weightedAverageCost,
        totalQuantity: latest.totalQuantity,
        totalValue: latest.totalValue,
      };
    }

    // Calculate from current inventory if no history
    const layers = await this.getAvailableCostLayers(itemId, tenantId);
    
    if (layers.length === 0) {
      return {
        averageCost: '0.0000',
        totalQuantity: '0.0000',
        totalValue: '0.0000',
      };
    }

    let totalQty = new Decimal(0);
    let totalVal = new Decimal(0);

    for (const layer of layers) {
      const qty = new Decimal(layer.quantityRemaining);
      const cost = new Decimal(layer.unitCost);
      totalQty = totalQty.add(qty);
      totalVal = totalVal.add(qty.mul(cost));
    }

    const avgCost = totalQty.gt(0) ? totalVal.div(totalQty) : new Decimal(0);

    return {
      averageCost: avgCost.toFixed(4),
      totalQuantity: totalQty.toFixed(4),
      totalValue: totalVal.toFixed(4),
    };
  }

  /**
   * Update weighted average cost after a purchase
   */
  static async updateWeightedAverage(
    itemId: string,
    newQuantity: string | number,
    newUnitCost: string | number,
    tenantId: string,
    movementId?: string
  ): Promise<{ newAverageCost: string; totalQuantity: string; totalValue: string }> {
    const current = await this.getWeightedAverageCost(itemId, tenantId);
    
    const currentQty = new Decimal(current.totalQuantity);
    const currentValue = new Decimal(current.totalValue);
    const addedQty = new Decimal(newQuantity);
    const addedCost = new Decimal(newUnitCost);
    const addedValue = addedQty.mul(addedCost);
    
    const newTotalQty = currentQty.add(addedQty);
    const newTotalValue = currentValue.add(addedValue);
    const newAvgCost = newTotalQty.gt(0) ? newTotalValue.div(newTotalQty) : new Decimal(0);

    // Record in history
    await db.insert(inventoryCostHistory).values({
      id: crypto.randomUUID(),
      tenantId,
      itemId,
      date: new Date(),
      costingMethod: 'weighted_average',
      weightedAverageCost: newAvgCost.toFixed(4),
      totalQuantity: newTotalQty.toFixed(4),
      totalValue: newTotalValue.toFixed(4),
      movementType: 'purchase',
      movementId,
      previousCost: current.averageCost,
      newCost: newAvgCost.toFixed(4),
      createdAt: new Date(),
    });

    return {
      newAverageCost: newAvgCost.toFixed(4),
      totalQuantity: newTotalQty.toFixed(4),
      totalValue: newTotalValue.toFixed(4),
    };
  }

  /**
   * Calculate weighted average cost for a quantity
   */
  static async calculateWeightedAverageCost(
    itemId: string,
    quantity: string | number,
    tenantId: string
  ): Promise<CostCalculationResult> {
    const current = await this.getWeightedAverageCost(itemId, tenantId);
    const qty = new Decimal(quantity);
    const avgCost = new Decimal(current.averageCost);
    const totalCost = qty.mul(avgCost);

    // Check if sufficient quantity
    const availableQty = new Decimal(current.totalQuantity);
    if (qty.gt(availableQty)) {
      throw new BusinessRulesError(`Insufficient inventory. Requested: ${qty.toFixed(4)}, Available: ${availableQty.toFixed(4)}`);
    }

    return {
      costOfGoodsSold: totalCost.toFixed(4),
      unitCost: avgCost.toFixed(4),
      method: 'weighted_average',
    };
  }

  /**
   * Main interface for calculating COGS
   */
  static async getCostOfGoodsSold(
    itemId: string,
    quantity: string | number,
    method: 'FIFO' | 'weighted_average',
    tenantId: string
  ): Promise<CostCalculationResult> {
    if (method === 'FIFO') {
      return this.calculateFIFOCost(itemId, quantity, tenantId);
    } else {
      return this.calculateWeightedAverageCost(itemId, quantity, tenantId);
    }
  }

  /**
   * Get inventory valuation for an item
   */
  static async getInventoryValuation(
    itemId: string,
    method: 'FIFO' | 'weighted_average',
    tenantId: string
  ): Promise<InventoryValuation> {
    // Get item details
    const [item] = await db
      .select()
      .from(items)
      .where(
        and(
          eq(items.id, itemId),
          eq(items.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!item) {
      throw new BusinessRulesError('Item not found');
    }

    if (method === 'FIFO') {
      const layers = await this.getAvailableCostLayers(itemId, tenantId);
      let totalQty = new Decimal(0);
      let totalValue = new Decimal(0);
      const fifoLayers = [];

      for (const layer of layers) {
        const qty = new Decimal(layer.quantityRemaining);
        const unitCost = new Decimal(layer.unitCost);
        const value = qty.mul(unitCost);
        
        totalQty = totalQty.add(qty);
        totalValue = totalValue.add(value);
        
        fifoLayers.push({
          layerId: layer.id,
          purchaseDate: layer.purchaseDate,
          quantity: qty.toFixed(4),
          unitCost: unitCost.toFixed(4),
          value: value.toFixed(4),
        });
      }

      const avgUnitCost = totalQty.gt(0) ? totalValue.div(totalQty) : new Decimal(0);

      return {
        itemId,
        itemName: item.name,
        quantityOnHand: totalQty.toFixed(4),
        costingMethod: 'FIFO',
        unitCost: avgUnitCost.toFixed(4),
        totalValue: totalValue.toFixed(4),
        fifoLayers,
        lastUpdated: new Date(),
      };
    } else {
      const current = await this.getWeightedAverageCost(itemId, tenantId);
      
      return {
        itemId,
        itemName: item.name,
        quantityOnHand: current.totalQuantity,
        costingMethod: 'weighted_average',
        unitCost: current.averageCost,
        totalValue: current.totalValue,
        lastUpdated: new Date(),
      };
    }
  }

  /**
   * Compare cost with Net Realizable Value (NRV)
   */
  static async compareNRV(
    itemId: string,
    marketPrice: string | number,
    sellingCosts: string | number,
    tenantId: string,
    method: 'FIFO' | 'weighted_average' = 'FIFO'
  ): Promise<NRVAssessmentResult> {
    const valuation = await this.getInventoryValuation(itemId, method, tenantId);
    const cost = new Decimal(valuation.totalValue);
    const mktPrice = new Decimal(marketPrice);
    const costs = new Decimal(sellingCosts);
    const nrv = mktPrice.sub(costs);

    const writeDownRequired = cost.gt(nrv);
    const writeDownAmount = writeDownRequired ? cost.sub(nrv) : new Decimal(0);

    return {
      itemId,
      cost: cost.toFixed(4),
      netRealizableValue: nrv.toFixed(4),
      writeDownRequired,
      writeDownAmount: writeDownAmount.toFixed(4),
      valuationBasis: writeDownRequired ? 'nrv' : 'cost',
    };
  }

  /**
   * Record a stock movement with costing
   */
  static async recordStockMovement(
    itemId: string,
    movementType: 'in' | 'out' | 'adjustment',
    quantity: string | number,
    unitCost: string | number | null,
    referenceType: string,
    referenceId: string,
    method: 'FIFO' | 'weighted_average',
    tenantId: string,
    userId: string,
    notes?: string
  ): Promise<StockMovement> {
    return await withTransaction(async (trx) => {
      const qty = new Decimal(quantity);
      let totalCost = new Decimal(0);
      let costLayersUsed: any[] = [];
      
      if (movementType === 'in') {
        // Purchase or receipt - add to inventory
        if (!unitCost) {
          throw new BusinessRulesError('Unit cost is required for incoming stock');
        }
        
        const cost = new Decimal(unitCost);
        totalCost = qty.mul(cost);
        
        // Create cost layer for FIFO
        await this.createCostLayer(
          itemId,
          quantity,
          unitCost,
          new Date(),
          referenceType,
          referenceId,
          tenantId
        );
        
        // Update weighted average if using that method
        if (method === 'weighted_average') {
          await this.updateWeightedAverage(
            itemId,
            quantity,
            unitCost,
            tenantId,
            referenceId
          );
        }
      } else if (movementType === 'out') {
        // Sale or consumption - remove from inventory
        if (method === 'FIFO') {
          const consumption = await this.consumeFIFOLayers(itemId, quantity, tenantId, trx);
          costLayersUsed = consumption;
          totalCost = consumption.reduce((sum, c) => sum.add(new Decimal(c.totalCost)), new Decimal(0));
        } else {
          const result = await this.calculateWeightedAverageCost(itemId, quantity, tenantId);
          totalCost = new Decimal(result.costOfGoodsSold);
          
          // Update weighted average quantity
          const current = await this.getWeightedAverageCost(itemId, tenantId);
          const newQty = new Decimal(current.totalQuantity).sub(qty);
          const newValue = new Decimal(current.totalValue).sub(totalCost);
          
          await db.insert(inventoryCostHistory).values({
            id: crypto.randomUUID(),
            tenantId,
            itemId,
            date: new Date(),
            costingMethod: 'weighted_average',
            weightedAverageCost: current.averageCost,
            totalQuantity: newQty.toFixed(4),
            totalValue: newValue.toFixed(4),
            movementType: 'sale',
            movementId: referenceId,
            createdAt: new Date(),
          });
        }
      } else {
        // Adjustment - can be positive or negative
        if (qty.gt(0) && unitCost) {
          // Positive adjustment - add to inventory
          const cost = new Decimal(unitCost);
          totalCost = qty.mul(cost);
          
          await this.createCostLayer(
            itemId,
            quantity,
            unitCost,
            new Date(),
            referenceType,
            referenceId,
            tenantId
          );
          
          if (method === 'weighted_average') {
            await this.updateWeightedAverage(itemId, quantity, unitCost, tenantId, referenceId);
          }
        } else if (qty.lt(0)) {
          // Negative adjustment - remove from inventory
          const absQty = qty.abs();
          if (method === 'FIFO') {
            const consumption = await this.consumeFIFOLayers(itemId, absQty.toString(), tenantId, trx);
            costLayersUsed = consumption;
            totalCost = consumption.reduce((sum, c) => sum.add(new Decimal(c.totalCost)), new Decimal(0));
          } else {
            const result = await this.calculateWeightedAverageCost(itemId, absQty.toString(), tenantId);
            totalCost = new Decimal(result.costOfGoodsSold);
          }
        }
      }

      // Record the movement
      const [movement] = await trx
        .insert(stockMovements)
        .values({
          id: crypto.randomUUID(),
          tenantId,
          itemId,
          movementDate: new Date(),
          movementType,
          quantity: qty.toFixed(4),
          unitCost: unitCost ? new Decimal(unitCost).toFixed(4) : null,
          totalCost: totalCost.toFixed(4),
          referenceType,
          referenceId,
          costingMethod: method,
          costLayersUsed: costLayersUsed.length > 0 ? costLayersUsed : null,
          notes,
          createdBy: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return movement;
    });
  }

  /**
   * Recalculate all costs for an item
   */
  static async recalculateCosts(
    itemId: string,
    method: 'FIFO' | 'weighted_average',
    tenantId: string
  ): Promise<void> {
    // Get all movements in chronological order
    const movements = await db
      .select()
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.tenantId, tenantId),
          eq(stockMovements.itemId, itemId)
        )
      )
      .orderBy(asc(stockMovements.movementDate));

    // Clear existing cost layers and history
    await db
      .delete(inventoryCostLayers)
      .where(
        and(
          eq(inventoryCostLayers.tenantId, tenantId),
          eq(inventoryCostLayers.itemId, itemId)
        )
      );

    await db
      .delete(inventoryCostHistory)
      .where(
        and(
          eq(inventoryCostHistory.tenantId, tenantId),
          eq(inventoryCostHistory.itemId, itemId)
        )
      );

    // Rebuild cost layers from movements
    for (const movement of movements) {
      if (movement.movementType === 'in' && movement.unitCost) {
        await this.createCostLayer(
          itemId,
          movement.quantity,
          movement.unitCost,
          movement.movementDate,
          movement.referenceType || 'recalculation',
          movement.referenceId || movement.id,
          tenantId
        );
        
        if (method === 'weighted_average') {
          await this.updateWeightedAverage(
            itemId,
            movement.quantity,
            movement.unitCost,
            tenantId,
            movement.id
          );
        }
      }
    }

    await enhancedAuditLogger.logInventoryActivity({
      tenantId,
      activityType: 'costs_recalculated',
      itemId,
      details: {
        method,
        movementCount: movements.length,
      },
    });
  }

  /**
   * Get cost history for an item
   */
  static async getCostHistory(
    itemId: string,
    tenantId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<InventoryCostHistory[]> {
    let query = db
      .select()
      .from(inventoryCostHistory)
      .where(
        and(
          eq(inventoryCostHistory.tenantId, tenantId),
          eq(inventoryCostHistory.itemId, itemId)
        )
      );

    if (startDate) {
      query = query.where(gte(inventoryCostHistory.date, startDate));
    }
    if (endDate) {
      query = query.where(lte(inventoryCostHistory.date, endDate));
    }

    const history = await query.orderBy(desc(inventoryCostHistory.date));
    return history;
  }

  /**
   * Compare FIFO vs Weighted Average valuation
   */
  static async compareCostingMethods(
    itemId: string,
    tenantId: string
  ): Promise<{
    fifo: InventoryValuation;
    weightedAverage: InventoryValuation;
    variance: string;
    variancePercentage: string;
  }> {
    const fifo = await this.getInventoryValuation(itemId, 'FIFO', tenantId);
    const weightedAverage = await this.getInventoryValuation(itemId, 'weighted_average', tenantId);
    
    const fifoValue = new Decimal(fifo.totalValue);
    const avgValue = new Decimal(weightedAverage.totalValue);
    const variance = fifoValue.sub(avgValue);
    const variancePercentage = avgValue.gt(0) 
      ? variance.div(avgValue).mul(100) 
      : new Decimal(0);

    return {
      fifo,
      weightedAverage,
      variance: variance.toFixed(4),
      variancePercentage: variancePercentage.toFixed(2),
    };
  }
}