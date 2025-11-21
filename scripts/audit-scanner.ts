#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface FileIssue {
  type: string;
  count: number;
  patterns: string[];
  examples: string[];
}

interface FileAnalysis {
  path: string;
  issues: FileIssue[];
  safetyLevel: 'GREEN' | 'YELLOW' | 'RED';
  automationSafe: boolean;
  reason: string;
  recommendations: string[];
}

interface ScanReport {
  timestamp: string;
  totalFiles: number;
  categorization: {
    green: number;
    yellow: number;
    red: number;
  };
  files: FileAnalysis[];
  automationPlan: {
    immediatelySafe: string[];
    needsReview: string[];
    manualOnly: string[];
  };
}

class AuditScanner {
  private criticalFiles = [
    'server/middleware/rbac.ts',
    'server/middleware/auth.ts',
    'server/accounting/service.ts',
    'server/accounting/system-accounts.ts',
    'server/open-banking/encryption.ts',
    'server/e-invoicing/',
    'server/audit/audit-logger.ts',
    'server/storage.ts',
    'server/db.ts'
  ];

  private businessLogicPatterns = [
    'calculateTax',
    'calculateTotal',
    'convertCurrency',
    'postToGL',
    'createJournalEntry',
    'reconcile',
    'approve',
    'void',
    'reverse'
  ];

  analyzeFile(filePath: string): FileAnalysis {
    const content = fs.readFileSync(filePath, 'utf-8');
    const issues: FileIssue[] = [];
    
    // 1. Debug statements
    const debugPatterns = [
      /console\.(log|warn|error|info|debug)/g,
      /logger\.(log|warn|error|info|debug)/g,
      /debugger/g,
      /alert\(/g
    ];
    
    const debugMatches: string[] = [];
    debugPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) debugMatches.push(...matches);
    });
    
    if (debugMatches.length > 0) {
      issues.push({
        type: 'debug_statements',
        count: debugMatches.length,
        patterns: [...new Set(debugMatches.slice(0, 5))],
        examples: this.getLineExamples(content, debugMatches[0], 2)
      });
    }

    // 2. Type safety bypasses
    const typeBypassPatterns = [
      /\/\/ @ts-ignore/g,
      /\/\/ @ts-nocheck/g,
      /as any/g,
      /: any/g,
      /<any>/g
    ];
    
    const typeMatches: string[] = [];
    typeBypassPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) typeMatches.push(...matches);
    });
    
    if (typeMatches.length > 0) {
      issues.push({
        type: 'type_bypasses',
        count: typeMatches.length,
        patterns: [...new Set(typeMatches.slice(0, 5))],
        examples: this.getLineExamples(content, typeMatches[0], 2)
      });
    }

    // 3. Missing error handling
    const asyncNoTryCatch = content.match(/async\s+[^{]*\{[^}]*\}/g) || [];
    const tryCatchCount = (content.match(/try\s*\{/g) || []).length;
    
    if (asyncNoTryCatch.length > 0 && tryCatchCount < asyncNoTryCatch.length / 2) {
      issues.push({
        type: 'missing_error_handling',
        count: asyncNoTryCatch.length - tryCatchCount,
        patterns: ['async without try-catch'],
        examples: []
      });
    }

    // 4. Missing validation
    if (filePath.includes('routes.ts') || filePath.includes('controller')) {
      const endpoints = content.match(/app\.(get|post|put|delete|patch)/g) || [];
      const validations = content.match(/z\.(object|string|number)|zod\.|validate/g) || [];
      
      if (endpoints.length > validations.length) {
        issues.push({
          type: 'missing_validation',
          count: endpoints.length - validations.length,
          patterns: ['endpoints without validation'],
          examples: []
        });
      }
    }

    // 5. Missing RBAC
    if (filePath.includes('routes.ts')) {
      const endpoints = content.match(/app\.(get|post|put|delete|patch)/g) || [];
      const rbacProtected = content.match(/requirePermission|requireRole|loadAuthContext/g) || [];
      
      if (endpoints.length > rbacProtected.length) {
        issues.push({
          type: 'missing_rbac',
          count: endpoints.length - rbacProtected.length,
          patterns: ['unprotected endpoints'],
          examples: []
        });
      }
    }

    // Determine safety level
    const { safetyLevel, reason, recommendations } = this.determineSafety(filePath, issues);
    
    return {
      path: filePath,
      issues,
      safetyLevel,
      automationSafe: safetyLevel === 'GREEN',
      reason,
      recommendations
    };
  }

  private determineSafety(filePath: string, issues: FileIssue[]): {
    safetyLevel: 'GREEN' | 'YELLOW' | 'RED';
    reason: string;
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    
    // RED: Critical files or business logic
    if (this.criticalFiles.some(critical => filePath.includes(critical))) {
      return {
        safetyLevel: 'RED',
        reason: 'Critical system file - manual review required',
        recommendations: ['Manual review by senior developer', 'Test thoroughly after any changes']
      };
    }
    
    // RED: Contains business logic
    const content = fs.readFileSync(filePath, 'utf-8');
    if (this.businessLogicPatterns.some(pattern => content.includes(pattern))) {
      return {
        safetyLevel: 'RED',
        reason: 'Contains business logic - manual review required',
        recommendations: ['Review calculations manually', 'Add unit tests before changes']
      };
    }
    
    // RED: Complex files with many issues
    const totalIssues = issues.reduce((sum, issue) => sum + issue.count, 0);
    if (totalIssues > 50) {
      return {
        safetyLevel: 'RED',
        reason: `High complexity - ${totalIssues} issues found`,
        recommendations: ['Break into smaller files first', 'Refactor before automation']
      };
    }
    
    // YELLOW: Moderate issues or important files
    if (filePath.includes('server/') && issues.length > 0) {
      const debugOnly = issues.every(i => i.type === 'debug_statements');
      if (!debugOnly) {
        return {
          safetyLevel: 'YELLOW',
          reason: 'Server file with multiple issue types',
          recommendations: ['Apply automation with review', 'Test after each change']
        };
      }
    }
    
    // YELLOW: Frontend with complex patterns
    if (filePath.includes('client/') && totalIssues > 10) {
      return {
        safetyLevel: 'YELLOW',
        reason: 'Frontend file with multiple issues',
        recommendations: ['Review UI after changes', 'Check for visual regressions']
      };
    }
    
    // GREEN: Safe for automation
    if (issues.length === 0) {
      return {
        safetyLevel: 'GREEN',
        reason: 'No issues found - already clean',
        recommendations: ['No action needed']
      };
    }
    
    if (issues.every(i => i.type === 'debug_statements' && i.count < 5)) {
      return {
        safetyLevel: 'GREEN',
        reason: 'Only simple debug statements - safe to remove',
        recommendations: ['Automated removal safe', 'Batch with similar files']
      };
    }
    
    return {
      safetyLevel: 'GREEN',
      reason: 'Simple patterns - automation safe',
      recommendations: ['Include in batch automation', 'Verify with quick test']
    };
  }

  private getLineExamples(content: string, pattern: string, maxExamples: number): string[] {
    const lines = content.split('\n');
    const examples: string[] = [];
    
    lines.forEach((line, index) => {
      if (line.includes(pattern) && examples.length < maxExamples) {
        examples.push(`Line ${index + 1}: ${line.trim().substring(0, 80)}...`);
      }
    });
    
    return examples;
  }

  async scanProject(): Promise<ScanReport> {
    console.log('🔍 Starting comprehensive audit scan...\n');
    
    const allFiles: string[] = [];
    const scanDirs = ['./server', './client/src'];
    
    // Collect all TypeScript/React files
    scanDirs.forEach(dir => {
      if (fs.existsSync(dir)) {
        this.collectFiles(dir, allFiles);
      }
    });
    
    console.log(`📁 Found ${allFiles.length} files to analyze\n`);
    
    const analyses: FileAnalysis[] = [];
    const categorization = { green: 0, yellow: 0, red: 0 };
    
    // Analyze each file
    allFiles.forEach((file, index) => {
      if (index % 10 === 0) {
        process.stdout.write(`\rAnalyzing: ${index}/${allFiles.length} files...`);
      }
      
      try {
        const analysis = this.analyzeFile(file);
        analyses.push(analysis);
        
        switch (analysis.safetyLevel) {
          case 'GREEN': categorization.green++; break;
          case 'YELLOW': categorization.yellow++; break;
          case 'RED': categorization.red++; break;
        }
      } catch (error) {
        console.error(`\nError analyzing ${file}:`, error);
      }
    });
    
    console.log('\n\n✅ Scan complete!\n');
    
    // Create automation plan
    const automationPlan = {
      immediatelySafe: analyses
        .filter(a => a.safetyLevel === 'GREEN' && a.issues.length > 0)
        .map(a => a.path),
      needsReview: analyses
        .filter(a => a.safetyLevel === 'YELLOW')
        .map(a => a.path),
      manualOnly: analyses
        .filter(a => a.safetyLevel === 'RED')
        .map(a => a.path)
    };
    
    const report: ScanReport = {
      timestamp: new Date().toISOString(),
      totalFiles: allFiles.length,
      categorization,
      files: analyses,
      automationPlan
    };
    
    // Save detailed report
    fs.writeFileSync('audit-scan-report.json', JSON.stringify(report, null, 2));
    
    // Print summary
    this.printSummary(report);
    
    return report;
  }

  private collectFiles(dir: string, files: string[]): void {
    const items = fs.readdirSync(dir);
    
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.includes('node_modules') && !item.startsWith('.')) {
        this.collectFiles(fullPath, files);
      } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.tsx'))) {
        files.push(fullPath);
      }
    });
  }

  private printSummary(report: ScanReport): void {
    console.log('📊 SCAN SUMMARY');
    console.log('═══════════════════════════════════════════\n');
    
    console.log(`Total Files Analyzed: ${report.totalFiles}`);
    console.log(`✅ GREEN (Safe for automation): ${report.categorization.green} files (${(report.categorization.green/report.totalFiles*100).toFixed(1)}%)`);
    console.log(`🟡 YELLOW (Needs review): ${report.categorization.yellow} files (${(report.categorization.yellow/report.totalFiles*100).toFixed(1)}%)`);
    console.log(`🔴 RED (Manual only): ${report.categorization.red} files (${(report.categorization.red/report.totalFiles*100).toFixed(1)}%)\n`);
    
    console.log('🎯 TOP ISSUES FOUND:');
    const issueCounts: { [key: string]: number } = {};
    report.files.forEach(file => {
      file.issues.forEach(issue => {
        issueCounts[issue.type] = (issueCounts[issue.type] || 0) + issue.count;
      });
    });
    
    Object.entries(issueCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([type, count]) => {
        console.log(`  - ${type}: ${count} instances`);
      });
    
    console.log('\n🚀 AUTOMATION RECOMMENDATIONS:');
    console.log(`  - ${report.automationPlan.immediatelySafe.length} files ready for immediate automation`);
    console.log(`  - ${report.automationPlan.needsReview.length} files need review before automation`);
    console.log(`  - ${report.automationPlan.manualOnly.length} files require manual fixes`);
    
    if (report.automationPlan.immediatelySafe.length > 0) {
      console.log('\n✨ Quick wins (safe to automate now):');
      report.automationPlan.immediatelySafe.slice(0, 5).forEach(file => {
        console.log(`  - ${file}`);
      });
      if (report.automationPlan.immediatelySafe.length > 5) {
        console.log(`  ... and ${report.automationPlan.immediatelySafe.length - 5} more`);
      }
    }
    
    console.log('\n📄 Full report saved to: audit-scan-report.json');
    console.log('💡 Next step: Run automation on GREEN files first\n');
  }
}

// Run the scanner
const scanner = new AuditScanner();
scanner.scanProject().catch(console.error);