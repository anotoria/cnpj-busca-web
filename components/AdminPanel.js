"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase-browser";

const STATUS_CLASS = {
  pendente: "status-pill st-pendente",
  aprovado: "status-pill st-aprovado",
  desativado: "status-pill st-desativado",
  rejeitado: "status-pill st-rejeitado",
};

// Classe de cor para o status de um job de atualização.
function statusClasse(status) {
  if (status === "concluido") return "st-aprovado";
  if (status === "erro") return "st-rejeitado";
  if (status === "ignorado") return "st-desativado";
  return "st-pendente"; // solicitado/baixando/mesclando
}

// Resumo legível dos contadores do merge.
function resumoContadores(c) {
  if (!c || typeof c !== "object" || Object.keys(c).length === 0) return "—";
  const fmt = (n) => Number(n).toLocaleString("pt-BR");
  const partes = [];
  if (c.empresas != null) partes.push(`${fmt(c.empresas)} empresas`);
  if (c.estabelecimentos != null) partes.push(`${fmt(c.estabelecimentos)} estabelec.`);
  if (c.socios_novos != null) partes.push(`${fmt(c.socios_novos)} sócios novos`);
  if (c.dados_simples != null) partes.push(`${fmt(c.dados_simples)} simples`);
  return partes.join(" · ") || "—";
}

export default function AdminPanel({ nome }) {
  const [tab, setTab] = useState("usuarios");
  const [usuarios, setUsuarios] = useState([]);
  const [convites, setConvites] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logTipo, setLogTipo] = useState("busca");
  const [atualiz, setAtualiz] = useState({ rows: [], rodando: null });
  const [forcar, setForcar] = useState(false);
  const [msg, setMsg] = useState("");
  const [novoUser, setNovoUser] = useState({ nome: "", email: "", password: "", role: "user" });

  const base =
    typeof window !== "undefined" ? window.location.origin : "https://cnpj-busca-web.vercel.app";

  async function carregarUsuarios() {
    const d = await (await fetch("/api/admin/usuarios")).json();
    setUsuarios(d.rows || []);
  }
  async function carregarConvites() {
    const d = await (await fetch("/api/admin/convites")).json();
    setConvites(d.rows || []);
  }
  async function carregarLogs(t) {
    const d = await (await fetch(`/api/admin/logs?tipo=${t}`)).json();
    setLogs(d.rows || []);
  }
  async function carregarAtualiz() {
    const d = await (await fetch("/api/admin/atualizar")).json();
    setAtualiz({ rows: d.rows || [], rodando: d.rodando || null });
  }

  useEffect(() => { carregarUsuarios(); }, []);
  useEffect(() => {
    if (tab === "convites") carregarConvites();
    if (tab === "logs") carregarLogs(logTipo);
    if (tab === "atualizar") carregarAtualiz();
  }, [tab, logTipo]);

  // Enquanto houver atualização rodando, atualiza o status a cada 15s.
  useEffect(() => {
    if (tab !== "atualizar") return;
    const t = setInterval(carregarAtualiz, 15000);
    return () => clearInterval(t);
  }, [tab]);

  async function dispararAtualizacao() {
    if (atualiz.rodando) return;
    if (!confirm("Iniciar a atualização da base com o mês mais recente? O processo roda no servidor e pode levar algumas horas.")) return;
    const res = await fetch("/api/admin/atualizar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forcar }),
    });
    const d = await res.json();
    if (!res.ok) return flash("Erro: " + (d.error || res.status));
    flash("Atualização enfileirada. Acompanhe o status abaixo.");
    carregarAtualiz();
  }

  function flash(t) {
    setMsg(t);
    setTimeout(() => setMsg(""), 6000);
  }

  async function acao(id, acao, valor) {
    const res = await fetch("/api/admin/usuarios", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, acao, valor }),
    });
    const d = await res.json();
    if (!res.ok) return flash("Erro: " + (d.error || res.status));
    if (d.senha_temporaria) flash(`Senha temporária gerada: ${d.senha_temporaria} — copie e envie ao usuário.`);
    else flash("Feito.");
    carregarUsuarios();
  }

  async function criarUsuario(e) {
    e.preventDefault();
    const res = await fetch("/api/admin/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(novoUser),
    });
    const d = await res.json();
    if (!res.ok) return flash("Erro: " + (d.error || res.status));
    flash("Usuário criado.");
    setNovoUser({ nome: "", email: "", password: "", role: "user" });
    carregarUsuarios();
  }

  async function gerarConvite() {
    const res = await fetch("/api/admin/convites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dias: 7, max_usos: 1 }),
    });
    const d = await res.json();
    if (!res.ok) return flash("Erro: " + (d.error || res.status));
    flash("Convite gerado.");
    carregarConvites();
  }

  async function revogarConvite(id) {
    await fetch("/api/admin/convites", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    carregarConvites();
  }

  function copiar(texto) {
    navigator.clipboard.writeText(texto);
    flash("Link copiado!");
  }

  async function sair() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const inviteLink = (t) => `${base}/cadastro?convite=${t}`;

  return (
    <div className="admin-wrap">
      <nav className="nav" style={{ padding: "0 0 0", maxWidth: "100%" }}>
        <div className="brand"><span className="brand-mark">◎</span> Painel do administrador</div>
        <div className="nav-actions">
          <a className="nav-link" href="/">← Voltar à busca</a>
          <button className="nav-link" onClick={sair}>Sair</button>
        </div>
      </nav>

      {msg && <div className="alert alert-info" style={{ marginTop: 16 }}>{msg}</div>}

      <div className="admin-tabs">
        {[["usuarios", "Usuários"], ["convites", "Convites"], ["logs", "Logs"], ["atualizar", "Atualização da base"]].map(([k, t]) => (
          <button key={k} className={"admin-tab" + (tab === k ? " active" : "")} onClick={() => setTab(k)}>{t}</button>
        ))}
      </div>

      {tab === "usuarios" && (
        <>
          <form onSubmit={criarUsuario} className="table-card" style={{ padding: 16, marginBottom: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto auto", gap: 10, alignItems: "end" }}>
            <div><label style={{ fontSize: 12, color: "var(--ink-faint)" }}>Nome</label><input className="input" value={novoUser.nome} onChange={(e) => setNovoUser({ ...novoUser, nome: e.target.value })} required /></div>
            <div><label style={{ fontSize: 12, color: "var(--ink-faint)" }}>E-mail</label><input className="input" type="email" value={novoUser.email} onChange={(e) => setNovoUser({ ...novoUser, email: e.target.value })} required /></div>
            <div><label style={{ fontSize: 12, color: "var(--ink-faint)" }}>Senha</label><input className="input" value={novoUser.password} onChange={(e) => setNovoUser({ ...novoUser, password: e.target.value })} required /></div>
            <div><label style={{ fontSize: 12, color: "var(--ink-faint)" }}>Papel</label>
              <select className="select" value={novoUser.role} onChange={(e) => setNovoUser({ ...novoUser, role: e.target.value })}>
                <option value="user">Usuário</option><option value="admin">Admin</option>
              </select>
            </div>
            <button className="btn btn-primary">+ Criar</button>
          </form>

          <div className="table-card"><div className="table-scroll">
            <table>
              <thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Status</th><th>Origem</th><th>Ações</th></tr></thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td>{u.nome}</td>
                    <td>{u.email}</td>
                    <td>{u.role === "admin" ? "Admin" : "Usuário"}</td>
                    <td><span className={STATUS_CLASS[u.status]}>{u.status}</span></td>
                    <td>{u.origem}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {u.status === "pendente" && <>
                        <button className="mini-btn" onClick={() => acao(u.id, "status", "aprovado")}>Aprovar</button>
                        <button className="mini-btn danger" onClick={() => acao(u.id, "status", "rejeitado")}>Rejeitar</button>
                      </>}
                      {u.status === "aprovado" && <button className="mini-btn danger" onClick={() => acao(u.id, "status", "desativado")}>Desativar</button>}
                      {(u.status === "desativado" || u.status === "rejeitado") && <button className="mini-btn" onClick={() => acao(u.id, "status", "aprovado")}>Reativar</button>}
                      <button className="mini-btn" onClick={() => acao(u.id, "reset_senha")}>Resetar senha</button>
                      {u.role !== "admin"
                        ? <button className="mini-btn" onClick={() => acao(u.id, "role", "admin")}>→ Admin</button>
                        : <button className="mini-btn" onClick={() => acao(u.id, "role", "user")}>→ Usuário</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div></div>
        </>
      )}

      {tab === "convites" && (
        <>
          <button className="btn btn-primary" onClick={gerarConvite} style={{ marginBottom: 16 }}>+ Gerar link de convite (7 dias, 1 uso)</button>
          <div className="table-card"><div className="table-scroll">
            <table>
              <thead><tr><th>Link (pré-aprovado)</th><th>Expira</th><th>Usos</th><th>Status</th><th>Ações</th></tr></thead>
              <tbody>
                {convites.map((c) => {
                  const link = inviteLink(c.token);
                  const expirado = new Date(c.expira_em) < new Date();
                  const status = c.revogado ? "revogado" : expirado ? "expirado" : c.usos >= c.max_usos ? "esgotado" : "ativo";
                  return (
                    <tr key={c.id}>
                      <td style={{ maxWidth: 380 }}><div className="copy-box"><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{link}</span></div></td>
                      <td>{new Date(c.expira_em).toLocaleDateString("pt-BR")}</td>
                      <td>{c.usos}/{c.max_usos}</td>
                      <td>{status}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button className="mini-btn" onClick={() => copiar(link)}>Copiar</button>
                        {status === "ativo" && <button className="mini-btn danger" onClick={() => revogarConvite(c.id)}>Revogar</button>}
                      </td>
                    </tr>
                  );
                })}
                {convites.length === 0 && <tr><td className="empty" colSpan={5}>Nenhum convite gerado.</td></tr>}
              </tbody>
            </table>
          </div></div>
        </>
      )}

      {tab === "atualizar" && (
        <>
          <div className="table-card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, marginBottom: 6 }}>
              Atualização mensal da base
            </div>
            <p style={{ color: "var(--ink-soft)", fontSize: 14, margin: "0 0 16px", maxWidth: 640 }}>
              Baixa a base mais recente e insere as empresas novas e atualiza as existentes (situação, endereço, telefone).
              Roda no servidor e leva algumas horas — você pode fechar esta página que o processo continua.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <button
                className="btn btn-primary"
                onClick={dispararAtualizacao}
                disabled={!!atualiz.rodando}
              >
                {atualiz.rodando ? "Atualização em andamento..." : "▶ Atualizar base agora"}
              </button>
              <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, color: "var(--ink-soft)" }}>
                <input type="checkbox" checked={forcar} onChange={(e) => setForcar(e.target.checked)} />
                Forçar (reprocessar mesmo se o mês já foi carregado)
              </label>
            </div>
            {atualiz.rodando && (
              <div className="alert alert-info" style={{ marginTop: 16 }}>
                <strong>Em andamento</strong> — mês {atualiz.rodando.mes || "(detectando)"} · fase: {atualiz.rodando.fase || atualiz.rodando.status}
              </div>
            )}
          </div>

          <div className="table-card"><div className="table-scroll">
            <table>
              <thead><tr><th>Solicitado</th><th>Mês</th><th>Status</th><th>Fase</th><th>Resultado</th><th>Terminado</th></tr></thead>
              <tbody>
                {atualiz.rows.map((j) => (
                  <tr key={j.id}>
                    <td>{new Date(j.solicitado_em).toLocaleString("pt-BR")}</td>
                    <td>{j.mes || "—"}</td>
                    <td><span className={"status-pill " + statusClasse(j.status)}>{j.status}</span></td>
                    <td style={{ maxWidth: 220 }}>{j.fase || "—"}</td>
                    <td style={{ maxWidth: 320, fontSize: 12.5 }}>
                      {j.status === "erro"
                        ? <span style={{ color: "var(--bad)" }}>{j.erro}</span>
                        : resumoContadores(j.contadores)}
                    </td>
                    <td>{j.terminado_em ? new Date(j.terminado_em).toLocaleString("pt-BR") : "—"}</td>
                  </tr>
                ))}
                {atualiz.rows.length === 0 && <tr><td className="empty" colSpan={6}>Nenhuma atualização ainda.</td></tr>}
              </tbody>
            </table>
          </div></div>
        </>
      )}

      {tab === "logs" && (
        <>
          <div className="admin-tabs">
            <button className={"admin-tab" + (logTipo === "busca" ? " active" : "")} onClick={() => setLogTipo("busca")}>Buscas & Exportações</button>
            <button className={"admin-tab" + (logTipo === "auditoria" ? " active" : "")} onClick={() => setLogTipo("auditoria")}>Auditoria (ações)</button>
          </div>
          <div className="table-card"><div className="table-scroll">
            {logTipo === "busca" ? (
              <table>
                <thead><tr><th>Quando</th><th>Tipo</th><th>Filtros</th><th>Resultados</th><th>Exportadas</th><th>Anônimo</th></tr></thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id}>
                      <td>{new Date(l.criado_em).toLocaleString("pt-BR")}</td>
                      <td>{l.tipo}</td>
                      <td style={{ maxWidth: 340 }}>{JSON.stringify(l.filtros)}</td>
                      <td>{l.total_resultados != null ? Number(l.total_resultados).toLocaleString("pt-BR") : "—"}</td>
                      <td>{l.linhas_exportadas != null ? Number(l.linhas_exportadas).toLocaleString("pt-BR") : "—"}</td>
                      <td>{l.anonimo ? "sim" : "não"}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && <tr><td className="empty" colSpan={6}>Sem registros.</td></tr>}
                </tbody>
              </table>
            ) : (
              <table>
                <thead><tr><th>Quando</th><th>Ação</th><th>Detalhes</th></tr></thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id}>
                      <td>{new Date(l.criado_em).toLocaleString("pt-BR")}</td>
                      <td>{l.acao}</td>
                      <td style={{ maxWidth: 500 }}>{JSON.stringify(l.detalhes)}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && <tr><td className="empty" colSpan={3}>Sem registros.</td></tr>}
                </tbody>
              </table>
            )}
          </div></div>
        </>
      )}
    </div>
  );
}
