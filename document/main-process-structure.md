# Main Process Structure

## 1) File Scope

```text
src/
|-- main.js
|-- initFascinateNotes.js
|-- preload.js
|-- core/
|   |-- createWindow.js
|   |-- devtools.js
|   |-- ipcManager.js
|   |-- preloadAssets.js
|   `-- window/
|       |-- initializer.js
|       |-- interfaceLoader.js
|       `-- lifeCycle.js
|-- config/
|   |-- osConfig.js
|   `-- windowConfig.js
`-- utils/
    |-- paths.js
    |-- safeLogger.js
    `-- userAgent.js
```

## 2) Runtime Flow Tree

```text
src/main.js
`-- initFascinateNotes()

src/initFascinateNotes.js
|-- configurePlatformSettings()
|   `-- disable GPU features on Intel macOS
|-- handleSquirrelEvents()
|   `-- app.quit() on Windows squirrel args
|-- registerEventHandlers()
|   |-- app.on('activate') -> createWindow() when no window
|   `-- app.on('window-all-closed') -> app.quit() except darwin
`-- initFascinateNotes()
    |-- configurePlatformSettings()
    |-- handleSquirrelEvents()
    |-- app.whenReady()
    |-- preloadAssets()
    |-- createWindow()
    `-- registerEventHandlers()

src/core/createWindow.js
`-- createWindow()
    |-- initializeWindow()
    |   |-- getWindowConfig()
    |   |-- new BrowserWindow(options)
    |   |-- setMenu(null)
    |   `-- OpenDevTools(mainWindow)
    |-- initializeCoreManagers(mainWindow)
    |   `-- new IpcManager().init()
    |-- loadInterface(mainWindow)
    |   |-- dev: loadURL('http://localhost:5173') with retry
    |   `-- prod: loadFile('dist/renderer/index.html')
    `-- setupCleanup(mainWindow, ipcManager)
        `-- ipcManager.cleanup() on window closed

src/core/ipcManager.js
`-- IpcManager
    |-- init() -> setupOSHandler()
    |-- setupOSHandler() -> ipcMain.handle('get-os', ...)
    |-- registerHandler(channel, handler)
    `-- cleanup()
        |-- remove ipcMain listeners
        `-- remove 'get-os' handler

src/preload.js
`-- contextBridge.exposeInMainWorld('electronAPI', ...)
    |-- getOS() -> ipcRenderer.invoke('get-os')
    `-- closeApp() -> ipcRenderer.send('close-app')
```

## 3) Config + Utility Dependencies

```text
src/config/osConfig.js
|-- OS = process.platform
`-- osConfig
    |-- win32: icon(.ico), setup(win.setMenuBarVisibility(false))
    |-- darwin: icon(.icns), setup(win.setVibrancy('sidebar'))
    `-- linux: icon(.png), setup(no-op)

src/config/windowConfig.js
`-- getWindowConfig()
    |-- base size/min size
    |-- platform overrides (darwin/win32)
    `-- webPreferences
        |-- preload: resolvePath('../preload.js')
        |-- contextIsolation: true
        `-- nodeIntegration: false

src/core/preloadAssets.js
|-- preloadAssets() -> read src/index.html and cache encoded html
|-- getCachedEncodedHTML()
|-- getCachedTabbarPath()
`-- clearCache()

src/utils/paths.js
|-- __filename
|-- __dirname
`-- resolvePath(...segments)

src/utils/safeLogger.js
|-- safeLog()
|-- safeError()
`-- safeWarn()

src/utils/userAgent.js
|-- createUserAgent(win, appName, appVersion)
`-- userAgent alias
```

## 4) Types Structure

```text
src/preload.js
`-- typedef ElectronAPI
    |-- getOS: () => Promise<string>
    `-- closeApp: () => void

src/config/osConfig.js
`-- typedef PlatformConfig
    |-- name: string
    |-- icon: string
    `-- setup: (BrowserWindow) => void

src/config/windowConfig.js
`-- getWindowConfig(): BrowserWindowConstructorOptions

src/core/devtools.js
|-- typedef DevToolsOptions
|   |-- enabled?: boolean
|   `-- mode?: 'undocked' | 'right' | 'bottom' | 'detach'
`-- class OpenDevTools

src/core/ipcManager.js
`-- class IpcManager

src/core/createWindow.js
`-- createWindow(): Promise<{ mainWindow: BrowserWindow, ipcManager: IpcManager }>

src/core/window/initializer.js
`-- initializeCoreManagers(): { ipcManager: IpcManager }

src/core/window/lifeCycle.js
`-- setupCleanup(mainWindow: BrowserWindow, ipcManager: IpcManager)

src/utils/userAgent.js
|-- typedef LocalStorageInfo
`-- typedef BrowserWindow (local JSDoc shape)
```

## 5) Notes

- Main process entry is package.json -> main: src/main.js
- Preload runs in isolated preload context, not in renderer page context
- close-app channel is exposed in preload, but no matching ipcMain listener exists in current main code