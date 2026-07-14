import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BEFORE_AFTER_LIMITS,
  emptyExample,
  inferenceResultToOperator,
  normalizeBeforeAfterExamples,
  sideHasContent,
  validateBeforeAfterExamples,
} from "../../shared/before-after-examples.js";

const uid = () => globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);

async function rasterizeImage(file) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Use a PNG, JPEG, or WebP image");
  if (file.size > 8_000_000) throw new Error("Choose an image under 8 MB");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  if (width * height > 4_000_000) throw new Error("Image dimensions are too large");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const mime = file.type === "image/png" && file.size < 1_000_000 ? "image/png" : "image/jpeg";
  const dataUrl = canvas.toDataURL(mime, 0.82);
  if (dataUrl.length * 0.75 > BEFORE_AFTER_LIMITS.dataUrlBytes) throw new Error("Compressed image is still too large");
  return { id: uid(), kind: "image", mime, dataUrl, width, height };
}

function drawStrokes(context, strokes, width, height) {
  context.clearRect(0, 0, width, height);
  for (const stroke of strokes) {
    if (!stroke.points.length) continue;
    context.beginPath();
    context.strokeStyle = stroke.color;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = stroke.width;
    stroke.points.forEach((point, index) => {
      const x = point.x * width;
      const y = point.y * height;
      if (!index) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
  }
}

function InkPad({ value, onChange }) {
  const canvasRef = useRef(null);
  const activeRef = useRef(null);
  const strokes = value?.strokes || [];
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) drawStrokes(canvas.getContext("2d"), strokes, canvas.width, canvas.height);
  }, [strokes]);

  function point(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
      pressure: event.pressure || 0.5,
    };
  }

  function commit(next) {
    const canvas = canvasRef.current;
    drawStrokes(canvas.getContext("2d"), next, canvas.width, canvas.height);
    onChange({
      id: value?.id || uid(),
      kind: "drawing",
      width: canvas.width,
      height: canvas.height,
      strokes: next,
      rasterDataUrl: canvas.toDataURL("image/png"),
    });
  }

  return <div className="ba-ink">
    <canvas
      ref={canvasRef}
      width="640"
      height="280"
      aria-label="Drawing area"
      role="img"
      tabIndex="0"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        activeRef.current = { color: "#171713", width: Math.max(1.5, 2.5 * (event.pressure || 0.7)), points: [point(event)] };
      }}
      onPointerMove={(event) => {
        if (!activeRef.current) return;
        activeRef.current.points.push(point(event));
        drawStrokes(event.currentTarget.getContext("2d"), [...strokes, activeRef.current], event.currentTarget.width, event.currentTarget.height);
      }}
      onPointerUp={(event) => {
        if (!activeRef.current) return;
        activeRef.current.points.push(point(event));
        commit([...strokes, activeRef.current]);
        activeRef.current = null;
      }}
      onPointerCancel={() => { activeRef.current = null; }}
    />
    <div>
      <button type="button" disabled={!strokes.length} onClick={() => commit(strokes.slice(0, -1))}>Undo</button>
      <button type="button" disabled={!strokes.length} onClick={() => commit([])}>Clear drawing</button>
    </div>
  </div>;
}

function ExampleSlot({ label, side, onChange }) {
  const inputRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const drawingAsset = side.assets.find((asset) => asset.kind === "drawing");

  async function addFiles(files) {
    const images = [];
    for (const file of [...files].slice(0, BEFORE_AFTER_LIMITS.assetsPerSide)) images.push(await rasterizeImage(file));
    onChange({ ...side, assets: [...side.assets.filter((asset) => asset.kind === "drawing"), ...images].slice(0, BEFORE_AFTER_LIMITS.assetsPerSide) });
  }

  return <section
    className="ba-slot"
    aria-label={`${label} example`}
    onDragOver={(event) => {
      if (event.dataTransfer.types.includes("Files") || event.dataTransfer.types.includes("text/plain")) event.preventDefault();
    }}
    onDrop={(event) => {
      event.preventDefault();
      if (event.dataTransfer.files?.length) addFiles(event.dataTransfer.files).catch((error) => alert(error.message));
      else {
        const text = event.dataTransfer.getData("text/plain");
        if (text) onChange({ ...side, text: `${side.text}${side.text ? "\n" : ""}${text}`.slice(0, BEFORE_AFTER_LIMITS.textLength) });
      }
    }}
    onPaste={(event) => {
      const files = [...event.clipboardData.items].filter((item) => item.kind === "file").map((item) => item.getAsFile()).filter(Boolean);
      if (files.length) {
        event.preventDefault();
        addFiles(files).catch((error) => alert(error.message));
      }
    }}
  >
    <header><b>{label}</b><span>text, image, drawing, or mixed</span></header>
    <textarea
      aria-label={`${label} text`}
      rows="4"
      value={side.text}
      maxLength={BEFORE_AFTER_LIMITS.textLength}
      placeholder={label === "Before" ? "Paste or type the starting material…" : "Paste or type the transformed result…"}
      onChange={(event) => onChange({ ...side, text: event.target.value })}
    />
    {!!side.assets.length && <div className="ba-assets">{side.assets.map((asset, index) =>
      asset.kind === "drawing"
        ? <div className="ba-asset" key={asset.id}><span>Editable drawing · {asset.strokes.length} strokes</span><button type="button" aria-label={`Remove ${label} drawing`} onClick={() => onChange({ ...side, assets: side.assets.filter((_, at) => at !== index) })}>×</button></div>
        : <div className="ba-asset" key={asset.id}><img src={asset.dataUrl} alt={`${label} upload preview`} /><button type="button" aria-label={`Remove ${label} image`} onClick={() => onChange({ ...side, assets: side.assets.filter((_, at) => at !== index) })}>×</button></div>
    )}</div>}
    {drawing && <InkPad value={drawingAsset} onChange={(asset) => onChange({ ...side, assets: [...side.assets.filter((item) => item.kind !== "drawing"), asset] })} />}
    <footer>
      <input ref={inputRef} hidden type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={(event) => addFiles(event.target.files).catch((error) => alert(error.message))} />
      <button type="button" onClick={() => inputRef.current?.click()}>Add image</button>
      <button type="button" aria-pressed={drawing} onClick={() => setDrawing((value) => !value)}>{drawing ? "Hide drawing" : "Draw"}</button>
    </footer>
  </section>;
}

export default function BeforeAfterLensEditor({ initial, onUse }) {
  const [examples, setExamples] = useState(() => normalizeBeforeAfterExamples(initial || { examples: [emptyExample()] }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const controllerRef = useRef(null);
  const completeCount = useMemo(() => examples.examples.filter((example) => sideHasContent(example.before) && sideHasContent(example.after)).length, [examples]);

  function patchExample(index, patch) {
    setExamples((current) => ({ ...current, updatedAt: Date.now(), examples: current.examples.map((example, at) => at === index ? { ...example, ...patch } : example) }));
  }

  async function infer() {
    const validation = validateBeforeAfterExamples(examples, { requireComplete: true });
    if (!validation.ok) return setError(validation.error);
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/infer-transformation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.value),
        signal: controller.signal,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Inference failed");
      setResult(body.specification);
      return body.specification;
    } catch (requestError) {
      if (requestError.name !== "AbortError") setError(`${requestError.message}. Your examples are preserved; retry.`);
    } finally {
      if (controllerRef.current === controller) setBusy(false);
    }
  }

  function useAlternative(alternative) {
    setResult((current) => ({ ...current, name: alternative.name, operation: alternative.operation, summary: alternative.rationale || current.summary }));
  }

  useEffect(() => {
    function direct(event) {
      const action = event.detail || {};
      const index = Math.max(0, Math.min(examples.examples.length - 1, Number(action.example) || 0));
      try {
        if (action.type === "set-text") {
          const sideName = action.side === "after" ? "after" : "before";
          const example = examples.examples[index];
          patchExample(index, { [sideName]: { ...example[sideName], text: String(action.text || "").slice(0, BEFORE_AFTER_LIMITS.textLength) } });
          action.resolve?.({ example: index, side: sideName });
        } else if (action.type === "attach-object") {
          const sideName = action.side === "after" ? "after" : "before";
          const example = examples.examples[index];
          patchExample(index, {
            [sideName]: {
              ...example[sideName],
              objectRefs: [...example[sideName].objectRefs, {
                id: String(action.object?.id || uid()),
                type: String(action.object?.type || "selection"),
                label: String(action.object?.label || "").slice(0, 160),
              }].slice(0, BEFORE_AFTER_LIMITS.assetsPerSide),
              text: action.object?.text ? `${example[sideName].text}${example[sideName].text ? "\n" : ""}${action.object.text}`.slice(0, BEFORE_AFTER_LIMITS.textLength) : example[sideName].text,
            },
          });
          action.resolve?.({ example: index, side: sideName });
        } else if (action.type === "add-example") {
          setExamples((current) => ({ ...current, examples: [...current.examples, emptyExample()].slice(0, BEFORE_AFTER_LIMITS.examples) }));
          action.resolve?.({ example: examples.examples.length });
        } else if (action.type === "remove-example") {
          if (examples.examples.length > 1) setExamples((current) => ({ ...current, examples: current.examples.filter((_, at) => at !== index) }));
          action.resolve?.({ removed: index });
        } else if (action.type === "infer") {
          infer().then(action.resolve, action.reject);
        } else if (action.type === "choose-alternative") {
          const alternative = result?.alternatives?.[Math.max(0, Number(action.alternative) || 0)];
          if (!alternative) throw new Error("alternative was not found");
          useAlternative(alternative);
          action.resolve?.({ alternative: alternative.name });
        } else if (action.type === "edit-spec") {
          if (!result) throw new Error("infer a transformation first");
          setResult((current) => ({ ...current, ...(action.patch || {}) }));
          action.resolve?.({ edited: true });
        } else if (action.type === "use") {
          if (!result) throw new Error("infer a transformation first");
          onUse(inferenceResultToOperator(result, examples));
          action.resolve?.({ used: true });
        }
      } catch (error) {
        action.reject?.(error);
      }
    }
    window.addEventListener("lens:before-after", direct);
    return () => window.removeEventListener("lens:before-after", direct);
  }, [examples, result]);

  return <div className="ba-editor" data-before-after-editor>
    <div className="ba-intro">
      <div><strong>Learn from before &amp; after</strong><p>Show the change once. Add examples when the rule needs disambiguation.</p></div>
      <span>{completeCount} complete pair{completeCount === 1 ? "" : "s"}</span>
    </div>
    <div className="ba-example-list">{examples.examples.map((example, index) => <article className="ba-example" key={example.id}>
      <div className="ba-example-head">
        <b>Example {index + 1}</b>
        <label><input type="checkbox" checked={example.counterexample} onChange={(event) => patchExample(index, { counterexample: event.target.checked })} /> Counterexample</label>
        <div>
          <button type="button" disabled={!index} aria-label="Move example up" onClick={() => setExamples((current) => {
            const next = [...current.examples]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return { ...current, examples: next };
          })}>↑</button>
          <button type="button" disabled={index === examples.examples.length - 1} aria-label="Move example down" onClick={() => setExamples((current) => {
            const next = [...current.examples]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; return { ...current, examples: next };
          })}>↓</button>
          <button type="button" disabled={examples.examples.length === 1} onClick={() => setExamples((current) => ({ ...current, examples: current.examples.filter((_, at) => at !== index) }))}>Remove</button>
        </div>
      </div>
      <div className="ba-pair">
        <ExampleSlot label="Before" side={example.before} onChange={(before) => patchExample(index, { before })} />
        <span className="ba-arrow" aria-hidden="true">→</span>
        <ExampleSlot label="After" side={example.after} onChange={(after) => patchExample(index, { after })} />
      </div>
    </article>)}</div>
    <div className="ba-actions">
      <button type="button" disabled={examples.examples.length >= BEFORE_AFTER_LIMITS.examples} onClick={() => setExamples((current) => ({ ...current, examples: [...current.examples, emptyExample()] }))}>+ Add another example</button>
      {busy && <button type="button" onClick={() => controllerRef.current?.abort()}>Cancel inference</button>}
      <button className="fn-generate" type="button" disabled={busy || !completeCount} onClick={infer}>{busy ? "Inferring…" : result ? "Re-infer" : "Infer transformation"}</button>
    </div>
    {error && <div className="fn-error" role="alert">{error}</div>}
    {result && <section className="ba-result" aria-label="Inferred transformation preview">
      <div className="ba-confidence"><b>I think this transformation is…</b><span>{Math.round(result.confidence * 100)}% confidence</span></div>
      <label>Name<input value={result.name} onChange={(event) => setResult({ ...result, name: event.target.value })} /></label>
      <label>Reusable operation<textarea rows="6" value={result.operation} onChange={(event) => setResult({ ...result, operation: event.target.value })} /></label>
      <label>Summary<textarea rows="2" value={result.summary} onChange={(event) => setResult({ ...result, summary: event.target.value })} /></label>
      {!!result.invariants.length && <p><b>Preserves:</b> {result.invariants.join(" · ")}</p>}
      {!!result.changes.length && <p><b>Changes:</b> {result.changes.join(" · ")}</p>}
      {result.ambiguity && <p><b>Ambiguity:</b> {result.ambiguity}</p>}
      {!!result.alternatives.length && <div className="ba-alternatives"><b>Other plausible transformations</b>{result.alternatives.map((alternative) =>
        <button type="button" key={alternative.name} onClick={() => useAlternative(alternative)}><strong>{alternative.name}</strong><span>{alternative.rationale}</span></button>
      )}</div>}
      <div className="ba-result-actions">
        <button type="button" onClick={() => setExamples((current) => ({ ...current, examples: [...current.examples, emptyExample()] }))}>Refine with another example</button>
        <button className="fn-primary" type="button" onClick={() => onUse(inferenceResultToOperator(result, examples))}>Use this</button>
      </div>
    </section>}
  </div>;
}
