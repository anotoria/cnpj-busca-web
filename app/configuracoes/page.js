"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase-browser";

export const dynamic = "force-dynamic";

const VAZIO = { nome: "", location_id: "", private_token: "", is_default: false };

export default function ConfiguracoesPage() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(VAZIO);
  const [editId, setEditId] = useState(null);
  const [msg, setMsg] = useState(null); // {tipo, texto}
  const [loading, setLoading] = useState(false);

  async function carregar() {
    try {
      const r = await fetch("/api/integracoes");
      if (r.status === 401 || r.status === 402) {
        window.location.href = "/login?next=/configuracoes";
        return;
      }
      const d = await r.json();
      setRows(d.rows || []);
    } catch {
      setRows([]);
    }
  }
  useEffect(() => {
    carregar();
  }, []);

  function flash(tipo, texto) {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 8000);
  }

  async function salvar(e) {
    e.preventDefault();
    setLoading(true);
    try {
      let r, d;
      if (editId) {
        r = await fetch(`/api/integracoes/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            acao: "editar",
            nome: form.nome,
            location_id: form.location_id,
            private_token: form.private_token || undefined,
          }),
        });
      } else {
        r = await fetch("/api/integracoes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      d = await r.json();
      if (!r.ok) return flash("erro", d.error || "Erro ao salvar.");
      flash("ok", editId ? "Integração atualizada." : `Conectado${d.subconta ? " à subconta " + d.subconta : ""} e salvo!`);
      setForm(VAZIO);
      setEditId(null);
      carregar();
    } finally {
      setLoading(false);
    }
  }

  async function acao(id, body) {
    const r = await fetch(`/api/integracoes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
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
          <div className="brand"><span className="brand-mark">◎</span> Configurações</div>
          <div className="nav-actions">
            <a className="nav-link" href="/">← Voltar à busca</a>
            <button className="nav-link" onClick={sair}>Sair</button>
          </div>
        </nav>

        <main className="admin-wrap" style={{ maxWidth: 980 }}>
          <div className="admin-tabs"><button className="admin-tab active">Integrações — HighLevel</button></div>

          {msg && <div className={"alert " + (msg.tipo === "ok" ? "alert-ok" : "alert-error")} style={{ marginBottom: 16 }}>{msg.texto}</div>}

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
              {editId && <button type="button" className="btn btn-ghost" onClick={() => { setEditId(null); setForm(VAZIO); }}>Cancelar</button>}
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
        </main>
      </div>
    </>
  );
}
