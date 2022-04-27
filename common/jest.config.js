const commonConfig = require("../common.jest.config")
module.exports = {
  ...commonConfig,
  setupFiles: ['./jestSetupFile.ts'],
};
