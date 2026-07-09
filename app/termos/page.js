export const metadata = { title: "Termos de Uso — Prospect AI" };

export default function Termos() {
  return (
    <>
      <div className="aura" />
      <div className="page legal-page">
        <a href="/" className="brand" style={{ textDecoration: "none", color: "inherit", marginBottom: 24 }}>
          <span className="brand-mark">◎</span> Prospect AI
        </a>
        <h1>Termos de Uso</h1>
        <p className="legal-sub">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

        <p>
          Estes Termos de Uso regulam o acesso e a utilização da plataforma <strong>Prospect AI</strong>. Ao criar uma
          conta ou usar qualquer funcionalidade, você declara ter lido, compreendido e concordado integralmente com
          estes Termos e com nossa <a href="/privacidade">Política de Privacidade</a>.
        </p>

        <h2>1. Descrição do serviço</h2>
        <p>
          O Prospect AI é uma ferramenta online para prospecção comercial. Ela permite buscar informações sobre empresas
          brasileiras, aplicar filtros, exportar resultados e enviá-los a integrações configuradas pelo próprio usuário
          (como CRMs e webhooks).
        </p>

        <h2>2. Cadastro e conta</h2>
        <ul>
          <li>O cadastro é feito exclusivamente por convite ou por criação direta pelo administrador.</li>
          <li>Você é responsável por manter suas credenciais em sigilo e por todas as atividades realizadas na sua conta.</li>
          <li>Deve fornecer informações verdadeiras e mantê-las atualizadas.</li>
          <li>Contas suspeitas de compartilhamento indevido, uso fraudulento ou violação destes Termos podem ser suspensas ou encerradas.</li>
        </ul>

        <h2>3. Planos, período de teste e pagamento</h2>
        <p>
          Poderemos disponibilizar planos gratuitos, período de teste e planos pagos. As condições, valores e limites de
          uso vigentes serão apresentados no momento da contratação. O não pagamento pode implicar a suspensão do
          acesso.
        </p>

        <h2>4. Uso permitido</h2>
        <p>Você pode utilizar a plataforma para:</p>
        <ul>
          <li>Realizar buscas e visualizar resultados dentro dos limites do seu plano.</li>
          <li>Exportar dados para uso próprio ou de sua organização.</li>
          <li>Enviar seleções às integrações que você mesmo configurar (ex.: seu CRM).</li>
        </ul>

        <h2>5. Uso proibido</h2>
        <p>É expressamente vedado:</p>
        <ul>
          <li>Revender, sublicenciar, redistribuir ou tornar públicos os resultados obtidos.</li>
          <li>Utilizar os dados para envio de mensagens não solicitadas (spam) ou em desacordo com a legislação anti-spam e a LGPD.</li>
          <li>Empregar meios automatizados de coleta massiva além do previsto na sua contratação (scraping, robôs, bypass de limites).</li>
          <li>Explorar falhas de segurança, tentar acessar áreas restritas ou dados de outros usuários.</li>
          <li>Fazer engenharia reversa, copiar ou reproduzir partes da plataforma sem autorização.</li>
        </ul>

        <h2>6. Responsabilidade sobre o uso dos resultados</h2>
        <p>
          Os resultados exibidos correspondem a informações comerciais obtidas por busca online. Você é o único
          responsável pelo uso que faz desses resultados, inclusive pelo cumprimento da LGPD e demais leis aplicáveis,
          e assume integralmente eventuais consequências decorrentes do contato com terceiros.
        </p>

        <h2>7. Integrações de terceiros</h2>
        <p>
          Ao configurar integrações (CRMs, webhooks etc.), você autoriza o Prospect AI a transmitir os dados
          selecionados ao destino informado. Não somos responsáveis pelo tratamento subsequente realizado por esses
          serviços de terceiros; a você cabe zelar pela adequação legal dessas integrações.
        </p>

        <h2>8. Disponibilidade e limitações</h2>
        <p>
          Buscamos manter a plataforma disponível de forma contínua, mas não garantimos ausência de interrupções ou
          erros. Podemos realizar manutenções, atualizações ou suspensões pontuais sem aviso prévio, quando necessário
          para segurança ou aperfeiçoamento do serviço.
        </p>

        <h2>9. Propriedade intelectual</h2>
        <p>
          A marca, o design, a interface e o software do Prospect AI são protegidos por direitos autorais e de
          propriedade industrial. O uso da plataforma não transfere ao usuário qualquer direito de propriedade
          intelectual sobre esses elementos.
        </p>

        <h2>10. Limitação de responsabilidade</h2>
        <p>
          Na máxima extensão permitida por lei, o Prospect AI não se responsabiliza por danos indiretos, lucros
          cessantes ou eventuais prejuízos decorrentes do uso ou impossibilidade de uso da plataforma, exceto nos casos
          de dolo ou culpa comprovada.
        </p>

        <h2>11. Rescisão</h2>
        <p>
          Você pode encerrar sua conta a qualquer momento pela Central de Privacidade. Podemos rescindir o acesso em
          caso de descumprimento destes Termos, com envio de aviso prévio quando cabível.
        </p>

        <h2>12. Alterações destes Termos</h2>
        <p>
          Estes Termos podem ser atualizados periodicamente. A data no topo indica a versão vigente. Alterações
          relevantes serão comunicadas com destaque no acesso à plataforma.
        </p>

        <h2>13. Lei aplicável e foro</h2>
        <p>
          Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro da comarca de domicílio do usuário para
          dirimir controvérsias, salvo disposição legal em contrário.
        </p>

        <p className="legal-footer"><a href="/">← Voltar à página inicial</a></p>
      </div>
    </>
  );
}
