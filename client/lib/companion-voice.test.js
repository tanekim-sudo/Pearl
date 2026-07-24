import test from "node:test";
import assert from "node:assert/strict";

import { createCompanionSubmitGuard } from "./companion-submit.js";
import { createCompanionVoiceSession } from "./companion-voice.js";

function result(transcript, isFinal) {
  return Object.assign([{ transcript }], { isFinal });
}

test("interim, final replay, end, and restart dispatch exactly once", () => {
  const runs = [];
  const guard = createCompanionSubmitGuard();
  const dispatch = (text, envelope) => {
    const run = guard.begin(text, envelope);
    if (run) runs.push(run);
  };
  const session = createCompanionVoiceSession({ generation: 4, dispatch, makeId: () => "one" });
  session.ingest({ resultIndex: 0, results: [result("delete everything", false)] }, 4);
  session.ingest({ resultIndex: 0, results: [result("delete everything in the Whiteboard", true)] }, 4);
  session.ingest({ resultIndex: 0, results: [result("delete everything in the Whiteboard", true)] }, 4);
  session.finish({ send: true });
  session.finish({ send: true });
  assert.equal(runs.length, 1);
  assert.equal(runs[0].text, "delete everything in the Whiteboard");
  assert.equal(runs[0].utteranceId, "voice-4-one");
});

test("silence and mic-tap race consumes one utterance", () => {
  let timer;
  const dispatched = [];
  const session = createCompanionVoiceSession({
    generation: 1,
    dispatch: (...args) => dispatched.push(args),
    makeId: () => "race",
    setTimer: (fn) => {
      timer = fn;
      return 1;
    },
    clearTimer: () => {},
  });
  session.ingest({ results: [result("make a lens", true)], resultIndex: 0 }, 1);
  session.finish({ send: true });
  timer();
  assert.equal(dispatched.length, 1);
});

test("stale sessions are inert and genuine later identical utterances run", () => {
  const guard = createCompanionSubmitGuard();
  const runs = [];
  const dispatch = (text, envelope) => {
    const run = guard.begin(text, envelope);
    if (run) {
      runs.push(run);
      guard.finish(run.id);
    }
  };
  const old = createCompanionVoiceSession({ generation: 1, dispatch, makeId: () => "old" });
  old.finish({ send: false });
  assert.equal(old.ingest({ results: [result("clear canvas", true)], resultIndex: 0 }, 1), false);

  for (const [generation, id] of [[2, "first"], [3, "second"]]) {
    const session = createCompanionVoiceSession({ generation, dispatch, makeId: () => id });
    session.ingest({ results: [result("clear canvas", true)], resultIndex: 0 }, generation);
    session.finish({ send: true });
  }
  assert.equal(runs.length, 2);
  assert.notEqual(runs[0].utteranceId, runs[1].utteranceId);
});

test("empty explicit finish reports empty envelope instead of silent no-op", () => {
  const dispatched = [];
  const session = createCompanionVoiceSession({
    generation: 9,
    dispatch: (...args) => dispatched.push(args),
    makeId: () => "empty",
  });
  session.finish({ send: true, reason: "explicit" });
  assert.equal(dispatched.length, 1);
  assert.equal(dispatched[0][0], "");
  assert.equal(dispatched[0][1].empty, true);
});

test("interim pauses preserve the full multi-phrase utterance until finalization", () => {
  const dispatched = [];
  const session = createCompanionVoiceSession({
    generation: 8,
    dispatch: (text) => dispatched.push(text),
    makeId: () => "slow",
    setTimer: () => 1,
    clearTimer: () => {},
  });
  session.ingest({ results: [result("build an investment memo", true)], resultIndex: 0 }, 8);
  session.ingest({ results: [result("with a market step", false)], resultIndex: 0 }, 8);
  assert.equal(session.text(), "build an investment memo with a market step");
  session.ingest({ results: [result("with a market step", true)], resultIndex: 0 }, 8);
  session.finish({ send: true });
  assert.deepEqual(dispatched, ["build an investment memo with a market step"]);
});
