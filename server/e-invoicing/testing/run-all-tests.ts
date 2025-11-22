#!/usr/bin/env tsx
/**
 * Run All E2E Tests for ASP and FATOORAH
 * 
 * Usage: npx tsx server/e-invoicing/testing/run-all-tests.ts
 */

import { ASPTestSuite } from './asp-e2e.test';
import { FATOORAHTestSuite } from './fatoorah-e2e.test';

async function runAllTests() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║        E2E Testing Suite: ASP & FATOORAH (Phase 7)           ║');
  console.log('║                                                                ║');
  console.log('║  Official References:                                         ║');
  console.log('║  - UAE Peppol: https://docs.peppol.eu/poac/ae/2025-Q2/pint-ae/ ║');
  console.log('║  - KSA ZATCA: https://zatca.gov.sa/en/E-Invoicing/           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  try {
    // Run ASP Tests
    console.log('Step 1/2: Running ASP E2E Tests...\n');
    const aspSuite = new ASPTestSuite({ simulateDelay: false });
    await aspSuite.runAll();

    // Run FATOORAH Tests
    console.log('\n\nStep 2/2: Running FATOORAH E2E Tests...\n');
    const fatoorahSuite = new FATOORAHTestSuite({ simulateDelay: false });
    await fatoorahSuite.runAll();

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                                                                ║');
    console.log('║             ✅ All E2E Tests Completed Successfully           ║');
    console.log('║                                                                ║');
    console.log('║  Next Steps:                                                  ║');
    console.log('║  1. Configure real ASP credentials for UAE Peppol            ║');
    console.log('║  2. Register with ZATCA FATOORAH for real API credentials    ║');
    console.log('║  3. Move from sandbox to production mode                     ║');
    console.log('║                                                                ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
  } catch (error) {
    console.error('\n❌ Test suite error:', error);
    process.exit(1);
  }
}

runAllTests();
