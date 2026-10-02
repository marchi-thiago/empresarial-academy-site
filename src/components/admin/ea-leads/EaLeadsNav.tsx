"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const AREAS = [
  {
    href: "/eahub/crm",
    label: "Fila do dia",
    funcao: "Com quem falar agora, em ordem: quem respondeu, quem mostrou interesse, reuniões e ligações de hoje.",
    uso: "Faça de cima para baixo: toque em Ligar ou WhatsApp e depois no resultado. Tudo fica registrado na linha do tempo do lead.",
  },
  {
    href: "/eahub/crm/linkedin",
    label: "LinkedIn",
    funcao: "Fila de convites do LinkedIn semiautomáticos (seguidores da EA e decisores do dossiê).",
    uso: "Abra o perfil, copie a nota (até 200 caracteres, sem travessão) e marque 'Enviado'. Quando responder, marque 'Aceito'.",
  },
  {
    href: "/eahub/crm/kanban",
    label: "Kanban",
    funcao: "Cada lead na etapa da jornada, com temperatura, status de entrega por canal e próximo passo.",
    uso: "Filtre e abra a ficha do lead. Arraste o card, ou use \"Mover para\" no celular. Todo movimento fica registrado.",
  },
  {
    href: "/eahub/crm/painel",
    label: "Painel do CRM",
    funcao: "Funil por etapa, canal, segmento e campanha, e as metas do plano contra o número real.",
    uso: "Só entram números registrados no sistema. Onde ainda não há dado, o painel diz o que falta.",
  },
  {
    href: "/eahub/collections/leads",
    label: "Base de leads",
    funcao: "Todos os leads num lugar só: formulários do site, Diagnóstico de Maturidade e EA Hunter.",
    uso: "Busque por nome, empresa, @, WhatsApp, área ou fonte. Abra um lead para ver contato, captação, e-mails recebidos e negócio.",
  },
  {
    href: "/eahub/collections/email-segments",
    label: "Segmentos",
    funcao: "Grupos de leads por origem, pilar mais fraco ou nota do diagnóstico.",
    uso: "Toda campanha manual vai para um segmento. Só entram leads com e-mail, consentimento e sem descadastro.",
  },
  {
    href: "/eahub/collections/email-campaigns",
    label: "Campanhas e nutrição",
    funcao: "Os e-mails automáticos (jornadas de nutrição) e as campanhas que você dispara na hora.",
    uso: "Os textos das jornadas ficam em Modelos de e-mail. Cada envio aparece em Envios e na ficha do lead.",
  },
  {
    href: "/eahub/collections/email-templates",
    label: "Modelos de e-mail",
    funcao: "Os textos das jornadas: por tema do material, por pilar do diagnóstico e por área de atuação.",
    uso: "Edite e confira a prévia antes de salvar. Campo vazio usa o texto padrão. A jornada do EA Hunter só envia com \"Envio ligado\".",
  },
  {
    href: "/eahub/collections/email-logs",
    label: "Envios",
    funcao: "O histórico de cada e-mail enviado, com o resultado do envio.",
    uso: "Clique num envio para ver o lead e a campanha. Envio com problema aparece como \"Falhou\".",
  },
];

/**
 * Cabeçalho comum das telas do EA Leads: abas + o que a tela faz. Estilo em ea-hub-theme.css.
 * `comTitulo`: só nas views custom, que não têm o título padrão do Payload logo abaixo.
 */
export function EaLeadsNav({ comTitulo = false }: { comTitulo?: boolean }) {
  const pathname = usePathname() ?? "";
  // A aba mais específica que casa com o endereço (/eahub/crm/fila antes de /eahub/crm).
  const atual =
    [...AREAS].sort((a, b) => b.href.length - a.href.length).find((a) => pathname === a.href || pathname.startsWith(`${a.href}/`)) ??
    AREAS.find((a) => a.href === "/eahub/collections/leads")!;

  return (
    <section className="ea-leads-header" aria-label="EA Leads">
      <div className="ea-leads-eyebrow">EA Leads</div>
      {comTitulo ? <h2 className="ea-leads-title">{atual.label}</h2> : null}
      <nav className="ea-leads-tabs" aria-label="Áreas do EA Leads">
        {AREAS.map((a) => (
          <Link key={a.href} href={a.href} className="ea-leads-tab" aria-current={a === atual ? "page" : undefined}>
            {a.label}
          </Link>
        ))}
      </nav>
      <div className="ea-leads-funcao">
        <div>
          <strong className="ea-leads-rotulo-funcao">Função:</strong> {atual.funcao}
        </div>
        <div>
          <strong className="ea-leads-rotulo-uso">Como usar:</strong> {atual.uso}
        </div>
      </div>
    </section>
  );
}
