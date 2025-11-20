/**
 * Credit Blocker Insight Generator (Task 7-14)
 * 
 * This service analyzes blocking factors and generates actionable recommendations
 * to improve creditworthiness and bankability scores.
 * 
 * @module server/services/credit-insights
 */

import type { FinancialMetricsSnapshot, BankabilityScore } from '@shared/schema';

/**
 * Bank standard thresholds for financial metrics
 */
const BANK_THRESHOLDS = {
  liquidity: {
    currentRatio: 1.5,
    quickRatio: 1.0,
    cashRatio: 0.3,
    workingCapital: 0, // Must be positive
  },
  leverage: {
    debtToEquityRatio: 2.0,
    debtToAssetsRatio: 0.5,
    interestCoverageRatio: 3.0,
  },
  profitability: {
    grossProfitMargin: 0.30, // 30%
    netProfitMargin: 0.05,   // 5%
    returnOnAssets: 0.04,    // 4%
    returnOnEquity: 0.10,    // 10%
  },
  cashFlow: {
    operatingCashFlow: 0,    // Must be positive
    freeCashFlow: 0,         // Must be positive
    cashFlowVolatility: 0.20, // 20% maximum
  },
  operational: {
    daysInReceivables: 60,   // DSO
    daysInPayables: 45,      // DPO (minimum)
    inventoryTurnover: 4,
    revenueGrowthRate: 0.05, // 5%
  },
  paymentBehavior: {
    averagePaymentDelay: 5,  // days
    latePaymentRate: 0.20,   // 20%
  },
} as const;

/**
 * Impact scoring for different metrics
 * Higher score = higher impact on overall bankability
 */
const METRIC_IMPACT_WEIGHTS = {
  currentRatio: 0.8,
  quickRatio: 0.7,
  cashRatio: 0.6,
  workingCapital: 0.5,
  debtToEquityRatio: 0.9,
  debtToAssetsRatio: 0.8,
  interestCoverageRatio: 0.7,
  grossProfitMargin: 0.6,
  netProfitMargin: 0.8,
  returnOnAssets: 0.7,
  returnOnEquity: 0.7,
  operatingCashFlow: 1.0,  // Critical
  freeCashFlow: 0.9,
  cashFlowVolatility: 0.6,
  daysInReceivables: 0.5,
  daysInPayables: 0.4,
  inventoryTurnover: 0.5,
  revenueGrowthRate: 0.6,
  averagePaymentDelay: 0.7,
  latePaymentRate: 0.8,
} as const;

export interface MetricComparison {
  metric: string;
  current: number | null;
  threshold: number;
  belowThreshold: boolean;
  gap: number;
  impact: 'critical' | 'high' | 'medium' | 'low';
  category: string;
}

export interface ActionableRecommendation {
  metric: string;
  category: string;
  recommendation: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedImpact: number; // 0-100 score points
  timeframe: string;
}

export interface RankedInsight {
  category: string;
  metrics: MetricComparison[];
  overallImpact: number;
  recommendations: ActionableRecommendation[];
}

/**
 * Compare a metric value to bank thresholds
 */
export function compareToThresholds(
  metric: string,
  value: number | null,
  category: keyof typeof BANK_THRESHOLDS
): MetricComparison | null {
  if (value === null) {
    return null;
  }
  
  const thresholds = BANK_THRESHOLDS[category] as any;
  const threshold = thresholds[metric];
  
  if (threshold === undefined) {
    return null;
  }
  
  const isInverse = ['debtToEquityRatio', 'debtToAssetsRatio', 'cashFlowVolatility', 'daysInReceivables', 'averagePaymentDelay', 'latePaymentRate'].includes(metric);
  
  let belowThreshold: boolean;
  let gap: number;
  
  if (isInverse) {
    belowThreshold = value > threshold;
    gap = value - threshold;
  } else {
    belowThreshold = value < threshold;
    gap = threshold - value;
  }
  
  const impactWeight = (METRIC_IMPACT_WEIGHTS as any)[metric] || 0.5;
  let impact: 'critical' | 'high' | 'medium' | 'low';
  
  if (impactWeight >= 0.9) impact = 'critical';
  else if (impactWeight >= 0.7) impact = 'high';
  else if (impactWeight >= 0.5) impact = 'medium';
  else impact = 'low';
  
  return {
    metric,
    current: value,
    threshold,
    belowThreshold,
    gap,
    impact,
    category,
  };
}

/**
 * Generate actionable recommendation for a blocked metric
 */
export function generateRecommendation(
  comparison: MetricComparison,
  metrics: FinancialMetricsSnapshot
): ActionableRecommendation {
  let recommendation = '';
  let timeframe = '3-6 months';
  let estimatedImpact = 0;
  
  const metricValue = comparison.current !== null ? comparison.current : 0;
  
  switch (comparison.metric) {
    case 'currentRatio':
      const currentAssets = parseFloat(metrics.workingCapital || '0') / (metricValue - 1);
      const neededIncrease = currentAssets * (comparison.threshold - metricValue);
      recommendation = `Current ratio of ${metricValue.toFixed(2)} is below bank threshold of ${comparison.threshold}. Recommendation: Increase current assets by $${Math.abs(neededIncrease).toFixed(0)} or reduce short-term liabilities by the same amount. Consider converting short-term debt to long-term debt or raising working capital.`;
      estimatedImpact = 15;
      timeframe = '1-3 months';
      break;
    
    case 'quickRatio':
      recommendation = `Quick ratio of ${metricValue.toFixed(2)} is below ${comparison.threshold}. Recommendation: Improve cash position by accelerating collections, reducing inventory levels, or securing a line of credit. Focus on most liquid assets.`;
      estimatedImpact = 12;
      timeframe = '1-3 months';
      break;
    
    case 'debtToEquityRatio':
      recommendation = `Debt-to-equity ratio of ${metricValue.toFixed(2)} exceeds bank threshold of ${comparison.threshold}. Recommendation: Either reduce debt by paying down loans or inject equity capital. A 50/50 approach would require reducing debt by $${Math.abs(comparison.gap * parseFloat(metrics.workingCapital || '100000') / 4).toFixed(0)} and raising $${Math.abs(comparison.gap * parseFloat(metrics.workingCapital || '100000') / 4).toFixed(0)} in equity.`;
      estimatedImpact = 18;
      timeframe = '6-12 months';
      break;
    
    case 'debtToAssetsRatio':
      recommendation = `Debt-to-assets ratio of ${metricValue.toFixed(2)} exceeds ${comparison.threshold}. Recommendation: Reduce total debt burden through accelerated debt repayment or asset acquisition. Consider refinancing high-interest debt.`;
      estimatedImpact = 15;
      timeframe = '6-12 months';
      break;
    
    case 'interestCoverageRatio':
      recommendation = `Interest coverage ratio of ${metricValue.toFixed(2)} is below ${comparison.threshold}. Recommendation: Increase EBIT through revenue growth or cost reduction. Alternatively, refinance debt at lower interest rates to reduce interest expense.`;
      estimatedImpact = 14;
      timeframe = '3-6 months';
      break;
    
    case 'netProfitMargin':
      const marginGap = (comparison.threshold - metricValue) * 100;
      recommendation = `Net profit margin of ${(metricValue * 100).toFixed(1)}% is below bank threshold of ${(comparison.threshold * 100).toFixed(0)}%. Recommendation: Improve margins by ${marginGap.toFixed(1)}% through cost reduction initiatives and pricing optimization. Focus on high-margin products/services.`;
      estimatedImpact = 16;
      timeframe = '3-6 months';
      break;
    
    case 'operatingCashFlow':
      recommendation = `Operating cash flow of $${metricValue.toFixed(0)} indicates negative cash generation. Recommendation: Review operating expenses, accelerate collections (offer early payment discounts), negotiate better payment terms with suppliers (extend DPO to 60+ days), and reduce inventory levels.`;
      estimatedImpact = 25;
      timeframe = '1-3 months';
      break;
    
    case 'freeCashFlow':
      recommendation = `Free cash flow of $${metricValue.toFixed(0)} is negative. Recommendation: Defer non-essential capital expenditures, lease equipment instead of purchasing, and focus on improving operating cash flow first.`;
      estimatedImpact = 20;
      timeframe = '3-6 months';
      break;
    
    case 'cashFlowVolatility':
      recommendation = `Cash flow volatility of ${(metricValue * 100).toFixed(1)}% exceeds ${(comparison.threshold * 100).toFixed(0)}% threshold. Recommendation: Establish a 90-day cash reserve buffer, implement more predictable billing cycles (monthly retainers vs. project-based), and diversify customer base to reduce concentration risk.`;
      estimatedImpact = 12;
      timeframe = '6-12 months';
      break;
    
    case 'daysInReceivables':
      recommendation = `Days sales outstanding (DSO) of ${metricValue.toFixed(0)} days exceeds recommended ${comparison.threshold} days. Recommendation: Implement stricter credit policies (credit checks for new customers), offer 2/10 net 30 terms, automate invoice reminders, and consider factoring or invoice financing for immediate cash.`;
      estimatedImpact = 10;
      timeframe = '1-3 months';
      break;
    
    case 'daysInPayables':
      recommendation = `Days payables outstanding (DPO) of ${metricValue.toFixed(0)} days is below recommended ${comparison.threshold} days. Recommendation: Negotiate longer payment terms with suppliers (aim for 60-day terms), take advantage of payment schedules without penalties, and optimize payment timing.`;
      estimatedImpact = 8;
      timeframe = '1-3 months';
      break;
    
    case 'inventoryTurnover':
      recommendation = `Inventory turnover of ${metricValue.toFixed(2)}x is below ${comparison.threshold}x. Recommendation: Reduce slow-moving inventory through promotions, improve demand forecasting, implement just-in-time inventory management, and focus on high-turnover products.`;
      estimatedImpact = 10;
      timeframe = '3-6 months';
      break;
    
    case 'revenueGrowthRate':
      recommendation = `Revenue growth rate of ${(metricValue * 100).toFixed(1)}% is below ${(comparison.threshold * 100).toFixed(0)}%. Recommendation: Invest in sales and marketing, expand to new markets, introduce new products/services, and improve customer retention to achieve sustainable growth.`;
      estimatedImpact = 12;
      timeframe = '6-12 months';
      break;
    
    case 'averagePaymentDelay':
      recommendation = `Average payment delay of ${metricValue.toFixed(0)} days exceeds ${comparison.threshold} days. Recommendation: Improve payment scheduling with automated payment systems, negotiate better terms with vendors, and maintain adequate cash reserves to meet obligations on time.`;
      estimatedImpact = 14;
      timeframe = '1-3 months';
      break;
    
    case 'latePaymentRate':
      recommendation = `Late payment rate of ${(metricValue * 100).toFixed(1)}% exceeds ${(comparison.threshold * 100).toFixed(0)}% threshold. Recommendation: Set up payment calendar reminders, negotiate more favorable payment schedules, and establish a cash reserve to ensure timely payments. Late payments damage credit relationships.`;
      estimatedImpact = 16;
      timeframe = '1-3 months';
      break;
    
    default:
      recommendation = `${comparison.metric} requires improvement to meet bank standards of ${comparison.threshold}.`;
      estimatedImpact = 10;
  }
  
  let priority: 'critical' | 'high' | 'medium' | 'low' = 'medium';
  if (estimatedImpact >= 20) priority = 'critical';
  else if (estimatedImpact >= 15) priority = 'high';
  else if (estimatedImpact >= 10) priority = 'medium';
  else priority = 'low';
  
  return {
    metric: comparison.metric,
    category: comparison.category,
    recommendation,
    priority,
    estimatedImpact,
    timeframe,
  };
}

/**
 * Rank metrics by their impact on overall score
 */
export function rankImpact(
  metrics: FinancialMetricsSnapshot,
  score: BankabilityScore
): RankedInsight[] {
  const categories = ['liquidity', 'leverage', 'profitability', 'cashFlow', 'operational', 'paymentBehavior'];
  const insights: RankedInsight[] = [];
  
  for (const category of categories) {
    const categoryMetrics: MetricComparison[] = [];
    const categoryRecommendations: ActionableRecommendation[] = [];
    
    const thresholds = BANK_THRESHOLDS[category as keyof typeof BANK_THRESHOLDS] as any;
    
    for (const metric in thresholds) {
      const value = parseFloat((metrics as any)[metric] || '0');
      const comparison = compareToThresholds(metric, value, category as keyof typeof BANK_THRESHOLDS);
      
      if (comparison && comparison.belowThreshold) {
        categoryMetrics.push(comparison);
        const recommendation = generateRecommendation(comparison, metrics);
        categoryRecommendations.push(recommendation);
      }
    }
    
    const overallImpact = categoryRecommendations.reduce((sum, rec) => sum + rec.estimatedImpact, 0);
    
    if (categoryMetrics.length > 0) {
      insights.push({
        category,
        metrics: categoryMetrics,
        overallImpact,
        recommendations: categoryRecommendations.sort((a, b) => b.estimatedImpact - a.estimatedImpact),
      });
    }
  }
  
  return insights.sort((a, b) => b.overallImpact - a.overallImpact);
}

/**
 * Generate comprehensive credit improvement plan
 */
export function generateImprovementPlan(
  metrics: FinancialMetricsSnapshot,
  score: BankabilityScore
): {
  currentScore: number;
  targetScore: number;
  insights: RankedInsight[];
  quickWins: ActionableRecommendation[];
  longTermActions: ActionableRecommendation[];
  estimatedTimeToTarget: string;
} {
  const insights = rankImpact(metrics, score);
  const allRecommendations = insights.flatMap(i => i.recommendations);
  
  const quickWins = allRecommendations.filter(r => r.timeframe === '1-3 months');
  const longTermActions = allRecommendations.filter(r => r.timeframe !== '1-3 months');
  
  const potentialScoreIncrease = allRecommendations.reduce((sum, rec) => sum + rec.estimatedImpact, 0);
  const targetScore = Math.min(100, (score.overallScore || 0) + potentialScoreIncrease);
  
  let estimatedTimeToTarget = '12+ months';
  if (quickWins.length > 3) {
    estimatedTimeToTarget = '3-6 months';
  } else if (quickWins.length > 0) {
    estimatedTimeToTarget = '6-9 months';
  }
  
  return {
    currentScore: score.overallScore || 0,
    targetScore,
    insights,
    quickWins: quickWins.sort((a, b) => b.estimatedImpact - a.estimatedImpact),
    longTermActions: longTermActions.sort((a, b) => b.estimatedImpact - a.estimatedImpact),
    estimatedTimeToTarget,
  };
}
