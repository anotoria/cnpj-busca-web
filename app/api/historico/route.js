import { requireApproved } from "../../../lib/guard";
import { adminFetch } from "../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

// Histórico de buscas do próprio usuário.
export async function GET() {
  const g = await requireApproved();
  if (!g.ok) return g.response;
  const rows = await adminFetch(
    `search_logs?user_id=eq.${g.access.userId}&tipo=eq.busca&select=id,filtros,total_resultados,criado_em&order=criado_em.desc&limit=100`
  );
  return Response.json({ rows });
}
