import { buildSearchParams, rpcBodyFromFilters, SELECT_COLUMNS } from "../../../lib/query";
import { restHeaders, restUrl, resolveMunicipioCodes, serviceHeaders } from "../../../lib/supabase";
import { resolveCnaeCodes } from "../../../lib/cnaes";
import { getAccess, blurContacts, DEMO_LIMIT } from "../../../lib/gate";
import { logSearch } from "../../../lib/supabase-admin";

export const dynamic = "force-dynamic";
// Buscas textuais amplas podem demorar mais que o padrão da Vercel.
export const maxDuration = 60;

function filtersFromRequest(searchParams) {
  return {
    uf: searchParams.get("uf") || "",
    municipio: searchParams.get("municipio") || "",
    cnae: searchParams.get("cnae") || "",
    situacao: searchParams.get("situacao") || "",
    porte: searchParams.get("porte") || "",
    termo: searchParams.get("termo") || "",
    simples: searchParams.get("simples") === "1",
    mei: searchParams.get("mei") === "1",
    somenteMatriz: searchParams.get("somenteMatriz") === "1",
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = filtersFromRequest(searchParams);

    // Portão de acesso: define paginação máxima e se os contatos são visíveis.
    const access = await getAccess();
    const isDemo = access.level !== "approved";

    if (filters.municipio) {
      const codes = await resolveMunicipioCodes(filters.municipio);
      if (codes && codes.length === 0) {
        return Response.json({ rows: [], page: 1, pageSize: 0, total: 0, demo: isDemo });
      }
      if (codes) filters.municipioCodes = codes;
    }

    if (filters.cnae) {
      const codes = await resolveCnaeCodes(filters.cnae);
      if (codes && codes.length === 0) {
        return Response.json({ rows: [], page: 1, pageSize: 0, total: 0, demo: isDemo });
      }
      if (codes) filters.cnaeCodes = codes;
    }

    const reqPageSize = Math.min(parseInt(searchParams.get("pageSize") || "50", 10), 200);
    // Demo: no máximo 10 resultados e só a primeira página.
    const pageSize = isDemo ? DEMO_LIMIT : reqPageSize;
    const page = isDemo ? 1 : Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const offset = (page - 1) * pageSize;

    const p = buildSearchParams(filters);
    const url = restUrl(`vw_busca_empresas?${p.toString()}`);

    let rows = [];
    let total = null;

    const res = await fetch(url, {
      headers: restHeaders({
        Prefer: "count=planned",
        Range: `${offset}-${offset + pageSize - 1}`,
        "Range-Unit": "items",
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text();
      if (body.includes("57014") && filters.termo) {
        const rpcRes = await fetch(restUrl(`rpc/busca_por_termo?select=${SELECT_COLUMNS.join(",")}`), {
          method: "POST",
          headers: serviceHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(rpcBodyFromFilters(filters, pageSize, offset)),
          cache: "no-store",
        });
        if (!rpcRes.ok) {
          return Response.json({ error: `PostgREST ${rpcRes.status}: ${await rpcRes.text()}` }, { status: 502 });
        }
        rows = await rpcRes.json();
      } else if (body.includes("57014")) {
        return Response.json(
          { error: "A busca ficou muito ampla e excedeu o tempo limite. Refine com UF, município ou atividade/nicho." },
          { status: 504 }
        );
      } else {
        return Response.json({ error: `PostgREST ${res.status}: ${body}` }, { status: 502 });
      }
    } else {
      rows = await res.json();
      const contentRange = res.headers.get("content-range") || "";
      const t = contentRange.includes("/") ? contentRange.split("/")[1] : null;
      total = t === "*" || t === null ? null : parseInt(t, 10);
    }

    // Demo: oculta contatos.
    if (isDemo) rows = blurContacts(rows);

    // Log (best-effort). Só registra a página 1 para não inflar em paginação.
    if (page === 1) {
      logSearch({
        user_id: access.userId,
        tipo: "busca",
        filtros: filters,
        total_resultados: total,
        anonimo: access.level === "anon",
      });
    }

    return Response.json({ rows, page, pageSize, total, demo: isDemo, level: access.level });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
