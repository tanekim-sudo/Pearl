import { extensionArtifact } from "../../server/extension-api.js";
import { serverlessExtension } from "../../server/serverless-extension.js";

export default serverlessExtension(extensionArtifact, { methods: ["POST", "DELETE"], maxBytes: 512_000 });
