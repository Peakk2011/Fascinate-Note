import { spawn } from "node:child_process";

const spawnProcess = ({ label, command, args }) => {
    const p = spawn(command, args, {
        shell: true,
        stdio: "inherit",
    });

    p.on("exit", code => {
        console.log(`[${label}] exited (${code})`);
        process.exit(code ?? 1);
    });

    return p;
};

const electronProcess = spawnProcess({
    label: "electron",
    command: "npm",
    args: ["run", "dev:electron"],
});

const rendererProcess = spawnProcess({
    label: "renderer",
    command: "npm",
    args: ["run", "dev:renderer"],
});

process.on("SIGINT", () => {
    electronProcess.kill("SIGINT");
    rendererProcess.kill("SIGINT");
    process.exit(0);
});
