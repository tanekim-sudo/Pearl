import { extensionGenerator } from "../../server/extension-api.js";
import { serverlessExtension } from "../../server/serverless-extension.js";

export default serverlessExtension(extensionGenerator, { methods: ["POST"], maxBytes: 256_000 });
