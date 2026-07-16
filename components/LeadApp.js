"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase-browser";

const SITUACOES = [
  { v: "", t: "Todas" },
  { v: "02", t: "Ativa" },
  { v: "08", t: "Baixada" },
  { v: "03", t: "Suspensa" },
  { v: "04", t: "Inapta" },
  { v: "01", t: "Nula" },
];

const PORTES = [
  { v: "", t: "Todos" },
  { v: "01", t: "Microempresa (ME)" },
  { v: "03", t: "Pequeno Porte (EPP)" },
  { v: "05", t: "Demais" },
  { v: "00", t: "Não informado" },
];

const UFS = [
  "", "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS",
  "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

const COLS = [
  ["cnpj_formatado", "CNPJ"],
  ["razao_social", "Razão Social"],
  ["nome_fantasia", "Nome Fantasia"],
  ["situacao_descricao", "Situação"],
  ["uf", "UF"],
  ["municipio_nome", "Município"],
  ["cnae_fiscal_principal", "CNAE"],
  ["cnae_principal_descricao", "Atividade"],
  ["porte_descricao", "Porte"],
  ["telefone", "Telefone Principal"],
  ["correio_eletronico", "E-mail"],
];

const CONTACT_KEYS = new Set(["telefone", "correio_eletronico"]);

const CHIP_BY_SITUACAO = {
  Ativa: "chip chip-ok",
  Suspensa: "chip chip-warn",
  Baixada: "chip chip-bad",
  Inapta: "chip chip-bad",
  Nula: "chip chip-mut",
};

function cellValue(row, key) {
  if (key === "telefone") {
    if (!row.telefone_1) return "";
    return row.ddd_1 ? `(${row.ddd_1}) ${row.telefone_1}` : row.telefone_1;
  }
  if (key === "situacao_descricao" && row.situacao_descricao) {
    const cls = CHIP_BY_SITUACAO[row.situacao_descricao] || "chip chip-mut";
    return <span className={cls}>{row.situacao_descricao}</span>;
  }
  return row[key] ?? "";
}

function Toggle({ checked, onChange, children }) {
  return (
    <label className={"toggle" + (checked ? " on" : "")}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="dot" />
      {children}
    </label>
  );
}

const EMPTY = {
  termo: "", uf: "", municipio: "", cnae: "", situacao: "02",
  porte: "", simples: false, mei: false, somenteMatriz: false,
  telefone: "", email: "",
};

const CONTATO_OPCOES = [
  { v: "", t: "Todos" },
  { v: "com", t: "Com" },
  { v: "sem", t: "Sem" },
];

// Contato para assinar o plano (até o gateway de pagamento entrar).
const CONTATO_ASSINATURA =
  "mailto:essahora@gmail.com?subject=Quero%20assinar%20o%20Prospect%20AI&body=Ol%C3%A1!%20Quero%20assinar%20o%20plano%20mensal%20do%20Prospect%20AI.";

// Popup do plano (trial vencido / sem plano).
function PaywallModal({ onClose }) {
  return (
    <>
      <div className="drawer-backdrop" style={{ zIndex: 60 }} onClick={onClose} />
      <div className="paywall">
        <button className="paywall-close" onClick={onClose} aria-label="Fechar">×</button>
        <div className="paywall-icon">🔓</div>
        <h3>Seu período de teste terminou</h3>
        <p>
          Assine e tenha acesso a <strong>toda a base — mais de 68 milhões de empresas</strong>, atualizada todo mês,
          com <strong>pesquisas ilimitadas</strong> por estado ou nicho, contatos completos e exportação em CSV.
        </p>
        <div className="paywall-price">
          <span className="price">R$ 249,90</span>
          <span className="per">/mês</span>
        </div>
        <a className="btn btn-primary btn-full" href={CONTATO_ASSINATURA}>Quero assinar →</a>
        <p className="paywall-note">Enquanto isso, você continua com a versão de leitura (10 resultados, contatos ocultos).</p>
      </div>
    </>
  );
}

export default function LeadApp() {
  const [me, setMe] = useState(null); // {level, role, nome, pendentes}
  const [menuOpen, setMenuOpen] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [hist, setHist] = useState([]);

  const [filters, setFilters] = useState(EMPTY);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(null);
  const [estimativa, setEstimativa] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [demo, setDemo] = useState(false);
  const [aviso, setAviso] = useState("");
  const [municipioOpcoes, setMunicipioOpcoes] = useState([]);
  // Atividade/Nicho: combobox com a lista completa de atividades (carregada no 1º clique).
  const [cnaeLista, setCnaeLista] = useState(null);
  const [cnaeOpen, setCnaeOpen] = useState(false);
  const [cnaeSel, setCnaeSel] = useState(null); // {codigo, descricao} escolhido na lista
  const [paywall, setPaywall] = useState(false);
  const [flash, setFlash] = useState("");
  // Integração (HighLevel e Webhook): seleção e envio.
  const [sel, setSel] = useState(() => new Set());
  const [enviados, setEnviados] = useState({}); // cnpjDigits -> { highlevel?: status, webhook?: status }
  const [envModal, setEnvModal] = useState(null); // null | 'highlevel' | 'webhook'
  const [integracoes, setIntegracoes] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [alvoEnvio, setAlvoEnvio] = useState(""); // id da integracao/webhook escolhido
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState({ feitos: 0, total: 0 });

  const LIMITE_ENVIO = 200;
  const LOTE_ENVIO = 20;
  const cnpjDe = (r) => String(r.cnpj_formatado || "").replace(/\D/g, "");

  // Acesso completo: admin, assinante do plano ou trial vigente.
  const approved = me && (me.level === "approved" || me.level === "trial");

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((m) => {
        setMe(m);
        if (m.level === "expired") setPaywall(true); // popup do plano ao entrar
      })
      .catch(() => setMe({ level: "anon" }));
  }, []);

  // Marca quais CNPJs da página já foram enviados anteriormente.
  useEffect(() => {
    if (demo || !rows.length) return;
    const cnpjs = rows.map(cnpjDe).filter(Boolean);
    if (!cnpjs.length) return;
    fetch(`/api/integracoes/enviados?cnpjs=${cnpjs.join(",")}`)
      .then((r) => r.json())
      .then((d) => setEnviados((prev) => ({ ...prev, ...(d.status || {}) })))
      .catch(() => {});
  }, [rows, demo]);

  function toggleSel(cnpj) {
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(cnpj)) n.delete(cnpj);
      else if (n.size < LIMITE_ENVIO) n.add(cnpj);
      return n;
    });
  }
  function toggleSelPagina() {
    const cnpjs = rows.map(cnpjDe).filter(Boolean);
    const todosSelec = cnpjs.every((c) => sel.has(c));
    setSel((prev) => {
      const n = new Set(prev);
      if (todosSelec) cnpjs.forEach((c) => n.delete(c));
      else for (const c of cnpjs) { if (n.size >= LIMITE_ENVIO) break; n.add(c); }
      return n;
    });
  }

  async function abrirEnvio(canal) {
    try {
      if (canal === "highlevel") {
        const d = await (await fetch("/api/integracoes")).json();
        const ativas = (d.rows || []).filter((i) => i.ativo);
        setIntegracoes(ativas);
        const padrao = ativas.find((i) => i.is_default) || ativas[0];
        setAlvoEnvio(padrao ? padrao.id : "");
      } else {
        const d = await (await fetch("/api/webhooks")).json();
        const ativos = (d.rows || []).filter((w) => w.ativo);
        setWebhooks(ativos);
        setAlvoEnvio(ativos[0] ? ativos[0].id : "");
      }
      setEnvModal(canal);
    } catch {
      setFlash("Erro ao carregar integrações.");
    }
  }

  async function confirmarEnvio() {
    if (!alvoEnvio || !envModal) return;
    const canal = envModal;
    const alvo = [...sel];
    setEnviando(true);
    setProgresso({ feitos: 0, total: alvo.length });
    let ok = 0, parcial = 0, erro = 0;
    const url = canal === "highlevel" ? "/api/integracoes/enviar" : "/api/webhooks/enviar";
    const keyId = canal === "highlevel" ? "integracao_id" : "webhook_id";
    for (let i = 0; i < alvo.length; i += LOTE_ENVIO) {
      const lote = alvo.slice(i, i + LOTE_ENVIO);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [keyId]: alvoEnvio, cnpjs: lote }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Falha no envio");
        setEnviados((prev) => {
          const next = { ...prev };
          for (const r of d.resultados || []) {
            next[r.cnpj] = { ...(next[r.cnpj] || {}), [canal]: r.status };
            if (r.status === "enviado") ok++;
            else if (r.status === "parcial") parcial++;
            else erro++;
          }
          return next;
        });
      } catch (e) {
        setEnviados((prev) => {
          const next = { ...prev };
          for (const c of lote) {
            next[c] = { ...(next[c] || {}), [canal]: "erro" };
            erro++;
          }
          return next;
        });
      }
      setProgresso({ feitos: Math.min(i + LOTE_ENVIO, alvo.length), total: alvo.length });
    }
    setEnviando(false);
    setEnvModal(null);
    setSel(new Set());
    setFlash(`Envio concluído: ${ok} enviados${parcial ? `, ${parcial} parciais` : ""}${erro ? `, ${erro} falharam` : ""}.`);
    setTimeout(() => setFlash(""), 10000);
  }

  async function convidar() {
    setMenuOpen(false);
    try {
      const res = await fetch("/api/convites", { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Não foi possível gerar o convite.");
      const link = `${window.location.origin}/cadastro?convite=${d.token}`;
      await navigator.clipboard.writeText(link);
      setFlash("🎟️ Link de convite copiado! Envie para quem você quer convidar (válido por 7 dias, 1 uso, com 3 dias de teste).");
    } catch (e) {
      setFlash("Erro: " + e.message);
    }
    setTimeout(() => setFlash(""), 10000);
  }

  function set(k, v) {
    setFilters((f) => ({ ...f, [k]: v }));
  }

  async function onMunicipioChange(v) {
    set("municipio", v);
    if (v.trim().length < 2) return setMunicipioOpcoes([]);
    try {
      const d = await (await fetch(`/api/municipios?q=${encodeURIComponent(v)}`)).json();
      setMunicipioOpcoes((d.rows || []).map((m) => m.descricao));
    } catch {
      setMunicipioOpcoes([]);
    }
  }

  // Sem acentos e minúsculo, para o filtro da lista de atividades.
  function normalizar(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  }

  async function abrirCnae() {
    setCnaeOpen(true);
    if (cnaeLista) return;
    try {
      const d = await (await fetch("/api/cnaes?all=1")).json();
      setCnaeLista(d.rows || []);
    } catch {
      setCnaeLista([]);
    }
  }

  function escolherCnae(c) {
    setCnaeSel(c);
    set("cnae", c.codigo); // envia o código exato — busca precisa e rápida
    setCnaeOpen(false);
  }

  function digitarCnae(v) {
    setCnaeSel(null);
    set("cnae", v);
    if (!cnaeOpen) abrirCnae();
  }

  // Texto exibido no campo e lista filtrada pelo que foi digitado.
  const cnaeTexto = cnaeSel ? cnaeSel.descricao : filters.cnae;
  const cnaeFiltradas = (() => {
    if (!cnaeLista) return null;
    const toks = normalizar(cnaeSel ? "" : filters.cnae).split(/\s+/).filter(Boolean);
    const base = toks.length
      ? cnaeLista.filter((c) => {
          const n = normalizar(c.descricao) + " " + c.codigo;
          return toks.every((t) => n.includes(t));
        })
      : cnaeLista;
    return base.slice(0, 200);
  })();

  function toQuery(f, extra = {}) {
    const q = new URLSearchParams();
    if (f.termo) q.set("termo", f.termo);
    if (f.uf) q.set("uf", f.uf);
    if (f.municipio) q.set("municipio", f.municipio);
    if (f.cnae) q.set("cnae", f.cnae);
    if (f.situacao) q.set("situacao", f.situacao);
    if (f.porte) q.set("porte", f.porte);
    if (f.simples) q.set("simples", "1");
    if (f.mei) q.set("mei", "1");
    if (f.somenteMatriz) q.set("somenteMatriz", "1");
    if (f.telefone) q.set("telefone", f.telefone);
    if (f.email) q.set("email", f.email);
    for (const [k, v] of Object.entries(extra)) q.set(k, v);
    return q.toString();
  }

  async function buscar(p = 1, f = filters) {
    const termo = String(f.termo || "").trim();
    if (termo && termo.length < 3) {
      setError("Digite pelo menos 3 letras no campo de busca (ou deixe-o vazio e use os filtros).");
      return;
    }
    setLoading(true);
    setError("");
    setAviso("");
    setSearched(true);
    try {
      const res = await fetch(`/api/buscar?${toQuery(f, { page: p, pageSize })}`);
      // A resposta pode não ser JSON (ex.: página de timeout da Vercel em
      // buscas muito amplas) — trata isso com uma mensagem amigável.
      const texto = await res.text();
      let data;
      try {
        data = JSON.parse(texto);
      } catch {
        throw new Error("A busca demorou demais e foi interrompida. Refine com UF, município ou atividade/nicho e tente de novo.");
      }
      if (!res.ok) throw new Error(data.error || "Erro na busca");
      setRows(data.rows || []);
      setTotal(data.total);
      setEstimativa(data.estimativa);
      setHasMore(!!data.hasMore);
      setDemo(!!data.demo);
      setAviso(data.aviso || "");
      setPage(p);
    } catch (e) {
      setError(e.message);
      setRows([]);
      setTotal(null);
      setEstimativa(null);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }

  function exportar() {
    if (!approved) {
      // Trial vencido: mostra o plano; anônimo/pendente: manda para o login.
      if (me && me.level === "expired") setPaywall(true);
      else window.location.href = "/login?next=/";
      return;
    }
    window.location.href = `/api/exportar?${toQuery(filters)}`;
  }

  async function abrirHistorico() {
    setMenuOpen(false);
    setHistOpen(true);
    try {
      const d = await (await fetch("/api/historico")).json();
      setHist(d.rows || []);
    } catch {
      setHist([]);
    }
  }

  function reexecutar(f) {
    const novo = { ...EMPTY, ...f };
    setFilters(novo);
    // Se o filtro de atividade era um código escolhido na lista, restaura a descrição.
    const achado = cnaeLista && novo.cnae ? cnaeLista.find((c) => c.codigo === String(novo.cnae)) : null;
    setCnaeSel(achado || null);
    setHistOpen(false);
    buscar(1, novo);
  }

  async function sair() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.reload();
  }

  const iniciais = (me && me.nome ? me.nome : "?").slice(0, 1).toUpperCase();
  // Contagem para exibir: exata quando conhecida; senão a estimativa (aproximada).
  const contagem = total != null ? total : estimativa;
  const contagemExata = total != null;

  return (
    <>
      <div className="aura" />
      <div className="page">
        <nav className="nav">
          <div className="brand">
            <span className="brand-mark">◎</span>
            Prospect AI
          </div>
          <div className="nav-actions">
            {!me || me.level === "anon" ? (
              <a className="nav-cta" href="/login">Entrar</a>
            ) : (
              <div style={{ position: "relative" }}>
                <button className="user-chip" onClick={() => setMenuOpen((o) => !o)}>
                  <span className="user-avatar">{iniciais}</span>
                  {me.nome || "Conta"}
                  {me.role === "admin" && me.pendentes > 0 && <span className="badge-count">{me.pendentes}</span>}
                </button>
                {menuOpen && (
                  <div className="menu">
                    <button onClick={abrirHistorico}>🕑 Meu histórico</button>
                    <a href="/configuracoes">⚙️ Integrações</a>
                    {me.podeConvidar && <button onClick={convidar}>🎟️ Convidar (copiar link)</button>}
                    {me.level === "expired" && <button onClick={() => { setMenuOpen(false); setPaywall(true); }}>⭐ Assinar o plano</button>}
                    {me.role === "admin" && <a href="/admin">🛠️ Painel admin{me.pendentes > 0 ? ` (${me.pendentes})` : ""}</a>}
                    <div className="sep" />
                    <button onClick={sair}>↩ Sair</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </nav>

        <header className="hero">
          <div className="eyebrow">Motor de busca de empresas brasileiras</div>
          <h1>
            Prospect AI
            <br />
            <em>Seu futuro cliente está aqui</em>
          </h1>
          <p className="sub">Busque por empresas Brasileiras. Filtre e importe para o seu CRM.</p>
        </header>

        {flash && <div className="pending-banner" style={{ background: "var(--ok-tint)", color: "var(--ok)" }}>{flash}</div>}

        {me && me.level === "pending" && (
          <div className="pending-banner">
            ⏳ Seu cadastro está <strong>aguardando aprovação</strong> do administrador. Enquanto isso, você usa a versão
            demonstração (até 10 resultados, contatos ocultos).
          </div>
        )}

        {me && me.level === "trial" && (
          <div className="pending-banner" style={{ background: "var(--warn-tint)", color: "var(--warn)" }}>
            ⏳ Período de teste: <strong>termina em {me.trialDias} dia{me.trialDias > 1 ? "s" : ""}</strong>. Assine o
            plano para não perder o acesso completo.{" "}
            <a href={CONTATO_ASSINATURA} style={{ color: "var(--primary-deep)", fontWeight: 600 }}>Quero assinar →</a>
          </div>
        )}

        {me && me.level === "expired" && (
          <div className="pending-banner" style={{ background: "var(--bad-tint)", color: "var(--bad)" }}>
            🔒 Seu teste terminou — você está no <strong>modo leitura</strong> (10 resultados, contatos ocultos).{" "}
            <button className="mini-btn" style={{ marginLeft: 6 }} onClick={() => setPaywall(true)}>Ver plano</button>
          </div>
        )}

        <main>
          <form className="search-card" onSubmit={(e) => { e.preventDefault(); buscar(1); }}>
            <div className="search-row">
              <div className="field big-input">
                <input className="input" value={filters.termo} onChange={(e) => set("termo", e.target.value)}
                  placeholder="Razão social ou nome fantasia — ex.: padaria, transportes, tech..." />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Buscando..." : "Buscar →"}
              </button>
            </div>

            <div className="filters-grid">
              <div className="field">
                <label>UF</label>
                <select className="select" value={filters.uf} onChange={(e) => set("uf", e.target.value)}>
                  {UFS.map((uf) => <option key={uf || "todas"} value={uf}>{uf || "Todas"}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Município</label>
                <input className="input" list="municipios-list" value={filters.municipio}
                  onChange={(e) => onMunicipioChange(e.target.value)} placeholder="Digite 2+ letras" />
                <datalist id="municipios-list">{municipioOpcoes.map((m) => <option key={m} value={m} />)}</datalist>
              </div>
              <div className="field combo">
                <label>Atividade / Nicho</label>
                <input
                  className="input combo-input"
                  value={cnaeTexto}
                  onChange={(e) => digitarCnae(e.target.value)}
                  onFocus={abrirCnae}
                  onClick={abrirCnae}
                  onKeyDown={(e) => { if (e.key === "Escape") setCnaeOpen(false); }}
                  onBlur={() => setTimeout(() => setCnaeOpen(false), 150)}
                  placeholder="Clique e escolha na lista..."
                  title={cnaeSel ? `${cnaeSel.descricao} (${cnaeSel.codigo})` : undefined}
                />
                {(cnaeSel || filters.cnae) ? (
                  <button
                    type="button"
                    className="combo-clear"
                    aria-label="Limpar atividade"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setCnaeSel(null); set("cnae", ""); }}
                  >×</button>
                ) : (
                  <span className="combo-caret" aria-hidden="true">▾</span>
                )}
                {cnaeOpen && (
                  <div className="combo-list" onMouseDown={(e) => e.preventDefault()}>
                    {!cnaeFiltradas && <div className="combo-empty">Carregando atividades...</div>}
                    {cnaeFiltradas && cnaeFiltradas.length === 0 && (
                      <div className="combo-empty">Nenhuma atividade com esse texto. Tente outra palavra (ex.: estética, farmácia, transporte).</div>
                    )}
                    {cnaeFiltradas && cnaeFiltradas.map((c) => (
                      <button
                        type="button"
                        key={c.codigo}
                        className={"combo-item" + (cnaeSel && cnaeSel.codigo === c.codigo ? " sel" : "")}
                        onClick={() => escolherCnae(c)}
                      >
                        <span className="combo-desc">{c.descricao}</span>
                        <span className="combo-code">{c.codigo}</span>
                      </button>
                    ))}
                    {cnaeFiltradas && cnaeFiltradas.length === 200 && (
                      <div className="combo-empty">Mostrando as 200 primeiras — digite para refinar.</div>
                    )}
                  </div>
                )}
              </div>
              <div className="field">
                <label>Situação cadastral</label>
                <select className="select" value={filters.situacao} onChange={(e) => set("situacao", e.target.value)}>
                  {SITUACOES.map((s) => <option key={s.v} value={s.v}>{s.t}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Porte</label>
                <select className="select" value={filters.porte} onChange={(e) => set("porte", e.target.value)}>
                  {PORTES.map((s) => <option key={s.v} value={s.v}>{s.t}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Telefone</label>
                <select className="select" value={filters.telefone} onChange={(e) => set("telefone", e.target.value)}>
                  {CONTATO_OPCOES.map((s) => <option key={s.v} value={s.v}>{s.t}</option>)}
                </select>
              </div>
              <div className="field">
                <label>E-mail</label>
                <select className="select" value={filters.email} onChange={(e) => set("email", e.target.value)}>
                  {CONTATO_OPCOES.map((s) => <option key={s.v} value={s.v}>{s.t}</option>)}
                </select>
              </div>
            </div>

            <div className="actions">
              <div className="toggles">
                <Toggle checked={filters.simples} onChange={(v) => set("simples", v)}>Simples</Toggle>
                <Toggle checked={filters.mei} onChange={(v) => set("mei", v)}>MEI</Toggle>
                <Toggle checked={filters.somenteMatriz} onChange={(v) => set("somenteMatriz", v)}>Só matriz</Toggle>
              </div>
              <div style={{ flex: 1 }} />
              <button type="button" className="btn btn-csv" onClick={exportar} disabled={loading || !searched}>
                ⬇ Baixar CSV
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => {
                setFilters(EMPTY); setRows([]); setTotal(null); setSearched(false);
                setCnaeSel(null); setAviso(""); setError("");
              }}>Limpar</button>
            </div>
          </form>

          {error && <div className="error-box">{error}</div>}
          {aviso && !error && <div className="aviso-box">⚠️ {aviso}</div>}

          {searched && !error && (
            <section className="results">
              <div className="results-meta">
                <div className="results-count">
                  {contagem != null
                    ? <><span>{contagemExata ? "" : "~"}{contagem.toLocaleString("pt-BR")}{hasMore ? "+" : ""}</span> empresa{contagem === 1 ? "" : "s"} encontrada{contagem === 1 ? "" : "s"}</>
                    : <><span>{rows.length}</span> resultado(s)</>}
                </div>
                {!contagemExata && contagem != null && <div className="results-hint">contagem estimada</div>}
              </div>

              {!demo && rows.length > 0 && (
                <div className="send-bar">
                  <label className="check-inline">
                    <input
                      type="checkbox"
                      onChange={toggleSelPagina}
                      checked={rows.length > 0 && rows.map(cnpjDe).every((c) => sel.has(c))}
                    />
                    <span>Selecionar página</span>
                  </label>
                  <span className="send-info">
                    {sel.size > 0 ? <><strong>{sel.size}</strong> selecionada{sel.size > 1 ? "s" : ""}</> : "nenhuma selecionada"}
                    {sel.size >= LIMITE_ENVIO && <span className="send-limit"> · limite {LIMITE_ENVIO} atingido</span>}
                  </span>
                  <div style={{ flex: 1 }} />
                  {sel.size > 0 && <button className="btn btn-ghost btn-page" onClick={() => setSel(new Set())}>Limpar seleção</button>}
                  <button
                    className="btn btn-primary btn-page"
                    onClick={() => abrirEnvio("highlevel")}
                    disabled={sel.size === 0}
                    title="Enviar as empresas selecionadas ao HighLevel"
                  >
                    🚀 Enviar ao HighLevel {sel.size > 0 && `(${sel.size})`}
                  </button>
                  <button
                    className="btn btn-webhook btn-page"
                    onClick={() => abrirEnvio("webhook")}
                    disabled={sel.size === 0}
                    title="Enviar as empresas selecionadas para um webhook"
                  >
                    🔗 Enviar ao Webhook {sel.size > 0 && `(${sel.size})`}
                  </button>
                </div>
              )}

              <div className="table-card">
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {!demo && <th style={{ width: 34 }}></th>}
                        {!demo && <th style={{ width: 32 }}></th>}
                        {COLS.map(([, t]) => <th key={t}>{t}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => {
                        const c = cnpjDe(r);
                        const st = enviados[c];
                        const marcado = sel.has(c);
                        return (
                          <tr key={i} className={marcado ? "row-sel" : ""}>
                            {!demo && (
                              <td>
                                <input
                                  type="checkbox"
                                  checked={marcado}
                                  disabled={!marcado && sel.size >= LIMITE_ENVIO}
                                  onChange={() => toggleSel(c)}
                                />
                              </td>
                            )}
                            {!demo && (
                              <td>
                                <span className="send-dots">
                                  {st && st.highlevel && (
                                    <span
                                      className={"send-dot " + (st.highlevel === "enviado" ? "ok" : st.highlevel === "parcial" ? "warn" : "bad")}
                                      title={"HighLevel: " + st.highlevel}
                                    >
                                      {st.highlevel === "enviado" ? "✓" : st.highlevel === "parcial" ? "◐" : "✗"}
                                    </span>
                                  )}
                                  {st && st.webhook && (
                                    <span
                                      className={"send-dot " + (st.webhook === "enviado" ? "info" : st.webhook === "parcial" ? "warn" : "bad")}
                                      title={"Webhook: " + st.webhook}
                                    >
                                      {st.webhook === "enviado" ? "✓" : st.webhook === "parcial" ? "◐" : "✗"}
                                    </span>
                                  )}
                                </span>
                              </td>
                            )}
                            {COLS.map(([k]) => (
                              <td key={k}>
                                {demo && CONTACT_KEYS.has(k)
                                  ? <span className="locked">🔒 login</span>
                                  : cellValue(r, k)}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                      {rows.length === 0 && (
                        <tr><td className="empty" colSpan={COLS.length + (demo ? 0 : 2)}>Nenhum resultado.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {demo && rows.length > 0 && (
                <div className="demo-cta">
                  <div className="demo-cta-inner">
                    <p>
                      Você está vendo <strong>até 10 resultados</strong> com os <strong>contatos ocultos</strong>.
                      {contagem != null && <> Há <strong>{contagemExata ? "" : "~"}{contagem.toLocaleString("pt-BR")}</strong> empresas nesse filtro.</>}
                      {me && me.level === "expired"
                        ? <> Assine o plano para liberar tudo de novo.</>
                        : <> Entre na sua conta para ver todos e liberar telefone, e-mail e exportação.</>}
                    </p>
                    {me && me.level === "expired"
                      ? <button className="btn btn-primary" onClick={() => setPaywall(true)}>Ver plano — R$ 249,90/mês →</button>
                      : <a className="btn btn-primary" href="/login">Entrar →</a>}
                  </div>
                </div>
              )}

              {!demo && rows.length > 0 && (page > 1 || hasMore) && (
                <div className="pager">
                  <button className="btn btn-ghost btn-page" onClick={() => buscar(page - 1)} disabled={page <= 1 || loading}>← Anterior</button>
                  <span className="info">Página {page}</span>
                  <button className="btn btn-ghost btn-page" onClick={() => buscar(page + 1)} disabled={loading || !hasMore}>Próxima →</button>
                </div>
              )}
            </section>
          )}
        </main>

        <footer className="footer">
          <div className="footer-links">
            <a href="/termos">Termos de Uso</a>
            <span>·</span>
            <a href="/privacidade">Política de Privacidade</a>
            <span>·</span>
            <a href="/cookies">Cookies</a>
            <span>·</span>
            <a href="/lgpd">LGPD</a>
          </div>
          <div className="footer-copy">© {new Date().getFullYear()} Prospect AI. Busca online de empresas brasileiras.</div>
        </footer>
      </div>

      {paywall && <PaywallModal onClose={() => setPaywall(false)} />}

      {envModal && (() => {
        const canal = envModal;
        const lista = canal === "highlevel" ? integracoes : webhooks;
        const cfgLink = "/configuracoes";
        const titulo = canal === "highlevel" ? "Enviar ao HighLevel" : "Enviar ao Webhook";
        const icone = canal === "highlevel" ? "🚀" : "🔗";
        const labelSelect = canal === "highlevel" ? "Integração (subconta)" : "Integração (Webhook)";
        const descr = canal === "highlevel"
          ? "Cada empresa vira uma Company no HighLevel e cada sócio vira um Contact vinculado."
          : "Cada empresa selecionada gera um POST JSON para o webhook, com todos os dados da empresa e a lista de sócios.";
        const semItens = canal === "highlevel"
          ? "Você ainda não cadastrou uma integração ativa."
          : "Você ainda não cadastrou um webhook ativo.";
        const btnClass = canal === "highlevel" ? "btn btn-primary" : "btn btn-webhook";
        return (
          <>
            <div className="drawer-backdrop" style={{ zIndex: 60 }} onClick={() => !enviando && setEnvModal(null)} />
            <div className="paywall" style={{ textAlign: "left", width: "min(520px, calc(100vw - 32px))" }}>
              {!enviando && <button className="paywall-close" onClick={() => setEnvModal(null)} aria-label="Fechar">×</button>}
              <div className="paywall-icon" style={{ textAlign: "center" }}>{icone}</div>
              <h3 style={{ textAlign: "center" }}>{titulo}</h3>
              <p style={{ margin: "0 0 16px" }}>
                <strong>{sel.size}</strong> empresa{sel.size > 1 ? "s" : ""} selecionada{sel.size > 1 ? "s" : ""} para envio. {descr}
              </p>

              {lista.length === 0 ? (
                <div className="alert alert-info" style={{ marginBottom: 12 }}>
                  {semItens} <a href={cfgLink}>Ir para Integrações →</a>
                </div>
              ) : (
                <>
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>{labelSelect}</label>
                    <select className="select" value={alvoEnvio} onChange={(e) => setAlvoEnvio(e.target.value)} disabled={enviando}>
                      {lista.map((i) => (
                        <option key={i.id} value={i.id}>
                          {canal === "highlevel"
                            ? `${i.nome} · ${i.location_id}${i.is_default ? " (padrão)" : ""}`
                            : `${i.nome}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="alert alert-info" style={{ marginBottom: 12, fontSize: 13 }}>
                    ℹ️ O limite por envio é de <strong>{LIMITE_ENVIO} empresas</strong> para garantir a integridade. Se você selecionar mais,
                    faça em envios sucessivos.
                  </div>
                </>
              )}

              {enviando && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ height: 8, background: "var(--line)", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ width: `${(progresso.feitos / Math.max(progresso.total, 1)) * 100}%`,
                      height: "100%", background: canal === "highlevel" ? "var(--primary)" : "#2b6cf5", transition: "width .2s" }} />
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 6, textAlign: "center" }}>
                    Processando {progresso.feitos} de {progresso.total}...
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button className="btn btn-ghost" onClick={() => setEnvModal(null)} disabled={enviando} style={{ flex: 1 }}>Cancelar</button>
                <button
                  className={btnClass}
                  onClick={confirmarEnvio}
                  disabled={enviando || lista.length === 0 || !alvoEnvio}
                  style={{ flex: 2 }}
                >
                  {enviando ? "Enviando..." : `Confirmar envio de ${sel.size}`}
                </button>
              </div>
            </div>
          </>
        );
      })()}

      {histOpen && (
        <>
          <div className="drawer-backdrop" onClick={() => setHistOpen(false)} />
          <aside className="drawer">
            <h3>Meu histórico de buscas</h3>
            {hist.length === 0 && <p style={{ color: "var(--ink-faint)", fontSize: 14 }}>Nenhuma busca ainda.</p>}
            {hist.map((h) => {
              const f = h.filtros || {};
              const tags = [];
              if (f.termo) tags.push(`"${f.termo}"`);
              if (f.uf) tags.push(f.uf);
              if (f.municipio) tags.push(f.municipio);
              if (f.cnae) tags.push(f.cnae);
              if (f.situacao) tags.push(SITUACOES.find((s) => s.v === f.situacao)?.t || f.situacao);
              if (f.telefone) tags.push(f.telefone === "com" ? "com tel." : "sem tel.");
              if (f.email) tags.push(f.email === "com" ? "com e-mail" : "sem e-mail");
              return (
                <div key={h.id} className="hist-item" onClick={() => reexecutar(f)}>
                  <div className="tags">
                    {tags.length ? tags.map((t, i) => <span key={i} className="hist-tag">{t}</span>)
                      : <span className="hist-tag">busca ampla</span>}
                  </div>
                  <div className="meta">
                    {h.total_resultados != null ? `~${Number(h.total_resultados).toLocaleString("pt-BR")} resultados · ` : ""}
                    {new Date(h.criado_em).toLocaleString("pt-BR")} · clique para repetir
                  </div>
                </div>
              );
            })}
          </aside>
        </>
      )}
    </>
  );
}
