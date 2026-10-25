// Acceptance tests for the V2 user stories (plans/v2-feedback-response.md, section 4).
// Kept apart from the normal suite so `npm test` stays green while the features are being built.
// Run with: npm run test:v2
const main = require('./jest.config.cjs');
const client = main.projects.find((p) => p.displayName === 'client');

module.exports = {
  maxWorkers: 1,
  testTimeout: 10000,
  projects: [
    {
      ...client,
      displayName: 'v2-acceptance',
      testMatch: ['<rootDir>/client/src/__acceptance__/v2/**/*.test.tsx'],
    },
  ],
};
