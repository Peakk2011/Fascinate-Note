# Fascinate Notes Mobile Monorepo

## Goal
Keep desktop and mobile/PWA in one repository while sharing the app core.

## Proposed structure

- apps/
  - desktop/
    - current Electron app entrypoints and desktop-specific code
  - mobile/
    - PWA/mobile shell, touch-first UI, mobile adapters

- shared/
  - core/
    - note logic
    - marker logic
    - shared storage abstraction
    - shared domain models
  - ui/
    - shared UI primitives if needed

## Initial approach
- Keep the existing app as the desktop app inside apps/desktop.
- Create a mobile shell that consumes the same core package.
- Avoid splitting everything at once; move only the app logic that is clearly shared.

## Recommended first steps
1. Create a shared core package for note and marker state.
2. Move storage access behind a small adapter interface.
3. Add a mobile shell that uses the same core but swaps the UI layer.
4. Keep Electron-specific code isolated in the desktop app package.

## Why this works
- One repository for both platforms
- Shared logic reduces duplication
- Desktop and mobile can evolve independently