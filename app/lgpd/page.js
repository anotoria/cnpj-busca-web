export const metadata = { title: "Central de Privacidade (LGPD) — Prospect AI" };

const CONTATO = "essahora@gmail.com";

function mailto(assunto) {
  const url = `mailto:${CONTATO}?subject=${encodeURIComponent(`[LGPD] ${assunto}`)}&body=${encodeURIComponent(
    `Olá,\n\nVenho por meio deste solicitar: ${assunto}.\n\nDados para identificação:\n- Nome completo:\n- E-mail cadastrado:\n\nDetalhes adicionais (opcional):\n\n\nAtenciosamente.`
  )}`;
  return url;
}

export default function LGPD() {
  const direitos = [
    {
      titulo: "Confirmar se tratamos seus dados",
      texto: "Você pode pedir uma confirmação de que tratamos dados pessoais seus e obter uma cópia das informações mantidas em nossa base.",
      assunto: "Confirmação e acesso aos meus dados",
    },
    {
      titulo: "Corrigir dados incorretos ou desatualizados",
      texto: "Se algum dado do seu cadastro estiver errado, incompleto ou desatualizado, você pode solicitar a correção.",
      assunto: "Correção de dados pessoais",
    },
    {
      titulo: "Solicitar a exclusão da sua conta",
      texto: "Você pode pedir a exclusão dos seus dados pessoais tratados com base no seu consentimento, ressalvadas as hipóteses legais de guarda obrigatória.",
      assunto: "Exclusão da minha conta e dos meus dados",
    },
    {
      titulo: "Portabilidade dos dados",
      texto: "Você pode solicitar que seus dados sejam entregues em formato estruturado e legível, para uso por você ou por outro fornecedor de serviço.",
      assunto: "Portabilidade dos meus dados",
    },
    {
      titulo: "Saber com quem compartilhamos seus dados",
      texto: "Você pode pedir informações sobre as entidades públicas ou privadas com as quais compartilhamos os seus dados pessoais.",
      assunto: "Informações sobre compartilhamento dos meus dados",
    },
    {
      titulo: "Revogar consentimento",
      texto: "Quando o tratamento se basear no seu consentimento, você pode revogá-lo a qualquer momento. Isso pode afetar funcionalidades que dependam desse consentimento.",
      assunto: "Revogação de consentimento",
    },
    {
      titulo: "Opor-se ao tratamento",
      texto: "Você pode se opor a tratamentos realizados com base em legítimo interesse, apresentando suas justificativas.",
      assunto: "Oposição ao tratamento de dados",
    },
    {
      titulo: "Reclamar à ANPD",
      texto: "Você pode apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD), órgão fiscalizador da LGPD no Brasil.",
      assunto: null,
    },
  ];

  return (
    <>
      <div className="aura" />
      <div className="page legal-page">
        <a href="/" className="brand" style={{ textDecoration: "none", color: "inherit", marginBottom: 24 }}>
          <span className="brand-mark">◎</span> Prospect AI
        </a>
        <h1>Central de Privacidade</h1>
        <p className="legal-sub">
          Espaço dedicado ao exercício dos seus direitos como titular de dados pessoais, conforme a
          <strong> Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD)</strong>.
        </p>

        <div className="table-card" style={{ padding: 20, marginBottom: 20 }}>
          <h2 style={{ marginTop: 0 }}>Como funciona</h2>
          <p style={{ color: "var(--ink-soft)" }}>
            Para exercer qualquer um dos direitos abaixo, clique no botão correspondente. O botão abre seu programa de
            e-mail com uma mensagem preenchida direcionada ao nosso canal de atendimento à LGPD. Também aceitamos
            solicitações por escrito no mesmo endereço.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Canal de contato LGPD:</strong> <a href={`mailto:${CONTATO}`}>{CONTATO}</a><br />
            <strong>Prazo de resposta:</strong> até 15 dias úteis do recebimento da solicitação identificada.
          </p>
        </div>

        <h2>Seus direitos</h2>
        <div style={{ display: "grid", gap: 14 }}>
          {direitos.map((d, i) => (
            <div key={i} className="table-card" style={{ padding: 16 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 17, marginBottom: 6 }}>{i + 1}. {d.titulo}</div>
              <p style={{ margin: "0 0 12px", color: "var(--ink-soft)", fontSize: 14 }}>{d.texto}</p>
              {d.assunto ? (
                <a className="btn btn-primary btn-page" href={mailto(d.assunto)}>Solicitar por e-mail</a>
              ) : (
                <a className="btn btn-ghost btn-page" href="https://www.gov.br/anpd/pt-br" target="_blank" rel="noreferrer noopener">Acessar o site da ANPD</a>
              )}
            </div>
          ))}
        </div>

        <h2>Antes de nos escrever</h2>
        <ul>
          <li>Utilize o mesmo e-mail do seu cadastro, para agilizar a identificação.</li>
          <li>Descreva com clareza sua solicitação e, se possível, o período ou dados a que se refere.</li>
          <li>Podemos solicitar informações adicionais para confirmar a sua identidade e proteger seus dados de acessos indevidos.</li>
        </ul>

        <h2>Documentos relacionados</h2>
        <ul>
          <li><a href="/privacidade">Política de Privacidade</a></li>
          <li><a href="/cookies">Política de Cookies</a></li>
          <li><a href="/termos">Termos de Uso</a></li>
        </ul>

        <p className="legal-footer"><a href="/">← Voltar à página inicial</a></p>
      </div>
    </>
  );
}
