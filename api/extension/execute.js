import { extensionExecute } from "../../server/extension-api.js";
import { serverlessExtension } from "../../server/serverless-extension.js";

export default serverlessExtension(extensionExecute, { methods: ["POST"], maxBytes: 512_000 });
