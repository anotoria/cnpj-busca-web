import { requireAdmin } from "../../../../lib/guard";
import { adminFetch, adminWrite, audit } from "../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

const EM_ANDAMENTO = ["solicitado", "baixando", "mesclando"];

// Status: último job + histórico recente.
export async function GET() {
  const g = await requireAdmin();
  if (!g.ok) return g.response;
  const rows = await adminFetch(
    "update_jobs?select=id,mes,forcar,status,fase,solicitado_em,iniciado_em,terminado_em,contadores,erro,log&order=solicitado_em.desc&limit=20"
  );
  const rodando = rows.find((r) => EM_ANDAMENTO.includes(r.status)) || null;
  return Response.json({ rows, rodando });
}

// Enfileira uma atualização (um job por vez).
export async function POST(request) {
  const g = await requireAdmin();
  if (!g.ok) return g.response;
  try {
    const body = await request.json().catch(() => ({}));
    const forcar = body.forcar === true;
    const mes = typeof body.mes === "string" && /^\d{4}-\d{2}$/.test(body.mes) ? body.mes : null;

    // Bloqueia se já houver um job em andamento.
    const ativos = await adminFetch(
      `update_jobs?status=in.(${EM_ANDAMENTO.join(",")})&select=id&limit=1`
    );
    if (ativos.length > 0) {
      return Response.json(
        { error: "Já existe uma atualização em andamento. Aguarde ela terminar." },
        { status: 409 }
      );
    }

    const [job] = await adminWrite(
      "update_jobs",
      "POST",
      { mes, forcar, status: "solicitado", solicitado_por: g.access.userId },
      "return=representation"
    );
    audit(g.access.userId, "atualizar_base", { job_id: job.id, mes, forcar });
    return Response.json({ ok: true, job });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
