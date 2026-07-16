import { hasKey, MODEL, VISION_MODEL } from "../server/llm.js";
import { modelGateway } from "../server/model-gateway.js";

export default function handler(_req, res) {
  res.status(200).json({
    ok: true,
    hasKey: hasKey(),
    model: MODEL,
    visionModel: VISION_MODEL,
    modelGateway: modelGateway.configuration(),
  });
}
