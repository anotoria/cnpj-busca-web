import { getAccess } from "../../../lib/gate";
import { adminFetch } from "../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

// Estado do usuário atual para o front (nível, papel, nome) + pendentes (admin).
export async function GET() {
  const access = await getAccess();
  if (access.level === "anon") {
    return Response.json({ level: "anon" });
  }
  let nome = null;
  let email = null;
  let pendentes = 0;
  try {
    const rows = await adminFetch(`profiles?id=eq.${access.userId}&select=nome,email`);
    if (Array.isArray(rows) && rows.length) {
      nome = rows[0].nome;
      email = rows[0].email;
    }
    if (access.role === "admin") {
      const p = await adminFetch("profiles?status=eq.pendente&select=id");
      pendentes = Array.isArray(p) ? p.length : 0;
    }
  } catch {
    /* ignora */
  }
  return Response.json({ level: access.level, role: access.role, nome, email, pendentes });
}
