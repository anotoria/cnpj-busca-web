import { getAccess } from "./gate";

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

// Garante que quem chama é usuário aprovado (admin ou user).
export async function requireApproved() {
  const access = await getAccess();
  if (access.level !== "approved") {
    return {
      ok: false,
      response: Response.json({ error: "Faça login para acessar." }, { status: 401 }),
    };
  }
  return { ok: true, access };
}
