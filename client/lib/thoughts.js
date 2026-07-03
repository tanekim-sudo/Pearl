const DAY = 86400000;

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function thoughtTitle(item) {
  if (item.title?.trim()) return item.title.trim();
  if (item.text?.trim()) {
    const line = item.text.trim().split("\n")[0];
    return line.length > 48 ? `${line.slice(0, 48)}…` : line;
  }
  const labels = {
    sticky: "Note",
    voice: "Voice note",
    callout: item.variant === "question" ? "Question" : "Observation",
    diagram: "Diagram",
    table: "Table",
    code: "Code",
    math: "Equation",
    video: "Video",
    image: "Image",
    stroke: "Sketch",
  };
  return labels[item.type] || "Thought";
}

function thoughtIcon(item) {
  const icons = {
    stroke: "✎",
    voice: "🎙",
    diagram: "◎",
    image: "🖼",
    video: "▶",
    math: "∑",
    table: "▦",
    code: "{ }",
    sticky: "▢",
    callout: item.variant === "question" ? "?" : "!",
  };
  return icons[item.type] || null;
}

export function buildThoughtsFeed(items, { pageId = null, worldFilter = null } = {}) {
  const now = Date.now();
  const todayStart = startOfDay(now);
  const yesterdayStart = todayStart - DAY;
  const weekStart = todayStart - 6 * DAY;

  const filtered = items.filter((it) => {
    if (it.type === "link") return false;
    const pid = it.pageId || "page-1";
    if (pageId && pid !== pageId) return false;
    if (worldFilter && it.world && it.world !== worldFilter) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => (b.bornAt || 0) - (a.bornAt || 0));

  const groups = [
    { id: "today", label: "Today", items: [] },
    { id: "yesterday", label: "Yesterday", items: [] },
    { id: "week", label: "This week", items: [] },
  ];

  for (const item of sorted) {
    const ts = item.bornAt || now;
    const entry = {
      id: item.id,
      item,
      title: thoughtTitle(item),
      time: formatTime(ts),
      icon: thoughtIcon(item),
      thumb: item.type === "image" ? item.src : null,
    };
    if (ts >= todayStart) groups[0].items.push(entry);
    else if (ts >= yesterdayStart) groups[1].items.push(entry);
    else if (ts >= weekStart) groups[2].items.push(entry);
  }

  return groups.filter((g) => g.items.length > 0);
}
