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

    // Termo muito curto não usa o índice trigram e varre a base inteira —
    // estoura o tempo limite da Vercel e volta uma página de erro em texto.
    if (filters.termo && filters.termo.trim().length < 3) {
      return Response.json(
        { error: "Digite pelo menos 3 letras no campo de busca (ou deixe-o vazio e use os filtros)." },
        { status: 400 }
      );
    }

    // Portão de acesso: define paginação máxima e se os contatos são visíveis.
    // Demo/modo leitura: anônimo, pendente e trial expirado (sem plano).
    const access = await getAccess();
    const isDemo = !hasFullAccess(access);

    if (filters.municipio) {
      const codes = await resolveMunicipioCodes(filters.municipio);
      if (codes && codes.length === 0) {
        return Response.json({
          rows: [], page: 1, pageSize: 0, total: 0, demo: isDemo,
          aviso: `Nenhum município corresponde a "${filters.municipio}". Escolha um da lista de sugestões.`,
        });
      }
      if (codes) filters.municipioCodes = codes;
    }

    if (filters.cnae) {
      const codes = await resolveCnaeCodes(filters.cnae);
      if (codes && codes.length === 0) {
        return Response.json({
          rows: [], page: 1, pageSize: 0, total: 0, demo: isDemo,
          aviso: `Nenhuma atividade corresponde a "${filters.cnae}". Clique no campo Atividade/Nicho e escolha uma opção da lista.`,
        });
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

    // PGRST103 (416): o offset pedido passou do fim real da consulta. Sem ORDER BY
    // (necessário para não estourar o timeout ordenando milhões de linhas), a
    // contagem exata pode variar entre chamadas — trata como "não há mais linhas"
    // em vez de estourar um erro pro usuário.
    function semMaisLinhas(status, body) {
      return status === 416 || body.includes("PGRST103");
    }

    if (filters.termo) {
      // Busca textual: só o RPC usa o índice trigram. A query direta na view
      // quase sempre estoura o timeout — e quando não estoura, sem ORDER BY,
      // pode achar um conjunto/contagem diferente do RPC, quebrando a paginação
      // entre páginas. Vai direto pro caminho indexado, sempre.
      const rpcRes = await fetch(restUrl(`rpc/busca_por_termo?select=${SELECT_COLUMNS.join(",")}`), {
        method: "POST",
        headers: serviceHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(rpcBodyFromFilters(filters, pageSize + 1, offset)),
        cache: "no-store",
      });
      if (!rpcRes.ok) {
        const body = await rpcRes.text();
        if (!semMaisLinhas(rpcRes.status, body)) {
          return Response.json({ error: `PostgREST ${rpcRes.status}: ${body}` }, { status: 502 });
        }
      } else {
        rows = await rpcRes.json();
      }
    } else {
      const res = await fetch(url, { headers: restHeaders(rangeHeaders()), cache: "no-store" });

      if (res.ok) {
        rows = await res.json();
        estimativa = parseEstimativa(res);
      } else {
        const body = await res.text();
        if (semMaisLinhas(res.status, body)) {
          // rows fica []
        } else if (!body.includes("57014")) {
          return Response.json({ error: `PostgREST ${res.status}: ${body}` }, { status: 502 });
        } else {
          // Timeout de 3s. Repete com a service key (sem o teto de 3s), que dá
          // conta de filtros amplos.
          const res2 = await fetch(url, { headers: serviceHeaders(rangeHeaders()), cache: "no-store" });
          if (!res2.ok) {
            const b2 = await res2.text();
            if (semMaisLinhas(res2.status, b2)) {
              // rows fica []
            } else if (b2.includes("57014")) {
              return Response.json(
                { error: "A busca ficou muito ampla e excedeu o tempo limite. Refine com UF, município ou atividade/nicho." },
                { status: 504 }
              );
            } else {
              return Response.json({ error: `PostgREST ${res2.status}: ${b2}` }, { status: 502 });
            }
          } else {
            rows = await res2.json();
            estimativa = parseEstimativa(res2);
          }
        }
      }
    }

    // hasMore: veio mais que a página → há próxima. Corta o excedente.
    hasMore = rows.length > pageSize;
    if (hasMore) rows = rows.slice(0, pageSize);

    // Contagem honesta: na última página sabemos o total exato.
    if (!hasMore) total = offset + rows.length;

    // "count=planned" é só uma estimativa do planner do Postgres e pode vir bem
    // menor que o real em buscas com ilike — nunca mostra menos do que já
    // sabemos de fato que existe (offset + linhas que vieram nesta página).
    if (total == null) {
      const conhecidoNoMinimo = offset + rows.length;
      if (estimativa == null || estimativa < conhecidoNoMinimo) estimativa = conhecidoNoMinimo;
    }

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
