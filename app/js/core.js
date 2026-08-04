// ============ CORE: estado global, persistência, sessão/login, shell de navegação ============
// ============ ESTADO E PERSISTÊNCIA ============
const MESES = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
let currentUser = null;
let usuariosCache = []; // usuários (profiles) da empresa logada — populado por carregarUsuarios()
let fornecedoresCache = []; // fornecedores da empresa logada — populado por carregarFornecedores()
let formulariosCache = []; // formulários da empresa logada — populado por carregarFormularios()
let associacoesCache = []; // associações (usuário x formulário x fornecedor) — populado por carregarAssociacoes()
let avaliacoesCache = []; // avaliações enviadas — populado por carregarAvaliacoes()
let documentosCache = []; // documentos de fornecedores — populado por carregarDocumentos()
let criteriosProdutoCache = []; // critérios de avaliação de produto — populado por carregarCriteriosProduto()
let avaliacoesProdutoCache = []; // lançamentos de nota fiscal (produto) — populado por carregarAvaliacoesProduto()
let criteriosConferenciaCache = []; // critérios do módulo Conferência — populado por carregarCriteriosConferencia()
let conferenciasCache = []; // lançamentos de conferência (NF + fornecedor) — populado por carregarConferencias()
let logsCache = []; // log de auditoria — populado por carregarLogs() (antes ficava só no localStorage)
const MATRIZ_PADRAO = { cert: 10, aprov: 8, parcial: 6, usarCert: true, usarAprov: true, usarParcial: true };

let empresaConfigCache = {
  campos_fornecedor_custom: [],
  colunas_fornecedor_visiveis: ['tipo', 'criticidade', 'email', 'cnpj', 'telefone', 'documentos'],
  tipos_documento: ['Alvará de Funcionamento', 'Alvará Sanitário', 'CRT', 'Contrato', 'Certidão Negativa de Débitos', 'AVCB'],
  faixas_conceito_produto: [
    { nome: 'Ruim', de: 0, ate: 4, cor: '#ef4444', contaOcorrencia: true },
    { nome: 'Intermediário', de: 4, ate: 6, cor: '#f59e0b', contaOcorrencia: false },
    { nome: 'Regular', de: 6, ate: 7, cor: '#eab308', contaOcorrencia: false },
    { nome: 'Bom', de: 7, ate: 9, cor: '#22c55e', contaOcorrencia: false },
    { nome: 'Ótimo', de: 9, ate: 10, cor: '#06b6d4', contaOcorrencia: false },
  ],
  desconto_ocorrencia_ativo: false,
  valor_desconto_ocorrencia: 0.5,
  desconto_doc_vencido_ativo: false,
  valor_desconto_doc_vencido: 1,
  conferencia_cabecalho: [],
  anos_retencao_avaliacao: null,
  config: {},
};

function initDB() {
  // ap_usuarios NÃO é mais seedado aqui — usuários agora são reais,
  // vêm da tabela "profiles" do Supabase (ver usuariosCache abaixo).
  // ap_formularios NÃO é mais seedado aqui — vêm do Supabase (ver formulariosCache).
  // ap_fornecedores, ap_campos_fornecedor_custom e ap_fornecedor_colunas_visiveis
  // NÃO são mais seedados aqui — vêm do Supabase (ver fornecedoresCache/empresaConfigCache).
  // ap_associacoes NÃO é mais seedado aqui — vêm do Supabase (ver associacoesCache).
  // ap_matriz, ap_empresa e ap_textos NÃO são mais seedados aqui — vêm do
  // Supabase (empresas.config), ver empresaConfigCache.
  // ap_logs NÃO é mais seedado aqui — vêm do Supabase (ver logsCache), pra
  // ser um log de auditoria de verdade, compartilhado entre admins.
  if (!localStorage.getItem('ap_campos_globais')) save('ap_campos_globais', [
    { chave: 'codigo', label: 'Código', valor: 'ANX.GER.076' },
    { chave: 'revisao', label: 'Revisão', valor: '12' },
  ]);

  // ap_tipos_documento NÃO é mais seedado aqui — vem do Supabase (empresas.tipos_documento).
  // ap_layout e os fundos de documento NÃO são mais seedados aqui — vêm do
  // Supabase (empresas.config.layout / .fundoCertificado / .fundoCarta).
}

function load(key) { return JSON.parse(localStorage.getItem(key) || 'null'); }
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

// Migração: empresas que já usavam o sistema tinham texto customizado salvo
// nas chaves antigas 'parcial'/'reprov' (únicas, sem separar Produto/Serviço).
// Copia esse texto pros dois campos novos (fica igual nos dois no início — o
// admin edita depois se quiser diferenciar), sem apagar o que já foi escrito.
function migrarTextos(raw) {
  const t = { ...getDefaultTextos(), ...(raw || {}) };
  if (raw) {
    if (raw.parcial && !raw['parcial-prod']) t['parcial-prod'] = raw.parcial;
    if (raw.parcial && !raw['parcial-serv']) t['parcial-serv'] = raw.parcial;
    if (raw.reprov && !raw['reprov-prod']) t['reprov-prod'] = raw.reprov;
    if (raw.reprov && !raw['reprov-serv']) t['reprov-serv'] = raw.reprov;
  }
  return t;
}

function db() {
  return {
    usuarios: usuariosCache, // real, vindo do Supabase (profiles) — ver carregarUsuarios()
    formularios: formulariosCache,
    fornecedores: fornecedoresCache,
    associacoes: associacoesCache,
    matriz: empresaConfigCache.config.matriz || MATRIZ_PADRAO,
    avaliacoes: avaliacoesCache,
    logs: logsCache,
    empresa: empresaConfigCache.config.empresa || {},
    textos: migrarTextos(empresaConfigCache.config.textos),
    camposGlobais: load('ap_campos_globais') || [],
    camposFornecedorCustom: empresaConfigCache.campos_fornecedor_custom,
    colunasFornecedorVisiveis: empresaConfigCache.colunas_fornecedor_visiveis,
    tiposDocumento: empresaConfigCache.tipos_documento,
    documentos: documentosCache,
    criteriosProduto: criteriosProdutoCache,
    avaliacoesProduto: avaliacoesProdutoCache,
    faixasConceitoProduto: empresaConfigCache.faixas_conceito_produto,
    descontoOcorrenciaAtivo: empresaConfigCache.desconto_ocorrencia_ativo,
    valorDescontoOcorrencia: empresaConfigCache.valor_desconto_ocorrencia,
    anosRetencaoAvaliacao: empresaConfigCache.anos_retencao_avaliacao,
    statusEmpresa: empresaConfigCache.status,
    plano: empresaConfigCache.plano,
    trialTerminaEm: empresaConfigCache.trial_termina_em,
    limiteFornecedores: empresaConfigCache.limite_fornecedores, // null = ilimitado
    limiteAdmins: empresaConfigCache.limite_admins, // null = ilimitado
    nomeEmpresa: empresaConfigCache.nome || '',
    unidades: unidadesCache,
    unidadesDocumentos: unidadesDocumentosCache,
    documentosVersoes: documentosVersoesCache,
    documentosPendentesAprovacao: documentosPendentesAprovacaoCache,
    cobrancaAutomaticaAtiva: empresaConfigCache.cobranca_automatica_ativa,
    cobrancaAutomaticaFrequencia: empresaConfigCache.cobranca_automatica_frequencia,
    toleranciaDocumentosMeses: empresaConfigCache.tolerancia_documentos_meses ?? 6,
    lembreteAvaliadorAtivo: empresaConfigCache.lembrete_avaliador_ativo,
    lembreteAvaliadorFrequencia: empresaConfigCache.lembrete_avaliador_frequencia,
    notificarAtividadeAtivo: empresaConfigCache.notificar_atividade_ativo,
    criteriosConferencia: criteriosConferenciaCache,
    conferencias: conferenciasCache,
    descontoDocVencidoAtivo: empresaConfigCache.desconto_doc_vencido_ativo,
    valorDescontoDocVencido: empresaConfigCache.valor_desconto_doc_vencido ?? 1,
    conferenciaCabecalho: empresaConfigCache.conferencia_cabecalho || [],
  };
}

// Continua podendo ser chamada sem "await" em todo o resto do código (é o
// padrão já usado em todo lugar) — atualiza a lista na tela na hora
// (otimista) e grava no banco em segundo plano, sem travar a ação do
// usuário. Se a gravação falhar, só fica de fora do histórico — não temos
// como travar o resto do fluxo por causa disso.
function addLog(acao, detalhe) {
  // Prioriza o nome do responsável (pessoa) sobre o setor/login — mas cai pro
  // nome/setor se o responsável não estiver preenchido (ex: contas antigas).
  // O e-mail continua aparecendo dentro do "detalhe" na maioria das ações.
  const usuario = currentUser ? (currentUser.responsavel ? `${currentUser.responsavel} — ${currentUser.nome}` : currentUser.nome) : 'sistema';
  const timestamp = new Date().toISOString();
  logsCache.unshift({ id: 'log' + Date.now() + Math.random().toString(36).slice(2, 6), usuario, acao, detalhe, timestamp });

  if (!currentUser || !currentUser.empresaId) return;
  supabaseClient.from('logs').insert({
    empresa_id: currentUser.empresaId, usuario, acao, detalhe,
  }).then(({ error }) => { if (error) console.error('Erro ao gravar log de auditoria:', error.message); });
}

// Busca os últimos logs da empresa no banco — compartilhado entre todos os
// admins, não é mais por navegador/aparelho.
async function carregarLogs() {
  const { data, error } = await supabaseClient
    .from('logs')
    .select('id, usuario, acao, detalhe, criado_em')
    .eq('empresa_id', currentUser.empresaId)
    .order('criado_em', { ascending: false })
    .limit(200);

  if (error) { console.error('Erro ao carregar logs:', error.message); logsCache = []; return; }
  logsCache = (data || []).map(l => ({ id: l.id, usuario: l.usuario, acao: l.acao, detalhe: l.detalhe, timestamp: l.criado_em }));
}

function toast(msg, dur = 2800) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => t.style.display = 'none', dur);
}

function fmtData(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
}

// Pra colunas do tipo "date" (sem hora, ex: "2026-07-05") — evita o bug
// clássico de new Date('YYYY-MM-DD') mostrar o dia anterior em fusos negativos.
// Transforma uma data ISO em "há X dias/meses/anos" — usado no tempo de cadastro.
function tempoDesde(iso) {
  const dias = Math.floor((new Date() - new Date(iso)) / (1000 * 60 * 60 * 24));
  if (dias < 1) return 'cadastrado hoje';
  if (dias < 30) return `há ${dias} dia${dias > 1 ? 's' : ''}`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return `há ${meses} ${meses > 1 ? 'meses' : 'mês'}`;
  const anos = Math.floor(meses / 12);
  return `há ${anos} ano${anos > 1 ? 's' : ''}`;
}

function fmtDataSimples(dataStr) {
  if (!dataStr) return '—';
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

// Remove acento e troca qualquer caractere fora de a-z/0-9/./-/_ por "_" —
// o Storage do Supabase rejeita a chave do arquivo se tiver acento/espaço/etc.
function sanitizarNomeArquivo(nome) {
  return nome
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
}

// ============ LOGIN ============
async function doLogin() {
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const senha = document.getElementById('login-senha').value;
  const errBox = document.getElementById('login-error');
  errBox.style.display = 'none';

  const { error: erroLogin } = await supabaseClient.auth.signInWithPassword({ email, password: senha });
  if (erroLogin) {
    errBox.textContent = 'E-mail ou senha inválidos.';
    errBox.style.display = 'block';
    return;
  }

  const ok = await carregarPerfilELogar();
  if (!ok) {
    errBox.textContent = 'Login ok, mas não encontramos seu perfil (ou está inativo). Fale com o administrador.';
    errBox.style.display = 'block';
    await supabaseClient.auth.signOut();
  }
}

function mostrarCadastroEmpresa() {
  document.getElementById('login-form-wrap').style.display = 'none';
  document.getElementById('signup-form-wrap').style.display = 'block';
  document.getElementById('login-error').style.display = 'none';
  document.getElementById('auth-shell').classList.add('signup-mode');
}

function mostrarLogin() {
  document.getElementById('signup-form-wrap').style.display = 'none';
  document.getElementById('forgot-form-wrap').style.display = 'none';
  document.getElementById('reset-form-wrap').style.display = 'none';
  document.getElementById('login-form-wrap').style.display = 'block';
  document.getElementById('signup-error').style.display = 'none';
  document.getElementById('auth-shell').classList.remove('signup-mode');
}

function mostrarEsqueciSenha() {
  document.getElementById('login-form-wrap').style.display = 'none';
  document.getElementById('forgot-form-wrap').style.display = 'block';
  document.getElementById('login-error').style.display = 'none';
  document.getElementById('forgot-ok').style.display = 'none';
}

// Dispara o e-mail de redefinição pelo próprio Auth do Supabase — não
// mexemos em senha nenhuma aqui, só pedimos pra ele mandar o link.
// redirectTo aponta pra essa mesma página: quando a pessoa clicar no link,
// cai aqui de novo e o listener de PASSWORD_RECOVERY (em init.js) mostra
// o formulário de nova senha automaticamente.
async function enviarLinkRedefinicao() {
  const email = document.getElementById('forgot-email').value.trim().toLowerCase();
  const errBox = document.getElementById('forgot-error');
  const okBox = document.getElementById('forgot-ok');
  errBox.style.display = 'none';
  okBox.style.display = 'none';

  if (!email) { errBox.textContent = 'Informe seu e-mail.'; errBox.style.display = 'block'; return; }

  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname,
  });

  // Mesma mensagem em caso de sucesso ou erro "e-mail não encontrado" — não dá
  // pra confirmar/negar se um e-mail existe no sistema por segurança.
  if (error && error.status !== 400) {
    errBox.textContent = 'Não foi possível enviar o link agora. Tente novamente em instantes.';
    errBox.style.display = 'block';
    return;
  }
  okBox.textContent = 'Se esse e-mail estiver cadastrado, enviamos um link de redefinição pra ele.';
  okBox.style.display = 'block';
}

// Chamada pelo listener de PASSWORD_RECOVERY (init.js) quando a pessoa
// chega aqui pelo link do e-mail — força a tela de login a aparecer
// (mesmo que já exista uma sessão "normal" salva) e abre direto no
// formulário de nova senha, ignorando login/cadastro.
function mostrarRedefinirSenha() {
  // Tira o token de recuperação da barra de endereço assim que a tela de
  // nova senha aparece. Sem isso, se o navegador recarregar essa aba sozinho
  // depois (comum no celular, ao voltar de outro app), ele reprocessa esse
  // mesmo link do zero e mostra essa tela de novo, mesmo depois da pessoa já
  // ter trocado a senha e saído normalmente.
  window.history.replaceState({}, '', window.location.pathname);

  const boot = document.getElementById('boot-loading');
  if (boot) boot.style.display = 'none';
  document.getElementById('app').classList.remove('active');
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-form-wrap').style.display = 'none';
  document.getElementById('signup-form-wrap').style.display = 'none';
  document.getElementById('forgot-form-wrap').style.display = 'none';
  document.getElementById('reset-form-wrap').style.display = 'block';
}

async function salvarNovaSenha() {
  const senha = document.getElementById('reset-senha').value;
  const confirma = document.getElementById('reset-senha-confirma').value;
  const errBox = document.getElementById('reset-error');
  errBox.style.display = 'none';

  if (!senha || senha.length < 6) { errBox.textContent = 'A senha precisa ter pelo menos 6 caracteres.'; errBox.style.display = 'block'; return; }
  if (senha !== confirma) { errBox.textContent = 'As senhas não coincidem.'; errBox.style.display = 'block'; return; }

  const { error } = await supabaseClient.auth.updateUser({ password: senha });
  if (error) {
    errBox.textContent = 'Não foi possível salvar a nova senha. O link pode ter expirado — solicite um novo.';
    errBox.style.display = 'block';
    return;
  }

  // O Supabase mantém a marcação de "sessão de recuperação" grudada nessa
  // sessão enquanto ela durar — mesmo depois da senha já ter sido trocada.
  // Sem isso aqui, checkSession() ia continuar achando (mesmo dias depois)
  // que essa é uma recuperação de senha e forçaria essa tela de novo sempre.
  // Trocamos por uma sessão normal, de login de verdade, com a senha nova.
  const { data: { user } } = await supabaseClient.auth.getUser();
  const email = user?.email;
  await supabaseClient.auth.signOut();
  if (email) await supabaseClient.auth.signInWithPassword({ email, password: senha });

  toast('Senha redefinida com sucesso!');
  await carregarPerfilELogar();
}

// Painel de planos/ciclo do cadastro — apenas grava a escolha nos campos
// ocultos que são enviados junto no onboarding-criar-empresa.
function selecionarPlano(plano) {
  document.getElementById('signup-plano').value = plano;
  document.querySelectorAll('.plan-card').forEach(el => {
    el.classList.toggle('selected', el.dataset.plano === plano);
  });
}

// Preenche os preços dos cards de Essencial/Profissional com o valor real
// que está em planos_config (mesma tabela que o resto do sistema usa) —
// assim, quando o valor muda lá, essa tela reflete sozinha, sem precisar
// mexer em código. Se a busca falhar por qualquer motivo, mantém o valor
// que já está no HTML (que serve de fallback).
async function carregarPrecosPlanoPublico() {
  const planos = await garantirPlanosConfig();
  document.querySelectorAll('.plan-price[data-plano-preco]').forEach(el => {
    const cfg = planos[el.dataset.planoPreco];
    if (!cfg || cfg.preco == null) return;
    el.innerHTML = `R$ ${Number(cfg.preco).toFixed(2).replace('.', ',')}<span>/mês</span>`;
  });
}

async function doSignupEmpresa() {
  const nomeEmpresa = document.getElementById('signup-empresa').value.trim();
  const nomeAdmin = document.getElementById('signup-nome').value.trim();
  const email = document.getElementById('signup-email').value.trim().toLowerCase();
  const senha = document.getElementById('signup-senha').value;
  const plano = document.getElementById('signup-plano').value;
  const cicloFaturamento = document.getElementById('signup-ciclo').value;
  const errBox = document.getElementById('signup-error');
  const btn = document.getElementById('signup-btn');

  if (!nomeEmpresa || !nomeAdmin || !email || senha.length < 6) {
    errBox.textContent = 'Preencha todos os campos. Senha mínima de 6 caracteres.';
    errBox.style.display = 'block';
    return;
  }

  errBox.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Criando sua conta...';

  // plano/cicloFaturamento viajam junto para a function — se a function ainda
  // não usa esses campos, é só ler e gravar em empresas (ela ignora o que não usa).
  const { data, error } = await supabaseClient.functions.invoke('onboarding-criar-empresa', {
    body: { nomeEmpresa, nomeAdmin, email, senha, plano, cicloFaturamento },
  });

  btn.disabled = false;
  btn.textContent = 'Criar minha conta — 7 dias grátis';

  if (error || (data && data.ok === false)) {
    let mensagem = (data && data.error) || error?.message || 'Erro ao criar sua conta.';
    // Quando a Edge Function responde com status != 2xx, o supabase-js não
    // preenche "data" — a mensagem real fica dentro de error.context (a
    // Response bruta), então precisamos ler o corpo dela manualmente.
    if (error && error.context && typeof error.context.json === 'function') {
      try {
        const corpo = await error.context.json();
        if (corpo && corpo.error) mensagem = corpo.error;
      } catch { /* corpo não era JSON — mantém a mensagem genérica */ }
    }
    errBox.textContent = mensagem;
    errBox.style.display = 'block';
    return;
  }

  // Cadastro criado — já faz login automático com a senha que a pessoa acabou de definir.
  const { error: erroLogin } = await supabaseClient.auth.signInWithPassword({ email, password: senha });
  if (erroLogin) {
    errBox.textContent = 'Conta criada! Faça login com o e-mail e senha que você definiu.';
    errBox.style.display = 'block';
    mostrarLogin();
    return;
  }

  const ok2 = await carregarPerfilELogar();
  if (!ok2) {
    errBox.textContent = 'Conta criada, mas houve um problema ao entrar. Tente fazer login manualmente.';
    errBox.style.display = 'block';
    mostrarLogin();
  }
}

// Busca o usuário autenticado no Supabase Auth, carrega o perfil dele
// (empresa, nome, papel) da tabela "profiles" e abre a tela certa.
async function carregarPerfilELogar() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return false;

  const { data: profile, error } = await supabaseClient
    .from('profiles')
    .select('id, nome, responsavel, papel, ativo, empresa_id, permissoes_modulos')
    .eq('id', user.id)
    .single();

  if (error || !profile || !profile.ativo) return false;

  // Checa o status da empresa ANTES de carregar qualquer dado operacional —
  // se o teste acabou ou o plano foi cancelado, mostra a tela de reativação
  // em vez de deixar a pessoa cair num dashboard quebrado (as regras de
  // segurança do banco bloqueiam os dados de qualquer forma, mas sem
  // explicação nenhuma pra quem está tentando entrar).
  const { data: empresaStatus } = await supabaseClient
    .from('empresas')
    .select('nome, status, trial_termina_em')
    .eq('id', profile.empresa_id)
    .single();

  const motivoBloqueio = avaliarBloqueioEmpresa(empresaStatus);
  if (motivoBloqueio) {
    mostrarBloqueioEmpresa(motivoBloqueio, profile.papel);
    return false;
  }

  currentUser = {
    id: profile.id, email: user.email, nome: profile.nome, responsavel: profile.responsavel || null, papel: profile.papel, empresaId: profile.empresa_id,
    // null = acesso total (admin_master sempre ignora essa lista; admin comum
    // sem nada configurado também cai em acesso total, por segurança).
    permissoesModulos: profile.permissoes_modulos || null,
  };
  addLog('login', `${currentUser.email} entrou no sistema`);

  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').classList.add('active');

  await carregarFormularios();
  await carregarAssociacoes();
  await carregarFornecedores();

  if (ehAdmin(currentUser.papel)) {
    await carregarUsuarios();
    await carregarEmpresaConfig();
    await carregarDocumentos();
    await carregarDocumentosVersoes();
    await carregarDocumentosPendentesAprovacao();
    await carregarCriteriosProduto();
    await seedCriteriosProdutoPadrao();
    await carregarLogs();
    await carregarAvaliacoesProduto();
    await carregarCriteriosConferencia();
    await carregarConferencias();
    await carregarUnidades();
    await carregarUnidadesDocumentos();
  }
  await carregarAvaliacoes(); // depende de usuariosCache (se admin) pra resolver o e-mail de quem enviou

  if (ehAdmin(currentUser.papel)) {
    renderAdminShell();
  } else {
    renderAvaliadorShell();
  }
  return true;
}

// Decide se o acesso da empresa está bloqueado, e por qual motivo — 'trial'
// (período de teste acabou) ou 'cancelada' (assinatura cancelada). Retorna
// null quando o acesso está liberado (empresa ativa, ou trial ainda válido).
function avaliarBloqueioEmpresa(empresa) {
  if (!empresa) return null;
  if (empresa.status === 'cancelada') return 'cancelada';
  if (empresa.status === 'expirada') return 'trial';
  if (empresa.status === 'trial' && empresa.trial_termina_em) {
    const fimTrial = new Date(empresa.trial_termina_em);
    fimTrial.setHours(23, 59, 59, 999);
    if (fimTrial < new Date()) return 'trial';
  }
  return null;
}

// Mostra a tela de reativação. Admin vê os planos pra assinar na hora;
// avaliador vê só um aviso pra falar com o administrador (quem escolhe e
// paga o plano é sempre o admin, nunca o avaliador).
function mostrarBloqueioEmpresa(motivo, papel) {
  const boot = document.getElementById('boot-loading');
  if (boot) boot.style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-form-wrap').style.display = 'none';
  document.getElementById('signup-form-wrap').style.display = 'none';
  document.getElementById('forgot-form-wrap').style.display = 'none';
  document.getElementById('reset-form-wrap').style.display = 'none';
  document.getElementById('bloqueio-form-wrap').style.display = 'block';

  const titulo = document.getElementById('bloqueio-titulo');
  const mensagem = document.getElementById('bloqueio-mensagem');
  if (motivo === 'cancelada') {
    titulo.textContent = 'Seu plano foi cancelado';
    mensagem.innerHTML = 'Sentimos sua falta!<br>Escolha um dos planos abaixo pra reativar o HomologPro e continuar de onde parou.';
  } else {
    titulo.textContent = 'Seu período de teste acabou';
    mensagem.innerHTML = 'Esperamos que tenha gostado da experiência!<br>Escolha um dos planos abaixo para continuar usando o HomologPro.';
  }

  const ehAvaliador = papel === 'avaliador';
  document.getElementById('bloqueio-plan-area').style.display = ehAvaliador ? 'none' : 'block';
  document.getElementById('bloqueio-contato-admin').style.display = ehAvaliador ? 'block' : 'none';

  carregarPrecosPlanoPublico();
}

// Chamado ao clicar num plano na tela de reativação — usa a mesma function
// de checkout que a tela de configurações de cobrança já usa pra trocar de
// plano, então o fluxo de pagamento é idêntico ao que o resto do sistema usa.
async function assinarPlanoBloqueio(plano) {
  const errBox = document.getElementById('bloqueio-error');
  errBox.style.display = 'none';
  toast('Processando...');

  let { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    errBox.textContent = 'Sua sessão expirou. Clique em Sair e faça login de novo.';
    errBox.style.display = 'block';
    return;
  }
  // Força um token fresco antes de usar — a renovação automática em segundo
  // plano pode não ter rodado se a pessoa passou um tempo fora dessa aba
  // (ex: decidindo no checkout do Stripe e depois voltando), deixando o
  // token salvo mais velho do que o servidor ainda aceita.
  const { data: refreshed } = await supabaseClient.auth.refreshSession();
  if (refreshed && refreshed.session) session = refreshed.session;

  // Chamada direta via fetch, em vez de supabaseClient.functions.invoke() —
  // nesse ponto específico (tela de bloqueio, antes do dashboard carregar),
  // o anexo automático do cabeçalho de autenticação pela biblioteca não
  // estava confiável. Fetch direto elimina essa ambiguidade.
  let data;
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/criar-checkout-sessao`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ plano }),
    });
    data = await resp.json();
  } catch (e) {
    errBox.textContent = 'Não foi possível processar agora. Tente novamente em instantes.';
    errBox.style.display = 'block';
    return;
  }

  if (!data || data.ok === false) {
    errBox.textContent = (data && data.error) || 'Não foi possível processar agora. Tente novamente em instantes.';
    errBox.style.display = 'block';
    return;
  }
  if (data.url) { window.location.href = data.url; return; }
  toast(data.mensagem || 'Plano ativado!');
  window.location.reload();
}

// admin_master (dono, fixo) e admin (criado por ele, com permissões por
// módulo) são as duas variações de "admin" — helper pra não repetir a
// checagem dos dois valores em todo lugar.
function ehAdmin(papel) {
  return papel === 'admin' || papel === 'admin_master';
}

// Um admin comum só enxerga um módulo se: (a) ele é admin_master (vê tudo),
// ou (b) não tem lista de permissões configurada (fallback = acesso total),
// ou (c) o módulo está na lista dele. "dashboard" segue a mesma regra dos
// outros módulos agora — pode ser desmarcado por admin_master pra um admin
// específico não ver.
function temAcessoModulo(modulo) {
  if (!currentUser) return false;
  if (currentUser.papel === 'admin_master') return true;
  if (currentUser.papel === 'avaliador') return false;
  if (!currentUser.permissoesModulos) return true;
  return currentUser.permissoesModulos.includes(modulo);
}

// Busca os usuários (profiles) reais da empresa logada no Supabase.
// Chamada no login do admin e sempre que a lista precisa ser atualizada
// (depois de criar ou ativar/desativar um usuário).
async function carregarUsuarios() {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, nome, responsavel, email, papel, ativo, permissoes_modulos, ultimo_lembrete_em, ultimo_lembrete_estado, ultimo_erro_lembrete, ultimo_erro_lembrete_em, recebe_notificacao_cobranca')
    .eq('empresa_id', currentUser.empresaId)
    .order('nome');

  if (error) {
    console.error('Erro ao carregar usuários:', error.message);
    usuariosCache = [];
    return;
  }
  usuariosCache = data || [];
}

// Busca os formulários reais da empresa logada no Supabase.
async function carregarFormularios() {
  const { data, error } = await supabaseClient
    .from('formularios')
    .select('*')
    .eq('empresa_id', currentUser.empresaId)
    .order('nome');

  if (error) {
    console.error('Erro ao carregar formulários:', error.message);
    formulariosCache = [];
    return;
  }
  // Traduz nomes de coluna do banco pro formato que o resto do app usa.
  formulariosCache = (data || []).map(f => ({
    id: f.id,
    nome: f.nome,
    setor: f.setor,
    tipo: f.tipo,
    criterios: f.criterios || [],
    prazoEntregaDia: f.prazo_entrega_dia,
    camposExtras: f.campos_extras || [],
  }));
}

// Busca as associações (qual usuário vê qual formulário/fornecedor) da empresa.
async function carregarAssociacoes() {
  const { data, error } = await supabaseClient
    .from('associacoes')
    .select('*')
    .eq('empresa_id', currentUser.empresaId);

  if (error) {
    console.error('Erro ao carregar associações:', error.message);
    associacoesCache = [];
    return;
  }
  associacoesCache = (data || []).map(a => ({
    id: a.id,
    usuarioId: a.usuario_id,
    formularioId: a.formulario_id,
    fornecedorId: a.fornecedor_id,
  }));
}


async function carregarFornecedores() {
  const { data, error } = await supabaseClient
    .from('fornecedores')
    .select('*')
    .eq('empresa_id', currentUser.empresaId)
    .is('excluido_em', null)
    .order('nome');

  if (error) {
    console.error('Erro ao carregar fornecedores:', error.message);
    fornecedoresCache = [];
    return;
  }
  // A coluna no banco chama "campos_custom" (nome do schema original);
  // o resto do app inteiro usa "extras" — só traduz aqui, num lugar só.
  fornecedoresCache = (data || []).map(f => ({ ...f, extras: f.campos_custom || {} }));
}

// Busca as avaliações enviadas da empresa (todo mundo vê pra relatório/dashboard;
// cada avaliador filtra as próprias na tela dele).
async function carregarAvaliacoes() {
  const { data, error } = await supabaseClient
    .from('avaliacoes')
    .select('*')
    .eq('empresa_id', currentUser.empresaId)
    .order('enviado_em', { ascending: false });

  if (error) {
    console.error('Erro ao carregar avaliações:', error.message);
    avaliacoesCache = [];
    return;
  }
  avaliacoesCache = (data || []).map(av => {
    // Prioridade pro e-mail GRAVADO no momento do envio (sobrevive à exclusão
    // do usuário); só cai pro join dinâmico em registros antigos sem esse campo.
    let emailAutor = av.enviado_por_email;
    if (!emailAutor) {
      emailAutor = av.usuario_id === currentUser.id ? currentUser.email : null;
      if (!emailAutor) {
        const u = usuariosCache.find(x => x.id === av.usuario_id);
        emailAutor = u ? u.email : '—';
      }
    }
    // Mesma lógica pro nome do responsável: prioriza o valor gravado no
    // envio; cai pro cadastro atual só em registros antigos sem esse campo.
    let nomeAutor = av.enviado_por_nome;
    if (!nomeAutor) {
      const u = usuariosCache.find(x => x.id === av.usuario_id);
      nomeAutor = u ? (u.responsavel || u.nome) : null;
    }
    return {
      id: av.id,
      formularioId: av.formulario_id,
      fornecedorId: av.fornecedor_id,
      usuarioId: av.usuario_id,
      enviadoPor: emailAutor,
      enviadoPorNome: nomeAutor,
      periodo: av.periodo,
      respostas: av.respostas || {},
      nota: av.nota_media,
      semServico: av.sem_servico,
      anexos: av.anexos || [],
      obs: av.obs || '',
      justificativa: av.justificativa || '',
      enviadoEm: av.enviado_em,
      travado: av.bloqueada,
      liberadoEdicao: av.liberado_edicao,
      notificadoEm: av.notificado_em || null,
      planoAcaoPrazo: av.plano_acao_prazo || null,
      planoAcaoAnexo: av.plano_acao_anexo || null,
      situacao: av.situacao || null,
    };
  });
}

// Situação "oficial" de uma avaliação: usa o valor SALVO no momento do
// envio (calculado com a matriz de cortes de ENTÃO), pra não mudar
// retroativamente se a empresa alterar a matriz depois. Só cai pro cálculo
// ao vivo em avaliações antigas, de antes dessa coluna existir.
function situacaoDe(av) {
  if (av.semServico) return null;
  return av.situacao || getSituacao(av.nota);
}


// e colunas visíveis na listagem).
async function carregarEmpresaConfig() {
  const { data, error } = await supabaseClient
    .from('empresas')
    .select('nome, campos_fornecedor_custom, colunas_fornecedor_visiveis, tipos_documento, faixas_conceito_produto, desconto_ocorrencia_ativo, valor_desconto_ocorrencia, anos_retencao_avaliacao, config, status, plano, trial_termina_em, limite_fornecedores, limite_admins, cobranca_automatica_ativa, cobranca_automatica_frequencia, tolerancia_documentos_meses, lembrete_avaliador_ativo, lembrete_avaliador_frequencia, notificar_atividade_ativo, valor_mensal_atual, plano_ativo_desde, proxima_cobranca_em, proximo_valor_mensal, proximo_reajuste_em, enterprise_composicao, desconto_doc_vencido_ativo, valor_desconto_doc_vencido, conferencia_cabecalho')
    .eq('id', currentUser.empresaId)
    .single();

  if (error) {
    console.error('Erro ao carregar configurações da empresa:', error.message);
    return;
  }
  empresaConfigCache = {
    nome: data.nome || '',
    campos_fornecedor_custom: data.campos_fornecedor_custom || [],
    colunas_fornecedor_visiveis: data.colunas_fornecedor_visiveis || ['tipo', 'criticidade', 'email', 'cnpj', 'telefone', 'documentos'],
    tipos_documento: data.tipos_documento || ['Alvará de Funcionamento', 'Alvará Sanitário', 'CRT', 'Contrato', 'Certidão Negativa de Débitos', 'AVCB'],
    faixas_conceito_produto: data.faixas_conceito_produto || empresaConfigCache.faixas_conceito_produto,
    desconto_ocorrencia_ativo: !!data.desconto_ocorrencia_ativo,
    valor_desconto_ocorrencia: data.valor_desconto_ocorrencia ?? 0.5,
    anos_retencao_avaliacao: data.anos_retencao_avaliacao ?? null,
    config: data.config || {},
    status: data.status || 'ativa',
    plano: data.plano || null,
    trial_termina_em: data.trial_termina_em || null,
    limite_fornecedores: data.limite_fornecedores ?? null, // null = ilimitado
    limite_admins: data.limite_admins ?? null, // null = ilimitado
    cobranca_automatica_ativa: !!data.cobranca_automatica_ativa,
    cobranca_automatica_frequencia: data.cobranca_automatica_frequencia || 'chave',
    tolerancia_documentos_meses: data.tolerancia_documentos_meses ?? 6,
    lembrete_avaliador_ativo: !!data.lembrete_avaliador_ativo,
    lembrete_avaliador_frequencia: data.lembrete_avaliador_frequencia || 'chave',
    notificar_atividade_ativo: !!data.notificar_atividade_ativo,
    valor_mensal_atual: data.valor_mensal_atual ?? null,
    plano_ativo_desde: data.plano_ativo_desde || null,
    proxima_cobranca_em: data.proxima_cobranca_em || null,
    proximo_valor_mensal: data.proximo_valor_mensal ?? null,
    proximo_reajuste_em: data.proximo_reajuste_em || null,
    enterprise_composicao: data.enterprise_composicao || null,
    desconto_doc_vencido_ativo: !!data.desconto_doc_vencido_ativo,
    valor_desconto_doc_vencido: data.valor_desconto_doc_vencido ?? 1,
    conferencia_cabecalho: data.conferencia_cabecalho || [],
  };
}

// Busca os critérios de avaliação de produto (editáveis pelo admin).
async function carregarCriteriosProduto() {
  const { data, error } = await supabaseClient
    .from('criterios_produto')
    .select('*')
    .eq('empresa_id', currentUser.empresaId)
    .order('criado_em');

  if (error) {
    console.error('Erro ao carregar critérios de produto:', error.message);
    criteriosProdutoCache = [];
    return;
  }
  criteriosProdutoCache = data || [];
}

// Busca os lançamentos de nota fiscal (avaliação de produto) da empresa.
async function carregarAvaliacoesProduto() {
  const { data, error } = await supabaseClient
    .from('avaliacoes_produto')
    .select('*')
    .eq('empresa_id', currentUser.empresaId)
    .order('data', { ascending: false });

  if (error) {
    console.error('Erro ao carregar avaliações de produto:', error.message);
    avaliacoesProdutoCache = [];
    return;
  }
  avaliacoesProdutoCache = (data || []).map(av => ({
    id: av.id,
    fornecedorId: av.fornecedor_id,
    usuarioId: av.usuario_id,
    data: av.data,
    numeroNf: av.numero_nf,
    notas: av.notas || [],
    notaGeral: av.nota_geral,
    conceito: av.conceito,
    contaOcorrencia: av.conta_ocorrencia,
    enviadoPorEmail: av.enviado_por_email,
    enviadoPorNome: av.enviado_por_nome,
    criadoEm: av.criado_em,
    descontoExtra: av.desconto_extra || 0,
    descontoExtraDetalhe: av.desconto_extra_detalhe || [],
    conferenciaId: av.conferencia_id || null,
    justificativa: av.justificativa || '',
    notificadoEm: av.notificado_em || null,
    planoAcaoPrazo: av.plano_acao_prazo || null,
    planoAcaoAnexo: av.plano_acao_anexo || null,
  }));
}

// Busca os critérios do módulo Conferência (editáveis pelo admin).
async function carregarCriteriosConferencia() {
  const { data, error } = await supabaseClient
    .from('criterios_conferencia')
    .select('*')
    .eq('empresa_id', currentUser.empresaId)
    .order('criado_em');

  if (error) {
    console.error('Erro ao carregar critérios de conferência:', error.message);
    criteriosConferenciaCache = [];
    return;
  }
  criteriosConferenciaCache = data || [];
}

// Busca os lançamentos de conferência (NF + fornecedor) da empresa.
async function carregarConferencias() {
  const { data, error } = await supabaseClient
    .from('conferencias')
    .select('*')
    .eq('empresa_id', currentUser.empresaId)
    .order('criado_em', { ascending: false });

  if (error) {
    console.error('Erro ao carregar conferências:', error.message);
    conferenciasCache = [];
    return;
  }
  conferenciasCache = (data || []).map(c => ({
    id: c.id,
    fornecedorId: c.fornecedor_id,
    usuarioId: c.usuario_id,
    data: c.data,
    numeroNf: c.numero_nf,
    respostas: c.respostas || [],
    descontoTotal: c.desconto_total,
    enviadoPorEmail: c.enviado_por_email,
    criadoEm: c.criado_em,
  }));
}

// Acha a conferência (se existir) da mesma NF + fornecedor — é assim que a
// conferência (opcional) se junta automaticamente ao lançamento de produto,
// sem travar nada se não existir nenhuma pra essa NF.
function buscarConferencia(fornecedorId, numeroNf) {
  if (!fornecedorId || !numeroNf) return null;
  const nfNormalizada = numeroNf.trim().toLowerCase();
  return conferenciasCache.find(c => c.fornecedorId === fornecedorId && c.numeroNf.trim().toLowerCase() === nfNormalizada) || null;
}

// Busca os documentos de fornecedores da empresa (metadado — o arquivo em
// si mora no Supabase Storage, aqui só o caminho pra buscar quando precisar).
async function carregarDocumentos() {
  const { data, error } = await supabaseClient
    .from('documentos')
    .select('*')
    .eq('empresa_id', currentUser.empresaId)
    .is('excluido_em', null);

  if (error) {
    console.error('Erro ao carregar documentos:', error.message);
    documentosCache = [];
    return;
  }
  documentosCache = (data || []).map(doc => ({
    id: doc.id,
    fornecedorId: doc.fornecedor_id,
    nome: doc.tipo_documento,
    validade: doc.validade,
    diasAviso: doc.dias_aviso ?? null, // null = usa o padrão do sistema (30 dias)
    obs: doc.obs || '',
    nomeArquivo: doc.nome_arquivo,
    caminhoStorage: doc.caminho_storage,
    criadoEm: doc.enviado_em,
    cobradoEm: doc.cobrado_em || null,
    ultimoErroCobranca: doc.ultimo_erro_cobranca || null,
    ultimoErroCobrancaEm: doc.ultimo_erro_cobranca_em || null,
  }));
}

let documentosVersoesCache = [];

async function carregarDocumentosVersoes() {
  const { data, error } = await supabaseClient
    .from('documentos_versoes')
    .select('*')
    .eq('empresa_id', currentUser.empresaId)
    .order('substituido_em', { ascending: false });

  if (error) {
    console.error('Erro ao carregar histórico de documentos:', error.message);
    documentosVersoesCache = [];
    return;
  }
  documentosVersoesCache = (data || []).map(v => ({
    id: v.id, documentoId: v.documento_id, nomeArquivo: v.nome_arquivo, caminhoStorage: v.caminho_storage, substituidoEm: v.substituido_em,
  }));
}

let documentosPendentesAprovacaoCache = [];

async function carregarDocumentosPendentesAprovacao() {
  const { data, error } = await supabaseClient
    .from('documentos_pendentes_aprovacao')
    .select('*')
    .eq('empresa_id', currentUser.empresaId)
    .order('enviado_em', { ascending: false });

  if (error) {
    console.error('Erro ao carregar pendentes de aprovação:', error.message);
    documentosPendentesAprovacaoCache = [];
    return;
  }
  documentosPendentesAprovacaoCache = (data || []).map(p => ({
    id: p.id, documentoId: p.documento_id, fornecedorId: p.fornecedor_id,
    novaValidade: p.nova_validade, nomeArquivo: p.nome_arquivo, caminhoStorage: p.caminho_storage,
    enviadoEm: p.enviado_em, status: p.status, motivoRejeicao: p.motivo_rejeicao,
  }));
}

let unidadesCache = [];
let unidadesDocumentosCache = [];

async function carregarUnidades() {
  const { data, error } = await supabaseClient
    .from('unidades')
    .select('*')
    .eq('empresa_id', currentUser.empresaId)
    .order('nome');

  if (error) {
    console.error('Erro ao carregar unidades:', error.message);
    unidadesCache = [];
    return;
  }
  unidadesCache = (data || []).map(u => ({
    id: u.id, nome: u.nome, endereco: u.endereco || '', cnpj: u.cnpj || '', telefone: u.telefone || '', ativo: u.ativo !== false, criadoEm: u.criado_em,
  }));
}

async function carregarUnidadesDocumentos() {
  const { data, error } = await supabaseClient
    .from('unidades_documentos')
    .select('*')
    .eq('empresa_id', currentUser.empresaId)
    .is('excluido_em', null);

  if (error) {
    console.error('Erro ao carregar documentos de unidades:', error.message);
    unidadesDocumentosCache = [];
    return;
  }
  unidadesDocumentosCache = (data || []).map(doc => ({
    id: doc.id,
    unidadeId: doc.unidade_id,
    nome: doc.tipo_documento,
    validade: doc.validade,
    diasAviso: doc.dias_aviso ?? null,
    obs: doc.obs || '',
    nomeArquivo: doc.nome_arquivo,
    caminhoStorage: doc.caminho_storage,
    criadoEm: doc.enviado_em,
  }));
}

async function doLogout() {
  addLog('logout', `${currentUser.email} saiu do sistema`);
  await supabaseClient.auth.signOut();
  currentUser = null;
  document.getElementById('app').classList.remove('active');
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-email').value = '';
  document.getElementById('login-senha').value = '';
}

// Decodifica só a parte central do JWT (o "payload"), sem checar assinatura —
// aqui é só pra ler o campo "amr" (como a sessão foi criada), não pra validar
// segurança; quem valida a sessão de verdade é o próprio Supabase.
function sessaoVeioDeRecuperacaoSenha(session) {
  try {
    const payload = JSON.parse(atob(session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return (payload.amr || []).some(m => m.method === 'recovery');
  } catch (e) {
    return false;
  }
}

// Ao recarregar a página, o Supabase mantém a sessão salva (em localStorage,
// gerenciado por ele mesmo) — então recuperamos e já logamos de novo.
async function checkSession() {
  // Se for um link de recuperação de senha, não faz nada aqui — deixa o
  // evento PASSWORD_RECOVERY (registrado em init.js) mostrar a tela de nova
  // senha sozinho, sem correr o risco de logar a pessoa no dashboard antes.
  if (window.__isPasswordRecovery) return;

  const { data: { session } } = await supabaseClient.auth.getSession();

  // Mesmo que o link específico já tenha "expirado" (por exemplo, se o app
  // de e-mail do celular abriu o link sozinho antes, num pré-carregamento),
  // a sessão que sobrou pode ainda ser uma sessão de recuperação de senha —
  // e nesse caso a pessoa TEM que trocar a senha antes de entrar, nunca cai
  // direto no dashboard com a senha antiga.
  if (session && sessaoVeioDeRecuperacaoSenha(session)) {
    mostrarRedefinirSenha();
    return;
  }

  let logado = false;
  if (session) logado = await carregarPerfilELogar();
  if (!logado) document.getElementById('login-screen').style.display = 'flex';
  const boot = document.getElementById('boot-loading');
  if (boot) boot.style.display = 'none';
}

// ============ CÁLCULO DE NOTA ============
function calcularNota(formulario, respostas) {
  // respostas: { criterioId: { opcaoIndex, naoHouve } }
  let total = 0;
  let criteriosValidos = 0;
  let todosNaoHouve = true;

  formulario.criterios.forEach(crit => {
    const resp = respostas[crit.id];
    if (!resp || resp.naoHouve) return;
    todosNaoHouve = false;
    const opcao = crit.opcoes[resp.opcaoIndex];
    if (opcao) {
      total += opcao.pontos;
      criteriosValidos++;
    }
  });

  if (todosNaoHouve) return { nota: null, semServico: true };
  return { nota: total, semServico: false };
}

function getSituacao(nota) {
  const c = db().matriz;
  if (nota === null || isNaN(nota)) return null;
  if (c.usarCert !== false && nota >= c.cert) return 'certificado';
  if (c.usarAprov !== false && nota >= c.aprov) return 'aprovado';
  if (c.usarParcial !== false && nota >= c.parcial) return 'parcial';
  return 'reprovado';
}

function badgeSit(sit) {
  const map = {
    certificado: ['badge-accent', 'check', 'Certificado'],
    aprovado: ['badge-success', 'check', 'Aprovado'],
    parcial: ['badge-warn', 'alertTriangle', 'Parcial'],
    reprovado: ['badge-danger', 'xCircle', 'Reprovado']
  };
  const [cls, icone, label] = map[sit] || [null, null, sit || '—'];
  if (!cls) return `<span class="badge badge-neutral">${label}</span>`;
  return `<span class="badge ${cls}" style="display:inline-flex; align-items:center; gap:4px">${ic(icone, 12)}${label}</span>`;
}


// ============ MODAL HELPERS ============
function openModal(html) {
  document.getElementById('modal-box').innerHTML = html;
  document.getElementById('modal-overlay').classList.add('active');
}
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
}
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'modal-overlay') closeModal();
});


// Junta tudo que precisa de atenção (documento de fornecedor, documento de
// unidade, avaliação reprovada não notificada, avaliador com pendência) num
// lugar só, respeitando os módulos que o usuário logado tem acesso.
function montarNotificacoes() {
  const d = db();
  const itens = [];

  if (temAcessoModulo('fornecedores')) {
    const { vencidos, proximos } = contarDocumentosVencendo(d);
    vencidos.forEach(doc => {
      const forn = d.fornecedores.find(f => f.id === doc.fornecedorId);
      itens.push({ urgente: true, texto: `Documento vencido: ${doc.nome} — ${forn ? forn.nome : '—'}`, modulo: 'fornecedores' });
    });
    proximos.forEach(doc => {
      const forn = d.fornecedores.find(f => f.id === doc.fornecedorId);
      itens.push({ urgente: false, texto: `Vence em ${diasParaVencer(doc.validade)}d: ${doc.nome} — ${forn ? forn.nome : '—'}`, modulo: 'fornecedores' });
    });
    (d.documentosPendentesAprovacao || []).filter(p => p.status === 'pendente').forEach(p => {
      const forn = d.fornecedores.find(f => f.id === p.fornecedorId);
      itens.push({ urgente: false, texto: `${ic('inbox', 12)}${forn ? forn.nome : '—'} enviou documento pelo portal — aguardando aprovação`, modulo: 'fornecedores' });
    });
  }

  if (temAcessoModulo('meusdocumentos')) {
    const { vencidos: uVencidos, proximos: uProximos } = contarUnidadesDocumentosVencendo(d);
    uVencidos.forEach(doc => {
      const un = d.unidades.find(u => u.id === doc.unidadeId);
      itens.push({ urgente: true, texto: `Documento vencido: ${doc.nome} — ${un ? un.nome : '—'}`, modulo: 'meusdocumentos' });
    });
    uProximos.forEach(doc => {
      const un = d.unidades.find(u => u.id === doc.unidadeId);
      itens.push({ urgente: false, texto: `Vence em ${diasParaVencer(doc.validade)}d: ${doc.nome} — ${un ? un.nome : '—'}`, modulo: 'meusdocumentos' });
    });
  }

  if (temAcessoModulo('avaliacoes')) {
    const mesAtual = new Date().getMonth() + 1, anoAtual = new Date().getFullYear();
    const chaveMes = `${anoAtual}-${mesAtual}`;
    d.avaliacoes.filter(av => av.periodo === chaveMes && !av.semServico && !av.notificadoEm && (situacaoDe(av) === 'reprovado' || situacaoDe(av) === 'parcial')).forEach(av => {
      const forn = d.fornecedores.find(f => f.id === av.fornecedorId);
      itens.push({ urgente: situacaoDe(av) === 'reprovado', texto: `Nota baixa (${av.nota.toFixed(1)}) — ${forn ? forn.nome : '—'}`, modulo: 'avaliacoes' });
    });
  }

  if (temAcessoModulo('usuarios')) {
    d.usuarios.filter(u => u.papel === 'avaliador' && u.ativo).forEach(u => {
      const { pendentes, atrasados } = contarPendentesAvaliador(d, u.id);
      if (pendentes > 0) itens.push({ urgente: atrasados > 0, texto: `${u.nome}: ${pendentes} avaliação(ões) pendente(s)${atrasados ? `, ${atrasados} atrasada(s)` : ''}`, modulo: 'usuarios' });
    });
  }

  return itens;
}

function atualizarBadgeNotificacoes() {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  const total = montarNotificacoes().length;
  badge.textContent = total > 99 ? '99+' : total;
  badge.style.display = total > 0 ? 'flex' : 'none';
}

function abrirCentralNotificacoes() {
  const itens = montarNotificacoes().sort((a, b) => (b.urgente ? 1 : 0) - (a.urgente ? 1 : 0));
  openModal(`
    <h3>Notificações</h3>
    <div style="max-height:400px; overflow-y:auto; margin-top:12px">
      ${itens.length ? itens.map(item => `
        <div style="display:flex; align-items:center; gap:8px; padding:8px 0; border-bottom:1px solid var(--border); font-size:13px; cursor:pointer" onclick="closeModal(); showAdPage('${item.modulo}', document.querySelector('#sidebar .nav-item[onclick*=\\'${item.modulo}\\']'))">
          <span style="width:8px; height:8px; border-radius:50%; flex-shrink:0; background:${item.urgente ? 'var(--danger)' : 'var(--warn)'}"></span>
          <span>${item.texto}</span>
        </div>
      `).join('') : '<div class="empty-state"><p>Nada pendente por aqui.</p></div>'}
    </div>
  `);
}

// Popup central de progresso — mostra "carregando" enquanto uma ação roda,
// depois vira o check (mesmo desenho do selo da tela de login) e some
// sozinho. Uso: mostrarCarregando('Associando...'); ... mostrarSucesso('Associado!');
function mostrarCarregando(texto) {
  const overlay = document.getElementById('progresso-overlay');
  if (!overlay) return;
  overlay.classList.remove('sucesso');
  const spinner = document.getElementById('progresso-spinner');
  const check = document.getElementById('progresso-check-svg');
  if (spinner) spinner.style.display = 'block';
  if (check) check.style.display = 'none';
  document.getElementById('progresso-texto').textContent = texto;
  overlay.classList.add('active');
}

function mostrarSucesso(texto, duracaoMs) {
  const overlay = document.getElementById('progresso-overlay');
  if (!overlay) return;
  const spinner = document.getElementById('progresso-spinner');
  const check = document.getElementById('progresso-check-svg');
  if (spinner) spinner.style.display = 'none';
  if (check) check.style.display = 'block';
  document.getElementById('progresso-texto').textContent = texto;
  void overlay.offsetWidth; // força o navegador a "notar" o estado antes de animar
  overlay.classList.add('sucesso');
  setTimeout(() => { overlay.classList.remove('active'); }, duracaoMs || 1300);
}

function esconderProgresso() {
  const overlay = document.getElementById('progresso-overlay');
  if (overlay) overlay.classList.remove('active');
}
const MODULOS_MENU = [
  { chave: 'dashboard', label: 'Dashboard', icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>' },
  { chave: 'meusdocumentos', label: 'Meus Documentos', icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>' },
  { chave: 'fornecedores', label: 'Fornecedores', icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>' },
  { chave: 'avaliar', label: 'Avaliar', icone: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/></svg>' },
  { chave: 'conferencia', label: 'Conferência', icone: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 12 2 2 4-4"/><path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.6 0 3.1.42 4.4 1.15"/><path d="M21 5 12 14l-3-3"/></svg>' },
  { chave: 'formularios', label: 'Formulários', icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' },
  { chave: 'avaliacoes', label: 'Avaliações recebidas', icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>' },
  { chave: 'usuarios', label: 'Usuários e acessos', icone: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/></svg>' },
  { chave: 'relatorio', label: 'Relatório & PDFs', icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>' },
  { chave: 'config', label: 'Configurações', icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07A10 10 0 0 1 4.93 4.93"/></svg>', separadorAntes: true },
  { chave: 'auditoria', label: 'Log de auditoria', icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' },
];

function renderAdminShell() {
  const modulosVisiveis = MODULOS_MENU.filter(m => temAcessoModulo(m.chave));
  const primeiroModulo = modulosVisiveis[0] ? modulosVisiveis[0].chave : 'dashboard';

  const nomeEmpresaSidebar = empresaConfigCache.nome || 'Gestão da Qualidade';
  document.getElementById('sidebar').innerHTML = `
    <div class="sidebar-logo"><h1>HomologPro</h1><p title="${nomeEmpresaSidebar}">${nomeEmpresaSidebar}</p></div>
    <div class="sidebar-user">
      <div class="sidebar-user-avatar">${(currentUser.responsavel || currentUser.nome).split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>
      <div class="sidebar-user-info">
        <p>${currentUser.responsavel || currentUser.nome}</p>
        <span>${currentUser.responsavel ? currentUser.nome + ' · ' : ''}${currentUser.email}</span><br>
        <span class="role-badge admin">${currentUser.papel === 'admin_master' ? 'Admin+' : 'Admin'}</span>
      </div>
    </div>
    ${(() => {
      const d = db();
      if (d.statusEmpresa !== 'trial' || !d.trialTerminaEm) return '';
      const hoje0h = new Date(); hoje0h.setHours(0, 0, 0, 0);
      const fimTrial0h = new Date(d.trialTerminaEm); fimTrial0h.setHours(0, 0, 0, 0);
      const diasRestantes = Math.round((fimTrial0h - hoje0h) / 86400000);
      return `<div style="margin:0 16px 12px; padding:8px 10px; background:var(--warn-bg); border:1px solid var(--warn-border); border-radius:8px; font-size:11px; color:var(--warn); display:flex; align-items:center; gap:5px">
        ${diasRestantes > 0 ? `${ic('clock', 12)}Teste grátis: faltam ${diasRestantes} dia${diasRestantes > 1 ? 's' : ''}` : `${ic('alertTriangle', 12)}Seu teste grátis acabou`}
      </div>`;
    })()}
    <div class="nav-list" id="nav-list">
      <div class="nav-indicator" id="nav-indicator"></div>
      ${modulosVisiveis.map((m, i) => `
        ${m.separadorAntes ? '<div class="nav-sep"></div>' : ''}
        <button class="nav-item ${m.chave === primeiroModulo ? 'active' : ''}" onclick="showAdPage('${m.chave}', this)">
          ${m.icone}
          ${m.label}
        </button>
      `).join('')}
    </div>
    <div class="nav-logout">
      <button class="nav-item" onclick="doLogout()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Sair
      </button>
    </div>
  `;
  document.getElementById('main').innerHTML = `
    <div class="page ${primeiroModulo === 'dashboard' ? 'active' : ''}" id="ad-page-dashboard"></div>
    <div class="page ${primeiroModulo === 'meusdocumentos' ? 'active' : ''}" id="ad-page-meusdocumentos"></div>
    <div class="page ${primeiroModulo === 'fornecedores' ? 'active' : ''}" id="ad-page-fornecedores"></div>
    <div class="page ${primeiroModulo === 'formularios' ? 'active' : ''}" id="ad-page-formularios"></div>
    <div class="page ${primeiroModulo === 'avaliar' ? 'active' : ''}" id="ad-page-avaliar"></div>
    <div class="page ${primeiroModulo === 'conferencia' ? 'active' : ''}" id="ad-page-conferencia"></div>
    <div class="page ${primeiroModulo === 'usuarios' ? 'active' : ''}" id="ad-page-usuarios"></div>
    <div class="page ${primeiroModulo === 'avaliacoes' ? 'active' : ''}" id="ad-page-avaliacoes"></div>
    <div class="page ${primeiroModulo === 'relatorio' ? 'active' : ''}" id="ad-page-relatorio"></div>
    <div class="page ${primeiroModulo === 'config' ? 'active' : ''}" id="ad-page-config"></div>
    <div class="page ${primeiroModulo === 'auditoria' ? 'active' : ''}" id="ad-page-auditoria"></div>
  `;
  const renderers = {
    dashboard: renderAdDashboard, meusdocumentos: renderAdMeusDocumentos, fornecedores: renderAdFornecedores,
    formularios: renderAdFormularios, usuarios: renderAdUsuarios, avaliacoes: renderAdAvaliacoes,
    relatorio: renderAdRelatorio, config: renderAdConfig, auditoria: renderAdAuditoria, avaliar: renderAdAvaliar, conferencia: renderAdConferencia
  };
  if (renderers[primeiroModulo]) renderers[primeiroModulo]();
  atualizarBadgeNotificacoes();

  const indicator = document.getElementById('nav-indicator');
  const btnAtivo = document.querySelector('#sidebar .nav-item.active');
  if (indicator && btnAtivo) {
    indicator.style.transition = 'none'; // não anima na carga inicial da página
    posicionarIndicadorNav(btnAtivo);
    requestAnimationFrame(() => { indicator.style.transition = ''; });
  }
}

function posicionarIndicadorNav(btn) {
  const indicator = document.getElementById('nav-indicator');
  if (!indicator || !btn) { if (indicator) indicator.style.opacity = '0'; return; }
  indicator.style.opacity = '1';
  indicator.style.height = btn.offsetHeight + 'px';
  indicator.style.transform = `translateY(${btn.offsetTop}px)`;
}

function showAdPage(page, btn) {
  if (!temAcessoModulo(page)) { toast('Você não tem acesso a esse módulo.'); return; }
  atualizarBadgeNotificacoes();
  document.querySelectorAll('#sidebar .nav-item').forEach(n => n.classList.remove('active'));
  if (btn) { btn.classList.add('active'); posicionarIndicadorNav(btn); }
  document.querySelectorAll('#main .page').forEach(p => p.classList.remove('active'));
  document.getElementById('ad-page-' + page).classList.add('active');
  const renderers = {
    dashboard: renderAdDashboard, meusdocumentos: renderAdMeusDocumentos, fornecedores: renderAdFornecedores, formularios: renderAdFormularios,
    usuarios: renderAdUsuarios, avaliacoes: renderAdAvaliacoes, relatorio: renderAdRelatorio,
    config: renderAdConfig, auditoria: renderAdAuditoria, avaliar: renderAdAvaliar, conferencia: renderAdConferencia
  };
  if (renderers[page]) renderers[page]();
}


// ---------- AUDITORIA ----------
function renderAdAuditoria() {
  document.getElementById('ad-page-auditoria').innerHTML = `
    <div class="page-header"><div><h2>Log de auditoria</h2><p>Histórico completo de ações no sistema — útil para auditorias ISO/ONA</p></div></div>
    <div class="card" style="margin-bottom:14px">
      <input type="text" id="ad-auditoria-busca" oninput="renderAdAuditoriaLista()" placeholder="Buscar por responsável, setor, e-mail ou ação...">
    </div>
    <div class="card" id="ad-auditoria-lista"></div>
  `;
  renderAdAuditoriaLista();
}

function renderAdAuditoriaLista() {
  const d = db();
  const buscaEl = document.getElementById('ad-auditoria-busca');
  const termo = (buscaEl ? buscaEl.value : '').trim().toLowerCase();
  const logsFiltrados = termo
    ? d.logs.filter(l => (l.usuario || '').toLowerCase().includes(termo) || (l.detalhe || '').toLowerCase().includes(termo) || (l.acao || '').toLowerCase().includes(termo))
    : d.logs;

  document.getElementById('ad-auditoria-lista').innerHTML = `
    ${!logsFiltrados.length ? `<div class="empty-state"><p>${termo ? 'Nenhum evento encontrado para essa busca.' : 'Nenhum evento registrado ainda.'}</p></div>` : logsFiltrados.slice(0, 100).map(l => `
      <div class="log-item">
        <div class="log-dot"></div>
        <div class="log-text">
          <span><b>${l.usuario}</b> — ${l.detalhe}</span>
          <div class="log-time">${fmtData(l.timestamp)}</div>
        </div>
      </div>
    `).join('')}
  `;
}
