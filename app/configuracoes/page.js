"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase-browser";

export const dynamic = "force-dynamic";

const HL_VAZIO = { nome: "", location_id: "", private_token: "", is_default: false };
const WH_VAZIO = { nome: "", url: "" };

export default function ConfiguracoesPage() {
  const [tab, setTab] = useState("highlevel");
  const [msg, setMsg] = useState(null);
  function flash(tipo, texto) {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 8000);
  }
  async function sair() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <>
      <div className="aura" />
      <div className="page">
        <nav className="nav">
          <div className="brand"><span className="brand-mark">◎</span> Integrações</div>
          <div className="nav-actions">
            <a className="nav-link" href="/">← Voltar à busca</a>
            <button className="nav-link" onClick={sair}>Sair</button>
          </div>
        </nav>

        <main className="admin-wrap" style={{ maxWidth: 1100 }}>
          <div className="admin-tabs">
            {[
              ["highlevel", "Integrações — HighLevel"],
              ["webhook", "Webhook"],
              ["status", "Status de Envio"],
            ].map(([k, t]) => (
              <button key={k} className={"admin-tab" + (tab === k ? " active" : "")} onClick={() => setTab(k)}>{t}</button>
            ))}
          </div>

          {msg && <div className={"alert " + (msg.tipo === "ok" ? "alert-ok" : "alert-error")} style={{ marginBottom: 16 }}>{msg.texto}</div>}

          {tab === "highlevel" && <AbaHighLevel flash={flash} />}
          {tab === "webhook" && <AbaWebhook flash={flash} />}
          {tab === "status" && <AbaStatus flash={flash} />}
        </main>
      </div>
    </>
  );
}

// ============================================================
// Aba HighLevel
// ============================================================
function AbaHighLevel({ flash }) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(HL_VAZIO);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);

  async function carregar() {
    const r = await fetch("/api/integracoes");
    if (r.status === 401 || r.status === 402) { window.location.href = "/login?next=/configuracoes"; return; }
    const d = await r.json();
    setRows(d.rows || []);
  }
  useEffect(() => { carregar(); }, []);

  async function salvar(e) {
    e.preventDefault();
    setLoading(true);
    try {
      let r, d;
      if (editId) {
        r = await fetch(`/api/integracoes/${editId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ acao: "editar", nome: form.nome, location_id: form.location_id, private_token: form.private_token || undefined }),
        });
      } else {
        r = await fetch("/api/integracoes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      }
      d = await r.json();
      if (!r.ok) return flash("erro", d.error || "Erro ao salvar.");
      flash("ok", editId ? "Integração atualizada." : `Conectado${d.subconta ? " à subconta " + d.subconta : ""} e salvo!`);
      setForm(HL_VAZIO); setEditId(null); carregar();
    } finally { setLoading(false); }
  }
  async function acao(id, body) {
    const r = await fetch(`/api/integracoes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json();
    if (!r.ok) return flash("erro", d.error || "Erro.");
    if (body.acao === "testar") flash(d.ok ? "ok" : "erro", d.ok ? `Conexão OK${d.subconta ? " (" + d.subconta + ")" : ""}` : "Falha: " + d.error);
    carregar();
  }
  async function excluir(id) {
    if (!confirm("Excluir esta integração?")) return;
    await fetch(`/api/integracoes/${id}`, { method: "DELETE" });
    carregar();
  }
  function editar(row) {
    setEditId(row.id);
    setForm({ nome: row.nome, location_id: row.location_id, private_token: "", is_default: row.is_default });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <form onSubmit={salvar} className="table-card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 18, marginBottom: 4 }}>
          {editId ? "Editar integração" : "Nova integração"}
        </div>
        <p style={{ color: "var(--ink-soft)", fontSize: 13.5, margin: "0 0 16px" }}>
          Conecte uma subconta do HighLevel para enviar as empresas encontradas direto ao seu CRM.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label>Nome da integração</label>
            <input className="input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Cliente Agência X" required />
          </div>
          <div className="field">
            <label>ID da subconta (Location ID)</label>
            <input className="input" value={form.location_id} onChange={(e) => setForm({ ...form, location_id: e.target.value })} placeholder="Ex.: 7EeYMLZ4ainmXMeu0ZCH" required />
          </div>
          <div className="field">
            <label>Private Token {editId && "(deixe em branco p/ manter)"}</label>
            <input className="input" type="password" value={form.private_token} onChange={(e) => setForm({ ...form, private_token: e.target.value })} placeholder="pit-..." required={!editId} />
          </div>
        </div>
        <label className="checkbox-row" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
          <span>Usar como integração padrão</span>
        </label>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button className="btn btn-primary" disabled={loading}>{loading ? "Validando..." : editId ? "Salvar" : "Testar e salvar"}</button>
          {editId && <button type="button" className="btn btn-ghost" onClick={() => { setEditId(null); setForm(HL_VAZIO); }}>Cancelar</button>}
        </div>
      </form>

      <div className="table-card"><div className="table-scroll">
        <table>
          <thead><tr><th>Nome</th><th>Subconta</th><th>Padrão</th><th>Ativa</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.nome}</td>
                <td style={{ fontFamily: "monospace", fontSize: 12 }}>{r.location_id}</td>
                <td>{r.is_default ? "★" : ""}</td>
                <td>{r.ativo ? "sim" : "não"}</td>
                <td>{r.ultimo_teste_status === "ok" ? <span className="chip chip-ok">OK</span> : r.ultimo_teste_status === "erro" ? <span className="chip chip-bad">erro</span> : "—"}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="mini-btn" onClick={() => acao(r.id, { acao: "testar" })}>Testar</button>
                  {!r.is_default && <button className="mini-btn" onClick={() => acao(r.id, { acao: "default" })}>Tornar padrão</button>}
                  <button className="mini-btn" onClick={() => acao(r.id, { acao: "ativo", valor: !r.ativo })}>{r.ativo ? "Desativar" : "Ativar"}</button>
                  <button className="mini-btn" onClick={() => editar(r)}>Editar</button>
                  <button className="mini-btn danger" onClick={() => excluir(r.id)}>Excluir</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="empty" colSpan={6}>Nenhuma integração ainda. Cadastre a primeira acima.</td></tr>}
          </tbody>
        </table>
      </div></div>
    </>
  );
}

// ============================================================
// Aba Webhook
// ============================================================
function AbaWebhook({ flash }) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(WH_VAZIO);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);

  async function carregar() {
    const r = await fetch("/api/webhooks");
    if (r.status === 401 || r.status === 402) { window.location.href = "/login?next=/configuracoes"; return; }
    const d = await r.json();
    setRows(d.rows || []);
  }
  useEffect(() => { carregar(); }, []);

  async function salvar(e) {
    e.preventDefault();
    setLoading(true);
    try {
      let r, d;
      if (editId) {
        r = await fetch(`/api/webhooks/${editId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ acao: "editar", nome: form.nome, url: form.url }),
        });
      } else {
        r = await fetch("/api/webhooks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      }
      d = await r.json();
      if (!r.ok) return flash("erro", d.error || "Erro ao salvar.");
      flash("ok", editId ? "Webhook atualizado." : "Webhook salvo!");
      setForm(WH_VAZIO); setEditId(null); carregar();
    } finally { setLoading(false); }
  }
  async function acao(id, body) {
    const r = await fetch(`/api/webhooks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json();
    if (!r.ok) return flash("erro", d.error || "Erro.");
    if (body.acao === "testar") flash(d.ok ? "ok" : "erro", d.ok ? `Webhook respondeu ${d.http_status} (OK)` : "Falha: " + d.error);
    carregar();
  }
  async function excluir(id) {
    if (!confirm("Excluir este webhook?")) return;
    await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
    carregar();
  }
  function editar(row) {
    setEditId(row.id);
    setForm({ nome: row.nome, url: row.url });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <form onSubmit={salvar} className="table-card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 18, marginBottom: 4 }}>
          {editId ? "Editar webhook" : "Novo webhook"}
        </div>
        <p style={{ color: "var(--ink-soft)", fontSize: 13.5, margin: "0 0 16px" }}>
          Cadastre uma URL <strong>HTTPS</strong> que recebe as empresas enviadas em formato JSON (1 POST por empresa,
          com dados da empresa + lista de sócios).
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14 }}>
          <div className="field">
            <label>Nome do webhook</label>
            <input className="input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: n8n Prospecção" required />
          </div>
          <div className="field">
            <label>URL (HTTPS)</label>
            <input className="input" type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://seu-endpoint/webhook" required />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button className="btn btn-primary" disabled={loading}>{loading ? "Salvando..." : editId ? "Salvar" : "Salvar webhook"}</button>
          {editId && <button type="button" className="btn btn-ghost" onClick={() => { setEditId(null); setForm(WH_VAZIO); }}>Cancelar</button>}
        </div>
      </form>

      <div className="table-card"><div className="table-scroll">
        <table>
          <thead><tr><th>Nome</th><th>URL</th><th>Ativo</th><th>Último teste</th><th>Ações</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.nome}</td>
                <td style={{ fontFamily: "monospace", fontSize: 12, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis" }}>{r.url}</td>
                <td>{r.ativo ? "sim" : "não"}</td>
                <td>{r.ultimo_teste_status === "ok" ? <span className="chip chip-ok">OK</span> : r.ultimo_teste_status === "erro" ? <span className="chip chip-bad">erro</span> : "—"}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="mini-btn" onClick={() => acao(r.id, { acao: "testar" })}>Testar</button>
                  <button className="mini-btn" onClick={() => acao(r.id, { acao: "ativo", valor: !r.ativo })}>{r.ativo ? "Desativar" : "Ativar"}</button>
                  <button className="mini-btn" onClick={() => editar(r)}>Editar</button>
                  <button className="mini-btn danger" onClick={() => excluir(r.id)}>Excluir</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="empty" colSpan={5}>Nenhum webhook cadastrado ainda.</td></tr>}
          </tbody>
        </table>
      </div></div>
    </>
  );
}

// ============================================================
// Aba Status de Envio (histórico + reenvio)
// ============================================================
function AbaStatus({ flash }) {
  const [rows, setRows] = useState([]);
  const [fStatus, setFStatus] = useState("todos");
  const [fCanal, setFCanal] = useState("todos");
  const [sel, setSel] = useState(new Set());
  const [integHL, setIntegHL] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [envio, setEnvio] = useState(null); // 'highlevel' | 'webhook' | null
  const [alvoEnvio, setAlvoEnvio] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState({ feitos: 0, total: 0 });

  const LIMITE_ENVIO = 200;
  const LOTE_ENVIO = 20;

  async function carregar() {
    const params = new URLSearchParams();
    if (fStatus !== "todos") params.set("status", fStatus);
    if (fCanal !== "todos") params.set("canal", fCanal);
    params.set("limit", "300");
    const r = await fetch(`/api/envios?${params.toString()}`);
    const d = await r.json();
    setRows(d.rows || []);
    setSel(new Set());
  }
  useEffect(() => { carregar(); }, [fStatus, fCanal]);

  function toggleSel(cnpj) {
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(cnpj)) n.delete(cnpj);
      else if (n.size < LIMITE_ENVIO) n.add(cnpj);
      return n;
    });
  }
  function toggleSelPagina() {
    const cnpjs = rows.map((r) => r.cnpj);
    const todosSelec = cnpjs.length > 0 && cnpjs.every((c) => sel.has(c));
    setSel((prev) => {
      const n = new Set(prev);
      if (todosSelec) cnpjs.forEach((c) => n.delete(c));
      else for (const c of cnpjs) { if (n.size >= LIMITE_ENVIO) break; n.add(c); }
      return n;
    });
  }

  async function abrirEnvio(canal) {
    if (sel.size === 0) return;
    setEnvio(canal);
    if (canal === "highlevel") {
      const d = await (await fetch("/api/integracoes")).json();
      const ativas = (d.rows || []).filter((i) => i.ativo);
      setIntegHL(ativas);
      const padrao = ativas.find((i) => i.is_default) || ativas[0];
      setAlvoEnvio(padrao ? padrao.id : "");
    } else {
      const d = await (await fetch("/api/webhooks")).json();
      const ativos = (d.rows || []).filter((w) => w.ativo);
      setWebhooks(ativos);
      setAlvoEnvio(ativos[0] ? ativos[0].id : "");
    }
  }

  async function confirmarEnvio() {
    if (!alvoEnvio) return;
    const alvo = [...sel];
    setEnviando(true);
    setProgresso({ feitos: 0, total: alvo.length });
    let ok = 0, parcial = 0, erro = 0;
    const url = envio === "highlevel" ? "/api/integracoes/enviar" : "/api/webhooks/enviar";
    const keyId = envio === "highlevel" ? "integracao_id" : "webhook_id";
    for (let i = 0; i < alvo.length; i += LOTE_ENVIO) {
      const lote = alvo.slice(i, i + LOTE_ENVIO);
      try {
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [keyId]: alvoEnvio, cnpjs: lote }) });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Falha");
        for (const r of d.resultados || []) {
          if (r.status === "enviado") ok++;
          else if (r.status === "parcial") parcial++;
          else erro++;
        }
      } catch (e) { erro += lote.length; }
      setProgresso({ feitos: Math.min(i + LOTE_ENVIO, alvo.length), total: alvo.length });
    }
    setEnviando(false);
    setEnvio(null); setSel(new Set());
    flash(erro === 0 ? "ok" : "erro", `Reenvio concluído: ${ok} enviados${parcial ? `, ${parcial} parciais` : ""}${erro ? `, ${erro} falharam` : ""}.`);
    carregar();
  }

  const contadores = useMemo(() => {
    const c = { total: rows.length, ok: 0, erro: 0, parcial: 0 };
    for (const r of rows) c[r.status === "enviado" ? "ok" : r.status] = (c[r.status === "enviado" ? "ok" : r.status] || 0) + 1;
    return c;
  }, [rows]);

  return (
    <>
      <div className="stat-row">
        <div className="stat-chip"><strong>{contadores.total}</strong> envios exibidos</div>
        <div className="stat-chip ok"><strong>{contadores.ok || 0}</strong> enviados</div>
        <div className="stat-chip warn"><strong>{contadores.parcial || 0}</strong> parciais</div>
        <div className="stat-chip"><strong>{contadores.erro || 0}</strong> erros</div>
      </div>

      <div className="table-card" style={{ padding: 14, marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <select className="select" style={{ flex: "1 1 160px" }} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="todos">Status: todos</option>
          <option value="enviados">Enviados (inclui parciais)</option>
          <option value="erros">Erros</option>
        </select>
        <select className="select" style={{ flex: "1 1 160px" }} value={fCanal} onChange={(e) => setFCanal(e.target.value)}>
          <option value="todos">Canal: todos</option>
          <option value="highlevel">HighLevel</option>
          <option value="webhook">Webhook</option>
        </select>
        <div style={{ flex: 1 }} />
        {sel.size > 0 && <span className="send-info"><strong>{sel.size}</strong> selecionada{sel.size > 1 ? "s" : ""}{sel.size >= LIMITE_ENVIO && <span className="send-limit"> · limite {LIMITE_ENVIO}</span>}</span>}
        <button className="btn btn-primary btn-page" onClick={() => abrirEnvio("highlevel")} disabled={sel.size === 0}>🚀 Enviar ao HighLevel</button>
        <button className="btn btn-page" style={{ background: "#2b6cf5", color: "#fff", border: "none" }} onClick={() => abrirEnvio("webhook")} disabled={sel.size === 0}>🔗 Enviar ao Webhook</button>
      </div>

      <div className="table-card"><div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th style={{ width: 34 }}><input type="checkbox" onChange={toggleSelPagina} checked={rows.length > 0 && rows.every((r) => sel.has(r.cnpj))} /></th>
              <th>Quando</th><th>Canal</th><th>Integração</th><th>CNPJ</th><th>Razão Social</th><th>Status</th><th>Erro</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const marcado = sel.has(r.cnpj);
              return (
                <tr key={r.id} className={marcado ? "row-sel" : ""}>
                  <td><input type="checkbox" checked={marcado} disabled={!marcado && sel.size >= LIMITE_ENVIO} onChange={() => toggleSel(r.cnpj)} /></td>
                  <td>{new Date(r.criado_em).toLocaleString("pt-BR")}</td>
                  <td>{r.canal === "webhook" ? <span className="chip chip-info">Webhook</span> : <span className="chip chip-ok">HighLevel</span>}</td>
                  <td>{r.integracao_nome || r.webhook_nome || "—"}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{r.cnpj}</td>
                  <td>{r.razao_social}</td>
                  <td>{r.status === "enviado" ? <span className="chip chip-ok">enviado</span> : r.status === "parcial" ? <span className="chip chip-warn">parcial</span> : <span className="chip chip-bad">erro</span>}</td>
                  <td style={{ maxWidth: 320, fontSize: 12, color: "var(--bad)" }}>{r.erro || ""}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td className="empty" colSpan={8}>Nenhum envio para os filtros escolhidos.</td></tr>}
          </tbody>
        </table>
      </div></div>

      {envio && (
        <>
          <div className="drawer-backdrop" style={{ zIndex: 60 }} onClick={() => !enviando && setEnvio(null)} />
          <div className="paywall" style={{ textAlign: "left", width: "min(520px, calc(100vw - 32px))" }}>
            {!enviando && <button className="paywall-close" onClick={() => setEnvio(null)}>×</button>}
            <div className="paywall-icon" style={{ textAlign: "center" }}>{envio === "highlevel" ? "🚀" : "🔗"}</div>
            <h3 style={{ textAlign: "center" }}>Reenviar ao {envio === "highlevel" ? "HighLevel" : "Webhook"}</h3>
            <p style={{ margin: "0 0 16px" }}>
              <strong>{sel.size}</strong> registro{sel.size > 1 ? "s" : ""} selecionado{sel.size > 1 ? "s" : ""}.
            </p>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>{envio === "highlevel" ? "Integração (subconta)" : "Integração (Webhook)"}</label>
              <select className="select" value={alvoEnvio} onChange={(e) => setAlvoEnvio(e.target.value)} disabled={enviando}>
                {(envio === "highlevel" ? integHL : webhooks).map((i) => (
                  <option key={i.id} value={i.id}>{i.nome}{envio === "highlevel" && i.is_default ? " (padrão)" : ""}</option>
                ))}
              </select>
              {(envio === "highlevel" ? integHL : webhooks).length === 0 && (
                <div className="alert alert-info" style={{ marginTop: 8 }}>
                  Nenhum{envio === "highlevel" ? "a integração ativa" : " webhook ativo"} — cadastre na aba anterior.
                </div>
              )}
            </div>
            {enviando && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ height: 8, background: "var(--line)", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ width: `${(progresso.feitos / Math.max(progresso.total, 1)) * 100}%`, height: "100%", background: "var(--primary)" }} />
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 6, textAlign: "center" }}>{progresso.feitos} de {progresso.total}...</div>
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setEnvio(null)} disabled={enviando} style={{ flex: 1 }}>Cancelar</button>
              <button className="btn btn-primary" onClick={confirmarEnvio} disabled={enviando || !alvoEnvio} style={{ flex: 2 }}>{enviando ? "Enviando..." : `Confirmar reenvio de ${sel.size}`}</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
