# Collaboration Worker

Roadmap items 3–5 are implemented in code. Items 1–2 (Firebase owner sign-in,
expiring invitation codes, guest authorization, and Cloud Function rate limiting)
remain pending. The existing six-digit room code is a room identifier, **not a
verified OTP or an access-control boundary**. This transport preserves that
existing behavior; it does not implement authentication.

## Local development — no cloud account needed

```sh
npm install
npm run collab:server
npm run dev:renderer
```

The renderer defaults to `http://127.0.0.1:8787`. Open Share & Collaborate in two
windows, create a room, and join with its code. The provider connects at
`/parties/collab-room/<room-code>`. The old `collab-server` command is an alias
for the new local Worker command. The old y-websocket server is no longer used.

The server command disables Wrangler's interactive terminal hotkeys so it can
also run as a child process of `npm start` without attempting to put a shared
or background terminal into raw mode (`setRawMode EIO`). Server logs and file
watching remain enabled; stop the process with Ctrl+C.

Wrangler stores local Durable Object data in its ignored `.wrangler` directory.
Keep that directory to retain documents between restarts. Data from the old
y-websocket/LevelDB server is not automatically migrated.

## Persistence

Each room has its own Durable Object. `onLoad` restores a Yjs snapshot; `onSave`
writes a snapshot after 700 ms idle or at most 3 seconds of continuous edits.
The last disconnect also flushes pending content. Saves are serialized and use
a transaction with 64 KiB chunks, avoiding the single-value storage limit.
An abrupt process failure before a save completes can still lose recent edits;
the client's sync event confirms synchronization, not durable storage.

Closing a room in the current UI does not delete its stored document or enforce
server-side access revocation. Those room lifecycle/auth semantics remain future
work alongside items 1–2.

## Checks

```sh
npm run test:collab
npm run collab:check
npm run build:renderer
```

The integration test runs a local Worker, syncs independent clients with
BroadcastChannel disabled, checks room isolation and awareness, and restarts the
Worker against the same temporary storage to verify persistence.
`collab:check` bundles the Worker with `--dry-run`; it does not deploy anything.
Wrangler is pinned to a version whose Workers types match y-partyserver's peers.

## Remaining external setup

Before public use, complete Firebase authentication and server-side invitation
verification/rate limiting. Provision a Cloudflare account and deploy the Worker
with its SQLite Durable Object binding/migration. Then set `collab.serverUrl` in
`src/renderer/content/pageConfig.json` to the deployed Worker origin and rebuild.
Public origins automatically use `wss`; insecure `ws` is only used for loopback
development. This change does not provision services or deploy to the cloud.

API references: [Y-PartyServer](https://github.com/cloudflare/partykit/tree/main/packages/y-partyserver)
and [PartyServer](https://github.com/cloudflare/partykit/tree/main/packages/partyserver).
