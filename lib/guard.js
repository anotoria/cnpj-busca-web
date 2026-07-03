import { getAccess, hasFullAccess } from "./gate";

// Garante que quem chama é admin. Retorna { ok, access } ou { ok:false, response }.
export async function requireAdmin() {
  const access = await getAccess();
  if (access.level !== "approved" || access.role !== "admin") {
    return {
      ok: false,
      response: Response.json({ error: "Acesso restrito ao administrador." }, { status: 403 }),
    };
  }
  return { ok: true, access };
}

// Garante acesso completo (admin, plano, ou trial vigente).
export async function requireApproved() {
  const access = await getAccess();
  if (!hasFullAccess(access)) {
    const msg =
      access.level === "expired"
        ? "Seu período de teste terminou. Assine o plano para continuar."
        : "Faça login para acessar.";
    return {
      ok: false,
      response: Response.json(
        { error: access.level === "expired" ? "plan_required" : "login_required", message: msg },
        { status: access.level === "expired" ? 402 : 401 }
      ),
    };
  }
  return { ok: true, access };
}
