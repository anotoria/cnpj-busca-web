import { createClient } from "./supabase-server";
import { adminFetch } from "./supabase-admin";

// Limite de resultados para quem não tem acesso completo (demo/leitura).
export const DEMO_LIMIT = 10;

// Níveis com acesso completo à base (busca ilimitada, contatos, CSV).
export const FULL_LEVELS = ["approved", "trial"];

// Colunas de contato borradas na demo/modo leitura.
const CONTACT_COLS = ["correio_eletronico", "telefone_1", "ddd_1", "telefone_2", "ddd_2"];

// Descobre o nível de acesso da requisição.
// Níveis: 'anon' | 'pending' | 'approved' (admin ou plano) | 'trial' | 'expired'.
// expired = ativo mas sem plano e sem trial vigente → modo leitura (demo).
export async function getAccess() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { level: "anon", userId: null, role: null, plano: null, trialAte: null, podeConvidar: false };

  try {
    const rows = await adminFetch(`profiles?id=eq.${user.id}&select=role,status,plano,trial_ate`);
    const p = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!p || p.status !== "aprovado") {
      return { level: "pending", userId: user.id, role: p ? p.role : "user", plano: null, trialAte: null, podeConvidar: false };
    }

    const emTrial = p.trial_ate && new Date(p.trial_ate) > new Date();
    let level;
    if (p.role === "admin" || p.plano === "plano") level = "approved";
    else if (emTrial) level = "trial";
    else level = "expired";

    return {
      level,
      userId: user.id,
      role: p.role,
      plano: p.plano,
      trialAte: p.trial_ate || null,
      podeConvidar: p.role === "admin" || p.plano === "plano",
    };
  } catch {
    return { level: "pending", userId: user.id, role: "user", plano: null, trialAte: null, podeConvidar: false };
  }
}

// Acesso completo? (admin, plano ou trial vigente)
export function hasFullAccess(access) {
  return FULL_LEVELS.includes(access.level);
}

// Remove os dados de contato das linhas (demo/modo leitura).
export function blurContacts(rows) {
  return rows.map((r) => {
    const c = { ...r };
    for (const col of CONTACT_COLS) if (col in c) c[col] = null;
    c._contato_oculto = true;
    return c;
  });
}
