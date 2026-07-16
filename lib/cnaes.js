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

// Palavras vazias que nao ajudam a distinguir atividades.
const STOPWORDS = new Set(["de", "da", "do", "das", "dos", "e", "em", "com", "para", "a", "o", "as", "os", "por"]);

// Um token "casa" com a descricao se ele (ou um radical dele, cortando o fim
// ate 4 letras) aparece no texto normalizado. Cobre plural/flexoes simples:
// "clinicas" -> "clinic", "farmacias" -> "farmac".
function tokenMatches(norm, token) {
  for (let t = token; t.length >= Math.min(4, token.length); t = t.slice(0, -1)) {
    if (norm.includes(t)) return true;
    if (t.length <= 4) break;
  }
  return false;
}

// Busca CNAEs por "nicho". Tenta na ordem:
// 1. frase inteira como digitada (normalizada);
// 2. sinonimos populares (pet shop -> animais de estimacao);
// 3. por palavras: pontua cada CNAE pelo numero de tokens que casam (com
//    radical) e retorna os melhores. Assim "clinicas de estetica" encontra
//    "Atividades de estetica..." mesmo sem a palavra "clinica" na descricao.
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
    const tokens = q.split(/\s+/).filter((t) => t.length >= 3 && !STOPWORDS.has(t));
    if (tokens.length > 0) {
      found = cnaes
        .map((c) => ({ c, score: tokens.reduce((n, t) => n + (tokenMatches(c.norm, t) ? 1 : 0), 0) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((x) => x.c);
    }
  }

  return found.slice(0, max).map(({ codigo, descricao }) => ({ codigo, descricao }));
}

// Lista completa (para o seletor de Atividade/Nicho no front).
export async function listCnaes() {
  const cnaes = await allCnaes();
  return cnaes.map(({ codigo, descricao }) => ({ codigo, descricao }));
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
