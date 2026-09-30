# LGPD: avaliação de legítimo interesse para prospecção B2B

Documento da frente F0 do Projeto Outbound. Data: 30/09/2026. Controlador: Empresarial
Academy (Thiago Marchi, empresário individual, CNPJ 52.281.916/0001-60).

Aviso: é uma avaliação interna de boa-fé, feita pelo time técnico. Não substitui parecer
jurídico. Se um advogado de confiança puder revisar uma vez, vale a pena antes do piloto.

## 1. Tratamento avaliado

Prospecção ativa de donos e gestores de empresas (PMEs) por DM no Instagram, e-mail,
WhatsApp, LinkedIn (semiautomático) e ligação, para convidá-los a uma reunião de 20 minutos
sobre a consultoria empresarial com IA.

Dados tratados (todos profissionais e de fonte pública): nome e cargo do responsável, nome e
segmento da empresa, e-mail e telefone comerciais, perfil público de rede social, texto do
site da empresa e dados de cadastro de CNPJ (BrasilAPI, que reproduz a Receita Federal).
Dados sensíveis (art. 5º, II) não são coletados nem inferidos.

## 2. Base legal

Legítimo interesse (art. 7º, IX, e art. 10 da LGPD). Teste em quatro passos.

### 2.1 Finalidade legítima e situação concreta

Oferecer um serviço B2B a empresas com perfil compatível, com contato profissional único por
canal, explicado e com saída fácil. É finalidade legítima (promoção de atividade do
controlador, art. 10, I). Não há venda nem cessão de dados a terceiros.

### 2.2 Necessidade

| Princípio | Como é atendido |
|---|---|
| Minimização | Só o necessário para abordar e registrar: nome, cargo, empresa, canais profissionais e origem. Nada de CPF, endereço residencial, dados de família ou saúde. |
| Dado profissional | Contatos de pessoa física em contexto de negócio (dono ou gestor da empresa). Perfis pessoais sem ligação com a empresa ficam fora. |
| Sem alternativa menos intrusiva equivalente | Outbound de volume baixo (50 por dia por canal) e cadência curta é menos intrusivo que mala direta em massa. |

### 2.3 Balanceamento (expectativa do titular)

- Um dono de PME que publica e-mail, site ou Instagram comercial espera, de forma razoável,
  receber propostas comerciais relevantes ao seu negócio. A oferta é pertinente ao segmento e
  ao porte.
- Impacto baixo para o titular: mensagem individual, sem perfilamento de comportamento fora
  do contexto comercial, sem decisão automatizada com efeito jurídico.
- Risco residual: contato que o titular considere indesejado. Mitigado pelas salvaguardas
  abaixo.
- Conclusão: o interesse do controlador não se sobrepõe aos direitos do titular **desde que
  as salvaguardas sejam cumpridas**. Se alguma deixar de valer (por exemplo, descadastro fora
  do ar), o envio real deve ser pausado (ver `RUNBOOK.md`).

### 2.4 Transparência e salvaguardas

1. **Origem informada:** toda mensagem diz de onde veio o contato (perfil público do
   Instagram, site da empresa ou cadastro de CNPJ) e por que a pessoa a recebeu.
2. **Descadastro em 1 clique:** link em todo e-mail (com cabeçalho `List-Unsubscribe`) e
   instrução de resposta ("responda SAIR") nos demais canais. Sem login e sem justificativa.
3. **Supressão global:** quem pede para sair, responde com oposição ou é excluído entra em
   uma lista única de supressão, consultada por **todos os canais** antes de qualquer envio.
   Guarda-se apenas o mínimo (identificador de contato e data) para não contatar de novo.
4. **Retenção de 12 meses sem interação**, depois exclusão automática do lead e do dossiê. O
   que renova o prazo é resposta do lead, reunião ou cadastro próprio no site.
5. **Encarregado de dados (DPO):** `dpo@empresarialacademy.com`; canal de direitos:
   `privacidade@empresarialacademy.com`. Ambos citados na política de privacidade. O rodapé
   das mensagens traz o canal de privacidade.
6. **Direitos do titular:** acesso, correção, exclusão e oposição atendidos em até 15 dias
   (art. 19, II). Procedimento no `RUNBOOK.md`.
7. **Sem dado inventado:** toda mensagem passa por `findClaimViolations`; a IA só usa fatos do
   perfil e do site do lead.
8. **Volume controlado:** limites diários por canal, chip dedicado e parada ao primeiro sinal
   de reclamação.
9. **Segurança:** base única no EA Leads (Neon), acesso restrito ao admin, segredos só na
   Vercel.
10. **IA:** o dossiê é gerado por modelo de linguagem a partir de dados públicos. Não há
    decisão automatizada com efeito jurídico sobre o titular e há revisão humana antes de
    ligar o envio real.

## 3. Registro e revisão

- Esta avaliação é o registro das operações de tratamento (art. 37) para a prospecção B2B.
- Revisar a cada mudança de canal, fonte de dados ou finalidade, e após o piloto.
- Política de privacidade atualizada em 30/09/2026 (seção 15 em `src/lib/legal.ts`).

## 4. Pendências do Thiago

1. Confirmar que `dpo@` e `privacidade@empresarialacademy.com` existem e são lidas (alias ou
   caixa no Microsoft 365). A política já os citava antes desta frente. Se não existirem,
   criar aliases que entregam em thiago@ ou trocar os endereços em `src/lib/legal.ts`. O
   fallback é `contato@empresarialacademy.com`.
2. Decidir se quer revisão jurídica pontual deste documento antes do piloto.
3. A nutrição automática de leads do Hunter segue desligada até decisão de LGPD; esta
   avaliação cobre prospecção, não nutrição em massa.
