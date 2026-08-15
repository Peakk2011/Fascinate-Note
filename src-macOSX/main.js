const { app, BrowserWindow, Menu } = require('electron');

app.name = 'Fascinate Notes';

const path = require('path');
const { getWindowOptions, getTargetUrl } = require('./comp/wConfig.js');

const setupMenu = () => {
    if (process.platform === 'darwin') {
        const template = [
            {
                label: app.name,
                submenu: [
                    { role: 'about' },
                    { type: 'separator' },
                    { role: 'services' },
                    { type: 'separator' },
                    { role: 'hide' },
                    { role: 'hideOthers' },
                    { role: 'unhide' },
                    { type: 'separator' },
                    { role: 'quit' }
                ]
            }
        ];
        Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    } else {
        Menu.setApplicationMenu(null);
    }
};

const createWindow = () => {
    const win = new BrowserWindow(getWindowOptions());
    win.loadURL(getTargetUrl());
};

app.whenReady().then(() => {
    setupMenu();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});