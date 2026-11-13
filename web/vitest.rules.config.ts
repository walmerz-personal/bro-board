import { defineConfig } from 'vitest/config';

// The security rules tests. They need the Firebase emulator, so they run with
// `npm run test:rules` rather than `npm test`.
export default defineConfig({
  test: { include: ['rules-tests/**/*.test.ts'], testTimeout: 20000, fileParallelism: false },
});
