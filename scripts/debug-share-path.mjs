/**
 * End-to-end check for the "sending paths" mechanism:
 * sender shares an AI node's generative path → receiver (fresh storage)
 * walks it inside the animated path space, leaves a note, branches/forks,
 * returns to the original flow, then makes the whole path their own as
 * real ai-nodes.
 *
 *   node scripts/debug-share-path.mjs
 */
import { chromium } from "playwright";
import fs from "fs";

const BASE = process.env.AUDIT_URL || "http://localhost:5173";
const OUT = "audit-shots";
fs.mkdirSync(OUT, { recursive: true });

const seedAiNodes = [
  {
    id: "pn1", type: "ai-node", nodeKind: "source", label: "forgiveness",
    expandedText: "Forgiveness is the controlled release of pressure",
    sourceIds: [], sourceNodeIds: [], parentId: null,
    x: 0, y: 0, radius: 26, createdAt: 1000, loading: false, error: null,
  },
  {
    id: "pn2", type: "ai-node", nodeKind: "expanded", label: "expand", opLabel: "expand",
    expandedText: "The valve opens slowly: naming the hurt lets pressure escape without the pipe bursting",
    sourceIds: [], sourceNodeIds: [], parentId: "pn1",
    x: 240, y: 90, radius: 20, createdAt: 2000, loading: false, error: null,
  },
  {
    id: "pn3", type: "ai-node", nodeKind: "expanded", label: "invert", via: { name: "invert" },
    expandedText: "What if holding on is itself the release — the grip that finally tires the hand open",
    sourceIds: [], sourceNodeIds: [], parentId: "pn2",
    x: 480, y: 20, radius: 20, createdAt: 3000, loading: false, error: null,
  },
];

const SKIP_KEYS = {
  "lens.onboarded.v1": "1",
  "lens.companion.seen.v1": "1",
  "lens.tour.v1": "1",
};

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
}

async function aiNodesState(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("lens.ai.nodes.v1") || "[]"));
}

async function main() {
  const browser = await chromium.launch(
    process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}
  );

  // ---- sender: seed an AI-space chain, share the path ----
  const sender = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const pageA = await sender.newPage();
  pageA.on("pageerror", (err) => console.log("[sender pageerror]", err.message));
  await pageA.goto(BASE);
  await pageA.waitForTimeout(1200);
  await pageA.evaluate(
    ([nodes, skip]) => {
      localStorage.clear();
      for (const [k, v] of Object.entries(skip)) localStorage.setItem(k, v);
      localStorage.setItem("lens.ai.nodes.v1", JSON.stringify(nodes));
    },
    [seedAiNodes, SKIP_KEYS]
  );
  await pageA.reload();
  await pageA.waitForTimeout(1800);

  const hasHook = await pageA.evaluate(() => !!window.__lensPathShare);
  check("path share hook exposed", hasHook);
  if (!hasHook) process.exit(1);

  // sender affordance: selecting a node shows the quiet "send this path" chip
  const nodeEls = await pageA.$$(".ai-node");
  check("seeded ai nodes rendered", nodeEls.length === 3, `${nodeEls.length} nodes`);
  if (nodeEls.length) {
    await nodeEls[nodeEls.length - 1].click({ force: true });
    await pageA.waitForTimeout(500);
    const chip = await pageA.$(".ai-path-send");
    check("send-this-path chip appears on selected node", !!chip);
  }
  await pageA.screenshot({ path: `${OUT}/share-path-1-sender.png` });

  const shareUrl = await pageA.evaluate(() => window.__lensPathShare.share("pn3"));
  check("share produced a url", typeof shareUrl === "string" && shareUrl.includes("share="), shareUrl?.slice(0, 80));
  await sender.close();

  // ---- receiver: fresh storage, open the link, walk the path ----
  const receiver = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await receiver.addInitScript((skip) => {
    for (const [k, v] of Object.entries(skip)) localStorage.setItem(k, v);
  }, SKIP_KEYS);
  const pageB = await receiver.newPage();
  pageB.on("pageerror", (err) => console.log("[receiver pageerror]", err.message));
  await pageB.goto(shareUrl);
  await pageB.waitForTimeout(2500);

  const walkVisible = await pageB.$(".path-walk");
  check("walk starts on opening the link", !!walkVisible);
  const step0 = await pageB.evaluate(() => document.querySelector(".path-walk")?.dataset.pwStep);
  check("walk begins at step 0", step0 === "0", `step=${step0}`);
  const caption0 = await pageB.textContent(".pw-caption").catch(() => "");
  check("first step carries its caption", (caption0 || "").includes("where it began"), caption0);
  await pageB.screenshot({ path: `${OUT}/share-path-2-walk-start.png` });

  // navigate forward along the arrows
  await pageB.keyboard.press("ArrowRight");
  await pageB.waitForTimeout(900);
  const step1 = await pageB.evaluate(() => document.querySelector(".path-walk")?.dataset.pwStep);
  const caption1 = await pageB.textContent(".pw-caption").catch(() => "");
  check("arrow key advances the walk", step1 === "1", `step=${step1}`);
  check("step shows the operation applied", (caption1 || "").includes("expand"), caption1);

  // annotate this step
  await pageB.fill(".pw-note", "hold this tension — the valve image");
  await pageB.waitForTimeout(400);
  const savedNote = await pageB.evaluate(() => {
    const all = JSON.parse(localStorage.getItem("lens.path.walks.v1") || "{}");
    const entry = Object.values(all)[0];
    return entry ? Object.values(entry.notes || {}).join("|") : "";
  });
  check("note persists in receiver's copy of the path", savedNote.includes("hold this tension"), savedNote);
  await pageB.screenshot({ path: `${OUT}/share-path-3-note.png` });

  // branch here: fork into own space, walk stays returnable
  await pageB.click(".walk-btn.branch");
  await pageB.waitForTimeout(900);
  const overlayGone = !(await pageB.$(".path-walk"));
  const returnChip = await pageB.$(".path-return-chip");
  check("branching leaves the walk (fork begins)", overlayGone);
  check("return-to-path affordance appears", !!returnChip);
  let nodes = await aiNodesState(pageB);
  check("fork materialized prefix as real ai-nodes", nodes.length === 2, `${nodes.length} nodes`);
  const forkChild = nodes.find((n) => n.pathNote);
  check("fork carries the note", !!forkChild && forkChild.pathNote.includes("hold this tension"));
  const forkParent = nodes.find((n) => !n.parentId);
  const forkKid = nodes.find((n) => n.parentId);
  check("fork lineage rewired to new ids", !!forkParent && !!forkKid && forkKid.parentId === forkParent.id);
  await pageB.screenshot({ path: `${OUT}/share-path-4-branched.png` });

  // return to the original flow, where the walk was left
  await pageB.click(".path-return-chip");
  await pageB.waitForTimeout(700);
  const resumedStep = await pageB.evaluate(() => document.querySelector(".path-walk")?.dataset.pwStep);
  check("returning resumes the walk where it left off", resumedStep === "1", `step=${resumedStep}`);

  // walk to the arrival, then make the whole path theirs
  await pageB.keyboard.press("ArrowRight");
  await pageB.waitForTimeout(900);
  await pageB.click(".walk-btn.primary"); // reads "make it mine" on the last step
  await pageB.waitForTimeout(1200);
  check("walk closes after make-it-mine", !(await pageB.$(".path-walk")));
  check("no leftover return chip", !(await pageB.$(".path-return-chip")));
  nodes = await aiNodesState(pageB);
  check("full path lives in their space (no duplicates)", nodes.length === 3, `${nodes.length} nodes`);
  const terminal = nodes.find((n) => n.via?.name === "invert");
  const middle = nodes.find((n) => n.opLabel === "expand");
  check("arrival node present with lineage intact", !!terminal && !!middle && terminal.parentId === middle.id);
  check("materialized nodes are operable (not loading, own ids)", nodes.every((n) => !n.loading && !["pn1", "pn2", "pn3"].includes(n.id)));
  check("nodes remember where they came from", nodes.every((n) => n.sharedFrom?.pathId));
  await pageB.screenshot({ path: `${OUT}/share-path-5-made-mine.png` });

  // survives reload as ordinary ai-nodes
  await pageB.reload();
  await pageB.waitForTimeout(1500);
  const after = await aiNodesState(pageB);
  check("their copy survives reload", after.length === 3);
  const renderedCount = await pageB.evaluate(() => document.querySelectorAll(".ai-node").length);
  check("nodes render in their AI space", renderedCount === 3, `${renderedCount} rendered`);
  await pageB.screenshot({ path: `${OUT}/share-path-6-their-space.png` });

  await receiver.close();
  await browser.close();
  console.log(failures ? `\n${failures} FAILURES` : "\nALL PASS");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
