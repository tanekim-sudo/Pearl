import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const full = !process.argv.includes("--fast");
const auditUrl = process.env.AUDIT_URL || "http://127.0.0.1:41737";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", env: { ...process.env, ...options.env } });
  if (result.status !== (options.expectStatus ?? 0)) {
    throw new Error(`${command} ${args.join(" ")} exited ${result.status}; expected ${options.expectStatus ?? 0}`);
  }
}

run("node", ["scripts/feature-contract-gate.mjs"]);
run("node", ["scripts/feature-contract-gate.mjs"], { env: { LENS_GATE_MUTATION: "remove:createMove" }, expectStatus: 1 });
run("npm", ["test"]);
run("npm", ["run", "build:extension"]);
run("npm", ["run", "build"]);
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

if (full) {
  const parsedAuditUrl = new URL(auditUrl);
  const server = spawn("npm", [
    "run", "dev:client", "--",
    "--host", parsedAuditUrl.hostname,
    "--port", parsedAuditUrl.port,
    "--strictPort",
  ], { cwd: root, stdio: "inherit" });
  try {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      try {
        const response = await fetch(auditUrl);
        if (response.ok) break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (attempt === 79) throw new Error("Vite did not become ready");
    }
    for (const audit of [
      "scripts/transcript-learning-audit.mjs",
      "scripts/before-after-taxonomy-audit.mjs",
      "scripts/account-adoption-preservation-audit.mjs",
      "scripts/companion-capability-runtime-audit.mjs",
      "scripts/branch-visual-audit.mjs",
      "scripts/brush-workflow-audit.mjs",
      "scripts/page-node-integration-audit.mjs",
      "scripts/universal-interaction-audit.mjs",
      "scripts/cursor-like-companion-audit.mjs",
      "scripts/cognitive-package-audit.mjs",
      "scripts/cognitive-workflows-audit.mjs",
    ]) run("node", [audit], { env: { AUDIT_URL: auditUrl } });
  } finally {
    server.kill("SIGTERM");
  }
}

console.log(`release gate passed (${full ? "full" : "fast"})`);
