import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/src/**/*.test.ts', 'apps/**/src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'packages/**/src/**/*.ts',
        'apps/shell/src/{workspace,chat,navigation}.ts',
        'apps/server/src/{codes,routes,requests,games}.ts',
      ],
      exclude: [
        'packages/**/src/**/*.test.ts',
        'packages/**/src/**/index.ts',
        // Declarations only — no runtime code to cover.
        'packages/game-kit/src/ui.ts',
      ],
      reporter: ['text', 'html', 'lcov'],
      // Branch coverage is the gate, per CLAUDE.md. Raising these is welcome;
      // lowering one needs a decision entry saying why.
      thresholds: {
        branches: 85,
        functions: 85,
        lines: 85,
        statements: 85,
      },
    },
  },
});
