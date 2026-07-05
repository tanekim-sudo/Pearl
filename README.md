# Lens

Create prompt **symbols**, then drag a symbol onto your text to transform it with open models via Hugging Face Inference Providers.

- **Make a symbol** — give it a name, icon, color, and a prompt (e.g. "Summarize", "Fix grammar", "Translate to French").
- **Drop it on text** — type/paste text, optionally select part of it, then drag a symbol onto the text box. The model runs the prompt on that text.
- **Apply the result** — replace the text (or just the selection) with the model's output, or copy it.

Symbols are saved in your browser (localStorage). Your API token stays on the server.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Add your Hugging Face token (create one at https://huggingface.co/settings/tokens/new with "Make calls to Inference Providers"):

   ```bash
   cp .env.example .env
   # then edit .env and set HF_TOKEN=hf_...
   ```

3. Run it (starts the API server + the web app):

   ```bash
   npm run dev
   ```

   Open the app at http://localhost:5173

## Production (self-hosted)

```bash
npm run build   # builds the web app into ./dist
npm start       # serves the app + API on http://localhost:8787
```

## Deploy to Vercel

This repo is Vercel-ready. The web app is built statically and the backend runs
as serverless functions in `api/` (`/api/run`, `/api/health`).

1. Import the GitHub repo into Vercel (or run `vercel`).
2. Add an Environment Variable in **Project Settings → Environment Variables**:

   | Name       | Value                        |
   | ---------- | ---------------------------- |
   | `HF_TOKEN` | your Hugging Face API token  |

   (Optionally also set `HF_MODEL`, `HF_VISION_MODEL`, or `HF_PROVIDER`.)
3. Deploy. Vercel uses `vercel.json`: build command `npm run build`, output `dist`.

**Production URL:** [https://representation-eta.vercel.app](https://representation-eta.vercel.app)

> **Note:** `representation.vercel.app` is a different, unrelated Vercel project
> (an old Create React App). This repo deploys to the `representation` project
> under `tane-kims-projects`, aliased to `representation-eta.vercel.app`.

> Never put your API token in the code or commit it. Set it only in Vercel's
> Environment Variables (or your local `.env`, which is gitignored).

## Configuration

Set these in `.env`:

| Variable          | Default                              | Description                                        |
| ----------------- | ------------------------------------ | -------------------------------------------------- |
| `HF_TOKEN`        | _(required)_                         | Your Hugging Face API token                        |
| `HF_MODEL`        | `Qwen/Qwen2.5-72B-Instruct:fastest`  | Text model (policy suffixes: `:fastest` etc.)      |
| `HF_VISION_MODEL` | `Qwen/Qwen2.5-VL-7B-Instruct:fastest`| Model used when a canvas item includes an image    |
| `HF_PROVIDER`     | _(auto)_                             | Force a specific inference provider (e.g. `groq`)  |
| `PORT`            | `8787`                               | API server port                                    |
