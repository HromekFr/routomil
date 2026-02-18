import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: [
    // Webpack entry points (from webpack.config.js)
    'src/background/service-worker.ts',
    'src/content/mapy-content.ts',
    'src/content/fetch-interceptor.ts',
    'src/content/bikerouter-interceptor.ts',
    'src/content/bikerouter-content.ts',
    'src/popup/popup.ts',
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
