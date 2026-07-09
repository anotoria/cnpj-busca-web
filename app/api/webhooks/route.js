import { requireApproved } from "../../../lib/guard";
import { adminFetch, adminWrite, audit } from "../../../lib/supabase-admin";
import { validateWebhookUrl } from "../../../lib/webhook";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await requireApproved();
  if (!g.ok) return g.response;
  const rows = await adminFetch(
    `webhooks?user_id=eq.${g.access.userId}&select=id,nome,url,ativo,ultimo_teste_status,ultimo_teste_em,criado_em&order=criado_em.desc`
  );
  return Response.json({ rows });
}

export async function POST(request) {
  const g = await requireApproved();
  if (!g.ok) return g.response;
  try {
    const { nome, url } = await request.json();
    if (!nome || !url) {
      return Response.json({ error: "Preencha nome e URL." }, { status: 400 });
    }
    const val = validateWebhookUrl(url);
    if (!val.ok) return Response.json({ error: val.error }, { status: 400 });
    await adminWrite(
      "webhooks",
      "POST",
      { user_id: g.access.userId, nome, url: url.trim() },
      "return=minimal"
    );
    audit(g.access.userId, "webhook_criado", { nome, url: url.trim() });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
