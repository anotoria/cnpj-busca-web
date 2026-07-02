import { requireAdmin } from "../../../../lib/guard";
import { adminFetch } from "../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

// Logs de buscas/exportações e de auditoria (ações do sistema).
export async function GET(request) {
  const g = await requireAdmin();
  if (!g.ok) return g.response;
  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get("tipo") || "busca"; // busca | auditoria

  if (tipo === "auditoria") {
    const rows = await adminFetch("audit_logs?select=id,user_id,acao,detalhes,criado_em&order=criado_em.desc&limit=300");
    return Response.json({ rows });
  }
  const rows = await adminFetch(
    "search_logs?select=id,user_id,tipo,filtros,total_resultados,linhas_exportadas,anonimo,criado_em&order=criado_em.desc&limit=300"
  );
  return Response.json({ rows });
}
