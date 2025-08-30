/**
 * Playwright Global Setup
 */

import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Setup test data or authenticate if needed
  console.log('🚀 Setting up E2E test environment');
  
  // You could create test users, clear databases, etc. here
  // For now, we'll just ensure the app is accessible
  try {
    await page.goto(config.use?.baseURL || 'http://localhost:9002');
    console.log('✅ App is accessible');
  } catch (error) {
    console.error('❌ Failed to access app:', error);
  }
  
  await browser.close();
}

export default globalSetup;