<p align='center'>
  <img src="./assets/icons/preview/fascinate-notes-icons.png" width="80" alt='Fascinate Notes'>
  <h1 align='center'>Fascinate Notes</h1>
  <img src="https://mint-teams.web.app/Assets/Fascinate%20Notes%20Preview/Fascinate%20Notes%20Preview.png" alt='Fascinate Notes App Preview'>
</p>

<br>

<br>

[![Electron](https://img.shields.io/badge/Electron-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)
![Platforms](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-4BCFFA?style=for-the-badge)
![Contributions](https://img.shields.io/badge/Contributions-Welcome-brightgreen?style=for-the-badge)

## Availability Notice!!

Fascinate Notes version 1.3.0 is Open Source (AGPL-3.0)
and will remain publicly available and usable under this license

And after version 1.3.0. Will be developed using a closed-source approach

Those who wish to use or modify open source code can use the latest version which is still open source here

[Fascinate Notes](https://github.com/peakk2011/fascinate-note)

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

# What's available?

You can create your own identity, your own personality,
and create things that you can freely express
in terms of work, content, and text.

## Features

- Editor - rich text, auto-pairing, command palette, Thai/English x-height typography tuning
- Collaboration - real-time rooms sharing, broadcast live cursors, presence, Yjs/WebSocket sync
- Profile - upload, crop, avatars, emoji, bio, pronouns
- Cross-platform - Linux (AppImage, .deb), mint-teams.web.app/notes (PWA), Windows, macOS
- Sharing - room codes (6-Digit), multi-step share modal, one-click copy
- UI/UX - theming tokens, dark/light collab colors, animated modals

## Quick Start

```bash
git clone https://github.com/Peakk2011/Fascinate-Note.git
cd Fascinate-Note
npm install
npm run start
```

## Build

```bash
# Build renderer assets + package app
npm run build
```

Portable version are in `dist/Fascinate Note Portable 1.3.0.exe`
This version no installation required

Compile For Web-App:

```bash
npm run build:web
```

You can see from `dist/web`
Use `npm run preview:web` to preview it loclly

## Scripts

- `npm run start` - Run development mode (`dev.js`)
- `npm run dev:renderer` - Start Vite renderer dev server
- `npm run dev:electron` - Start Electron (electron .)
- `npm run build:renderer` - Build renderer assets with Vite
- `npm run build:web` - Build browser-ready static assets into `dist/web`
- `npm run preview:web` - Preview the web build locally
- `npm run build` - Build renderer assets and package the portable Windows app
- `npm run build:portable` - Explicitly build the portable Windows app

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

Made by Peakk2011.