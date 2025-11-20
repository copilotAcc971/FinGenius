/**
 * Credit Passport PDF Generation Service (Task 7-15)
 * 
 * Generates comprehensive PDF reports for tenant creditworthiness analysis.
 * 
 * @module server/services/credit-passport-pdf
 */

import PDFDocument from 'pdfkit';
import { db } from '../db';
import { 
  bankabilityScores, 
  financialMetricsSnapshot, 
  scoreHistory, 
  tenants,
  tenantCompanyProfiles
} from '@shared/schema';
import { eq, desc, gte } from 'drizzle-orm';
import { calculateMetrics } from './financial-metrics';
import { calculateScore } from './bankability-scoring';
import { generateImprovementPlan } from './credit-insights';
import type { FinancialMetricsSnapshot, BankabilityScore } from '@shared/schema';

/**
 * Bank thresholds for visual indicators
 */
const BANK_THRESHOLDS = {
  currentRatio: 1.5,
  quickRatio: 1.0,
  cashRatio: 0.3,
  workingCapital: 0,
  debtToEquityRatio: 2.0,
  debtToAssetsRatio: 0.5,
  interestCoverageRatio: 3.0,
  grossProfitMargin: 0.30,
  netProfitMargin: 0.05,
  returnOnAssets: 0.04,
  returnOnEquity: 0.10,
  operatingCashFlow: 0,
  freeCashFlow: 0,
  cashFlowVolatility: 0.20,
  daysInReceivables: 60,
  daysInPayables: 45,
  inventoryTurnover: 4,
  revenueGrowthRate: 0.05,
  averagePaymentDelay: 5,
  latePaymentRate: 0.20,
} as const;

/**
 * Get color for score value
 */
function getScoreColor(score: number): string {
  if (score >= 80) return 'Green';
  if (score >= 60) return 'Yellow';
  return 'Red';
}

/**
 * Format metric value for display
 */
function formatMetricValue(value: string | null, isPercentage = false, isCurrency = false): string {
  if (!value) return 'N/A';
  const num = parseFloat(value);
  if (!isFinite(num)) return 'N/A';
  
  if (isCurrency) {
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else if (isPercentage) {
    return `${(num * 100).toFixed(2)}%`;
  } else {
    return num.toFixed(2);
  }
}

/**
 * Draw a simple score indicator (colored box)
 */
function drawScoreIndicator(doc: PDFKit.PDFDocument, x: number, y: number, score: number, label: string) {
  const color = getScoreColor(score);
  const colorMap: Record<string, string> = {
    'Green': '#16a34a',
    'Yellow': '#d97706',
    'Red': '#dc2626',
  };
  
  // Draw colored box
  doc.rect(x, y, 100, 20)
    .fillAndStroke(colorMap[color], '#000000')
    .fill();
  
  // Draw score text
  doc.fontSize(10)
    .fillColor('#ffffff')
    .text(score.toString(), x + 5, y + 5, { width: 90, align: 'center' });
  
  // Draw label
  doc.fontSize(8)
    .fillColor('#000000')
    .text(label, x, y + 25, { width: 100, align: 'center' });
}

/**
 * Generate Credit Passport PDF
 */
export async function generateCreditPassportPDF(tenantId: string): Promise<Buffer> {
  // Fetch tenant data
  const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!tenant || tenant.length === 0) {
    throw new Error(`Tenant ${tenantId} not found`);
  }
  
  const companyProfile = await db
    .select()
    .from(tenantCompanyProfiles)
    .where(eq(tenantCompanyProfiles.tenantId, tenantId))
    .limit(1);
  
  const tenantName = tenant[0].name;
  const companyName = companyProfile && companyProfile.length > 0 
    ? companyProfile[0].legalName || tenantName 
    : tenantName;
  
  // Fetch latest score and metrics
  const latestScore = await db
    .select()
    .from(bankabilityScores)
    .where(eq(bankabilityScores.tenantId, tenantId))
    .orderBy(desc(bankabilityScores.scoreDate))
    .limit(1);
  
  if (!latestScore || latestScore.length === 0) {
    throw new Error('No bankability score found. Please calculate score first.');
  }
  
  const score = latestScore[0];
  
  // Fetch metrics snapshot
  let metrics: FinancialMetricsSnapshot | null = null;
  if (score.metricsSnapshotId) {
    const metricsResult = await db
      .select()
      .from(financialMetricsSnapshot)
      .where(eq(financialMetricsSnapshot.id, score.metricsSnapshotId))
      .limit(1);
    
    if (metricsResult && metricsResult.length > 0) {
      metrics = metricsResult[0];
    }
  }
  
  if (!metrics) {
    throw new Error('No financial metrics snapshot found');
  }
  
  // Fetch score history (last 12 months)
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  
  const history = await db
    .select()
    .from(bankabilityScores)
    .where(
      eq(bankabilityScores.tenantId, tenantId)
    )
    .orderBy(desc(bankabilityScores.scoreDate))
    .limit(12);
  
  // Generate improvement plan
  const improvementPlan = generateImprovementPlan(metrics, score);
  
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    
    let currentPage = 1;
    
    // Helper to add footer
    const addFooter = () => {
      const footerY = doc.page.height - 50;
      doc.fontSize(7)
        .fillColor('#999999')
        .text(
          `Generated by Copilot Accountant on ${new Date().toLocaleDateString()} | Page ${currentPage}`,
          50,
          footerY,
          { align: 'center', width: doc.page.width - 100 }
        );
      
      doc.fontSize(6)
        .fillColor('#999999')
        .text(
          'This report is for informational purposes only. Actual loan decisions are subject to lender criteria and additional due diligence.',
          50,
          footerY + 12,
          { align: 'center', width: doc.page.width - 100 }
        );
      
      currentPage++;
    };
    
    // ========================================
    // COVER PAGE
    // ========================================
    doc.fontSize(32)
      .fillColor('#000000')
      .font('Helvetica-Bold')
      .text('Credit Passport', 50, 200, { align: 'center', width: doc.page.width - 100 });
    
    doc.fontSize(18)
      .font('Helvetica')
      .fillColor('#666666')
      .text(companyName, 50, 250, { align: 'center', width: doc.page.width - 100 });
    
    doc.fontSize(12)
      .fillColor('#999999')
      .text(
        `Generated on ${new Date().toLocaleDateString()}`,
        50,
        300,
        { align: 'center', width: doc.page.width - 100 }
      );
    
    addFooter();
    
    // ========================================
    // PAGE 1: EXECUTIVE SUMMARY
    // ========================================
    doc.addPage();
    
    doc.fontSize(24)
      .fillColor('#000000')
      .font('Helvetica-Bold')
      .text('Executive Summary', 50, 50);
    
    // Overall Score (Large and Prominent)
    doc.fontSize(16)
      .font('Helvetica')
      .text('Overall Credit Score', 50, 100);
    
    const scoreColor = getScoreColor(score.overallScore || 0);
    const scoreColorMap: Record<string, string> = {
      'Green': '#16a34a',
      'Yellow': '#d97706',
      'Red': '#dc2626',
    };
    
    doc.fontSize(72)
      .fillColor(scoreColorMap[scoreColor])
      .font('Helvetica-Bold')
      .text((score.overallScore || 0).toString(), 50, 130);
    
    doc.fontSize(16)
      .fillColor('#000000')
      .font('Helvetica')
      .text(`Grade: ${score.scoreGrade || 'N/A'}`, 150, 150);
    
    doc.fontSize(14)
      .text(`Loan Eligibility: ${(score.loanEligibility || 'N/A').replace(/_/g, ' ').toUpperCase()}`, 150, 175);
    
    // Score Trend
    doc.fontSize(14)
      .font('Helvetica')
      .text('12-Month Score Trend', 50, 250);
    
    if (history.length > 1) {
      const prevScore = history[history.length - 1].overallScore || 0;
      const currentScore = score.overallScore || 0;
      const change = currentScore - prevScore;
      const trend = change > 0 ? 'UP' : change < 0 ? 'DOWN' : 'STABLE';
      
      doc.fontSize(12)
        .fillColor('#666666')
        .text(`Trend: ${trend} (${change > 0 ? '+' : ''}${change} points)`, 50, 275);
      
      // Simple text-based chart (visual representation)
      doc.fontSize(10);
      let chartY = 300;
      const recentHistory = history.slice(0, 6).reverse();
      
      recentHistory.forEach((item, index) => {
        const monthDate = new Date(item.scoreDate);
        const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        const itemScore = item.overallScore || 0;
        const bar = '█'.repeat(Math.floor(itemScore / 5));
        
        doc.text(`${monthLabel}: ${bar} ${itemScore}`, 50, chartY);
        chartY += 15;
      });
    } else {
      doc.fontSize(12)
        .fillColor('#666666')
        .text('Insufficient historical data for trend analysis', 50, 275);
    }
    
    addFooter();
    
    // ========================================
    // PAGE 2-3: COMPONENT BREAKDOWN
    // ========================================
    doc.addPage();
    
    doc.fontSize(24)
      .fillColor('#000000')
      .font('Helvetica-Bold')
      .text('Component Breakdown', 50, 50);
    
    const components = [
      { 
        label: 'Liquidity', 
        score: score.liquidityScore || 0,
        description: 'Measures ability to meet short-term obligations with cash and liquid assets'
      },
      { 
        label: 'Leverage', 
        score: score.leverageScore || 0,
        description: 'Evaluates debt levels and ability to service debt obligations'
      },
      { 
        label: 'Profitability', 
        score: score.profitabilityScore || 0,
        description: 'Assesses profit generation efficiency and margins'
      },
      { 
        label: 'Cash Flow', 
        score: score.cashFlowScore || 0,
        description: 'Analyzes cash generation, usage, and volatility patterns'
      },
      { 
        label: 'Operational', 
        score: score.operationalScore || 0,
        description: 'Reviews operational efficiency and working capital management'
      },
      { 
        label: 'Payment Behavior', 
        score: score.paymentBehaviorScore || 0,
        description: 'Tracks payment timeliness and credit relationship quality'
      },
    ];
    
    let componentY = 100;
    components.forEach((component) => {
      drawScoreIndicator(doc, 50, componentY, component.score, component.label);
      componentY += 60;
    });
    
    // Component descriptions
    doc.fontSize(12)
      .fillColor('#000000')
      .font('Helvetica-Bold')
      .text('Component Analysis', 200, 100);
    
    doc.fontSize(9)
      .fillColor('#666666')
      .font('Helvetica');
    
    let descY = 120;
    components.forEach((component) => {
      const color = getScoreColor(component.score);
      
      // Component name and score
      doc.fontSize(10)
        .fillColor('#000000')
        .font('Helvetica-Bold')
        .text(`${component.label}: ${component.score}/100`, 200, descY);
      
      // Color indicator
      const colorMap: Record<string, string> = {
        'Green': '#16a34a',
        'Yellow': '#d97706',
        'Red': '#dc2626',
      };
      doc.fillColor(colorMap[color])
        .text(`(${color})`, 350, descY);
      
      descY += 15;
      
      // Description
      doc.fontSize(8)
        .fillColor('#666666')
        .font('Helvetica')
        .text(component.description, 200, descY, { width: 300 });
      
      descY += doc.heightOfString(component.description, { width: 300 }) + 10;
    });
    
    // Color legend
    doc.fontSize(10)
      .fillColor('#000000')
      .font('Helvetica-Bold')
      .text('Score Ranges:', 200, descY + 30);
    
    doc.fontSize(9)
      .font('Helvetica')
      .fillColor('#16a34a')
      .text('Green: 80-100 (Excellent)', 200, descY + 50);
    
    doc.fillColor('#d97706')
      .text('Yellow: 60-79 (Good)', 200, descY + 65);
    
    doc.fillColor('#dc2626')
      .text('Red: 0-59 (Needs Improvement)', 200, descY + 80);
    
    addFooter();
    
    // ========================================
    // PAGE 4-5: FINANCIAL METRICS DETAIL
    // ========================================
    doc.addPage();
    
    doc.fontSize(20)
      .fillColor('#000000')
      .font('Helvetica-Bold')
      .text('Financial Metrics Detail', 50, 50);
    
    // Metrics table
    const metricsData = [
      { category: 'Liquidity', metrics: [
        { name: 'Current Ratio', value: metrics.currentRatio, threshold: BANK_THRESHOLDS.currentRatio },
        { name: 'Quick Ratio', value: metrics.quickRatio, threshold: BANK_THRESHOLDS.quickRatio },
        { name: 'Cash Ratio', value: metrics.cashRatio, threshold: BANK_THRESHOLDS.cashRatio },
        { name: 'Working Capital', value: metrics.workingCapital, threshold: BANK_THRESHOLDS.workingCapital, isCurrency: true },
      ]},
      { category: 'Leverage', metrics: [
        { name: 'Debt to Equity', value: metrics.debtToEquityRatio, threshold: BANK_THRESHOLDS.debtToEquityRatio },
        { name: 'Debt to Assets', value: metrics.debtToAssetsRatio, threshold: BANK_THRESHOLDS.debtToAssetsRatio },
        { name: 'Interest Coverage', value: metrics.interestCoverageRatio, threshold: BANK_THRESHOLDS.interestCoverageRatio },
      ]},
      { category: 'Profitability', metrics: [
        { name: 'Gross Profit Margin', value: metrics.grossProfitMargin, threshold: BANK_THRESHOLDS.grossProfitMargin, isPercentage: true },
        { name: 'Net Profit Margin', value: metrics.netProfitMargin, threshold: BANK_THRESHOLDS.netProfitMargin, isPercentage: true },
        { name: 'Return on Assets', value: metrics.returnOnAssets, threshold: BANK_THRESHOLDS.returnOnAssets, isPercentage: true },
        { name: 'Return on Equity', value: metrics.returnOnEquity, threshold: BANK_THRESHOLDS.returnOnEquity, isPercentage: true },
      ]},
      { category: 'Cash Flow', metrics: [
        { name: 'Operating Cash Flow', value: metrics.operatingCashFlow, threshold: BANK_THRESHOLDS.operatingCashFlow, isCurrency: true },
        { name: 'Free Cash Flow', value: metrics.freeCashFlow, threshold: BANK_THRESHOLDS.freeCashFlow, isCurrency: true },
        { name: 'Cash Flow Volatility', value: metrics.cashFlowVolatility, threshold: BANK_THRESHOLDS.cashFlowVolatility, isPercentage: true },
      ]},
      { category: 'Operational', metrics: [
        { name: 'Days in Receivables (DSO)', value: metrics.daysInReceivables, threshold: BANK_THRESHOLDS.daysInReceivables },
        { name: 'Days in Payables (DPO)', value: metrics.daysInPayables, threshold: BANK_THRESHOLDS.daysInPayables },
        { name: 'Inventory Turnover', value: metrics.inventoryTurnover, threshold: BANK_THRESHOLDS.inventoryTurnover },
        { name: 'Revenue Growth Rate', value: metrics.revenueGrowthRate, threshold: BANK_THRESHOLDS.revenueGrowthRate, isPercentage: true },
      ]},
      { category: 'Payment Behavior', metrics: [
        { name: 'Avg Payment Delay', value: metrics.averagePaymentDelay, threshold: BANK_THRESHOLDS.averagePaymentDelay },
        { name: 'Late Payment Rate', value: metrics.latePaymentRate, threshold: BANK_THRESHOLDS.latePaymentRate, isPercentage: true },
      ]},
    ];
    
    let tableY = 90;
    
    metricsData.forEach((section) => {
      // Check if we need a new page
      if (tableY > 650) {
        addFooter();
        doc.addPage();
        tableY = 50;
      }
      
      doc.fontSize(14)
        .fillColor('#000000')
        .font('Helvetica-Bold')
        .text(section.category, 50, tableY);
      
      tableY += 25;
      
      doc.fontSize(9)
        .font('Helvetica-Bold');
      
      doc.text('Metric', 50, tableY);
      doc.text('Current', 250, tableY);
      doc.text('Threshold', 350, tableY);
      doc.text('Status', 480, tableY);
      
      tableY += 15;
      
      doc.moveTo(50, tableY).lineTo(550, tableY).stroke();
      tableY += 5;
      
      doc.font('Helvetica');
      
      section.metrics.forEach((metric) => {
        const currentValue = formatMetricValue(
          metric.value,
          metric.isPercentage,
          metric.isCurrency
        );
        
        const thresholdValue = metric.isPercentage
          ? `${(metric.threshold * 100).toFixed(2)}%`
          : metric.isCurrency
          ? `$${metric.threshold.toFixed(2)}`
          : metric.threshold.toFixed(2);
        
        const value = parseFloat(metric.value || '0');
        const isInverse = ['debtToEquityRatio', 'debtToAssetsRatio', 'cashFlowVolatility', 'daysInReceivables', 'averagePaymentDelay', 'latePaymentRate'].includes(
          metric.name.replace(/\s+/g, '')
        );
        
        let status = '';
        if (!metric.value || !isFinite(value)) {
          status = 'N/A';
          doc.fillColor('#999999');
        } else if (isInverse) {
          status = value <= metric.threshold ? 'PASS' : 'FAIL';
          doc.fillColor(value <= metric.threshold ? '#16a34a' : '#dc2626');
        } else {
          status = value >= metric.threshold ? 'PASS' : 'FAIL';
          doc.fillColor(value >= metric.threshold ? '#16a34a' : '#dc2626');
        }
        
        doc.fillColor('#000000');
        doc.text(metric.name, 50, tableY);
        doc.text(currentValue, 250, tableY);
        doc.text(thresholdValue, 350, tableY);
        
        // Color-code status
        doc.fillColor(status === 'PASS' ? '#16a34a' : status === 'FAIL' ? '#dc2626' : '#999999');
        doc.text(status, 480, tableY);
        doc.fillColor('#000000');
        
        tableY += 15;
      });
      
      tableY += 10;
    });
    
    addFooter();
    
    // ========================================
    // PAGE 6: BLOCKING FACTORS & RECOMMENDATIONS
    // ========================================
    doc.addPage();
    
    doc.fontSize(20)
      .fillColor('#000000')
      .font('Helvetica-Bold')
      .text('Blocking Factors & Recommendations', 50, 50);
    
    doc.fontSize(12)
      .font('Helvetica')
      .fillColor('#666666')
      .text('Top improvement opportunities to enhance creditworthiness', 50, 80);
    
    let recoY = 120;
    
    // Get blocking factors from insights for gap analysis
    const blockingFactors = improvementPlan.insights.flatMap(insight => insight.metrics);
    const topBlockers = blockingFactors.slice(0, 5);
    
    if (topBlockers.length > 0) {
      doc.fontSize(14)
        .fillColor('#000000')
        .font('Helvetica-Bold')
        .text('Top Blocking Factors', 50, recoY);
      
      recoY += 25;
      
      topBlockers.forEach((blocker, index) => {
        // Check if we need a new page
        if (recoY > 650) {
          addFooter();
          doc.addPage();
          recoY = 50;
        }
        
        const current = blocker.current !== null ? blocker.current : 0;
        const isPercentage = ['grossProfitMargin', 'netProfitMargin', 'returnOnAssets', 'returnOnEquity', 'cashFlowVolatility', 'revenueGrowthRate', 'latePaymentRate'].includes(blocker.metric);
        const isCurrency = ['workingCapital', 'operatingCashFlow', 'freeCashFlow'].includes(blocker.metric);
        
        const currentStr = formatMetricValue(current.toString(), isPercentage, isCurrency);
        const thresholdStr = isPercentage 
          ? `${(blocker.threshold * 100).toFixed(2)}%`
          : isCurrency
          ? `$${blocker.threshold.toFixed(2)}`
          : blocker.threshold.toFixed(2);
        const gapStr = formatMetricValue(Math.abs(blocker.gap).toString(), isPercentage, isCurrency);
        
        doc.fontSize(10)
          .fillColor('#000000')
          .font('Helvetica-Bold')
          .text(`${index + 1}. ${blocker.metric.replace(/([A-Z])/g, ' $1').trim()} (${blocker.impact.toUpperCase()})`, 50, recoY);
        
        recoY += 15;
        
        doc.fontSize(9)
          .font('Helvetica')
          .fillColor('#dc2626')
          .text(`Current: ${currentStr} | Threshold: ${thresholdStr} | Gap: ${gapStr}`, 50, recoY);
        
        recoY += 20;
      });
      
      recoY += 15;
    }
    
    // Top 5 actionable recommendations
    const topRecommendations = improvementPlan.quickWins
      .concat(improvementPlan.longTermActions)
      .slice(0, 5);
    
    if (topRecommendations.length > 0) {
      if (recoY > 650) {
        addFooter();
        doc.addPage();
        recoY = 50;
      }
      
      doc.fontSize(14)
        .fillColor('#000000')
        .font('Helvetica-Bold')
        .text('Actionable Recommendations', 50, recoY);
      
      recoY += 25;
      
      topRecommendations.forEach((reco, index) => {
        // Check if we need a new page
        if (recoY > 650) {
          addFooter();
          doc.addPage();
          recoY = 50;
        }
        
        doc.fontSize(10)
          .fillColor('#000000')
          .font('Helvetica-Bold')
          .text(`${index + 1}. ${reco.metric.replace(/([A-Z])/g, ' $1').trim()} (${reco.priority.toUpperCase()})`, 50, recoY);
        
        recoY += 15;
        
        doc.fontSize(9)
          .font('Helvetica')
          .fillColor('#333333')
          .text(reco.recommendation, 50, recoY, { width: 500 });
        
        recoY += doc.heightOfString(reco.recommendation, { width: 500 }) + 5;
        
        doc.fontSize(8)
          .fillColor('#666666')
          .text(
            `Estimated Impact: +${reco.estimatedImpact} points | Timeframe: ${reco.timeframe}`,
            50,
            recoY
          );
        
        recoY += 25;
      });
    } else {
      doc.fontSize(10)
        .fillColor('#16a34a')
        .font('Helvetica')
        .text('No critical blocking factors detected. Your credit profile is strong!', 50, recoY);
      recoY += 20;
    }
    
    // Priority Timeline
    if (improvementPlan.quickWins.length > 0 || improvementPlan.longTermActions.length > 0) {
      recoY += 20;
      
      if (recoY > 650) {
        addFooter();
        doc.addPage();
        recoY = 50;
      }
      
      doc.fontSize(14)
        .fillColor('#000000')
        .font('Helvetica-Bold')
        .text('Priority Timeline', 50, recoY);
      
      recoY += 25;
      
      doc.fontSize(10)
        .font('Helvetica')
        .fillColor('#666666')
        .text(`Quick Wins (1-3 months): ${improvementPlan.quickWins.length} actions`, 50, recoY);
      
      recoY += 15;
      
      doc.text(`Long-Term Actions (3-12 months): ${improvementPlan.longTermActions.length} actions`, 50, recoY);
      
      recoY += 15;
      
      doc.fillColor('#000000')
        .text(`Estimated Time to Target Score (${improvementPlan.targetScore}): ${improvementPlan.estimatedTimeToTarget}`, 50, recoY);
    }
    
    addFooter();
    
    doc.end();
  });
}
