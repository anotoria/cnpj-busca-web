import { requireAdmin } from "../../../../lib/guard";
import { adminFetch, adminWrite, audit } from "../../../../lib/supabase-admin";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

// Lista convites.
export async function GET() {
  const g = await requireAdmin();
  if (!g.ok) return g.response;
  const rows = await adminFetch(
    "invites?select=id,token,expira_em,max_usos,usos,revogado,criado_em&order=criado_em.desc"
  );
  return Response.json({ rows });
}

// Cria um novo convite (link pré-aprovado).
export async function POST(request) {
  const g = await requireAdmin();
  if (!g.ok) return g.response;
  try {
    const body = await request.json().catch(() => ({}));
    const dias = Math.min(Math.max(parseInt(body.dias || "7", 10), 1), 90);
    const maxUsos = Math.min(Math.max(parseInt(body.max_usos || "1", 10), 1), 100);
    const token = randomBytes(18).toString("base64url");
    const expira = new Date(Date.now() + dias * 86400000).toISOString();

    await adminWrite(
      "invites",
      "POST",
      { token, criado_por: g.access.userId, expira_em: expira, max_usos: maxUsos },
      "return=minimal"
    );
    audit(g.access.userId, "criar_convite", { dias, max_usos: maxUsos });
    return Response.json({ ok: true, token });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Revoga um convite.
export async function PATCH(request) {
  const g = await requireAdmin();
  if (!g.ok) return g.response;
  try {
    const { id } = await request.json();
    await adminWrite(`invites?id=eq.${id}`, "PATCH", { revogado: true }, "return=minimal");
    audit(g.access.userId, "revogar_convite", { id });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
