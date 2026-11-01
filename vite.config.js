import { cp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const staticDirectories = ['assets', 'content'];

export default defineConfig({
    publicDir: false,
    server: {
        proxy: {
            '/api/image': {
                target: 'http://localhost:3000',
                changeOrigin: true
            }
        }
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        minify: true
    },
    plugins: [{
        name: 'copy-runtime-content',
        apply: 'build',
        async closeBundle() {
            await Promise.all(staticDirectories.map(directory =>
                cp(resolve(directory), resolve('dist', directory), { recursive: true })
            ));
        }
    }]
});
