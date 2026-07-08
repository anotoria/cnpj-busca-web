import { requireApproved } from "../../../lib/guard";
import { adminFetch, adminWrite, audit } from "../../../lib/supabase-admin";
import { testConnection } from "../../../lib/highlevel";

export const dynamic = "force-dynamic";

// Lista as integrações do usuário (SEM o token).
export async function GET() {
  const g = await requireApproved();
  if (!g.ok) return g.response;
  const rows = await adminFetch(
    `integracoes?user_id=eq.${g.access.userId}&select=id,nome,location_id,is_default,ativo,ultimo_teste_status,ultimo_teste_em,criado_em&order=criado_em.desc`
  );
  return Response.json({ rows });
}

// Cria uma integração (valida a conexão antes de salvar).
export async function POST(request) {
  const g = await requireApproved();
  if (!g.ok) return g.response;
  try {
    const { nome, location_id, private_token, is_default } = await request.json();
    if (!nome || !location_id || !private_token) {
      return Response.json({ error: "Preencha nome, ID da subconta e o Private Token." }, { status: 400 });
    }
    const teste = await testConnection(private_token.trim(), location_id.trim());
    if (!teste.ok) {
      return Response.json({ error: `Não conectou: ${teste.error}` }, { status: 400 });
    }
    if (is_default) {
      await adminWrite(`integracoes?user_id=eq.${g.access.userId}&is_default=eq.true`, "PATCH", { is_default: false }, "return=minimal");
    }
    await adminWrite(
      "integracoes",
      "POST",
      {
        user_id: g.access.userId,
        nome,
        location_id: location_id.trim(),
        private_token: private_token.trim(),
        is_default: !!is_default,
        ultimo_teste_status: "ok",
        ultimo_teste_em: new Date().toISOString(),
      },
      "return=minimal"
    );
    audit(g.access.userId, "integracao_criada", { nome, location_id: location_id.trim() });
    return Response.json({ ok: true, subconta: teste.nome || null });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
