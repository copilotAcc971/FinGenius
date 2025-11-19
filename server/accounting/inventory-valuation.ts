/**
 * Inventory Valuation Service
 * 
 * IAS 2 Compliant Inventory Net Realizable Value (NRV) Assessment
 * 
 * This service provides:
 * - NRV calculation for individual inventory items
 * - Lower-of-cost-or-NRV enforcement (IAS 2.9)
 * - Integration with inventory valuation reports
 * 
 * **IAS 2 Compliance Requirements:**
 * - Inventories shall be measured at the lower of cost and net realizable value (IAS 2.9)
 * - Net realizable value is the estimated selling price in the ordinary course of business
 *   less the estimated costs of completion and the estimated costs necessary to make the sale (IAS 2.6)
 * - When the cost of inventories is not recoverable, inventories shall be written down to NRV (IAS 2.28)
 * - The amount of any write-down shall be recognized as an expense in the period the write-down occurs (IAS 2.34)
 * 
 * @module server/accounting/inventory-valuation
 */

import type { Item } from '@shared/schema';

/**
 * Calculate Net Realizable Value for an inventory item
 * 
 * NRV = Estimated Selling Price - Estimated Costs to Complete - Estimated Costs to Sell
 * 
 * **Simplified Calculation (when detailed costs not available):**
 * - NRV = Current Selling Price * 0.95 (assumes 5% selling costs)
 * - For items with explicit NRV value set, uses that value directly
 * 
 * **IAS 2.30-31 Guidance:**
 * - Estimates based on most reliable evidence at reporting date
 * - Consideration of purpose for which inventory is held
 * - Post-balance-sheet events confirm conditions at balance sheet date
 * 
 * @param item - Inventory item to calculate NRV for
 * @returns Calculated NRV amount (as number for calculations)
 */
export function calculateNrvForItem(item: Item): number {
  // If NRV has been explicitly assessed and set, use that value
  if (item.nrvValue) {
    return parseFloat(item.nrvValue);
  }
  
  // Otherwise estimate NRV from selling price (rate) minus estimated selling costs
  // Assumption: 5% selling costs (conservative estimate)
  if (item.rate) {
    const sellingPrice = parseFloat(item.rate);
    const estimatedSellingCosts = sellingPrice * 0.05;
    const estimatedNRV = sellingPrice - estimatedSellingCosts;
    
    return estimatedNRV;
  }
  
  // If no rate set, NRV cannot be determined - return 0
  // This will trigger a write-down if cost > 0
  return 0;
}

/**
 * Interface for inventory valuation result
 */
export interface ValuedInventoryItem extends Item {
  valuationAmount: string;  // Lower of cost or NRV (as decimal string)
  writeDownRequired: boolean;
  writeDownAmount?: string;
}

/**
 * Enforce IAS 2 Lower-of-Cost-or-NRV rule on inventory items
 * 
 * **IAS 2.9:** Inventories shall be measured at the lower of cost and net realizable value.
 * 
 * This function:
 * 1. Calculates NRV for each item
 * 2. Compares cost vs NRV
 * 3. Returns items valued at the lower amount
 * 4. Flags items requiring write-down
 * 
 * @param items - Array of inventory items to value
 * @returns Array of valued items with valuation amounts and write-down flags
 */
export function enforceNrvRule(items: Item[]): ValuedInventoryItem[] {
  return items.map(item => {
    // Get cost (purchase price or fallback to 0)
    const cost = item.purchasePrice ? parseFloat(item.purchasePrice) : 0;
    
    // Calculate NRV
    const nrv = calculateNrvForItem(item);
    
    // Apply lower-of-cost-or-NRV rule
    const lowerValue = Math.min(cost, nrv);
    
    // Determine if write-down is required
    const writeDownRequired = cost > nrv;
    const writeDownAmount = writeDownRequired ? (cost - nrv).toFixed(2) : undefined;
    
    return {
      ...item,
      valuationAmount: lowerValue.toFixed(2),
      writeDownRequired,
      writeDownAmount,
    };
  });
}

/**
 * Calculate total inventory valuation applying IAS 2 rules
 * 
 * Sums the lower-of-cost-or-NRV values for all inventory items
 * considering quantity on hand.
 * 
 * @param items - Array of inventory items
 * @returns Total inventory valuation amount
 */
export function calculateTotalInventoryValuation(items: Item[]): number {
  const valuedItems = enforceNrvRule(items);
  
  return valuedItems.reduce((total, item) => {
    const quantity = item.quantityOnHand ? parseFloat(item.quantityOnHand) : 0;
    const unitValue = parseFloat(item.valuationAmount);
    return total + (quantity * unitValue);
  }, 0);
}

/**
 * Identify items requiring NRV write-down
 * 
 * Returns items where:
 * - Cost > NRV (write-down needed)
 * - Write-down amount is material (>= $1.00)
 * 
 * @param items - Array of inventory items
 * @returns Items requiring write-down
 */
export function getItemsRequiringWriteDown(items: Item[]): ValuedInventoryItem[] {
  const valuedItems = enforceNrvRule(items);
  
  return valuedItems.filter(item => {
    if (!item.writeDownRequired) return false;
    
    // Only include material write-downs (>= $1.00)
    const writeDownAmount = item.writeDownAmount ? parseFloat(item.writeDownAmount) : 0;
    return writeDownAmount >= 1.00;
  });
}
