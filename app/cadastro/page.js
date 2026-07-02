"use client";

import { useState, useEffect, Suspense } from "react";

export const dynamic = "force-dynamic";

function CadastroForm() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [termos, setTermos] = useState(false);
  const [convite, setConvite] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState(false);
  const [okAprovado, setOkAprovado] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("convite");
    if (t) setConvite(t);
  }, []);

  async function cadastrar(e) {
    e.preventDefault();
    setErro("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, password: senha, termos, convite }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao cadastrar.");
      setOk(true);
      setOkAprovado(data.status === "aprovado");
    } catch (e2) {
      setErro(e2.message);
    } finally {
      setLoading(false);
    }
  }

  if (ok) {
    return (
      <div className="auth-card">
        <a href="/" className="brand-center" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="brand-mark">◎</span> Encontre o Lead
        </a>
        <h2>Cadastro recebido! ✅</h2>
        {okAprovado ? (
          <>
            <div className="alert alert-ok">Sua conta foi criada e <strong>já está liberada</strong> (convite pré-aprovado).</div>
            <a className="btn btn-primary btn-full" href="/login">Fazer login</a>
          </>
        ) : (
          <>
            <div className="alert alert-info">
              Sua conta foi criada e está <strong>aguardando aprovação do administrador</strong>. Você será liberado assim
              que for aprovado. Você já pode entrar, mas o acesso completo só abre após a aprovação.
            </div>
            <a className="btn btn-primary btn-full" href="/login">Ir para o login</a>
          </>
        )}
      </div>
    );
  }

  return (
    <form className="auth-card" onSubmit={cadastrar}>
      <a href="/" className="brand-center" style={{ textDecoration: "none", color: "inherit" }}>
        <span className="brand-mark">◎</span> Encontre o Lead
      </a>
      <h2>Criar conta</h2>
      <p className="auth-sub">
        {convite ? "Você foi convidado — seu acesso já vem pré-aprovado." : "Novos cadastros passam por aprovação do administrador."}
      </p>

      {erro && <div className="alert alert-error">{erro}</div>}
      {convite && <div className="alert alert-ok">🎟️ Convite detectado — cadastro pré-aprovado.</div>}

      <div className="auth-field">
        <label>Nome completo</label>
        <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} required />
      </div>
      <div className="auth-field">
        <label>E-mail</label>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="auth-field">
        <label>Senha (mínimo 8 caracteres)</label>
        <input className="input" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} minLength={8} required />
      </div>

      <label className="checkbox-row">
        <input type="checkbox" checked={termos} onChange={(e) => setTermos(e.target.checked)} />
        <span>Li e aceito os <a href="/termos" target="_blank">Termos de Uso</a> e a <a href="/privacidade" target="_blank">Política de Privacidade</a>.</span>
      </label>

      <button className="btn btn-primary btn-full" disabled={loading}>
        {loading ? "Criando..." : "Criar conta"}
      </button>

      <div className="auth-links">
        <a href="/login">Já tenho conta</a>
        <span />
      </div>
    </form>
  );
}

export default function CadastroPage() {
  return (
    <>
      <div className="aura" />
      <div className="auth-wrap">
        <Suspense fallback={null}>
          <CadastroForm />
        </Suspense>
      </div>
    </>
  );
}
