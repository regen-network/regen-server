module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/**/__tests__/*.test.[jt]s'],
  setupFiles: ['./jestSetupFile.ts'],
};
