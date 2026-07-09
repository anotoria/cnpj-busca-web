import { requireApproved } from "../../../../lib/guard";
import { adminFetch, adminWrite, audit } from "../../../../lib/supabase-admin";
import { buildPayload, postWebhook } from "../../../../lib/webhook";
import { carregarEmpresa, qualMap } from "../../../../lib/empresa-loader";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LOTE_MAX = 20;

export async function POST(request) {
  const g = await requireApproved();
  if (!g.ok) return g.response;
  try {
    const { webhook_id, cnpjs } = await request.json();
    if (!webhook_id || !Array.isArray(cnpjs) || cnpjs.length === 0) {
      return Response.json({ error: "Informe o webhook e ao menos um registro." }, { status: 400 });
    }
    if (cnpjs.length > LOTE_MAX) {
      return Response.json({ error: `Máximo ${LOTE_MAX} por lote.` }, { status: 400 });
    }

    const w = (await adminFetch(
      `webhooks?id=eq.${webhook_id}&user_id=eq.${g.access.userId}&select=*`
    ))[0];
    if (!w) return Response.json({ error: "Webhook não encontrado." }, { status: 404 });
    if (!w.ativo) return Response.json({ error: "Webhook desativado." }, { status: 400 });

    const qm = await qualMap();
    const resultados = [];

    for (const cnpj of cnpjs) {
      const digits = String(cnpj).replace(/\D/g, "");
      try {
        const e = await carregarEmpresa(digits);
        if (!e) {
          resultados.push({ cnpj: digits, status: "erro", error: "Empresa não encontrada." });
          continue;
        }
        const payload = buildPayload(e, e._socios_raw || [], qm, { integracao: w.nome });
        const r = await postWebhook(w.url, payload);
        await adminWrite(
          "crm_envios",
          "POST",
          {
            user_id: g.access.userId,
            webhook_id: w.id,
            canal: "webhook",
            cnpj: digits,
            cnpj_basico: e.cnpj_basico,
            razao_social: e.razao_social,
            status: r.status,
            erro: r.error,
            http_status: r.http_status,
            response_snippet: r.snippet,
          },
          "return=minimal"
        );
        resultados.push({ cnpj: digits, status: r.status, error: r.error });
      } catch (err) {
        resultados.push({ cnpj: digits, status: "erro", error: String(err.message || err).slice(0, 200) });
      }
    }

    audit(g.access.userId, "webhook_envio_lote", {
      webhook_id: w.id,
      total: resultados.length,
      ok: resultados.filter((r) => r.status === "enviado").length,
    });
    return Response.json({ resultados });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
