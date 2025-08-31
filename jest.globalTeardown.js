/**
 * Jest Global Teardown
 * Run after all tests
 */

module.exports = async () => {
  console.log('✅ Subscription System Tests Complete');
  
  // Cleanup any global resources if needed
  delete global.__MOCK_DATE__;
};