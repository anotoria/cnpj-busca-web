import { requireAdmin } from "../../../../lib/guard";
import { adminFetch, adminWrite, authAdmin, audit } from "../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

// Lista todos os usuários.
export async function GET() {
  const g = await requireAdmin();
  if (!g.ok) return g.response;
  const rows = await adminFetch(
    "profiles?select=id,nome,email,role,status,origem,criado_em&order=criado_em.desc"
  );
  return Response.json({ rows });
}

// Cria um novo usuário (já aprovado).
export async function POST(request) {
  const g = await requireAdmin();
  if (!g.ok) return g.response;
  try {
    const { nome, email, password, role } = await request.json();
    if (!nome || !email || !password) {
      return Response.json({ error: "Preencha nome, e-mail e senha." }, { status: 400 });
    }
    const user = await authAdmin("admin/users", "POST", {
      email,
      password,
      email_confirm: true,
      user_metadata: { nome },
    });
    await adminWrite(
      "profiles",
      "POST",
      { id: user.id, nome, email, role: role === "admin" ? "admin" : "user", status: "aprovado", origem: "admin" },
      "return=minimal"
    );
    audit(g.access.userId, "criar_usuario", { alvo: email, role });
    return Response.json({ ok: true });
  } catch (e) {
    if (String(e.message).includes("already been registered")) {
      return Response.json({ error: "E-mail já cadastrado." }, { status: 409 });
    }
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Ações sobre um usuário: aprovar, rejeitar, ativar, desativar, promover, resetar senha.
export async function PATCH(request) {
  const g = await requireAdmin();
  if (!g.ok) return g.response;
  try {
    const { id, acao, valor } = await request.json();
    if (!id || !acao) return Response.json({ error: "Requisição inválida." }, { status: 400 });

    if (acao === "status") {
      // valor: aprovado | desativado | rejeitado | pendente
      await adminWrite(`profiles?id=eq.${id}`, "PATCH", { status: valor, atualizado_em: new Date().toISOString() }, "return=minimal");
      audit(g.access.userId, "alterar_status", { alvo: id, status: valor });
      return Response.json({ ok: true });
    }

    if (acao === "role") {
      await adminWrite(`profiles?id=eq.${id}`, "PATCH", { role: valor === "admin" ? "admin" : "user" }, "return=minimal");
      audit(g.access.userId, "alterar_role", { alvo: id, role: valor });
      return Response.json({ ok: true });
    }

    if (acao === "reset_senha") {
      // Gera senha temporária, aplica no Auth e devolve para o admin copiar.
      const temp = "Tmp-" + Math.random().toString(36).slice(2, 10) + "!";
      await authAdmin(`admin/users/${id}`, "PUT", { password: temp });
      audit(g.access.userId, "reset_senha", { alvo: id });
      return Response.json({ ok: true, senha_temporaria: temp });
    }

    return Response.json({ error: "Ação desconhecida." }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
