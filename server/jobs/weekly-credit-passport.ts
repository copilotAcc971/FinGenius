/**
 * Weekly Credit Passport Recalculation Job (Task 7-29)
 * 
 * Runs weekly on Monday at 8 AM UTC to:
 * - Recalculate financial metrics for all active tenants
 * - Update bankability scores
 * - Generate improvement insights
 * - Send email digest with PDF attachment
 * 
 * @module server/jobs/weekly-credit-passport
 */

import cron from 'node-cron';
import { db } from '../db';
import { tenants, bankabilityScores, tenantCompanyProfiles } from '@shared/schema';
import { eq, desc, gte } from 'drizzle-orm';
import { calculateMetrics } from '../services/financial-metrics';
import { calculateAndSaveScore } from '../services/bankability-scoring';
import { generateImprovementPlan } from '../services/credit-insights';
import { generateCreditPassportPDF } from '../services/credit-passport-pdf';
import { sendReportEmail } from '../email-service';
import type { BankabilityScore } from '@shared/schema';

let weeklyCreditPassportJob: cron.ScheduledTask | null = null;

interface WeeklyCreditPassportResult {
  success: boolean;
  tenantId: string;
  tenantName: string;
  currentScore: number;
  previousScore: number | null;
  scoreTrend: 'up' | 'down' | 'stable';
  scoreDelta: number;
  executionTime: number;
  emailSent: boolean;
  error?: string;
}

/**
 * Check if tenant has enough historical data (>3 months)
 */
async function hasEnoughHistoricalData(tenantId: string): Promise<boolean> {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  
  const oldestScore = await db
    .select()
    .from(bankabilityScores)
    .where(eq(bankabilityScores.tenantId, tenantId))
    .orderBy(bankabilityScores.scoreDate)
    .limit(1);
  
  if (!oldestScore || oldestScore.length === 0) {
    return false;
  }
  
  const oldestDate = new Date(oldestScore[0].scoreDate);
  return oldestDate <= threeMonthsAgo;
}

/**
 * Create email digest content
 */
function createEmailDigest(
  tenantName: string,
  currentScore: number,
  previousScore: number | null,
  scoreTrend: 'up' | 'down' | 'stable',
  scoreDelta: number,
  topRecommendations: string[],
  grade: string | null
): string {
  const trendEmoji = scoreTrend === 'up' ? '📈' : scoreTrend === 'down' ? '📉' : '➡️';
  const trendText = scoreTrend === 'up' ? 'improved' : scoreTrend === 'down' ? 'decreased' : 'remained stable';
  const deltaText = scoreDelta !== 0 ? ` (${scoreDelta > 0 ? '+' : ''}${scoreDelta} points)` : '';
  
  let htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
    .content { padding: 20px; max-width: 600px; margin: 0 auto; }
    .score-box { background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; }
    .score-large { font-size: 48px; font-weight: bold; color: #667eea; margin: 10px 0; }
    .trend { font-size: 24px; margin: 10px 0; }
    .recommendations { background: #fff; border: 1px solid #e0e0e0; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .recommendation-item { margin: 10px 0; padding-left: 20px; position: relative; }
    .recommendation-item:before { content: "✓"; position: absolute; left: 0; color: #667eea; font-weight: bold; }
    .footer { text-align: center; color: #999; font-size: 12px; padding: 20px; border-top: 1px solid #e0e0e0; margin-top: 30px; }
    .cta-button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 Weekly Credit Passport Update</h1>
    <p>${tenantName}</p>
  </div>
  
  <div class="content">
    <h2>Your Credit Score Update</h2>
    
    <div class="score-box">
      <div class="score-large">${currentScore}</div>
      <div style="font-size: 18px; color: #666;">Grade: ${grade || 'N/A'}</div>
      <div class="trend">
        ${trendEmoji} Your score has ${trendText}${deltaText}
      </div>`;
  
  if (previousScore !== null) {
    htmlContent += `
      <div style="color: #666; font-size: 14px; margin-top: 15px;">
        Previous score: ${previousScore}
      </div>`;
  }
  
  htmlContent += `
    </div>
    
    <h3>Top 3 Recommendations to Improve Your Score</h3>
    <div class="recommendations">`;
  
  if (topRecommendations.length > 0) {
    topRecommendations.forEach((rec) => {
      htmlContent += `
      <div class="recommendation-item">${rec}</div>`;
    });
  } else {
    htmlContent += `
      <div style="color: #16a34a; text-align: center; padding: 20px;">
        Great job! Your credit profile is strong with no critical issues.
      </div>`;
  }
  
  htmlContent += `
    </div>
    
    <div style="text-align: center;">
      <p>For detailed analysis and full insights, view your complete Credit Passport (attached as PDF).</p>
    </div>
    
    <div class="footer">
      <p>This is an automated weekly report from Copilot Accountant.</p>
      <p>Generated on ${new Date().toLocaleDateString()}</p>
    </div>
  </div>
</body>
</html>`;
  
  return htmlContent;
}

/**
 * Run weekly credit passport recalculation for a single tenant
 */
export async function runWeeklyCreditPassport(tenantId: string): Promise<WeeklyCreditPassportResult> {
  const startTime = Date.now();
  
  console.log(`[Weekly Credit Passport] Starting recalculation for tenant ${tenantId}`);
  
  try {
    // Get tenant info
    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    if (!tenant || tenant.length === 0) {
      throw new Error(`Tenant ${tenantId} not found`);
    }
    
    const tenantName = tenant[0].name;
    
    // Check if tenant has enough historical data (>3 months)
    const hasHistory = await hasEnoughHistoricalData(tenantId);
    if (!hasHistory) {
      console.log(`[Weekly Credit Passport] Skipping tenant ${tenantName} - insufficient historical data (<3 months)`);
      return {
        success: true,
        tenantId,
        tenantName,
        currentScore: 0,
        previousScore: null,
        scoreTrend: 'stable',
        scoreDelta: 0,
        executionTime: Date.now() - startTime,
        emailSent: false,
        error: 'Insufficient historical data (<3 months)',
      };
    }
    
    console.log(`[Weekly Credit Passport] ✓ Tenant ${tenantName} has sufficient historical data`);
    
    // Get previous score (last week)
    const previousScores = await db
      .select()
      .from(bankabilityScores)
      .where(eq(bankabilityScores.tenantId, tenantId))
      .orderBy(desc(bankabilityScores.scoreDate))
      .limit(2);
    
    const previousScore = previousScores.length > 1 ? previousScores[1].overallScore : null;
    
    // 1. Calculate latest financial metrics
    console.log(`[Weekly Credit Passport] Calculating financial metrics...`);
    const metrics = await calculateMetrics(tenantId);
    console.log(`[Weekly Credit Passport] ✓ Financial metrics calculated`);
    
    // 2. Calculate and save bankability score
    console.log(`[Weekly Credit Passport] Calculating bankability score...`);
    const score = await calculateAndSaveScore(tenantId);
    console.log(`[Weekly Credit Passport] ✓ Bankability score calculated and saved`);
    
    const currentScore = score.overallScore || 0;
    const scoreDelta = previousScore !== null ? currentScore - previousScore : 0;
    
    let scoreTrend: 'up' | 'down' | 'stable' = 'stable';
    if (scoreDelta > 0) scoreTrend = 'up';
    else if (scoreDelta < 0) scoreTrend = 'down';
    
    // 3. Generate improvement insights
    console.log(`[Weekly Credit Passport] Generating improvement insights...`);
    const insights = generateImprovementPlan(metrics, score);
    console.log(`[Weekly Credit Passport] ✓ Improvement insights generated`);
    
    // Get top 3 recommendations
    const topRecommendations = insights.quickWins
      .concat(insights.longTermActions)
      .slice(0, 3)
      .map(rec => rec.recommendation);
    
    // 4. Generate Credit Passport PDF
    console.log(`[Weekly Credit Passport] Generating Credit Passport PDF...`);
    const pdfBuffer = await generateCreditPassportPDF(tenantId);
    console.log(`[Weekly Credit Passport] ✓ Credit Passport PDF generated`);
    
    // 5. Get company profile for email recipient
    const companyProfile = await db
      .select()
      .from(tenantCompanyProfiles)
      .where(eq(tenantCompanyProfiles.tenantId, tenantId))
      .limit(1);
    
    const recipientEmail = companyProfile && companyProfile.length > 0 
      ? companyProfile[0].contactEmail 
      : tenant[0].email;
    
    if (!recipientEmail) {
      console.warn(`[Weekly Credit Passport] No email address found for tenant ${tenantName}`);
      return {
        success: true,
        tenantId,
        tenantName,
        currentScore,
        previousScore,
        scoreTrend,
        scoreDelta,
        executionTime: Date.now() - startTime,
        emailSent: false,
        error: 'No email address configured',
      };
    }
    
    // 6. Create email digest
    const emailContent = createEmailDigest(
      tenantName,
      currentScore,
      previousScore,
      scoreTrend,
      scoreDelta,
      topRecommendations,
      score.scoreGrade
    );
    
    // 7. Send email via Outlook integration
    console.log(`[Weekly Credit Passport] Sending email digest to ${recipientEmail}...`);
    
    try {
      const emailSent = await sendReportEmail({
        recipients: [recipientEmail],
        subject: `📊 Weekly Credit Passport Update - Score: ${currentScore}`,
        body: emailContent,
        attachments: [{
          filename: `Credit_Passport_${tenantName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        }]
      });
      
      if (!emailSent) {
        throw new Error('Email service returned false');
      }
      
      console.log(`[Weekly Credit Passport] ✓ Email sent successfully to ${recipientEmail}`);
      
      const executionTime = Date.now() - startTime;
      
      console.log(`[Weekly Credit Passport] ✓ Completed for tenant ${tenantName}`);
      console.log(`[Weekly Credit Passport]   - Current score: ${currentScore}`);
      console.log(`[Weekly Credit Passport]   - Previous score: ${previousScore}`);
      console.log(`[Weekly Credit Passport]   - Trend: ${scoreTrend} (${scoreDelta > 0 ? '+' : ''}${scoreDelta})`);
      console.log(`[Weekly Credit Passport]   - Execution time: ${executionTime}ms`);
      
      return {
        success: true,
        tenantId,
        tenantName,
        currentScore,
        previousScore,
        scoreTrend,
        scoreDelta,
        executionTime,
        emailSent: true,
      };
      
    } catch (emailError: any) {
      console.error(`[Weekly Credit Passport] Failed to send email:`, emailError);
      
      // Still consider it a partial success if calculations worked
      return {
        success: true,
        tenantId,
        tenantName,
        currentScore,
        previousScore,
        scoreTrend,
        scoreDelta,
        executionTime: Date.now() - startTime,
        emailSent: false,
        error: `Email failed: ${emailError.message}`,
      };
    }
    
  } catch (error: any) {
    console.error(`[Weekly Credit Passport] Failed for tenant ${tenantId}:`, error);
    
    return {
      success: false,
      tenantId,
      tenantName: 'Unknown',
      currentScore: 0,
      previousScore: null,
      scoreTrend: 'stable',
      scoreDelta: 0,
      executionTime: Date.now() - startTime,
      emailSent: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Initialize and start the weekly credit passport recalculation job
 * Runs every Monday at 8 AM UTC
 */
export async function initializeWeeklyCreditPassport(): Promise<void> {
  console.log('[Weekly Credit Passport] Initializing weekly recalculation job...');
  console.log('[Weekly Credit Passport] Schedule: 0 8 * * 1 (Monday 8 AM UTC)');
  
  // Stop existing job if running
  if (weeklyCreditPassportJob) {
    weeklyCreditPassportJob.stop();
    console.log('[Weekly Credit Passport] Stopped existing job');
  }
  
  // Schedule job to run every Monday at 8 AM UTC
  weeklyCreditPassportJob = cron.schedule('0 8 * * 1', async () => {
    const jobStartTime = Date.now();
    console.log('==============================================');
    console.log('[Weekly Credit Passport] Starting weekly recalculation job');
    console.log(`[Weekly Credit Passport] Execution time: ${new Date().toISOString()}`);
    console.log('==============================================');
    
    try {
      // Get all active tenants
      const allTenants = await db.select({ id: tenants.id, name: tenants.name }).from(tenants);
      
      console.log(`[Weekly Credit Passport] Processing ${allTenants.length} tenants`);
      
      let successCount = 0;
      let failureCount = 0;
      let skippedCount = 0;
      let emailsSent = 0;
      
      const results: WeeklyCreditPassportResult[] = [];
      
      // Process each tenant
      for (const tenant of allTenants) {
        try {
          console.log(`\n[Weekly Credit Passport] Processing tenant: ${tenant.name} (${tenant.id})`);
          
          const result = await runWeeklyCreditPassport(tenant.id);
          results.push(result);
          
          if (result.success) {
            if (result.error) {
              skippedCount++;
              console.log(`[Weekly Credit Passport] ⊘ Skipped tenant ${tenant.name}: ${result.error}`);
            } else {
              successCount++;
              if (result.emailSent) {
                emailsSent++;
              }
              console.log(`[Weekly Credit Passport] ✓ Success for tenant ${tenant.name}`);
            }
          } else {
            failureCount++;
            console.error(`[Weekly Credit Passport] ✗ Failed for tenant ${tenant.name}: ${result.error}`);
          }
          
        } catch (error) {
          failureCount++;
          console.error(`[Weekly Credit Passport] ✗ Failed to process tenant ${tenant.name}:`, error);
          // Continue with next tenant (error handling: don't stop entire job)
        }
      }
      
      const totalJobTime = Date.now() - jobStartTime;
      
      console.log('\n==============================================');
      console.log('[Weekly Credit Passport] Weekly recalculation job completed');
      console.log(`[Weekly Credit Passport] Total execution time: ${totalJobTime}ms`);
      console.log(`[Weekly Credit Passport] Summary:`);
      console.log(`[Weekly Credit Passport]   - Total tenants: ${allTenants.length}`);
      console.log(`[Weekly Credit Passport]   - Successful: ${successCount}`);
      console.log(`[Weekly Credit Passport]   - Skipped: ${skippedCount}`);
      console.log(`[Weekly Credit Passport]   - Failed: ${failureCount}`);
      console.log(`[Weekly Credit Passport]   - Emails sent: ${emailsSent}`);
      console.log('==============================================\n');
      
    } catch (error) {
      console.error('[Weekly Credit Passport] Critical error during weekly recalculation job:', error);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });
  
  console.log('[Weekly Credit Passport] ✓ Weekly recalculation job successfully scheduled');
}

/**
 * Manually trigger weekly credit passport recalculation for a specific tenant
 * Useful for testing or on-demand recalculation
 */
export async function triggerWeeklyCreditPassportForTenant(tenantId: string): Promise<void> {
  console.log(`[Weekly Credit Passport] Manually triggering recalculation for tenant ${tenantId}`);
  
  const result = await runWeeklyCreditPassport(tenantId);
  
  if (result.success) {
    console.log(`[Weekly Credit Passport] ✓ Successfully processed tenant ${tenantId}`);
    console.log(`[Weekly Credit Passport]   - Current score: ${result.currentScore}`);
    console.log(`[Weekly Credit Passport]   - Execution time: ${result.executionTime}ms`);
    console.log(`[Weekly Credit Passport]   - Email sent: ${result.emailSent}`);
  } else {
    console.error(`[Weekly Credit Passport] ✗ Failed for tenant ${tenantId}: ${result.error}`);
    throw new Error(`Failed to process tenant: ${result.error}`);
  }
}

/**
 * Manually trigger weekly credit passport recalculation for all tenants
 * Useful for testing or immediate recalculation
 */
export async function triggerWeeklyCreditPassportForAllTenants(): Promise<void> {
  console.log('[Weekly Credit Passport] Manually triggering recalculation for all tenants');
  
  try {
    const allTenants = await db.select({ id: tenants.id, name: tenants.name }).from(tenants);
    
    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;
    
    for (const tenant of allTenants) {
      try {
        const result = await runWeeklyCreditPassport(tenant.id);
        if (result.success) {
          if (result.error) {
            skippedCount++;
          } else {
            successCount++;
          }
          console.log(`[Weekly Credit Passport] ✓ Completed for tenant ${tenant.name}`);
        } else {
          failureCount++;
          console.error(`[Weekly Credit Passport] ✗ Failed for tenant ${tenant.name}`);
        }
      } catch (error) {
        failureCount++;
        console.error(`[Weekly Credit Passport] ✗ Failed for tenant ${tenant.name}:`, error);
      }
    }
    
    console.log(`[Weekly Credit Passport] ✓ Processed ${allTenants.length} tenants`);
    console.log(`[Weekly Credit Passport]   - Successful: ${successCount}`);
    console.log(`[Weekly Credit Passport]   - Skipped: ${skippedCount}`);
    console.log(`[Weekly Credit Passport]   - Failed: ${failureCount}`);
  } catch (error) {
    console.error('[Weekly Credit Passport] ✗ Failed to process tenants:', error);
    throw error;
  }
}
