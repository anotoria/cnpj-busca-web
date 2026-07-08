import { requireApproved } from "../../../../lib/guard";
import { adminFetch } from "../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

// Status de envio (mais recente) para uma lista de CNPJs do usuário.
// GET /api/integracoes/enviados?cnpjs=111,222,...  → { status: { cnpj: "enviado"|"parcial"|"erro" } }
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
    `crm_envios?user_id=eq.${g.access.userId}&cnpj=in.(${lista.join(",")})&select=cnpj,status,criado_em&order=criado_em.desc`
  );
  const status = {};
  for (const r of rows || []) {
    // Mantém o status do envio mais recente (rows já vem desc).
    if (!(r.cnpj in status)) status[r.cnpj] = r.status;
  }
  return Response.json({ status });
}
