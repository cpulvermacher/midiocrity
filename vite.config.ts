import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
    base: './',
    test: {
        environment: 'happy-dom',
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        chunkSizeWarningLimit: 600,
        rolldownOptions: {
            output: {
                minify: {
                    compress: {
                        treeshake: {
                            manualPureFunctions:
                                mode === 'production'
                                    ? ['console.log', 'console.debug']
                                    : [],
                        },
                    },
                },
            },
        },
    },
}));
