import { defineConfig } from 'vitest/config';


export default defineConfig(({ mode }) => ({
    test: {
        environment: 'happy-dom'
    },
    esbuild: {
        pure: mode === 'production' ? ['console.log', 'console.debug'] : [],
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    }
}));