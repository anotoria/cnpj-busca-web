import { searchCnaes, listCnaes } from "../../../lib/cnaes";

export const dynamic = "force-dynamic";

// Autocomplete de atividades/nichos: /api/cnaes?q=farmacia -> até 20 CNAEs.
// /api/cnaes?all=1 -> lista completa (para o seletor com filtro no front).
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("all") === "1") {
      const rows = await listCnaes();
      return Response.json({ rows });
    }
    const q = String(searchParams.get("q") || "").trim();
    if (q.length < 3) return Response.json({ rows: [] });
    const rows = await searchCnaes(q, 20);
    return Response.json({ rows });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
