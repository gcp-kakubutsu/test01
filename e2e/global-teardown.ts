/**
 * Playwright Global Teardown
 */

async function globalTeardown() {
  console.log('🧹 Cleaning up E2E test environment');
  
  // Clean up test data, close connections, etc.
  // This runs after all tests are complete
}

export default globalTeardown;