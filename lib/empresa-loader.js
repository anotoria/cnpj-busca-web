// Carrega os dados completos de uma empresa (view + sócios) para envio ao HL/Webhook.
import { restUrl, serviceHeaders } from "./supabase";
import { adminFetch } from "./supabase-admin";

let _qualCache = null;
export async function qualMap() {
  if (_qualCache) return _qualCache;
  const rows = await adminFetch("qualificacoes_socios?select=codigo,descricao");
  _qualCache = {};
  for (const r of rows || []) _qualCache[r.codigo] = r.descricao;
  return _qualCache;
}

export async function carregarEmpresa(cnpj) {
  const digits = String(cnpj).replace(/\D/g, "");
  const res = await fetch(
    restUrl(`vw_busca_empresas?cnpj=eq.${digits}&limit=1`),
    { headers: serviceHeaders(), cache: "no-store" }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  const e = rows[0];
  if (!e) return null;
  const qm = await qualMap();
  const sres = await fetch(
    restUrl(`socios?cnpj_basico=eq.${e.cnpj_basico}&select=nome_socio,cnpj_cpf_do_socio,identificador_de_socio,qualificacao_do_socio,data_entrada_sociedade,faixa_etaria&limit=30`),
    { headers: serviceHeaders(), cache: "no-store" }
  );
  const sociosRaw = sres.ok ? await sres.json() : [];
  // Formato usado pelo highlevel.sendLead (apenas nome + qualificação).
  e.socios = (sociosRaw || []).map((s) => ({
    nome: s.nome_socio,
    qualificacao: qm[s.qualificacao_do_socio] || s.qualificacao_do_socio || null,
  }));
  // Sócios crus para o webhook (com todos os campos).
  e._socios_raw = sociosRaw || [];
  return e;
}
