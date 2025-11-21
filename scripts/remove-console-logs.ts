#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

class ConsoleLogRemover {
  private safeFiles: string[] = [];
  private criticalFiles: string[] = [];
  private modifiedCount = 0;
  
  // Files where console.error/warn might be needed
  private criticalPaths = [
    'server/middleware/',
    'server/audit/',
    'server/rbac/',
    'server/accounting/',
    'server/open-banking/encryption',
    'server/e-invoicing/'
  ];

  async findAndCategorize() {
    console.log('🔍 Finding all console.log statements...\n');
    
    const result = execSync(
      `grep -r "console\\." --include="*.ts" --include="*.tsx" -l server client 2>/dev/null || true`,
      { encoding: 'utf-8' }
    );
    
    const files = result.split('\n').filter(f => f.length > 0);
    
    files.forEach(file => {
      const isCritical = this.criticalPaths.some(p => file.includes(p));
      if (isCritical) {
        this.criticalFiles.push(file);
      } else {
        this.safeFiles.push(file);
      }
    });
    
    console.log(`Found ${files.length} files with console statements:`);
    console.log(`  ✅ ${this.safeFiles.length} safe files (will remove all console.*)`);
    console.log(`  🔴 ${this.criticalFiles.length} critical files (keeping error/warn)\n`);
  }

  removeFromFile(filePath: string, keepErrorWarn: boolean = false) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    let modified = false;
    
    const newLines = lines.map(line => {
      // Skip if it's a comment
      if (line.trim().startsWith('//')) return line;
      
      // Check if line contains console statement
      if (line.includes('console.')) {
        // If keeping error/warn and this is one of them, keep it
        if (keepErrorWarn && (line.includes('console.error') || line.includes('console.warn'))) {
          return line;
        }
        
        // Check if it's a multi-line console.log
        const indent = line.match(/^(\s*)/)?.[1] || '';
        if (line.includes('console.log(') || 
            line.includes('console.info(') || 
            line.includes('console.debug(') ||
            (!keepErrorWarn && (line.includes('console.error(') || line.includes('console.warn(')))) {
          
          modified = true;
          
          // Count open/close parens to handle multi-line
          let openParens = (line.match(/\(/g) || []).length;
          let closeParens = (line.match(/\)/g) || []).length;
          
          if (openParens === closeParens) {
            // Single line console.log - comment it out
            return `${indent}// Removed: ${line.trim()}`;
          } else {
            // Multi-line - just comment the first line for now
            return `${indent}// Removed: ${line.trim()}`;
          }
        }
      }
      
      return line;
    });
    
    if (modified) {
      fs.writeFileSync(filePath, newLines.join('\n'));
      this.modifiedCount++;
      return true;
    }
    
    return false;
  }

  async removeSafely() {
    await this.findAndCategorize();
    
    // Create a backup commit
    console.log('📸 Creating backup commit...');
    execSync('git add -A && git commit -m "Backup before console.log removal" || true', {
      stdio: 'ignore'
    });
    
    console.log('\n🧹 Removing console statements from safe files...\n');
    
    // Process safe files (remove all console.*)
    let processedCount = 0;
    this.safeFiles.forEach(file => {
      if (this.removeFromFile(file, false)) {
        processedCount++;
        if (processedCount % 10 === 0) {
          console.log(`  Processed ${processedCount} files...`);
        }
      }
    });
    
    console.log(`\n🔴 Processing critical files (keeping error/warn)...\n`);
    
    // Process critical files (keep error/warn)
    this.criticalFiles.forEach(file => {
      if (this.removeFromFile(file, true)) {
        console.log(`  Modified: ${file}`);
      }
    });
    
    console.log(`\n✅ Complete! Modified ${this.modifiedCount} files`);
    
    // Test that it still builds
    console.log('\n🧪 Testing build...');
    try {
      execSync('npm run check', { stdio: 'inherit' });
      console.log('✅ Build successful!\n');
      
      // Commit the changes
      execSync('git add -A && git commit -m "Remove console.log statements from non-critical files" || true', {
        stdio: 'ignore'
      });
      console.log('💾 Changes committed\n');
    } catch (e) {
      console.error('❌ Build failed! Rolling back...');
      execSync('git reset --hard HEAD', { stdio: 'inherit' });
      console.log('Rolled back to previous commit\n');
    }
  }
}

const remover = new ConsoleLogRemover();
remover.removeSafely().catch(console.error);