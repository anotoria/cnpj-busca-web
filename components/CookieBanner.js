"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "prospectai_cookies_ok";

export default function CookieBanner() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    try {
      const ok = localStorage.getItem(STORAGE_KEY);
      if (!ok) setVisivel(true);
    } catch {
      // localStorage indisponível — não mostra
    }
  }, []);

  function aceitar() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ aceito_em: new Date().toISOString(), versao: 1 }));
    } catch {}
    setVisivel(false);
  }

  if (!visivel) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-labelledby="cookie-title">
      <div className="cookie-inner">
        <div className="cookie-text">
          <strong id="cookie-title">🍪 Cookies essenciais</strong>
          <p>
            Utilizamos apenas cookies estritamente necessários para autenticar sua sessão e manter o funcionamento da
            plataforma. Não usamos cookies de análise ou marketing. Leia mais em nossa{" "}
            <a href="/cookies">Política de Cookies</a>.
          </p>
        </div>
        <div className="cookie-actions">
          <a className="btn btn-ghost btn-page" href="/cookies">Saiba mais</a>
          <button className="btn btn-primary btn-page" onClick={aceitar}>Entendi</button>
        </div>
      </div>
    </div>
  );
}
