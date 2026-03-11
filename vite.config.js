import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// Copy folder
const copyFolder = (source, target) => {
    if (!existsSync(target)) {
        mkdirSync(target, { recursive: true });
    }

    if (existsSync(source) && statSync(source).isDirectory()) {
        const files = readdirSync(source);

        files.forEach(file => {
            const sourcePath = join(source, file);
            const targetPath = join(target, file);

            if (statSync(sourcePath).isDirectory()) {
                copyFolder(sourcePath, targetPath);
            } else {
                copyFileSync(sourcePath, targetPath);
            }
        });
    }
}

export default defineConfig({
    root: resolve(__dirname, 'src'),
    publicDir: resolve(__dirname, 'assets'),
    base: './',

    optimizeDeps: {
        include: ['dom-to-image', 'yjs', 'y-websocket']
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
            '@renderer': resolve(__dirname, 'src/renderer'),
            '@scripts': resolve(__dirname, 'src/renderer/scripts'),
            '@components': resolve(__dirname, 'src/renderer/content/contentComponents'),
            '@page-components': resolve(__dirname, './src/renderer/content/pageComponents'),
            '@pages': resolve(__dirname, 'src/renderer/content/pages'),
            '@services': resolve(__dirname, 'src/renderer/content/pageServices'),
            '@api': resolve(__dirname, 'src/api'),

            '@framework': resolve(__dirname, 'src/framework'),
            '@content': resolve(__dirname, 'src/renderer/content'),

            '@model': resolve(
                __dirname,
                './src/renderer/content/contentComponents/model'
            ),

            '@contextmenu': resolve(
                __dirname,
                './src/renderer/content/contentComponents/contextmenu'
            ),

            '@command': resolve(
                __dirname,
                './src/renderer/content/contentComponents/commandPalette'
            ),

            '@cursor': resolve(
                'src/api/cursor-behavior.js'
            ),

            '@editor': resolve(
                __dirname,
                './src/renderer/scripts/editor'
            ),

            '@collab': resolve(
                __dirname,
                './src/renderer/scripts/collab'
            ),

            '@collab-impl': resolve(
                __dirname,
                './src/renderer/scripts/collab/impl'
            ),

            '@rich': resolve(
                __dirname,
                './src/renderer/content/rich.js'
            ),

            // Mintkit
            '@mintkit': resolve(
                __dirname,
                './src/framework/mint.js'
            ),

            // Fetch JSON
            '@fJson': resolve(
                __dirname,
                './src/utils/fetch.js'
            )
        },
        dedupe: ['yjs', 'y-protocols', 'lib0']
    },

    build: {
        outDir: resolve(__dirname, 'dist/renderer'),
        emptyOutDir: true,
        rollupOptions: {
            input: resolve(__dirname, 'src/index.html'),
        }
    },

    plugins: [
        {
            name: 'copy-renderer-structure',
            closeBundle() {
                // Copy renderer folder
                const srcRenderer = resolve(__dirname, 'src/renderer');
                const distRenderer = resolve(__dirname, 'dist/renderer/renderer');

                if (existsSync(srcRenderer)) {
                    copyFolder(srcRenderer, distRenderer);
                }

                // Copy stylesheet folder
                const srcStylesheet = resolve(__dirname, 'src/stylesheet');
                const distStylesheet = resolve(__dirname, 'dist/renderer/stylesheet');

                if (existsSync(srcStylesheet)) {
                    copyFolder(srcStylesheet, distStylesheet);
                }

                // Copy api folder
                const srcApi = resolve(__dirname, 'src/api');
                const distApi = resolve(__dirname, 'dist/renderer/api');
                if (existsSync(srcApi)) {
                    copyFolder(srcApi, distApi);
                }

            }
        }
    ]
});
