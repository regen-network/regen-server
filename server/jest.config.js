const commonConfig = require('../common.jest.config'); // eslint-disable-line
const testPathIgnorePatterns = [];
if (process.env.SKIP_AWS_TESTS === '1') {
  testPathIgnorePatterns.push('./__tests__/e2e/files.*.test.ts');
}
module.exports = {
  ...commonConfig,
  testPathIgnorePatterns,
  setupFiles: ['./jestSetupFile.ts'],
};
