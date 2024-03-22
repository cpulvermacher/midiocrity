import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
    base: './',
    test: {
        environment: 'happy-dom',
    },
    esbuild: {
        pure: mode === 'production' ? ['console.log', 'console.debug'] : [],
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    },
}));
