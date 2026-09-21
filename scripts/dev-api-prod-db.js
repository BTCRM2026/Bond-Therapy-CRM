const { spawn } = require("node:child_process");
const path = require("node:path");

const child = spawn("railway", ["run", "npm", "run", "start:dev"], {
  cwd: path.join(__dirname, "..", "apps", "api"),
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
