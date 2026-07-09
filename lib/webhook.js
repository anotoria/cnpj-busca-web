// Envio de leads por Webhook (POST JSON) — com validação SSRF.

const TIPO_SOCIO = { "1": "Pessoa Jurídica", "2": "Pessoa Física", "3": "Estrangeiro" };
const FAIXA_ETARIA = {
  "0": "Não se aplica",
  "1": "0 a 12 anos", "2": "13 a 20 anos", "3": "21 a 30 anos",
  "4": "31 a 40 anos", "5": "41 a 50 anos", "6": "51 a 60 anos",
  "7": "61 a 70 anos", "8": "71 a 80 anos", "9": "Maiores de 80 anos",
};

// Hosts/IPs bloqueados para SSRF (loopback, redes privadas, link-local, metadata).
function ipEhInterno(host) {
  if (!host) return true;
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) return true;
  if (h.endsWith(".internal") || h.endsWith(".intranet")) return true;
  // Nosso VPS/Supabase — bloqueia auto-envio.
  if (h === "srv521433.hstgr.cloud") return true;
  // AWS/Azure/GCP metadata endpoints.
  if (h === "169.254.169.254" || h === "metadata.google.internal") return true;
  // IPv4 numerico
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [parseInt(m[1], 10), parseInt(m[2], 10)];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // link-local
    if (a >= 224) return true; // multicast/reservado
  }
  // IPv6 loopback/link-local.
  if (h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  return false;
}

// Retorna { ok: true } ou { ok: false, error }.
export function validateWebhookUrl(raw) {
  if (!raw || typeof raw !== "string") return { ok: false, error: "URL vazia." };
  let u;
  try { u = new URL(raw.trim()); } catch { return { ok: false, error: "URL inválida." }; }
  if (u.protocol !== "https:") return { ok: false, error: "Somente URLs HTTPS são aceitas." };
  if (ipEhInterno(u.hostname)) return { ok: false, error: "URL aponta para um endereço interno ou reservado." };
  return { ok: true };
}

// Monta o payload JSON completo (empresa + sócios) que vai no POST.
export function buildPayload(empresa, socios, qualMap, extra = {}) {
  const empresaObj = {};
  const keys = [
    "cnpj_formatado", "razao_social", "nome_fantasia", "situacao_descricao",
    "uf", "municipio_nome", "cnae_fiscal_principal", "cnae_principal_descricao",
    "porte_descricao", "capital_social", "data_inicio_atividade",
    "logradouro", "numero", "bairro", "cep",
    "ddd_1", "telefone_1", "correio_eletronico",
    "opcao_pelo_simples", "opcao_pelo_mei",
  ];
  for (const k of keys) empresaObj[k] = empresa[k] ?? null;

  const sociosArr = (socios || []).map((s) => ({
    nome: s.nome_socio ?? null,
    cpf_cnpj: s.cnpj_cpf_do_socio ?? null,
    tipo: TIPO_SOCIO[s.identificador_de_socio] ?? null,
    qualificacao: qualMap[s.qualificacao_do_socio] || s.qualificacao_do_socio || null,
    data_entrada: s.data_entrada_sociedade ?? null,
    faixa_etaria: FAIXA_ETARIA[s.faixa_etaria] ?? null,
  }));

  return {
    origem: "Prospect AI",
    enviado_em: new Date().toISOString(),
    empresa: empresaObj,
    total_socios: sociosArr.length,
    socios: sociosArr,
    ...extra,
  };
}

const UA = "Prospect-AI-Webhook/1.0";

// Faz o POST. Retorna { status: "enviado"|"erro", http_status, error, snippet }.
export async function postWebhook(url, payload, { timeoutMs = 15000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": UA },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
      cache: "no-store",
      redirect: "manual", // não seguir redirect (evita SSRF por redirect)
    });
    let snippet = "";
    try { snippet = (await res.text()).slice(0, 300); } catch {}
    const ok = res.status >= 200 && res.status < 300;
    return {
      status: ok ? "enviado" : "erro",
      http_status: res.status,
      error: ok ? null : `HTTP ${res.status}${snippet ? ": " + snippet.slice(0, 150) : ""}`,
      snippet,
    };
  } catch (e) {
    const msg = e.name === "AbortError" ? "timeout ao enviar (15s)" : String(e.message || e).slice(0, 200);
    return { status: "erro", http_status: null, error: msg, snippet: null };
  } finally {
    clearTimeout(timer);
  }
}
