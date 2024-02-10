import { defineConfig } from 'vitest/config';


export default defineConfig(({ mode }) => ({
    test: {
        environment: 'happy-dom'
    },
    esbuild: {
        // pure: mode === 'production' ? ['console.log'] : [],
        pure: mode === 'production' ? [] : [],
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    }
}));