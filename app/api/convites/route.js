import { getAccess } from "../../../lib/gate";
import { adminFetch, adminWrite, audit } from "../../../lib/supabase-admin";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

// Limite de convites ativos por usuário com Plano (admins não têm limite).
const MAX_CONVITES_ATIVOS = 5;

function podeConvidar(access) {
  return access.podeConvidar && access.level === "approved";
}

// Meus convites.
export async function GET() {
  const access = await getAccess();
  if (!podeConvidar(access)) {
    return Response.json({ error: "Convites disponíveis apenas para assinantes do plano." }, { status: 403 });
  }
  const rows = await adminFetch(
    `invites?criado_por=eq.${access.userId}&select=id,token,expira_em,max_usos,usos,revogado,criado_em&order=criado_em.desc&limit=50`
  );
  return Response.json({ rows });
}

// Gera um convite (pré-aprovado, 7 dias, uso único, trial de 3 dias para quem entrar).
export async function POST() {
  const access = await getAccess();
  if (!podeConvidar(access)) {
    return Response.json({ error: "Convites disponíveis apenas para assinantes do plano." }, { status: 403 });
  }
  try {
    if (access.role !== "admin") {
      const ativos = await adminFetch(
        `invites?criado_por=eq.${access.userId}&revogado=eq.false&expira_em=gt.${new Date().toISOString()}&select=id,usos,max_usos`
      );
      const emAberto = (ativos || []).filter((c) => c.usos < c.max_usos).length;
      if (emAberto >= MAX_CONVITES_ATIVOS) {
        return Response.json(
          { error: `Você já tem ${emAberto} convites ativos (limite ${MAX_CONVITES_ATIVOS}). Revogue ou aguarde expirarem.` },
          { status: 429 }
        );
      }
    }
    const token = randomBytes(18).toString("base64url");
    const expira = new Date(Date.now() + 7 * 86400000).toISOString();
    await adminWrite(
      "invites",
      "POST",
      { token, criado_por: access.userId, expira_em: expira, max_usos: 1 },
      "return=minimal"
    );
    audit(access.userId, "criar_convite_usuario", {});
    return Response.json({ ok: true, token });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
