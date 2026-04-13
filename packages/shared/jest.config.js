/** @type {import('jest').Config} */
module.exports = {
  displayName: 'shared',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: './tsconfig.json' }],
  },
  testMatch: ['<rootDir>/src/__tests__/**/*.test.ts'],
};
