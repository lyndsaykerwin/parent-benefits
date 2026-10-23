module.exports = {
  preset: 'ts-jest',
  maxWorkers: 1,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/server/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/shared/$1'
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }]
  },
  testTimeout: 10000,
  clearMocks: true,
  restoreMocks: true
};
