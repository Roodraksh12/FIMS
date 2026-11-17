import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const mode = process.argv[2] === "preview" ? "preview" : "dev";
const frontendArgs = mode === "preview" ? ["preview"] : [];
// npm.cmd run dev starts both the Node API and the Vite frontend from the project root.
const children = [
  spawn(process.execPath, ["backend/server.ts"], {
    cwd: root,
    stdio: "inherit",
  }),
  spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      ...frontendArgs,
      "--host",
      "127.0.0.1",
      ...process.argv.slice(3),
    ],
    {
      cwd: root,
      stdio: "inherit",
    },
  ),
];

let stopping = false;
// When either process exits or the terminal is stopped, close the other process too.
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill();
}
for (const child of children) {
  child.on("exit", (code) => stop(code ?? 1));
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
