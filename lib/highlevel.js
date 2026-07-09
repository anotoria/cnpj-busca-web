// Integração com o HighLevel (LeadConnector) — envia 1 Business (empresa) +
// N Contacts (empresa como contato principal + sócios) para uma subconta.
// Porte do serviço do SearchAI, adaptado aos dados de CNPJ.
//
// IMPORTANTE: o Cloudflare do HighLevel bloqueia requisições sem User-Agent
// de navegador (erro 1010). Todo request leva o header UA abaixo.

const REST = "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function headers(token) {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    Version: VERSION,
    "User-Agent": UA,
  };
}

async function ghlFetch(token, method, path, body) {
  const res = await fetch(`${REST}${path}`, {
    method,
    headers: headers(token),
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json, text };
}

// ---------------- Teste de conexão ----------------

export async function testConnection(token, locationId) {
  // GET da própria location valida token + subconta.
  const r = await ghlFetch(token, "GET", `/locations/${locationId}`);
  if (r.ok && r.json && r.json.location) {
    return { ok: true, nome: r.json.location.name || null };
  }
  const msg =
    r.status === 401 || r.status === 403
      ? "Token inválido ou sem acesso a esta subconta."
      : `HighLevel ${r.status}: ${(r.text || "").slice(0, 160)}`;
  return { ok: false, error: msg };
}

// ---------------- Custom fields (auto-criação) ----------------

// Campos que criamos na subconta (modelo contact). name = rótulo no GHL.
// A chave do map é o "código interno" usado pelos builders.
const CF_DEFS = [
  ["cnpj", "Prospect AICNPJ"],
  ["razao_social", "Prospect AIRazao Social"],
  ["nome_fantasia", "Prospect AINome Fantasia"],
  ["situacao", "Prospect AISituacao Cadastral"],
  ["cnae_codigo", "Prospect AICNAE Codigo"],
  ["cnae_descricao", "Prospect AICNAE Descricao"],
  ["natureza", "Prospect AINatureza Juridica"],
  ["porte", "Prospect AIPorte"],
  ["capital", "Prospect AICapital Social"],
  ["municipio", "Prospect AIMunicipio"],
  ["uf", "Prospect AIUF"],
  ["data_inicio", "Prospect AIData Inicio Atividade"],
  ["matriz_filial", "Prospect AIMatriz ou Filial"],
  ["simples", "Prospect AIOptante Simples"],
  ["mei", "Prospect AIOptante MEI"],
  ["socios", "Prospect AISocios"],
  ["socio_qualificacao", "Prospect AIQualificacao do Socio"],
  ["origem", "Prospect AIOrigem"],
  ["importado_em", "Prospect AIImportado em"],
];

// Cache por (token|location) → { code: fieldKeySemPrefixo }
const _cfCache = new Map();

export async function ensureCustomFields(token, locationId) {
  const cacheKey = `${token}|${locationId}`;
  if (_cfCache.has(cacheKey)) return _cfCache.get(cacheKey);

  const existing = await ghlFetch(token, "GET", `/locations/${locationId}/customFields?model=contact`);
  const byName = new Map();
  if (existing.ok && existing.json && Array.isArray(existing.json.customFields)) {
    for (const f of existing.json.customFields) {
      if (f.name) byName.set(f.name.trim().toLowerCase(), f.fieldKey);
    }
  }

  const map = {};
  for (const [code, name] of CF_DEFS) {
    let fieldKey = byName.get(name.toLowerCase());
    if (!fieldKey) {
      const created = await ghlFetch(token, "POST", `/locations/${locationId}/customFields`, {
        name,
        dataType: "TEXT",
        model: "contact",
      });
      fieldKey = created.json && created.json.customField && created.json.customField.fieldKey;
    }
    if (fieldKey) {
      // Remove o prefixo "contact." — o upsert usa a chave sem prefixo.
      map[code] = fieldKey.replace(/^contact\./, "");
    }
  }
  _cfCache.set(cacheKey, map);
  return map;
}

// ---------------- Helpers ----------------

function splitName(full) {
  const parts = String(full || "").trim().split(/\s+/);
  if (parts.length <= 1) return [String(full || "").trim(), ""];
  return [parts[0], parts.slice(1).join(" ")];
}

const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

function slug(s) {
  return (
    String(s || "")
      .normalize("NFD")
      .replace(DIACRITICS, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase() || "anon"
  );
}

function foneCompleto(ddd, tel) {
  const d = String(ddd || "").replace(/\D/g, "");
  const t = String(tel || "").replace(/\D/g, "");
  if (!t) return null;
  return d ? `+55${d}${t}` : t;
}

function cfArray(map, pairs) {
  const arr = [];
  for (const [code, value] of pairs) {
    if (value === null || value === undefined || value === "") continue;
    const key = map[code];
    if (key) arr.push({ key, field_value: String(value) });
  }
  return arr;
}

function cfArrayToObject(arr) {
  const o = {};
  for (const it of arr) o[it.key] = it.field_value;
  return o;
}

// Custom fields comuns da empresa (replicados em todos os contatos).
function empresaCF(map, e) {
  return cfArray(map, [
    ["cnpj", e.cnpj_formatado || e.cnpj],
    ["razao_social", e.razao_social],
    ["nome_fantasia", e.nome_fantasia],
    ["situacao", e.situacao_descricao],
    ["cnae_codigo", e.cnae_fiscal_principal],
    ["cnae_descricao", e.cnae_principal_descricao],
    ["natureza", e.natureza_juridica_descricao || e.natureza_juridica],
    ["porte", e.porte_descricao],
    ["capital", e.capital_social],
    ["municipio", e.municipio_nome],
    ["uf", e.uf],
    ["data_inicio", e.data_inicio_atividade],
    ["matriz_filial", e.matriz_filial],
    ["simples", e.opcao_pelo_simples],
    ["mei", e.opcao_pelo_mei],
    ["socios", (e.socios || []).map((s) => s.nome).filter(Boolean).join("\n")],
    ["origem", "Prospect AI"],
    ["importado_em", new Date().toISOString().slice(0, 19)],
  ]);
}

// ---------------- Business (empresa) ----------------

async function findBusinessByName(token, locationId, name) {
  const r = await ghlFetch(token, "GET", `/businesses/?locationId=${encodeURIComponent(locationId)}`);
  if (!r.ok || !r.json) return null;
  const items = r.json.businesses || r.json.data || [];
  const target = String(name || "").trim().toLowerCase();
  for (const b of items) if ((b.name || "").trim().toLowerCase() === target) return b;
  return null;
}

async function upsertBusiness(token, locationId, e) {
  const razao = (e.razao_social || e.nome_fantasia || "").trim();
  if (!razao) return { id: null, error: "Empresa sem razão social" };

  const existing = await findBusinessByName(token, locationId, razao);
  let businessId = existing ? existing.id : null;

  const rich = { locationId, name: razao };
  const email = e.correio_eletronico || null;
  const phone = foneCompleto(e.ddd_1, e.telefone_1);
  if (email) rich.email = email;
  if (phone) rich.phone = phone;
  const addr = [e.logradouro, e.numero, e.bairro].filter(Boolean).join(", ");
  if (addr) rich.address = addr;
  if (e.municipio_nome) rich.city = e.municipio_nome;
  if (e.uf) rich.state = e.uf;
  if (e.cep) rich.postalCode = String(e.cep);

  if (!businessId) {
    const r = await ghlFetch(token, "POST", "/businesses/", { locationId, name: razao });
    if (r.ok && r.json) businessId = (r.json.business && r.json.business.id) || r.json.id || null;
    else if (r.status === 409 || r.status === 422) {
      const again = await findBusinessByName(token, locationId, razao);
      businessId = again ? again.id : null;
    } else {
      return { id: null, error: `Business ${r.status}: ${(r.text || "").slice(0, 120)}` };
    }
  }
  if (!businessId) return { id: null, error: "Não foi possível criar a empresa" };

  // PUT enriquecido (sem locationId no body — o PUT rejeita).
  const putBody = { ...rich };
  delete putBody.locationId;
  await ghlFetch(token, "PUT", `/businesses/${businessId}`, putBody);
  return { id: businessId, error: null };
}

// ---------------- Contact ----------------

async function upsertContact(token, locationId, businessId, contato, cf, usedEmails) {
  const [first, last] = splitName(contato.nome);
  const body = { locationId, firstName: first, lastName: last, source: "Prospect AI" };

  let email = (contato.email || "").trim().toLowerCase() || null;
  const phone = contato.phone || null;
  if (email && usedEmails.has(email)) email = null;
  if (!email && !phone) {
    email = `${contato.emailBase}@prospectai.local`.toLowerCase();
    let i = 2;
    while (usedEmails.has(email)) email = `${contato.emailBase}_${i++}@prospectai.local`.toLowerCase();
  }
  if (email) {
    body.email = email;
    usedEmails.add(email);
  }
  if (phone) body.phone = phone;
  if (contato.companyName) body.companyName = contato.companyName;
  body.tags = contato.tags || ["prospectai"];

  // Cascata de formatos de customFields.
  const formats = cf && cf.length ? ["array", "object", "none"] : ["none"];
  let contactId = null;
  let lastErr = null;
  for (const fmt of formats) {
    const payload = { ...body };
    if (fmt === "array") payload.customFields = cf;
    else if (fmt === "object") payload.customFields = cfArrayToObject(cf);
    const r = await ghlFetch(token, "POST", "/contacts/upsert", payload);
    if (r.ok && r.json) {
      contactId = (r.json.contact && r.json.contact.id) || r.json.id || null;
      if (contactId) break;
    }
    lastErr = `Contact ${r.status}: ${(r.text || "").slice(0, 120)}`;
    if ([401, 403, 500, 502, 503].includes(r.status)) break;
  }
  if (!contactId) return { id: null, error: lastErr };

  // Linka o contato à empresa.
  if (businessId) {
    await ghlFetch(token, "PUT", `/contacts/${contactId}`, { businessId });
  }
  return { id: contactId, error: null };
}

// ---------------- Envio de um lead (empresa) ----------------

const MAX_SOCIOS = 15;

export async function sendLead(token, locationId, cfMap, e) {
  const errors = [];
  const contactIds = [];

  const { id: businessId, error: bErr } = await upsertBusiness(token, locationId, e);
  if (bErr) errors.push(bErr);
  if (!businessId) {
    return { status: "erro", business_id: null, contact_ids: [], error: bErr || "Falha na empresa" };
  }

  const cfBase = empresaCF(cfMap, e);
  const usedEmails = new Set();

  // Contato principal = a própria empresa (telefone/e-mail da empresa).
  const razao = (e.razao_social || e.nome_fantasia || "").trim();
  const cnpjDigits = String(e.cnpj || e.cnpj_formatado || "").replace(/\D/g, "");
  const principal = await upsertContact(
    token,
    locationId,
    businessId,
    {
      nome: razao,
      email: e.correio_eletronico,
      phone: foneCompleto(e.ddd_1, e.telefone_1),
      companyName: razao,
      emailBase: `empresa.${cnpjDigits || slug(razao)}`,
      tags: ["prospectai", "empresa"],
    },
    cfBase,
    usedEmails
  );
  if (principal.id) contactIds.push(principal.id);
  if (principal.error) errors.push(`empresa: ${principal.error}`);

  // Sócios (nome apenas; e-mail sintético). Replica dados da empresa + qualificação.
  const socios = (e.socios || []).slice(0, MAX_SOCIOS);
  for (const s of socios) {
    const nome = (s.nome || "").trim();
    if (!nome) continue;
    const cfSocio = cfBase.concat(cfArray(cfMap, [["socio_qualificacao", s.qualificacao]]));
    const r = await upsertContact(
      token,
      locationId,
      businessId,
      {
        nome,
        companyName: razao,
        emailBase: `socio.${slug(nome)}.${cnpjDigits.slice(0, 8) || "x"}`,
        tags: ["prospectai", "socio"],
      },
      cfSocio,
      usedEmails
    );
    if (r.id) contactIds.push(r.id);
    if (r.error) errors.push(`sócio ${nome}: ${r.error}`);
  }

  const status = contactIds.length && !errors.length ? "enviado" : contactIds.length ? "parcial" : "erro";
  return {
    status,
    business_id: businessId,
    contact_ids: contactIds,
    error: errors.length ? errors.join("; ").slice(0, 500) : null,
  };
}
