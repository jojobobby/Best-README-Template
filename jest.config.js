/** @type {import('jest').Config} */
module.exports = {
  projects: [
    '<rootDir>/apps/api',
    '<rootDir>/apps/scraper',
    '<rootDir>/apps/worker',
    '<rootDir>/packages/shared',
  ],
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70,
    },
  },
};
