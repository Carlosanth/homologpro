// ============ PLANOS PADRÃO (Essencial/Profissional) — vem do Supabase ============
// Fonte única de verdade: tabela planos_config (migration 009). Antes o
// preço ficava hardcoded aqui — isso já tinha causado desincronia com o
// valor real cobrado no Stripe. Agora busca uma vez e guarda em cache;
// se a tabela ainda não existir (migration não rodada) ou a busca falhar,
// cai num valor de segurança pra tela não quebrar.
let _planosConfigCache = null;

async function garantirPlanosConfig() {
  if (_planosConfigCache) return _planosConfigCache;
  try {
    const { data, error } = await supabaseClient.from('planos_config').select('*');
    if (error || !data || !data.length) throw error || new Error('vazio');
    _planosConfigCache = {};
    data.forEach(p => { _planosConfigCache[p.chave] = p; });
  } catch (e) {
    console.error('Não foi possível carregar planos_config, usando valores de segurança:', e);
    _planosConfigCache = {
      essencial: { chave: 'essencial', nome: 'Essencial', preco: 239.90, recomendado: false },
      profissional: { chave: 'profissional', nome: 'Profissional', preco: 529.90, recomendado: true },
    };
  }
  return _planosConfigCache;
}

// ============ CONFIGURAÇÕES: matriz, textos e editor de layout dos documentos ============
function getDefaultTextos() {
  // Vazio de propósito: cada empresa escreve o texto do jeito dela — não faz
  // sentido todo cliente novo do SaaS herdar um texto-modelo de uma empresa específica.
  return {
    'cert-prod': '', 'cert-serv': '', 'aprov-prod': '', 'aprov-serv': '', 'parcial-prod': '', 'parcial-serv': '', 'reprov-prod': '', 'reprov-serv': '',
    // Esses 3 aqui são diferentes de propósito: é um texto mais operacional/
    // técnico (não é a "voz" de certificado/carta de uma empresa específica),
    // então já vem preenchido — o cliente vê exatamente o que vai no e-mail
    // sem precisar adivinhar, e só ajusta se quiser.
    'notif-abertura': 'Informamos que foi concluída a análise referente à avaliação abaixo.',
    'notif-plano-acao': 'Solicitamos o envio de um plano de ação para os pontos identificados.',
    'notif-fechamento': 'Apresentamos esses dados para que sua equipe possa analisar os pontos de melhoria e alinhar os processos internos. Permanecemos à disposição para esclarecer dúvidas e apoiar no que for necessário.\n\nAtenciosamente,',
    'notif-prazo-dias': '10',
  };
}

// ============ LAYOUT CONFIGURÁVEL DOS DOCUMENTOS (blocos dinâmicos) ============
// cert = certificado (paisagem, nota 10) · carta = aprovado/parcial/reprovado (retrato)
// Cada documento tem uma LISTA de blocos (não mais chaves fixas): cada bloco pode ser
// texto fixo ou uma variável dinâmica, e pode ser livremente adicionado/removido/estilizado.
function getLayoutDefaults() {
  return {
    cert: { blocos: [
      { id: 'titulo',    label: 'Título', tipo: 'fixo', conteudo: 'CERTIFICADO DE APROVAÇÃO', fonte: 'helvetica', tamanho: 26, cor: '#7c2d12', negrito: true, italico: true, align: 'center', x: 148.5, y: 38, largura: 230 },
      { id: 'saudacao',  label: 'Saudação', tipo: 'fixo', conteudo: 'Certificamos que:', fonte: 'helvetica', tamanho: 13, cor: '#282828', negrito: false, italico: false, align: 'center', x: 148.5, y: 58, largura: 200 },
      { id: 'nome',      label: 'Nome do fornecedor', tipo: 'variavel', variavel: 'fornecedor', fonte: 'helvetica', tamanho: 18, cor: '#141414', negrito: true, italico: false, align: 'center', x: 148.5, y: 80, largura: 220 },
      { id: 'corpo',     label: 'Corpo do texto', tipo: 'variavel', variavel: 'corpo_texto', fonte: 'helvetica', tamanho: 13, cor: '#323232', negrito: false, italico: false, align: 'center', x: 148.5, y: 98, largura: 177 },
      { id: 'nota',      label: 'Nota', tipo: 'variavel', variavel: 'nota', fonte: 'helvetica', tamanho: 18, cor: '#141414', negrito: true, italico: false, align: 'center', x: 148.5, y: 160, largura: 120 },
      { id: 'rodape',    label: 'Endereço (rodapé)', tipo: 'variavel', variavel: 'rodape_empresa', fonte: 'helvetica', tamanho: 8, cor: '#505050', negrito: false, italico: false, align: 'left', x: 30, y: 200, largura: 150 },
      { id: 'data',      label: 'Data/local', tipo: 'variavel', variavel: 'data_hoje', fonte: 'helvetica', tamanho: 8, cor: '#505050', negrito: false, italico: false, align: 'right', x: 267, y: 200, largura: 100 }
    ]},
    carta: { blocos: [
      { id: 'data',      label: 'Data/local', tipo: 'variavel', variavel: 'data_hoje', fonte: 'helvetica', tamanho: 10, cor: '#646464', negrito: false, italico: false, align: 'left', x: 25, y: 30, largura: 150 },
      { id: 'nome',      label: 'Nome do fornecedor', tipo: 'variavel', variavel: 'fornecedor', fonte: 'helvetica', tamanho: 13, cor: '#000000', negrito: true, italico: false, align: 'left', x: 25, y: 42, largura: 160 },
      { id: 'subtitulo', label: 'Situação (Aprovado/Parcial/Reprovado)', tipo: 'variavel', variavel: 'situacao', fonte: 'helvetica', tamanho: 12, cor: '#009942', negrito: false, italico: false, align: 'left', x: 25, y: 50, largura: 160 },
      { id: 'corpo',     label: 'Corpo do texto', tipo: 'variavel', variavel: 'corpo_texto', fonte: 'helvetica', tamanho: 11, cor: '#000000', negrito: false, italico: false, align: 'left', x: 25, y: 62, largura: 160 },
      { id: 'rodape',    label: 'Endereço (rodapé)', tipo: 'variavel', variavel: 'rodape_empresa', fonte: 'helvetica', tamanho: 9, cor: '#787878', negrito: false, italico: false, align: 'center', x: 105, y: 281, largura: 160 }
    ]}
  };
}

// Converte um layout salvo no formato antigo (objeto com chaves fixas: titulo/nome/corpo...)
// pro novo formato de blocos, preservando posição/tamanho/alinhamento que o usuário já ajustou.
function migrarLayoutAntigoParaBlocos(salvoAntigo, def) {
  const resultado = {};
  ['cert', 'carta'].forEach(tipo => {
    const antigos = salvoAntigo[tipo] || {};
    resultado[tipo] = { blocos: def[tipo].blocos.map(defBloco => {
      const antigo = antigos[defBloco.id];
      if (!antigo) return { ...defBloco };
      return { ...defBloco, x: antigo.x ?? defBloco.x, y: antigo.y ?? defBloco.y, tamanho: antigo.size ?? defBloco.tamanho, align: antigo.align ?? defBloco.align, largura: antigo.largura ?? defBloco.largura };
    })};
  });
  return resultado;
}

function getLayout() {
  const saved = empresaConfigCache.config.layout;
  const def = getLayoutDefaults();
  if (!saved) return JSON.parse(JSON.stringify(def));
  const formatoNovo = saved.cert && Array.isArray(saved.cert.blocos);
  const resultado = !formatoNovo ? migrarLayoutAntigoParaBlocos(saved, def) : {
    cert:  { blocos: Array.isArray(saved.cert.blocos)  && saved.cert.blocos.length  ? saved.cert.blocos  : def.cert.blocos },
    carta: { blocos: Array.isArray(saved.carta.blocos) && saved.carta.blocos.length ? saved.carta.blocos : def.carta.blocos }
  };
  // Autocorreção: se algum bloco ficou apontando pra uma fonte que não existe mais
  // (ex: fonte personalizada removida sem atualizar os blocos, ou dado salvo antigo/corrompido),
  // volta pra Helvetica em vez de deixar o editor quebrado pra sempre.
  const chavesValidas = new Set(Object.keys(FONTES_PADRAO).concat((empresaConfigCache.config.fontesCustom || []).map(f => f.chave)));
  ['cert', 'carta'].forEach(tipo => {
    resultado[tipo].blocos.forEach(b => {
      if (!chavesValidas.has(b.fonte)) b.fonte = 'helvetica';
    });
  });
  return resultado;
}

// Variáveis dinâmicas disponíveis pra associar a um bloco (inclui campos personalizados do fornecedor)
function getVariaveisDoc() {
  const d = db();
  const vars = {
    fornecedor:     { label: 'Nome do fornecedor' },
    nota:           { label: 'Nota final' },
    periodo:        { label: 'Período avaliado' },
    situacao:       { label: 'Situação (Aprovado/Parcial/Reprovado)' },
    cnpj:           { label: 'CNPJ do fornecedor' },
    setor:          { label: 'Setor do fornecedor' },
    corpo_texto:    { label: 'Texto do status (edite clicando neste bloco)' },
    data_hoje:      { label: 'Data de hoje (por extenso)' },
    rodape_empresa: { label: 'Endereço/contato da empresa' }
  };
  (d.camposFornecedorCustom || []).forEach(c => { vars['extra_' + c.chave] = { label: 'Campo personalizado: ' + c.label }; });
  return vars;
}

// Resolve o valor de uma variável pro texto final (usado tanto no preview do editor quanto no PDF)
function resolveVariavelValor(chave, ctx) {
  switch (chave) {
    case 'fornecedor': return ctx.fornecedor.nome + (ctx.isCert ? '' : '.');
    case 'empresa': return ctx.empresaNome;
    case 'nota': return ctx.isCert ? `NOTA: ${ctx.nota}` : ctx.nota;
    case 'periodo': return ctx.periodo;
    case 'situacao': return getSubtituloDoc(ctx.sit);
    case 'cnpj': return ctx.fornecedor.cnpj || '';
    case 'setor': return ctx.fornecedor.setor || '';
    case 'criticidade': return ctx.fornecedor.criticidade || '';
    case 'corpo_texto': return ctx.corpoTexto;
    case 'saudacao': return `${ctx.empresaNome} certifica que:`;
    case 'data_hoje': {
      const hoje = new Date();
      const txt = `${ctx.dadosEmpresa.cidade || ''}, ${hoje.getDate()} de ${MESES[hoje.getMonth()+1]} de ${hoje.getFullYear()}`;
      return ctx.isCert ? txt : txt + '.';
    }
    case 'rodape_empresa': {
      const e = ctx.dadosEmpresa;
      return ctx.isCert
        ? ([e.endereco, e.tel ? `Fones: ${e.tel}` : '', e.cep ? `CEP: ${e.cep} | ${e.cidade||''}` : e.cidade].filter(Boolean).join(' | ') || ctx.empresaNome)
        : ([e.endereco, e.cidade, e.cep ? `CEP: ${e.cep}` : '', e.tel].filter(Boolean).join(' | ') || ctx.empresaNome);
    }
    default:
      if (chave.startsWith('extra_')) return (ctx.fornecedor.extras || {})[chave.slice(6)] || '';
      return '';
  }
}


async function renderAdConfig() {
  const d = db();

  // ---- dados da assinatura (usados no card "Assinatura" dentro de Minha empresa) ----
  const STATUS_LABELS = { trial: 'Trial', ativa: 'Ativa', expirada: 'Expirada', cancelada: 'Cancelada' };
  const STATUS_BADGE_CLASS = { trial: 'trial', ativa: 'ativo', expirada: 'expirado', cancelada: 'cancelado' };
  const PLANO_LABELS = { essencial: 'Essencial', profissional: 'Profissional', enterprise: 'Enterprise' };
  const statusAtual = d.statusEmpresa || 'ativa';
  const planoLabel = d.plano ? (PLANO_LABELS[d.plano] || d.plano) : null;
  // pill de status (só "Ativa"/"Trial"/etc.) e a tag do nome do plano ficam separados agora
  const badgeTexto = STATUS_LABELS[statusAtual] || statusAtual;
  const badgeClasse = STATUS_BADGE_CLASS[statusAtual] || 'ativo';
  const planoTagHtml = planoLabel ? `<span class="plan-name-tag">${planoLabel}</span>` : '';

  let trialBannerHtml = '';
  if (statusAtual === 'trial' && d.trialTerminaEm) {
    const hoje0h = new Date(); hoje0h.setHours(0, 0, 0, 0);
    const fimTrial0h = new Date(d.trialTerminaEm); fimTrial0h.setHours(0, 0, 0, 0);
    const diasRestantes = Math.round((fimTrial0h - hoje0h) / 86400000);
    trialBannerHtml = `<div class="trial-banner-inline">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      ${diasRestantes > 0 ? `Faltam ${diasRestantes} dia${diasRestantes > 1 ? 's' : ''} pro fim do teste grátis` : 'Seu teste grátis acabou'}
    </div>`;
  }

  const totalFornecedores = d.fornecedores.length;
  const totalAdmins = d.usuarios.filter(u => (u.papel === 'admin' || u.papel === 'admin_master') && u.ativo).length;

  function usageRowHtml(iconSvg, label, atual, limite) {
    const pct = limite ? Math.min(100, Math.round(atual / limite * 100)) : 0;
    return `
      <div class="usage-row">
        <div class="usage-row-icon">${iconSvg}</div>
        <div class="usage-row-body">
          <div class="usage-row-label">${label}</div>
          ${limite !== null ? `<div class="usage-bar"><div class="usage-bar-fill" style="width:${pct}%"></div></div>` : ''}
        </div>
        <div class="usage-row-value">${atual}${limite !== null ? ' / ' + limite : ' · sem limite'}</div>
      </div>`;
  }

  const iconFornecedores = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>';
  const iconAdmins = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/></svg>';

  // ---- só admin_master vê valores/cancela; admin comum vê tudo mascarado (***) ----
  const isAdminMaster = currentUser.papel === 'admin_master';
  // só considera "plano assinado" quando realmente ativa — trial não conta, mesmo já tendo um plano escolhido
  const planoAtivo = (statusAtual === 'ativa') ? d.plano : null;

  const planosConfig = await garantirPlanosConfig();
  const PLANOS_INFO = {
    essencial: { nome: planosConfig.essencial.nome, preco: Number(planosConfig.essencial.preco), recomendado: !!planosConfig.essencial.recomendado },
    profissional: { nome: planosConfig.profissional.nome, preco: Number(planosConfig.profissional.preco), recomendado: !!planosConfig.profissional.recomendado },
  };

  function precoTextoPlano(preco) {
    return isAdminMaster ? `R$ ${preco.toFixed(2).replace('.', ',')}` : '***';
  }

  // Card de um plano ainda não assinado — botão "Assinar" (só aparece quando NÃO tem nenhum plano ativo ainda)
  function cardAssinarHtml(planoKey) {
    const { nome, preco, recomendado } = PLANOS_INFO[planoKey];
    const botao = isAdminMaster
      ? `<button class="btn ${recomendado ? 'btn-primary' : 'btn-secondary'} btn-block" onclick="assinarPlano('${planoKey}')">Assinar ${nome}</button>`
      : `<button class="btn ${recomendado ? 'btn-primary' : 'btn-secondary'} btn-block" disabled style="opacity:.5; cursor:not-allowed" title="Só o Admin+ pode gerenciar a assinatura">Assinar ${nome}</button>`;
    return `
      <div class="upgrade-card${recomendado ? ' recommended' : ''}">
        ${recomendado ? '<span class="upgrade-card-tag">Recomendado</span>' : ''}
        <div style="font-weight:700; margin-bottom:4px">${nome}</div>
        <div style="font-size:19px; font-weight:700; color:var(--accent); margin-bottom:10px">${precoTextoPlano(preco)}<span style="font-size:11.5px; font-weight:400; color:var(--text-muted)">/mês</span></div>
        ${botao}
      </div>`;
  }

  // Card do plano já assinado — no lugar de "Assinar" fica "CANCELAR"
  function cardAssinadoHtml(planoKey) {
    const { nome, preco, recomendado } = PLANOS_INFO[planoKey];
    const acoes = isAdminMaster
      ? `<button class="btn btn-danger btn-block btn-cancelar" onclick="abrirCancelarAssinatura()">Cancelar</button>`
      : `<button class="btn btn-secondary btn-block" disabled style="display:flex; align-items:center; justify-content:center; gap:6px; opacity:.7; cursor:default">
           <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
           Assinado
         </button>`;
    return `
      <div class="upgrade-card${recomendado ? ' recommended' : ''}">
        ${recomendado ? '<span class="upgrade-card-tag">Recomendado</span>' : ''}
        <div style="font-weight:700; margin-bottom:4px">${nome}</div>
        <div style="font-size:19px; font-weight:700; color:var(--accent); margin-bottom:10px">${precoTextoPlano(preco)}<span style="font-size:11.5px; font-weight:400; color:var(--text-muted)">/mês</span></div>
        ${acoes}
      </div>`;
  }

  // Card do OUTRO plano (o que não tá ativo) enquanto já existe uma assinatura ativa —
  // fica acinzentado e bloqueado; só dá pra escolher ele depois de cancelar o atual.
  function cardBloqueadoHtml(planoKey) {
    const { nome, preco, recomendado } = PLANOS_INFO[planoKey];
    return `
      <div class="upgrade-card disabled${recomendado ? ' recommended' : ''}">
        ${recomendado ? '<span class="upgrade-card-tag">Recomendado</span>' : ''}
        <div style="font-weight:700; margin-bottom:4px">${nome}</div>
        <div style="font-size:19px; font-weight:700; color:var(--accent); margin-bottom:10px">${precoTextoPlano(preco)}<span style="font-size:11.5px; font-weight:400; color:var(--text-muted)">/mês</span></div>
        <button class="btn btn-secondary btn-block" disabled style="opacity:.5; cursor:not-allowed" title="Cancele a assinatura atual antes de trocar de plano">Assinar ${nome}</button>
      </div>`;
  }

  // Card do plano Enterprise ativo — mostra status em vez de "assinar/cancelar" padrão.
  function cardEnterpriseAtivoHtml() {
    const valor = empresaConfigCache.valor_mensal_atual;
    const valorTexto = isAdminMaster ? (valor != null ? `R$ ${Number(valor).toFixed(2).replace('.', ',')}` : '—') : '***';

    const ativoDesde = empresaConfigCache.plano_ativo_desde
      ? new Date(empresaConfigCache.plano_ativo_desde).toLocaleDateString('pt-BR') : '—';

    let renovaTexto = '—';
    if (empresaConfigCache.proxima_cobranca_em) {
      const dataRenova = new Date(empresaConfigCache.proxima_cobranca_em);
      const dias = Math.max(0, Math.ceil((dataRenova.getTime() - Date.now()) / 86400000));
      renovaTexto = `${dataRenova.toLocaleDateString('pt-BR')} (em ${dias} dia(s))`;
    }

    const ultimaAlteracao = empresaConfigCache.enterprise_composicao?.calculadoEm
      ? new Date(empresaConfigCache.enterprise_composicao.calculadoEm).toLocaleDateString('pt-BR') : null;

    const avisoReajuste = (empresaConfigCache.proximo_valor_mensal != null && empresaConfigCache.proximo_reajuste_em)
      ? `<div style="font-size:11px; color:var(--warn); margin-top:8px">Reajuste agendado: R$ ${Number(empresaConfigCache.proximo_valor_mensal).toFixed(2).replace('.', ',')} a partir de ${new Date(empresaConfigCache.proximo_reajuste_em).toLocaleDateString('pt-BR')}</div>`
      : '';

    const acoes = isAdminMaster
      ? `<button class="btn btn-danger btn-block btn-cancelar" onclick="abrirCancelarAssinatura()">Cancelar</button>`
      : `<button class="btn btn-secondary btn-block" disabled style="display:flex; align-items:center; justify-content:center; gap:6px; opacity:.7; cursor:default">
           <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
           Assinado
         </button>`;

    return `
      <div class="upgrade-card recommended" style="max-width:100%">
        <span class="upgrade-card-tag">Enterprise</span>
        <div style="font-weight:700; margin-bottom:4px">Enterprise</div>
        <div style="font-size:19px; font-weight:700; color:var(--accent); margin-bottom:10px">${valorTexto}<span style="font-size:11.5px; font-weight:400; color:var(--text-muted)">/mês</span></div>
        <div style="font-size:11px; color:var(--text-muted); line-height:1.7; margin-bottom:10px">
          Ativo desde ${ativoDesde}<br>
          Renova em ${renovaTexto}${ultimaAlteracao ? `<br>Última alteração: ${ultimaAlteracao}` : ''}
        </div>
        ${avisoReajuste}
        ${acoes}
      </div>`;
  }

  let upgradeCardsHtml;
  if (planoAtivo === 'enterprise') {
    upgradeCardsHtml = `<div class="upgrade-cards">${cardEnterpriseAtivoHtml()}</div>`;
  } else if (planoAtivo && PLANOS_INFO[planoAtivo]) {
    const planoOutro = planoAtivo === 'essencial' ? 'profissional' : 'essencial';
    upgradeCardsHtml = `
      <div class="upgrade-cards">
        ${cardAssinadoHtml(planoAtivo)}
        ${cardBloqueadoHtml(planoOutro)}
      </div>`;
  } else {
    upgradeCardsHtml = `
      <div class="upgrade-cards">
        ${cardAssinarHtml('essencial')}
        ${cardAssinarHtml('profissional')}
      </div>`;

  }

  let zonaRiscoHtml;
  if (!isAdminMaster) {
    zonaRiscoHtml = '';
  } else if (empresaConfigCache.status === 'exclusao_agendada') {
    const dataExclusao = empresaConfigCache.exclusao_agendada_para
      ? new Date(empresaConfigCache.exclusao_agendada_para).toLocaleDateString('pt-BR') : '—';
    zonaRiscoHtml = `
      <div class="card" style="margin-bottom:0; border-color:var(--danger-border)">
        <div class="card-title"><span style="color:var(--danger)">Zona de risco</span></div>
        <p style="font-size:12px; color:var(--text-sec); margin-bottom:14px">
          Exclusão confirmada. Todos os dados serão apagados definitivamente em <strong>${dataExclusao}</strong>. Mudou de ideia? Ainda dá pra cancelar.
        </p>
        <button class="btn btn-secondary btn-block" onclick="cancelarSolicitacaoExclusao()">Cancelar exclusão da conta</button>
      </div>`;
  } else if (empresaConfigCache.exclusao_confirmada_em) {
    zonaRiscoHtml = `
      <div class="card" style="margin-bottom:0; border-color:var(--danger-border)">
        <div class="card-title"><span style="color:var(--danger)">Zona de risco</span></div>
        <p style="font-size:12px; color:var(--text-sec); margin-bottom:14px">
          Exclusão confirmada. Sua assinatura não vai renovar — o acesso continua até o fim do período atual, e depois disso a conta entra na carência de exclusão. Mudou de ideia? Ainda dá pra cancelar e manter a assinatura normalmente, sem cobrança extra.
        </p>
        <button class="btn btn-secondary btn-block" onclick="cancelarSolicitacaoExclusao()">Cancelar exclusão da conta</button>
      </div>`;
  } else {
    zonaRiscoHtml = `
      <div class="card" style="margin-bottom:0; border-color:var(--danger-border)">
        <div class="card-title"><span style="color:var(--danger)">Zona de risco</span></div>
        <p style="font-size:12px; color:var(--text-sec); margin-bottom:14px">
          Excluir a conta cancela a assinatura e apaga definitivamente todos os dados da empresa — fornecedores, documentos, avaliações e usuários. Você recebe um e-mail de confirmação antes de qualquer coisa acontecer, nada é feito sem você confirmar pelo link.
        </p>
        <button class="btn btn-secondary btn-block" style="color:var(--danger); border-color:var(--danger-border)" onclick="abrirSolicitarExclusaoConta()">Excluir minha conta</button>
      </div>`;
  }

  document.getElementById('ad-page-config').innerHTML = `
    <div class="page-header"><div><h2>Configurações</h2><p>Matriz de qualificação, layout dos documentos e dados da empresa</p></div></div>

    <div class="config-tab-bar">
      <button class="config-tab-btn active" onclick="showConfigTabAd('matriz', this)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 17H5"/><path d="M19 7h-9"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>
        Matriz de qualificação
      </button>
      <button class="config-tab-btn" onclick="showConfigTabAd('layout', this)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="7" x="3" y="3" rx="1"/><rect width="9" height="7" x="3" y="14" rx="1"/><rect width="5" height="7" x="16" y="14" rx="1"/></svg>
        Layout e textos
      </button>
      <button class="config-tab-btn" onclick="showConfigTabAd('camposfor', this)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/></svg>
        Campos do fornecedor
      </button>
      <button class="config-tab-btn" onclick="showConfigTabAd('tiposdoc', this)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
        Tipos de documento
      </button>
      <button class="config-tab-btn" onclick="showConfigTabAd('cobranca', this)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg>
        Cobrança automática
      </button>
      <button class="config-tab-btn" onclick="showConfigTabAd('empresa', this)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 12h4"/><path d="M10 8h4"/><path d="M14 21v-3a2 2 0 0 0-4 0v3"/><path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"/><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/></svg>
        Minha empresa
      </button>
      <button class="config-tab-btn" onclick="showConfigTabAd('retencao', this)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>
        Retenção de dados
      </button>
    </div>

    <div id="config-tab-matriz" class="config-tab-ad">
      <div class="card">
        <div class="card-title">Faixas de pontuação</div>
        <p style="font-size:12px; color:var(--text-muted); margin-bottom:16px">Cada faixa exige que a nota atenda ou supere o valor mínimo definido. Desmarque "Usar" pra não usar uma faixa — ela é pulada no cálculo, sem precisar igualar os números.</p>
        <div class="matrix-rows">
          <div class="matrix-row" style="${d.matriz.usarCert === false ? 'opacity:.5' : ''}">
            <div class="status-icon amber">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/></svg>
            </div>
            <div class="matrix-row-body">
              <div class="matrix-row-title">Certificado</div>
              <div class="matrix-row-sub">Nota exata mínima</div>
            </div>
            <label style="display:flex; align-items:center; gap:5px; font-size:11px; color:var(--text-muted); white-space:nowrap; margin-right:10px">
              <input type="checkbox" id="usar-cert" ${d.matriz.usarCert !== false ? 'checked' : ''} onchange="toggleFaixaMatriz('cert', this.checked)"> Usar
            </label>
            <div class="matrix-row-input">
              <input type="number" id="corte-cert" step="0.1" value="${d.matriz.cert}" ${d.matriz.usarCert === false ? 'disabled' : ''}>
              <span>/ 10</span>
            </div>
          </div>
          <div class="matrix-row" style="${d.matriz.usarAprov === false ? 'opacity:.5' : ''}">
            <div class="status-icon green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
            </div>
            <div class="matrix-row-body">
              <div class="matrix-row-title">Aprovado</div>
              <div class="matrix-row-sub">Nota mínima</div>
            </div>
            <label style="display:flex; align-items:center; gap:5px; font-size:11px; color:var(--text-muted); white-space:nowrap; margin-right:10px">
              <input type="checkbox" id="usar-aprov" ${d.matriz.usarAprov !== false ? 'checked' : ''} onchange="toggleFaixaMatriz('aprov', this.checked)"> Usar
            </label>
            <div class="matrix-row-input">
              <input type="number" id="corte-aprov" step="0.1" value="${d.matriz.aprov}" ${d.matriz.usarAprov === false ? 'disabled' : ''}>
              <span>/ 10</span>
            </div>
          </div>
          <div class="matrix-row" style="${d.matriz.usarParcial === false ? 'opacity:.5' : ''}">
            <div class="status-icon amber">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            </div>
            <div class="matrix-row-body">
              <div class="matrix-row-title">Parcialmente aprovado</div>
              <div class="matrix-row-sub">Nota mínima</div>
            </div>
            <label style="display:flex; align-items:center; gap:5px; font-size:11px; color:var(--text-muted); white-space:nowrap; margin-right:10px">
              <input type="checkbox" id="usar-parcial" ${d.matriz.usarParcial !== false ? 'checked' : ''} onchange="toggleFaixaMatriz('parcial', this.checked)"> Usar
            </label>
            <div class="matrix-row-input">
              <input type="number" id="corte-parcial" step="0.1" value="${d.matriz.parcial}" ${d.matriz.usarParcial === false ? 'disabled' : ''}>
              <span>/ 10</span>
            </div>
          </div>
          <div class="matrix-row">
            <div class="status-icon rose">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
            </div>
            <div class="matrix-row-body">
              <div class="matrix-row-title">Reprovado</div>
              <div class="matrix-row-sub">Abaixo da última faixa ativa acima — exige indicação obrigatória de melhoria pelo avaliador.</div>
            </div>
            <span class="badge-auto">Automático — sempre existe</span>
          </div>
        </div>
        <button class="btn btn-primary" onclick="salvarMatriz()">Salvar matriz</button>
      </div>
    </div>

    <div id="config-tab-layout" class="config-tab-ad" style="display:none">
      <div class="card">
        <div class="card-title">Posição dos textos no documento</div>
        <p style="font-size:12px; color:var(--text-muted); margin-bottom:6px">Arraste os blocos na pré-visualização para reposicionar, ou digite as coordenadas exatas (em mm) na tabela ao lado.</p>
        <div class="tab-bar">
          <button class="tab active" onclick="showLayoutSubtab('cert', this)">Certificado (paisagem · nota 10)</button>
          <button class="tab" onclick="showLayoutSubtab('carta', this)">Carta (retrato · demais notas)</button>
        </div>
        <div id="layout-editor-cert" class="layout-editor-wrap"></div>
        <div id="layout-editor-carta" class="layout-editor-wrap" style="display:none"></div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px">
        <div class="card" style="margin-bottom:0">
          <div class="card-title">Imagem de fundo — Certificado (paisagem A4)</div>
          <p style="font-size:12px; color:var(--text-muted); margin-bottom:14px">Faça upload de uma imagem (PNG ou JPG) para usar como fundo do certificado de aprovação. O sistema sobrepõe o texto automaticamente. Tamanho ideal: 3508 × 2480 px.</p>
          <div id="fundo-cert-preview" style="margin-bottom:12px"></div>
          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap">
            <button class="btn btn-secondary" onclick="document.getElementById('upload-fundo-cert').click()" style="display:inline-flex; align-items:center; gap:6px">${ic('paperclip', 13)}Selecionar imagem</button>
            <button class="btn btn-danger btn-sm" onclick="removerFundo('ap_fundo_certificado', 'fundo-cert-preview')">Remover fundo</button>
          </div>
          <input type="file" id="upload-fundo-cert" accept="image/*" style="display:none" onchange="uploadFundo('ap_fundo_certificado', this, 'fundo-cert-preview')">
        </div>
        <div class="card" style="margin-bottom:0">
          <div class="card-title">Imagem de fundo — Cartas (retrato A4)</div>
          <p style="font-size:12px; color:var(--text-muted); margin-bottom:14px">Fundo usado nas cartas de aprovação, parcial e reprovação. Tamanho ideal: 2480 × 3508 px.</p>
          <div id="fundo-carta-preview" style="margin-bottom:12px"></div>
          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap">
            <button class="btn btn-secondary" onclick="document.getElementById('upload-fundo-carta').click()" style="display:inline-flex; align-items:center; gap:6px">${ic('paperclip', 13)}Selecionar imagem</button>
            <button class="btn btn-danger btn-sm" onclick="removerFundo('ap_fundo_carta', 'fundo-carta-preview')">Remover fundo</button>
          </div>
          <input type="file" id="upload-fundo-carta" accept="image/*" style="display:none" onchange="uploadFundo('ap_fundo_carta', this, 'fundo-carta-preview')">
        </div>
      </div>
      <div class="card">
        <div class="card-title">Fontes personalizadas</div>
        <p style="font-size:12px; color:var(--text-muted); margin-bottom:14px">Além das 3 fontes padrão (Helvetica, Times, Courier), você pode importar qualquer fonte no formato <b>.ttf</b>. Pra ter negrito/itálico de verdade nos PDFs, importe um <b>.zip</b> com os pesos da família (ex: <code>Regular.ttf</code>, <code>Bold.ttf</code>, <code>Italic.ttf</code>, <code>BoldItalic.ttf</code>) — o sistema detecta sozinho qual arquivo é qual pelo nome. Se importar só um <code>.ttf</code>, negrito/itálico usam o mesmo desenho da fonte regular.</p>
        <p id="fontes-custom-contador" style="font-size:11.5px; font-weight:600; color:var(--text-sec); margin-bottom:10px">0/8 fontes importadas</p>
        <div style="display:flex; gap:10px; align-items:end; flex-wrap:wrap; margin-bottom:14px">
          <div class="form-group" style="margin:0"><label>Nome da fonte</label><input type="text" id="fonte-custom-nome" placeholder="Ex: Montserrat" style="width:220px"></div>
          <input type="file" id="fonte-custom-arquivo" accept=".ttf,.zip" style="max-width:260px">
          <button id="fonte-custom-btn-add" class="btn btn-primary" onclick="adicionarFontePersonalizada()">+ Importar fonte</button>
        </div>
        <div id="fontes-custom-lista"></div>
      </div>
    </div>

    <div id="config-tab-camposfor" class="config-tab-ad" style="display:none">
      <div class="card">
        <div class="card-title">Campos do fornecedor</div>
        <p style="font-size:12px; color:var(--text-muted); margin-bottom:16px">Além de nome, tipo, setor, e-mail, CNPJ e criticidade, adicione campos personalizados que aparecem automaticamente no cadastro.</p>

        <div class="subcard">
          <div class="subcard-title">Novo campo personalizado</div>
          <div id="campos-fornecedor-lista"></div>
          <div class="subcard-divider"></div>
          <div class="form-row three">
            <div class="form-group"><label>Chave (sem espaço/acento)</label><input type="text" id="ncf-chave" placeholder="ex: categoria"></div>
            <div class="form-group"><label>Rótulo (exibido)</label><input type="text" id="ncf-label" placeholder="ex: Categoria"></div>
            <div class="form-group"><label>Tipo de campo</label>
              <select id="ncf-tipo" onchange="document.getElementById('ncf-opcoes-wrap').style.display = this.value === 'select' ? 'flex' : 'none'">
                <option value="texto">Texto</option>
                <option value="select">Lista (opções)</option>
                <option value="data">Data</option>
              </select>
            </div>
          </div>
          <div class="form-group" id="ncf-opcoes-wrap" style="display:none; margin-bottom:14px">
            <label>Opções (separadas por vírgula)</label>
            <input type="text" id="ncf-opcoes" placeholder="ex: Nacional, Importado, Local">
          </div>
          <button class="btn btn-primary" onclick="addCampoFornecedorCustom()">+ Adicionar campo</button>
        </div>
      </div>
    </div>

    <div id="config-tab-tiposdoc" class="config-tab-ad" style="display:none">
      <div class="card">
        <div class="card-title">Tipos de documento</div>
        <p style="font-size:12px; color:var(--text-muted); margin-bottom:14px">Cadastre os tipos de documento mais usados (ex: Alvará de Funcionamento, CRT, Contrato). Eles aparecem como sugestão ao arquivar um documento de fornecedor — você ainda pode digitar um nome diferente se precisar.</p>
        <div id="tipos-documento-lista" style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:18px"></div>
        <div class="form-row" style="grid-template-columns:1fr auto">
          <div class="form-group"><label>Novo tipo de documento</label><input type="text" id="ntd-nome" placeholder="ex: Licença Ambiental" onkeydown="if(event.key==='Enter'){event.preventDefault(); addTipoDocumento();}"></div>
          <button class="btn btn-primary" style="align-self:flex-end; height:38px" onclick="addTipoDocumento()">Adicionar</button>
        </div>
      </div>
    </div>

    <div id="config-tab-cobranca" class="config-tab-ad" style="display:none">
      <div class="card">
        <div class="card-title">Cobrança automática de documentos</div>
        <p style="font-size:12px; color:var(--text-muted); margin-bottom:16px">Quando ligado, o sistema manda sozinho o e-mail de "documento vencendo/vencido" pro fornecedor, sem você precisar clicar em nada. Só vale pra documentos de <b>Fornecedores</b> com e-mail cadastrado (não se aplica a Meus Documentos, que não tem destinatário).</p>

        <div class="form-row" style="grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; align-items:end; margin-bottom:16px">
          <div>
            <label style="display:block; font-size:12px; font-weight:600; margin-bottom:8px">Ativar cobrança automática</label>
            <label class="switch">
              <input type="checkbox" id="cfg-cobranca-ativa" ${d.cobrancaAutomaticaAtiva ? 'checked' : ''}>
              <span class="switch-slider"></span>
            </label>
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label>Frequência do aviso</label>
            <select id="cfg-cobranca-frequencia">
              <option value="chave" ${d.cobrancaAutomaticaFrequencia === 'chave' ? 'selected' : ''}>Só 2x — janela de aviso e vencimento</option>
              <option value="2dias" ${d.cobrancaAutomaticaFrequencia === '2dias' ? 'selected' : ''}>A cada 2 dias</option>
              <option value="semanal" ${d.cobrancaAutomaticaFrequencia === 'semanal' ? 'selected' : ''}>1x por semana</option>
              <option value="diaria" ${d.cobrancaAutomaticaFrequencia === 'diaria' ? 'selected' : ''}>Todo dia</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label>Tolerância de vencido (meses)</label>
            <input type="number" id="cfg-cobranca-tolerancia" min="1" step="1" value="${d.toleranciaDocumentosMeses}">
          </div>
        </div>
        <p style="font-size:11px; color:var(--text-muted); margin:-8px 0 16px">Se um documento continuar vencido por mais tempo que a tolerância, mesmo já cobrado do fornecedor, você recebe um aviso à parte (e-mail + alerta no dashboard) — não bloqueia nada, é só um alerta de atenção.</p>

        <button class="btn btn-primary" onclick="salvarConfigCobrancaAutomatica()">Salvar</button>
      </div>

      <div class="card">
        <div class="card-title">Lembrete automático pros avaliadores</div>
        <p style="font-size:12px; color:var(--text-muted); margin-bottom:16px">Manda e-mail sozinho pro avaliador quando ele tem avaliação pendente/atrasada, com o link de acesso. Independente disso, você sempre pode disparar manualmente em Usuários e acessos → "Enviar lembrete pra todos os pendentes".</p>

        <div class="toggle-row">
          <div class="toggle-row-body">
            <div class="toggle-row-title">Ativar lembrete automático pros avaliadores</div>
            <div class="toggle-row-sub">Manda e-mail ao avaliador com o link de acesso quando ele tem avaliação pendente ou atrasada.</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="cfg-lembrete-ativo" ${d.lembreteAvaliadorAtivo ? 'checked' : ''}>
            <span class="switch-slider"></span>
          </label>
        </div>

        <div class="form-group" style="max-width:360px; margin-bottom:16px">
          <label>Frequência do lembrete</label>
          <select id="cfg-lembrete-frequencia">
            <option value="chave" ${d.lembreteAvaliadorFrequencia === 'chave' ? 'selected' : ''}>Só 2x — ao ficar pendente e ao atrasar</option>
            <option value="2dias" ${d.lembreteAvaliadorFrequencia === '2dias' ? 'selected' : ''}>A cada 2 dias, enquanto estiver pendente</option>
            <option value="semanal" ${d.lembreteAvaliadorFrequencia === 'semanal' ? 'selected' : ''}>1x por semana, enquanto estiver pendente</option>
            <option value="diaria" ${d.lembreteAvaliadorFrequencia === 'diaria' ? 'selected' : ''}>Todo dia, enquanto estiver pendente</option>
          </select>
        </div>

        <button class="btn btn-primary" onclick="salvarConfigLembreteAvaliador()">Salvar</button>
      </div>

      <div class="card">
        <div class="card-title">Período avaliado</div>
        <p style="font-size:12px; color:var(--text-muted); margin-bottom:16px">Se a avaliação do mês é sempre referente ao serviço prestado no(s) mês(es) anterior(es) — por exemplo, avaliar em Agosto o serviço prestado em Julho — informe aqui quantos meses de defasagem. Isso aparece pro avaliador na hora de preencher e no e-mail que o fornecedor recebe. Deixe 0 (ou em branco) se a avaliação é sempre do mesmo mês corrente — nesse caso nada extra é mostrado.</p>

        <div class="form-group" style="max-width:320px; margin-bottom:16px">
          <label>Meses antes</label>
          <div style="display:flex; align-items:center; gap:8px">
            <input type="number" id="cfg-periodo-avaliado-meses" min="0" max="12" step="1" value="${d.periodoAvaliadoMesesAntes || 0}" style="max-width:100px">
            <span style="font-size:13px; color:var(--text-muted)">mês(es)</span>
          </div>
        </div>

        <button class="btn btn-primary" onclick="salvarConfigPeriodoAvaliado()">Salvar</button>
      </div>

      <div class="card">
        <div class="card-title">Notificação automática de avaliação reprovada</div>
        <p style="font-size:12px; color:var(--text-muted); margin-bottom:16px">Controla como o fornecedor é avisado quando uma avaliação de serviço é reprovada ou aprovada com ressalva. O botão manual (que abre seu cliente de e-mail) continua disponível em qualquer modo.</p>

        <div class="form-row" style="grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:16px; align-items:start; margin-bottom:16px">
          <div class="form-group" style="margin-bottom:0">
            <label>Modo de envio</label>
            <select id="cfg-notif-avaliacao-modo" onchange="document.getElementById('cfg-notif-avaliacao-intervalo-wrap').style.display = this.value === 'automatico' ? 'block' : 'none'">
              <option value="desligado" ${d.notifAvaliacaoModo === 'desligado' ? 'selected' : ''}>Desligado</option>
              <option value="automatico" ${d.notifAvaliacaoModo === 'automatico' ? 'selected' : ''}>Automático</option>
              <option value="aprovacao" ${d.notifAvaliacaoModo === 'aprovacao' ? 'selected' : ''}>Por aprovação</option>
            </select>
          </div>

          <div id="cfg-notif-avaliacao-intervalo-wrap" class="form-group" style="margin-bottom:0; display:${d.notifAvaliacaoModo === 'automatico' ? 'block' : 'none'}">
            <label>Enviar depois de</label>
            <select id="cfg-notif-avaliacao-intervalo">
              <option value="0" ${d.notifAvaliacaoIntervaloHoras === 0 ? 'selected' : ''}>No momento</option>
              <option value="24" ${d.notifAvaliacaoIntervaloHoras === 24 ? 'selected' : ''}>24 horas após a avaliação</option>
              <option value="48" ${d.notifAvaliacaoIntervaloHoras === 48 ? 'selected' : ''}>48 horas após a avaliação</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom:0">
            <label>Notificar quando a avaliação for</label>
            <div style="display:flex; flex-direction:column; gap:8px; margin-top:6px">
              <label style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:400; cursor:pointer">
                <input type="checkbox" id="cfg-notif-sit-reprovado" ${(d.notifAvaliacaoSituacoes || ['reprovado']).includes('reprovado') ? 'checked' : ''}> Reprovada
              </label>
              <label style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:400; cursor:pointer">
                <input type="checkbox" id="cfg-notif-sit-parcial" ${(d.notifAvaliacaoSituacoes || []).includes('parcial') ? 'checked' : ''}> Parcialmente aprovada
              </label>
            </div>
          </div>
        </div>

        <button class="btn btn-primary" onclick="salvarConfigNotifAvaliacao()">Salvar</button>
      </div>

      <div class="card">
        <div class="card-title">Receber notificações de atualizações por e-mail</div>
        <p style="font-size:12px; color:var(--text-muted); margin-bottom:16px">Quando ligado, os admins marcados como "recebe notificação" (em Usuários e acessos) recebem um e-mail na hora — sem esperar cron — assim que um fornecedor envia um documento pra aprovação, ou assim que um avaliador conclui uma avaliação de serviço.</p>

        <div class="toggle-row">
          <div class="toggle-row-body">
            <div class="toggle-row-title">Ativar notificações de atualizações por e-mail</div>
            <div class="toggle-row-sub">Documento enviado pelo fornecedor ou avaliação concluída avisam os admins marcados na hora.</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="cfg-notif-atividade-ativo" ${d.notificarAtividadeAtivo ? 'checked' : ''}>
            <span class="switch-slider"></span>
          </label>
        </div>

        <button class="btn btn-primary" onclick="salvarConfigNotificacaoAtividade()">Salvar</button>
      </div>

    </div>

    <div id="config-tab-empresa" class="config-tab-ad" style="display:none">
      <div class="account-cards">

        <div class="card" style="margin-bottom:0">
          <div class="card-title">
            <span class="card-title-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 12h4"/><path d="M10 8h4"/><path d="M14 21v-3a2 2 0 0 0-4 0v3"/><path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"/><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/></svg>
              Dados cadastrais
            </span>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Nome da empresa</label><input type="text" id="emp-nome" value="${escapeHtml(d.nomeEmpresa || d.empresa.nome || '')}" disabled title="Definido no cadastro — pra alterar, fale com o suporte."></div>
            <div class="form-group"><label>Cidade/UF</label><input type="text" id="emp-cidade" value="${d.empresa.cidade||''}"></div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Setor <span style="color:var(--text-muted); font-weight:400">(assina os e-mails automáticos no lugar de um nome de pessoa)</span></label>
              <input type="text" id="emp-setor" placeholder="Ex: Compras e Almoxarifado" value="${d.setorEmpresa || ''}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Endereço</label><input type="text" id="emp-endereco" value="${d.empresa.endereco||''}"></div>
            <div class="form-group"><label>CEP</label><input type="text" id="emp-cep" value="${d.empresa.cep||''}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Telefone</label><input type="text" id="emp-tel" value="${d.empresa.tel||''}"></div>
            <div class="form-group"><label>E-mail</label><input type="text" id="emp-email" value="${d.empresa.email||''}"></div>
          </div>
          <button class="btn btn-primary" onclick="salvarEmpresaAd()">Salvar dados</button>
        </div>

        <div class="card" style="margin-bottom:0">
          <div class="card-title">
            <span style="display:flex; align-items:center; gap:8px">
              <span class="card-title-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
                Assinatura
              </span>
              ${planoTagHtml}
            </span>
            <span class="plan-badge ${badgeClasse}">${badgeTexto}</span>
          </div>

          ${trialBannerHtml}

          ${usageRowHtml(iconFornecedores, 'Fornecedores cadastrados', totalFornecedores, d.limiteFornecedores)}
          ${usageRowHtml(iconAdmins, 'Admins ativos', totalAdmins, d.limiteAdmins)}

          ${upgradeCardsHtml}
          <p style="font-size:11px; color:var(--text-muted); margin-top:14px">Enterprise é negociado diretamente — fale com a gente em <a href="mailto:contato@homologpro.com.br" style="color:var(--accent)">contato@homologpro.com.br</a>.</p>
        </div>

        ${zonaRiscoHtml}

      </div>
    </div>

    <div id="config-tab-retencao" class="config-tab-ad" style="display:none">
      <div class="card">
        <div class="card-title">Retenção de avaliações de serviço</div>
        <p style="font-size:12px; color:var(--text-muted); margin-bottom:14px">Desligado por padrão — nada é sinalizado pra exclusão até você definir um prazo. Depois de configurado, avaliações mais antigas que esse prazo aparecem em "Avaliações → Retenção" pra você revisar e decidir (nada é apagado sozinho).</p>
        <div class="form-row">
          <div class="form-group">
            <label>Guardar avaliações por quantos anos?</label>
            <input type="number" id="cfg-anos-retencao" min="1" step="1" value="${d.anosRetencaoAvaliacao || ''}" placeholder="Deixe em branco para desligar">
          </div>
        </div>
        <button class="btn btn-primary" onclick="salvarRetencaoAvaliacao()">Salvar</button>
      </div>

      <div class="card">
        <div class="card-title">Lixeira</div>
        <p style="font-size:12px; color:var(--text-muted); margin-bottom:16px">Fornecedores e documentos excluídos ficam aqui por 90 dias antes de serem apagados de vez — dá pra restaurar a qualquer momento nesse período.</p>
        <button class="btn btn-secondary" onclick="abrirLixeira()">Ver Lixeira</button>
      </div>
    </div>
  `;
}

function showConfigTabAd(tab, btn) {
  document.querySelectorAll('.config-tab-ad').forEach(el => el.style.display = 'none');
  document.querySelectorAll('#ad-page-config .config-tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('config-tab-' + tab).style.display = 'block';
  btn.classList.add('active');
}

async function salvarConfigCobrancaAutomatica() {
  const ativa = document.getElementById('cfg-cobranca-ativa').checked;
  const frequencia = document.getElementById('cfg-cobranca-frequencia').value;
  const tolerancia = parseInt(document.getElementById('cfg-cobranca-tolerancia').value, 10) || 6;

  const { error } = await supabaseClient.from('empresas').update({
    cobranca_automatica_ativa: ativa,
    cobranca_automatica_frequencia: frequencia,
    tolerancia_documentos_meses: tolerancia,
  }).eq('id', currentUser.empresaId);

  if (error) { toast('Erro ao salvar: ' + error.message); return; }

  empresaConfigCache.cobranca_automatica_ativa = ativa;
  empresaConfigCache.cobranca_automatica_frequencia = frequencia;
  empresaConfigCache.tolerancia_documentos_meses = tolerancia;
  addLog('config_cobranca_automatica', `${currentUser.email} ${ativa ? 'ativou' : 'desativou'} a cobrança automática (frequência: ${frequencia}, tolerância: ${tolerancia} meses)`);
  toast('Configuração salva!');
}

async function assinarPlano(plano) {
  toast('Processando...');
  const { data, error } = await supabaseClient.functions.invoke('criar-checkout-sessao', { body: { plano } });

  if (error || !data || data.ok === false) {
    toast((data && data.error) || 'Não foi possível processar agora.');
    return;
  }

  // Já tinha assinatura ativa: a troca já foi aplicada direto (com rateio),
  // sem precisar sair da tela.
  if (data.trocaImediata) {
    toast(data.mensagem || 'Plano trocado com sucesso!');
    await carregarEmpresaConfig();
    renderAdConfig();
    return;
  }

  if (!data.url) { toast('Checkout ainda não configurado no servidor.'); return; }
  window.location.href = data.url;
}

// Só admin_master chama isso (o botão nem aparece pra admin comum, e o
// front confere de novo aqui — a Edge Function também confere no servidor).
function abrirCancelarAssinatura() {
  if (currentUser.papel !== 'admin_master') return;
  openModal(`
    <h3>Cancelar assinatura</h3>
    <p style="font-size:12px; color:var(--text-muted); margin-bottom:14px">
      Isso desliga a renovação automática. O acesso ao plano atual continua valendo até o fim do período já pago — depois disso a conta cai pra bloqueada.
      Pra confirmar, digite sua senha.
    </p>
    <div class="form-group">
      <label>Sua senha</label>
      <input type="password" id="cancel-assinatura-senha" placeholder="••••••••">
    </div>
    <div style="display:flex; gap:8px; margin-top:10px">
      <button class="btn btn-danger btn-block" onclick="confirmarCancelamentoAssinatura()">Confirmar cancelamento</button>
      <button class="btn btn-secondary" onclick="closeModal()">Voltar</button>
    </div>
  `);
}

async function confirmarCancelamentoAssinatura() {
  const senha = document.getElementById('cancel-assinatura-senha').value;
  if (!senha) { toast('Digite sua senha pra confirmar.'); return; }

  // reautentica com a própria senha antes de deixar cancelar qualquer coisa
  const { error: erroSenha } = await supabaseClient.auth.signInWithPassword({ email: currentUser.email, password: senha });
  if (erroSenha) { toast('Senha incorreta.'); return; }

  toast('Cancelando assinatura...');
  const { data, error } = await supabaseClient.functions.invoke('cancelar-assinatura', { body: {} });

  if (error || (data && data.ok === false)) {
    toast((data && data.error) || 'Não foi possível cancelar agora. Tenta de novo em instantes.');
    return;
  }

  closeModal();
  addLog('assinatura_cancelada', `${currentUser.email} cancelou a assinatura da empresa`);
  toast('Assinatura cancelada. O acesso continua até o fim do período já pago.');
  await carregarEmpresaConfig();
  renderAdConfig();
}

// Reaproveita o mesmo padrão do cancelamento acima: reautentica com senha
// antes de qualquer ação destrutiva, e o botão só aparece pra admin_master
// (front confere, e a Edge Function confere de novo no servidor).
function abrirSolicitarExclusaoConta() {
  if (currentUser.papel !== 'admin_master') return;
  openModal(`
    <h3>Excluir minha conta</h3>
    <p style="font-size:12px; color:var(--text-muted); margin-bottom:14px">
      Isso desliga a renovação automática e inicia a exclusão da conta. Seu acesso continua normal até o fim do período já pago — você não perde os dias pagos.
      Você vai receber um e-mail de confirmação — nada acontece até você confirmar pelo link. Depois que o período atual acabar, os dados são apagados em 15 dias (dá pra cancelar antes disso).
      Pra prosseguir, digite sua senha.
    </p>
    <div class="form-group">
      <label>Sua senha</label>
      <input type="password" id="excluir-conta-senha" placeholder="••••••••">
    </div>
    <div style="display:flex; gap:8px; margin-top:10px">
      <button class="btn btn-danger btn-block" onclick="confirmarSolicitarExclusaoConta()">Enviar e-mail de confirmação</button>
      <button class="btn btn-secondary" onclick="closeModal()">Voltar</button>
    </div>
  `);
}

async function confirmarSolicitarExclusaoConta() {
  const senha = document.getElementById('excluir-conta-senha').value;
  if (!senha) { toast('Digite sua senha pra confirmar.'); return; }

  const { error: erroSenha } = await supabaseClient.auth.signInWithPassword({ email: currentUser.email, password: senha });
  if (erroSenha) { toast('Senha incorreta.'); return; }

  toast('Enviando e-mail de confirmação...');
  const { data, error } = await supabaseClient.functions.invoke('solicitar-exclusao-conta', { body: {} });

  if (error || (data && data.ok === false)) {
    toast((data && data.error) || 'Não foi possível processar agora. Tenta de novo em instantes.');
    return;
  }

  closeModal();
  addLog('exclusao_conta_solicitada', `${currentUser.email} solicitou a exclusão da conta. E-mail de confirmação enviado.`);
  toast('E-mail de confirmação enviado! A exclusão só acontece depois que você confirmar pelo link.');
}

// Chamada tanto durante a espera do fim do período pago quanto durante a
// carência de 15 dias (status 'exclusao_agendada'). A Edge Function decide
// qual dos dois cenários é: se ainda não passou o período pago, reativa a
// assinatura de verdade; se já passou, só impede o apagamento dos dados.
async function cancelarSolicitacaoExclusao() {
  if (!confirm('Cancelar a exclusão da conta?')) return;

  toast('Cancelando solicitação...');
  const { data, error } = await supabaseClient.functions.invoke('cancelar-solicitacao-exclusao', { body: {} });

  if (error || (data && data.ok === false)) {
    toast((data && data.error) || 'Não foi possível cancelar agora.');
    return;
  }

  addLog('exclusao_conta_cancelada', `${currentUser.email} cancelou a solicitação de exclusão da conta.`);
  toast(data.reativado
    ? 'Exclusão cancelada — sua assinatura foi reativada normalmente, sem cobrança extra.'
    : 'Exclusão cancelada. Sua assinatura já tinha encerrado — assine de novo quando quiser reativar o acesso.');
  await carregarEmpresaConfig();
  renderAdConfig();
}

async function salvarConfigLembreteAvaliador() {
  const ativo = document.getElementById('cfg-lembrete-ativo').checked;
  const frequencia = document.getElementById('cfg-lembrete-frequencia').value;

  const { error } = await supabaseClient.from('empresas').update({
    lembrete_avaliador_ativo: ativo,
    lembrete_avaliador_frequencia: frequencia,
  }).eq('id', currentUser.empresaId);

  if (error) { toast('Erro ao salvar: ' + error.message); return; }

  empresaConfigCache.lembrete_avaliador_ativo = ativo;
  empresaConfigCache.lembrete_avaliador_frequencia = frequencia;
  addLog('config_lembrete_avaliador', `${currentUser.email} ${ativo ? 'ativou' : 'desativou'} o lembrete automático dos avaliadores (frequência: ${frequencia})`);
  toast('Configuração salva!');
}

async function salvarConfigPeriodoAvaliado() {
  const meses = parseInt(document.getElementById('cfg-periodo-avaliado-meses').value, 10) || 0;

  const { error } = await supabaseClient.from('empresas').update({
    periodo_avaliado_meses_antes: meses,
  }).eq('id', currentUser.empresaId);

  if (error) { toast('Erro ao salvar: ' + error.message); return; }

  empresaConfigCache.periodo_avaliado_meses_antes = meses;
  addLog('config_periodo_avaliado', `${currentUser.email} mudou o período avaliado para ${meses} mês(es) antes`);
  toast('Configuração salva!');
}

async function salvarConfigNotifAvaliacao() {
  const modo = document.getElementById('cfg-notif-avaliacao-modo').value;
  const intervalo = parseInt(document.getElementById('cfg-notif-avaliacao-intervalo').value, 10);
  const situacoes = [];
  if (document.getElementById('cfg-notif-sit-reprovado').checked) situacoes.push('reprovado');
  if (document.getElementById('cfg-notif-sit-parcial').checked) situacoes.push('parcial');

  const { error } = await supabaseClient.from('empresas').update({
    notif_avaliacao_modo: modo,
    notif_avaliacao_intervalo_horas: Number.isFinite(intervalo) ? intervalo : 24,
    notif_avaliacao_situacoes: situacoes,
  }).eq('id', currentUser.empresaId);

  if (error) { toast('Erro ao salvar: ' + error.message); return; }

  empresaConfigCache.notif_avaliacao_modo = modo;
  empresaConfigCache.notif_avaliacao_intervalo_horas = intervalo;
  empresaConfigCache.notif_avaliacao_situacoes = situacoes;
  addLog('config_notif_avaliacao', `${currentUser.email} mudou o modo de notificação automática de avaliação para "${modo}"${modo === 'automatico' ? ` (${intervalo}h)` : ''} — situações: ${situacoes.join(', ') || 'nenhuma'}`);
  toast('Configuração salva!');
}

async function salvarConfigNotificacaoAtividade() {
  const ativo = document.getElementById('cfg-notif-atividade-ativo').checked;

  const { error } = await supabaseClient.from('empresas').update({
    notificar_atividade_ativo: ativo,
  }).eq('id', currentUser.empresaId);

  if (error) { toast('Erro ao salvar: ' + error.message); return; }

  empresaConfigCache.notificar_atividade_ativo = ativo;
  addLog('config_notificacao_atividade', `${currentUser.email} ${ativo ? 'ativou' : 'desativou'} a notificação de atualizações por e-mail`);
  toast('Configuração salva!');
}

// ============ LIXEIRA (soft delete de documentos/fornecedores) ============
function diasRestantesLixeira(excluidoEm) {
  const dataLimite = new Date(excluidoEm);
  dataLimite.setDate(dataLimite.getDate() + 90);
  const dias = Math.ceil((dataLimite.getTime() - Date.now()) / 86400000);
  return Math.max(0, dias);
}

async function abrirLixeira() {
  openModal(`<h3 style="display:flex; align-items:center; gap:7px">${ic('trash', 16)} Lixeira</h3><div id="lixeira-conteudo" style="margin-top:12px"><p class="sub">Carregando...</p></div>`);
  await renderLixeira();
}

async function renderLixeira() {
  const empresaId = currentUser.empresaId;

  const [fornecedoresRes, documentosRes, unidadesDocsRes] = await Promise.all([
    supabaseClient.from('fornecedores').select('id, nome, excluido_em').eq('empresa_id', empresaId).not('excluido_em', 'is', null),
    supabaseClient.from('documentos').select('id, nome:tipo_documento, excluido_em').eq('empresa_id', empresaId).not('excluido_em', 'is', null),
    supabaseClient.from('unidades_documentos').select('id, nome:tipo_documento, excluido_em').eq('empresa_id', empresaId).not('excluido_em', 'is', null),
  ]);

  const itens = [
    ...((fornecedoresRes.data || []).map(x => ({ ...x, tipo: 'fornecedor', tabela: 'fornecedores', label: 'Fornecedor' }))),
    ...((documentosRes.data || []).map(x => ({ ...x, tipo: 'documento', tabela: 'documentos', label: 'Documento (fornecedor)' }))),
    ...((unidadesDocsRes.data || []).map(x => ({ ...x, tipo: 'unidade_documento', tabela: 'unidades_documentos', label: 'Documento (Meus Documentos)' }))),
  ].sort((a, b) => new Date(b.excluido_em) - new Date(a.excluido_em));

  const wrap = document.getElementById('lixeira-conteudo');
  if (!wrap) return;

  if (!itens.length) {
    wrap.innerHTML = '<div class="empty-state"><p>Lixeira vazia.</p></div>';
    return;
  }

  wrap.innerHTML = `
    <div style="max-height:420px; overflow-y:auto">
      ${itens.map(item => `
        <div style="display:flex; align-items:center; gap:8px; padding:8px 0; border-bottom:1px solid var(--border); font-size:13px">
          <div style="flex:1">
            <b>${item.nome}</b>
            <div style="font-size:11px; color:var(--text-muted)">${item.label} · excluído em ${new Date(item.excluido_em).toLocaleDateString('pt-BR')} · ${diasRestantesLixeira(item.excluido_em)} dia(s) até apagar de vez</div>
          </div>
          <button class="btn btn-secondary btn-sm" style="display:inline-flex; align-items:center; gap:5px" onclick="restaurarDaLixeira('${item.tabela}', '${item.id}')">${ic('rotateCcw', 13)} Restaurar</button>
        </div>
      `).join('')}
    </div>
  `;
}

async function restaurarDaLixeira(tabela, id) {
  const { error } = await supabaseClient.from(tabela).update({ excluido_em: null }).eq('id', id);
  if (error) { toast('Erro ao restaurar: ' + error.message); return; }

  addLog('restaurado_da_lixeira', `${currentUser.email} restaurou um item da lixeira (${tabela})`);
  toast('Restaurado!');

  if (tabela === 'fornecedores') await carregarFornecedores();
  if (tabela === 'documentos') await carregarDocumentos();
  if (tabela === 'unidades_documentos') await carregarUnidadesDocumentos();

  await renderLixeira();
}

// Helper compartilhado: mescla uma chave dentro de empresas.config (jsonb)
// sem sobrescrever as outras chaves que já estão lá.
async function salvarConfigEmpresa(chave, valor) {
  const novoConfig = { ...empresaConfigCache.config, [chave]: valor };
  const { error } = await supabaseClient.from('empresas').update({ config: novoConfig }).eq('id', currentUser.empresaId);
  if (error) return { error };
  empresaConfigCache.config = novoConfig;
  return { error: null };
}

function toggleFaixaMatriz(chave, ativo) {
  const input = document.getElementById(`corte-${chave}`);
  const row = input.closest('.matrix-row');
  input.disabled = !ativo;
  row.style.opacity = ativo ? '' : '.5';
}

async function salvarMatriz() {
  const usarCert = document.getElementById('usar-cert').checked;
  const usarAprov = document.getElementById('usar-aprov').checked;
  const usarParcial = document.getElementById('usar-parcial').checked;

  if (!usarCert && !usarAprov && !usarParcial) {
    toast('Deixe pelo menos uma faixa ativa além de Reprovado.');
    return;
  }

  const matriz = {
    cert: parseFloat(document.getElementById('corte-cert').value),
    aprov: parseFloat(document.getElementById('corte-aprov').value),
    parcial: parseFloat(document.getElementById('corte-parcial').value),
    usarCert, usarAprov, usarParcial,
  };
  const { error } = await salvarConfigEmpresa('matriz', matriz);
  if (error) { toast('Erro ao salvar matriz: ' + error.message); return; }
  addLog('matriz_atualizada', `${currentUser.email} atualizou a matriz de qualificação (cert:${usarCert ? matriz.cert : 'off'} aprov:${usarAprov ? matriz.aprov : 'off'} parcial:${usarParcial ? matriz.parcial : 'off'})`);
  toast('Matriz de qualificação salva!');
}


async function salvarEmpresaAd() {
  const empresa = {};
  ['cidade','endereco','cep','tel','email'].forEach(k => {
    empresa[k] = document.getElementById('emp-' + k).value.trim();
  });
  const { error } = await salvarConfigEmpresa('empresa', empresa);
  if (error) { toast('Erro ao salvar dados da empresa: ' + error.message); return; }

  const setor = document.getElementById('emp-setor').value.trim();

  // "nome" NÃO é editável por aqui — é definido uma única vez no cadastro
  // (onboarding-criar-empresa) e só muda por pedido ao suporte. "setor" é
  // usado só na assinatura dos e-mails automáticos.
  const { error: colunasErr } = await supabaseClient.from('empresas').update({ setor: setor || null }).eq('id', currentUser.empresaId);
  if (!colunasErr) {
    empresaConfigCache.setor = setor;
  }

  addLog('empresa_atualizada', `${currentUser.email} atualizou os dados da empresa`);
  toast('Dados da empresa salvos!');
}

async function salvarRetencaoAvaliacao() {
  const valorInput = document.getElementById('cfg-anos-retencao').value.trim();
  const anos = valorInput ? parseInt(valorInput) : null;
  if (valorInput && (!anos || anos < 1)) { toast('Informe um número de anos válido, ou deixe em branco pra desligar.'); return; }

  const { error } = await supabaseClient.from('empresas').update({ anos_retencao_avaliacao: anos }).eq('id', currentUser.empresaId);
  if (error) { toast('Erro ao salvar: ' + error.message); return; }

  empresaConfigCache.anos_retencao_avaliacao = anos;
  addLog('retencao_avaliacao_atualizada', `${currentUser.email} ${anos ? `definiu retenção de ${anos} ano(s) pras avaliações de serviço` : 'desligou a retenção de avaliações de serviço'}`);
  toast(anos ? `Retenção definida: ${anos} ano(s).` : 'Retenção desligada.');
}

// ---- Upload de fundo de documento ----
// Fundos ficam salvos em empresas.config (Supabase), não mais no localStorage —
// assim qualquer usuário da empresa, em qualquer dispositivo, vê o mesmo fundo.
const FUNDO_CONFIG_KEY = { ap_fundo_certificado: 'fundoCertificado', ap_fundo_carta: 'fundoCarta' };
function getFundoConfig(storageKey) {
  return empresaConfigCache.config[FUNDO_CONFIG_KEY[storageKey]] || null;
}
async function uploadFundo(storageKey, input, previewId) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) { toast('Imagem muito grande. Use até 3MB.'); return; }
  const reader = new FileReader();
  reader.onload = async e => {
    const { error } = await salvarConfigEmpresa(FUNDO_CONFIG_KEY[storageKey], e.target.result);
    if (error) { toast('Erro ao salvar fundo: ' + error.message); return; }
    renderFundoPreview(storageKey, previewId);
    atualizarFundoNoEditorLayout(storageKey);
    addLog('fundo_atualizado', `${currentUser.email} atualizou o fundo do documento (${storageKey})`);
    toast('Imagem de fundo salva!');
  };
  reader.readAsDataURL(file);
}

async function removerFundo(storageKey, previewId) {
  const { error } = await salvarConfigEmpresa(FUNDO_CONFIG_KEY[storageKey], null);
  if (error) { toast('Erro ao remover fundo: ' + error.message); return; }
  renderFundoPreview(storageKey, previewId);
  atualizarFundoNoEditorLayout(storageKey);
  toast('Fundo removido.');
}

// Atualiza o fundo direto no canvas do editor de layout, sem precisar sair e voltar da aba
function atualizarFundoNoEditorLayout(storageKey) {
  const tipo = storageKey === 'ap_fundo_certificado' ? 'cert' : 'carta';
  if (layoutEditorState) renderLayoutEditorTipo(tipo);
}

function renderFundoPreview(storageKey, previewId) {
  const wrap = document.getElementById(previewId);
  if (!wrap) return;
  const fundo = getFundoConfig(storageKey);
  if (fundo) {
    wrap.innerHTML = `<img src="${fundo}" style="max-width:240px; max-height:140px; border-radius:8px; border:1px solid var(--border); object-fit:cover">
      <p style="font-size:11px; color:var(--success); margin-top:6px; display:flex; align-items:center; gap:5px">${ic('check', 12)}Fundo configurado</p>`;
  } else {
    wrap.innerHTML = `<p style="font-size:12px; color:var(--text-muted)">Nenhum fundo configurado — será gerado com fundo branco.</p>`;
  }
}

// ---- Editor de layout (posição dos textos) ----
const LAYOUT_DIMS = { cert: { W: 297, H: 210, scale: 640/297 }, carta: { W: 210, H: 297, scale: 320/210 } };
// Margem de segurança da folha (área não-imprimível típica de impressoras) — usada
// tanto como linha-guia visual no editor quanto como limite real de arraste/resize
// (não deixa a borda de um bloco passar dela). 3mm em cada lado (cima/baixo/esquerda/direita).
const MARGEM_PAGINA_MM = 3;
const FONTES_PADRAO = { helvetica: { label: 'Helvetica (sem serifa)', css: "'Helvetica Neue', Arial, sans-serif" }, times: { label: 'Times (serifada)', css: "'Times New Roman', Times, serif" }, courier: { label: 'Courier (monoespaçada)', css: "'Courier New', Courier, monospace" } };
let FONTES_DOC = { ...FONTES_PADRAO };

// Uma fonte personalizada pode vir no formato antigo ({chave, nome, base64}, 1 peso só)
// ou no novo ({chave, nome, arquivos:{normal,bold,italic,bolditalic}}). Essa função sempre
// devolve o formato novo, então o resto do código só precisa lidar com um formato.
function normalizarArquivosFonte(f) {
  return f.arquivos || { normal: f.base64 };
}

// Junta as 3 fontes padrão com as fontes .ttf que a empresa importou, e injeta um
// @font-face pra cada peso disponível, pra elas aparecerem certinho (incl. negrito/itálico
// reais, quando importados) já na pré-visualização do editor.
function atualizarFontesDisponiveis() {
  const customs = empresaConfigCache.config.fontesCustom || [];
  FONTES_DOC = { ...FONTES_PADRAO };
  customs.forEach(f => { FONTES_DOC[f.chave] = { label: `${f.nome} (importada)`, css: `'${f.chave}'` }; });
  // Fontes mudaram — a instância de medição em cache (getDocMedicaoLayout) fica
  // desatualizada; força recriar (com as fontes novas registradas) no próximo uso.
  _docMedicaoLayout = null;

  let styleTag = document.getElementById('fontes-custom-style');
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'fontes-custom-style';
    document.head.appendChild(styleTag);
  }
  const DESCRITOR_PESO = {
    normal:     { weight: 400, style: 'normal' },
    bold:       { weight: 700, style: 'normal' },
    italic:     { weight: 400, style: 'italic' },
    bolditalic: { weight: 700, style: 'italic' }
  };
  styleTag.textContent = customs.map(f => {
    const arquivos = normalizarArquivosFonte(f);
    return Object.keys(DESCRITOR_PESO).filter(peso => arquivos[peso]).map(peso => {
      const { weight, style } = DESCRITOR_PESO[peso];
      return `@font-face { font-family: '${f.chave}'; font-weight: ${weight}; font-style: ${style}; src: url(data:font/ttf;base64,${arquivos[peso]}) format('truetype'); }`;
    }).join('\n');
  }).join('\n');
}

// Instância de jsPDF só de MEDIÇÃO — nunca vira um PDF de verdade, nunca é baixada.
// Existe só pra o preview do editor de layout (renderLayoutBlocks) chamar
// calcularLinhasBloco() com o MESMO motor que gera o PDF final, em vez de deixar
// o navegador decidir a quebra de linha (que usa métricas de fonte diferentes e
// pode quebrar num ponto diferente do PDF real). Cacheada porque criar uma
// instância nova do jsPDF a cada tecla digitada no editor pesaria a interface —
// só é recriada quando o conjunto de fontes customizadas muda de verdade.
let _docMedicaoLayout = null;
function getDocMedicaoLayout() {
  if (!_docMedicaoLayout) {
    const { jsPDF } = window.jspdf;
    _docMedicaoLayout = new jsPDF({ unit: 'mm' });
    registrarFontesCustomNoPDF(_docMedicaoLayout);
  }
  return _docMedicaoLayout;
}

// Registra as fontes personalizadas no jsPDF (isso precisa ser feito de novo a cada PDF
// gerado, porque cada `new jsPDF()` tem seu próprio sistema de arquivos de fontes).
function registrarFontesCustomNoPDF(doc) {
  const customs = empresaConfigCache.config.fontesCustom || [];
  customs.forEach(f => {
    const arquivos = normalizarArquivosFonte(f);
    // Sempre existe pelo menos um peso (garantido na importação); usamos ele como
    // "reserva" pros pesos que não foram importados, pra não dar erro no jsPDF —
    // só não vai ficar visualmente diferente no PDF pro peso que faltou.
    const reserva = arquivos.normal || arquivos.bold || arquivos.italic || arquivos.bolditalic;
    ['normal', 'bold', 'italic', 'bolditalic'].forEach(peso => {
      const base64 = arquivos[peso] || reserva;
      const arquivo = `${f.chave}_${peso}.ttf`;
      doc.addFileToVFS(arquivo, base64);
      doc.addFont(arquivo, f.chave, peso);
    });
  });
}

const LIMITE_FONTES_CUSTOM = 8;

function arquivoParaBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result.split(',')[1]); // tira o prefixo "data:...;base64,"
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
    reader.readAsDataURL(file);
  });
}

// Lê um .zip com os pesos de uma família de fonte e detecta automaticamente qual arquivo
// é Regular/Bold/Italic/BoldItalic pelo nome (ex: "Montserrat-Bold.ttf", "Montserrat Italic Oblique.ttf").
// Arquivo sem nenhuma dessas palavras no nome é tratado como o peso "normal" (Regular).
async function extrairPesosFonteDoZip(file) {
  const zip = await JSZip.loadAsync(file);
  const arquivos = {};
  const entradas = Object.values(zip.files).filter(f => !f.dir && f.name.toLowerCase().endsWith('.ttf'));
  for (const entrada of entradas) {
    const nomeBase = entrada.name.toLowerCase();
    const temBold = /bold/.test(nomeBase);
    const temItalic = /italic|oblique/.test(nomeBase);
    const peso = temBold && temItalic ? 'bolditalic' : temBold ? 'bold' : temItalic ? 'italic' : 'normal';
    if (arquivos[peso]) continue; // já achou esse peso — mantém o primeiro, ignora duplicata
    const base64 = await entrada.async('base64');
    if (base64.length * 0.75 > 2 * 1024 * 1024) continue; // ignora peso individual > 2MB
    arquivos[peso] = base64;
  }
  return arquivos;
}

async function adicionarFontePersonalizada() {
  const nomeInput = document.getElementById('fonte-custom-nome');
  const fileInput = document.getElementById('fonte-custom-arquivo');
  const nome = nomeInput.value.trim();
  const file = fileInput.files[0];

  if (!nome) { toast('Dê um nome pra essa fonte (ex: Montserrat).'); return; }
  if (!file) { toast('Selecione um arquivo .ttf ou .zip.'); return; }

  const nomeArquivo = file.name.toLowerCase();
  const isZip = nomeArquivo.endsWith('.zip');
  const isTtf = nomeArquivo.endsWith('.ttf');
  if (!isZip && !isTtf) { toast('Envie um arquivo .ttf (um peso só) ou .zip (com Regular/Bold/Italic/BoldItalic).'); return; }
  if (file.size > 9 * 1024 * 1024) { toast('Arquivo muito grande. O total não pode passar de 9MB.'); return; }

  const qtdAtual = (empresaConfigCache.config.fontesCustom || []).length;
  if (qtdAtual >= LIMITE_FONTES_CUSTOM) { toast(`Limite de ${LIMITE_FONTES_CUSTOM} fontes personalizadas atingido. Remova uma pra importar outra.`); return; }

  const btnAdd = document.getElementById('fonte-custom-btn-add');
  if (btnAdd) { btnAdd.disabled = true; btnAdd.textContent = 'Importando...'; }

  try {
    const arquivos = isZip ? await extrairPesosFonteDoZip(file) : { normal: await arquivoParaBase64(file) };

    if (!arquivos.normal && !arquivos.bold && !arquivos.italic && !arquivos.bolditalic) {
      toast('Não encontrei nenhum arquivo .ttf válido (ou até 2MB) dentro do zip.');
      return;
    }
    // Se o zip não tinha um "Regular" claro, usa o primeiro peso encontrado como base —
    // assim sempre sobra pelo menos um arquivo pra usar de reserva nos pesos que faltarem.
    if (!arquivos.normal) {
      const primeiroPeso = ['bold', 'italic', 'bolditalic'].find(p => arquivos[p]);
      arquivos.normal = arquivos[primeiroPeso];
    }

    const chave = 'custom_' + nome.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '_' + Date.now().toString(36);
    const listaAtual = empresaConfigCache.config.fontesCustom || [];
    const novaLista = [...listaAtual, { chave, nome, arquivos }];

    const { error } = await salvarConfigEmpresa('fontesCustom', novaLista);
    if (error) { toast('Erro ao salvar fonte: ' + error.message); return; }

    const pesosImportados = ['normal', 'bold', 'italic', 'bolditalic'].filter(p => arquivos[p]).join(', ');
    addLog('fonte_importada', `${currentUser.email} importou a fonte "${nome}" (pesos: ${pesosImportados})`);
    toast(`Fonte "${nome}" importada! (${pesosImportados.split(', ').length} peso(s))`);
    nomeInput.value = '';
    fileInput.value = '';
    atualizarFontesDisponiveis();
    renderFontesCustomLista();
  } catch (e) {
    toast('Erro ao processar o arquivo: ' + e.message);
  } finally {
    if (btnAdd) { btnAdd.disabled = false; btnAdd.textContent = '+ Importar fonte'; }
  }
}

async function removerFontePersonalizada(chave) {
  if (!confirm('Remover essa fonte? Blocos que já usam ela voltam pra Helvetica.')) return;
  const listaAtual = empresaConfigCache.config.fontesCustom || [];
  const novaLista = listaAtual.filter(f => f.chave !== chave);
  const { error } = await salvarConfigEmpresa('fontesCustom', novaLista);
  if (error) { toast('Erro ao remover fonte: ' + error.message); return; }

  // Corrige os blocos do layout (certificado e carta) que usavam a fonte removida,
  // senão eles ficam "presos" apontando pra uma fonte inexistente e quebram o editor
  // (era isso que causava o erro "Cannot read properties of undefined (reading 'css')").
  const layoutAtual = getLayout();
  let layoutMudou = false;
  ['cert', 'carta'].forEach(tipo => {
    layoutAtual[tipo].blocos.forEach(b => {
      if (b.fonte === chave) { b.fonte = 'helvetica'; layoutMudou = true; }
    });
  });
  if (layoutMudou) {
    await salvarConfigEmpresa('layout', layoutAtual);
    if (typeof layoutEditorState !== 'undefined' && layoutEditorState) layoutEditorState = layoutAtual;
  }

  toast('Fonte removida.');
  atualizarFontesDisponiveis();
  renderFontesCustomLista();
}

function renderFontesCustomLista() {
  const wrap = document.getElementById('fontes-custom-lista');
  if (!wrap) return;
  const customs = empresaConfigCache.config.fontesCustom || [];
  const contador = document.getElementById('fontes-custom-contador');
  if (contador) contador.textContent = `${customs.length}/${LIMITE_FONTES_CUSTOM} fontes importadas`;
  const btnAdd = document.getElementById('fonte-custom-btn-add');
  if (btnAdd) btnAdd.disabled = customs.length >= LIMITE_FONTES_CUSTOM;

  if (!customs.length) {
    wrap.innerHTML = '<p style="font-size:11.5px; color:var(--text-muted)">Nenhuma fonte importada ainda.</p>';
    return;
  }
  const LABEL_PESO = { normal: 'Regular', bold: 'Negrito', italic: 'Itálico', bolditalic: 'Negrito+Itálico' };
  wrap.innerHTML = customs.map(f => {
    const arquivos = normalizarArquivosFonte(f);
    const badges = ['normal', 'bold', 'italic', 'bolditalic'].filter(p => arquivos[p]).map(p =>
      `<span style="font-size:10px; padding:2px 6px; border-radius:4px; background:var(--surface2); color:var(--text-sec); margin-right:4px">${LABEL_PESO[p]}</span>`
    ).join('');
    return `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--border)">
      <div>
        <span style="font-family:'${f.chave}'">${f.nome}</span>
        <div style="margin-top:3px">${badges}</div>
      </div>
      <button class="btn btn-danger btn-sm" onclick="removerFontePersonalizada('${f.chave}')">Remover</button>
    </div>
  `;
  }).join('');
}

let layoutEditorState = null;
let layoutSelecionado = { cert: null, carta: null };
let layoutSimulado = { cert: 'certificado', carta: 'aprovado' };
// Produto/Serviço só importa pra situações que têm texto diferente pra cada um
// (certificado e aprovado); parcial/reprovado usam um texto único.
let layoutTipoProdServ = { cert: 'servico', carta: 'servico' };
let dragInfo = null;
// Guia de alinhamento (estilo Word/PowerPoint): guarda a posição em px, na tela,
// da linha vertical e/ou horizontal que aparece enquanto se arrasta um bloco.
let layoutGuides = { cert: { v: null, h: null }, carta: { v: null, h: null } };
const SNAP_PX = 6; // tolerância de encaixe (em pixels de tela) pra considerar "alinhado"
let resizeInfo = null;
let layoutIdCounter = 1;
// Zoom do editor (multiplica dims.scale só na tela — nunca entra no PDF nem no mm real).
let layoutZoom = { cert: 1, carta: 1 };
const ZOOM_MIN = 0.5, ZOOM_MAX = 2.5, ZOOM_STEP = 0.15;
function getDimsZoom(tipo) {
  const base = LAYOUT_DIMS[tipo];
  return { ...base, scale: base.scale * (layoutZoom[tipo] || 1) };
}
function ajustarZoomLayout(tipo, delta) {
  layoutZoom[tipo] = +Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, layoutZoom[tipo] + delta)).toFixed(2);
  renderLayoutEditorTipo(tipo);
}
// Texto digitado mas ainda NÃO salvo (enquanto a pessoa digita no textarea do corpo do
// texto) — separado de db().textos pra dar preview instantâneo sem salvar a cada tecla.
let layoutTextoRascunho = { cert: {}, carta: {} };

function showLayoutSubtab(tipo, btn) {
  document.querySelectorAll('.layout-editor-wrap').forEach(el => el.style.display = 'none');
  btn.parentElement.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
  document.getElementById('layout-editor-' + tipo).style.display = 'block';
  btn.classList.add('active');
}

function initLayoutEditor() {
  layoutEditorState = getLayout();
  layoutSelecionado = { cert: null, carta: null };
  atualizarFontesDisponiveis();
  renderFontesCustomLista();
  renderLayoutEditorTipo('cert');
  renderLayoutEditorTipo('carta');
}

// Resolve qual chave de d.textos (cert-prod, aprov-serv, parcial, reprov...) está
// "em foco" agora, de acordo com o que está selecionado no simulador do editor de layout.
function getChaveTextoAtual(tipo) {
  const statusSim = tipo === 'cert' ? 'certificado' : layoutSimulado[tipo];
  return getTipoDoc(statusSim, layoutTipoProdServ[tipo]);
}

// Monta um contexto de dados de exemplo (usando textos e nome da empresa reais já configurados)
// pra simular como o documento vai ficar sem precisar de uma avaliação de verdade.
function contextoSimuladoLayout(tipo, statusSim) {
  const d = db();
  const empNome = d.empresa.nome || 'Empresa';
  const notaSim = statusSim === 'certificado' ? '10.0' : statusSim === 'parcial' ? '6.5' : statusSim === 'reprovado' ? '3.0' : '8.5';
  const tipoDocSim = getChaveTextoAtual(tipo);
  // Enquanto a pessoa está digitando (ainda não salvou), usa o rascunho em memória
  // no lugar do texto salvo — é isso que faz o preview atualizar instantaneamente.
  const rascunho = layoutTextoRascunho[tipo][tipoDocSim];
  const corpoTexto = aplicarTexto(rascunho !== undefined ? rascunho : (d.textos[tipoDocSim] || ''), 'Fornecedor Exemplo Ltda', notaSim, '06/2026', empNome, 'Manutenção preventiva e corretiva do Alinity');
  return {
    fornecedor: { nome: 'Fornecedor Exemplo Ltda', cnpj: '12.345.678/0001-90', setor: 'Qualidade', criticidade: 'Alta', extras: {} },
    nota: notaSim, periodo: '06/2026', empresaNome: empNome, sit: statusSim, dadosEmpresa: d.empresa, corpoTexto, isCert: tipo === 'cert'
  };
}

// Gera um PDF REAL (não uma prévia aproximada) usando o estado ATUAL do editor — mesmo que ainda não tenha
// clicado em "Salvar layout". Assim dá pra comparar o resultado de verdade, e não só o preview em miniatura.
function baixarPDFTesteLayout(tipo) {
  const isCert = tipo === 'cert';
  const sitSimulada = isCert ? 'certificado' : (layoutSimulado[tipo] || 'aprovado');
  const notaSample = { certificado: 10, aprovado: 8.5, parcial: 6.0, reprovado: 3.0 }[sitSimulada];
  const fornecedorFake = { nome: 'Fornecedor Exemplo Ltda', tipo: layoutTipoProdServ[tipo], sit: sitSimulada, media: notaSample, cnpj: '', setor: '', criticidade: '' };
  const hoje = new Date();
  const periodoLabel = `${MESES[hoje.getMonth() + 1]}/${hoje.getFullYear()}`;
  const pdf = gerarPDFDoc(fornecedorFake, periodoLabel, layoutEditorState[tipo]);
  const blob = new Blob([pdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Teste_Layout_${isCert ? 'Certificado' : 'Carta_' + sitSimulada}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
  toast('PDF de teste gerado com o layout atual (mesmo sem clicar em Salvar)!');
}

function renderLayoutEditorTipo(tipo) {
  const dims = getDimsZoom(tipo);
  const wrap = document.getElementById('layout-editor-' + tipo);
  if (!wrap) return;
  const fundo = getFundoConfig(tipo === 'cert' ? 'ap_fundo_certificado' : 'ap_fundo_carta');
  const w = Math.round(dims.W * dims.scale), h = Math.round(dims.H * dims.scale);
  const opcoesStatus = tipo === 'cert'
    ? `<option value="certificado">Certificado (nota 10)</option>`
    : `<option value="aprovado" ${layoutSimulado[tipo]==='aprovado'?'selected':''}>Aprovado</option><option value="parcial" ${layoutSimulado[tipo]==='parcial'?'selected':''}>Parcialmente aprovado</option><option value="reprovado" ${layoutSimulado[tipo]==='reprovado'?'selected':''}>Reprovado</option>`;
  const zoomPct = Math.round((layoutZoom[tipo] || 1) * 100);
  const svgRefresh = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`;
  const svgLupa = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
  wrap.innerHTML = `
    <div class="blkedit-wrap">
      <div class="blkedit-canvas-area">
        <div class="blkedit-sim-bar">
          <label>${svgRefresh} Simular:</label>
          <select onchange="layoutSimulado['${tipo}']=this.value; renderLayoutEditorTipo('${tipo}')">${opcoesStatus}</select>
          <select onchange="layoutTipoProdServ['${tipo}']=this.value; renderLayoutBlocks('${tipo}')">
            <option value="servico" ${layoutTipoProdServ[tipo]==='servico'?'selected':''}>Serviço</option>
            <option value="produto" ${layoutTipoProdServ[tipo]==='produto'?'selected':''}>Produto</option>
          </select>
          <span style="font-size:11px; color:var(--text-muted)">— clique no bloco "Corpo do texto" pra editar o texto desta situação</span>
          <div style="display:flex; align-items:center; gap:6px; margin-left:auto">
            ${svgLupa}
            <button type="button" class="btn btn-secondary btn-sm" style="padding:3px 9px" onclick="ajustarZoomLayout('${tipo}', ${-ZOOM_STEP})" title="Diminuir zoom">−</button>
            <span style="font-size:11px; color:var(--text-muted); min-width:34px; text-align:center">${zoomPct}%</span>
            <button type="button" class="btn btn-secondary btn-sm" style="padding:3px 9px" onclick="ajustarZoomLayout('${tipo}', ${ZOOM_STEP})" title="Aumentar zoom">+</button>
          </div>
        </div>
        <div id="layout-canvas-${tipo}" class="blkedit-canvas" style="width:${w}px; height:${h}px; background:${fundo ? `#fff url(${fundo})` : '#fff'}; background-size:100% 100%; background-position:center"></div>
        <div class="blkedit-toolbar">
          <button class="btn btn-primary btn-sm" onclick="adicionarBlocoLayout('${tipo}')">＋ Adicionar bloco</button>
          <button class="btn btn-secondary btn-sm" onclick="baixarPDFTesteLayout('${tipo}')" style="display:inline-flex; align-items:center; gap:6px">${ic('fileText', 13)}Baixar PDF de teste</button>
          <button class="btn btn-secondary btn-sm" onclick="salvarLayout('${tipo}')">Salvar layout</button>
          <button class="btn btn-secondary btn-sm" onclick="restaurarLayoutPadrao('${tipo}')">↺ Restaurar padrão</button>
        </div>
      </div>
      <div class="blkedit-sidebar" id="layout-sidebar-${tipo}"></div>
    </div>
  `;
  renderLayoutBlocks(tipo);
}

// Calcula a distância real entre o topo da caixa (CSS) e a linha de base do
// texto (jsPDF) — as duas âncoras que esse editor precisa conciliar. Duas partes:
// 1) A ascendente da fonte em si (medida de verdade via Canvas, não uma
//    aproximação fixa tipo "80% do tamanho", que erra de fonte pra fonte).
// 2) O "half-leading": quando o line-height usado é diferente da altura
//    natural da fonte, o navegador distribui a diferença IGUALMENTE acima e
//    abaixo do texto — sem contar essa metade de cima, a linha de base sempre
//    acaba um pouco mais baixo do que o calculado (foi o resíduo que sobrou
//    da correção anterior, que só cobria o item 1).
let _ctxMedicaoFonte = null;
function calcularOffsetBaseline(fontCss, lhPx) {
  if (!_ctxMedicaoFonte) _ctxMedicaoFonte = document.createElement('canvas').getContext('2d');
  _ctxMedicaoFonte.font = fontCss;
  const m = _ctxMedicaoFonte.measureText('Hp');
  if (m.fontBoundingBoxAscent && m.fontBoundingBoxDescent !== undefined) {
    const alturaNaturalFonte = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent;
    const halfLeading = (lhPx - alturaNaturalFonte) / 2;
    return halfLeading + m.fontBoundingBoxAscent;
  }
  if (m.actualBoundingBoxAscent) return m.actualBoundingBoxAscent; // navegador sem fontBoundingBox* — ascendente real, mas sem contar leading
  const fsPxAprox = parseFloat((fontCss.match(/([\d.]+)px/) || [])[1]) || 16;
  return fsPxAprox * 0.8; // navegador muito antigo sem nenhuma dessas métricas
}

// Mesmo texto (de verdade ou placeholder) que aparece desenhado no bloco — usado
// tanto pra desenhar quanto pro cálculo de altura usado no travamento de margem.
function textoResolvidoDoBloco(tipo, b) {
  const ctx = contextoSimuladoLayout(tipo, layoutSimulado[tipo]);
  const valorResolvido = b.tipo === 'fixo' ? b.conteudo : resolveVariavelValor(b.variavel, ctx);
  return valorResolvido || (b.variavel === 'corpo_texto' ? 'Insira o corpo do texto aqui' : `{${b.variavel}}`);
}

// Altura total (px de tela) que um bloco ocupa, calculada com o mesmo motor
// (calcularLinhasBloco) usado no preview e no PDF. Usada só pelo arraste (onDragBlock),
// pra travar a borda de baixo do bloco na margem da página também no eixo vertical —
// não só a âncora crua do topo, que sozinha deixava um bloco de texto longo estourar
// a margem de baixo sem avisar.
function alturaBlocoPx(tipo, b) {
  const dims = getDimsZoom(tipo);
  const docMedicao = getDocMedicaoLayout();
  const estiloPdf = (b.negrito && b.italico) ? 'bolditalic' : b.negrito ? 'bold' : b.italico ? 'italic' : 'normal';
  docMedicao.setFont(b.fonte || 'helvetica', estiloPdf);
  docMedicao.setFontSize(b.tamanho);
  const texto = textoResolvidoDoBloco(tipo, b);
  const linhas = calcularLinhasBloco(docMedicao, texto, { x: 0, y: 0, largura: b.largura, tamanho: b.tamanho, align: b.align });
  const lhPx = (b.tamanho * 0.5 + 1) * dims.scale;
  return (linhas.length ? (linhas[linhas.length - 1].y * dims.scale + lhPx) : lhPx) + 8;
}

function renderLayoutBlocks(tipo, atualizarSidebar = true) {
  const dims = getDimsZoom(tipo);
  const canvas = document.getElementById('layout-canvas-' + tipo);
  if (!canvas) return;
  const blocos = layoutEditorState[tipo].blocos;
  const ctx = contextoSimuladoLayout(tipo, layoutSimulado[tipo]);
  const docMedicao = getDocMedicaoLayout();
  canvas.innerHTML = '';

  // Linha-guia da margem de segurança da folha — sempre visível (diferente das guias
  // de alinhamento mais abaixo, que só aparecem durante o arraste), pra lembrar que
  // impressoras geralmente não imprimem até a borda física da folha.
  const margemPx = MARGEM_PAGINA_MM * dims.scale;
  const margemGuia = document.createElement('div');
  margemGuia.style.cssText = `position:absolute; left:${margemPx}px; top:${margemPx}px; right:${margemPx}px; bottom:${margemPx}px; border:1px dashed rgba(0,0,0,0.18); pointer-events:none; z-index:1;`;
  canvas.appendChild(margemGuia);

  blocos.forEach(b => {
    const div = document.createElement('div');
    const selecionado = layoutSelecionado[tipo] === b.id;
    div.className = 'blkedit-block' + (selecionado ? ' selected' : '');
    const valorResolvido = b.tipo === 'fixo' ? b.conteudo : resolveVariavelValor(b.variavel, ctx);
    const vazio = !valorResolvido;
    const texto = vazio ? (b.variavel === 'corpo_texto' ? 'Insira o corpo do texto aqui' : `{${b.variavel}}`) : valorResolvido;
    const translate = b.align === 'center' ? '-50%' : b.align === 'right' ? '-100%' : '0%'; // 'justify' também ancora à esquerda (0%)
    // b.tamanho é em pontos (pt), igual ao doc.setFontSize() do jsPDF. Precisa converter
    // pt -> mm (1pt = 0.352778mm) -> px da tela (dims.scale), senão o preview fica com
    // um tamanho de fonte totalmente diferente do PDF gerado.
    const fsPx = b.tamanho * 0.352778 * dims.scale;
    // Mesmo incremento de linha usado no gerarPDFDoc (y += tamanho*0.5 + 1, em mm),
    // convertido pra px, senão textos com quebra de linha desalinham no PDF.
    const lhPx = (b.tamanho * 0.5 + 1) * dims.scale;
    const corTexto = (vazio && b.variavel === 'corpo_texto') ? '#b7b6b0' : (b.variavel==='situacao' ? {aprovado:'#008238',parcial:'#b46400',reprovado:'#b40000'}[layoutSimulado[tipo]]||b.cor : b.cor);
    const estiloTexto = (vazio && b.variavel === 'corpo_texto') ? 'italic' : (b.italico?'italic':'normal');
    // Se o bloco aponta pra uma fonte que não existe mais (ex: fonte personalizada
    // removida), cai pra Helvetica em vez de quebrar o editor inteiro.
    const fonteResolvida = FONTES_DOC[b.fonte] || FONTES_DOC.helvetica;
    // No jsPDF, x/y é a linha de base do texto; no CSS, top é o topo da caixa — são
    // âncoras diferentes pra mesma coordenada. calcularOffsetBaseline mede a
    // distância real entre as duas (ascendente da fonte + half-leading do line-height),
    // em vez de uma aproximação fixa que erra dependendo da fonte/tamanho.
    const pesoCss = b.negrito ? '700' : '400';
    const fontCssBloco = `${estiloTexto === 'italic' ? 'italic ' : ''}${pesoCss} ${fsPx}px ${fonteResolvida.css}`;
    const offsetBaseline = calcularOffsetBaseline(fontCssBloco, lhPx);
    const topPx = b.y * dims.scale - offsetBaseline;
    div.style.cssText = `left:${b.x*dims.scale}px; top:${topPx}px; width:${b.largura*dims.scale}px; transform:translateX(${translate}); font-family:${fonteResolvida.css}; font-size:${fsPx}px; color:${corTexto}; font-weight:${b.negrito?'700':'400'}; font-style:${estiloTexto};`;

    // Quebra de linha e (quando align:'justify') a posição de cada palavra são
    // calculadas pelo MESMO jsPDF que gera o PDF final (calcularLinhasBloco, em
    // relatorios-pdf.js) — não pelo reflow nativo do navegador. Passamos x:0/y:0
    // pra receber coordenadas relativas ao próprio bloco (o "left"/"top" acima já
    // posiciona o bloco inteiro na página).
    const estiloPdf = (b.negrito && b.italico) ? 'bolditalic' : b.negrito ? 'bold' : b.italico ? 'italic' : 'normal';
    docMedicao.setFont(b.fonte || 'helvetica', estiloPdf);
    docMedicao.setFontSize(b.tamanho);
    const linhasCalculadas = calcularLinhasBloco(docMedicao, texto, { x: 0, y: 0, largura: b.largura, tamanho: b.tamanho, align: b.align });
    // As linhas abaixo são todas position:absolute (pra posicionar cada uma na
    // coordenada exata calculada pelo jsPDF), então não contribuem pra altura
    // natural do wrapper — precisa fixar a altura manualmente, senão a caixa do
    // bloco (área de clique/seleção/hover) colapsa pra quase 0px.
    const alturaTotalPx = linhasCalculadas.length ? (linhasCalculadas[linhasCalculadas.length - 1].y * dims.scale + lhPx) : lhPx;
    // O linhaWrap é position:absolute (não contribui pra altura automática do
    // fluxo normal, ao contrário do texto solto que tinha antes) — sem isso, a
    // caixa (área de seleção/clique/hover) colapsava pra uma linha só, mesmo com
    // o texto certinho aparecendo por baixo dela. +8px = padding-top/bottom (3+3)
    // + border top/bottom (1+1) do bloco, pra cobrir com a mesma folga visual de antes.
    div.style.height = (alturaTotalPx + 8) + 'px';
    // position:absolute (em vez do position:relative de antes) porque um filho
    // relative flui DEPOIS do padding do bloco (3px 5px) — o texto começava ~5-6px
    // mais pra dentro do que o jsPDF assume, e como as posições são calculadas pra
    // preencher a largura CHEIA do bloco (largura), sobrava passando um pouco da
    // borda direita. Um elemento absolute usa a padding-box do pai como referência
    // (ignora o padding), então left:-1px/top:-1px cancela só a borda de 1px e
    // ancora certinho na mesma origem que b.x/b.y representam no jsPDF.
    const linhaWrap = document.createElement('div');
    linhaWrap.style.cssText = `position:absolute; left:-1px; top:-1px; width:${b.largura*dims.scale}px; height:${alturaTotalPx}px;`;
    linhasCalculadas.forEach(lr => {
      const linhaDiv = document.createElement('div');
      linhaDiv.style.cssText = `position:absolute; top:${lr.y * dims.scale}px; white-space:nowrap;`;
      if (!lr.vazio) {
        if (lr.posicoes) {
          // justify: cada palavra na posição exata calculada pelo jsPDF, em vez de
          // deixar o CSS text-align:justify decidir o espaçamento por conta própria.
          linhaDiv.style.left = '0px';
          lr.posicoes.forEach(p => {
            const wordSpan = document.createElement('span');
            wordSpan.style.cssText = `position:absolute; left:${p.x * dims.scale}px; top:0;`;
            wordSpan.textContent = p.palavra;
            linhaDiv.appendChild(wordSpan);
          });
        } else {
          // left/center/right: a posição da linha dentro da caixa também é calculada
          // com a largura real medida pelo jsPDF (lr.larguraLinha), não pelo
          // text-align do CSS — senão center/right ficam alguns décimos de mm fora
          // do lugar (métrica do navegador vs métrica do jsPDF).
          const deltaCaixaPx = (b.align === 'center' ? (b.largura - lr.larguraLinha) / 2 : b.align === 'right' ? (b.largura - lr.larguraLinha) : 0) * dims.scale;
          linhaDiv.style.left = deltaCaixaPx + 'px';
          linhaDiv.textContent = lr.linha;
        }
      }
      linhaWrap.appendChild(linhaDiv);
    });
    div.appendChild(linhaWrap);

    const delX = document.createElement('span');
    delX.className = 'blkedit-del'; delX.innerHTML = ic('x', 11);
    delX.onclick = (e) => { e.stopPropagation(); removerBlocoLayout(tipo, b.id); };
    div.appendChild(delX);
    ['left','right'].forEach(lado => {
      const h = document.createElement('span');
      h.className = 'blkedit-resize ' + lado;
      h.onmousedown = (e) => startResizeLayout(e, tipo, b.id, lado);
      div.appendChild(h);
    });
    div.addEventListener('mousedown', (e) => startDragBlock(e, tipo, b.id));
    div.addEventListener('click', (e) => { e.stopPropagation(); selecionarBlocoLayout(tipo, b.id); });
    canvas.appendChild(div);
  });
  canvas.onclick = () => selecionarBlocoLayout(tipo, null);

  // Linhas-guia de alinhamento (aparecem só durante o arraste, quando encaixa no centro
  // da página ou no centro/posição de outro bloco — igual ao Word/PowerPoint).
  const guias = layoutGuides[tipo] || {};
  if (guias.v != null) {
    const vLine = document.createElement('div');
    vLine.style.cssText = `position:absolute; left:${guias.v}px; top:0; width:0; height:100%; border-left:1px dashed var(--accent); pointer-events:none; z-index:20`;
    canvas.appendChild(vLine);
  }
  if (guias.h != null) {
    const hLine = document.createElement('div');
    hLine.style.cssText = `position:absolute; top:${guias.h}px; left:0; height:0; width:100%; border-top:1px dashed var(--accent); pointer-events:none; z-index:20`;
    canvas.appendChild(hLine);
  }

  if (atualizarSidebar) renderLayoutSidebar(tipo);
}

const LABELS_TEXTO_DOC = {
  'cert-prod': 'Certificado · Produto', 'cert-serv': 'Certificado · Serviço',
  'aprov-prod': 'Aprovado · Produto', 'aprov-serv': 'Aprovado · Serviço',
  'parcial-prod': 'Parcialmente aprovado · Produto', 'parcial-serv': 'Parcialmente aprovado · Serviço',
  'reprov-prod': 'Reprovado · Produto', 'reprov-serv': 'Reprovado · Serviço',
  'notif-abertura': 'Notificação ao fornecedor · Abertura', 'notif-plano-acao': 'Notificação ao fornecedor · Plano de ação',
  'notif-fechamento': 'Notificação ao fornecedor · Fechamento', 'notif-prazo-dias': 'Notificação ao fornecedor · Prazo do plano de ação (dias)'
};

// Painel embutido de edição de texto: aparece dentro das propriedades do bloco
// "Corpo do texto". Qual texto aparece (Aprovado/Parcial/Reprovado, Produto/Serviço)
// depende do que está selecionado no simulador logo acima, no topo do editor.
function renderEditorTextoDocumento(tipo) {
  const chave = getChaveTextoAtual(tipo);
  const texto = db().textos[chave] || '';
  return `
    <div class="blkedit-prop" style="border:1px solid var(--accent-border); background:var(--accent-bg); border-radius:8px; padding:10px 10px 4px">
      <label>Texto para: ${LABELS_TEXTO_DOC[chave]}</label>
      <textarea rows="6" placeholder="Insira o corpo do texto aqui" oninput="atualizarPreviewTexto('${chave}', this.value, '${tipo}')" onchange="salvarTextoDocumento('${chave}', this.value, '${tipo}')">${texto}</textarea>
      <p style="font-size:10.5px; color:var(--text-muted); margin:6px 0 8px">
        Clique pra inserir:
        <code style="cursor:pointer" onclick="inserirVariavelTexto('${tipo}','{fornecedor}')">{fornecedor}</code>
        <code style="cursor:pointer" onclick="inserirVariavelTexto('${tipo}','{nota}')">{nota}</code>
        <code style="cursor:pointer" onclick="inserirVariavelTexto('${tipo}','{periodo}')">{periodo}</code>
        <code style="cursor:pointer" onclick="inserirVariavelTexto('${tipo}','{empresa}')">{empresa}</code>
        <code style="cursor:pointer" onclick="inserirVariavelTexto('${tipo}','{avaliado}')">{avaliado}</code>
      </p>
      <p style="font-size:10.5px; color:var(--text-muted); margin:0 0 8px">{avaliado} = texto de "O que está sendo avaliado", definido em cada formulário (Formulários › editar). Some do texto se estiver vazio.</p>
      <p style="font-size:10.5px; color:var(--text-muted); margin:0 0 8px">Pra editar o texto de outra situação (ex: Parcial, Reprovado), troque no seletor "Simular" lá em cima.</p>
    </div>`;
}

function inserirVariavelTexto(tipo, varTxt) {
  const ta = document.querySelector(`#layout-sidebar-${tipo} textarea`);
  if (!ta) return;
  ta.value += varTxt;
  ta.dispatchEvent(new Event('change'));
  ta.focus();
}

// Chamado a cada tecla digitada no textarea do corpo do texto — só atualiza o
// preview (rascunho em memória + redesenha o canvas), sem salvar no banco e sem
// reconstruir a sidebar (o que recriaria o textarea e derrubaria o foco/cursor a
// cada letra digitada). O salvamento de verdade continua no onchange (ao sair do campo).
function atualizarPreviewTexto(chave, valor, tipo) {
  layoutTextoRascunho[tipo][chave] = valor;
  renderLayoutBlocks(tipo, false);
}

async function salvarTextoDocumento(chave, valor, tipo) {
  const textos = { ...db().textos, [chave]: valor };
  const { error } = await salvarConfigEmpresa('textos', textos);
  if (error) { toast('Erro ao salvar texto: ' + error.message); return; }
  addLog('textos_atualizados', `${currentUser.email} atualizou o texto "${LABELS_TEXTO_DOC[chave]}"`);
  toast('Texto salvo!');
  if (tipo) { delete layoutTextoRascunho[tipo][chave]; renderLayoutBlocks(tipo); }
}

function selecionarBlocoLayout(tipo, id) {
  layoutSelecionado[tipo] = id;
  renderLayoutBlocks(tipo);
}

function renderLayoutSidebar(tipo) {
  const wrap = document.getElementById('layout-sidebar-' + tipo);
  if (!wrap) return;
  const blocos = layoutEditorState[tipo].blocos;
  const b = blocos.find(x => x.id === layoutSelecionado[tipo]);

  if (!b) {
    wrap.innerHTML = `
      <h4>Blocos do documento</h4>
      <p class="sub">${blocos.length} bloco(s) — clique em um no documento ou na lista</p>
      ${blocos.map(bl => `
        <div class="blkedit-list-item" onclick="selecionarBlocoLayout('${tipo}','${bl.id}')">
          <div><div>${bl.label}</div><div class="bli-type">${bl.tipo === 'fixo' ? 'Texto fixo' : 'Variável · ' + (getVariaveisDoc()[bl.variavel]||{}).label}</div></div>
          <span class="bli-del" onclick="event.stopPropagation(); removerBlocoLayout('${tipo}','${bl.id}')">${ic('x', 11)}</span>
        </div>`).join('')}
    `;
    return;
  }

  const varsDisponiveis = getVariaveisDoc();
  const opcoesVars = Object.keys(varsDisponiveis).map(k => `<option value="${k}" ${b.variavel===k?'selected':''}>${varsDisponiveis[k].label}</option>`).join('');

  wrap.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between">
      <h4>Editando bloco</h4>
      <span style="font-size:11px; color:var(--accent); cursor:pointer; font-weight:600" onclick="selecionarBlocoLayout('${tipo}',null)">← voltar</span>
    </div>
    <p class="sub">Alterações aparecem no documento em tempo real</p>

    <div class="blkedit-prop"><label>Nome do bloco</label><input type="text" value="${b.label}" onchange="atualizarBlocoLayout('${tipo}','label',this.value)"></div>

    <div class="blkedit-prop">
      <label>Tipo de conteúdo</label>
      <div class="blkedit-seg">
        <button class="${b.tipo==='fixo'?'active':''}" onclick="atualizarBlocoLayout('${tipo}','tipo','fixo')">Texto fixo</button>
        <button class="${b.tipo==='variavel'?'active':''}" onclick="atualizarBlocoLayout('${tipo}','tipo','variavel')">Variável dinâmica</button>
      </div>
    </div>

    ${b.tipo === 'fixo'
      ? `<div class="blkedit-prop"><label>Texto</label><textarea onchange="atualizarBlocoLayout('${tipo}','conteudo',this.value)">${b.conteudo||''}</textarea></div>`
      : `<div class="blkedit-prop"><label>Variável associada</label><select onchange="atualizarBlocoLayout('${tipo}','variavel',this.value)">${opcoesVars}</select></div>`}

    ${b.variavel === 'corpo_texto' ? renderEditorTextoDocumento(tipo) : ''}

    <div class="blkedit-prop"><label>Fonte</label>
      <select onchange="atualizarBlocoLayout('${tipo}','fonte',this.value)">
        ${Object.keys(FONTES_DOC).map(f => `<option value="${f}" ${b.fonte===f?'selected':''}>${FONTES_DOC[f].label}</option>`).join('')}
      </select>
    </div>

    <div class="blkedit-row">
      <div class="blkedit-prop"><label>Tamanho</label><input type="number" step="1" min="4" max="200" value="${b.tamanho}" onchange="atualizarBlocoLayout('${tipo}','tamanho',parseFloat(this.value)||b.tamanho)"></div>
      <div class="blkedit-prop"><label>Cor</label>
        <div class="blkedit-color-row">
          <input type="color" value="${b.cor}" onchange="atualizarBlocoLayout('${tipo}','cor',this.value)">
          <input type="text" value="${b.cor}" onchange="atualizarBlocoLayout('${tipo}','cor',this.value)">
        </div>
      </div>
    </div>
    ${b.variavel === 'situacao' ? `<p style="font-size:10.5px; color:var(--text-muted); margin-top:-8px; margin-bottom:12px">Essa variável já muda de cor sozinha (verde/laranja/vermelho) conforme o resultado — a cor acima só vale se não for essa variável.</p>` : ''}

    <div class="blkedit-prop"><label>Estilo</label>
      <div class="blkedit-toggle">
        <button class="${b.negrito?'active':''}" onclick="atualizarBlocoLayout('${tipo}','negrito',${!b.negrito})"><b>B</b> Negrito</button>
        <button class="${b.italico?'active':''}" onclick="atualizarBlocoLayout('${tipo}','italico',${!b.italico})"><i>I</i> Itálico</button>
      </div>
    </div>

    <div class="blkedit-prop"><label>Alinhamento</label>
      <div class="blkedit-seg">
        <button class="${b.align==='left'?'active':''}" onclick="atualizarBlocoLayout('${tipo}','align','left')">Esquerda</button>
        <button class="${b.align==='center'?'active':''}" onclick="atualizarBlocoLayout('${tipo}','align','center')">Centro</button>
        <button class="${b.align==='right'?'active':''}" onclick="atualizarBlocoLayout('${tipo}','align','right')">Direita</button>
        <button class="${b.align==='justify'?'active':''}" onclick="atualizarBlocoLayout('${tipo}','align','justify')">Justificar</button>
      </div>
    </div>

    <details class="blkedit-details">
      <summary>Posição e largura exatas (mm)</summary>
      <div class="blkedit-row3">
        <div class="blkedit-prop" style="margin-bottom:0"><label>X</label><input type="text" value="${b.x}" onchange="atualizarBlocoLayout('${tipo}','x',parseFloat(this.value)||b.x)"></div>
        <div class="blkedit-prop" style="margin-bottom:0"><label>Y</label><input type="text" value="${b.y}" onchange="atualizarBlocoLayout('${tipo}','y',parseFloat(this.value)||b.y)"></div>
        <div class="blkedit-prop" style="margin-bottom:0"><label>Largura</label><input type="text" value="${b.largura}" onchange="atualizarBlocoLayout('${tipo}','largura',parseFloat(this.value)||b.largura)"></div>
      </div>
      <p style="font-size:11px; color:var(--text-muted); margin-top:8px">Também dá pra arrastar as alcinhas azuis nas laterais do bloco no documento.</p>
    </details>

    <div style="height:1px; background:var(--border); margin:14px 0"></div>
    <button class="btn btn-danger btn-sm btn-block" onclick="removerBlocoLayout('${tipo}','${b.id}')" style="display:inline-flex; align-items:center; justify-content:center; gap:6px">${ic('trash', 13)}Remover bloco</button>
  `;
}

function atualizarBlocoLayout(tipo, campo, valor) {
  const b = layoutEditorState[tipo].blocos.find(x => x.id === layoutSelecionado[tipo]);
  if (!b) return;
  if (campo === 'align' && valor !== b.align) {
    // b.x significa coisas diferentes conforme o alinhamento: borda esquerda
    // (esquerda/justificado), centro (centralizado) ou borda direita (direita)
    // — é assim que o CSS (translateX) e o jsPDF (align) interpretam. Sem
    // recalcular aqui, o bloco pulava de lugar toda vez que o alinhamento mudava.
    const paraEsquerda = (align, x) => align === 'center' ? x - b.largura / 2 : align === 'right' ? x - b.largura : x;
    const daEsquerda = (align, esquerda) => align === 'center' ? esquerda + b.largura / 2 : align === 'right' ? esquerda + b.largura : esquerda;
    b.x = daEsquerda(valor, paraEsquerda(b.align, b.x));
  }
  b[campo] = valor;
  if (campo === 'tipo' && valor === 'variavel' && !b.variavel) b.variavel = 'fornecedor';
  renderLayoutBlocks(tipo);
}

function adicionarBlocoLayout(tipo) {
  const novo = { id: 'custom' + (layoutIdCounter++), label: 'Novo texto', tipo: 'fixo', conteudo: 'Clique para editar este texto', fonte: 'helvetica', tamanho: 12, cor: '#333333', negrito: false, italico: false, align: 'left', x: 30, y: 100, largura: 140 };
  layoutEditorState[tipo].blocos.push(novo);
  selecionarBlocoLayout(tipo, novo.id);
  toast('Bloco adicionado — arraste ou puxe as bordas pra ajustar');
}

function removerBlocoLayout(tipo, id) {
  layoutEditorState[tipo].blocos = layoutEditorState[tipo].blocos.filter(b => b.id !== id);
  if (layoutSelecionado[tipo] === id) layoutSelecionado[tipo] = null;
  renderLayoutBlocks(tipo);
  toast('Bloco removido');
}

// Centro horizontal do bloco em px de tela, considerando o alinhamento do texto
// (à esquerda o "centro" fica à direita da âncora x; à direita fica à esquerda; ao centro é o próprio x).
function blocoCentroXpx(b, dims) {
  const xPx = b.x * dims.scale;
  const wPx = (b.largura || 0) * dims.scale;
  if (b.align === 'center') return xPx;
  if (b.align === 'right') return xPx - wPx / 2;
  return xPx + wPx / 2;
}
function xDoCentroPx(centroPx, largura, align, dims) {
  const wPx = (largura || 0) * dims.scale;
  let xPx;
  if (align === 'center') xPx = centroPx;
  else if (align === 'right') xPx = centroPx + wPx / 2;
  else xPx = centroPx - wPx / 2;
  return +(xPx / dims.scale).toFixed(1);
}

function startDragBlock(e, tipo, id) {
  e.preventDefault(); e.stopPropagation();
  selecionarBlocoLayout(tipo, id);
  const rect = document.getElementById('layout-canvas-' + tipo).getBoundingClientRect();
  const dims = getDimsZoom(tipo);
  const b = layoutEditorState[tipo].blocos.find(x => x.id === id);
  // Guarda a diferença entre onde o mouse clicou e a âncora (x,y) do bloco,
  // pra manter essa mesma diferença durante todo o arraste — assim a caixa
  // não "pula" pra debaixo do cursor quando você clica no meio dela, e sim
  // acompanha suave a partir do ponto onde você segurou.
  const offsetX = (e.clientX - rect.left) - b.x * dims.scale;
  const offsetY = (e.clientY - rect.top) - b.y * dims.scale;
  dragInfo = { tipo, id, rect, offsetX, offsetY };
  document.body.style.cursor = 'grabbing';
  document.addEventListener('mousemove', onDragBlock);
  document.addEventListener('mouseup', endDragBlock);
}
function onDragBlock(e) {
  if (!dragInfo) return;
  const { rect, tipo, id, offsetX, offsetY } = dragInfo;
  const dims = getDimsZoom(tipo);
  const b = layoutEditorState[tipo].blocos.find(x => x.id === id);
  const margemPx = MARGEM_PAGINA_MM * dims.scale;
  const xPxBruto = (e.clientX - rect.left) - offsetX;
  const yPxBruto = (e.clientY - rect.top) - offsetY;

  // Limites reais da âncora — "x" significa borda esquerda, centro ou borda direita
  // dependendo do align (mesma lógica de atualizarBlocoLayout), então o limite muda
  // conforme o alinhamento. Sem isso, um bloco centralizado deixava passar metade da
  // largura da borda antes de travar (só a âncora crua era limitada).
  const larguraPx = b.largura * dims.scale;
  let minX, maxX;
  if (b.align === 'center') { minX = margemPx + larguraPx / 2; maxX = rect.width - margemPx - larguraPx / 2; }
  else if (b.align === 'right') { minX = margemPx + larguraPx; maxX = rect.width - margemPx; }
  else { minX = margemPx; maxX = rect.width - margemPx - larguraPx; }
  const loX = Math.min(minX, maxX), hiX = Math.max(minX, maxX);
  const xPx = Math.max(loX, Math.min(hiX, xPxBruto));

  // Limite vertical considerando a altura real do bloco (calcularLinhasBloco),
  // não só o topo — senão um parágrafo longo estourava a margem de baixo.
  const alturaPx = alturaBlocoPx(tipo, b);
  const minY = margemPx, maxY = rect.height - margemPx - alturaPx;
  const loY = Math.min(minY, maxY), hiY = Math.max(minY, maxY);
  const yPx = Math.max(loY, Math.min(hiY, yPxBruto));

  b.x = +(xPx / dims.scale).toFixed(1);
  b.y = +(yPx / dims.scale).toFixed(1);

  // ---- Guias de alinhamento: centro da página + centro/posição de outros blocos ----
  const outros = layoutEditorState[tipo].blocos.filter(x => x.id !== id);
  const candidatosCentroX = [rect.width / 2, ...outros.map(o => blocoCentroXpx(o, dims))];
  const candidatosY = [rect.height / 2, ...outros.map(o => o.y * dims.scale)];

  let snapV = null;
  const meuCentroX = blocoCentroXpx(b, dims);
  for (const cx of candidatosCentroX) {
    if (Math.abs(meuCentroX - cx) <= SNAP_PX) { b.x = xDoCentroPx(cx, b.largura, b.align, dims); snapV = cx; break; }
  }
  let snapH = null;
  for (const cy of candidatosY) {
    if (Math.abs(yPx - cy) <= SNAP_PX) { b.y = +(cy / dims.scale).toFixed(1); snapH = cy; break; }
  }
  layoutGuides[tipo] = { v: snapV, h: snapH };
  renderLayoutBlocks(tipo);
}
function endDragBlock() {
  const tipo = dragInfo && dragInfo.tipo;
  dragInfo = null;
  document.body.style.cursor = '';
  document.removeEventListener('mousemove', onDragBlock);
  document.removeEventListener('mouseup', endDragBlock);
  if (tipo) { layoutGuides[tipo] = { v: null, h: null }; renderLayoutBlocks(tipo); }
}

function startResizeLayout(e, tipo, id, lado) {
  e.preventDefault(); e.stopPropagation();
  selecionarBlocoLayout(tipo, id);
  const b = layoutEditorState[tipo].blocos.find(x => x.id === id);
  // Converte x pra "borda esquerda visual" de acordo com o alinhamento atual
  // (é o mesmo x que muda de significado: esquerda/justificado = borda
  // esquerda, centro = centro, direita = borda direita).
  const startEsquerda = b.align === 'center' ? b.x - b.largura / 2 : b.align === 'right' ? b.x - b.largura : b.x;
  resizeInfo = { tipo, id, lado, startX: e.clientX, startLargura: b.largura, startEsquerda };
  document.addEventListener('mousemove', onResizeLayout);
  document.addEventListener('mouseup', endResizeLayout);
}
function onResizeLayout(e) {
  if (!resizeInfo) return;
  const { tipo, id, lado, startX, startLargura, startEsquerda } = resizeInfo;
  const dims = getDimsZoom(tipo);
  const b = layoutEditorState[tipo].blocos.find(x => x.id === id);
  const deltaMm = (e.clientX - startX) / dims.scale;
  const direitaAtual = startEsquerda + startLargura;
  const larguraMinima = 20;

  let novaEsquerda = startEsquerda;
  let novaLargura;
  if (lado === 'left') {
    // Arrastar a alça esquerda move a borda esquerda — a direita fica parada. Não
    // deixa a borda esquerda passar da margem da página.
    novaEsquerda = Math.max(MARGEM_PAGINA_MM, startEsquerda + deltaMm);
    novaLargura = direitaAtual - novaEsquerda;
    if (novaLargura < larguraMinima) { novaLargura = larguraMinima; novaEsquerda = direitaAtual - novaLargura; }
  } else {
    // Arrastar a alça direita move a borda direita — a esquerda fica parada. Não
    // deixa a borda direita passar da margem da página (o teto depende de onde a
    // borda esquerda está, por isso não dá pra usar um valor fixo tipo "dims.W - 10").
    const larguraMaxima = dims.W - MARGEM_PAGINA_MM - startEsquerda;
    novaLargura = Math.max(larguraMinima, Math.min(startLargura + deltaMm, larguraMaxima));
  }
  novaLargura = +novaLargura.toFixed(1);
  novaEsquerda = +novaEsquerda.toFixed(1);

  b.largura = novaLargura;
  b.x = +(b.align === 'center' ? novaEsquerda + novaLargura / 2 : b.align === 'right' ? novaEsquerda + novaLargura : novaEsquerda).toFixed(1);
  renderLayoutBlocks(tipo);
}
function endResizeLayout() {
  resizeInfo = null;
  document.removeEventListener('mousemove', onResizeLayout);
  document.removeEventListener('mouseup', endResizeLayout);
}

async function salvarLayout(tipo) {
  const { error } = await salvarConfigEmpresa('layout', layoutEditorState);
  if (error) { toast('Erro ao salvar layout: ' + error.message); return; }
  addLog('layout_atualizado', `${currentUser.email} atualizou o layout do documento (${tipo === 'cert' ? 'certificado' : 'carta'})`);
  toast('Layout salvo!');
}

function restaurarLayoutPadrao(tipo) {
  if (!confirm('Restaurar as posições padrão deste documento? Blocos personalizados que você criou serão removidos.')) return;
  layoutEditorState[tipo] = JSON.parse(JSON.stringify(getLayoutDefaults()[tipo]));
  layoutSelecionado[tipo] = null;
  renderLayoutBlocks(tipo);
}

// ---- Campos personalizados do fornecedor ----
function renderCamposFornecedorLista() {
  const d = db();
  const wrap = document.getElementById('campos-fornecedor-lista');
  if (!wrap) return;
  if (!d.camposFornecedorCustom.length) { wrap.innerHTML = '<p style="font-size:12px; color:var(--text-muted)">Nenhum campo personalizado ainda.</p>'; return; }
  const TIPO_LABEL = { select: 'Lista', data: 'Data', texto: 'Texto' };
  wrap.innerHTML = d.camposFornecedorCustom.map(c => `
    <div class="field-row">
      <div>
        <div class="field-row-label">${c.label}</div>
        <div class="field-row-meta">${c.chave} · ${TIPO_LABEL[c.tipo] || 'Texto'}</div>
      </div>
      <button class="btn btn-danger btn-sm" onclick="removeCampoFornecedorCustom('${c.chave}')">Remover</button>
    </div>
  `).join('');
}

async function addCampoFornecedorCustom() {
  const chave = document.getElementById('ncf-chave').value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
  const label = document.getElementById('ncf-label').value.trim();
  const tipo = document.getElementById('ncf-tipo').value;
  const opcoes = document.getElementById('ncf-opcoes').value.split(',').map(s => s.trim()).filter(Boolean);
  if (!chave || !label) { toast('Informe a chave e o rótulo do campo.'); return; }
  const d = db();
  if (d.camposFornecedorCustom.some(c => c.chave === chave)) { toast('Já existe um campo com essa chave.'); return; }

  const novaLista = [...d.camposFornecedorCustom, { chave, label, tipo, opcoes: tipo === 'select' ? opcoes : [] }];

  const { error } = await supabaseClient
    .from('empresas')
    .update({ campos_fornecedor_custom: novaLista })
    .eq('id', currentUser.empresaId);

  if (error) { toast('Erro ao salvar campo: ' + error.message); return; }

  empresaConfigCache.campos_fornecedor_custom = novaLista;
  addLog('campo_fornecedor_criado', `${currentUser.email} criou o campo personalizado "${label}" para fornecedores`);
  document.getElementById('ncf-chave').value = '';
  document.getElementById('ncf-label').value = '';
  document.getElementById('ncf-opcoes').value = '';
  renderCamposFornecedorLista();
  toast('Campo adicionado! Já aparece no cadastro de fornecedores.');
}

async function removeCampoFornecedorCustom(chave) {
  if (!confirm('Remover este campo? Os valores já preenchidos nos fornecedores serão mantidos, mas o campo não aparecerá mais nos formulários.')) return;
  const d = db();
  const novaLista = d.camposFornecedorCustom.filter(c => c.chave !== chave);

  const { error } = await supabaseClient
    .from('empresas')
    .update({ campos_fornecedor_custom: novaLista })
    .eq('id', currentUser.empresaId);

  if (error) { toast('Erro ao remover campo: ' + error.message); return; }

  empresaConfigCache.campos_fornecedor_custom = novaLista;
  addLog('campo_fornecedor_removido', `${currentUser.email} removeu um campo personalizado de fornecedores`);
  renderCamposFornecedorLista();
  toast('Campo removido.');
}

// ---- Tipos de documento ----
function renderTiposDocumentoLista() {
  const d = db();
  const wrap = document.getElementById('tipos-documento-lista');
  if (!wrap) return;
  if (!d.tiposDocumento.length) { wrap.innerHTML = '<p style="font-size:12px; color:var(--text-muted)">Nenhum tipo cadastrado ainda.</p>'; return; }
  wrap.innerHTML = d.tiposDocumento.map(t => `
    <span style="display:inline-flex; align-items:center; gap:10px; padding:9px 10px 9px 16px; border:1px solid var(--border-strong); border-radius:999px; font-size:13px; background:var(--surface)">
      ${t}
      <button onclick="removeTipoDocumento('${t.replace(/'/g, "\\'")}')" style="border:none; background:var(--surface2); color:var(--text-muted); width:20px; height:20px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center" title="Remover">${ic('x', 11)}</button>
    </span>
  `).join('');
}

async function addTipoDocumento() {
  const input = document.getElementById('ntd-nome');
  const nome = input.value.trim();
  if (!nome) { toast('Informe o nome do tipo de documento.'); return; }
  const d = db();
  if (d.tiposDocumento.some(t => t.toLowerCase() === nome.toLowerCase())) { toast('Esse tipo já está cadastrado.'); return; }
  const novaLista = [...d.tiposDocumento, nome];

  const { error } = await supabaseClient.from('empresas').update({ tipos_documento: novaLista }).eq('id', currentUser.empresaId);
  if (error) { toast('Erro ao salvar tipo de documento: ' + error.message); return; }

  empresaConfigCache.tipos_documento = novaLista;
  addLog('tipo_documento_criado', `${currentUser.email} cadastrou o tipo de documento "${nome}"`);
  input.value = '';
  renderTiposDocumentoLista();
  toast('Tipo de documento adicionado!');
}

async function removeTipoDocumento(nome) {
  const d = db();
  const novaLista = d.tiposDocumento.filter(t => t !== nome);

  const { error } = await supabaseClient.from('empresas').update({ tipos_documento: novaLista }).eq('id', currentUser.empresaId);
  if (error) { toast('Erro ao remover tipo de documento: ' + error.message); return; }

  empresaConfigCache.tipos_documento = novaLista;
  addLog('tipo_documento_removido', `${currentUser.email} removeu o tipo de documento "${nome}"`);
  renderTiposDocumentoLista();
  toast('Tipo removido.');
}

// inicializar previews/editor ao entrar nas abas
const _origShowConfigTabAd = showConfigTabAd;
showConfigTabAd = function(tab, btn) {
  _origShowConfigTabAd(tab, btn);
  if (tab === 'layout') {
    renderFundoPreview('ap_fundo_certificado', 'fundo-cert-preview');
    renderFundoPreview('ap_fundo_carta', 'fundo-carta-preview');
    initLayoutEditor();
  }
  if (tab === 'camposfor') {
    renderCamposFornecedorLista();
  }
  if (tab === 'tiposdoc') {
    renderTiposDocumentoLista();
  }
};
