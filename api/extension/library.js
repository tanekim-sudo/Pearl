import { extensionLibrary } from "../../server/extension-api.js";
import { serverlessExtension } from "../../server/serverless-extension.js";

export default serverlessExtension(extensionLibrary, { methods: ["GET", "POST"], maxBytes: 10 * 1024 * 1024 });
