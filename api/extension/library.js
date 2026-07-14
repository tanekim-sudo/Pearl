import { extensionLibrary } from "../../server/extension-api.js";
import { serverlessExtension } from "../../server/serverless-extension.js";

export default serverlessExtension(extensionLibrary, { methods: ["GET"], maxBytes: 8_192 });
