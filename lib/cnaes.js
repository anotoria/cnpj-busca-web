// Busca de CNAEs por "nicho" (texto livre: farmacias, imobiliarias, pet shops...).
// A tabela cnaes tem so 1.359 linhas - carregamos uma vez e filtramos em memoria,
// com normalizacao de acentos, reducao de radical e sinonimos populares.

import { restHeaders, restUrl } from "./supabase";

let _cache = null;
let _cacheAt = 0;
const CACHE_MS = 6 * 60 * 60 * 1000; // 6h

// Sinonimos/nichos populares -> termo que existe nas descricoes oficiais dos CNAEs.
const ALIASES = [
  [/\bpet ?shops?\b|\bpets?\b/, "animais de estimacao"],
  [/\bacademias?\b/, "condicionamento fisico"],
  [/\bmercados?\b|\bsupermercados?\b|\bmercearias?\b/, "mercadorias em geral"],
  [/\boficinas?\b/, "manutencao e reparacao de veiculos"],
  [/\bsalo(es|ao) de beleza\b|\bcabeleireir/, "cabeleireiro"],
  [/\bimobiliarias?\b/, "imoveis"],
  [/\btransportadoras?\b/, "transporte rodoviario de carga"],
  [/\bautoescolas?\b|\bauto escolas?\b/, "formacao de condutores"],
];

// Remove acentos (NFD separa o diacritico; a faixa U+0300-U+036F os elimina).
const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

export function normalize(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .trim();
}

async function allCnaes() {
  const now = Date.now();
  if (_cache && now - _cacheAt < CACHE_MS) return _cache;
  const p = new URLSearchParams();
  p.set("select", "codigo,descricao");
  p.set("limit", "5000");
  const res = await fetch(restUrl(`cnaes?${p.toString()}`), {
    headers: restHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Falha ao carregar CNAEs: ${res.status}`);
  const rows = await res.json();
  _cache = rows.map((r) => ({ ...r, norm: normalize(r.descricao) }));
  _cacheAt = now;
  return _cache;
}

// Busca CNAEs cujo descritivo contem o termo. Tenta na ordem:
// 1. termo como digitado (normalizado);
// 2. sinonimos populares (pet shop -> animais de estimacao);
// 3. radical: vai cortando o fim do termo (farmacias -> farmac...) ate casar.
export async function searchCnaes(term, max = 20) {
  const cnaes = await allCnaes();
  const q = normalize(term);
  if (!q) return [];

  const matches = (t) => cnaes.filter((c) => c.norm.includes(t));

  let found = matches(q);

  if (found.length === 0) {
    for (const [re, alias] of ALIASES) {
      if (re.test(q)) {
        found = matches(alias);
        break;
      }
    }
  }

  if (found.length === 0) {
    for (let t = q.slice(0, -1); t.length >= 4; t = t.slice(0, -1)) {
      found = matches(t);
      if (found.length > 0) break;
    }
  }

  return found.slice(0, max).map(({ codigo, descricao }) => ({ codigo, descricao }));
}

// Resolve o texto do filtro CNAE para codigos. Codigo de 7 digitos passa direto.
export async function resolveCnaeCodes(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  const digits = raw.replace(/[.\-\/\s]/g, "");
  if (/^\d{7}$/.test(digits)) return [digits];
  const found = await searchCnaes(raw, 200);
  return found.map((c) => c.codigo);
}
