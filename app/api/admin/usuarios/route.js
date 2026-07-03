import { requireAdmin } from "../../../../lib/guard";
import { adminFetch, adminWrite, authAdmin, audit } from "../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function contarAdminsAtivos() {
  const rows = await adminFetch("profiles?role=eq.admin&status=eq.aprovado&select=id");
  return Array.isArray(rows) ? rows.length : 0;
}

// Lista todos os usuários (com plano/trial para os filtros do painel).
export async function GET() {
  const g = await requireAdmin();
  if (!g.ok) return g.response;
  const rows = await adminFetch(
    "profiles?select=id,nome,email,role,status,origem,plano,trial_ate,convidado_por,criado_em&order=criado_em.desc"
  );
  return Response.json({ rows });
}

// Cria um novo usuário (já aprovado; plano e trial escolhidos pelo admin).
export async function POST(request) {
  const g = await requireAdmin();
  if (!g.ok) return g.response;
  try {
    const { nome, email, password, role, plano, trial_dias } = await request.json();
    if (!nome || !email || !password) {
      return Response.json({ error: "Preencha nome, e-mail e senha." }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return Response.json({ error: "E-mail inválido." }, { status: 400 });
    }
    if (String(password).length < 8) {
      return Response.json({ error: "A senha deve ter ao menos 8 caracteres." }, { status: 400 });
    }
    const user = await authAdmin("admin/users", "POST", {
      email,
      password,
      email_confirm: true,
      user_metadata: { nome },
    });
    const dias = parseInt(trial_dias, 10);
    const trialAte = plano !== "plano" && dias > 0 ? new Date(Date.now() + dias * 86400000).toISOString() : null;
    await adminWrite(
      "profiles",
      "POST",
      {
        id: user.id,
        nome,
        email,
        role: role === "admin" ? "admin" : "user",
        status: "aprovado",
        origem: "admin",
        plano: plano === "plano" ? "plano" : "sem_plano",
        trial_ate: trialAte,
      },
      "return=minimal"
    );
    audit(g.access.userId, "criar_usuario", { alvo: email, role, plano, trial_dias: trialAte ? dias : 0 });
    return Response.json({ ok: true });
  } catch (e) {
    if (String(e.message).includes("already been registered")) {
      return Response.json({ error: "E-mail já cadastrado." }, { status: 409 });
    }
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Ações sobre um usuário: status, role, plano, trial, editar, senhas.
export async function PATCH(request) {
  const g = await requireAdmin();
  if (!g.ok) return g.response;
  try {
    const { id, acao, valor, nome, email } = await request.json();
    if (!id || !acao) return Response.json({ error: "Requisição inválida." }, { status: 400 });

    const alvoRows = await adminFetch(`profiles?id=eq.${id}&select=id,role,status,email`);
    const alvo = Array.isArray(alvoRows) && alvoRows.length ? alvoRows[0] : null;
    if (!alvo) return Response.json({ error: "Usuário não encontrado." }, { status: 404 });

    if (acao === "status") {
      // valor: aprovado | desativado | rejeitado | pendente
      if (id === g.access.userId && valor !== "aprovado") {
        return Response.json({ error: "Você não pode desativar a própria conta." }, { status: 400 });
      }
      if (alvo.role === "admin" && valor !== "aprovado" && (await contarAdminsAtivos()) <= 1) {
        return Response.json({ error: "Não é possível desativar o único administrador." }, { status: 400 });
      }
      await adminWrite(
        `profiles?id=eq.${id}`,
        "PATCH",
        { status: valor, atualizado_em: new Date().toISOString() },
        "return=minimal"
      );
      audit(g.access.userId, "alterar_status", { alvo: id, status: valor });
      return Response.json({ ok: true });
    }

    if (acao === "role") {
      if (alvo.role === "admin" && valor !== "admin" && (await contarAdminsAtivos()) <= 1) {
        return Response.json({ error: "Não é possível rebaixar o único administrador." }, { status: 400 });
      }
      await adminWrite(`profiles?id=eq.${id}`, "PATCH", { role: valor === "admin" ? "admin" : "user" }, "return=minimal");
      audit(g.access.userId, "alterar_role", { alvo: id, role: valor });
      return Response.json({ ok: true });
    }

    if (acao === "plano") {
      // valor: 'plano' | 'sem_plano'
      const novoPlano = valor === "plano" ? "plano" : "sem_plano";
      await adminWrite(`profiles?id=eq.${id}`, "PATCH", { plano: novoPlano, atualizado_em: new Date().toISOString() }, "return=minimal");
      audit(g.access.userId, "alterar_plano", { alvo: id, plano: novoPlano });
      return Response.json({ ok: true });
    }

    if (acao === "trial") {
      // valor: número de dias a partir de agora (0/null limpa o trial).
      const dias = parseInt(valor, 10);
      const trialAte = dias > 0 ? new Date(Date.now() + dias * 86400000).toISOString() : null;
      await adminWrite(`profiles?id=eq.${id}`, "PATCH", { trial_ate: trialAte }, "return=minimal");
      audit(g.access.userId, "ajustar_trial", { alvo: id, dias: dias > 0 ? dias : 0 });
      return Response.json({ ok: true, trial_ate: trialAte });
    }

    if (acao === "editar") {
      if (!nome || !email) return Response.json({ error: "Informe nome e e-mail." }, { status: 400 });
      if (!EMAIL_RE.test(email)) return Response.json({ error: "E-mail inválido." }, { status: 400 });
      // E-mail único (exceto o próprio).
      const dup = await adminFetch(`profiles?email=eq.${encodeURIComponent(email)}&id=neq.${id}&select=id`);
      if (Array.isArray(dup) && dup.length) {
        return Response.json({ error: "Já existe um usuário com esse e-mail." }, { status: 409 });
      }
      // Sincroniza o e-mail no Auth (login) quando mudou.
      if (email !== alvo.email) {
        await authAdmin(`admin/users/${id}`, "PUT", { email, email_confirm: true });
      }
      await adminWrite(
        `profiles?id=eq.${id}`,
        "PATCH",
        { nome, email, atualizado_em: new Date().toISOString() },
        "return=minimal"
      );
      audit(g.access.userId, "editar_usuario", { alvo: id, nome, email_novo: email, email_antigo: alvo.email });
      return Response.json({ ok: true });
    }

    if (acao === "reset_senha") {
      // Gera senha temporária, aplica no Auth e devolve para o admin copiar.
      const temp = "Tmp-" + Math.random().toString(36).slice(2, 10) + "!";
      await authAdmin(`admin/users/${id}`, "PUT", { password: temp });
      audit(g.access.userId, "reset_senha", { alvo: id });
      return Response.json({ ok: true, senha_temporaria: temp });
    }

    if (acao === "definir_senha") {
      // Admin define a senha escolhida.
      if (!valor || String(valor).length < 8) {
        return Response.json({ error: "A senha deve ter ao menos 8 caracteres." }, { status: 400 });
      }
      await authAdmin(`admin/users/${id}`, "PUT", { password: String(valor) });
      audit(g.access.userId, "definir_senha", { alvo: id });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Ação desconhecida." }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
