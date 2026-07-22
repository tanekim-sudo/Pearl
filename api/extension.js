import {
  extensionArtifact,
  extensionExecute,
  extensionGenerator,
  extensionLibrary,
} from "../server/extension-api.js";
import { serverlessExtension } from "../server/serverless-extension.js";

/** Single extension API entrypoint — keeps Vercel Hobby under the 12-function cap. */
const ROUTES = {
  library: { handler: extensionLibrary, methods: ["GET", "POST"], maxBytes: 10 * 1024 * 1024 },
  execute: { handler: extensionExecute, methods: ["POST"], maxBytes: 512_000 },
  artifacts: { handler: extensionArtifact, methods: ["POST", "DELETE"], maxBytes: 512_000 },
  generators: { handler: extensionGenerator, methods: ["POST"], maxBytes: 256_000 },
};

export default async function handler(req, res) {
  const route = String(req.query?.route || "");
  const config = ROUTES[route];
  if (!config) {
    return res.status(404).json({ error: "Unknown extension route" });
  }
  return serverlessExtension(config.handler, {
    methods: config.methods,
    maxBytes: config.maxBytes,
  })(req, res);
}
