import { adminFetch, audit } from "../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

// Reset assistido pelo admin (o mailer interno não entrega e-mail).
// Registra a solicitação; o admin vê no painel e gera uma senha temporária.
export async function POST(request) {
  try {
    const { email } = await request.json();
    if (!email) return Response.json({ error: "Informe o e-mail." }, { status: 400 });

    const rows = await adminFetch(`profiles?email=eq.${encodeURIComponent(email)}&select=id`);
    const prof = Array.isArray(rows) && rows.length ? rows[0] : null;
    // Registra mesmo se não existir (não revela se o e-mail existe).
    if (prof) audit(prof.id, "reset_solicitado", { email });

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
