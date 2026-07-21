import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const full = !process.argv.includes("--fast");
const auditUrl = process.env.AUDIT_URL || "http://127.0.0.1:41737";
const systemChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const workspaceChrome = path.join(root, ".pw-browsers/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
const bundledChrome = chromium.executablePath();
const preferredChrome = process.env.PW_CHROMIUM
  || (fs.existsSync(workspaceChrome) ? workspaceChrome : fs.existsSync(bundledChrome) ? bundledChrome : fs.existsSync(systemChrome) ? systemChrome : "");
const browserEnv = preferredChrome ? { PW_CHROMIUM: preferredChrome } : {};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", env: { ...process.env, ...options.env } });
  if (result.status !== (options.expectStatus ?? 0)) {
    throw new Error(`${command} ${args.join(" ")} exited ${result.status}; expected ${options.expectStatus ?? 0}`);
  }
}

run("node", ["scripts/feature-contract-gate.mjs"]);
run("node", ["scripts/feature-contract-gate.mjs"], { env: { LENS_GATE_MUTATION: "remove:createMove" }, expectStatus: 1 });
run("node", ["scripts/companion-capability-graph-gate.mjs"]);
run("npm", ["run", "orb:matrix:check"]);
run("npm", ["run", "requirements:check"]);
run("npm", ["run", "test:orb"]);
run("npm", ["test"]);
run("npm", ["run", "build:extension"]);
run("npm", ["run", "build"], { env: { VITE_LENS_EXTENSION_ID: process.env.VITE_LENS_EXTENSION_ID || "audit-extension-id" } });
run("npm", ["run", "test:extension"]);
run("npm", ["run", "test:extension-release"]);

const forbidden = [];
for (const directory of ["dist", "extension/dist", "extension/release"]) {
  if (!fs.existsSync(path.join(root, directory))) continue;
  const walk = (target) => {
    for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
      const absolute = path.join(target, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (/(?:\.env(?:\.|$)|credentials|private[_-]?key|\.pem$|\.DS_Store$)/i.test(entry.name)) forbidden.push(path.relative(root, absolute));
    }
  };
  walk(path.join(root, directory));
}
if (forbidden.length) throw new Error(`forbidden release files: ${forbidden.join(", ")}`);

async function waitForAuditServer(server, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`${label} exited before audits (${server.exitCode})`);
    try {
      const response = await fetch(auditUrl);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${label} did not become ready`);
}

async function stopAuditServer(server) {
  if (!server || server.exitCode !== null) return;
  const stopped = new Promise((resolve) => server.once("exit", resolve));
  server.kill("SIGTERM");
  await Promise.race([stopped, new Promise((resolve) => setTimeout(resolve, 3_000))]);
}

if (full) {
  run("node", ["scripts/companion-exhaustive-static-audit.mjs"]);
  const parsedAuditUrl = new URL(auditUrl);
  let server = spawn("npx", [
    "vite", "preview",
    "--host", parsedAuditUrl.hostname,
    "--port", parsedAuditUrl.port,
    "--strictPort",
  ], {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      VITE_LENS_EXTENSION_ID: process.env.VITE_LENS_EXTENSION_ID || "audit-extension-id",
    },
  });
  try {
    await waitForAuditServer(server, "production preview");
    // Exercise the persistent extension context first. Running it after
    // hundreds of short-lived Chromium contexts can destabilize extension
    // service workers on constrained CI hosts even when every context closes.
    run("node", ["extension/scripts/orb-audit.mjs"], { env: browserEnv });
    run("node", ["extension/scripts/playwright-audit.mjs"], { env: browserEnv });
    run("node", ["scripts/orb-universe-audit.mjs"], { env: { ...browserEnv, AUDIT_URL: auditUrl } });
    run("node", ["scripts/pearl-visual-contract-audit.mjs"], { env: browserEnv });
    await stopAuditServer(server);
    server = spawn("npm", [
      "run", "dev:client", "--",
      "--host", parsedAuditUrl.hostname,
      "--port", parsedAuditUrl.port,
      "--strictPort",
    ], {
      cwd: root,
      stdio: "inherit",
      env: {
        ...process.env,
        VITE_LENS_EXTENSION_ID: process.env.VITE_LENS_EXTENSION_ID || "audit-extension-id",
      },
    });
    await waitForAuditServer(server, "instrumented client");
    run("node", ["scripts/companion-capability-runtime-audit.mjs"], {
      env: {
        ...browserEnv,
        AUDIT_URL: auditUrl,
        AUDIT_OUT: path.join(root, "audit-shots/orb-universe-2026-07/companion-runtime"),
      },
    });
    run("node", ["scripts/brush-workflow-audit.mjs"], { env: { ...browserEnv, AUDIT_URL: auditUrl } });
    run("node", ["scripts/companion-voice-audit.mjs"], { env: { ...browserEnv, AUDIT_URL: auditUrl } });
    run("node", ["scripts/account-adoption-preservation-audit.mjs"], { env: { ...browserEnv, AUDIT_URL: auditUrl } });
    run("node", ["scripts/first-use-defect-ledger.mjs"]);
  } finally {
    await stopAuditServer(server);
  }
}

console.log(`release gate passed (${full ? "full" : "fast"})`);
