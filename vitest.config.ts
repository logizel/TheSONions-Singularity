import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['lib/**/*.test.ts', 'theme/**/*.test.ts'],
    environment: 'node',
  },
});
