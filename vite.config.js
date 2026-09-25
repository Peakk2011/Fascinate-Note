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

    server: {
        open: false,
        port: Number(process.env.VITE_PORT || 5173),
        strictPort: true
    },

    optimizeDeps: {
        include: ['dom-to-image', 'yjs', 'y-partyserver/provider']
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
            ),

            // Mucous
            '@mucous': resolve(
                __dirname,
                './src/api/mucous.js'
            ),

            // Wait
            '@wait': resolve(
                __dirname,
                './src/api/wait.js'
            )
        },
        dedupe: ['yjs', 'y-protocols', 'lib0']
    },

    build: {
        outDir: resolve(__dirname, process.env.VITE_WEB_BUILD === 'true' ? 'dist/web' : 'dist/renderer'),
        emptyOutDir: true,
        rollupOptions: {
            input: resolve(__dirname, 'src/index.html'),
        }
    },

    plugins: [
        {
            name: 'copy-renderer-structure',
            closeBundle() {
                const outputDir = resolve(
                    __dirname,
                    process.env.VITE_WEB_BUILD === 'true' ? 'dist/web' : 'dist/renderer'
                );

                // Copy renderer folder
                const srcRenderer = resolve(__dirname, 'src/renderer');
                const distRenderer = resolve(outputDir, 'renderer');

                if (existsSync(srcRenderer)) {
                    copyFolder(srcRenderer, distRenderer);
                }

                // Copy stylesheet folder
                const srcStylesheet = resolve(__dirname, 'src/stylesheet');
                const distStylesheet = resolve(outputDir, 'stylesheet');

                if (existsSync(srcStylesheet)) {
                    copyFolder(srcStylesheet, distStylesheet);
                }

                // Copy api folder
                const srcApi = resolve(__dirname, 'src/api');
                const distApi = resolve(outputDir, 'api');
                if (existsSync(srcApi)) {
                    copyFolder(srcApi, distApi);
                }

                // Copy entire assets folder
                const srcAssets = resolve(__dirname, 'assets');
                const distAssets = resolve(outputDir, 'assets');
                if (existsSync(srcAssets)) {
                    copyFolder(srcAssets, distAssets);
                }
            }
        }
    ]
});
