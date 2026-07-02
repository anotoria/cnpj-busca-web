// Helpers server-only que usam a service_role key. NUNCA importar no cliente.
// Acessa PostgREST e a Admin API do GoTrue sem passar por RLS.

const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_KEY;

function svcHeaders(extra = {}) {
  return { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, ...extra };
}

// GET/leitura em uma tabela/rota do PostgREST (retorna JSON).
export async function adminFetch(path) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    headers: svcHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PostgREST ${res.status}: ${await res.text()}`);
  return res.json();
}

// Escrita (POST/PATCH/DELETE) no PostgREST.
export async function adminWrite(path, method, body, prefer = "return=representation") {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    method,
    headers: svcHeaders({ "Content-Type": "application/json", Prefer: prefer }),
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PostgREST ${res.status}: ${await res.text()}`);
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

// Admin API do GoTrue (criar usuário, atualizar senha, gerar links).
export async function authAdmin(path, method, body) {
  const res = await fetch(`${URL}/auth/v1/${path}`, {
    method,
    headers: svcHeaders({ "Content-Type": "application/json" }),
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const txt = await res.text();
  const data = txt ? JSON.parse(txt) : null;
  if (!res.ok) throw new Error(`Auth ${res.status}: ${txt}`);
  return data;
}

// Registra uma linha de auditoria (best-effort — nunca quebra a ação principal).
export async function audit(userId, acao, detalhes = {}, ip = null) {
  try {
    await adminWrite("audit_logs", "POST", { user_id: userId, acao, detalhes, ip }, "return=minimal");
  } catch {
    /* ignora */
  }
}

// Registra uma busca/exportação.
export async function logSearch(entry) {
  try {
    await adminWrite("search_logs", "POST", entry, "return=minimal");
  } catch {
    /* ignora */
  }
}
