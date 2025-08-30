/**
 * Jest Global Setup
 * Run before all tests
 */

module.exports = async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  
  // Mock date for consistent testing
  const mockDate = new Date('2024-01-01T00:00:00.000Z');
  global.__MOCK_DATE__ = mockDate;
  
  // Console.log for test run information
  console.log('🧪 Starting Subscription System Tests');
  console.log('📅 Mock Date:', mockDate.toISOString());
  console.log('🌍 Environment:', process.env.NODE_ENV);
};