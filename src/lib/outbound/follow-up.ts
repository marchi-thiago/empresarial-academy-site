export function planoFollowUp(diasDesdeProposta: number): { enviar: boolean; texto: string } {
  if (diasDesdeProposta === 2) {
    return {
      enviar: true,
      texto: "Olá! Conseguiram analisar a proposta que enviei? Qualquer dúvida sobre a implantação ou os próximos passos, estou à disposição."
    };
  }
  if (diasDesdeProposta === 5) {
    return {
      enviar: true,
      texto: "Oi, tudo bem? Queria entender se a nossa proposta faz sentido para o momento de vocês ou se a prioridade agora é outra. Um abraço."
    };
  }
  if (diasDesdeProposta === 10) {
    return {
      enviar: true,
      texto: "Olá! Como não tive retorno, imagino que o foco tenha mudado. Vou pausar nossos contatos por agora, mas deixo aqui o link do nosso Diagnóstico de Maturidade caso queiram revisar a operação no futuro. Abraço!"
    };
  }
  return { enviar: false, texto: "" };
}
