import { spawn } from "node:child_process";
import net from "node:net";

const spawnProcess = ({ label, command, args, exitOnFailure = true }) => {
    const p = spawn(command, args, {
        shell: process.platform === "win32",
        stdio: "inherit",
    });

    p.on("exit", code => {
        console.log(`[${label}] exited (${code})`);
        if (exitOnFailure) {
            process.exit(code ?? 1);
        }
    });

    return p;
};

const isPortOpen = (port, host = "localhost") => new Promise((resolve) => {
    const socket = net.createConnection({ port, host });

    socket.once("connect", () => {
        socket.end();
        resolve(true);
    });

    socket.once("error", () => {
        resolve(false);
    });
});

const electronArgs = process.argv.slice(2);
const hasOzonePlatform = electronArgs.some(arg =>
    arg === "--ozone-platform" || arg.startsWith("--ozone-platform=")
);
if (process.platform === "linux" && !hasOzonePlatform) {
    electronArgs.push("--ozone-platform=x11");
}

const electronProcess = spawnProcess({
    label: "electron",
    command: "npm",
    args: ["run", "dev:electron", "--", ...electronArgs],
});

const rendererProcess = spawnProcess({
    label: "renderer",
    command: "npm",
    args: ["run", "dev:renderer"],
});

const collabPort = Number(process.env.COLLAB_PORT || 8787);
const collabHost = process.env.COLLAB_HOST || "127.0.0.1";

let collabProcess = null;
if (await isPortOpen(collabPort, collabHost)) {
    console.log(`[collab] server already running at ${collabHost}:${collabPort}`);
} else {
    collabProcess = spawnProcess({
        label: "collab",
        command: "npm",
        args: ["run", "collab:server"],
        exitOnFailure: false
    });
}

process.on("SIGINT", () => {
    electronProcess.kill("SIGINT");
    rendererProcess.kill("SIGINT");
    collabProcess?.kill("SIGINT");
    process.exit(0);
});