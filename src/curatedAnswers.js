/**
 * Sistema de Respostas Curadas - Vixer AI
 * Respostas corretas, revisadas e baseadas nos documentos oficiais da Multivix.
 * Quando uma pergunta corresponde a um tópico curado, o LLM é bypassado completamente,
 * evitando alucinações em modelos pequenos (< 1B parâmetros).
 */

const CURATED_ANSWERS = [
  {
    id: 'rematricula-presencial',
    keywords: ['rematrícula', 'rematricula', 'renovação de matrícula', 'renovacao de matricula', 'renovar matrícula', 'renovar matricula'],
    question_patterns: ['como funciona', 'como e', 'processo de', 'o que e', 'explique', 'me explica', 'me fala', 'como faço', 'como faco'],
    contextTopicId: 'rematricula',
    answer: `📌 **Fonte Oficial:** Manual do Aluno e Manual de Rematrícula — Grupo Multivix

## 🔄 Processo de Rematrícula para Alunos Presenciais

A rematrícula na Multivix é feita de forma **automática** para alunos considerados aptos, conforme a Portaria Institucional.

---

### ✅ Para ser considerado apto à rematrícula automática, você precisa:

1. **Estar com as mensalidades quitadas** — ou ter financiamento estudantil (FIES/ProUni) regularizado.
2. **Não ter débitos na Biblioteca** (multas ou materiais não devolvidos impedem a rematrícula).
3. **Não ter bolsas desreguladas** (bolsas parciais ou convênios devem estar em dia).

---

### 📋 Passo a passo:

**1. Progressão Automática**
A Multivix renova sua vaga no sistema automaticamente, dentro do prazo do Calendário Acadêmico. Você não precisa fazer nada nessa etapa.

**2. Aceite do Contrato**
Ao acessar o **Portal Multivix** ou o **App Multivix**, você deve ler e aceitar os termos do contrato educacional clicando em _"Li e aceito os termos do contrato"_.

**3. Ajuste de Grade (opcional)**
Se precisar incluir ou retirar disciplinas (DPs, optativas, adaptações), solicite pelo Portal Multivix dentro do prazo de reajuste previsto no Calendário Acadêmico.

---

### ⚠️ Atenção:
- Alunos com **débitos financeiros** devem negociar diretamente com o escritório de cobrança conveniado. A rematrícula só é confirmada após a compensação bancária.
- Alunos que **não realizarem a rematrícula** e não solicitarem trancamento formal serão caracterizados como **abandono de curso**.
- O **comprovante de rematrícula** pode ser impresso no Portal Multivix > *Documentos Digitais*.

---

📱 **Acesse:** [Portal Multivix](https://portal.multivix.edu.br) ou o **App Multivix**.`
  },

  {
    id: 'rematricula-resumo',
    keywords: ['rematrícula', 'rematricula', 'renovação', 'renovacao', 'matricula', 'matrícula'],
    question_patterns: ['resumir', 'resumo', 'resumindo', 'simplificar', 'simplifica', 'simplificando', 'em poucas palavras', 'não entendi', 'n entendi', 'nao entendi', 'pode explicar melhor', 'mais simples', 'mais claro', 'de forma simples'],
    contextTopicId: 'rematricula',
    // Também ativado por follow-up sem keyword se contextTopicId bater
    contextOnly: true,
    answer: `## 🔄 Rematrícula — Em 4 passos simples

1. **Estar apto:** Não ter dívidas financeiras, pendências na biblioteca ou bolsas desreguladas.

2. **Progressão automática:** A própria faculdade renova sua vaga no sistema automaticamente.

3. **Aceite do contrato:** Você acessa o **Portal Multivix** ou o **App Multivix** e aceita o contrato educacional.

4. **Ajuste de grade (opcional):** Se precisar incluir ou retirar disciplinas (DPs, optativas), basta solicitar pelo portal dentro do prazo.

📱 **Portal Multivix** → [portal.multivix.edu.br](https://portal.multivix.edu.br)`
  },

  {
    id: 'faltas-frequencia',
    keywords: ['falta', 'faltas', 'frequência', 'frequencia', 'reprovar por falta', 'limite de falta', '75%', 'presença', 'presenca'],
    question_patterns: ['qual o limite', 'quantas faltas', 'como funciona', 'posso faltar', 'reprovar', 'reprovação'],
    contextTopicId: 'faltas',
    answer: `📌 **Fonte Oficial:** Regimento Interno — Faculdade Multivix

## 📅 Regras de Frequência e Limite de Faltas

---

### ✅ Frequência mínima obrigatória:

O aluno deve ter **mínimo de 75% de frequência** em cada disciplina para ser aprovado, independentemente da nota.

- **Exemplo:** Em uma disciplina com 80 h/a no semestre → máximo de **20 horas de falta** (25%).
- Ultrapassar esse limite resulta em **reprovação por falta**, mesmo com nota suficiente.

---

### ⚠️ Pontos importantes:

1. A contagem é feita **por disciplina** — não há compensação entre matérias.
2. **Não há abono automático** por atestado médico (salvo licença maternidade, serviço militar obrigatório ou regime especial homologado).
3. Acompanhe sua frequência em tempo real no **Portal Multivix > Frequência por Disciplina**.`
  },

  {
    id: 'prova-substitutiva',
    keywords: ['prova substitutiva', 'substitutiva', 'segunda chamada', 'isencao', 'isenção', 'portaria 04', 'taxa substitutiva'],
    question_patterns: ['como funciona', 'como solicitar', 'posso fazer', 'quem tem direito', 'isenção', 'taxa'],
    contextTopicId: 'substitutiva',
    answer: `📌 **Fonte Oficial:** Portaria Institucional nº 04 — Faculdade Multivix

## 📝 Prova Substitutiva (Segunda Chamada)

A **Prova Substitutiva** permite refazer **uma** avaliação por disciplina/semestre (falta ou nota baixa).

---

### 📋 Como solicitar:

1. Acesse o **Portal Multivix** dentro do prazo do Calendário Acadêmico.
2. Preencha o requerimento de Prova Substitutiva.
3. Pague a **taxa** (quando aplicável).
4. Compareça na data agendada pela Coordenação.

---

### 💰 Quem tem direito à isenção da taxa:

- Renda familiar **per capita até 1,5 salário mínimo** (comprovado).
- Beneficiários de programas sociais (ex.: Bolsa Família).
- Demais situações da Portaria nº 04 (consulte a Secretaria Acadêmica).

---

⚠️ A prova cobre o **conteúdo integral da disciplina**, não só o conteúdo da avaliação substituída.`
  },

  {
    id: 'calendario-academico',
    keywords: ['calendário', 'calendario', 'datas', 'prazos', '2026', 'semestre'],
    question_patterns: ['quais são as datas', 'quando começa', 'quando termina', 'datas importantes', 'prazo'],
    contextTopicId: 'calendario',
    answer: `📌 **Fonte Oficial:** Calendário Acadêmico de Graduação Presencial 2026 — Multivix

## 📅 Principais Datas do Calendário Acadêmico 2026

### 📆 Semestre 2026/1 (Janeiro – Julho):
- **02 a 10/01** — Rematrícula Automática para o semestre 2026/1
- **02 a 06/01** — Solicitação de Extraordinário Aproveitamento de Estudos
- **02 a 31/01** — Inclusão de Disciplinas de Adaptação/Dependência de Verão

### 📆 Semestre 2026/2 (Agosto – Dezembro):
- **01 a 08/07** — Rematrícula Automática para o semestre 2026/2
- **01 a 31/07** — Inclusão de Disciplina de Adaptação/Dependência para 2026/2
- **08/07** — Início das atividades de Adaptação/Dependência de Inverno
- **08/07** — Último dia para lançamento de resultados pelos professores

---

⚠️ Consulte o Calendário completo no **Portal Multivix** ou **App Multivix**.`
  },
];

// Palavras que indicam pedido de reformulação/simplificação sem especificar o tópico
const REFORMULATION_KEYWORDS = [
  'resumir', 'resumo', 'resumindo', 'simplificar', 'simplifica', 'simplificando',
  'em poucas palavras', 'não entendi', 'n entendi', 'nao entendi', 'num entendi',
  'pode explicar melhor', 'mais simples', 'mais claro', 'de forma simples',
  'pode resumir', 'consegue resumir', 'consegue simplificar', 'explica de novo',
  'não ficou claro', 'nao ficou claro', 'confuso', 'muito longo'
];

/**
 * Normaliza string removendo acentos e convertendo para lowercase.
 */
function normalize(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Verifica se a pergunta do usuário corresponde a uma resposta curada.
 * @param {string} userQuery - A pergunta do usuário
 * @param {string|null} lastAssistantContent - Conteúdo da última resposta do assistente (para detecção de contexto)
 * @returns {string|null} - A resposta curada em Markdown, ou null se não houver correspondência
 */
export function getCuratedAnswer(userQuery, lastAssistantContent = null) {
  if (!userQuery || userQuery.trim().length < 3) return null;

  const lq = normalize(userQuery);
  const lastCtx = lastAssistantContent ? normalize(lastAssistantContent) : '';

  // 1. Detectar pedido de reformulação/resumo sem keyword de tópico
  const isReformulationRequest = REFORMULATION_KEYWORDS.some(kw => lq.includes(normalize(kw)));

  if (isReformulationRequest && lastCtx) {
    // Descobrir qual tópico está no contexto da última resposta
    for (const entry of CURATED_ANSWERS) {
      const contextMatches = entry.keywords.some(kw => lastCtx.includes(normalize(kw)));
      if (contextMatches) {
        // Preferir a variante de resumo desse tópico, se existir
        const summaryVariant = CURATED_ANSWERS.find(
          e => e.contextTopicId === entry.contextTopicId && e.contextOnly === true
        );
        if (summaryVariant) return summaryVariant.answer;
        // Se não houver variante de resumo, retornar a resposta principal
        return entry.answer;
      }
    }
  }

  // 2. Match direto: keyword + padrão de pergunta
  for (const entry of CURATED_ANSWERS) {
    if (entry.contextOnly) continue; // entradas contextOnly só são ativadas via contexto

    const hasKeyword = entry.keywords.some(kw => lq.includes(normalize(kw)));
    if (!hasKeyword) continue;

    const hasPattern = entry.question_patterns.some(p => lq.includes(normalize(p)));
    const wordCount = lq.trim().split(/\s+/).length;
    const hasQuestionMark = userQuery.includes('?');

    if (hasPattern || wordCount >= 4 || hasQuestionMark) {
      return entry.answer;
    }
  }

  return null;
}
