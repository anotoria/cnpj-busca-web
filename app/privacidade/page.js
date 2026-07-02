export const metadata = { title: "Política de Privacidade — Encontre o Lead" };

export default function Privacidade() {
  return (
    <>
      <div className="aura" />
      <div className="page" style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 80px" }}>
        <a href="/" className="brand" style={{ textDecoration: "none", color: "inherit", marginBottom: 24 }}>
          <span className="brand-mark">◎</span> Encontre o Lead
        </a>
        <h1 style={{ fontFamily: "var(--font-display)" }}>Política de Privacidade</h1>
        <p style={{ color: "var(--ink-soft)" }}>
          <strong>Dados do usuário:</strong> coletamos nome, e-mail e o histórico de buscas/exportações realizadas na
          plataforma, com a finalidade de autenticação, controle de acesso e melhoria do serviço. Esses dados não são
          vendidos a terceiros.
        </p>
        <p style={{ color: "var(--ink-soft)" }}>
          <strong>Dados das empresas:</strong> são informações públicas e oficiais de pessoas jurídicas. CPFs de sócios
          aparecem mascarados na fonte oficial.
        </p>
        <p style={{ color: "var(--ink-soft)" }}>
          <strong>Seus direitos (LGPD):</strong> você pode solicitar acesso, correção ou exclusão dos seus dados de
          cadastro a qualquer momento, pelo canal de contato do administrador.
        </p>
        <p style={{ color: "var(--ink-faint)", fontSize: 13 }}>Versão inicial — sujeita a atualização.</p>
      </div>
    </>
  );
}
