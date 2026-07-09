import { requireApproved } from "../../../../lib/guard";
import { adminFetch, adminWrite, audit } from "../../../../lib/supabase-admin";
import { validateWebhookUrl, postWebhook } from "../../../../lib/webhook";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function loadOwn(userId, id) {
  const rows = await adminFetch(`webhooks?id=eq.${id}&user_id=eq.${userId}&select=*`);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

export async function PATCH(request, { params }) {
  const g = await requireApproved();
  if (!g.ok) return g.response;
  try {
    const w = await loadOwn(g.access.userId, params.id);
    if (!w) return Response.json({ error: "Webhook não encontrado." }, { status: 404 });
    const body = await request.json();
    const acao = body.acao;

    if (acao === "testar") {
      const payload = {
        origem: "Prospect AI",
        teste: true,
        enviado_em: new Date().toISOString(),
        mensagem: "Teste de conexão do webhook a partir do Prospect AI.",
      };
      const r = await postWebhook(w.url, payload);
      await adminWrite(
        `webhooks?id=eq.${w.id}`,
        "PATCH",
        {
          ultimo_teste_status: r.status === "enviado" ? "ok" : "erro",
          ultimo_teste_em: new Date().toISOString(),
        },
        "return=minimal"
      );
      return Response.json({ ok: r.status === "enviado", http_status: r.http_status, error: r.error });
    }

    if (acao === "ativo") {
      await adminWrite(`webhooks?id=eq.${w.id}`, "PATCH", { ativo: !!body.valor, atualizado_em: new Date().toISOString() }, "return=minimal");
      return Response.json({ ok: true });
    }

    if (acao === "editar") {
      const updates = { atualizado_em: new Date().toISOString() };
      if (body.nome) updates.nome = body.nome;
      if (body.url) {
        const val = validateWebhookUrl(body.url);
        if (!val.ok) return Response.json({ error: val.error }, { status: 400 });
        updates.url = String(body.url).trim();
      }
      await adminWrite(`webhooks?id=eq.${w.id}`, "PATCH", updates, "return=minimal");
      audit(g.access.userId, "webhook_editado", { id: w.id });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Ação desconhecida." }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const g = await requireApproved();
  if (!g.ok) return g.response;
  const w = await loadOwn(g.access.userId, params.id);
  if (!w) return Response.json({ error: "Webhook não encontrado." }, { status: 404 });
  await adminWrite(`webhooks?id=eq.${w.id}`, "DELETE", null, "return=minimal");
  audit(g.access.userId, "webhook_excluido", { id: w.id });
  return Response.json({ ok: true });
}
