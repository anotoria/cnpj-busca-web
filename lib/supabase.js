// Cliente leve para a API REST (PostgREST) do Supabase self-hosted.
// As credenciais ficam apenas no servidor (rotas /api), nunca no navegador.

export function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) {
    throw new Error(
      "Variáveis SUPABASE_URL e SUPABASE_KEY não configuradas. Defina-as no .env.local (local) ou nas Environment Variables da Vercel."
    );
  }
  return { url: url.replace(/\/$/, ""), key };
}

export function restHeaders(extra = {}) {
  const { key } = supabaseConfig();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...extra,
  };
}

// Headers com a service_role key — sem statement_timeout no Postgres.
// Usada APENAS na exportação CSV (consulta longa). Nunca vai ao navegador.
// Se SUPABASE_SERVICE_KEY não estiver definida, cai na chave padrão.
export function serviceHeaders(extra = {}) {
  const key = process.env.SUPABASE_SERVICE_KEY || supabaseConfig().key;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...extra,
  };
}

export function restUrl(path) {
  const { url } = supabaseConfig();
  return `${url}/rest/v1/${path}`;
}

// Resolve o nome (ou parte do nome) de município para os códigos da tabela
// municipios. Nomes se repetem entre UFs, então pode haver vários códigos —
// o filtro de UF restringe o resto. Retorna [] quando nada casa.
export async function resolveMunicipioCodes(name) {
  const term = String(name || "").trim().replace(/,/g, "");
  if (!term) return null;
  const p = new URLSearchParams();
  p.set("select", "codigo");
  p.append("descricao", `ilike.*${term}*`);
  p.set("limit", "100");
  const res = await fetch(restUrl(`municipios?${p.toString()}`), {
    headers: restHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows.map((r) => r.codigo);
}
