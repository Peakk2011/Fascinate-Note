# Fascinate Notes Initialization Guide

## Project Structure

```
fascinate-notes/
├── main.js
├── initFascinateNotes.js
├── core/
│   ├── createWindow.js
│   └── preloadAssets.js
└── config/
    └── osConfig.js
```

## File Overview

### main.js

Application entry point. Minimal and clean, only calls the initializer.

```javascript
import initFascinateNotes from './initFascinateNotes.js';
initFascinateNotes();
```

### initFascinateNotes.js

Manages all application initialization logic, including:

**Platform Configuration**
- Detects and disables hardware acceleration for Intel Mac
- Configures GPU settings to prevent rendering issues

**Squirrel Events Handling**
- Handles installer events on Windows
- Prevents app from launching during installation/update

**Event Handlers**
- activate: Creates new window when clicking dock icon (macOS)
- window-all-closed: Quits app on Windows/Linux, keeps running on macOS

## Key Functions

### configurePlatformSettings()

Configures platform-specific settings, particularly disabling GPU acceleration on Intel Mac.

### handleSquirrelEvents()

Checks command line arguments and handles Squirrel installer events.

### registerEventHandlers()

Registers event handlers for application lifecycle management.

### initFascinateNotes()

Main initialization function that orchestrates the entire startup sequence:

1. Configure platform settings
2. Handle Squirrel events
3. Wait for app ready
4. Preload assets
5. Create main window
6. Register event handlers

## Architecture Benefits

**Separation of Concerns**
Initialization logic is separated from the entry point, improving code readability.

**Modularity**
Each component works independently and can be easily modified or tested.

**Maintainability**
When adding new features, it's clear where modifications should be made.

**Clean Entry Point**
main.js remains concise and clear, with a single responsibility of calling the initializer.