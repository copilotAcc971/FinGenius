#!/usr/bin/env tsx

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface LintReport {
  filePath: string;
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
}

class SafeLintFixer {
  private greenFiles: string[] = [];
  private yellowFiles: string[] = [];
  private redFiles: string[] = [];
  
  // Critical files that need manual review
  private criticalPaths = [
    'server/middleware/',
    'server/accounting/',
    'server/audit/',
    'server/rbac/',
    'server/open-banking/encryption',
    'server/e-invoicing/',
    'server/storage.ts',
    'server/db.ts'
  ];

  async analyze() {
    console.log('🔍 Analyzing codebase for ESLint violations...\n');
    
    // First, get a report of all violations
    try {
      const output = execSync('npx eslint . --ext .ts,.tsx --format json', {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
      
      const report = JSON.parse(output);
      this.categorizeFiles(report);
      
    } catch (error: any) {
      // ESLint exits with error code when violations found
      if (error.stdout) {
        const report = JSON.parse(error.stdout);
        this.categorizeFiles(report);
      }
    }
    
    this.printAnalysis();
  }

  private categorizeFiles(report: any[]) {
    report.forEach((file: any) => {
      if (file.errorCount === 0 && file.warningCount === 0) {
        return; // Skip clean files
      }
      
      const relativePath = path.relative(process.cwd(), file.filePath);
      
      // Check if it's a critical file
      const isCritical = this.criticalPaths.some(critical => 
        relativePath.includes(critical)
      );
      
      if (isCritical) {
        this.redFiles.push(relativePath);
        return;
      }
      
      // Check if fixes are mostly console.log removals (safe)
      const messages = file.messages || [];
      const consoleErrors = messages.filter((m: any) => 
        m.ruleId === 'no-console'
      ).length;
      const anyErrors = messages.filter((m: any) => 
        m.ruleId?.includes('no-explicit-any') || 
        m.ruleId?.includes('ban-ts-comment')
      ).length;
      
      // GREEN: Only console errors or simple fixes
      if (consoleErrors > 0 && anyErrors === 0 && file.fixableErrorCount > 0) {
        this.greenFiles.push(relativePath);
      }
      // YELLOW: Mix of issues but fixable
      else if (file.fixableErrorCount > 0 || file.fixableWarningCount > 0) {
        this.yellowFiles.push(relativePath);
      }
      // RED: Complex issues or no auto-fixes
      else {
        this.redFiles.push(relativePath);
      }
    });
  }

  private printAnalysis() {
    console.log('📊 ESLINT ANALYSIS RESULTS');
    console.log('═══════════════════════════════════════════\n');
    
    console.log(`✅ GREEN (Safe to auto-fix): ${this.greenFiles.length} files`);
    if (this.greenFiles.length > 0) {
      console.log('   Safe files (console.log removal only):');
      this.greenFiles.slice(0, 5).forEach(f => console.log(`   - ${f}`));
      if (this.greenFiles.length > 5) {
        console.log(`   ... and ${this.greenFiles.length - 5} more\n`);
      }
    }
    
    console.log(`\n🟡 YELLOW (Auto-fix with review): ${this.yellowFiles.length} files`);
    if (this.yellowFiles.length > 0) {
      console.log('   Files with mixed issues:');
      this.yellowFiles.slice(0, 5).forEach(f => console.log(`   - ${f}`));
      if (this.yellowFiles.length > 5) {
        console.log(`   ... and ${this.yellowFiles.length - 5} more\n`);
      }
    }
    
    console.log(`\n🔴 RED (Manual fix required): ${this.redFiles.length} files`);
    if (this.redFiles.length > 0) {
      console.log('   Critical or complex files:');
      this.redFiles.slice(0, 5).forEach(f => console.log(`   - ${f}`));
      if (this.redFiles.length > 5) {
        console.log(`   ... and ${this.redFiles.length - 5} more\n`);
      }
    }
  }

  async fixGreenFiles() {
    if (this.greenFiles.length === 0) {
      console.log('No safe files to fix automatically.');
      return;
    }
    
    console.log(`\n🚀 Fixing ${this.greenFiles.length} GREEN files automatically...\n`);
    
    // Fix in batches of 10
    const batchSize = 10;
    for (let i = 0; i < this.greenFiles.length; i += batchSize) {
      const batch = this.greenFiles.slice(i, i + batchSize);
      console.log(`Fixing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(this.greenFiles.length/batchSize)}...`);
      
      try {
        // Create a git commit before each batch
        execSync('git add -A && git commit -m "Pre-ESLint fix checkpoint" || true', {
          stdio: 'ignore'
        });
        
        // Fix the batch
        batch.forEach(file => {
          try {
            execSync(`npx eslint ${file} --fix`, { stdio: 'ignore' });
            console.log(`  ✓ Fixed: ${file}`);
          } catch (e) {
            console.log(`  ⚠ Could not fully fix: ${file}`);
          }
        });
        
        // Test that the app still builds
        console.log('  Testing build...');
        execSync('npm run build', { stdio: 'ignore' });
        console.log('  ✓ Build successful\n');
        
      } catch (error) {
        console.error(`  ✗ Build failed after batch! Rolling back...`);
        execSync('git reset --hard HEAD', { stdio: 'inherit' });
        console.log('  Batch rolled back. Manual intervention needed.\n');
        break;
      }
    }
    
    console.log('✅ Green file fixes complete!\n');
  }

  async generateYellowReport() {
    if (this.yellowFiles.length === 0) return;
    
    console.log('\n📝 Generating review report for YELLOW files...\n');
    
    const report: any[] = [];
    
    this.yellowFiles.forEach(file => {
      try {
        const output = execSync(`npx eslint ${file} --format json`, {
          encoding: 'utf-8'
        });
        const fileReport = JSON.parse(output)[0];
        report.push({
          file,
          issues: fileReport.messages.map((m: any) => ({
            line: m.line,
            rule: m.ruleId,
            message: m.message,
            fixable: m.fix !== undefined
          }))
        });
      } catch (e: any) {
        if (e.stdout) {
          const fileReport = JSON.parse(e.stdout)[0];
          report.push({
            file,
            issues: fileReport.messages.map((m: any) => ({
              line: m.line,
              rule: m.ruleId,
              message: m.message,
              fixable: m.fix !== undefined
            }))
          });
        }
      }
    });
    
    fs.writeFileSync('yellow-files-review.json', JSON.stringify(report, null, 2));
    console.log('Review report saved to: yellow-files-review.json\n');
  }

  async run(mode: 'analyze' | 'fix-safe' | 'report-yellow' = 'analyze') {
    await this.analyze();
    
    if (mode === 'fix-safe') {
      await this.fixGreenFiles();
    } else if (mode === 'report-yellow') {
      await this.generateYellowReport();
    }
    
    console.log('\n🎯 RECOMMENDED NEXT STEPS:');
    console.log('1. Run: npm run lint:fix-safe   (fixes GREEN files only)');
    console.log('2. Run: npm run lint:review     (generate YELLOW file report)');
    console.log('3. Manually review and fix RED files');
    console.log('4. Add ESLint to CI/CD to prevent regressions\n');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const mode = args[0] as 'analyze' | 'fix-safe' | 'report-yellow' || 'analyze';

const fixer = new SafeLintFixer();
fixer.run(mode).catch(console.error);