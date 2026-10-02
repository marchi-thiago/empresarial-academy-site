import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import type { AdminViewServerProps } from "payload";
import { EaHubBackLink } from "@/components/admin/brand/EaHubBackLink";
import { EaLeadsNav } from "@/components/admin/ea-leads/EaLeadsNav";
import { CabecalhoAtalho } from "./compartilhado";

/** Quem não está logado vai para o login e volta para a tela pedida (views custom não têm esse guard pronto). */
export function exigirLogin(props: AdminViewServerProps, caminho: string) {
  if (!props.initPageResult?.req?.user) {
    redirect(`/eahub/login?redirect=${encodeURIComponent(caminho)}`);
  }
}

/** Moldura das telas do CRM: voltar, abas do EA Leads e cabeçalho do atalho da Tela de Início. */
export function CrmShell({ children, subir = true }: { children: ReactNode; /** Falso no Kanban: o nível acima é o próprio EA HUB. */ subir?: boolean }) {
  return (
    <div className="ea-view ea-crm">
      <CabecalhoAtalho />
      <EaHubBackLink href={subir ? "/eahub/crm" : undefined} label={subir ? "Fila do dia" : undefined} />
      <EaLeadsNav comTitulo />
      {children}
    </div>
  );
}
