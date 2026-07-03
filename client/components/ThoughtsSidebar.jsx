import React from "react";
import { buildThoughtsFeed } from "../lib/thoughts.js";
import { WORLDS } from "../lib/worlds.js";

export default function ThoughtsSidebar({
  items,
  activePageId,
  worldFilter,
  onSelectThought,
  onNewThought,
  onSelectWorld,
  onClearWorld,
}) {
  const groups = buildThoughtsFeed(items, { pageId: activePageId, worldFilter });

  return (
    <aside className="idea-sidebar">
      <section className="sidebar-section">
        <h2 className="sidebar-heading">Thoughts</h2>
        <div className="thoughts-feed">
          {groups.length === 0 ? (
            <p className="sidebar-empty">No thoughts yet — add something to the canvas.</p>
          ) : (
            groups.map((group) => (
              <div key={group.id} className="thought-group">
                <div className="thought-group-label">{group.label}</div>
                {group.items.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className="thought-row"
                    onClick={() => onSelectThought(entry.item)}
                  >
                    <div className="thought-row-main">
                      {entry.thumb ? (
                        <img className="thought-thumb" src={entry.thumb} alt="" />
                      ) : entry.icon ? (
                        <span className="thought-icon">{entry.icon}</span>
                      ) : (
                        <span className="thought-dot" />
                      )}
                      <span className="thought-title">{entry.title}</span>
                    </div>
                    <span className="thought-time">{entry.time}</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
        <button type="button" className="sidebar-action" onClick={onNewThought}>
          + New thought
        </button>
      </section>

      <section className="sidebar-section worlds-section">
        <h2 className="sidebar-heading">Worlds</h2>
        <div className="worlds-list">
          <button
            type="button"
            className={"world-row" + (!worldFilter ? " active" : "")}
            onClick={onClearWorld}
          >
            <span className="world-dot all" />
            <span>All worlds</span>
          </button>
          {WORLDS.map((world) => (
            <button
              key={world.id}
              type="button"
              className={"world-row" + (worldFilter === world.id ? " active" : "")}
              onClick={() => onSelectWorld(world.id)}
            >
              <span className="world-dot" style={{ background: world.color }} />
              <span>{world.name}</span>
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}
