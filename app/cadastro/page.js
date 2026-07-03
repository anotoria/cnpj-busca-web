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

  // Cadastro é somente por convite: sem token na URL, não mostra o formulário.
  if (!convite && !ok) {
    return (
      <div className="auth-card">
        <a href="/" className="brand-center" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="brand-mark">◎</span> Encontre o Lead
        </a>
        <h2>Cadastro por convite</h2>
        <div className="alert alert-info">
          O cadastro no Encontre o Lead é feito <strong>apenas por convite</strong>. Peça o link de convite a quem te
          indicou ou fale com o administrador.
        </div>
        <a className="btn btn-primary btn-full" href="/login">Já tenho conta — entrar</a>
      </div>
    );
  }

  if (ok) {
    return (
      <div className="auth-card">
        <a href="/" className="brand-center" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="brand-mark">◎</span> Encontre o Lead
        </a>
        <h2>Cadastro recebido! ✅</h2>
        <div className="alert alert-ok">
          Sua conta foi criada e <strong>já está liberada</strong> — você tem <strong>3 dias de teste grátis</strong> com
          acesso completo à base.
        </div>
        <a className="btn btn-primary btn-full" href="/login">Fazer login</a>
      </div>
    );
  }

  return (
    <form className="auth-card" onSubmit={cadastrar}>
      <a href="/" className="brand-center" style={{ textDecoration: "none", color: "inherit" }}>
        <span className="brand-mark">◎</span> Encontre o Lead
      </a>
      <h2>Criar conta</h2>
      <p className="auth-sub">Você foi convidado — sua conta entra liberada com 3 dias de teste grátis.</p>

      {erro && <div className="alert alert-error">{erro}</div>}
      <div className="alert alert-ok">🎟️ Convite detectado — cadastro pré-aprovado com trial de 3 dias.</div>

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
