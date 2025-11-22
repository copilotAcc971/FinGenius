#!/usr/bin/env tsx
/**
 * Run FATOORAH E2E Tests Only
 * 
 * Usage: npx tsx server/e-invoicing/testing/run-fatoorah-tests.ts
 */

import { FATOORAHTestSuite } from './fatoorah-e2e.test';

async function runFATOORAHTests() {
  console.log('\n');
  const suite = new FATOORAHTestSuite({ simulateDelay: false });
  await suite.runAll();
}

runFATOORAHTests().catch(console.error);
