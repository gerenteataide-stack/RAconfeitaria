import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const erpDir = path.join(root, "artifacts", "erp");
const requireFromErp = createRequire(path.join(erpDir, "package.json"));
const viteEntry = requireFromErp.resolve("vite");
const viteCli = path.resolve(path.dirname(viteEntry), "../../bin/vite.js");
const localEnv = { ...process.env, NODE_ENV: "development" };
for (const key of ["VERCEL", "VERCEL_OIDC_TOKEN", "RESEND_API_KEY", "PASSWORD_RESET_FROM"]) {
  delete localEnv[key];
}

const appPort = Number(localEnv.LOCAL_APP_PORT || "5174");
if (!Number.isInteger(appPort) || appPort < 1024 || appPort > 65535) {
  throw new Error("LOCAL_APP_PORT precisa ser uma porta válida acima de 1023.");
}

function runBuild() {
  return new Promise((resolve, reject) => {
    const build = spawn(process.execPath, ["artifacts/api-server/build.mjs"], {
      cwd: root,
      env: localEnv,
      stdio: "inherit",
    });
    build.once("error", reject);
    build.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`API build exited with code ${code ?? "unknown"}`));
    });
  });
}

await runBuild();

const children = [
  spawn(process.execPath, ["--enable-source-maps", "dist/index.mjs"], {
    cwd: path.join(root, "artifacts", "api-server"),
    env: { ...localEnv, LOCAL_APP_PORT: String(appPort), PORT: "3001" },
    stdio: "inherit",
  }),
  spawn(process.execPath, [viteCli, "--config", "vite.config.ts", "--host", "127.0.0.1"], {
    cwd: erpDir,
    env: { ...localEnv, API_ORIGIN: "http://127.0.0.1:3001", LOCAL_APP_PORT: String(appPort), PORT: String(appPort) },
    stdio: "inherit",
  }),
];

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill("SIGTERM");
}

process.once("SIGINT", () => stop());
process.once("SIGTERM", () => stop());
for (const child of children) {
  child.once("error", () => stop(1));
  child.once("exit", (code) => {
    if (!stopping) stop(code ?? 1);
  });
}
