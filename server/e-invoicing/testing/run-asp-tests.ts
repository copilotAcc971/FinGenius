#!/usr/bin/env tsx
/**
 * Run ASP E2E Tests Only
 * 
 * Usage: npx tsx server/e-invoicing/testing/run-asp-tests.ts
 */

import { ASPTestSuite } from './asp-e2e.test';

async function runASPTests() {
  console.log('\n');
  const suite = new ASPTestSuite({ simulateDelay: false });
  await suite.runAll();
}

runASPTests().catch(console.error);
