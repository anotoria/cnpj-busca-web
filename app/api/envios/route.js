import { requireApproved } from "../../../lib/guard";
import { adminFetch } from "../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

// Histórico de envios do usuário (usado pela aba "Status de Envio").
// Query params opcionais: status ("enviados"|"erros"), canal ("highlevel"|"webhook"), limit, offset.
export async function GET(request) {
  const g = await requireApproved();
  if (!g.ok) return g.response;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "todos";
  const canal = searchParams.get("canal") || "todos";
  const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

  const parts = [`user_id=eq.${g.access.userId}`];
  if (status === "enviados") parts.push("status=in.(enviado,parcial)");
  else if (status === "erros") parts.push("status=eq.erro");
  if (canal === "highlevel" || canal === "webhook") parts.push(`canal=eq.${canal}`);
  parts.push(`select=id,canal,cnpj,razao_social,status,integracao_id,webhook_id,erro,http_status,criado_em`);
  parts.push(`order=criado_em.desc`);
  parts.push(`limit=${limit}`);
  if (offset > 0) parts.push(`offset=${offset}`);

  const rows = await adminFetch(`crm_envios?${parts.join("&")}`);

  // Enriquece com o nome da integração/webhook (uma consulta por conjunto único).
  const integIds = [...new Set(rows.filter((r) => r.integracao_id).map((r) => r.integracao_id))];
  const whIds = [...new Set(rows.filter((r) => r.webhook_id).map((r) => r.webhook_id))];
  const nomesInteg = {};
  const nomesWh = {};
  if (integIds.length) {
    const ii = await adminFetch(`integracoes?id=in.(${integIds.join(",")})&select=id,nome`);
    for (const r of ii || []) nomesInteg[r.id] = r.nome;
  }
  if (whIds.length) {
    const ww = await adminFetch(`webhooks?id=in.(${whIds.join(",")})&select=id,nome`);
    for (const r of ww || []) nomesWh[r.id] = r.nome;
  }
  const enriched = rows.map((r) => ({
    ...r,
    integracao_nome: r.integracao_id ? nomesInteg[r.integracao_id] || null : null,
    webhook_nome: r.webhook_id ? nomesWh[r.webhook_id] || null : null,
  }));

  return Response.json({ rows: enriched });
}
