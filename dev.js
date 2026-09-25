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

const findAvailablePort = async (startPort) => {
    let port = startPort;

    while (await isPortOpen(port)) {
        port += 1;
    }

    return port;
};

const waitForPort = async (port, timeout = 10000) => {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
        if (await isPortOpen(port)) return;
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`Renderer server did not start on port ${port}`);
};

const electronArgs = process.argv.slice(2);
const hasOzonePlatform = electronArgs.some(arg =>
    arg === "--ozone-platform" || arg.startsWith("--ozone-platform=")
);
if (process.platform === "linux" && !hasOzonePlatform) {
    electronArgs.push("--ozone-platform=x11");
}

const rendererPort = await findAvailablePort(5173);
process.env.VITE_PORT = String(rendererPort);
process.env.VITE_DEV_SERVER_URL = `http://localhost:${rendererPort}`;

const rendererProcess = spawnProcess({
    label: "renderer",
    command: "npm",
    args: ["run", "dev:renderer"],
});

await waitForPort(rendererPort);

const electronProcess = spawnProcess({
    label: "electron",
    command: "npm",
    args: ["run", "dev:electron", "--", ...electronArgs],
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