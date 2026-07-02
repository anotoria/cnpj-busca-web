import { createClient } from "./supabase-server";
import { adminFetch } from "./supabase-admin";

// Limite de resultados para a demo (não logado ou pendente).
export const DEMO_LIMIT = 10;

// Colunas de contato borradas na demo.
const CONTACT_COLS = ["correio_eletronico", "telefone_1", "ddd_1", "telefone_2", "ddd_2"];

// Descobre o nível de acesso da requisição.
// Retorna { level: 'anon' | 'pending' | 'approved', userId, role }.
export async function getAccess() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { level: "anon", userId: null, role: null };

  try {
    const rows = await adminFetch(`profiles?id=eq.${user.id}&select=role,status`);
    const p = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (p && p.status === "aprovado") return { level: "approved", userId: user.id, role: p.role };
    return { level: "pending", userId: user.id, role: p ? p.role : "user" };
  } catch {
    return { level: "pending", userId: user.id, role: "user" };
  }
}

// Remove os dados de contato das linhas (demo).
export function blurContacts(rows) {
  return rows.map((r) => {
    const c = { ...r };
    for (const col of CONTACT_COLS) if (col in c) c[col] = null;
    c._contato_oculto = true;
    return c;
  });
}
