"use client";

import { useState } from "react";

export const dynamic = "force-dynamic";

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  async function solicitar(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/solicitar-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setOk(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="aura" />
      <div className="auth-wrap">
        <form className="auth-card" onSubmit={solicitar}>
          <a href="/" className="brand-center" style={{ textDecoration: "none", color: "inherit" }}>
            <span className="brand-mark">◎</span> Encontre o Lead
          </a>
          <h2>Recuperar senha</h2>
          {ok ? (
            <div className="alert alert-ok">
              Pedido registrado! O <strong>administrador</strong> vai gerar uma nova senha para você e repassá-la.
              (A redefinição automática por e-mail entra numa próxima versão.)
            </div>
          ) : (
            <>
              <p className="auth-sub">Informe seu e-mail. O administrador redefine sua senha e te envia a nova.</p>
              <div className="auth-field">
                <label>E-mail</label>
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <button className="btn btn-primary btn-full" disabled={loading}>
                {loading ? "Enviando..." : "Solicitar redefinição"}
              </button>
            </>
          )}
          <div className="auth-links">
            <a href="/login">Voltar ao login</a>
            <span />
          </div>
        </form>
      </div>
    </>
  );
}
