import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const chromeDir = path.join(root, "dist/chrome");
const base = JSON.parse(fs.readFileSync(path.join(chromeDir, "manifest.json"), "utf8"));

function copyPlatform(name, manifest) {
  const output = path.join(root, `dist/${name}`);
  fs.rmSync(output, { recursive: true, force: true });
  fs.cpSync(chromeDir, output, { recursive: true });
  fs.writeFileSync(path.join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

const firefox = {
  ...base,
  background: { scripts: ["assets/background.js"], type: "module" },
  sidebar_action: { default_title: "Lens Everywhere", default_panel: "sidepanel.html" },
  browser_specific_settings: {
    gecko: { id: "lens-everywhere@lens.app", strict_min_version: "121.0" },
  },
};
delete firefox.side_panel;
firefox.permissions = firefox.permissions.filter((permission) => !["sidePanel"].includes(permission));

const safari = {
  ...base,
  name: "Lens Everywhere for Safari",
  description: `${base.description} Requires the native Safari Web Extension container generated from this package.`,
};
delete safari.side_panel;
safari.permissions = safari.permissions.filter((permission) => !["sidePanel", "identity"].includes(permission));

copyPlatform("firefox", firefox);
copyPlatform("safari", safari);
console.log("Generated Chrome, Firefox, and Safari extension artifacts.");
