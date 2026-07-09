export const metadata = { title: "Política de Privacidade — Prospect AI" };

export default function Privacidade() {
  return (
    <>
      <div className="aura" />
      <div className="page legal-page">
        <a href="/" className="brand" style={{ textDecoration: "none", color: "inherit", marginBottom: 24 }}>
          <span className="brand-mark">◎</span> Prospect AI
        </a>
        <h1>Política de Privacidade</h1>
        <p className="legal-sub">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

        <p>
          Esta Política de Privacidade descreve como o <strong>Prospect AI</strong> ("nós", "nossa plataforma") trata os
          dados pessoais dos usuários da plataforma, em conformidade com a <strong>Lei Geral de Proteção de Dados
          (Lei nº 13.709/2018 — LGPD)</strong>.
        </p>

        <h2>1. Quem somos</h2>
        <p>
          O Prospect AI é uma ferramenta online que oferece consulta a informações comerciais de empresas brasileiras
          para fins de prospecção. Toda a busca é realizada online, e os resultados são consolidados a partir de
          consultas na internet.
        </p>

        <h2>2. Dados pessoais que coletamos</h2>
        <p>Coletamos apenas os dados necessários ao funcionamento do serviço:</p>
        <ul>
          <li><strong>Cadastro:</strong> nome completo, e-mail e senha (armazenada de forma criptografada).</li>
          <li><strong>Uso da plataforma:</strong> histórico de buscas, filtros utilizados, exportações realizadas e envios feitos às suas integrações.</li>
          <li><strong>Dados técnicos:</strong> endereço IP, data e hora de acesso, e informações do navegador utilizadas para segurança e prevenção de abuso.</li>
          <li><strong>Cookies estritamente necessários:</strong> para manter sua sessão autenticada e o funcionamento essencial da plataforma. Detalhes em nossa <a href="/cookies">Política de Cookies</a>.</li>
        </ul>

        <h2>3. Finalidades e base legal</h2>
        <p>Utilizamos seus dados pessoais com as seguintes finalidades:</p>
        <ul>
          <li><strong>Execução do contrato</strong> (art. 7º, V, LGPD): autenticação, prestação do serviço, envio das suas seleções às integrações configuradas por você.</li>
          <li><strong>Legítimo interesse</strong> (art. 7º, IX): segurança, prevenção de fraude e abuso, melhoria da experiência.</li>
          <li><strong>Cumprimento de obrigação legal ou regulatória</strong> (art. 7º, II): guarda de registros de acesso quando exigido por lei.</li>
          <li><strong>Consentimento</strong> (art. 7º, I): quando aplicável, para funcionalidades opcionais.</li>
        </ul>

        <h2>4. Compartilhamento de dados</h2>
        <p>
          Não vendemos seus dados pessoais. Compartilhamos informações apenas nas seguintes hipóteses:
        </p>
        <ul>
          <li><strong>Com prestadores de infraestrutura</strong> essenciais à operação da plataforma (hospedagem, banco de dados, autenticação), sob obrigações contratuais de sigilo e proteção.</li>
          <li><strong>Com integrações que você mesmo configurar</strong> (ex.: seu CRM HighLevel ou webhooks próprios). Nesses casos, você é o responsável pelo destino escolhido, e nós apenas executamos o envio conforme sua instrução.</li>
          <li><strong>Por ordem judicial ou autoridade competente</strong>, dentro dos limites legais.</li>
        </ul>

        <h2>5. Retenção dos dados</h2>
        <p>
          Mantemos seus dados enquanto sua conta estiver ativa. Ao solicitar a exclusão da conta, seus dados pessoais
          são removidos em até 30 dias, ressalvadas as hipóteses de guarda obrigatória por lei (por exemplo, registros de
          acesso).
        </p>

        <h2>6. Seus direitos</h2>
        <p>
          Como titular dos dados, você pode a qualquer momento solicitar: confirmação da existência de tratamento, acesso
          aos dados, correção de dados incompletos ou desatualizados, anonimização, portabilidade, eliminação dos dados
          tratados com seu consentimento, informação sobre com quem compartilhamos dados e revogação do consentimento.
        </p>
        <p>
          Para exercer qualquer desses direitos, acesse a <a href="/lgpd">Central de Privacidade</a>.
        </p>

        <h2>7. Segurança</h2>
        <p>
          Adotamos medidas técnicas e organizacionais para proteger seus dados, incluindo criptografia em trânsito
          (HTTPS), controle de acesso por perfil, autenticação segura e registros de auditoria. Ainda que nenhum sistema
          seja invulnerável, buscamos as melhores práticas de mercado.
        </p>

        <h2>8. Uso responsável dos resultados de busca</h2>
        <p>
          Os resultados da busca online correspondem a informações de empresas brasileiras. Você concorda em utilizá-los
          exclusivamente para fins lícitos de prospecção comercial, respeitando a legislação aplicável, inclusive a LGPD
          e normas anti-spam.
        </p>

        <h2>9. Alterações desta política</h2>
        <p>
          Podemos atualizar esta política periodicamente. Quando fizermos, alteraremos a data no topo. Recomendamos
          revisão eventual.
        </p>

        <h2>10. Contato</h2>
        <p>
          Dúvidas ou solicitações sobre esta Política podem ser enviadas pelo canal indicado na
          <a href="/lgpd"> Central de Privacidade</a>.
        </p>

        <p className="legal-footer"><a href="/">← Voltar à página inicial</a></p>
      </div>
    </>
  );
}
