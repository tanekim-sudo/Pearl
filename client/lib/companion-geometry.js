function dimensions(object) {
  if (object.box) {
    return {
      width: Math.max(1, object.box.maxx - object.box.minx),
      height: Math.max(1, object.box.maxy - object.box.miny),
    };
  }
  return {
    width: Math.max(1, Number(object.width || object.w) || 180),
    height: Math.max(1, Number(object.height || object.h) || 80),
  };
}

function origin(object) {
  return object.box
    ? { x: object.box.minx, y: object.box.miny }
    : { x: Number(object.x) || 0, y: Number(object.y) || 0 };
}

export function layoutObjects(objects, mode, options = {}) {
  if (!Array.isArray(objects) || !objects.length) return [];
  const gap = Math.max(0, Number(options.gap) || 28);
  const anchor = options.anchor || origin(objects[0]);
  const entries = objects.map((object) => ({ object, ...dimensions(object), ...origin(object) }));
  const placements = [];

  if (mode === "align") {
    const axis = options.axis || "left";
    const value =
      options.value ??
      (axis === "top" || axis === "bottom"
        ? Math.min(...entries.map((entry) => entry.y))
        : Math.min(...entries.map((entry) => entry.x)));
    return entries.map((entry) => ({
      id: entry.object.id,
      x: axis === "left" ? value : axis === "right" ? value - entry.width : entry.x,
      y: axis === "top" ? value : axis === "bottom" ? value - entry.height : entry.y,
    }));
  }

  if (mode === "distribute") {
    const axis = options.axis || "horizontal";
    const sorted = [...entries].sort((a, b) => (axis === "horizontal" ? a.x - b.x : a.y - b.y));
    let cursor = axis === "horizontal" ? anchor.x : anchor.y;
    for (const entry of sorted) {
      placements.push({
        id: entry.object.id,
        x: axis === "horizontal" ? cursor : entry.x,
        y: axis === "vertical" ? cursor : entry.y,
      });
      cursor += (axis === "horizontal" ? entry.width : entry.height) + gap;
    }
    return placements;
  }

  if (mode === "stack") {
    const axis = options.axis || "vertical";
    let cursor = axis === "horizontal" ? anchor.x : anchor.y;
    for (const entry of entries) {
      placements.push({
        id: entry.object.id,
        x: axis === "horizontal" ? cursor : anchor.x,
        y: axis === "vertical" ? cursor : anchor.y,
      });
      cursor += (axis === "horizontal" ? entry.width : entry.height) + gap;
    }
    return placements;
  }

  if (mode === "grid" || mode === "cluster") {
    const columns = Math.max(1, Math.min(entries.length, Number(options.columns) || Math.ceil(Math.sqrt(entries.length))));
    const columnWidths = new Array(columns).fill(0);
    entries.forEach((entry, index) => {
      columnWidths[index % columns] = Math.max(columnWidths[index % columns], entry.width);
    });
    const rowHeights = [];
    entries.forEach((entry, index) => {
      const row = Math.floor(index / columns);
      rowHeights[row] = Math.max(rowHeights[row] || 0, entry.height);
    });
    const columnX = [];
    let x = anchor.x;
    for (const width of columnWidths) {
      columnX.push(x);
      x += width + gap;
    }
    const rowY = [];
    let y = anchor.y;
    for (const height of rowHeights) {
      rowY.push(y);
      y += height + gap;
    }
    return entries.map((entry, index) => ({
      id: entry.object.id,
      x: columnX[index % columns],
      y: rowY[Math.floor(index / columns)],
    }));
  }

  if (mode === "move-relative") {
    const dx = Number(options.dx) || 0;
    const dy = Number(options.dy) || 0;
    return entries.map((entry) => ({ id: entry.object.id, x: entry.x + dx, y: entry.y + dy }));
  }

  throw new Error(`unsupported layout mode "${mode}"`);
}

export function avoidOverlaps(placements, objects, { gap = 20, maxPasses = 20 } = {}) {
  const sizes = new Map(objects.map((object) => [object.id, dimensions(object)]));
  const next = placements.map((placement) => ({ ...placement }));
  const overlaps = (a, b) => {
    const as = sizes.get(a.id) || { width: 1, height: 1 };
    const bs = sizes.get(b.id) || { width: 1, height: 1 };
    return (
      a.x < b.x + bs.width + gap &&
      a.x + as.width + gap > b.x &&
      a.y < b.y + bs.height + gap &&
      a.y + as.height + gap > b.y
    );
  };
  for (let pass = 0; pass < maxPasses; pass += 1) {
    let moved = false;
    for (let i = 0; i < next.length; i += 1) {
      for (let j = i + 1; j < next.length; j += 1) {
        if (!overlaps(next[i], next[j])) continue;
        const height = sizes.get(next[i].id)?.height || 1;
        next[j].y = next[i].y + height + gap;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return next;
}
