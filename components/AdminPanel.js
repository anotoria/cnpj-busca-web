"use client";

import { useEffect, useMemo, useState } from "react";
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

// Situação do trial de um usuário: null (n/a) | dias restantes | 'vencido'.
function trialInfo(u) {
  if (u.role === "admin" || u.plano === "plano" || !u.trial_ate) return null;
  const diff = new Date(u.trial_ate) - Date.now();
  if (diff > 0) return { vencido: false, dias: Math.max(1, Math.ceil(diff / 86400000)) };
  return { vencido: true, dias: Math.ceil(-diff / 86400000) };
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
  const [novoUser, setNovoUser] = useState({ nome: "", email: "", password: "", role: "user", plano: "sem_plano", trial: true });
  const [editando, setEditando] = useState(null); // { id, nome, email }

  // Filtros da aba usuários
  const [fBusca, setFBusca] = useState("");
  const [fPlano, setFPlano] = useState("todos");
  const [fStatus, setFStatus] = useState("todos");
  const [fPerfil, setFPerfil] = useState("todos");
  const [fOrigem, setFOrigem] = useState("todos");

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

  function flash(t) {
    setMsg(t);
    setTimeout(() => setMsg(""), 8000);
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

  async function trocarPapel(u, novoPapel) {
    if ((u.role || "user") === novoPapel) return;
    const nomeExib = u.nome || u.email || "este usuário";
    const msg = novoPapel === "admin"
      ? `Promover ${nomeExib} a administrador?\n\nEle terá acesso total ao painel administrativo (aprovar/rejeitar usuários, alterar planos, disparar atualização da base, ver logs).`
      : `Rebaixar ${nomeExib} a usuário comum?\n\nEle perderá o acesso ao painel administrativo.`;
    if (!confirm(msg)) return;
    return acao(u.id, "role", novoPapel);
  }

  async function definirSenha(id) {
    const s = prompt("Nova senha para este usuário (mínimo 8 caracteres):");
    if (!s) return;
    const res = await fetch("/api/admin/usuarios", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, acao: "definir_senha", valor: s }),
    });
    const d = await res.json();
    if (!res.ok) return flash("Erro: " + (d.error || res.status));
    flash("Senha definida.");
  }

  async function salvarEdicao(e) {
    e.preventDefault();
    const res = await fetch("/api/admin/usuarios", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editando.id, acao: "editar", nome: editando.nome, email: editando.email }),
    });
    const d = await res.json();
    if (!res.ok) return flash("Erro: " + (d.error || res.status));
    flash("Usuário atualizado.");
    setEditando(null);
    carregarUsuarios();
  }

  async function criarUsuario(e) {
    e.preventDefault();
    const res = await fetch("/api/admin/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: novoUser.nome,
        email: novoUser.email,
        password: novoUser.password,
        role: novoUser.role,
        plano: novoUser.plano,
        trial_dias: novoUser.plano === "sem_plano" && novoUser.trial ? 3 : 0,
      }),
    });
    const d = await res.json();
    if (!res.ok) return flash("Erro: " + (d.error || res.status));
    flash("Usuário criado.");
    setNovoUser({ nome: "", email: "", password: "", role: "user", plano: "sem_plano", trial: true });
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

  async function sair() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const inviteLink = (t) => `${base}/cadastro?convite=${t}`;

  // ---- Filtros + contadores da aba usuários ----
  const usuariosFiltrados = useMemo(() => {
    const q = fBusca.trim().toLowerCase();
    return usuarios.filter((u) => {
      if (q && !(`${u.nome || ""} ${u.email || ""}`.toLowerCase().includes(q))) return false;
      if (fStatus !== "todos" && u.status !== fStatus) return false;
      if (fPerfil !== "todos" && u.role !== fPerfil) return false;
      if (fOrigem !== "todos" && u.origem !== fOrigem) return false;
      if (fPlano !== "todos") {
        const t = trialInfo(u);
        if (fPlano === "plano" && u.plano !== "plano") return false;
        if (fPlano === "sem_plano" && u.plano !== "sem_plano") return false;
        if (fPlano === "trial" && !(t && !t.vencido)) return false;
        if (fPlano === "trial_vencido" && !(u.plano === "sem_plano" && (!t || t.vencido) && u.status === "aprovado" && u.role !== "admin")) return false;
      }
      return true;
    });
  }, [usuarios, fBusca, fPlano, fStatus, fPerfil, fOrigem]);

  const contadores = useMemo(() => {
    const c = { total: usuarios.length, plano: 0, trial: 0, vencido: 0, pendentes: 0 };
    for (const u of usuarios) {
      if (u.status === "pendente") c.pendentes++;
      if (u.plano === "plano") c.plano++;
      const t = trialInfo(u);
      if (t && !t.vencido) c.trial++;
      if (u.role !== "admin" && u.status === "aprovado" && u.plano === "sem_plano" && (!t || t.vencido)) c.vencido++;
    }
    return c;
  }, [usuarios]);

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
          {/* Contadores executivos */}
          <div className="stat-row">
            <div className="stat-chip"><strong>{contadores.total}</strong> usuários</div>
            <div className="stat-chip ok"><strong>{contadores.plano}</strong> com plano</div>
            <div className="stat-chip info"><strong>{contadores.trial}</strong> em trial</div>
            <div className="stat-chip warn"><strong>{contadores.vencido}</strong> trial vencido</div>
            <div className="stat-chip"><strong>{contadores.pendentes}</strong> pendentes</div>
          </div>

          {/* Criar usuário */}
          <form onSubmit={criarUsuario} className="table-card" style={{ padding: 16, marginBottom: 16, display: "grid", gridTemplateColumns: "1.2fr 1.4fr 1fr auto auto auto auto", gap: 10, alignItems: "end" }}>
            <div><label style={{ fontSize: 12, color: "var(--ink-faint)" }}>Nome</label><input className="input" value={novoUser.nome} onChange={(e) => setNovoUser({ ...novoUser, nome: e.target.value })} required /></div>
            <div><label style={{ fontSize: 12, color: "var(--ink-faint)" }}>E-mail</label><input className="input" type="email" value={novoUser.email} onChange={(e) => setNovoUser({ ...novoUser, email: e.target.value })} required /></div>
            <div><label style={{ fontSize: 12, color: "var(--ink-faint)" }}>Senha</label><input className="input" value={novoUser.password} onChange={(e) => setNovoUser({ ...novoUser, password: e.target.value })} required /></div>
            <div><label style={{ fontSize: 12, color: "var(--ink-faint)" }}>Papel</label>
              <select className="select" value={novoUser.role} onChange={(e) => setNovoUser({ ...novoUser, role: e.target.value })}>
                <option value="user">Usuário</option><option value="admin">Admin</option>
              </select>
            </div>
            <div><label style={{ fontSize: 12, color: "var(--ink-faint)" }}>Plano</label>
              <select className="select" value={novoUser.plano} onChange={(e) => setNovoUser({ ...novoUser, plano: e.target.value })}>
                <option value="sem_plano">Sem plano</option><option value="plano">Plano</option>
              </select>
            </div>
            {novoUser.plano === "sem_plano" ? (
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, whiteSpace: "nowrap", paddingBottom: 12 }}>
                <input type="checkbox" checked={novoUser.trial} onChange={(e) => setNovoUser({ ...novoUser, trial: e.target.checked })} />
                Trial 3 dias
              </label>
            ) : <span />}
            <button className="btn btn-primary">+ Criar</button>
          </form>

          {/* Busca e filtros */}
          <div className="table-card" style={{ padding: 14, marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input className="input" style={{ flex: "2 1 220px" }} placeholder="Buscar por nome ou e-mail..." value={fBusca} onChange={(e) => setFBusca(e.target.value)} />
            <select className="select" style={{ flex: "1 1 150px" }} value={fPlano} onChange={(e) => setFPlano(e.target.value)}>
              <option value="todos">Plano: todos</option>
              <option value="plano">Com plano</option>
              <option value="sem_plano">Sem plano</option>
              <option value="trial">Em trial</option>
              <option value="trial_vencido">Trial vencido</option>
            </select>
            <select className="select" style={{ flex: "1 1 140px" }} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
              <option value="todos">Status: todos</option>
              <option value="aprovado">Ativo</option>
              <option value="desativado">Inativo</option>
              <option value="pendente">Pendente</option>
              <option value="rejeitado">Rejeitado</option>
            </select>
            <select className="select" style={{ flex: "1 1 130px" }} value={fPerfil} onChange={(e) => setFPerfil(e.target.value)}>
              <option value="todos">Perfil: todos</option>
              <option value="admin">Admin</option>
              <option value="user">Usuário</option>
            </select>
            <select className="select" style={{ flex: "1 1 140px" }} value={fOrigem} onChange={(e) => setFOrigem(e.target.value)}>
              <option value="todos">Origem: todas</option>
              <option value="cadastro">Cadastro</option>
              <option value="convite">Convite</option>
              <option value="admin">Criado pelo admin</option>
            </select>
            <span style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>{usuariosFiltrados.length} exibido(s)</span>
          </div>

          {/* Edição inline */}
          {editando && (
            <form onSubmit={salvarEdicao} className="table-card" style={{ padding: 16, marginBottom: 16, display: "grid", gridTemplateColumns: "1fr 1.4fr auto auto", gap: 10, alignItems: "end", borderColor: "var(--primary)" }}>
              <div><label style={{ fontSize: 12, color: "var(--ink-faint)" }}>Nome</label><input className="input" value={editando.nome} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} required /></div>
              <div><label style={{ fontSize: 12, color: "var(--ink-faint)" }}>E-mail (login)</label><input className="input" type="email" value={editando.email} onChange={(e) => setEditando({ ...editando, email: e.target.value })} required /></div>
              <button className="btn btn-primary">Salvar</button>
              <button type="button" className="btn btn-ghost" onClick={() => setEditando(null)}>Cancelar</button>
            </form>
          )}

          <div className="table-card"><div className="table-scroll">
            <table>
              <thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Status</th><th>Plano</th><th>Trial</th><th>Origem</th><th>Cadastro</th><th>Ações</th></tr></thead>
              <tbody>
                {usuariosFiltrados.map((u) => {
                  const t = trialInfo(u);
                  return (
                    <tr key={u.id}>
                      <td>{u.nome}</td>
                      <td>{u.email}</td>
                      <td>
                        <select
                          className="role-select"
                          value={u.role || "user"}
                          onChange={(e) => trocarPapel(u, e.target.value)}
                          title={u.role === "admin" ? "Este usuário é administrador" : "Este usuário tem perfil comum"}
                        >
                          <option value="user">Usuário</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td><span className={STATUS_CLASS[u.status]}>{u.status === "aprovado" ? "ativo" : u.status === "desativado" ? "inativo" : u.status}</span></td>
                      <td><span className={"status-pill " + (u.plano === "plano" ? "st-aprovado" : "st-desativado")}>{u.plano === "plano" ? "Plano" : "Sem plano"}</span></td>
                      <td>{u.role === "admin" || u.plano === "plano" ? "—" : t ? (t.vencido ? <span style={{ color: "var(--bad)" }}>vencido há {t.dias}d</span> : <span style={{ color: "var(--ok)" }}>expira em {t.dias}d</span>) : <span style={{ color: "var(--ink-faint)" }}>sem trial</span>}</td>
                      <td>{u.origem}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{new Date(u.criado_em).toLocaleDateString("pt-BR")}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {u.role !== "admin"
                          ? <button className="mini-btn role-up" onClick={() => trocarPapel(u, "admin")} title="Promover a administrador">⬆ Promover a Admin</button>
                          : <button className="mini-btn role-down" onClick={() => trocarPapel(u, "user")} title="Rebaixar a usuário comum">⬇ Rebaixar</button>}
                        {u.status === "pendente" && <>
                          <button className="mini-btn" onClick={() => acao(u.id, "status", "aprovado")}>Aprovar</button>
                          <button className="mini-btn danger" onClick={() => acao(u.id, "status", "rejeitado")}>Rejeitar</button>
                        </>}
                        {u.status === "aprovado" && <button className="mini-btn danger" onClick={() => acao(u.id, "status", "desativado")}>Inativar</button>}
                        {(u.status === "desativado" || u.status === "rejeitado") && <button className="mini-btn" onClick={() => acao(u.id, "status", "aprovado")}>Ativar</button>}
                        <button className="mini-btn" onClick={() => setEditando({ id: u.id, nome: u.nome || "", email: u.email || "" })}>Editar</button>
                        {u.plano === "plano"
                          ? <button className="mini-btn" onClick={() => acao(u.id, "plano", "sem_plano")}>Remover plano</button>
                          : <button className="mini-btn" onClick={() => acao(u.id, "plano", "plano")}>Dar plano</button>}
                        {u.plano === "sem_plano" && u.role !== "admin" && <button className="mini-btn" onClick={() => acao(u.id, "trial", 3)}>Trial +3d</button>}
                        <button className="mini-btn" onClick={() => acao(u.id, "reset_senha")}>Resetar senha</button>
                        <button className="mini-btn" onClick={() => definirSenha(u.id)}>Definir senha</button>
                      </td>
                    </tr>
                  );
                })}
                {usuariosFiltrados.length === 0 && <tr><td className="empty" colSpan={9}>Nenhum usuário com esses filtros.</td></tr>}
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
