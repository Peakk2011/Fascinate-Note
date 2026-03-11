// This file is part of Fascinate-Note
// Use for index.html renderer (frontend)

import { Mint } from '@mintkit';
import { Page } from '@renderer/content/page.js';

const rootPath = '#app';

const App = async () => {
    const html = await Page.markups();
    Mint.injectHTML(rootPath, html);

    if (Page.init) {
        try {
            const noteAPI = await Page.init();

            if (noteAPI) {
                window.noteAPI = noteAPI;
            }
        } catch (error) {
            console.error('Failed to initialize Page:', error);
        }
    }
};

App();