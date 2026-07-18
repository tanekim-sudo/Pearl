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
run("node", ["scripts/companion-capability-graph-gate.mjs"]);
run("npm", ["run", "orb:matrix:check"]);
run("npm", ["run", "test:orb"]);
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
  run("node", ["scripts/companion-exhaustive-static-audit.mjs"]);
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
    run("node", ["scripts/companion-capability-runtime-audit.mjs"], {
      env: {
        AUDIT_URL: auditUrl,
        AUDIT_OUT: path.join(root, "audit-shots/orb-universe-2026-07/companion-runtime"),
      },
    });
    run("node", ["scripts/orb-universe-audit.mjs"], { env: { AUDIT_URL: auditUrl } });
    run("node", ["extension/scripts/orb-audit.mjs"]);
  } finally {
    server.kill("SIGTERM");
  }
}

console.log(`release gate passed (${full ? "full" : "fast"})`);
