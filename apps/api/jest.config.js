/** @type {import('jest').Config} */
module.exports = {
  displayName: 'api',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: './tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@applybot/shared$': '<rootDir>/../../packages/shared/src',
    '^@applybot/db$': '<rootDir>/../../packages/db/src',
  },
  testMatch: ['<rootDir>/src/__tests__/**/*.test.ts'],
};
