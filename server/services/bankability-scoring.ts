/**
 * Bankability Scoring Algorithm (Task 7-13)
 * 
 * This service scores a company's creditworthiness based on financial metrics.
 * Uses weighted scoring across 6 dimensions with bank-standard thresholds.
 * 
 * @module server/services/bankability-scoring
 */

import { db } from '../db';
import {
  bankabilityScores,
  scoreHistory,
  type FinancialMetricsSnapshot,
  type InsertBankabilityScore,
  type BankabilityScore,
  type InsertScoreHistory,
} from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { queryOptimizer } from '../utils/query-optimizer';

/**
 * Component weights for overall score calculation
 */
const COMPONENT_WEIGHTS = {
  liquidity: 0.20,       // 20%
  leverage: 0.20,        // 20%
  profitability: 0.15,   // 15%
  cashFlow: 0.25,        // 25%
  operational: 0.10,     // 10%
  paymentBehavior: 0.10, // 10%
} as const;

/**
 * Score a single metric value against thresholds
 * Returns a score from 0-100
 */
function scoreMetric(value: number | null, thresholds: { excellent: number; good: number; fair: number; poor: number }, inverse = false): number {
  if (value === null || !isFinite(value)) return 0;
  
  if (inverse) {
    if (value <= thresholds.excellent) return 100;
    if (value <= thresholds.good) return 75;
    if (value <= thresholds.fair) return 50;
    if (value <= thresholds.poor) return 25;
    return 0;
  } else {
    if (value >= thresholds.excellent) return 100;
    if (value >= thresholds.good) return 75;
    if (value >= thresholds.fair) return 50;
    if (value >= thresholds.poor) return 25;
    return 0;
  }
}

/**
 * Calculate liquidity score (0-100)
 */
function calculateLiquidityScore(metrics: FinancialMetricsSnapshot): number {
  const currentRatioScore = scoreMetric(
    parseFloat(metrics.currentRatio || '0'),
    { excellent: 2.0, good: 1.5, fair: 1.0, poor: 0.75 }
  );
  
  const quickRatioScore = scoreMetric(
    parseFloat(metrics.quickRatio || '0'),
    { excellent: 1.5, good: 1.0, fair: 0.75, poor: 0.5 }
  );
  
  const cashRatioScore = scoreMetric(
    parseFloat(metrics.cashRatio || '0'),
    { excellent: 0.5, good: 0.3, fair: 0.2, poor: 0.1 }
  );
  
  const workingCapitalScore = parseFloat(metrics.workingCapital || '0') > 0 ? 100 : 0;
  
  return Math.round(
    (currentRatioScore * 0.4 + quickRatioScore * 0.3 + cashRatioScore * 0.2 + workingCapitalScore * 0.1)
  );
}

/**
 * Calculate leverage score (0-100) - Lower is better (inverse scoring)
 */
function calculateLeverageScore(metrics: FinancialMetricsSnapshot): number {
  const debtToEquityScore = scoreMetric(
    parseFloat(metrics.debtToEquityRatio || '0'),
    { excellent: 1.0, good: 1.5, fair: 2.0, poor: 3.0 },
    true // inverse
  );
  
  const debtToAssetsScore = scoreMetric(
    parseFloat(metrics.debtToAssetsRatio || '0'),
    { excellent: 0.3, good: 0.5, fair: 0.7, poor: 0.9 },
    true // inverse
  );
  
  const interestCoverageScore = scoreMetric(
    parseFloat(metrics.interestCoverageRatio || '0'),
    { excellent: 5.0, good: 3.0, fair: 2.0, poor: 1.5 }
  );
  
  return Math.round(
    (debtToEquityScore * 0.4 + debtToAssetsScore * 0.3 + interestCoverageScore * 0.3)
  );
}

/**
 * Calculate profitability score (0-100)
 */
function calculateProfitabilityScore(metrics: FinancialMetricsSnapshot): number {
  const grossProfitMarginScore = scoreMetric(
    parseFloat(metrics.grossProfitMargin || '0') * 100,
    { excellent: 40, good: 30, fair: 20, poor: 10 }
  );
  
  const netProfitMarginScore = scoreMetric(
    parseFloat(metrics.netProfitMargin || '0') * 100,
    { excellent: 15, good: 10, fair: 5, poor: 2 }
  );
  
  const roaScore = scoreMetric(
    parseFloat(metrics.returnOnAssets || '0') * 100,
    { excellent: 10, good: 7, fair: 4, poor: 2 }
  );
  
  const roeScore = scoreMetric(
    parseFloat(metrics.returnOnEquity || '0') * 100,
    { excellent: 15, good: 10, fair: 6, poor: 3 }
  );
  
  return Math.round(
    (grossProfitMarginScore * 0.25 + netProfitMarginScore * 0.35 + roaScore * 0.2 + roeScore * 0.2)
  );
}

/**
 * Calculate cash flow score (0-100)
 */
function calculateCashFlowScore(metrics: FinancialMetricsSnapshot): number {
  const ocfPositive = parseFloat(metrics.operatingCashFlow || '0') > 0 ? 100 : 0;
  const fcfPositive = parseFloat(metrics.freeCashFlow || '0') > 0 ? 100 : 0;
  
  const volatilityScore = scoreMetric(
    parseFloat(metrics.cashFlowVolatility || '0') * 100,
    { excellent: 10, good: 20, fair: 30, poor: 50 },
    true // inverse - lower volatility is better
  );
  
  return Math.round(
    (ocfPositive * 0.4 + fcfPositive * 0.4 + volatilityScore * 0.2)
  );
}

/**
 * Calculate operational score (0-100)
 */
function calculateOperationalScore(metrics: FinancialMetricsSnapshot): number {
  const dsoScore = scoreMetric(
    parseFloat(metrics.daysInReceivables || '0'),
    { excellent: 30, good: 45, fair: 60, poor: 90 },
    true // inverse
  );
  
  const dpoScore = scoreMetric(
    parseFloat(metrics.daysInPayables || '0'),
    { excellent: 45, good: 60, fair: 75, poor: 90 }
  );
  
  const inventoryTurnoverScore = scoreMetric(
    parseFloat(metrics.inventoryTurnover || '0'),
    { excellent: 8, good: 6, fair: 4, poor: 2 }
  );
  
  const revenueGrowthScore = scoreMetric(
    parseFloat(metrics.revenueGrowthRate || '0'),
    { excellent: 20, good: 10, fair: 5, poor: 0 }
  );
  
  return Math.round(
    (dsoScore * 0.3 + dpoScore * 0.2 + inventoryTurnoverScore * 0.2 + revenueGrowthScore * 0.3)
  );
}

/**
 * Calculate payment behavior score (0-100) - Lower delays are better
 */
function calculatePaymentBehaviorScore(metrics: FinancialMetricsSnapshot): number {
  const avgDelayScore = scoreMetric(
    parseFloat(metrics.averagePaymentDelay || '0'),
    { excellent: 0, good: 5, fair: 10, poor: 20 },
    true // inverse
  );
  
  const latePaymentRateScore = scoreMetric(
    parseFloat(metrics.latePaymentRate || '0'),
    { excellent: 5, good: 10, fair: 20, poor: 30 },
    true // inverse
  );
  
  return Math.round(
    (avgDelayScore * 0.6 + latePaymentRateScore * 0.4)
  );
}

/**
 * Determine score grade based on overall score
 */
function getScoreGrade(score: number): string {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'B+';
  if (score >= 80) return 'B';
  if (score >= 75) return 'C+';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Determine loan eligibility based on overall score
 */
function getLoanEligibility(score: number): string {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'fair';
  if (score >= 50) return 'poor';
  return 'not_eligible';
}

/**
 * Calculate bankability score from financial metrics
 */
export async function calculateScore(
  metricsSnapshot: FinancialMetricsSnapshot
): Promise<Omit<InsertBankabilityScore, 'tenantId'>> {
  const liquidityScore = calculateLiquidityScore(metricsSnapshot);
  const leverageScore = calculateLeverageScore(metricsSnapshot);
  const profitabilityScore = calculateProfitabilityScore(metricsSnapshot);
  const cashFlowScore = calculateCashFlowScore(metricsSnapshot);
  const operationalScore = calculateOperationalScore(metricsSnapshot);
  const paymentBehaviorScore = calculatePaymentBehaviorScore(metricsSnapshot);
  
  const overallScore = Math.round(
    liquidityScore * COMPONENT_WEIGHTS.liquidity +
    leverageScore * COMPONENT_WEIGHTS.leverage +
    profitabilityScore * COMPONENT_WEIGHTS.profitability +
    cashFlowScore * COMPONENT_WEIGHTS.cashFlow +
    operationalScore * COMPONENT_WEIGHTS.operational +
    paymentBehaviorScore * COMPONENT_WEIGHTS.paymentBehavior
  );
  
  const blockingFactors = identifyBlockingFactors(
    {
      liquidityScore,
      leverageScore,
      profitabilityScore,
      cashFlowScore,
      operationalScore,
      paymentBehaviorScore,
    },
    metricsSnapshot
  );
  
  const recommendations = generateRecommendations(blockingFactors, metricsSnapshot);
  
  return {
    scoreDate: new Date(),
    overallScore,
    liquidityScore,
    leverageScore,
    profitabilityScore,
    cashFlowScore,
    operationalScore,
    paymentBehaviorScore,
    blockingFactors,
    recommendations,
    scoreGrade: getScoreGrade(overallScore),
    loanEligibility: getLoanEligibility(overallScore),
    metricsSnapshotId: metricsSnapshot.id,
  };
}

/**
 * Identify blocking factors that are preventing a higher score
 */
export function identifyBlockingFactors(
  scores: {
    liquidityScore: number;
    leverageScore: number;
    profitabilityScore: number;
    cashFlowScore: number;
    operationalScore: number;
    paymentBehaviorScore: number;
  },
  metrics: FinancialMetricsSnapshot
): any[] {
  const factors: any[] = [];
  
  if (scores.liquidityScore < 60) {
    const currentRatio = parseFloat(metrics.currentRatio || '0');
    if (currentRatio < 1.5) {
      factors.push({
        metric: 'Current Ratio',
        threshold: 1.5,
        current: currentRatio,
        impact: 'high',
        category: 'liquidity',
      });
    }
  }
  
  if (scores.leverageScore < 60) {
    const debtToEquity = parseFloat(metrics.debtToEquityRatio || '0');
    if (debtToEquity > 2.0) {
      factors.push({
        metric: 'Debt-to-Equity Ratio',
        threshold: 2.0,
        current: debtToEquity,
        impact: 'high',
        category: 'leverage',
      });
    }
  }
  
  if (scores.profitabilityScore < 60) {
    const netMargin = parseFloat(metrics.netProfitMargin || '0') * 100;
    if (netMargin < 5) {
      factors.push({
        metric: 'Net Profit Margin',
        threshold: 5,
        current: netMargin,
        impact: 'medium',
        category: 'profitability',
      });
    }
  }
  
  if (scores.cashFlowScore < 60) {
    const ocf = parseFloat(metrics.operatingCashFlow || '0');
    if (ocf <= 0) {
      factors.push({
        metric: 'Operating Cash Flow',
        threshold: 0,
        current: ocf,
        impact: 'critical',
        category: 'cashFlow',
      });
    }
    
    const volatility = parseFloat(metrics.cashFlowVolatility || '0') * 100;
    if (volatility > 20) {
      factors.push({
        metric: 'Cash Flow Volatility',
        threshold: 20,
        current: volatility,
        impact: 'medium',
        category: 'cashFlow',
      });
    }
  }
  
  if (scores.operationalScore < 60) {
    const dso = parseFloat(metrics.daysInReceivables || '0');
    if (dso > 60) {
      factors.push({
        metric: 'Days Sales Outstanding',
        threshold: 60,
        current: dso,
        impact: 'medium',
        category: 'operational',
      });
    }
  }
  
  if (scores.paymentBehaviorScore < 60) {
    const lateRate = parseFloat(metrics.latePaymentRate || '0');
    if (lateRate > 20) {
      factors.push({
        metric: 'Late Payment Rate',
        threshold: 20,
        current: lateRate,
        impact: 'medium',
        category: 'paymentBehavior',
      });
    }
  }
  
  return factors;
}

/**
 * Generate actionable recommendations based on blocking factors
 */
function generateRecommendations(blockingFactors: any[], metrics: FinancialMetricsSnapshot): any[] {
  return blockingFactors.map(factor => {
    let recommendation = '';
    
    switch (factor.metric) {
      case 'Current Ratio':
        const gap = (1.5 - factor.current) * parseFloat(metrics.workingCapital || '0');
        recommendation = `Current ratio of ${factor.current.toFixed(2)} is below bank threshold of 1.5. Recommendation: Increase current assets by $${Math.abs(gap).toFixed(0)} or reduce short-term liabilities.`;
        break;
      
      case 'Debt-to-Equity Ratio':
        recommendation = `Debt-to-equity ratio of ${factor.current.toFixed(2)} exceeds bank threshold of 2.0. Recommendation: Reduce debt or raise equity to lower the ratio below 2.0.`;
        break;
      
      case 'Net Profit Margin':
        recommendation = `Net profit margin of ${factor.current.toFixed(1)}% is below bank threshold of 5%. Recommendation: Focus on cost reduction and revenue optimization to improve margins.`;
        break;
      
      case 'Operating Cash Flow':
        recommendation = `Negative operating cash flow indicates cash burn. Recommendation: Review operating expenses, accelerate collections, and negotiate better payment terms with suppliers.`;
        break;
      
      case 'Cash Flow Volatility':
        recommendation = `Cash flow volatility of ${factor.current.toFixed(1)}% exceeds 20% threshold. Recommendation: Establish a 90-day cash reserve buffer and implement more predictable billing cycles.`;
        break;
      
      case 'Days Sales Outstanding':
        recommendation = `DSO of ${factor.current.toFixed(0)} days exceeds recommended 60 days. Recommendation: Implement stricter credit policies and accelerate collection efforts.`;
        break;
      
      case 'Late Payment Rate':
        recommendation = `Late payment rate of ${factor.current.toFixed(1)}% exceeds 20% threshold. Recommendation: Improve payment scheduling and negotiate better terms with vendors.`;
        break;
      
      default:
        recommendation = `${factor.metric} requires improvement to meet bank standards.`;
    }
    
    return {
      metric: factor.metric,
      recommendation,
      impact: factor.impact,
      category: factor.category,
    };
  });
}

/**
 * Save bankability score to database
 */
export async function saveScore(
  tenantId: string,
  score: Omit<InsertBankabilityScore, 'tenantId'>
): Promise<BankabilityScore> {
  const [savedScore] = await db
    .insert(bankabilityScores)
    .values({
      tenantId,
      ...score,
    })
    .returning();
  
  const previousScore = await db
    .select()
    .from(bankabilityScores)
    .where(eq(bankabilityScores.tenantId, tenantId))
    .orderBy(desc(bankabilityScores.scoreDate))
    .limit(2);
  
  if (previousScore.length > 1) {
    const scoreChange = savedScore.overallScore! - previousScore[1].overallScore!;
    
    await db.insert(scoreHistory).values({
      tenantId,
      bankabilityScoreId: savedScore.id,
      scoreDate: savedScore.scoreDate,
      overallScore: savedScore.overallScore,
      scoreChange,
      significantChanges: [],
    });
  }
  
  return savedScore;
}

/**
 * Get the latest bankability score for a tenant
 */
export async function getLatestScore(
  tenantId: string
): Promise<BankabilityScore | null> {
  const [score] = await db
    .select()
    .from(bankabilityScores)
    .where(eq(bankabilityScores.tenantId, tenantId))
    .orderBy(desc(bankabilityScores.scoreDate))
    .limit(1);
  
  return score || null;
}

/**
 * Calculate and save bankability score from metrics snapshot
 */
export async function calculateAndSaveScore(
  tenantId: string,
  metricsSnapshot: FinancialMetricsSnapshot
): Promise<BankabilityScore> {
  const score = await calculateScore(metricsSnapshot);
  return await saveScore(tenantId, score);
}
