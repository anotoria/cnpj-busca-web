import { requireApproved } from "../../../../lib/guard";
import { adminFetch } from "../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

// Status de envio (mais recente por canal) para uma lista de CNPJs do usuário.
// Retorna: { status: { cnpj: { highlevel?: "enviado"|"parcial"|"erro", webhook?: "..." } } }
export async function GET(request) {
  const g = await requireApproved();
  if (!g.ok) return g.response;
  const { searchParams } = new URL(request.url);
  const lista = (searchParams.get("cnpjs") || "")
    .split(",")
    .map((c) => c.replace(/\D/g, ""))
    .filter(Boolean);
  if (!lista.length) return Response.json({ status: {} });

  const rows = await adminFetch(
    `crm_envios?user_id=eq.${g.access.userId}&cnpj=in.(${lista.join(",")})&select=cnpj,canal,status,criado_em&order=criado_em.desc`
  );
  const status = {};
  for (const r of rows || []) {
    const canal = r.canal || "highlevel";
    if (!status[r.cnpj]) status[r.cnpj] = {};
    if (!status[r.cnpj][canal]) status[r.cnpj][canal] = r.status; // 1o (desc) = mais recente
  }
  return Response.json({ status });
}
