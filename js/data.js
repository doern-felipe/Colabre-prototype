/* Colabre — Dados demonstrativos (seed) */
export const DEMO_USER_ID = 'u1';

export function seedData() {
  const users = [
    { id:'u1', name:'Usuário Demonstração', firstName:'Usuário Demonstração', email:'demo@colabre.com', password:'123456', color:'#2563EB', bio:'Professora de inglês e apaixonada por projetos comunitários. Gosto de compartilhar conhecimento e aprender com a vizinhança.', location:'Jardim Aurora', skills:['Inglês','Educação','Organização de eventos'], hoursShared:14, activitiesCompleted:9, peopleHelped:12, ratingAvg:4.9, ratingsCount:8, joinedAt:'2025-08-10', availability:'Fins de semana e quartas à tarde', level:'Participante ativo' },
    { id:'u2', name:'Carlos Mendes', firstName:'Carlos', email:'carlos@exemplo.com', password:'123456', color:'#F59E0B', bio:'Técnico em manutenção e eletricidade. Ajudo com pequenos reparos e ensino básico de ferramentas.', location:'Centro', skills:['Manutenção','Eletricidade','Reparos domésticos'], hoursShared:22, activitiesCompleted:14, peopleHelped:16, ratingAvg:4.8, ratingsCount:11, joinedAt:'2025-06-02', availability:'Segundas e sextas', level:'Colaborador' },
    { id:'u3', name:'Juliana Costa', firstName:'Juliana', email:'juliana@exemplo.com', password:'123456', color:'#10B981', bio:'Estudante de matemática. Dou aulas de reforço e ajudo com tarefas escolares.', location:'Vila Esperança', skills:['Matemática','Reforço escolar','Ensino'], hoursShared:10, activitiesCompleted:7, peopleHelped:9, ratingAvg:5.0, ratingsCount:6, joinedAt:'2025-09-14', availability:'Terças e quintas à noite', level:'Colaborador' },
    { id:'u4', name:'Roberto Almeida', firstName:'Roberto', email:'roberto@exemplo.com', password:'123456', color:'#0EA5E9', bio:'Ex-professor de informática. Ajudo idosos e iniciantes com computadores e celulares.', location:'Jardim Aurora', skills:['Informática','Tecnologia','Celulares'], hoursShared:18, activitiesCompleted:12, peopleHelped:15, ratingAvg:4.9, ratingsCount:9, joinedAt:'2025-04-20', availability:'Manhãs de sábado', level:'Referência comunitária' },
    { id:'u5', name:'Fernanda Lima', firstName:'Fernanda', email:'fernanda@exemplo.com', password:'123456', color:'#8B5CF6', bio:'Artesã e designer. Ensino técnicas de pintura, artesanato e organização de espaços.', location:'Bela Vista', skills:['Artesanato','Design','Pintura'], hoursShared:8, activitiesCompleted:5, peopleHelped:7, ratingAvg:4.7, ratingsCount:4, joinedAt:'2025-10-01', availability:'Sábados à tarde', level:'Colaborador' },
    { id:'u6', name:'Paulo Henrique', firstName:'Paulo', email:'paulo@exemplo.com', password:'123456', color:'#2563EB', bio:'Jardineiro e cuidador de hortas. Participo de mutirões de limpeza e plantio.', location:'Morada Verde', skills:['Jardinagem','Horta','Limpeza'], hoursShared:16, activitiesCompleted:10, peopleHelped:11, ratingAvg:4.8, ratingsCount:7, joinedAt:'2025-07-08', availability:'Fins de semana', level:'Participante ativo' },
    { id:'u7', name:'Camila Duarte', firstName:'Camila', email:'camila@exemplo.com', password:'123456', color:'#10B981', bio:'Educadora física e instrutora de yoga. Promovo atividades de bem-estar e alongamento.', location:'Centro', skills:['Yoga','Atividade física','Bem-estar'], hoursShared:9, activitiesCompleted:6, peopleHelped:8, ratingAvg:4.9, ratingsCount:5, joinedAt:'2025-11-03', availability:'Segundas e quartas de manhã', level:'Colaborador' },
    { id:'u8', name:'Eduardo Rocha', firstName:'Eduardo', email:'eduardo@exemplo.com', password:'123456', color:'#8B5CF6', bio:'Desenvolvedor front-end. Ajudo com configuração de computadores e redes sociais.', location:'Vila Esperança', skills:['Programação','Redes sociais','Configuração'], hoursShared:11, activitiesCompleted:8, peopleHelped:10, ratingAvg:4.6, ratingsCount:6, joinedAt:'2025-05-17', availability:'Quartas à noite', level:'Colaborador' },
    { id:'u9', name:'Visitante', firstName:'Visitante', email:'visitante@colabre.com', password:'', color:'#94A3B8', bio:'Visitante da plataforma. Não pode oferecer ou solicitar ajuda.', location:'Visitante', skills:[], hoursShared:0, activitiesCompleted:0, peopleHelped:0, ratingAvg:0, ratingsCount:0, joinedAt:new Date().toISOString().slice(0,10), availability:'-', level:'Visitante' },
  ];

  const opportunities = [
    { id:'o1', ownerId:'u1', type:'offer', title:'Aula de inglês para iniciantes', description:'Posso ajudar pessoas que desejam começar a aprender inglês, com conversação básica e vocabulário do dia a dia. Turma pequena, clima acolhedor e sem pressão.', category:'Idiomas', modality:'online', durationHours:1, location:'Online', availability:'Sábados às 10h', publishedAt:'2026-11-01', status:'published' },
    { id:'o2', ownerId:'u2', type:'offer', title:'Pequenos reparos domésticos', description:'Ofereço ajuda com pequenos reparos: troca de lâmpadas, consertos simples de torneira, ajustes em móveis e orientação sobre ferramentas básicas.', category:'Serviços domésticos', modality:'presencial', durationHours:1, location:'Jardim Aurora e região', availability:'Segundas e sextas', publishedAt:'2026-10-28', status:'published' },
    { id:'o3', ownerId:'u4', type:'offer', title:'Ajuda com configuração de computador', description:'Ajudo a configurar computador, instalar programas, organizar arquivos e criar conta de e-mail. Paciência total com iniciantes e idosos.', category:'Tecnologia', modality:'presencial', durationHours:1, location:'Jardim Aurora', availability:'Sábados de manhã', publishedAt:'2026-10-25', status:'published' },
    { id:'o4', ownerId:'u3', type:'offer', title:'Orientação básica de matemática', description:'Reforço de matemática para alunos do ensino fundamental: operações, frações, problemas e preparação para provas.', category:'Educação', modality:'online', durationHours:2, location:'Online', availability:'Terças e quintas à noite', publishedAt:'2026-11-03', status:'published' },
    { id:'o5', ownerId:'u5', type:'offer', title:'Oficina de pintura e artesanato', description:'Ensino técnicas iniciais de pintura em tela e artesanato com materiais recicláveis. Material básico por conta do aluno.', category:'Artes e criatividade', modality:'presencial', durationHours:1.5, location:'Bela Vista', availability:'Sábados às 14h', publishedAt:'2026-10-30', status:'published' },
    { id:'o6', ownerId:'u7', type:'offer', title:'Aula de yoga para iniciantes', description:'Aula leve de alongamento e respiração para pessoas de todas as idades. Traga tapete ou toalha grande.', category:'Saúde e bem-estar', modality:'presencial', durationHours:1, location:'Praça Central', availability:'Segundas às 8h', publishedAt:'2026-11-02', status:'published' },
    { id:'o7', ownerId:'u8', type:'offer', title:'Ajuda com redes sociais e celular', description:'Ajudo a criar perfis, configurar WhatsApp, usar aplicativos de banco e redes sociais com segurança.', category:'Tecnologia', modality:'online', durationHours:1, location:'Online', availability:'Quartas à noite', publishedAt:'2026-10-22', status:'published' },
    { id:'o8', ownerId:'u6', type:'offer', title:'Apoio em horta e jardinagem', description:'Ajudo com plantio, poda, compostagem e cuidados com hortas domésticas e espaços verdes.', category:'Apoio comunitário', modality:'presencial', durationHours:2, location:'Morada Verde', availability:'Fins de semana', publishedAt:'2026-10-20', status:'published' },
    { id:'o9', ownerId:'u1', type:'request', title:'Preciso de ajuda com informática', description:'Estou aprendendo a utilizar computadores e gostaria de ajuda com tarefas básicas: e-mail, pastas e chamadas de vídeo.', category:'Tecnologia', modality:'presencial', durationHours:1, location:'Jardim Aurora', availability:'Quartas à tarde', publishedAt:'2026-10-18', status:'published' },
    { id:'o10', ownerId:'u3', type:'request', title:'Busco aula de violão básica', description:'Quero aprender violão do zero: postura, primeiros acordes e leitura de cifras. Tenho o instrumento em casa.', category:'Artes e criatividade', modality:'presencial', durationHours:1, location:'Vila Esperança', availability:'Fins de semana', publishedAt:'2026-10-26', status:'published' },
    { id:'o11', ownerId:'u2', type:'request', title:'Preciso de orientação para entrevista de emprego', description:'Estou me preparando para entrevistas e gostaria de simular perguntas, revisar currículo e praticar comunicação.', category:'Educação', modality:'online', durationHours:1, location:'Online', availability:'A combinar', publishedAt:'2026-11-04', status:'published' },
    { id:'o12', ownerId:'u6', type:'request', title:'Preciso de ajuda com pintura de muro', description:'Quero pintar um muro de fundo do quintal e preciso de ajuda com preparação da superfície e aplicação de tinta.', category:'Serviços domésticos', modality:'presencial', durationHours:3, location:'Morada Verde', availability:'Um sábado por mês', publishedAt:'2026-10-29', status:'published' },
  ];

  const projects = [
    { id:'p1', ownerId:'u6', title:'Nossa Praça, Nosso Espaço', description:'Revitalizar a praça do bairro com limpeza, pintura, plantio e recuperação dos espaços de convivência para as famílias.', objective:'Devolver à comunidade um espaço bonito, seguro e acolhedor para encontro, brincadeira e descanso.', category:'Infraestrutura comunitária', location:'Jardim Aurora', startDate:'2026-11-15', createdAt:'2026-10-10', goalHours:100, contributedHours:42, expectedParticipants:25, skillsNeeded:['Jardinagem','Pintura','Organização','Divulgação'], needs:[{title:'Jardinagem e plantio',hours:30},{title:'Pintura dos bancos',hours:20},{title:'Organização e logística',hours:15},{title:'Divulgação e convite',hours:10}], participants:['u1','u6','u2','u4','u7'], status:'Ativo', visibility:'aberto', updates:[{date:'2026-10-12',text:'Projeto criado e aberto à comunidade.'},{date:'2026-10-20',text:'Primeiros participantes confirmados — já somos 5 pessoas.'},{date:'2026-10-28',text:'Mutirão de limpeza realizado: 12 horas contribuídas.'}] },
    { id:'p2', ownerId:'u4', title:'Conexão Digital', description:'Ensinar informática básica para idosos e pessoas com pouca familiaridade com tecnologia, de forma paciente e prática.', objective:'Acolher e capacitar moradores para usar celular, internet e serviços digitais com autonomia e confiança.', category:'Tecnologia', location:'Centro', startDate:'2026-11-10', createdAt:'2026-09-28', goalHours:60, contributedHours:28, expectedParticipants:15, skillsNeeded:['Informática','Paciência','Celulares','Ensino'], needs:[{title:'Aulas de celular básico',hours:25},{title:'Apoio em serviços digitais',hours:15},{title:'Organização das turmas',hours:10}], participants:['u1','u4','u8'], status:'Ativo', visibility:'aberto', updates:[{date:'2026-09-30',text:'Turma piloto confirmada com 6 alunos.'},{date:'2026-10-15',text:'Primeira aula realizada: 8 horas contribuídas.'}] },
    { id:'p3', ownerId:'u5', title:'Horta para Todos', description:'Criar uma horta comunitária para incentivar alimentação saudável, educação ambiental e colaboração entre moradores.', objective:'Produzir alimentos frescos para famílias do bairro e criar um espaço de aprendizagem sobre natureza e sustentabilidade.', category:'Meio ambiente', location:'Morada Verde', startDate:'2026-12-01', createdAt:'2026-10-05', goalHours:80, contributedHours:19, expectedParticipants:20, skillsNeeded:['Horta','Compostagem','Organização','Divulgação'], needs:[{title:'Preparo do canteiro',hours:30},{title:'Plantio e manutenção',hours:35},{title:'Educação ambiental',hours:15}], participants:['u6','u5','u1'], status:'Ativo', visibility:'aberto', updates:[{date:'2026-10-08',text:'Terreno cedido pela associação de moradores.'},{date:'2026-10-22',text:'Compostagem iniciada com doações da feira.'}] },
    { id:'p4', ownerId:'u7', title:'Aulas e Bem-estar na Praça', description:'Rodas gratuitas de yoga, alongamento e conversa sobre saúde para todas as idades, aos finais de semana.', objective:'Promover saúde, movimento e convivência intergeracional em espaço público e acolhedor.', category:'Saúde e bem-estar', location:'Praça Central', startDate:'2026-11-08', createdAt:'2026-10-19', goalHours:40, contributedHours:16, expectedParticipants:12, skillsNeeded:['Yoga','Facilitação','Divulgação'], needs:[{title:'Facilitação das rodas',hours:20},{title:'Divulgação e acolhimento',hours:10}], participants:['u7','u3'], status:'Ativo', visibility:'local', updates:[{date:'2026-10-20',text:'Primeira roda com 9 participantes.'}] },
  ];

  const transactions = [
    { id:'t10', userId:'u1', amount:0.5, description:'Orientação de matemática', date:'2026-10-10', balanceAfter:3.5 },
    { id:'t9', userId:'u1', amount:-1, description:'Ajuda com informática recebida', date:'2026-10-12', balanceAfter:2.5 },
    { id:'t8', userId:'u1', amount:2, description:'Aula de inglês realizada', date:'2026-10-15', balanceAfter:4.5 },
    { id:'t7', userId:'u1', amount:1, description:'Participação em mutirão de limpeza', date:'2026-10-20', balanceAfter:5.5 },
    { id:'t6', userId:'u1', amount:-0.5, description:'Reforço de matemática recebido', date:'2026-10-22', balanceAfter:5.0 },
    { id:'t5', userId:'u1', amount:1.5, description:'Oficina de pintura ministrada', date:'2026-10-26', balanceAfter:6.5 },
    { id:'t4', userId:'u1', amount:-1, description:'Pequenos reparos recebidos', date:'2026-10-28', balanceAfter:5.5 },
    { id:'t3', userId:'u1', amount:1, description:'Aula de inglês realizada', date:'2026-11-01', balanceAfter:6.5 },
    { id:'t2', userId:'u1', amount:-1, description:'Ajuda com redes sociais recebida', date:'2026-11-03', balanceAfter:5.5 },
    { id:'t1', userId:'u1', amount:0, description:'Saldo inicial de bem-vinda', date:'2026-08-10', balanceAfter:5.5 },
  ];

  const notifications = [
    { id:'n8', userId:'u1', title:'Interesse em sua oferta', message:'Carlos Mendes demonstrou interesse em "Aula de inglês para iniciantes".', date:'2026-11-05', read:false, link:{view:'atividades'} },
    { id:'n7', userId:'u1', title:'Créditos recebidos', message:'Você recebeu 1 crédito pela aula de inglês realizada.', date:'2026-11-02', read:false, link:{view:'carteira'} },
    { id:'n6', userId:'u1', title:'Projeto precisa de voluntários', message:'"Nossa Praça, Nosso Espaço" precisa de ajuda com jardinagem.', date:'2026-11-01', read:false, link:{view:'projeto', id:'p1'} },
    { id:'n5', userId:'u1', title:'Sua solicitação foi aceita', message:'Roberto Almeida aceitou ajudar com "Preciso de ajuda com informática".', date:'2026-10-30', read:true, link:{view:'atividades'} },
    { id:'n4', userId:'u1', title:'Atividade confirmada', message:'Sua participação na oficina comunitária foi confirmada.', date:'2026-10-26', read:true, link:{view:'carteira'} },
    { id:'n3', userId:'u1', title:'Aguardando sua confirmação', message:'Confirme as horas da atividade "Aula de inglês para iniciantes".', date:'2026-10-24', read:true, link:{view:'atividades'} },
    { id:'n2', userId:'u1', title:'Novo projeto na sua região', message:'"Conexão Digital" busca voluntários no Centro.', date:'2026-10-15', read:true, link:{view:'projeto', id:'p2'} },
    { id:'n1', userId:'u1', title:'Bem-vinda ao Colabre', message:'Que bom ter você por aqui. Compartilhe seu tempo e faça parte da comunidade.', date:'2026-08-10', read:true, link:{view:'dashboard'} },
  ];

  const activities = [
    { id:'a1', oppId:'o1', ownerId:'u1', interestedId:'u2', status:'interesse', plannedHours:1, confirmedHours:0, ownerConfirmed:false, interestedConfirmed:false, credited:false, createdAt:'2026-11-05', note:'Carlos quer começar inglês do zero.', securityCode:'', codeUsed:false, ratedBy:{}, chatOpened:false },
    { id:'a2', oppId:'o3', ownerId:'u4', interestedId:'u1', status:'confirmada', plannedHours:1, confirmedHours:0, ownerConfirmed:false, interestedConfirmed:false, credited:false, createdAt:'2026-11-02', note:'Ajuda com computador na casa de Marina.', securityCode:'', codeUsed:false, ratedBy:{}, chatOpened:false },
    { id:'a3', oppId:'o1', ownerId:'u1', interestedId:'u3', status:'concluida', plannedHours:1, confirmedHours:1, ownerConfirmed:true, interestedConfirmed:true, credited:true, createdAt:'2026-10-28', note:'Aula de inglês realizada.', securityCode:'', codeUsed:false, ratedBy:{}, chatOpened:false },
  ];

  const chats = [
    { id:'c1', activityId:'a1', messages:[
      { id:'m1', senderId:'u2', text:'Olá! Vi sua oferta de inglês. Quando você tem disponibilidade?', date:'2026-11-05T09:00:00' },
      { id:'m2', senderId:'u1', text:'Oi Carlos! Tenho disponibilidade aos sábados às 10h. Te atende?', date:'2026-11-05T09:15:00' },
      { id:'m3', senderId:'u2', text:'Perfeito! Sábado às 10h funciona para mim. Posso usar o código de segurança quando finalizar?', date:'2026-11-05T09:20:00' },
      { id:'m4', senderId:'u1', text:'Sim, claro! Vou gerar o código quando aceitar seu interesse.', date:'2026-11-05T09:25:00' },
    ]},
    { id:'c2', activityId:'a2', messages:[
      { id:'m5', senderId:'u1', text:'Oi Roberto! Preciso de ajuda com configuração de computador.', date:'2026-11-02T14:00:00' },
      { id:'m6', senderId:'u4', text:'Olá Marina! Posso ajudar. Você tem o computador em casa ou precisa vir aqui?', date:'2026-11-02T14:10:00' },
      { id:'m7', senderId:'u1', text:'Pode ser na minha casa, Jardim Aurora. Sábado de manhã funciona?', date:'2026-11-02T14:15:00' },
      { id:'m8', senderId:'u4', text:'Funciona. Vou aceitar sua solicitação e geramos o código de segurança.', date:'2026-11-02T14:20:00' },
    ]},
    { id:'c3', activityId:'a3', messages:[
      { id:'m9', senderId:'u3', text:'Oi Marina! Gostaria de fazer a aula de inglês.', date:'2026-10-28T10:00:00' },
      { id:'m10', senderId:'u1', text:'Olá Juliana! Legal, marquei para sábado. Até lá!', date:'2026-10-28T10:05:00' },
    ]},
  ];

  const securityCodes = [
    { id:'sc1', activityId:'a1', code:'7421', used:false, createdAt:'2026-11-05T10:00:00' },
    { id:'sc2', activityId:'a2', code:'3891', used:false, createdAt:'2026-11-02T15:00:00' },
  ];

  const ratings = [
    { id:'r1', activityId:'a3', fromId:'u1', toId:'u3', stars:5, comment:'Ótima aluna, muito dedicada!', date:'2026-10-28' },
    { id:'r2', activityId:'a3', fromId:'u3', toId:'u1', stars:5, comment:'Excelente professora, muito paciente.', date:'2026-10-28' },
  ];

  return { users, opportunities, projects, transactions, notifications, activities, chats, securityCodes, ratings, currentUserId:null };
}
