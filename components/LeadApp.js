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
};

// Contato para assinar o plano (até o gateway de pagamento entrar).
const CONTATO_ASSINATURA =
  "mailto:essahora@gmail.com?subject=Quero%20assinar%20o%20Encontre%20o%20Lead&body=Ol%C3%A1!%20Quero%20assinar%20o%20plano%20mensal%20do%20Encontre%20o%20Lead.";

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
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [demo, setDemo] = useState(false);
  const [municipioOpcoes, setMunicipioOpcoes] = useState([]);
  const [cnaeOpcoes, setCnaeOpcoes] = useState([]);
  const [paywall, setPaywall] = useState(false);
  const [flash, setFlash] = useState("");

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

  async function onCnaeChange(v) {
    set("cnae", v);
    if (v.trim().length < 3 || /^\d+$/.test(v.trim())) return setCnaeOpcoes([]);
    try {
      const d = await (await fetch(`/api/cnaes?q=${encodeURIComponent(v)}`)).json();
      setCnaeOpcoes((d.rows || []).map((c) => c.descricao));
    } catch {
      setCnaeOpcoes([]);
    }
  }

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
    for (const [k, v] of Object.entries(extra)) q.set(k, v);
    return q.toString();
  }

  async function buscar(p = 1, f = filters) {
    setLoading(true);
    setError("");
    setSearched(true);
    try {
      const res = await fetch(`/api/buscar?${toQuery(f, { page: p, pageSize })}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro na busca");
      setRows(data.rows || []);
      setTotal(data.total);
      setDemo(!!data.demo);
      setPage(p);
    } catch (e) {
      setError(e.message);
      setRows([]);
      setTotal(null);
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
    setHistOpen(false);
    buscar(1, novo);
  }

  async function sair() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.reload();
  }

  const totalPages = total ? Math.max(1, Math.ceil(total / pageSize)) : null;
  const iniciais = (me && me.nome ? me.nome : "?").slice(0, 1).toUpperCase();

  return (
    <>
      <div className="aura" />
      <div className="page">
        <nav className="nav">
          <div className="brand">
            <span className="brand-mark">◎</span>
            Encontre o Lead
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
            Encontre o Lead
            <br />
            <em>Seu futuro cliente está aqui</em>
          </h1>
          <p className="sub">Busque por empresas Brasileiras. Filtre e exporte o resultado em CSV.</p>
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
              <div className="field">
                <label>Atividade / Nicho</label>
                <input className="input" list="cnaes-list" value={filters.cnae}
                  onChange={(e) => onCnaeChange(e.target.value)} placeholder="farmácias, pet shop..." />
                <datalist id="cnaes-list">{cnaeOpcoes.map((c) => <option key={c} value={c} />)}</datalist>
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
              }}>Limpar</button>
            </div>
          </form>

          {error && <div className="error-box">{error}</div>}

          {searched && !error && (
            <section className="results">
              <div className="results-meta">
                <div className="results-count">
                  {total != null ? <><span>~{total.toLocaleString("pt-BR")}</span> empresas encontradas</>
                    : <><span>{rows.length}</span> resultado(s)</>}
                </div>
                {total != null && <div className="results-hint">contagem estimada</div>}
              </div>

              <div className="table-card">
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>{COLS.map(([, t]) => <th key={t}>{t}</th>)}</tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i}>
                          {COLS.map(([k]) => (
                            <td key={k}>
                              {demo && CONTACT_KEYS.has(k)
                                ? <span className="locked">🔒 login</span>
                                : cellValue(r, k)}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {rows.length === 0 && (
                        <tr><td className="empty" colSpan={COLS.length}>Nenhum resultado.</td></tr>
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
                      {total != null && <> Há <strong>~{total.toLocaleString("pt-BR")}</strong> empresas nesse filtro.</>}
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

              {!demo && rows.length > 0 && (
                <div className="pager">
                  <button className="btn btn-ghost btn-page" onClick={() => buscar(page - 1)} disabled={page <= 1 || loading}>← Anterior</button>
                  <span className="info">Página {page}{totalPages ? ` de ~${totalPages}` : ""}</span>
                  <button className="btn btn-ghost btn-page" onClick={() => buscar(page + 1)} disabled={loading || rows.length < pageSize}>Próxima →</button>
                </div>
              )}
            </section>
          )}
        </main>

        <footer className="footer">
          Dados públicos oficiais (Lei 12.527/2011). Atualização mensal.
        </footer>
      </div>

      {paywall && <PaywallModal onClose={() => setPaywall(false)} />}

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
