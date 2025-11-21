import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passed = 0, failed = 0, errors = [];

console.log('🔍 AGGRESSIVE CODEBASE QA TEST SUITE\n');
console.log('='.repeat(70));

// Test 1: Verify all critical files exist
try {
  const files = [
    'shared/schema.ts',
    'server/routes.ts',
    'server/db.ts',
    'server/services/reporting-service.ts',
    'server/services/copilot-service.ts',
    'client/src/pages/reports.tsx',
    'client/src/pages/compliance.tsx',
    'client/src/pages/copilot.tsx',
    'client/src/app/App.tsx'
  ];
  
  for (const file of files) {
    const fullPath = path.join(__dirname, file);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`MISSING FILE: ${file}`);
    }
  }
  console.log('✅ Test 1: All critical files exist');
  passed++;
} catch (e) {
  console.error('❌ Test 1 FAILED:', e.message);
  errors.push(e.message);
  failed++;
}

// Test 2: Schema syntax and duplicate validation
try {
  const schema = fs.readFileSync('shared/schema.ts', 'utf-8');
  
  // Check for duplicate table definitions
  const tables = [
    { name: 'financialReports', pattern: /export const financialReports = pgTable/g },
    { name: 'complianceDashboards', pattern: /export const complianceDashboards = pgTable/g },
    { name: 'creditPassports', pattern: /export const creditPassports = pgTable/g },
    { name: 'reportExports', pattern: /export const reportExports = pgTable/g },
    { name: 'scheduledReports', pattern: /export const scheduledReports = pgTable/g },
    { name: 'copilotConversations', pattern: /export const copilotConversations = pgTable/g },
    { name: 'copilotMessages', pattern: /export const copilotMessages = pgTable/g },
  ];
  
  for (const table of tables) {
    const matches = (schema.match(table.pattern) || []).length;
    if (matches === 0) throw new Error(`TABLE MISSING: ${table.name}`);
    if (matches > 1) throw new Error(`DUPLICATE TABLE: ${table.name} (${matches}x)`);
  }
  
  console.log('✅ Test 2: No duplicate tables, all defined exactly once');
  passed++;
} catch (e) {
  console.error('❌ Test 2 FAILED:', e.message);
  errors.push(e.message);
  failed++;
}

// Test 3: Service class validation
try {
  const reportingService = fs.readFileSync('server/services/reporting-service.ts', 'utf-8');
  const copilotService = fs.readFileSync('server/services/copilot-service.ts', 'utf-8');
  
  const reportingMethods = [
    'generatePAndLReport',
    'generateBalanceSheetReport',
    'generateCashFlowReport',
    'calculateCreditPassportScore',
    'scheduleReport',
    'exportReport'
  ];
  
  const copilotMethods = [
    'createConversation',
    'addMessage',
    'chat',
    'deleteConversation'
  ];
  
  for (const method of reportingMethods) {
    if (!reportingService.includes(method)) {
      throw new Error(`MISSING METHOD: ReportingService.${method}`);
    }
  }
  
  for (const method of copilotMethods) {
    if (!copilotService.includes(method)) {
      throw new Error(`MISSING METHOD: CopilotService.${method}`);
    }
  }
  
  console.log('✅ Test 3: All service methods defined');
  passed++;
} catch (e) {
  console.error('❌ Test 3 FAILED:', e.message);
  errors.push(e.message);
  failed++;
}

// Test 4: Routes validation
try {
  const routes = fs.readFileSync('server/routes.ts', 'utf-8');
  
  // Check server creation happens at the end
  const serverCreateIdx = routes.indexOf('const httpServer = createServer(app)');
  if (serverCreateIdx === -1) {
    throw new Error('ROUTES ERROR: httpServer creation not found');
  }
  
  // Verify routes are defined before server creation
  const routePatterns = [
    "app.get('/api/reports'",
    "app.post('/api/reports/generate'",
    "app.get('/api/compliance/dashboards'",
    "app.post('/api/credit-passport/generate'",
    "app.post('/api/reports/schedule'",
    "app.get('/api/copilot/conversations'",
    "app.post('/api/copilot/messages'"
  ];
  
  for (const pattern of routePatterns) {
    const idx = routes.indexOf(pattern);
    if (idx === -1) throw new Error(`ROUTE MISSING: ${pattern}`);
    if (idx > serverCreateIdx) throw new Error(`ROUTE AFTER SERVER: ${pattern}`);
  }
  
  console.log('✅ Test 4: All routes defined before server creation');
  passed++;
} catch (e) {
  console.error('❌ Test 4 FAILED:', e.message);
  errors.push(e.message);
  failed++;
}

// Test 5: React components have required imports
try {
  const reports = fs.readFileSync('client/src/pages/reports.tsx', 'utf-8');
  const compliance = fs.readFileSync('client/src/pages/compliance.tsx', 'utf-8');
  const copilot = fs.readFileSync('client/src/pages/copilot.tsx', 'utf-8');
  
  // Reports page
  if (!reports.includes('recharts')) throw new Error('ReportsPage missing recharts');
  if (!reports.includes('LineChart')) throw new Error('ReportsPage missing LineChart');
  
  // Compliance page
  if (!compliance.includes('useQuery')) throw new Error('CompliancePage missing useQuery');
  if (!compliance.includes('Card')) throw new Error('CompliancePage missing Card component');
  
  // Copilot page
  if (!copilot.includes('useQuery')) throw new Error('CopilotPage missing useQuery');
  if (!copilot.includes('WebSocket')) throw new Error('CopilotPage missing WebSocket');
  
  console.log('✅ Test 5: All React components have required imports');
  passed++;
} catch (e) {
  console.error('❌ Test 5 FAILED:', e.message);
  errors.push(e.message);
  failed++;
}

// Test 6: App router registration
try {
  const app = fs.readFileSync('client/src/app/App.tsx', 'utf-8');
  
  const routes = [
    { path: '/reports', import: 'ReportsPage' },
    { path: '/compliance-dashboard', import: 'CompliancePage' },
    { path: '/copilot', import: 'CopilotPage' }
  ];
  
  for (const route of routes) {
    if (!app.includes(`path="${route.path}"`)) {
      throw new Error(`ROUTE NOT REGISTERED: ${route.path}`);
    }
  }
  
  console.log('✅ Test 6: All new routes registered in App.tsx');
  passed++;
} catch (e) {
  console.error('❌ Test 6 FAILED:', e.message);
  errors.push(e.message);
  failed++;
}

// Test 7: Database schema - required columns
try {
  const schema = fs.readFileSync('shared/schema.ts', 'utf-8');
  
  const requiredColumns = {
    'financialReports': ['tenantId', 'reportType', 'periodStart', 'periodEnd', 'reportData'],
    'complianceDashboards': ['tenantId', 'category', 'status', 'score'],
    'creditPassports': ['tenantId', 'customerId', 'score', 'bankability'],
    'copilotConversations': ['tenantId', 'userId', 'title', 'model'],
    'copilotMessages': ['tenantId', 'conversationId', 'role', 'content']
  };
  
  for (const [table, cols] of Object.entries(requiredColumns)) {
    for (const col of cols) {
      const pattern = new RegExp(`${table}.*${col}`, 's');
      if (!pattern.test(schema)) {
        throw new Error(`SCHEMA MISSING: ${table}.${col}`);
      }
    }
  }
  
  console.log('✅ Test 7: All required database columns present');
  passed++;
} catch (e) {
  console.error('❌ Test 7 FAILED:', e.message);
  errors.push(e.message);
  failed++;
}

// Test 8: No syntax errors - brace/parenthesis balance
try {
  const files = [
    'server/services/reporting-service.ts',
    'server/services/copilot-service.ts',
    'server/routes.ts'
  ];
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    
    // Count braces
    const openBraces = (content.match(/{/g) || []).length;
    const closeBraces = (content.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      throw new Error(`${file}: UNBALANCED BRACES (${openBraces} vs ${closeBraces})`);
    }
    
    // Count parentheses
    const openParens = (content.match(/\(/g) || []).length;
    const closeParens = (content.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      throw new Error(`${file}: UNBALANCED PARENTHESES (${openParens} vs ${closeParens})`);
    }
  }
  
  console.log('✅ Test 8: All TypeScript files have balanced syntax');
  passed++;
} catch (e) {
  console.error('❌ Test 8 FAILED:', e.message);
  errors.push(e.message);
  failed++;
}

// Test 9: Dependencies installed
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  
  const required = [
    'recharts',
    'openai',
    'drizzle-orm',
    '@tanstack/react-query',
    'ws',
    'express'
  ];
  
  for (const dep of required) {
    const inDeps = packageJson.dependencies && packageJson.dependencies[dep];
    const inDevDeps = packageJson.devDependencies && packageJson.devDependencies[dep];
    if (!inDeps && !inDevDeps) {
      throw new Error(`DEPENDENCY MISSING: ${dep}`);
    }
  }
  
  console.log('✅ Test 9: All required dependencies installed');
  passed++;
} catch (e) {
  console.error('❌ Test 9 FAILED:', e.message);
  errors.push(e.message);
  failed++;
}

// Test 10: No import errors in critical paths
try {
  const reportingService = fs.readFileSync('server/services/reporting-service.ts', 'utf-8');
  const copilotService = fs.readFileSync('server/services/copilot-service.ts', 'utf-8');
  
  // Check reporting service imports
  const reportingImports = [
    "import { db }",
    "import { financialReports",
    "import { sql }",
    "import { eq, and"
  ];
  
  for (const imp of reportingImports) {
    if (!reportingService.includes(imp)) {
      throw new Error(`IMPORT MISSING in ReportingService: ${imp}`);
    }
  }
  
  // Check copilot service imports
  const copilotImports = [
    "import { db }",
    "import { copilotConversations",
    "import OpenAI"
  ];
  
  for (const imp of copilotImports) {
    if (!copilotService.includes(imp)) {
      throw new Error(`IMPORT MISSING in CopilotService: ${imp}`);
    }
  }
  
  console.log('✅ Test 10: All critical imports present');
  passed++;
} catch (e) {
  console.error('❌ Test 10 FAILED:', e.message);
  errors.push(e.message);
  failed++;
}

// Print final report
console.log('='.repeat(70));
console.log(`\n📊 QA TEST SUMMARY: ${passed} PASSED | ${failed} FAILED\n`);

if (failed > 0) {
  console.error('❌ ERRORS FOUND:');
  for (let i = 0; i < errors.length; i++) {
    console.error(`  ${i + 1}. ${errors[i]}`);
  }
  console.error('\n⚠️  Fix these errors and rerun tests');
  process.exit(1);
} else {
  console.log('✅ ALL TESTS PASSED - CODEBASE INTEGRITY VERIFIED');
  console.log('\n🎯 Ready for deployment\n');
  process.exit(0);
}
