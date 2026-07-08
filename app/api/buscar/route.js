import { buildSearchParams, rpcBodyFromFilters, SELECT_COLUMNS } from "../../../lib/query";
import { restHeaders, restUrl, resolveMunicipioCodes, serviceHeaders } from "../../../lib/supabase";
import { resolveCnaeCodes } from "../../../lib/cnaes";
import { getAccess, blurContacts, hasFullAccess, DEMO_LIMIT } from "../../../lib/gate";
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
    telefone: searchParams.get("telefone") || "",
    email: searchParams.get("email") || "",
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = filtersFromRequest(searchParams);

    // Portão de acesso: define paginação máxima e se os contatos são visíveis.
    // Demo/modo leitura: anônimo, pendente e trial expirado (sem plano).
    const access = await getAccess();
    const isDemo = !hasFullAccess(access);

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
    let total = null; // contagem exata (só quando confiável)
    let estimativa = null; // estimativa do planejador (para exibição aproximada)
    let hasMore = false; // existe próxima página? (fonte da verdade da paginação)

    // Busca 1 linha a mais que a página para saber, com certeza, se há próxima.
    // Tenta primeiro com anon (timeout curto de 3s = falha rápida em query ampla).
    const rangeHeaders = (extra) => ({
      Prefer: "count=planned",
      Range: `${offset}-${offset + pageSize}`,
      "Range-Unit": "items",
      ...extra,
    });

    function parseEstimativa(res) {
      const contentRange = res.headers.get("content-range") || "";
      const t = contentRange.includes("/") ? contentRange.split("/")[1] : null;
      return t === "*" || t === null ? null : parseInt(t, 10);
    }

    const res = await fetch(url, { headers: restHeaders(rangeHeaders()), cache: "no-store" });

    if (res.ok) {
      rows = await res.json();
      estimativa = parseEstimativa(res);
    } else {
      const body = await res.text();
      if (!body.includes("57014")) {
        return Response.json({ error: `PostgREST ${res.status}: ${body}` }, { status: 502 });
      }
      // Timeout de 3s. Busca textual → RPC indexado; senão → repete com a
      // service key (sem o teto de 3s), que dá conta de filtros amplos.
      if (filters.termo) {
        const rpcRes = await fetch(restUrl(`rpc/busca_por_termo?select=${SELECT_COLUMNS.join(",")}`), {
          method: "POST",
          headers: serviceHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(rpcBodyFromFilters(filters, pageSize + 1, offset)),
          cache: "no-store",
        });
        if (!rpcRes.ok) {
          return Response.json({ error: `PostgREST ${rpcRes.status}: ${await rpcRes.text()}` }, { status: 502 });
        }
        rows = await rpcRes.json();
      } else {
        const res2 = await fetch(url, { headers: serviceHeaders(rangeHeaders()), cache: "no-store" });
        if (!res2.ok) {
          const b2 = await res2.text();
          if (b2.includes("57014")) {
            return Response.json(
              { error: "A busca ficou muito ampla e excedeu o tempo limite. Refine com UF, município ou atividade/nicho." },
              { status: 504 }
            );
          }
          return Response.json({ error: `PostgREST ${res2.status}: ${b2}` }, { status: 502 });
        }
        rows = await res2.json();
        estimativa = parseEstimativa(res2);
      }
    }

    // hasMore: veio mais que a página → há próxima. Corta o excedente.
    hasMore = rows.length > pageSize;
    if (hasMore) rows = rows.slice(0, pageSize);

    // Contagem honesta: na última página sabemos o total exato.
    if (!hasMore) total = offset + rows.length;

    // Demo: só a 1ª página, nunca "próxima".
    if (isDemo) hasMore = false;

    // Demo: oculta contatos.
    if (isDemo) rows = blurContacts(rows);

    // Log (best-effort). Só registra a página 1 para não inflar em paginação.
    if (page === 1) {
      logSearch({
        user_id: access.userId,
        tipo: "busca",
        filtros: filters,
        total_resultados: total ?? estimativa,
        anonimo: access.level === "anon",
      });
    }

    return Response.json({ rows, page, pageSize, total, estimativa, hasMore, demo: isDemo, level: access.level });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
