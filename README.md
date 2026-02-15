<img src="./assets/icons/icon.png" width="100" alt='Fascinate Notes'>

<br>

# Fascinate Notes

<br>

<img src="https://mint-teams.web.app/Assets/Fascinate%20Notes%20Preview/Fascinate%20Notes%20Preview.png" width="800" alt='Fascinate Notes App Preview'>

<br>

[![Electron](https://img.shields.io/badge/Electron-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)
![Platforms](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-4BCFFA?style=for-the-badge)
![Contributions](https://img.shields.io/badge/Contributions-Welcome-brightgreen?style=for-the-badge)

A full-screen thinking space focused on speed, clarity, and flow.

## What is Fascinate Note?

Fascinate Note is a desktop-first writing and thinking workspace built with Electron.
It combines a rich editor, markdown-like shortcuts, and lightweight productivity tools in one interface.
The goal is to keep note-taking fast while still supporting structure, formatting, and export.

## How

The app runs as an Electron application with a clear separation between processes:

- `src/core` handles the main process lifecycle, window creation, preload wiring, and app bootstrap.
- `src/renderer` contains editor UI, interaction logic, command palette, context menu, and content features.
- Vite is used for renderer development and build output.
- Editing pipeline includes paste sanitization, inline artifact cleanup, markdown transforms, and preview rendering.

In development, the renderer runs from the Vite dev server.
In packaged mode, the app loads local built assets from inside the app bundle.

## Why Fascinate Note?

Many note apps are either too minimal for structured writing or too heavy for fast idea capture.
Fascinate Note is designed to stay in the middle:

- Fast enough for rough thinking
- Structured enough for long-form notes
- Local-first enough for privacy and control
- Extendable enough for future collaboration features

## Features

- Rich text editor with markdown shortcuts
- Inline cleanup and paste sanitization
- URL preview cards
- Export options: HTML, TXT, and image
- Command palette and custom context menu
- Cross-platform desktop app with Electron

## Quick Start

```bash
git clone https://github.com/Peakk2011/Fascinate-Note.git
cd Fascinate-Note
npm install
npm run start
```

## Build

```bash
# Build renderer assets
npm run build:renderer

# Package desktop app
npx electron-builder
```

## Scripts

- `npm run start` - Run development mode (`dev.js`)
- `npm run dev:renderer` - Start Vite renderer dev server
- `npm run dev:electron` - Start Electron via Electron Forge
- `npm run build:renderer` - Build renderer assets with Vite

## Project Structure

```text
src/
  core/        # Electron main process window lifecycle and setup
  renderer/    # Editor UI, features, and content modules
  entry/       # Renderer entry scripts
assets/        # Icons and typefaces
```

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a PR.

## License

Licensed under the GNU license. See [LICENSE.md](./LICENSE.md).

## Author

Made by Mint teams.
