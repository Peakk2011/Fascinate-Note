import fs from 'fs';
import path from 'path';

/**
 * This script run after electron-builder packs the app.
 * Why need this
 * Because Fascinate Notes want the to always start with the X11 display system on Linux,
 * not Wayland because of 'SIGSEGV' (Segmentation fault (core dumped) fascinate-note)
 */
export default async function (context) {
    // Only Linux not for Windows or MacOS
    if (context.electronPlatformName !== 'linux') {
        return;
    }

    const outputFolder = context.appOutDir;
    const appName = context.packager.executableName;

    const originalBinaryPath = path.join(outputFolder, appName);
    const renamedBinaryPath = path.join(outputFolder, `${appName}-bin`);

    if (!fs.existsSync(originalBinaryPath)) {
        console.warn(`[sixPack] Could not find the app binary at ${originalBinaryPath}. Skipping.`);
        return;
    }

    fs.renameSync(originalBinaryPath, renamedBinaryPath);

    const launcherScript = `#!/bin/bash
# This file is a Sixpack launcher for Fascinate Notes for Linux.
# Just starts the real app with the X11 flag turned on.
DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
exec "$DIR/${appName}-bin" --ozone-platform=x11 --no-sandbox "$@"
`;

    fs.writeFileSync(originalBinaryPath, launcherScript, { mode: 0o755 });

    fs.chmodSync(originalBinaryPath, 0o755);

    console.log(`[sixPack] X11 launcher created: ${appName} -> ${appName}-bin`);
}