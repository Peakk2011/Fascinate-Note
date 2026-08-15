# Renderer Process Structure

## 1) Entry + File Scope

```text
src/index.html
|-- link: ./stylesheet/reset.css
|-- link: ./stylesheet/index.css
|-- script(type=module): ./renderer/content/app.js
`-- script(type=module): ./entry/publicScript.js

src/renderer/
+---content
|   |   app.js
|   |   page.js
|   |   pageConfig.json
|   |   rich.js
|   |
|   +---contentComponents
|   |   +---commandPalette
|   |   |   |   commandPalette.js
|   |   |   |   commandPaletteConfig.json
|   |   |   |   commands.json
|   |   |   |
|   |   |   +---components
|   |   |   |       CommandItem.js
|   |   |   |       CommandPaletteInput.js
|   |   |   |       CommandPaletteModal.js
|   |   |   |       CommandPaletteResults.js
|   |   |   |
|   |   |   +---controller
|   |   |   |       CommandPaletteController.js
|   |   |   |
|   |   |   +---handlers
|   |   |   |       CommandExecutor.js
|   |   |   |       EventManager.js
|   |   |   |       InputHandler.js
|   |   |   |
|   |   |   \---utils
|   |   |           CursorManager.js
|   |   |
|   |   +---contextmenu
|   |   |   |   contextMenu.js
|   |   |   |   contextMenuConfig.json
|   |   |   |
|   |   |   +---features
|   |   |   |       eventHandlers.js
|   |   |   |       menuActions.js
|   |   |   |       primitiveAction.js
|   |   |   |
|   |   |   +---menu
|   |   |   |       menuPosition.js
|   |   |   |       menuRenderer.js
|   |   |   |       menuState.js
|   |   |   |
|   |   |   \---utils
|   |   |           domUtility.js
|   |   |
|   |   \---model
|   |           modelFind.js
|   |           modelFindConfig.json
|   |
|   +---pageComponents
|   |       editorMask.js
|   |       exportMenu.js
|   |       selectionMenu.js
|   |       statusIndicator.js
|   |       titlebar.js
|   |       zoomControls.js
|   |
|   +---pages
|   |       editorPage.js
|   |       pageMarkup.js
|   |
|   \---pageServices
|           configService.js
|
\---scripts
    |   note.js
    |
    +---editor
    |   |   download.js
    |   |   handlePaste.js
    |   |   keymap.js
    |   |   markdown.js
    |   |   nodeElement.js
    |   |   placeholder.js
    |   |   rendering.js
    |   |   sanitizeInlineArtifacts.js
    |   |
    |   +---downloadStyle
    |   |       cssConfig.js
    |   |
    |   +---features
    |   |   |   contentBlocks.js
    |   |   |   math.js
    |   |   |   preview.js
    |   |   |   urlPreview.js
    |   |   |
    |   |   \---preview
    |   |       |   card.js
    |   |       |   constants.js
    |   |       |   utils.js
    |   |       |
    |   |       \---scanner
    |   |               domScanner.js
    |   |               events.js
    |   |               fetcher.js
    |   |               index.js
    |   |               observer.js
    |   |               state.js
    |   |
    |   \---markdown
    |           commands.js
    |           handleEnterInBlockquote.js
    |           handleEnterInCodeBlock.js
    |           handleEnterInHeading.js
    |
    \---note
            api.js
            noteConfig.js
            notehandlers.js
            state.js
```

## 2) Runtime Flow Tree

```text
src/index.html
|-- ./renderer/content/app.js
|   `-- App()
|       |-- Page.markups()
|       |   |-- getConfig() from pageServices/configService.js
|       |   |-- createModelFind()
|       |   |-- createContextMenu()
|       |   |-- createTitlebar() if electronAPI exists
|       |   |-- createCommandPalette()
|       |   `-- createPageMarkup(...)
|       |       `-- HTML string for editor shell + overlays + tools
|       |-- Mint.injectHTML('#app', html)
|       `-- Page.init()
|           |-- noteFeatures() from scripts/note/api.js
|           |-- modelFind.init(...)
|           |-- contextMenu.init(...)
|           |-- commandPalette.init(...)
|           `-- initEditorPage(...)
|               |-- initRichEditor(...)
|               |   |-- createPlaceholder()
|               |   |-- handleMarkdown()
|               |   |-- handlePaste()
|               |   |-- sanitizeInlineArtifacts()
|               |   `-- initRendering()
|               |       |-- initMathSystem()
|               |       |-- initURLPreviewSystem()
|               |       `-- initContentBlocks()
|               |-- initStatusIndicator()
|               |-- initZoomControls()
|               |-- initExportMenu()
|               |-- initSelectionMenu()
|               |-- initEditorMask()
|               `-- keyMap() + command palette shortcut listener
|
`-- ./entry/publicScript.js
    `-- initOS()
        |-- wait for window.electronAPI
        `-- getOS() -> add OS class to document.body
```

## 3) Renderer Dependencies Outside src/renderer

```text
src/entry/publicScript.js
`-- uses preload bridge: window.electronAPI.getOS()

src/framework/mint.js
`-- Mint namespace used by renderer
    |-- injectHTML()
    |-- include()
    `-- utility exports (state/router/injection/security/etc.)

src/utils/fetch.js
|-- fetchJSON()
`-- fetchWithTimeout()

src/api/cursor-behavior.js
`-- auto-init cursor mode controller on import

src/api/translate/
|-- config.json
`-- translator.js
    `-- translate.* language helpers (thai/english/japanese/...)

src/api/marker/
|-- workspace.js
|   |-- loadConfiguration() from utils/config.js
|   |-- setupCanvas(), getCanvasCoords(), requestRedraw(), updateViewTransform()
|   `-- zoom controls: zoomIn(), zoomOut(), resetZoom(), handleWheel()
|-- controllers/zoomPan.js
|-- core/canvas.js
|-- utils/config.js
|-- utils/fetch.js
`-- data/
    |-- workspace_config.json
    `-- workspace_state.json
```

## 4) Types Structure (Renderer)

```text
src/renderer/content/contentComponents/commandPalette/utils/CursorManager.js
`-- typedef SavedCursor

src/renderer/content/contentComponents/commandPalette/commandPalette.js
`-- typedef NoteAPI

src/renderer/content/contentComponents/contextmenu/features/eventHandlers.js
|-- typedef TouchContextMenuConfig
|-- typedef ContextMenuConfig
`-- typedef InitializeParams

src/renderer/content/pageComponents/exportMenu.js
|-- typedef ExportMenuConfig
|-- typedef RichEditorAPI
`-- typedef ExportMenuAPI

src/renderer/content/pageComponents/statusIndicator.js
|-- typedef StatusIndicatorMarkupConfig
|-- typedef StatusIndicatorInitConfig
`-- typedef StatusIndicatorAPI

src/renderer/content/pageComponents/titlebar.js
`-- typedef TitlebarHandle

src/renderer/content/pages/editorPage.js
|-- typedef EditorConfig
|-- typedef NoteAPI
|-- typedef ModelFindAPI
|-- typedef CommandPaletteAPI
|-- typedef ContextMenuAPI
|-- typedef EditorPageReturn
`-- typedef EditorCallbacks

src/renderer/scripts/editor/downloadStyle/cssConfig.js
|-- typedef ThemeMode
|-- typedef ThemeColors
`-- typedef downloadMarkupsContent

src/renderer/scripts/note/noteConfig.js
`-- typedef NoteFeaturesConfig

src/renderer/scripts/note/api.js
|-- typedef NoteElements
|-- typedef StatusSetter
|-- typedef ZoomHandlers
`-- typedef NoteFeaturesAPI
```

## 5) Types Structure (Marker modules used by renderer)

```text
src/api/marker/controllers/zoomPan.js
`-- typedef ZoomState

src/api/marker/core/canvas.js
`-- typedef CanvasCoordinates

src/api/marker/utils/config.js
|-- typedef WorkspaceConfig
|-- typedef GlobalState
`-- typedef ConfigurationResult

src/api/marker/utils/fetch.js
|-- typedef CacheEntry
|-- typedef FetchJSONOptions
|-- typedef BatchFetchOptions
`-- typedef BatchFetchResult
```

## 6) Notes

- Renderer boot is driven by index.html scripts, not by Electron main entry.
- Renderer can run in browser-like context; Electron-only behavior is guarded by window.electronAPI checks.
- Titlebar + workspace marker features are optional and only useful in Electron UI mode.