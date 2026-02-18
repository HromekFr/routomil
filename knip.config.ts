import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: [
    // Test infrastructure
    'tests/**/*.{js,ts}',
    'scripts/**/*.js',
  ],
  project: ['src/**/*.ts', 'tests/**/*.{js,ts}', 'scripts/**/*.js'],
  ignoreDependencies: [
    // Ambient type packages used by TypeScript compiler (no explicit imports)
    '@types/chrome',
    '@types/jsdom',
    // Used as string value testEnvironment: 'jsdom' in jest.config.js (not an import)
    'jsdom',
  ],
};

export default config;
