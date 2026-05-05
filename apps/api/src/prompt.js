export const POP_TEMPLATE = `
SISTEMA DE GESTAO DA QUALIDADE
PROCEDIMENTO OPERACIONAL PADRAO

TITULO: {{processName}}

Codigo: {{code}}
Revisao: {{revision}}
Data: {{date}}
Pagina: {{page}}

1. OBJETIVO
{{objective}}

2. DIAGRAMA
{{diagram}}

3. INDICACAO DO DIAGRAMA
{{detailedDescription}}

4. DOCUMENTOS QUE COMPOEM O PROCEDIMENTO
{{relatedDocuments}}

5. REGISTROS OBRIGATORIOS
{{recordsTable}}
`.trim();

export const PROCEDURE_SCHEMA_EXAMPLE = {
  header: {
    system: "Sistema de Gestao da Qualidade",
    processType: "Procedimento Operacional Padrao",
    processName: "",
    code: "",
    revision: "",
    date: ""
  },

  objective: "",

  diagram: {
    lanes: [
      "Gerente de Processos",
      "Auditor Interno",
      "Area Auditada"
    ],

    steps: [
      {
        id: "S1",
        number: "3.1",
        lane: "Gerente de Processos",
        type: "activity",
        title: "Elaborar programa anual de auditoria",
        description: "Definir o planejamento anual das auditorias internas.",
        responsible: "Gerente de Processos",
        inputDocuments: [],
        outputDocuments: ["DOC QUA 01 - Programa Anual de Auditoria"],
        records: [],
        next: "S2"
      }
    ],

    decisions: [
      {
        id: "D1",
        number: "3.5",
        lane: "Auditor Interno",
        type: "decision",
        question: "A documentacao recebida esta completa?",
        responsible: "Auditor Interno",
        yes: {
          label: "Sim",
          to: "S6",
          description: "Prosseguir com a auditoria."
        },
        no: {
          label: "Nao",
          to: "S5A",
          description: "Solicitar complementacao para a area auditada."
        }
      }
    ],

    connections: [
      { from: "START", to: "S1", label: "" },
      { from: "S1", to: "S2", label: "" },
      { from: "S2", to: "D1", label: "" },
      { from: "D1", to: "S6", label: "Sim" },
      { from: "D1", to: "S5A", label: "Nao" },
      { from: "S5A", to: "S2", label: "Retorna para analise" },
      { from: "S_FINAL", to: "END", label: "" }
    ],

    documents: [
      {
        code: "DOC QUA 01",
        name: "Programa Anual de Auditoria",
        generatedAt: "3.1",
        responsible: "Gerente de Processos"
      }
    ]
  },

  detailedFlow: [
    {
      step: "3.1",
      lane: "Gerente de Processos",
      title: "Elaborar programa anual de auditoria",
      description: "O Gerente de Processos elabora o programa anual considerando criticidade, resultados anteriores, riscos e requisitos aplicaveis.",
      inputs: ["Historico de auditorias", "Requisitos ISO 9001"],
      outputs: ["DOC QUA 01 - Programa Anual de Auditoria"],
      responsible: "Gerente de Processos",
      notes: []
    }
  ],

  documents: [
    {
      code: "ISO 9001",
      name: "Sistema de Gestao da Qualidade - Requisitos",
      type: "Norma externa"
    }
  ],

  records: [
    {
      code: "REG QUA 11",
      name: "Registro de Auditoria",
      generatedAt: "Abertura da auditoria",
      storage: "Repositorio definido pela organizacao",
      retrieval: "Por codigo, data e processo auditado",
      owner: "Qualidade",
      access: "Restrito aos envolvidos",
      retention: "nao identificado",
      disposal: "nao identificado"
    }
  ]
};

export function buildPrompt(input) {
  const processName = input.processName || "nao identificado";
  const code = input.code || "POP XXX YYY 00";
  const revision = input.revision || "00";
  const date = input.date || "nao identificado";
  const conversationContext = formatConversation(input.messages);
  const attachmentContext = formatAttachments(input.attachments);

  return `
Voce e um especialista em Sistema de Gestao da Qualidade, ISO 9001, auditoria interna, procedimentos operacionais padrao e modelagem BPMN.

Gere um PROCEDIMENTO OPERACIONAL PADRAO completo para o processo: ${processName}.

Siga exatamente este template textual:
${POP_TEMPLATE}

Metadados solicitados:
- Codigo: ${code}
- Revisao: ${revision}
- Data: ${date}

Contexto da conversa com o usuario:
${conversationContext}

Arquivos anexados e conteudo extraido:
${attachmentContext}

INSTRUCAO PRINCIPAL:
Use a conversa e os anexos como fonte primaria. O procedimento deve refletir o processo descrito pelo usuario, com etapas detalhadas, responsaveis, decisoes, documentos, registros e fluxo compativel com BPMN.

REGRAS GERAIS:
- Gere um objetivo claro, corporativo e auditavel.
- Gere etapas numeradas na secao 3 usando 3.1, 3.2, 3.3 e assim por diante.
- Gere um fluxo detalhado, nao generico.
- Inclua pelo menos uma decisao no fluxo.
- Inclua tratamento de nao conformidade, ajuste, retorno, acao corretiva ou plano de acao quando fizer sentido.
- Inclua acompanhamento, verificacao de eficacia e fechamento quando aplicavel.
- Preencha documentos relacionados, incluindo ISO 9001 quando aplicavel.
- Preencha a tabela de registros obrigatorios.
- Nao invente nomes de sistemas, leis, clientes ou documentos especificos sem base.
- Quando nao souber alguma informacao, use "nao identificado".

REGRAS OBRIGATORIAS PARA RESPONSAVEIS E SWIM LANES:
- Identifique claramente os responsaveis por cada etapa.
- Use os responsaveis como swim lanes.
- O array "diagram.lanes" deve conter somente os responsaveis/areas que executam etapas do processo.
- O campo "lane" de cada etapa e decisao deve conter exatamente um dos valores existentes em "diagram.lanes".
- Nao deixe etapas ou decisoes sem responsavel.
- Se o usuario mencionar responsaveis no chat, use exatamente essas informacoes.
- Exemplos de informacoes que devem ser respeitadas:
  - "etapa 3.1 e feita pelo Gerente"
  - "a verificacao e do Auditor"
  - "as acoes corretivas ficam com o Auditado"
  - "a aprovacao e feita pela Diretoria"
- Quando o responsavel nao estiver explicito, atribua a lane mais provavel com base no contexto.
- Evite usar lanes genericas demais se o usuario informou papeis especificos.

REGRAS OBRIGATORIAS PARA O DIAGRAMA:
- Gere fluxo compativel com BPMN.
- O diagrama deve possuir inicio, atividades, decisoes, ramos Sim/Nao, retornos quando aplicavel e fim.
- Cada etapa deve possuir:
  - id unico
  - number
  - lane
  - type
  - title
  - description
  - responsible
  - inputDocuments
  - outputDocuments
  - records
  - next
- Cada decisao deve possuir:
  - id unico
  - number
  - lane
  - type = "decision"
  - question
  - responsible
  - yes
  - no
- Toda decisao deve ter dois caminhos claros: Sim e Nao.
- Toda decisao deve ter conexoes correspondentes em "diagram.connections".
- Quando o caminho "Nao" exigir correcao, complementacao ou ajuste, crie uma etapa especifica para isso.
- Quando houver reanalise, validacao ou complementacao, crie loop de retorno no fluxo.
- As conexoes devem usar ids existentes em steps, decisions, START ou END.
- Use labels nas conexoes de decisao: "Sim" e "Nao".
- Evite conexoes soltas ou ids inexistentes.

REGRAS PARA DOCUMENTOS E REGISTROS:
- Inclua documentos de entrada e saida nas etapas.
- Inclua documentos gerados no array "diagram.documents".
- Inclua registros obrigatorios no array "records".
- Use codigos formais como REG QUA XX ou DOC QUA XX somente se:
  - o usuario informar explicitamente; ou
  - forem exemplos genericos claramente aplicaveis ao contexto.
- Quando nao houver codigo definido, use "nao identificado".
- Para cada registro, informe:
  - code
  - name
  - generatedAt
  - storage
  - retrieval
  - owner
  - access
  - retention
  - disposal

REGRAS PARA A SECAO 3 - INDICACAO DO DIAGRAMA:
- O campo "detailedFlow" deve explicar cada etapa do fluxo.
- Cada item de "detailedFlow" deve corresponder a uma etapa ou decisao do diagrama.
- Descreva quem executa, o que faz, quais entradas utiliza e quais saidas gera.
- Mencione documentos, registros e evidencias quando existirem.
- Para decisoes, descreva o que acontece no caminho Sim e no caminho Nao.

REGRAS DE QUALIDADE:
- O resultado deve ser especifico, auditavel e rastreavel.
- O procedimento deve parecer utilizavel em ambiente corporativo real.
- Evite frases vagas como "realizar processo" ou "executar atividade" sem detalhamento.
- Se houver contexto suficiente, detalhe criterios de aceite, verificacao, aprovacao e fechamento.
- Se houver nao conformidade, inclua plano de acao, responsavel, prazo, verificacao de eficacia e encerramento.
- Se houver auditoria, inclua planejamento, preparacao, execucao, registros, relatorio, plano de acao, follow-up e encerramento.

VALIDACAO ANTES DE RESPONDER:
Antes de responder, confira internamente:
- Todas as lanes usadas em steps e decisions existem em diagram.lanes.
- Todas as conexoes apontam para ids existentes, START ou END.
- Toda decisao possui Sim e Nao.
- Toda etapa possui responsavel.
- O fluxo possui inicio e fim.
- O JSON e valido.
- Nao ha markdown na resposta.

Responda somente com JSON valido, sem markdown, seguindo este schema:
${JSON.stringify(PROCEDURE_SCHEMA_EXAMPLE, null, 2)}
`.trim();
}

function formatConversation(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return "- nao identificado";
  }

  return messages
    .slice(-20)
    .map((message) => {
      const role = message?.role === "assistant" ? "Agente" : "Usuario";
      const content = String(message?.content || "")
        .replace(/\s+/g, " ")
        .trim();

      return `- ${role}: ${content || "nao identificado"}`;
    })
    .join("\n");
}

function formatAttachments(attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return "- nao identificado";
  }

  return attachments
    .slice(0, 10)
    .map((attachment) => {
      const name = String(attachment?.name || "arquivo sem nome").trim();
      const type = String(attachment?.type || "tipo nao identificado").trim();
      const extraction = String(attachment?.extraction || "metadata-only").trim();
      const text = String(attachment?.text || "")
        .slice(0, 12000)
        .trim();

      if (!text) {
        return `- ${name} (${type}, ${extraction}): conteudo textual nao extraido no modo atual.`;
      }

      return `- ${name} (${type}, ${extraction}):\n${text}`;
    })
    .join("\n\n");
}