export const metadata = { title: "Política de Cookies — Prospect AI" };

export default function Cookies() {
  return (
    <>
      <div className="aura" />
      <div className="page legal-page">
        <a href="/" className="brand" style={{ textDecoration: "none", color: "inherit", marginBottom: 24 }}>
          <span className="brand-mark">◎</span> Prospect AI
        </a>
        <h1>Política de Cookies</h1>
        <p className="legal-sub">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

        <p>
          Esta Política explica como o <strong>Prospect AI</strong> utiliza cookies e tecnologias similares (como
          armazenamento local) na sua plataforma online.
        </p>

        <h2>1. O que são cookies</h2>
        <p>
          Cookies são pequenos arquivos de texto salvos no seu dispositivo quando você acessa um site. Eles servem para
          lembrar informações da sua sessão, garantir a segurança e permitir que o site funcione corretamente.
        </p>

        <h2>2. Cookies que usamos</h2>

        <h3>2.1. Cookies estritamente necessários</h3>
        <p>
          São indispensáveis ao funcionamento da plataforma. Sem eles, você não consegue autenticar-se nem utilizar as
          áreas restritas. Não podem ser desativados.
        </p>
        <div className="table-card" style={{ overflowX: "auto", margin: "12px 0" }}>
          <table style={{ width: "100%", fontSize: 13.5 }}>
            <thead>
              <tr><th style={{ textAlign: "left", padding: "10px 12px" }}>Cookie</th><th style={{ textAlign: "left", padding: "10px 12px" }}>Finalidade</th><th style={{ textAlign: "left", padding: "10px 12px" }}>Duração</th></tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: "10px 12px", fontFamily: "monospace" }}>sb-*-auth-token</td>
                <td style={{ padding: "10px 12px" }}>Manter você autenticado durante a sessão.</td>
                <td style={{ padding: "10px 12px" }}>Sessão / até logout</td>
              </tr>
              <tr>
                <td style={{ padding: "10px 12px", fontFamily: "monospace" }}>prospectai_cookies_ok</td>
                <td style={{ padding: "10px 12px" }}>Registrar seu aceite ao banner de cookies.</td>
                <td style={{ padding: "10px 12px" }}>12 meses</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>2.2. Armazenamento local (localStorage)</h3>
        <p>
          Utilizamos armazenamento local do navegador para guardar preferências mínimas do usuário (ex.: aceite do
          banner de cookies). Esses dados ficam apenas no seu dispositivo e podem ser apagados a qualquer momento
          pelas configurações do próprio navegador.
        </p>

        <h3>2.3. Cookies de análise, marketing ou terceiros</h3>
        <p>
          <strong>Não utilizamos</strong> cookies de análise comportamental, publicidade ou rastreamento de terceiros
          nesta versão da plataforma. Caso venhamos a incluí-los no futuro, esta Política será atualizada e o
          consentimento correspondente será solicitado.
        </p>

        <h2>3. Como gerenciar cookies</h2>
        <p>
          Você pode, a qualquer momento, gerenciar ou excluir cookies pelo seu navegador. Cada navegador oferece
          instruções específicas — consulte a ajuda do Chrome, Firefox, Safari, Edge etc. Observação: a exclusão dos
          cookies estritamente necessários fará com que você seja desconectado e precise entrar novamente na plataforma.
        </p>

        <h2>4. Alterações</h2>
        <p>
          Podemos atualizar esta Política sempre que houver mudanças nos cookies utilizados. A data no topo indica a
          versão vigente.
        </p>

        <h2>5. Contato</h2>
        <p>
          Dúvidas sobre o uso de cookies podem ser enviadas pela <a href="/lgpd">Central de Privacidade</a>.
        </p>

        <p className="legal-footer"><a href="/">← Voltar à página inicial</a></p>
      </div>
    </>
  );
}
