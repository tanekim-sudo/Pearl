import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PRIMITIVE_NAMES } from "../../shared/transform-primitives.js";
import { operatorHasFork, branchOutputCount } from "../../shared/operator-branching.js";
import {
  FN_PALETTE_MIME,
  FN_STEP_MIME,
  addBranchAtStep,
  addLeafStep,
  addPipelineStep,
  buildDraftMap,
  duplicateStep,
  ensurePipelineRoot,
  findParentId,
  mergeStepsSequential,
  moveStep,
  nextSiblingId,
  opToClipboardTree,
  pasteTreeAt,
  removeStep,
  reorderStep,
  stepIndexInParent,
} from "../lib/function-tree-editor.js";

const newId = () => Math.random().toString(36).slice(2, 10);

function collectDraftOps(rootOp, opMap) {
  if (!rootOp) return [];
  // Built-in primitives live outside the operator store — resolve the root
  // through itself so they open in the editor like any other function.
  const resolve = (id) => (id === rootOp.id ? opMap[id] || rootOp : opMap[id]);
  const ids = new Set();
  function walk(id) {
    if (!id || ids.has(id)) return;
    ids.add(id);
    const op = resolve(id);
    if (op?.kind === "pipeline" && op.steps) op.steps.forEach(walk);
  }
  walk(rootOp.id);
  return [...ids].map((id) => ({ ...resolve(id) })).filter((o) => o.id);
}

function collectFlowNames(op, draftMap, limit = 12) {
  if (!op) return [];
  if (op.kind === "prompt") return [op.name || "step"];
  if (op.kind !== "pipeline" || !op.steps?.length) return [];
  const names = [];
  for (const id of op.steps) {
    const step = draftMap[id];
    if (!step) continue;
    if (step.kind === "pipeline") {
      names.push(step.name || "group");
    } else {
      names.push(step.name || "step");
    }
    if (names.length >= limit) break;
  }
  return names;
}

function buildFocusPath(focusId, rootId, draftMap) {
  if (!focusId || focusId === rootId) return [];
  const crumbs = [];
  let cur = focusId;
  while (cur && cur !== rootId) {
    const op = draftMap[cur];
    if (!op) break;
    crumbs.unshift(op.name || "step");
    const parent = findParentId(cur, draftMap);
    if (!parent) break;
    cur = parent;
  }
  return crumbs;
}

export default function LensTreeEditor({
  editor,
  opMap,
  operators,
  paletteGroups = [],
  onClose,
  onSaveTree,
  onDelete,
  createFromProse,
  editFromProse,
  treeToOperators,
}) {
  const isCreate = editor.mode === "create";
  const sourceRoot = editor.op || null;

  const [draftOps, setDraftOps] = useState(() => (isCreate ? [] : collectDraftOps(sourceRoot, opMap)));
  const [rootId, setRootId] = useState(() => sourceRoot?.id || null);
  const [focusId, setFocusId] = useState(null);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createPrompt, setCreatePrompt] = useState("");
  const [prose, setProse] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [toast, setToast] = useState(null);
  const [strandDrag, setStrandDrag] = useState(null);
  const clipboardRef = useRef(null);
  const editorRef = useRef(null);

  const draftMap = useMemo(() => buildDraftMap(draftOps), [draftOps]);
  const rootDraft = rootId ? draftMap[rootId] : null;
  const focusOp = focusId ? draftMap[focusId] : null;
  const inspectorOp = focusOp || rootDraft;
  const flowSummary = useMemo(
    () => collectFlowNames(rootDraft, draftMap).join(" → "),
    [rootDraft, draftMap]
  );
  const focusPath = useMemo(
    () => buildFocusPath(focusId, rootId, draftMap),
    [focusId, rootId, draftMap]
  );
  const treeHasFork = useMemo(
    () => (rootDraft ? operatorHasFork(rootDraft, draftMap) : false),
    [rootDraft, draftMap]
  );
  const forkOutputs = useMemo(
    () => (treeHasFork ? branchOutputCount(rootDraft, draftMap) : 1),
    [treeHasFork, rootDraft, draftMap]
  );

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const showHint = useCallback((msg) => setToast(msg), []);

  const patchOp = useCallback((id, patch) => {
    setDraftOps((ops) => ops.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }, []);

  const applyDrop = useCallback(
    (parentId, index, payload) => {
      if (!parentId) return;
      let parent = draftMap[parentId];
      let ops = draftOps;
      let rid = rootId;

      if (parent?.kind !== "pipeline") {
        const wrapped = ensurePipelineRoot(ops, parentId, newId);
        ops = wrapped.draftOps;
        rid = wrapped.rootId;
        parentId = parentId === rootId ? wrapped.rootId : parentId;
        parent = buildDraftMap(ops)[parentId];
        if (parentId === wrapped.rootId) setRootId(wrapped.rootId);
      }

      if (payload.type === "step") {
        const fromParent = findParentId(payload.stepId, draftMap);
        const fromIdx = fromParent ? stepIndexInParent(ops, fromParent, payload.stepId) : -1;
        let next;
        if (fromParent === parentId && fromIdx >= 0) {
          const toIdx = index > fromIdx ? index - 1 : index;
          next = reorderStep(ops, parentId, fromIdx, toIdx);
        } else {
          next = moveStep(ops, payload.stepId, parentId, index);
        }
        setDraftOps(next);
        setFocusId(payload.stepId);
        return;
      }

      if (payload.type === "clipboard" && payload.tree) {
        const { draftOps: next, stepId } = pasteTreeAt(ops, payload.tree, parentId, index, newId);
        setDraftOps(next);
        setFocusId(stepId);
        return;
      }

      if (payload.type === "palette" && payload.op) {
        const tree = opToClipboardTree(payload.op, { ...opMap, [payload.op.id]: payload.op });
        const { draftOps: next, stepId } = pasteTreeAt(ops, tree, parentId, index, newId);
        setDraftOps(next);
        setFocusId(stepId);
      }
    },
    [draftMap, draftOps, opMap, rootId]
  );

  const copyFocused = useCallback(() => {
    const target = focusId || rootId;
    if (!target || !draftMap[target]) return;
    clipboardRef.current = opToClipboardTree(draftMap[target], draftMap);
    showHint("copied step");
  }, [draftMap, focusId, rootId, showHint]);

  const pasteAfterFocus = useCallback(() => {
    const tree = clipboardRef.current;
    if (!tree) return;
    const target = focusId || rootId;
    if (!target) return;
    const draftMapNow = buildDraftMap(draftOps);
    let parentId = findParentId(target, draftMapNow) || target;
    let index = findParentId(target, draftMapNow)
      ? stepIndexInParent(draftOps, parentId, target) + 1
      : draftMapNow[parentId]?.steps?.length || 0;

    const parent = draftMapNow[parentId];
    if (parent?.kind === "pipeline" && focusId === parentId) {
      index = parent.steps.length;
    }

    applyDrop(parentId, index, { type: "clipboard", tree });
    showHint("pasted");
  }, [applyDrop, draftOps, focusId, rootId, showHint]);

  const cutFocused = useCallback(() => {
    copyFocused();
    const target = focusId;
    if (!target || target === rootId) return;
    setDraftOps((ops) => removeStep(ops, target, rootId));
    setFocusId(null);
    showHint("cut step");
  }, [copyFocused, focusId, rootId, showHint]);

  const duplicateFocused = useCallback(() => {
    const target = focusId;
    if (!target || target === rootId) return;
    setDraftOps((ops) => duplicateStep(ops, target, newId));
    showHint("duplicated step");
  }, [focusId, rootId, showHint]);

  /** Drag a strand out of a step: continue its lane or fork a new branch. */
  const branchFromStep = useCallback(
    (stepId, partial) => {
      if (!stepId || stepId === rootId) return;
      const res = addBranchAtStep(draftOps, stepId, partial || {}, newId);
      if (!res.stepId) return;
      setDraftOps(res.draftOps);
      setFocusId(res.stepId);
      showHint(res.forked ? "new branch — name it on the right" : "step added");
    },
    [draftOps, rootId, showHint]
  );

  const beginStrandDrag = useCallback(
    (e, stepId) => {
      if (stepId === rootId) return;
      e.preventDefault();
      e.stopPropagation();
      const start = { x: e.clientX, y: e.clientY };
      setStrandDrag({ stepId, ...start, active: false, branchSide: "after" });
      const onMove = (ev) => {
        const dx = ev.clientX - start.x;
        const dy = ev.clientY - start.y;
        const active = Math.hypot(dx, dy) > 8;
        setStrandDrag({
          stepId,
          x: ev.clientX,
          y: ev.clientY,
          active,
          branchSide: dy < 0 ? "before" : "after",
        });
      };
      const cleanup = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        setStrandDrag(null);
      };
      const onUp = (ev) => {
        const dx = ev.clientX - start.x;
        const dy = ev.clientY - start.y;
        cleanup();
        if (Math.hypot(dx, dy) <= 8) return;
        branchFromStep(stepId, { branchSide: dy < 0 ? "before" : "after" });
      };
      const onCancel = () => cleanup();
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
    },
    [branchFromStep, rootId]
  );

  const deleteFocused = useCallback(() => {
    const target = focusId;
    if (!target || target === rootId) return;
    setDraftOps((ops) => removeStep(ops, target, rootId));
    setFocusId(null);
  }, [focusId, rootId]);

  const mergeWithNext = useCallback(() => {
    const target = focusId;
    if (!target) return;
    const map = buildDraftMap(draftOps);
    const sibling = nextSiblingId(target, map);
    if (!sibling) return;
    setDraftOps((ops) => mergeStepsSequential(ops, target, sibling, newId));
    showHint("merged sequence");
  }, [draftOps, focusId, showHint]);

  const addStepAfter = useCallback(
    (kind, parentOverride) => {
      const target = parentOverride || focusId || rootId;
      if (!target) return;
      const map = buildDraftMap(draftOps);
      let parentId = parentOverride || findParentId(target, map);
      let index = 0;
      if (parentId) {
        index = parentOverride
          ? map[parentId]?.steps?.length || 0
          : stepIndexInParent(draftOps, parentId, target) + 1;
      } else {
        const wrapped = ensurePipelineRoot(draftOps, target, newId);
        if (wrapped.rootId !== rootId) {
          setRootId(wrapped.rootId);
          setDraftOps(wrapped.draftOps);
          parentId = wrapped.rootId;
          index = 1;
        } else {
          parentId = target;
          index = map[target]?.steps?.length || 0;
        }
      }
      const fn = kind === "pipeline" ? addPipelineStep : addLeafStep;
      const { draftOps: next, stepId } = fn(draftOps, parentId, index, {}, newId);
      setDraftOps(next);
      setFocusId(stepId);
    },
    [draftOps, focusId, rootId]
  );

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    function onKeyDown(e) {
      if (e.target.closest("input, textarea, select")) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "c") {
        e.preventDefault();
        copyFocused();
      } else if (mod && e.key === "x") {
        e.preventDefault();
        cutFocused();
      } else if (mod && e.key === "v") {
        e.preventDefault();
        pasteAfterFocus();
      } else if (mod && e.key === "d") {
        e.preventDefault();
        duplicateFocused();
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        mergeWithNext();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteFocused();
      }
    }
    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
  }, [copyFocused, cutFocused, pasteAfterFocus, duplicateFocused, mergeWithNext, deleteFocused]);

  async function runProse() {
    const instruction = prose.trim();
    if (!instruction) return;
    setBusy(true);
    setError(null);
    try {
      let tree;
      if (isCreate && !rootDraft) {
        tree = await createFromProse(instruction, operators, opMap);
      } else {
        const target = (focusId && draftMap[focusId]) || rootDraft;
        tree = await editFromProse(target, draftMap, instruction, operators);
      }
      const { rootId: rid, ops } = treeToOperators(tree, {
        role: rootDraft?.role || sourceRoot?.role || null,
        top: isCreate ? true : !!sourceRoot?.top,
      });
      setDraftOps(ops);
      setRootId(rid);
      setFocusId(null);
      setProse("");
    } catch (err) {
      setError(err.message || "Could not apply changes.");
    } finally {
      setBusy(false);
    }
  }

  function saveAll() {
    let ops = draftOps;
    let rid = rootId;
    if (!rid && createName.trim() && createPrompt.trim()) {
      rid = newId();
      ops = [
        {
          id: rid,
          kind: "prompt",
          name: createName.trim(),
          description: createDesc.trim(),
          prompt: createPrompt.trim(),
          top: true,
        },
      ];
    }
    let root = ops.find((o) => o.id === rid);
    if (!rid || !root?.name?.trim()) return;
    if (root.kind === "prompt" && !root.prompt?.trim()) return;
    // An edited primitive stays a primitive (it overrides the built-in) as
    // long as it keeps its canonical name; renamed, it becomes a new function.
    if (!isCreate && sourceRoot?.primitive) {
      const keepsName = PRIMITIVE_NAMES.has(root.name.trim());
      root = { ...root, primitive: keepsName, top: !keepsName, move: false };
      ops = ops.map((o) => (o.id === rid ? root : o));
    }
    const message = isCreate ? `created · ${root.name}` : `updated · ${root.name}`;
    onSaveTree(isCreate ? null : sourceRoot?.id, ops, { commitMessage: message });
  }

  const canSave =
    !!rootDraft ||
    (createName.trim() && createPrompt.trim()) ||
    (rootId && draftOps.some((o) => o.id === rootId && o.name?.trim()));

  const stepCount =
    rootDraft?.kind === "pipeline" ? rootDraft.steps?.length || 0 : rootDraft ? 1 : 0;

  return (
    <div className="modal-scrim fn-scrim-full" onClick={onClose}>
      <div
        ref={editorRef}
        className="fn-editor fn-editor-fullscreen fn-editor-programmable fn-editor-flow"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <div className="fn-head">
          <h3>{isCreate ? "Create lens" : "Edit lens"}</h3>
          <div className="fn-head-actions">
            <button className="fn-close" onClick={onClose} type="button">
              ×
            </button>
          </div>
        </div>

        <div className="fn-editor-body fn-editor-body-flow">
          <div className="fn-flow-main">
            {rootDraft && (
              <div className="fn-flow-overview">
                <div className="fn-flow-overview-top">
                  <span className="fn-flow-stat">
                    {stepCount} step{stepCount === 1 ? "" : "s"}
                  </span>
                  {flowSummary && <span className="fn-flow-summary">{flowSummary}</span>}
                </div>
              </div>
            )}

            <aside className="fn-palette fn-palette-strip">
              <div className="fn-palette-blocks">
                <button
                  type="button"
                  className="fn-palette-block"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      FN_PALETTE_MIME,
                      JSON.stringify({ name: "new step", prompt: "Return ONLY the step output." })
                    );
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                >
                  + step
                </button>
                <button
                  type="button"
                  className="fn-palette-block pipeline"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(FN_PALETTE_MIME, JSON.stringify({ name: "group", steps: [] }));
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                >
                  + group
                </button>
                {paletteGroups
                  .filter((g) => g.ops?.length)
                  .map((g) => (
                    <div key={g.label} className="fn-palette-group fn-palette-group-inline">
                      <div className="fn-palette-group-label">{g.label}</div>
                      <div className="fn-palette-group-blocks">
                        {g.ops.map((op) => (
                          <button
                            key={op.id}
                            type="button"
                            className="fn-palette-block"
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData(FN_PALETTE_MIME, JSON.stringify({ opId: op.id }));
                              e.dataTransfer.effectAllowed = "copy";
                            }}
                            title={op.description || op.name}
                          >
                            {op.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </aside>

            <div
              className="fn-flow-scroll"
              onClick={(e) => {
                if (e.target === e.currentTarget) setFocusId(null);
              }}
              onDragOver={(e) => {
                if (
                  rootDraft &&
                  (e.dataTransfer.types.includes(FN_STEP_MIME) ||
                    e.dataTransfer.types.includes(FN_PALETTE_MIME))
                ) {
                  e.preventDefault();
                }
              }}
              onDrop={(e) => {
                // Dropping on the open canvas appends to the end of the flow.
                if (!rootDraft) return;
                e.preventDefault();
                const payload = readDropPayload(e, opMap);
                if (payload) applyDrop(rootId, 9999, payload);
              }}
            >
              {rootDraft ? (
                <LensFlowView
                  rootOp={rootDraft}
                  rootId={rootId}
                  draftMap={draftMap}
                  focusId={focusId}
                  onFocus={setFocusId}
                  dropTarget={dropTarget}
                  setDropTarget={setDropTarget}
                  onDrop={applyDrop}
                  onAddLeaf={(parentId) => addStepAfter("leaf", parentId)}
                  onAddGroup={(parentId) => addStepAfter("pipeline", parentId)}
                  onStrandDown={beginStrandDrag}
                  opMap={opMap}
                />
              ) : (
                <div className="fn-create-panel">
                  <label>name</label>
                  <input
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="e.g. Build Full Investment Thesis"
                  />
                  <label>description</label>
                  <input
                    value={createDesc}
                    onChange={(e) => setCreateDesc(e.target.value)}
                    placeholder="what goes in, what comes out"
                  />
                  <label>prompt</label>
                  <textarea
                    rows={6}
                    value={createPrompt}
                    onChange={(e) => setCreatePrompt(e.target.value)}
                    placeholder="Or skip and describe with AI on the right."
                  />
                </div>
              )}
            </div>
          </div>

          <aside className="fn-editor-side fn-editor-inspector">
            {inspectorOp ? (
              <>
                {focusPath.length > 0 && (
                  <div className="fn-inspector-crumb">
                    {rootDraft?.name || "lens"}
                    {focusPath.map((c, i) => (
                      <React.Fragment key={i}>
                        <span className="fn-inspector-crumb-sep">›</span>
                        <span>{c}</span>
                      </React.Fragment>
                    ))}
                  </div>
                )}
                <div className="fn-inspector-section">
                  <label>{focusId && focusId !== rootId ? "step name" : "lens name"}</label>
                  <input
                    className="fn-tree-input"
                    value={inspectorOp.name || ""}
                    onChange={(e) => patchOp(inspectorOp.id, { name: e.target.value })}
                  />
                  <label>description</label>
                  <input
                    className="fn-tree-input"
                    value={inspectorOp.description || ""}
                    onChange={(e) => patchOp(inspectorOp.id, { description: e.target.value })}
                    placeholder="what this step does"
                  />
                  {inspectorOp.kind === "prompt" && (
                    <>
                      <label>prompt</label>
                      <textarea
                        className="fn-tree-prompt-input"
                        rows={10}
                        value={inspectorOp.prompt || ""}
                        onChange={(e) => patchOp(inspectorOp.id, { prompt: e.target.value })}
                      />
                    </>
                  )}
                  {(!focusId || focusId === rootId) && (
                    <div className="fn-output-controls">
                      <label>outputs</label>
                      <div className="fn-output-controls-row">
                        {treeHasFork ? (
                          <span className="fn-output-fork-note" title="Each leaf branch produces its own output">
                            ⑂ {forkOutputs} outputs · one per branch
                          </span>
                        ) : (
                          <select
                            value={Number(inspectorOp.outputCount) > 1 ? Number(inspectorOp.outputCount) : 1}
                            onChange={(e) => patchOp(inspectorOp.id, { outputCount: Number(e.target.value) })}
                            title="How many distinct outputs this lens produces per run"
                          >
                            <option value={1}>1 output</option>
                            <option value={2}>2 outputs</option>
                            <option value={3}>3 outputs</option>
                            <option value={4}>4 outputs</option>
                          </select>
                        )}
                        <select
                          value={inspectorOp.outputBlockType || "text"}
                          onChange={(e) => patchOp(inspectorOp.id, { outputBlockType: e.target.value })}
                          title="Block type outputs become when dragged onto paper"
                        >
                          <option value="text">as text</option>
                          <option value="sticky">as sticky</option>
                          <option value="callout">as callout</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {focusId && focusId !== rootId && (
                  <div className="fn-step-actions">
                    <button
                      type="button"
                      className="fn-step-action"
                      onClick={() => branchFromStep(focusId)}
                      title="Branch from this step — each branch produces its own output"
                    >
                      ⌁ branch
                    </button>
                    <button type="button" className="fn-step-action" onClick={duplicateFocused}>
                      duplicate
                    </button>
                    <button type="button" className="fn-step-action" onClick={mergeWithNext}>
                      merge →
                    </button>
                    <button type="button" className="fn-step-action" onClick={() => addStepAfter("leaf")}>
                      + step after
                    </button>
                    <button type="button" className="fn-step-action" onClick={() => addStepAfter("pipeline")}>
                      + group after
                    </button>
                    <button type="button" className="fn-step-action danger" onClick={deleteFocused}>
                      delete
                    </button>
                  </div>
                )}

                {inspectorOp.kind === "pipeline" && (
                  <div className="fn-step-actions">
                    <button
                      type="button"
                      className="fn-step-action"
                      onClick={() => addStepAfter("leaf", inspectorOp.id)}
                    >
                      + step
                    </button>
                    <button
                      type="button"
                      className="fn-step-action"
                      onClick={() => addStepAfter("pipeline", inspectorOp.id)}
                    >
                      + group
                    </button>
                  </div>
                )}
              </>
            ) : null}

            <div className="fn-inspector-ai">
              <label>{rootDraft ? "revise" : "describe"}</label>
              <textarea
                className="fn-prose"
                rows={4}
                placeholder={
                  isCreate
                    ? 'e.g. "Extract action items, owners, and deadlines from messy meeting notes"'
                    : 'e.g. "Add a step that checks for contradictions"'
                }
                value={prose}
                onChange={(e) => setProse(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) runProse();
                }}
              />
              {error && <div className="fn-error">{error}</div>}
              <button className="fn-generate" type="button" disabled={busy || !prose.trim()} onClick={runProse}>
                {busy ? (
                  <>
                    <span className="spinner" /> building…
                  </>
                ) : rootDraft ? (
                  "apply with AI"
                ) : (
                  "generate with AI"
                )}
              </button>
            </div>
          </aside>
        </div>

        {strandDrag?.active && (
          <div className="fn-strand-ghost" style={{ left: strandDrag.x + 10, top: strandDrag.y + 6 }}>
            ⌁ new branch {strandDrag.branchSide === "before" ? "above" : "below"}
          </div>
        )}

        <div className="fn-foot">
          {toast && <span className="fn-toast">{toast}</span>}
          {!isCreate && sourceRoot && (
            <button className="fn-del" type="button" onClick={() => onDelete(sourceRoot.id)}>
              delete lens
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button className="fn-secondary" type="button" onClick={onClose}>
            cancel
          </button>
          <button className="fn-primary" type="button" disabled={!canSave} onClick={saveAll}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/** Decode a chip / step / clipboard drag payload from a drop event. */
function readDropPayload(e, opMap) {
  const stepId = e.dataTransfer.getData(FN_STEP_MIME);
  if (stepId) return { type: "step", stepId };
  const raw = e.dataTransfer.getData(FN_PALETTE_MIME);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (data.opId && opMap[data.opId]) return { type: "palette", op: opMap[data.opId] };
    return { type: "clipboard", tree: data };
  } catch {
    return null;
  }
}

function DropSlot({ parentId, index, dropTarget, setDropTarget, onDrop, opMap, label, horizontal }) {
  const active = dropTarget?.parentId === parentId && dropTarget?.index === index;
  return (
    <div
      className={"fn-drop-slot" + (horizontal ? " horizontal" : "") + (active ? " active" : "")}
      onDragOver={(e) => {
        if (
          e.dataTransfer.types.includes(FN_STEP_MIME) ||
          e.dataTransfer.types.includes(FN_PALETTE_MIME)
        ) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDropTarget({ parentId, index });
        }
      }}
      onDragLeave={() => setDropTarget((t) => (t?.parentId === parentId && t?.index === index ? null : t))}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDropTarget(null);
        const payload = readDropPayload(e, opMap);
        if (payload) onDrop(parentId, index, payload);
      }}
    >
      {active && <span className="fn-drop-label">{label || "drop"}</span>}
    </div>
  );
}

function LensFlowView({
  rootOp,
  rootId,
  draftMap,
  focusId,
  onFocus,
  dropTarget,
  setDropTarget,
  onDrop,
  onAddLeaf,
  onAddGroup,
  onStrandDown,
  opMap,
}) {
  if (rootOp.kind === "prompt") {
    return (
      <div className="fn-flow-canvas">
        <div className="fn-flow-row fn-flow-row-root">
          <span className="fn-flow-port">input</span>
          <span className="fn-flow-arrow" aria-hidden>
            →
          </span>
          <LensFlowCard
            op={rootOp}
            stepIndex={1}
            rootId={rootId}
            focusId={focusId}
            onFocus={onFocus}
            draggable={false}
          />
          <span className="fn-flow-arrow" aria-hidden>
            →
          </span>
          <span className="fn-flow-port">output</span>
        </div>
      </div>
    );
  }

  const pipelineId = rootOp.id;
  return (
    <div className="fn-flow-canvas">
        <LensFlowRow
          parentId={pipelineId}
          parentOp={rootOp}
          isRoot
          rootId={rootId}
          draftMap={draftMap}
          focusId={focusId}
          onFocus={onFocus}
          dropTarget={dropTarget}
          setDropTarget={setDropTarget}
          onDrop={onDrop}
          onAddLeaf={onAddLeaf}
          onAddGroup={onAddGroup}
          onStrandDown={onStrandDown}
          opMap={opMap}
        />
    </div>
  );
}

/** A fork point: sibling branches stacked under it, each ending in its own output. */
function LensFlowFork({
  forkOp,
  rootId,
  draftMap,
  focusId,
  onFocus,
  dropTarget,
  setDropTarget,
  onDrop,
  onAddLeaf,
  onAddGroup,
  onStrandDown,
  opMap,
}) {
  const branches = (forkOp.steps || []).map((id) => draftMap[id]).filter(Boolean);
  return (
    <div
      className={"fn-flow-fork" + (focusId === forkOp.id ? " focused" : "")}
      data-step-id={forkOp.id}
    >
      <button
        type="button"
        className="fn-flow-fork-head"
        onClick={(e) => {
          e.stopPropagation();
          onFocus(forkOp.id);
        }}
        title="Fork — each branch runs from here and produces its own output"
      >
        ⑂ {branches.length} branch{branches.length === 1 ? "" : "es"}
      </button>
      <div className="fn-flow-fork-branches">
        {branches.map((branch, bi) => {
          const branchEndsInFork =
            branch.fork ||
            (branch.kind === "pipeline" &&
              branch.steps?.length &&
              draftMap[branch.steps[branch.steps.length - 1]]?.fork);
          return (
            <div key={branch.id} className="fn-flow-branch" data-branch-index={bi}>
              {branch.kind === "pipeline" && !branch.fork ? (
                <div className="fn-flow-group-box">
                  <LensFlowRow
                    parentId={branch.id}
                    parentOp={branch}
                    rootId={rootId}
                    draftMap={draftMap}
                    focusId={focusId}
                    onFocus={onFocus}
                    dropTarget={dropTarget}
                    setDropTarget={setDropTarget}
                    onDrop={onDrop}
                    onAddLeaf={onAddLeaf}
                    onAddGroup={onAddGroup}
                    onStrandDown={onStrandDown}
                    opMap={opMap}
                  />
                </div>
              ) : branch.fork ? (
                <LensFlowFork
                  forkOp={branch}
                  rootId={rootId}
                  draftMap={draftMap}
                  focusId={focusId}
                  onFocus={onFocus}
                  dropTarget={dropTarget}
                  setDropTarget={setDropTarget}
                  onDrop={onDrop}
                  onAddLeaf={onAddLeaf}
                  onAddGroup={onAddGroup}
                  onStrandDown={onStrandDown}
                  opMap={opMap}
                />
              ) : (
                <LensFlowCard
                  op={branch}
                  stepIndex={bi + 1}
                  rootId={rootId}
                  focusId={focusId}
                  onFocus={onFocus}
                  draggable
                  onStrandDown={onStrandDown}
                  dropAfter={(payload) => onDrop(forkOp.id, bi + 1, payload)}
                  opMap={opMap}
                />
              )}
              {!branchEndsInFork && (
                <>
                  <span className="fn-flow-arrow" aria-hidden>
                    →
                  </span>
                  <span className="fn-flow-port">output</span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LensFlowRow({
  parentId,
  parentOp,
  isRoot,
  rootId,
  draftMap,
  focusId,
  onFocus,
  dropTarget,
  setDropTarget,
  onDrop,
  onAddLeaf,
  onAddGroup,
  onStrandDown,
  opMap,
}) {
  const steps = parentOp?.steps?.map((id) => draftMap[id]).filter(Boolean) || [];
  const lastIsFork = steps.length > 0 && !!steps[steps.length - 1].fork;

  return (
    <div className={"fn-flow-lane" + (isRoot ? " root" : "")}>
      {!isRoot && (
        <button
          type="button"
          className={"fn-flow-group-head" + (focusId === parentId ? " focused" : "")}
          onClick={() => onFocus(parentId)}
        >
          <span className="fn-flow-group-badge">group</span>
          <span className="fn-flow-group-name">{parentOp.name || "unnamed group"}</span>
          <span className="fn-flow-group-count">
            {steps.length} step{steps.length === 1 ? "" : "s"}
          </span>
          {onStrandDown && (
            <span
              className="fn-flow-branch-handle"
              title="drag out to branch from this group"
              data-branch-handle={parentId}
              onPointerDown={(e) => onStrandDown(e, parentId)}
              onClick={(e) => e.stopPropagation()}
            >
              ⌁
            </span>
          )}
        </button>
      )}
      <div className="fn-flow-row">
        {isRoot && (
          <>
            <span className="fn-flow-port">input</span>
            <span className="fn-flow-arrow" aria-hidden>
              →
            </span>
          </>
        )}
        <DropSlot
          parentId={parentId}
          index={0}
          dropTarget={dropTarget}
          setDropTarget={setDropTarget}
          onDrop={onDrop}
          opMap={opMap}
          horizontal
        />
        {steps.length === 0 ? (
          isRoot ? (
            <>
              <div className="fn-flow-empty">
                <p>No steps yet</p>
                <div className="fn-flow-empty-actions">
                  <button type="button" onClick={() => onAddLeaf(parentId)}>
                    + step
                  </button>
                  <button type="button" onClick={() => onAddGroup(parentId)}>
                    + group
                  </button>
                </div>
              </div>
              <span className="fn-flow-arrow" aria-hidden>
                →
              </span>
              <span className="fn-flow-port">output</span>
            </>
          ) : (
            <div className="fn-flow-empty fn-flow-empty-nested">
              <p>Empty group</p>
              <div className="fn-flow-empty-actions">
                <button type="button" onClick={() => onAddLeaf(parentId)}>
                  + step
                </button>
              </div>
            </div>
          )
        ) : (
          steps.map((step, i) => (
            <React.Fragment key={step.id}>
              {step.kind === "pipeline" && step.fork ? (
                <LensFlowFork
                  forkOp={step}
                  rootId={rootId}
                  draftMap={draftMap}
                  focusId={focusId}
                  onFocus={onFocus}
                  dropTarget={dropTarget}
                  setDropTarget={setDropTarget}
                  onDrop={onDrop}
                  onAddLeaf={onAddLeaf}
                  onAddGroup={onAddGroup}
                  onStrandDown={onStrandDown}
                  opMap={opMap}
                />
              ) : step.kind === "pipeline" ? (
                <div className="fn-flow-group-box">
                  <LensFlowRow
                    parentId={step.id}
                    parentOp={step}
                    rootId={rootId}
                    draftMap={draftMap}
                    focusId={focusId}
                    onFocus={onFocus}
                    dropTarget={dropTarget}
                    setDropTarget={setDropTarget}
                    onDrop={onDrop}
                    onAddLeaf={onAddLeaf}
                    onAddGroup={onAddGroup}
                    onStrandDown={onStrandDown}
                    opMap={opMap}
                  />
                </div>
              ) : (
                <LensFlowCard
                  op={step}
                  stepIndex={i + 1}
                  rootId={rootId}
                  focusId={focusId}
                  onFocus={onFocus}
                  draggable={step.id !== rootId}
                  onStrandDown={onStrandDown}
                  dropAfter={(payload) => onDrop(parentId, i + 1, payload)}
                  opMap={opMap}
                />
              )}
              {!step.fork && (
                <span className="fn-flow-arrow" aria-hidden>
                  →
                </span>
              )}
              <DropSlot
                parentId={parentId}
                index={i + 1}
                dropTarget={dropTarget}
                setDropTarget={setDropTarget}
                onDrop={onDrop}
                opMap={opMap}
                horizontal
                label="insert"
              />
            </React.Fragment>
          ))
        )}
        {isRoot && steps.length > 0 && !lastIsFork && (
          <>
            <span className="fn-flow-arrow" aria-hidden>
              →
            </span>
            <span className="fn-flow-port">output</span>
          </>
        )}
        {steps.length > 0 && (
          <div className="fn-flow-add">
            <button type="button" onClick={() => onAddLeaf(parentId)} title="Add step">
              +
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function LensFlowCard({ op, stepIndex, rootId, focusId, onFocus, draggable, onStrandDown, dropAfter, opMap }) {
  const cardRef = useRef(null);
  const isFocused = focusId === op.id;

  useEffect(() => {
    if (isFocused && cardRef.current) {
      cardRef.current.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    }
  }, [isFocused]);

  return (
    <div
      ref={cardRef}
      className={"fn-flow-card" + (isFocused ? " focused" : "")}
      data-step-id={op.id}
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData(FN_STEP_MIME, op.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        if (
          dropAfter &&
          (e.dataTransfer.types.includes(FN_STEP_MIME) ||
            e.dataTransfer.types.includes(FN_PALETTE_MIME))
        ) {
          e.preventDefault();
        }
      }}
      onDrop={(e) => {
        // Dropping a chip onto a step inserts right after it.
        if (!dropAfter) return;
        e.preventDefault();
        e.stopPropagation();
        const payload = readDropPayload(e, opMap || {});
        if (payload && payload.stepId !== op.id) dropAfter(payload);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onFocus(op.id);
      }}
    >
      <div className="fn-flow-card-top">
        {draggable && (
          <span className="fn-flow-grip" title="Drag to reorder">
            ⠿
          </span>
        )}
        <span className="fn-flow-step-num">{stepIndex}</span>
        {onStrandDown && op.id !== rootId && (
          <span
            className="fn-flow-branch-handle"
            title="drag out to branch — each branch makes its own output"
            data-branch-handle={op.id}
            onPointerDown={(e) => onStrandDown(e, op.id)}
            onClick={(e) => e.stopPropagation()}
          >
            ⌁
          </span>
        )}
      </div>
      <div className="fn-flow-card-name">{op.name || "unnamed step"}</div>
      {op.description && <div className="fn-flow-card-desc">{op.description}</div>}
      {!op.description && op.prompt && (
        <div className="fn-flow-card-desc fn-flow-card-prompt-preview">
          {(op.prompt || "").slice(0, 80)}
          {(op.prompt || "").length > 80 ? "…" : ""}
        </div>
      )}
    </div>
  );
}
