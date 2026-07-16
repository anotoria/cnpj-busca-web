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

// Um token "casa" com a descricao se ele (ou um radical dele, cortando ate 3
// letras do fim, nunca abaixo de 4) aparece no texto normalizado. Cobre
// plural/flexoes simples ("clinicas" -> "clinic", "farmacias" -> "farmac")
// sem radicais curtos demais ("restaurantes" nao vira "rest").
function tokenMatches(norm, token) {
  const minLen = Math.max(4, token.length - 3);
  if (token.length < minLen) return norm.includes(token);
  for (let t = token; t.length >= minLen; t = t.slice(0, -1)) {
    if (norm.includes(t)) return true;
  }
  return false;
}

// Busca CNAEs por "nicho", MESCLANDO tres niveis (nesta ordem de prioridade):
// 1. frase inteira como digitada (normalizada);
// 2. sinonimos populares (pet shop -> animais de estimacao);
// 3. por palavras: pontua cada CNAE pelo numero de tokens que casam (com radical).
// Mesclar e importante: "clinicas de estetica" casa exato com o CNAE novo
// 9609-2/01 (quase sem empresas na base), mas as clinicas reais estao no
// codigo antigo 9602-5/02 ("Atividades de estetica..."), que so aparece via
// tokens. Parar no primeiro nivel devolvia 0 resultados.
export async function searchCnaes(term, max = 20) {
  const cnaes = await allCnaes();
  const q = normalize(term);
  if (!q) return [];

  const out = [];
  const seen = new Set();
  const push = (c) => {
    if (!seen.has(c.codigo)) {
      seen.add(c.codigo);
      out.push(c);
    }
  };

  cnaes.filter((c) => c.norm.includes(q)).forEach(push);

  for (const [re, alias] of ALIASES) {
    if (re.test(q)) {
      cnaes.filter((c) => c.norm.includes(alias)).forEach(push);
      break;
    }
  }

  const tokens = q.split(/\s+/).filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  if (tokens.length > 0) {
    cnaes
      .map((c) => ({ c, score: tokens.reduce((n, t) => n + (tokenMatches(c.norm, t) ? 1 : 0), 0) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .forEach((x) => push(x.c));
  }

  return out.slice(0, max).map(({ codigo, descricao }) => ({ codigo, descricao }));
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
