# Busca CNPJ — App Web

Interface de pesquisa das empresas da Receita Federal (dados no Supabase), com filtros e exportação de CSV que baixa **na máquina local** do usuário.

Construído em Next.js (App Router), pronto para deploy na **Vercel**.

## Como funciona

- O navegador conversa apenas com as rotas `/api` deste app.
- As rotas no servidor consultam a **API REST do Supabase** (PostgREST) na view `vw_busca_empresas`.
- A chave do Supabase fica só no servidor (variável de ambiente), nunca no navegador.
- `/api/buscar` → resultados paginados (JSON) para a tabela na tela.
- `/api/exportar` → gera o CSV (até 50.000 linhas) e o navegador baixa o arquivo localmente.

## Rodar localmente

Requer Node.js 18+.

```bash
cp .env.local.example .env.local   # e preencha SUPABASE_KEY (anon key)
npm install
npm run dev
# abre http://localhost:3000
```

## Deploy na Vercel

1. Suba esta pasta (`cnpj-busca-web`) para um repositório no GitHub.
2. Na Vercel: **Add New Project** → importe o repositório.
3. Em **Environment Variables**, defina:
   - `SUPABASE_URL` = `https://srv521433.hstgr.cloud`
   - `SUPABASE_KEY` = a **anon key** do seu Supabase
   - `SUPABASE_SERVICE_KEY` = a **service_role key** (usada só na exportação CSV, que precisa de consultas longas)
4. Deploy. Pronto.

> A anon key dá apenas leitura (SELECT) das tabelas públicas de CNPJ. Os dados da Receita são públicos.

## Filtros disponíveis

- Razão social / nome fantasia (texto)
- UF, Município (nome), CNAE principal (código)
- Situação cadastral, Porte
- Optante do Simples, MEI, "somente matriz"

## Colunas exportadas no CSV

CNPJ, razão social, nome fantasia, situação, UF, município, CNAE + descrição,
porte, capital social, data de início, endereço, CEP, telefone, e-mail, Simples/MEI.
