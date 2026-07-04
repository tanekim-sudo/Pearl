import { PAPER_WIDTH, PAPER_HEIGHT, describeStroke } from "./lib/paper.js";

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

const SpeechRecognition =
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

export class PaperRecordSession {
  constructor() {
    this.id = uid();
    this.startedAt = Date.now();
    this.sessionStartMs = this.startedAt;
    this.recording = false;
    this.audioChunks = [];
    this.voiceSegments = [];
    this.strokes = [];
    this.transcript = "";
    this._currentSegment = null;
    this._mediaRecorder = null;
    this._audioStream = null;
    this._speechRecognition = null;
    this._audioContext = null;
    this._analyser = null;
    this._waveformRaf = null;
    this._onWaveform = null;
    this._pendingStroke = null;
  }

  elapsedMs() {
    return Date.now() - this.sessionStartMs;
  }

  _startWaveformLoop() {
    if (!this._analyser || !this._onWaveform) return;
    const data = new Uint8Array(this._analyser.frequencyBinCount);
    const tick = () => {
      if (!this.recording) return;
      this._analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const level = sum / data.length / 255;
      this._onWaveform(level);
      this._waveformRaf = requestAnimationFrame(tick);
    };
    this._waveformRaf = requestAnimationFrame(tick);
  }

  _stopWaveformLoop() {
    if (this._waveformRaf) cancelAnimationFrame(this._waveformRaf);
    this._waveformRaf = null;
  }

  _openVoiceSegment(text = "") {
    const startMs = this.elapsedMs();
    this._currentSegment = { startMs, endMs: startMs, text };
    this.voiceSegments.push(this._currentSegment);
  }

  _closeVoiceSegment() {
    if (this._currentSegment) {
      this._currentSegment.endMs = this.elapsedMs();
      this._currentSegment = null;
    }
  }

  async start({ onWaveform } = {}) {
    if (this.recording) return;
    this._onWaveform = onWaveform || null;
    this.recording = true;
    this.sessionStartMs = Date.now();
    this.startedAt = this.sessionStartMs;

    try {
      this._audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this._audioContext = new AudioContext();
      const source = this._audioContext.createMediaStreamSource(this._audioStream);
      this._analyser = this._audioContext.createAnalyser();
      this._analyser.fftSize = 64;
      source.connect(this._analyser);
      this._startWaveformLoop();

      const mime =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      this._mediaRecorder = mime
        ? new MediaRecorder(this._audioStream, { mimeType: mime })
        : new MediaRecorder(this._audioStream);
      this._mediaRecorder.ondataavailable = (e) => {
        if (e.data?.size) this.audioChunks.push(e.data);
      };
      this._mediaRecorder.start(250);
    } catch (err) {
      this.recording = false;
      throw new Error(err?.message || "microphone access denied");
    }

    if (SpeechRecognition) {
      try {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = navigator.language || "en-US";
        rec.onresult = (event) => {
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const r = event.results[i];
            const txt = r[0]?.transcript?.trim() || "";
            if (!txt) continue;
            if (r.isFinal) {
              this._closeVoiceSegment();
              this._openVoiceSegment(txt);
              this.transcript = (this.transcript ? this.transcript + " " : "") + txt;
            } else {
              interim = txt;
            }
          }
          if (interim && this._currentSegment) {
            this._currentSegment.text = interim;
          } else if (interim && !this._currentSegment) {
            this._openVoiceSegment(interim);
          }
        };
        rec.onend = () => {
          if (this.recording) {
            try {
              rec.start();
            } catch {
              /* ignore restart race */
            }
          }
        };
        rec.start();
        this._speechRecognition = rec;
        this._openVoiceSegment("");
      } catch {
        /* speech optional */
      }
    }
  }

  beginStroke(meta) {
    this._pendingStroke = {
      id: meta.id || uid(),
      color: meta.color,
      width: meta.width,
      marker: !!meta.marker,
      highlight: !!meta.highlight,
      points: [],
    };
    return this._pendingStroke.id;
  }

  addPoint(x, y) {
    if (!this._pendingStroke) return;
    this._pendingStroke.points.push({
      x,
      y,
      t: this.elapsedMs(),
    });
  }

  commitStroke() {
    if (!this._pendingStroke || this._pendingStroke.points.length < 2) {
      this._pendingStroke = null;
      return null;
    }
    const stroke = { ...this._pendingStroke };
    this.strokes.push(stroke);
    this._pendingStroke = null;
    return stroke;
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.recording) {
        resolve(this.toSession(null));
        return;
      }
      this.recording = false;
      this._closeVoiceSegment();
      this._stopWaveformLoop();

      const finish = async (audioBlob) => {
        if (this._speechRecognition) {
          try {
            this._speechRecognition.stop();
          } catch {
            /* ignore */
          }
          this._speechRecognition = null;
        }
        if (this._audioStream) {
          this._audioStream.getTracks().forEach((t) => t.stop());
          this._audioStream = null;
        }
        if (this._audioContext) {
          try {
            await this._audioContext.close();
          } catch {
            /* ignore */
          }
          this._audioContext = null;
        }
        resolve(this.toSession(audioBlob));
      };

      if (this._mediaRecorder && this._mediaRecorder.state !== "inactive") {
        this._mediaRecorder.onstop = async () => {
          const type = this._mediaRecorder.mimeType || "audio/webm";
          const blob = this.audioChunks.length
            ? new Blob(this.audioChunks, { type })
            : null;
          this._mediaRecorder = null;
          await finish(blob);
        };
        try {
          this._mediaRecorder.stop();
        } catch {
          finish(null);
        }
      } else {
        finish(null);
      }
    });
  }

  toSession(audioBlob) {
    const annotations = associateStrokesToVoice(this.strokes, this.voiceSegments);
    let audioUrl = null;
    if (audioBlob) {
      audioUrl = URL.createObjectURL(audioBlob);
    }
    return {
      id: this.id,
      startedAt: this.startedAt,
      audioBlob,
      audioUrl,
      transcript: this.transcript || null,
      voiceSegments: this.voiceSegments.map((s) => ({
        startMs: s.startMs,
        endMs: s.endMs,
        text: s.text || undefined,
      })),
      strokes: this.strokes,
      annotations,
      paperSize: { width: PAPER_WIDTH, height: PAPER_HEIGHT },
    };
  }
}

/** Link strokes drawn during a voice segment's time range to that speech. */
export function associateStrokesToVoice(strokes, voiceSegments) {
  const annotations = [];
  for (let i = 0; i < voiceSegments.length; i++) {
    const seg = voiceSegments[i];
    if (!seg.text?.trim() && seg.endMs - seg.startMs < 200) continue;
    const strokeIds = strokes
      .filter((s) => {
        if (!s.points?.length) return false;
        const firstT = s.points[0].t ?? 0;
        const lastT = s.points[s.points.length - 1].t ?? firstT;
        return (
          (firstT >= seg.startMs && firstT <= seg.endMs) ||
          (lastT >= seg.startMs && lastT <= seg.endMs) ||
          (firstT <= seg.startMs && lastT >= seg.endMs)
        );
      })
      .map((s) => s.id);
    if (strokeIds.length) {
      annotations.push({
        strokeIds,
        voiceSegmentIndex: i,
        instruction: seg.text || "",
      });
      for (const sid of strokeIds) {
        const stroke = strokes.find((s) => s.id === sid);
        if (stroke) {
          stroke.voiceSegmentIds = stroke.voiceSegmentIds || [];
          if (!stroke.voiceSegmentIds.includes(i)) stroke.voiceSegmentIds.push(i);
          if (seg.text?.trim() && !stroke.instructionText) {
            stroke.instructionText = seg.text.trim();
          }
        }
      }
    }
  }
  return annotations;
}

export function buildPaperInterpretPrompt(session, pageItems = []) {
  const strokeLines = (session?.strokes || [])
    .map((s) => `- ${describeStroke(s)}`)
    .join("\n");
  const pageStrokes = pageItems
    .filter((it) => it.type === "stroke")
    .map((s) => `- ${describeStroke(s)}`)
    .join("\n");
  const voiceLines = (session?.voiceSegments || [])
    .filter((v) => v.text?.trim())
    .map((v, i) => `[${v.startMs}–${v.endMs}ms] ${v.text}`)
    .join("\n");
  const annotLines = (session?.annotations || [])
    .map(
      (a) =>
        `- strokes ${a.strokeIds.join(", ")} ↔ voice #${a.voiceSegmentIndex}: "${a.instruction}"`
    )
    .join("\n");

  return `You are reading a multimodal notebook page (${PAPER_WIDTH}×${PAPER_HEIGHT}px).

Voice transcript:
${session?.transcript || "(none)"}

Voice segments (timestamped):
${voiceLines || "(none)"}

Recorded strokes this session:
${strokeLines || "(none)"}

All strokes on page:
${pageStrokes || "(none)"}

Voice↔stroke associations:
${annotLines || "(none)"}

Interpret what the user drew and said. Explain spatial meaning (arrows, circles, highlights) using voice as instructions. Be concise but insightful.`;
}
