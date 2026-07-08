import { requireApproved } from "../../../../lib/guard";
import { adminFetch, adminWrite, audit } from "../../../../lib/supabase-admin";
import { restUrl, serviceHeaders } from "../../../../lib/supabase";
import { ensureCustomFields, sendLead } from "../../../../lib/highlevel";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Limite TOTAL por seleção (informado ao usuário). O cliente envia em lotes.
export const LIMITE_TOTAL = 200;
// Máximo processado por chamada (o cliente fatia a seleção nesses lotes).
const LOTE_MAX = 20;

// Cache do mapa de qualificações de sócio (código → descrição).
let _qualCache = null;
async function qualMap() {
  if (_qualCache) return _qualCache;
  const rows = await adminFetch("qualificacoes_socios?select=codigo,descricao");
  _qualCache = {};
  for (const r of rows || []) _qualCache[r.codigo] = r.descricao;
  return _qualCache;
}

async function carregarEmpresa(cnpj) {
  const digits = String(cnpj).replace(/\D/g, "");
  const res = await fetch(
    restUrl(`vw_busca_empresas?cnpj=eq.${digits}&limit=1`),
    { headers: serviceHeaders(), cache: "no-store" }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  const e = rows[0];
  if (!e) return null;
  // Sócios da empresa (por cnpj_basico).
  const qm = await qualMap();
  const sres = await fetch(
    restUrl(`socios?cnpj_basico=eq.${e.cnpj_basico}&select=nome_socio,qualificacao_do_socio&limit=30`),
    { headers: serviceHeaders(), cache: "no-store" }
  );
  const socios = sres.ok ? await sres.json() : [];
  e.socios = (socios || []).map((s) => ({
    nome: s.nome_socio,
    qualificacao: qm[s.qualificacao_do_socio] || s.qualificacao_do_socio || null,
  }));
  return e;
}

export async function POST(request) {
  const g = await requireApproved();
  if (!g.ok) return g.response;
  try {
    const { integracao_id, cnpjs } = await request.json();
    if (!integracao_id || !Array.isArray(cnpjs) || cnpjs.length === 0) {
      return Response.json({ error: "Informe a integração e ao menos um registro." }, { status: 400 });
    }
    if (cnpjs.length > LOTE_MAX) {
      return Response.json({ error: `Máximo ${LOTE_MAX} por lote.` }, { status: 400 });
    }

    const integ = (await adminFetch(
      `integracoes?id=eq.${integracao_id}&user_id=eq.${g.access.userId}&select=*`
    ))[0];
    if (!integ) return Response.json({ error: "Integração não encontrada." }, { status: 404 });
    if (!integ.ativo) return Response.json({ error: "Integração desativada." }, { status: 400 });

    const cfMap = await ensureCustomFields(integ.private_token, integ.location_id);

    const resultados = [];
    for (const cnpj of cnpjs) {
      const digits = String(cnpj).replace(/\D/g, "");
      try {
        const e = await carregarEmpresa(digits);
        if (!e) {
          resultados.push({ cnpj: digits, status: "erro", error: "Empresa não encontrada." });
          continue;
        }
        const r = await sendLead(integ.private_token, integ.location_id, cfMap, e);
        await adminWrite(
          "crm_envios",
          "POST",
          {
            user_id: g.access.userId,
            integracao_id: integ.id,
            cnpj: digits,
            cnpj_basico: e.cnpj_basico,
            razao_social: e.razao_social,
            status: r.status,
            ghl_business_id: r.business_id,
            ghl_contact_ids: r.contact_ids,
            erro: r.error,
          },
          "return=minimal"
        );
        resultados.push({ cnpj: digits, status: r.status, error: r.error });
      } catch (err) {
        resultados.push({ cnpj: digits, status: "erro", error: String(err.message || err).slice(0, 200) });
      }
    }

    audit(g.access.userId, "crm_envio_lote", {
      integracao_id: integ.id,
      total: resultados.length,
      ok: resultados.filter((r) => r.status === "enviado").length,
    });
    return Response.json({ resultados });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
