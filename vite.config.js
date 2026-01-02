import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
    root: resolve(__dirname, 'src/'),

    optimizeDeps: {
        include: ['dom-to-image']
    },

    build: {
        outDir: resolve(__dirname, 'dist/renderer'),
        emptyOutDir: true
    }
})