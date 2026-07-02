export const metadata = { title: "Termos de Uso — Encontre o Lead" };

export default function Termos() {
  return (
    <>
      <div className="aura" />
      <div className="page" style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 80px" }}>
        <a href="/" className="brand" style={{ textDecoration: "none", color: "inherit", marginBottom: 24 }}>
          <span className="brand-mark">◎</span> Encontre o Lead
        </a>
        <h1 style={{ fontFamily: "var(--font-display)" }}>Termos de Uso</h1>
        <p style={{ color: "var(--ink-soft)" }}>
          A plataforma disponibiliza consulta a dados públicos de empresas brasileiras, oriundos de bases oficiais
          disponibilizadas ao público (Lei 12.527/2011). O uso é destinado a fins lícitos de prospecção comercial.
        </p>
        <p style={{ color: "var(--ink-soft)" }}>
          O usuário compromete-se a: (i) usar os dados em conformidade com a legislação vigente, incluindo a LGPD
          (Lei 13.709/2018) e a legislação anti-spam; (ii) não revender ou redistribuir a base; (iii) responsabilizar-se
          pelo contato com as empresas listadas. O acesso é pessoal e intransferível, e pode ser suspenso a qualquer
          momento em caso de uso indevido.
        </p>
        <p style={{ color: "var(--ink-faint)", fontSize: 13 }}>Versão inicial — sujeita a atualização.</p>
      </div>
    </>
  );
}
