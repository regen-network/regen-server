const commonConfig = require('../common.jest.config'); // eslint-disable-line
module.exports = {
  ...commonConfig,
  setupFiles: ['./jestSetupFile.ts'],
};
