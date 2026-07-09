"use client";

import { useState } from "react";
import { createClient } from "../../lib/supabase-browser";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setErro("");
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) throw new Error("E-mail ou senha incorretos.");
      const next = new URLSearchParams(window.location.search).get("next") || "/";
      window.location.href = next;
    } catch (e2) {
      setErro(e2.message);
      setLoading(false);
    }
  }

  return (
    <>
      <div className="aura" />
      <div className="auth-wrap">
        <form className="auth-card" onSubmit={entrar}>
          <a href="/" className="brand-center" style={{ textDecoration: "none", color: "inherit" }}>
            <span className="brand-mark">◎</span> Prospect AI
          </a>
          <h2>Entrar</h2>
          <p className="auth-sub">Acesse sua conta para buscar e exportar leads.</p>

          {erro && <div className="alert alert-error">{erro}</div>}

          <div className="auth-field">
            <label>E-mail</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="auth-field">
            <label>Senha</label>
            <input className="input" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
          </div>

          <button className="btn btn-primary btn-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <div className="auth-links">
            <a href="/recuperar-senha">Esqueci minha senha</a>
            <span />
          </div>
        </form>
      </div>
    </>
  );
}
