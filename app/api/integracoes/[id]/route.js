import { requireApproved } from "../../../../lib/guard";
import { adminFetch, adminWrite, audit } from "../../../../lib/supabase-admin";
import { testConnection } from "../../../../lib/highlevel";

export const dynamic = "force-dynamic";

async function loadOwn(userId, id) {
  const rows = await adminFetch(`integracoes?id=eq.${id}&user_id=eq.${userId}&select=*`);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

// Ações: editar, ativar/desativar, tornar padrão, testar.
export async function PATCH(request, { params }) {
  const g = await requireApproved();
  if (!g.ok) return g.response;
  try {
    const integ = await loadOwn(g.access.userId, params.id);
    if (!integ) return Response.json({ error: "Integração não encontrada." }, { status: 404 });
    const body = await request.json();
    const acao = body.acao;

    if (acao === "testar") {
      const t = await testConnection(integ.private_token, integ.location_id);
      await adminWrite(
        `integracoes?id=eq.${integ.id}`,
        "PATCH",
        { ultimo_teste_status: t.ok ? "ok" : "erro", ultimo_teste_em: new Date().toISOString() },
        "return=minimal"
      );
      return Response.json({ ok: t.ok, subconta: t.nome || null, error: t.error || null });
    }

    if (acao === "default") {
      await adminWrite(`integracoes?user_id=eq.${g.access.userId}&is_default=eq.true`, "PATCH", { is_default: false }, "return=minimal");
      await adminWrite(`integracoes?id=eq.${integ.id}`, "PATCH", { is_default: true, atualizado_em: new Date().toISOString() }, "return=minimal");
      return Response.json({ ok: true });
    }

    if (acao === "ativo") {
      await adminWrite(`integracoes?id=eq.${integ.id}`, "PATCH", { ativo: !!body.valor, atualizado_em: new Date().toISOString() }, "return=minimal");
      return Response.json({ ok: true });
    }

    if (acao === "editar") {
      const updates = { atualizado_em: new Date().toISOString() };
      if (body.nome) updates.nome = body.nome;
      if (body.location_id) updates.location_id = String(body.location_id).trim();
      if (body.private_token) updates.private_token = String(body.private_token).trim();
      // Se mudou token/subconta, revalida.
      if (updates.private_token || updates.location_id) {
        const tok = updates.private_token || integ.private_token;
        const loc = updates.location_id || integ.location_id;
        const t = await testConnection(tok, loc);
        if (!t.ok) return Response.json({ error: `Não conectou: ${t.error}` }, { status: 400 });
        updates.ultimo_teste_status = "ok";
        updates.ultimo_teste_em = new Date().toISOString();
      }
      await adminWrite(`integracoes?id=eq.${integ.id}`, "PATCH", updates, "return=minimal");
      audit(g.access.userId, "integracao_editada", { id: integ.id });
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
  const integ = await loadOwn(g.access.userId, params.id);
  if (!integ) return Response.json({ error: "Integração não encontrada." }, { status: 404 });
  await adminWrite(`integracoes?id=eq.${integ.id}`, "DELETE", null, "return=minimal");
  audit(g.access.userId, "integracao_excluida", { id: integ.id });
  return Response.json({ ok: true });
}
