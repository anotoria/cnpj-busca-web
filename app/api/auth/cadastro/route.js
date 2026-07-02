import { authAdmin, adminFetch, adminWrite, audit } from "../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { nome, email, password, termos, convite } = await request.json();

    if (!nome || !email || !password) {
      return Response.json({ error: "Preencha nome, e-mail e senha." }, { status: 400 });
    }
    if (!termos) {
      return Response.json({ error: "É preciso aceitar os Termos e a Política de Privacidade." }, { status: 400 });
    }
    if (String(password).length < 8) {
      return Response.json({ error: "A senha deve ter ao menos 8 caracteres." }, { status: 400 });
    }

    // Convite válido → cadastro já aprovado.
    let statusInicial = "pendente";
    let origem = "cadastro";
    let inviteRow = null;
    if (convite) {
      const rows = await adminFetch(
        `invites?token=eq.${encodeURIComponent(convite)}&select=id,expira_em,max_usos,usos,revogado`
      );
      inviteRow = Array.isArray(rows) && rows.length ? rows[0] : null;
      const valido =
        inviteRow &&
        !inviteRow.revogado &&
        inviteRow.usos < inviteRow.max_usos &&
        new Date(inviteRow.expira_em) > new Date();
      if (!valido) {
        return Response.json({ error: "Convite inválido ou expirado." }, { status: 400 });
      }
      statusInicial = "aprovado";
      origem = "convite";
    }

    // Cria o usuário no Auth (e-mail auto-confirmado — mailer interno não entrega).
    let user;
    try {
      user = await authAdmin("admin/users", "POST", {
        email,
        password,
        email_confirm: true,
        user_metadata: { nome },
      });
    } catch (e) {
      if (String(e.message).includes("already been registered") || String(e.message).includes("already exists")) {
        return Response.json({ error: "Este e-mail já está cadastrado." }, { status: 409 });
      }
      throw e;
    }

    // Cria o perfil.
    await adminWrite(
      "profiles",
      "POST",
      { id: user.id, nome, email, role: "user", status: statusInicial, origem },
      "return=minimal"
    );

    // Consome o convite.
    if (inviteRow) {
      await adminWrite(`invites?id=eq.${inviteRow.id}`, "PATCH", { usos: inviteRow.usos + 1 }, "return=minimal");
    }

    audit(user.id, "cadastro", { origem, status: statusInicial });

    return Response.json({ ok: true, status: statusInicial });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
