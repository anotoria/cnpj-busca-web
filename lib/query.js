// Constrói os parâmetros de consulta do PostgREST a partir dos filtros do formulário.
// Usado tanto pela busca (JSON) quanto pela exportação (CSV).

// Colunas retornadas, na ordem que aparece na tabela e no CSV.
export const SELECT_COLUMNS = [
  "cnpj_formatado",
  "razao_social",
  "nome_fantasia",
  "situacao_descricao",
  "uf",
  "municipio_nome",
  "cnae_fiscal_principal",
  "cnae_principal_descricao",
  "porte_descricao",
  "capital_social",
  "data_inicio_atividade",
  "logradouro",
  "numero",
  "bairro",
  "cep",
  "ddd_1",
  "telefone_1",
  "correio_eletronico",
  "opcao_pelo_simples",
  "opcao_pelo_mei",
];

function ilikeValue(term) {
  // PostgREST usa * como curinga. Escapa vírgulas para não quebrar o or().
  return `*${String(term).trim().replace(/,/g, "")}*`;
}

// filters: objeto com chaves possíveis:
//   uf, municipio, cnae, situacao, termo, porte, simples, mei, somenteMatriz
// Retorna uma instância de URLSearchParams (sem limit/offset).
export function buildSearchParams(filters) {
  const p = new URLSearchParams();
  p.set("select", SELECT_COLUMNS.join(","));

  if (filters.uf) p.append("uf", `eq.${String(filters.uf).toUpperCase()}`);

  if (filters.municipioCodes && filters.municipioCodes.length) {
    // Filtra pelo código (coluna indexada) — bem mais rápido que ilike no nome.
    p.append("municipio", `in.(${filters.municipioCodes.join(",")})`);
  } else if (filters.municipio) {
    p.append("municipio_nome", `ilike.${ilikeValue(filters.municipio)}`);
  }

  if (filters.cnaeCodes && filters.cnaeCodes.length) {
    // Vários CNAEs do mesmo nicho — coluna indexada, busca rápida.
    p.append("cnae_fiscal_principal", `in.(${filters.cnaeCodes.join(",")})`);
  } else if (filters.cnae) {
    p.append("cnae_fiscal_principal", `eq.${String(filters.cnae).replace(/\D/g, "")}`);
  }

  if (filters.situacao) p.append("situacao_cadastral", `eq.${filters.situacao}`);

  if (filters.porte) p.append("porte", `eq.${filters.porte}`);

  if (filters.simples === true || filters.simples === "S") {
    p.append("opcao_pelo_simples", "eq.S");
  }
  if (filters.mei === true || filters.mei === "S") {
    p.append("opcao_pelo_mei", "eq.S");
  }

  if (filters.somenteMatriz === true || filters.somenteMatriz === "1") {
    p.append("cnpj_ordem", "eq.0001");
  }

  // Telefone / e-mail: "com" = preenchido; "sem" = vazio (NULL). O pipeline
  // converte strings vazias em NULL, então is.null cobre os dois casos.
  if (filters.telefone === "com") p.append("telefone_1", "not.is.null");
  else if (filters.telefone === "sem") p.append("telefone_1", "is.null");

  if (filters.email === "com") p.append("correio_eletronico", "not.is.null");
  else if (filters.email === "sem") p.append("correio_eletronico", "is.null");

  if (filters.termo) {
    const v = ilikeValue(filters.termo);
    p.append("or", `(razao_social.ilike.${v},nome_fantasia.ilike.${v})`);
  }

  // Sem ORDER BY global: ordenar milhões de linhas estoura o statement_timeout.
  // Com LIMIT, o Postgres retorna assim que junta as primeiras páginas.
  return p;
}

// Corpo do RPC busca_por_termo — caminho indexado para busca textual quando a
// consulta direta (OR entre razao_social e nome_fantasia, tabelas diferentes)
// estoura o timeout por não conseguir usar os índices trigram.
export function rpcBodyFromFilters(filters, limit, offset = 0) {
  return {
    p_termo: String(filters.termo || "").trim().replace(/[%_]/g, ""),
    p_uf: filters.uf ? String(filters.uf).toUpperCase() : null,
    p_municipios: filters.municipioCodes && filters.municipioCodes.length ? filters.municipioCodes : null,
    p_cnaes: filters.cnaeCodes && filters.cnaeCodes.length ? filters.cnaeCodes : null,
    p_situacao: filters.situacao || null,
    p_porte: filters.porte || null,
    p_simples: !!filters.simples,
    p_mei: !!filters.mei,
    p_matriz: !!filters.somenteMatriz,
    p_telefone: filters.telefone === "com" || filters.telefone === "sem" ? filters.telefone : null,
    p_email: filters.email === "com" || filters.email === "sem" ? filters.email : null,
    p_limit: limit,
    p_offset: offset,
  };
}
