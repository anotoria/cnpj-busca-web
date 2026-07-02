import { restHeaders, restUrl } from "../../../lib/supabase";

export const dynamic = "force-dynamic";

// Autocomplete de municípios: /api/municipios?q=camp → até 20 nomes.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = String(searchParams.get("q") || "").trim().replace(/,/g, "");
    if (q.length < 2) return Response.json({ rows: [] });

    const p = new URLSearchParams();
    p.set("select", "codigo,descricao");
    p.append("descricao", `ilike.*${q}*`);
    p.append("order", "descricao.asc");
    p.set("limit", "20");

    const res = await fetch(restUrl(`municipios?${p.toString()}`), {
      headers: restHeaders(),
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text();
      return Response.json({ error: `PostgREST ${res.status}: ${body}` }, { status: 502 });
    }
    const rows = await res.json();
    return Response.json({ rows });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
