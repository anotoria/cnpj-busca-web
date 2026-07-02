import { searchCnaes } from "../../../lib/cnaes";

export const dynamic = "force-dynamic";

// Autocomplete de atividades/nichos: /api/cnaes?q=farmacia -> até 20 CNAEs.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = String(searchParams.get("q") || "").trim();
    if (q.length < 3) return Response.json({ rows: [] });
    const rows = await searchCnaes(q, 20);
    return Response.json({ rows });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
