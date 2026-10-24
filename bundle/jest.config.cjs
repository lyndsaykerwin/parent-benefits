const shared = {
  clearMocks: true,
  restoreMocks: true,
  testTimeout: 10000,
};

module.exports = {
  maxWorkers: 1,
  testTimeout: 10000,
  projects: [
    {
      ...shared,
      displayName: 'server',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/server/__tests__/**/*.test.ts'],
      moduleNameMapper: {
        '^@shared/(.*)$': '<rootDir>/shared/$1'
      },
      transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }]
      },
    },
    {
      ...shared,
      displayName: 'client',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/client/src/**/__tests__/**/*.test.tsx'],
      moduleNameMapper: {
        '^@shared/(.*)$': '<rootDir>/shared/$1',
        '^@/(.*)$': '<rootDir>/client/src/$1'
      },
      // wouter (the router) ships only ES modules, so it is transformed too.
      transformIgnorePatterns: ['/node_modules/(?!(wouter|regexparam|mitt)/)'],
      transform: {
        '^.+\\.[jt]sx?$': ['ts-jest', { tsconfig: { allowJs: true, jsx: 'react-jsx', esModuleInterop: true, module: 'commonjs', target: 'ES2022', strict: true, skipLibCheck: true, isolatedModules: true } }]
      },
    },
  ],
};
