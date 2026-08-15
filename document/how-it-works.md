# Fascinate Notes startup flow (Development mode)

```bash
USER
 |  npm run start
 v
SHELL (cmd / bash / zsh)
 |  exec "npm"
 v
OS KERNEL
 |  spawn process
 v
NODE (npm-cli.js)
 |  read package.json
 |  resolve script: "start"
 |  spawn: node dev.js
 v
OS KERNEL
 |  new process (PID)
 |  memory mapped
 v
NODE (dev.js)  [PROCESS SUPERVISOR]
 |  spawn: npm run dev:electron
 |  spawn: npm run dev:renderer
 |
 +---------------------------+---------------------------+
 |                           |                           |
 v                           v                           v
OS KERNEL                OS KERNEL                  OS KERNEL
 |                           |                           |
 v                           v                           v
NODE (npm)               NODE (npm)               (terminal)
 |                           |
 |                           |
 v                           v
ELECTRON (electron .)  VITE DEV SERVER
 |  spawn electron.exe
 v
ELECTRON MAIN PROCESS
 |  initialize Node runtime
 |  initialize Chromium
 v
app.whenReady()
 |
 v
createMainWindow()
 |
 v
loadInterface(mainWindow)
 |  DEV MODE
 |  ---------------------------------
 |  try loadURL(http://localhost:5173)
 |    |
 |    +--> FAIL (ECONNREFUSED)
 |    |      |
 |    |      v
 |    |    sleep(300ms)
 |    |      |
 |    +------+
 |
 |    +--> SUCCESS
 |           |
 |           v
 |      renderer loaded
 |
 |  PROD MODE
 |  ---------------------------------
 |  loadFile(src/index.html)
 |
 v
VITE PROCESS (PARALLEL)
 |  scan filesystem
 |  build module graph
 |  start HTTP server :5173 as local server
 v
VITE READY
 |
 v
loadURL SUCCESS
 |
 v
did-finish-load
 |
 v
SHOW MAIN WINDOW
 |
 v
APPLICATION READY

```

## Why Electron startup first

**Electron** = Application shell
**Renderer** = Replaceable Dependency

#### Electron main process

- owns lifecycle
- owns windows
- own system resources

#### Renderer

- Can be slow
- May crash
- Reload many time (HMR)

#### Therefore

- Electron must not wait for renderer
- Renderer availability is handled at runtime

## Why `wait-on` module is not used

```bash
wait-on behavior:

  wait-on http://localhost:5173
        |
        v
  BLOCK PROCESS UNTIL READY
```

#### Problems

- Electron startup is delayed
- No splash / feedback to user
- Dev behavior != Prod behavior
- Tight coupling between CLI tools

```bash
Current approach:

  Electron start (immediately)
        |
        v
  Renderer readiness handled inside Electron
```

#### Result

- Predictable startup behavior
- Correct responsibility layer
- Real desktop-app behavior

## Role of `dev.js`

#### Responsibilities

- Spawn processes
- Do NOT manage application state
- Do NOT block execution
- Forward signals (SIGINT)

`dev.js` is not

- a dependency manager
- a renderer gatekeeper
- a runtime coordinator

## DESIGN PRINCIPLES

1. Main process is authoritative
2. Renderer is replaceable
3. No CLI-level blocking
4. OS handles concurrency
5. App handles readiness
6. Dev behavior mirrors Prod behavior

# Short startup flow

```bash
USER (npm run start)
    ↓
SHELL (terminal)
    ↓
OS KERNEL (process spawn)
    ↓
NODE (npm-cli.js)
    ↓
OS KERNEL (new process)
    ↓
NODE (dev.js) [SUPERVISOR]
    ↓
    ├→ ELECTRON (electron .)
    │     ↓
    │   ELECTRON MAIN PROCESS
    │     ↓
    │   app.whenReady()
    │     ↓
    │   createMainWindow()
    │     ↓
    │   loadInterface()
    │
    └→ VITE DEV SERVER
          ↓
        localhost:5173
```