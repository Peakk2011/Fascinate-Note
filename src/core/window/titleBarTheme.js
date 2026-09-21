import { nativeTheme } from 'electron';

export const getTitleBarOverlay = () => ({
    color: '#00000000',
    symbolColor: nativeTheme.shouldUseDarkColors ? '#ffffff' : '#000000',
    height: 38
});

export const bindTitleBarTheme = (window) => {
    if (process.platform !== 'win32' && process.platform !== 'linux') return;

    const update = () => {
        if (!window.isDestroyed()) {
            window.setTitleBarOverlay(getTitleBarOverlay());
        }
    };

    update();
    nativeTheme.on('updated', update);
    window.once('closed', () => nativeTheme.removeListener('updated', update));
};
