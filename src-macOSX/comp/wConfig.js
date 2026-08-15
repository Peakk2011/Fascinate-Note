const getWindowOptions = () => ({
    width: 360,
    height: 600,
    minWidth: 320,
    minHeight: 400,
    webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
    },
});

const getTargetUrl = () => 'https://mint-teams.web.app/notes/src/';

module.exports = {
    getWindowOptions,
    getTargetUrl
};