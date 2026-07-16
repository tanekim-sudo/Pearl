import { getModelCatalog } from "../server/model-catalog.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const catalog = await getModelCatalog();
  res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");
  res.status(200).json(catalog);
}
