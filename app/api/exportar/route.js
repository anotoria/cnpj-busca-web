import { buildSearchParams, rpcBodyFromFilters, SELECT_COLUMNS } from "../../../lib/query";
import { restHeaders, restUrl, resolveMunicipioCodes, serviceHeaders } from "../../../lib/supabase";
import { resolveCnaeCodes } from "../../../lib/cnaes";
import { getAccess, hasFullAccess } from "../../../lib/gate";
import { adminFetch, logSearch, audit } from "../../../lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_EXPORT = 50000;
const QUOTA_DIARIA = 200000;
const MAX_SOCIOS_POR_LINHA = 10; // adiciona até N sócios em colunas na mesma linha
const SOCIOS_BATCH = 500;         // busca sócios em lotes de N cnpj_basico

const TIPO_SOCIO = { "1": "Pessoa Jurídica", "2": "Pessoa Física", "3": "Estrangeiro" };
const FAIXA_ETARIA = {
  "0": "Não se aplica",
  "1": "0 a 12 anos", "2": "13 a 20 anos", "3": "21 a 30 anos",
  "4": "31 a 40 anos", "5": "41 a 50 anos", "6": "51 a 60 anos",
  "7": "61 a 70 anos", "8": "71 a 80 anos", "9": "Maiores de 80 anos",
};

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

// --- CSV helpers ---
function csvCell(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csvRow(cells) {
  return cells.map(csvCell).join(",");
}

// Cabeçalhos das colunas por sócio N (1..MAX_SOCIOS_POR_LINHA).
function headersSocios() {
  const h = ["total_socios"];
  for (let i = 1; i <= MAX_SOCIOS_POR_LINHA; i++) {
    h.push(
      `socio_${i}_nome`,
      `socio_${i}_cpf_cnpj`,
      `socio_${i}_tipo`,
      `socio_${i}_qualificacao`,
      `socio_${i}_data_entrada`,
      `socio_${i}_faixa_etaria`
    );
  }
  return h;
}

// Uma linha extra de N × 6 células por empresa, na mesma linha do CSV.
function celulasSocios(socios, qualMap) {
  const cells = [String(socios.length)];
  const usados = socios.slice(0, MAX_SOCIOS_POR_LINHA);
  for (let i = 0; i < MAX_SOCIOS_POR_LINHA; i++) {
    const s = usados[i];
    if (!s) {
      cells.push("", "", "", "", "", "");
      continue;
    }
    cells.push(
      s.nome_socio || "",
      s.cnpj_cpf_do_socio || "",
      TIPO_SOCIO[s.identificador_de_socio] || "",
      qualMap[s.qualificacao_do_socio] || s.qualificacao_do_socio || "",
      s.data_entrada_sociedade || "",
      FAIXA_ETARIA[s.faixa_etaria] || ""
    );
  }
  return cells;
}

// Busca sócios de várias empresas em lotes. Retorna Map<cnpj_basico, [socios]>.
async function buscarSocios(cnpjBasicos) {
  const grupos = new Map();
  for (const cb of cnpjBasicos) grupos.set(cb, []);

  for (let i = 0; i < cnpjBasicos.length; i += SOCIOS_BATCH) {
    const lote = cnpjBasicos.slice(i, i + SOCIOS_BATCH);
    const url = restUrl(
      `socios?cnpj_basico=in.(${lote.join(",")})&select=cnpj_basico,nome_socio,cnpj_cpf_do_socio,identificador_de_socio,qualificacao_do_socio,data_entrada_sociedade,faixa_etaria&order=data_entrada_sociedade.asc.nullslast`
    );
    const res = await fetch(url, { headers: serviceHeaders(), cache: "no-store" });
    if (!res.ok) continue;
    const rows = await res.json();
    for (const s of rows || []) {
      const arr = grupos.get(s.cnpj_basico);
      if (arr) arr.push(s);
    }
  }
  return grupos;
}

async function qualificacoesMap() {
  const rows = await adminFetch("qualificacoes_socios?select=codigo,descricao");
  const m = {};
  for (const r of rows || []) m[r.codigo] = r.descricao;
  return m;
}

// Gera o CSV a partir das linhas da view + sócios batched.
async function gerarCsv(empresas) {
  // Extrai cnpj_basico único de cada empresa (primeiros 8 dígitos do CNPJ).
  const uniq = new Set();
  const cnpjBases = empresas.map((e) => {
    const digits = String(e.cnpj_formatado || "").replace(/\D/g, "").slice(0, 8);
    if (digits) uniq.add(digits);
    return digits;
  });
  const bases = Array.from(uniq);

  const [qualMap, grupos] = await Promise.all([
    qualificacoesMap(),
    buscarSocios(bases),
  ]);

  const header = [...SELECT_COLUMNS, ...headersSocios()];
  const linhas = [csvRow(header)];
  for (let i = 0; i < empresas.length; i++) {
    const e = empresas[i];
    const base = cnpjBases[i];
    const socios = grupos.get(base) || [];
    const empresaCells = SELECT_COLUMNS.map((k) => e[k]);
    linhas.push(csvRow([...empresaCells, ...celulasSocios(socios, qualMap)]));
  }
  return linhas.join("\n") + "\n";
}

function registrarExport(userId, filters, csv) {
  const linhas = Math.max(0, (csv ? csv.trim().split("\n").length : 0) - 1);
  logSearch({ user_id: userId, tipo: "export", filtros: filters, linhas_exportadas: linhas });
  audit(userId, "export_csv", { filtros: filters, linhas });
}

function csvVazioSoHeader() {
  const header = "﻿" + [...SELECT_COLUMNS, ...headersSocios()].join(",") + "\n";
  return new Response(header, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cnpj_vazio.csv"`,
    },
  });
}

async function jsonFromDireto(filters) {
  const p = buildSearchParams(filters);
  p.set("limit", String(MAX_EXPORT));
  const url = restUrl(`vw_busca_empresas?${p.toString()}`);
  const res = await fetch(url, { headers: serviceHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error(`PostgREST ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function jsonFromRpc(filters) {
  const url = restUrl(`rpc/busca_por_termo?select=${SELECT_COLUMNS.join(",")}`);
  const res = await fetch(url, {
    method: "POST",
    headers: serviceHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(rpcBodyFromFilters(filters, MAX_EXPORT)),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PostgREST ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = filtersFromRequest(searchParams);

    // Portão de acesso.
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

    // Quota diária.
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
      /* não bloqueia se a checagem falhar */
    }

    // Resolve filtros de município/cnae (mesmos guards de antes).
    if (filters.municipio) {
      const codes = await resolveMunicipioCodes(filters.municipio);
      if (codes && codes.length === 0) return csvVazioSoHeader();
      if (codes) filters.municipioCodes = codes;
    }
    if (filters.cnae) {
      const codes = await resolveCnaeCodes(filters.cnae);
      if (codes && codes.length === 0) return csvVazioSoHeader();
      if (codes) filters.cnaeCodes = codes;
    }

    // Escolhe caminho: sonda a direta com anon (3s). Se estourar e for busca
    // textual, cai no RPC. Senão, roda direto com service key (sem timeout).
    let empresas;
    if (filters.termo) {
      const probeParams = buildSearchParams(filters);
      probeParams.set("limit", "1");
      const probe = await fetch(restUrl(`vw_busca_empresas?${probeParams.toString()}`), {
        headers: restHeaders(),
        cache: "no-store",
      });
      if (!probe.ok && (await probe.text()).includes("57014")) {
        empresas = await jsonFromRpc(filters);
      } else {
        empresas = await jsonFromDireto(filters);
      }
    } else {
      empresas = await jsonFromDireto(filters);
    }

    const csv = await gerarCsv(empresas);
    registrarExport(access.userId, filters, csv);

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
