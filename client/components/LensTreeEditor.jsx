import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FN_PALETTE_MIME,
  FN_STEP_MIME,
  addLeafStep,
  addPipelineStep,
  buildDraftMap,
  collectAllNodeIds,
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
  const ids = new Set();
  function walk(id) {
    if (!id || ids.has(id)) return;
    ids.add(id);
    const op = opMap[id];
    if (op?.kind === "pipeline" && op.steps) op.steps.forEach(walk);
  }
  walk(rootOp.id);
  return [...ids].map((id) => ({ ...opMap[id] }));
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
  const [treeExpanded, setTreeExpanded] = useState(() => new Set(sourceRoot?.id ? [sourceRoot.id] : []));
  const [dropTarget, setDropTarget] = useState(null);
  const [toast, setToast] = useState(null);
  const clipboardRef = useRef(null);
  const editorRef = useRef(null);

  const draftMap = useMemo(() => buildDraftMap(draftOps), [draftOps]);
  const rootDraft = rootId ? draftMap[rootId] : null;

  useEffect(() => {
    if (rootId) setTreeExpanded((prev) => new Set([...prev, rootId]));
  }, [rootId]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const showHint = useCallback((msg) => setToast(msg), []);

  const patchOp = useCallback((id, patch) => {
    setDraftOps((ops) => ops.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }, []);

  const toggleTreeNode = useCallback((id) => {
    setTreeExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    if (!rootId) return;
    setTreeExpanded(new Set(collectAllNodeIds(draftOps, rootId)));
  }, [draftOps, rootId]);

  const collapseAll = useCallback(() => {
    if (!rootId) setTreeExpanded(new Set());
    else setTreeExpanded(new Set([rootId]));
  }, [rootId]);

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
        setTreeExpanded((prev) => new Set([...prev, parentId, stepId]));
        setFocusId(stepId);
        return;
      }

      if (payload.type === "palette" && payload.op) {
        const tree = opToClipboardTree(payload.op, { ...opMap, [payload.op.id]: payload.op });
        const { draftOps: next, stepId } = pasteTreeAt(ops, tree, parentId, index, newId);
        setDraftOps(next);
        setTreeExpanded((prev) => new Set([...prev, parentId, stepId]));
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
      : (draftMapNow[parentId]?.steps?.length || 0);

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
    showHint("forked step");
  }, [focusId, rootId, showHint]);

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
    (kind) => {
      const target = focusId || rootId;
      if (!target) return;
      const map = buildDraftMap(draftOps);
      let parentId = findParentId(target, map);
      let index = 0;
      if (parentId) {
        index = stepIndexInParent(draftOps, parentId, target) + 1;
      } else {
        const wrapped = ensurePipelineRoot(draftOps, target, newId);
        if (wrapped.rootId !== rootId) {
          setRootId(wrapped.rootId);
          setDraftOps(wrapped.draftOps);
          parentId = wrapped.rootId;
          index = 1;
        } else {
          parentId = target;
          index = (map[target]?.steps?.length || 0);
        }
      }
      const fn = kind === "pipeline" ? addPipelineStep : addLeafStep;
      const { draftOps: next, stepId } = fn(draftOps, parentId, index, {}, newId);
      setDraftOps(next);
      setTreeExpanded((prev) => new Set([...prev, parentId, stepId]));
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
      setTreeExpanded(new Set(collectAllNodeIds(ops, rid)));
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
    const root = ops.find((o) => o.id === rid);
    if (!rid || !root?.name?.trim()) return;
    if (root.kind === "prompt" && !root.prompt?.trim()) return;
    const message = isCreate ? `created · ${root.name}` : `updated · ${root.name}`;
    onSaveTree(isCreate ? null : sourceRoot?.id, ops, { commitMessage: message });
  }

  const canSave =
    !!rootDraft ||
    (createName.trim() && createPrompt.trim()) ||
    (rootId && draftOps.some((o) => o.id === rootId && o.name?.trim()));

  const focusLabel = focusId && draftMap[focusId] ? draftMap[focusId].name : rootDraft?.name;

  return (
    <div className="modal-scrim fn-scrim-full" onClick={onClose}>
      <div
        ref={editorRef}
        className="fn-editor fn-editor-fullscreen fn-editor-programmable"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <div className="fn-head">
          <div>
            <h3>{isCreate ? "Create lens" : "Edit lens"}</h3>
            <p className="fn-head-sub">
              Build a sequence of steps · drag to reorder · describe changes with AI on the right
            </p>
          </div>
          <div className="fn-head-actions">
            {rootDraft && (
              <>
                <button type="button" className="fn-head-btn" onClick={expandAll}>
                  expand all
                </button>
                <button type="button" className="fn-head-btn" onClick={collapseAll}>
                  collapse all
                </button>
              </>
            )}
            <button className="fn-close" onClick={onClose} type="button">
              ×
            </button>
          </div>
        </div>

        <div className="fn-editor-body fn-editor-body-3col">
          <aside className="fn-palette">
            <div className="fn-palette-title">blocks</div>
            <p className="fn-palette-hint">Drag onto a sequence to add a step</p>
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
              + leaf step
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
                <div key={g.label} className="fn-palette-group">
                  <div className="fn-palette-group-label">{g.label}</div>
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
              ))}
          </aside>

          <div className="fn-tree-scroll">
            {rootDraft ? (
              <LensTreeNode
                op={rootDraft}
                draftMap={draftMap}
                depth={0}
                rootId={rootId}
                focusId={focusId}
                onFocus={setFocusId}
                onPatch={patchOp}
                treeExpanded={treeExpanded}
                onToggleExpand={toggleTreeNode}
                dropTarget={dropTarget}
                setDropTarget={setDropTarget}
                onDrop={applyDrop}
                onFork={duplicateFocused}
                onMergeNext={mergeWithNext}
                onAddLeaf={() => addStepAfter("leaf")}
                onAddGroup={() => addStepAfter("pipeline")}
                onDelete={deleteFocused}
                opMap={opMap}
              />
            ) : (
              <div className="fn-create-panel">
                <p className="fn-hint">
                  Describe what this lens should do, drag blocks from the left, or fill in the fields below.
                </p>
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

          <aside className="fn-editor-side">
            <label>{rootDraft ? "revise with words" : "describe with words"}</label>
            {focusLabel && rootDraft && (
              <p className="fn-focus-hint">
                AI edits <strong>{focusLabel}</strong>
                {focusId && focusId !== rootId ? " and its subtree" : ""}
              </p>
            )}
            <textarea
              className="fn-prose"
              rows={5}
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
            {focusId && focusId !== rootId && (
              <div className="fn-step-actions">
                <button type="button" className="fn-step-action" onClick={duplicateFocused}>
                  fork
                </button>
                <button type="button" className="fn-step-action" onClick={mergeWithNext}>
                  merge ↓
                </button>
                <button type="button" className="fn-step-action" onClick={() => addStepAfter("leaf")}>
                  + leaf
                </button>
                <button type="button" className="fn-step-action" onClick={() => addStepAfter("pipeline")}>
                  + group
                </button>
                <button type="button" className="fn-step-action danger" onClick={deleteFocused}>
                  delete
                </button>
              </div>
            )}
          </aside>
        </div>

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

function DropSlot({ parentId, index, dropTarget, setDropTarget, onDrop, opMap, label }) {
  const active = dropTarget?.parentId === parentId && dropTarget?.index === index;
  return (
    <div
      className={"fn-drop-slot" + (active ? " active" : "")}
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
        const stepId = e.dataTransfer.getData(FN_STEP_MIME);
        if (stepId) {
          onDrop(parentId, index, { type: "step", stepId });
          return;
        }
        const raw = e.dataTransfer.getData(FN_PALETTE_MIME);
        if (!raw) return;
        try {
          const data = JSON.parse(raw);
          if (data.opId && opMap[data.opId]) {
            onDrop(parentId, index, { type: "palette", op: opMap[data.opId] });
          } else {
            onDrop(parentId, index, { type: "clipboard", tree: data });
          }
        } catch {
          /* ignore */
        }
      }}
    >
      {active && <span className="fn-drop-label">{label || "drop here"}</span>}
    </div>
  );
}

function LensTreeNode({
  op,
  draftMap,
  depth,
  rootId,
  focusId,
  onFocus,
  onPatch,
  treeExpanded,
  onToggleExpand,
  dropTarget,
  setDropTarget,
  onDrop,
  onFork,
  onMergeNext,
  onAddLeaf,
  onAddGroup,
  onDelete,
  opMap,
}) {
  const cardRef = useRef(null);
  const isPipeline = op.kind === "pipeline";
  const steps = isPipeline && op.steps ? op.steps.map((id) => draftMap[id]).filter(Boolean) : [];
  const isFocused = focusId === op.id;
  const isOpen = treeExpanded.has(op.id);
  const hasBody = isPipeline || !!(op.description || op.prompt);
  const promptRows = Math.min(14, Math.max(5, ((op.prompt || "").split("\n").length || 0) + 2));
  const parentId = isPipeline ? op.id : findParentId(op.id, draftMap);

  useEffect(() => {
    if (isFocused && cardRef.current) {
      cardRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [isFocused]);

  const seqParentId = isPipeline ? op.id : parentId;

  return (
    <div className="fn-tree-node-wrap" style={{ marginLeft: depth * 12 }}>
      {isPipeline && (
        <DropSlot
          parentId={op.id}
          index={0}
          dropTarget={dropTarget}
          setDropTarget={setDropTarget}
          onDrop={onDrop}
          opMap={opMap}
        />
      )}

      <div
        ref={cardRef}
        className={
          "fn-tree-card" +
          (isFocused ? " focused" : "") +
          (isPipeline ? " pipeline" : " leaf") +
          (isOpen ? " open" : " collapsed")
        }
        draggable={op.id !== rootId}
        onDragStart={(e) => {
          if (op.id === rootId) {
            e.preventDefault();
            return;
          }
          e.dataTransfer.setData(FN_STEP_MIME, op.id);
          e.dataTransfer.effectAllowed = "move";
        }}
      >
        <div className="fn-tree-card-head">
          <span className="fn-drag-grip" title="Drag to reorder or nest">
            ⠿
          </span>
          <button
            type="button"
            className={"fn-tree-toggle" + (hasBody || steps.length ? "" : " hidden")}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(op.id);
            }}
            aria-expanded={isOpen}
          >
            {isOpen ? "▾" : "▸"}
          </button>
          <button type="button" className="fn-tree-summary" onClick={() => onFocus(op.id)}>
            <span className={"fn-tree-badge" + (isPipeline ? " pipeline" : " leaf")}>
              {isPipeline ? `${steps.length} step${steps.length === 1 ? "" : "s"}` : "leaf"}
            </span>
            <span className="fn-tree-name-preview">{op.name || "unnamed step"}</span>
            {!isOpen && op.description && <span className="fn-tree-desc-preview">{op.description}</span>}
          </button>
          {isFocused && op.id !== rootId && (
            <div className="fn-inline-actions">
              <button type="button" title="Fork" onClick={onFork}>
                ⎇
              </button>
              <button type="button" title="Merge with next" onClick={onMergeNext}>
                ⚭
              </button>
              <button type="button" title="Delete" onClick={onDelete}>
                ×
              </button>
            </div>
          )}
        </div>

        {isOpen && (
          <div className="fn-tree-body" onClick={() => onFocus(op.id)}>
            <label className="fn-tree-label">name</label>
            <input
              className="fn-tree-input"
              value={op.name || ""}
              onChange={(e) => onPatch(op.id, { name: e.target.value })}
              onClick={(e) => e.stopPropagation()}
            />
            <label className="fn-tree-label">description</label>
            <input
              className="fn-tree-input"
              value={op.description || ""}
              onChange={(e) => onPatch(op.id, { description: e.target.value })}
              onClick={(e) => e.stopPropagation()}
            />
            {!isPipeline && (
              <>
                <label className="fn-tree-label">prompt</label>
                <textarea
                  className="fn-tree-prompt-input"
                  rows={promptRows}
                  value={op.prompt || ""}
                  onChange={(e) => onPatch(op.id, { prompt: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                />
              </>
            )}
            {isPipeline && (
              <div className="fn-seq-toolbar">
                <button type="button" onClick={onAddLeaf}>
                  + leaf
                </button>
                <button type="button" onClick={onAddGroup}>
                  + group
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {isPipeline && steps.length > 0 && (
        <div className="fn-seq-list">
          {steps.map((step, i) => (
            <React.Fragment key={step.id}>
              {i > 0 && (
                <div className="fn-seq-arrow-row" aria-hidden>
                  <span className="fn-seq-arrow">→</span>
                </div>
              )}
              <DropSlot
                parentId={op.id}
                index={i}
                dropTarget={dropTarget}
                setDropTarget={setDropTarget}
                onDrop={onDrop}
                opMap={opMap}
              />
              <LensTreeNode
                op={step}
                draftMap={draftMap}
                depth={depth + 1}
                rootId={rootId}
                focusId={focusId}
                onFocus={onFocus}
                onPatch={onPatch}
                treeExpanded={treeExpanded}
                onToggleExpand={onToggleExpand}
                dropTarget={dropTarget}
                setDropTarget={setDropTarget}
                onDrop={onDrop}
                onFork={onFork}
                onMergeNext={onMergeNext}
                onAddLeaf={onAddLeaf}
                onAddGroup={onAddGroup}
                onDelete={onDelete}
                opMap={opMap}
              />
            </React.Fragment>
          ))}
          <DropSlot
            parentId={op.id}
            index={steps.length}
            dropTarget={dropTarget}
            setDropTarget={setDropTarget}
            onDrop={onDrop}
            opMap={opMap}
            label="append step"
          />
        </div>
      )}

      {isPipeline && steps.length === 0 && isOpen && (
        <div className="fn-seq-empty">drop blocks here or use + leaf</div>
      )}
    </div>
  );
}
