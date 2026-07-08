import { buildSearchParams, rpcBodyFromFilters, SELECT_COLUMNS } from "../../../lib/query";
import { restHeaders, restUrl, resolveMunicipioCodes, serviceHeaders } from "../../../lib/supabase";
import { resolveCnaeCodes } from "../../../lib/cnaes";
import { getAccess, hasFullAccess } from "../../../lib/gate";
import { adminFetch, logSearch, audit } from "../../../lib/supabase-admin";

export const dynamic = "force-dynamic";
// Exportações grandes levam dezenas de segundos; sem isso a Vercel encerra a função antes.
export const maxDuration = 300;

const MAX_EXPORT = 50000; // teto de linhas por exportação CSV
const QUOTA_DIARIA = 200000; // linhas exportáveis por usuário por dia

// Conta linhas de dados no CSV (menos o cabeçalho) e registra a exportação.
function registrarExport(userId, filters, csv) {
  const linhas = Math.max(0, (csv ? csv.trim().split("\n").length : 0) - 1);
  logSearch({ user_id: userId, tipo: "export", filtros: filters, linhas_exportadas: linhas });
  audit(userId, "export_csv", { filtros: filters, linhas });
}

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

    // Exportação exige acesso completo (admin, plano ou trial vigente).
    // Trial vencido → 402 (o front abre o popup do plano); anônimo/pendente → 401.
    const access = await getAccess();
    if (!hasFullAccess(access)) {
      const expirado = access.level === "expired";
      return Response.json(
        {
          error: expirado ? "plan_required" : "login_required",
          message: expirado
            ? "Seu período de teste terminou. Assine o plano para exportar."
            : "Faça login para exportar em CSV.",
        },
        { status: expirado ? 402 : 401 }
      );
    }

    // Quota diária por usuário.
    const desde = new Date();
    desde.setHours(0, 0, 0, 0);
    try {
      const usados = await adminFetch(
        `search_logs?user_id=eq.${access.userId}&tipo=eq.export&criado_em=gte.${desde.toISOString()}&select=linhas_exportadas`
      );
      const somaHoje = (usados || []).reduce((s, r) => s + (r.linhas_exportadas || 0), 0);
      if (somaHoje >= QUOTA_DIARIA) {
        return Response.json(
          { error: "quota", message: `Limite diário de exportação atingido (${QUOTA_DIARIA.toLocaleString("pt-BR")} linhas). Tente amanhã.` },
          { status: 429 }
        );
      }
    } catch {
      /* se a checagem falhar, não bloqueia a exportação */
    }

    if (filters.municipio) {
      const codes = await resolveMunicipioCodes(filters.municipio);
      if (codes && codes.length === 0) {
        // Nenhum município com esse nome — CSV só com o cabeçalho.
        const header = "﻿" + SELECT_COLUMNS.join(",") + "\n";
        return new Response(header, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="cnpj_vazio.csv"`,
          },
        });
      }
      if (codes) filters.municipioCodes = codes;
    }

    if (filters.cnae) {
      const codes = await resolveCnaeCodes(filters.cnae);
      if (codes && codes.length === 0) {
        const header = "﻿" + SELECT_COLUMNS.join(",") + "\n";
        return new Response(header, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="cnpj_vazio.csv"`,
          },
        });
      }
      if (codes) filters.cnaeCodes = codes;
    }

    const p = buildSearchParams(filters);
    p.set("limit", String(MAX_EXPORT));
    const url = restUrl(`vw_busca_empresas?${p.toString()}`);

    // Busca textual: sonda a consulta direta com anon (3s). Se estourar, o
    // termo é raro/sem match — o RPC indexado exporta rápido. Se passar, a
    // exportação direta com a service key é o caminho mais eficiente.
    if (filters.termo) {
      const probeParams = buildSearchParams(filters);
      probeParams.set("limit", "1");
      const probe = await fetch(restUrl(`vw_busca_empresas?${probeParams.toString()}`), {
        headers: restHeaders(),
        cache: "no-store",
      });
      if (!probe.ok && (await probe.text()).includes("57014")) {
        const rpcRes = await fetch(
          restUrl(`rpc/busca_por_termo?select=${SELECT_COLUMNS.join(",")}`),
          {
            method: "POST",
            headers: serviceHeaders({ "Content-Type": "application/json", Accept: "text/csv" }),
            body: JSON.stringify(rpcBodyFromFilters(filters, MAX_EXPORT)),
            cache: "no-store",
          }
        );
        if (!rpcRes.ok) {
          const rpcBody = await rpcRes.text();
          return Response.json({ error: `PostgREST ${rpcRes.status}: ${rpcBody}` }, { status: 502 });
        }
        const rpcCsv = await rpcRes.text();
        registrarExport(access.userId, filters, rpcCsv);
        const stampRpc = new Date().toISOString().slice(0, 10);
        return new Response("﻿" + rpcCsv, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="cnpj_${stampRpc}.csv"`,
          },
        });
      }
    }

    // PostgREST devolve CSV diretamente com Accept: text/csv.
    // service_role: sem statement_timeout (anon tem teto de 3s e estoura
    // em exportações grandes). A chave nunca sai do servidor.
    const res = await fetch(url, {
      headers: serviceHeaders({ Accept: "text/csv" }),
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text();
      return Response.json({ error: `PostgREST ${res.status}: ${body}` }, { status: 502 });
    }

    const csv = await res.text();
    registrarExport(access.userId, filters, csv);
    // BOM para o Excel reconhecer UTF-8 (acentos corretos).
    const withBom = "﻿" + csv;
    const stamp = new Date().toISOString().slice(0, 10);

    return new Response(withBom, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="cnpj_${stamp}.csv"`,
      },
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
