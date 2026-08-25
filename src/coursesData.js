/**
 * Catálogo completo de Cursos Multivix
 * Categorizados por Modalidade: Presencial, EAD e Semipresencial
 */
export const COURSES_DATA = {
  Presencial: [
    'Administração',
    'Arquitetura e Urbanismo',
    'Biomedicina',
    'Ciência da Computação',
    'Ciências Biológicas (Bacharelado)',
    'Ciências Biológicas (Licenciatura)',
    'Ciências Contábeis',
    'Comunicação Social – Publicidade e Propaganda',
    'Direito',
    'Educação Física',
    'Enfermagem',
    'Engenharia Ambiental',
    'Engenharia Civil',
    'Engenharia da Computação',
    'Engenharia de Controle e Automação',
    'Engenharia de Petróleo',
    'Engenharia de Produção',
    'Engenharia Elétrica',
    'Engenharia Mecânica',
    'Engenharia Química',
    'Farmácia',
    'Fisioterapia',
    'Medicina',
    'Medicina Veterinária',
    'Nutrição',
    'Odontologia',
    'Pedagogia',
    'Psicologia',
    'Relações Internacionais',
    'Sistemas de Informação',
    'Sistemas para Internet – Inteligência Artificial'
  ],
  EAD: [
    'Administração',
    'Análise e Desenvolvimento de Sistemas',
    'Ciência da Computação',
    'Ciências Contábeis',
    'Ciências Econômicas',
    'Comunicação Social – Publicidade e Propaganda e Mídias Digitais',
    'Design de Interiores',
    'Gestão da Produção',
    'Gestão de Agronegócios',
    'Gestão de Recursos Humanos',
    'Gestão de Tecnologia da Informação',
    'Gestão de Vendas',
    'Gestão Portuária',
    'Gestão Pública',
    'Logística',
    'Marketing',
    'Marketing Digital',
    'Processos Gerenciais',
    'Relações Internacionais',
    'Sistemas de Informação',
    'Teologia'
  ],
  Semipresencial: [
    'Agronomia',
    'Biomedicina',
    'Ciências Biológicas (Licenciatura)',
    'Educação Física',
    'Engenharia Ambiental',
    'Engenharia Civil',
    'Engenharia da Computação',
    'Engenharia de Produção',
    'Engenharia Elétrica',
    'Engenharia Mecânica',
    'Farmácia',
    'Fisioterapia',
    'História',
    'Letras',
    'Nutrição',
    'Pedagogia',
    'Serviço Social'
  ]
};

export function generateCourseSystemPrompt(userName, type, course) {
  return `Você auxilia o estudante em matérias do curso de ${course || 'Sistemas de Informação'} (${type || 'Presencial'}), tirando dúvidas de conteúdos acadêmicos, resoluções de problemas e dando suporte a estudos em geral. Responda sempre em português de forma clara, didática e motivadora.`;
}
