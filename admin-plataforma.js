let empresasCachePlataforma = [];

// Conexão com o Supabase — embutida aqui (não depende de nenhum outro
// arquivo da pasta principal do HomologPro, essa página é independente).
const SUPABASE_URL = 'https://qmvfsgwzbrhbxyonntgh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_JjiXWFQTcOrUf5RXjsfeVw_5cwLPHf3';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

function toastPlataforma(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 3000);
}

async function doLoginPlataforma() {
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

  const ok = await carregarEmpresasPlataforma();
  if (!ok) {
    errBox.textContent = 'Acesso negado. Essa conta não tem permissão de administrador da plataforma.';
    errBox.style.display = 'block';
    await supabaseClient.auth.signOut();
  }
}

async function sairPlataforma() {
  await supabaseClient.auth.signOut();
  document.getElementById('app-view').style.display = 'none';
  document.getElementById('login-view').style.display = 'flex';
  document.getElementById('login-email').value = '';
  document.getElementById('login-senha').value = '';
}

// Retorna true/false — usado tanto no login quanto pra recarregar a lista depois de editar.
async function carregarEmpresasPlataforma() {
  const { data, error } = await supabaseClient.functions.invoke('superadmin-listar-empresas');

  if (error || (data && data.ok === false)) {
    return false;
  }

  empresasCachePlataforma = data.empresas || [];
  document.getElementById('login-view').style.display = 'none';
  document.getElementById('app-view').style.display = 'block';
  document.getElementById('topbar-sub').textContent = `${empresasCachePlataforma.length} empresa(s) cadastrada(s)`;
  renderEmpresasPlataforma();
  carregarPacotesPlataforma();
  carregarValorBasePadrao();
  carregarPlanosConfig();
  return true;
}

function badgeStatusHTML(status) {
  const labels = { trial: 'Trial', ativa: 'Ativa', expirada: 'Expirada', cancelada: 'Cancelada' };
  return `<span class="badge badge-${status}">${labels[status] || status}</span>`;
}

function renderEmpresasPlataforma() {
  const wrap = document.getElementById('empresas-wrap');

  if (!empresasCachePlataforma.length) {
    wrap.innerHTML = '<div class="empty-state">Nenhuma empresa cadastrada ainda.</div>';
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Empresa</th>
          <th>Status</th>
          <th>Trial até</th>
          <th>Plano</th>
          <th style="text-align:right">Valor atual</th>
          <th style="text-align:center">Usuários</th>
          <th style="text-align:center">Fornecedores</th>
          <th style="text-align:center">Avaliações</th>
          <th style="text-align:center">Limite forn.</th>
          <th style="text-align:center">Limite admins</th>
          <th>Criada em</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${empresasCachePlataforma.map(emp => `
          <tr>
            <td style="font-weight:600">${emp.nome} ${badgeStatusHTML(emp.status)}</td>
            <td>
              <select id="pf-status-${emp.id}">
                <option value="trial" ${emp.status === 'trial' ? 'selected' : ''}>Trial</option>
                <option value="ativa" ${emp.status === 'ativa' ? 'selected' : ''}>Ativa</option>
                <option value="expirada" ${emp.status === 'expirada' ? 'selected' : ''}>Expirada</option>
                <option value="cancelada" ${emp.status === 'cancelada' ? 'selected' : ''}>Cancelada</option>
              </select>
            </td>
            <td><input type="date" id="pf-trial-${emp.id}" value="${emp.trial_termina_em ? emp.trial_termina_em.slice(0, 10) : ''}"></td>
            <td>
              <select id="pf-plano-${emp.id}">
                <option value="" ${!emp.plano ? 'selected' : ''}>—</option>
                <option value="essencial" ${emp.plano === 'essencial' ? 'selected' : ''}>Essencial</option>
                <option value="profissional" ${emp.plano === 'profissional' ? 'selected' : ''}>Profissional</option>
                <option value="enterprise" ${emp.plano === 'enterprise' ? 'selected' : ''}>Enterprise</option>
              </select>
            </td>
            <td style="text-align:right">
              ${emp.valor_mensal_atual != null ? `R$ ${Number(emp.valor_mensal_atual).toFixed(2).replace('.', ',')}` : '<span style="color:var(--text-muted)">—</span>'}
              ${emp.proximo_valor_mensal != null ? `<div style="font-size:10px; color:var(--warn)">→ R$ ${Number(emp.proximo_valor_mensal).toFixed(2).replace('.', ',')} em ${new Date(emp.proximo_reajuste_em).toLocaleDateString('pt-BR')}</div>` : ''}
            </td>
            <td style="text-align:center">${emp.totalUsuarios}</td>
            <td style="text-align:center">${emp.totalFornecedores}</td>
            <td style="text-align:center">${emp.totalAvaliacoes}</td>
            <td><input type="number" min="0" placeholder="ilimitado" id="pf-limite-forn-${emp.id}" style="width:90px; text-align:center" value="${emp.limite_fornecedores ?? ''}"></td>
            <td><input type="number" min="0" placeholder="ilimitado" id="pf-limite-admins-${emp.id}" style="width:80px; text-align:center" value="${emp.limite_admins ?? ''}"></td>
            <td style="color:var(--text-muted); font-size:12px">${new Date(emp.criado_em).toLocaleDateString('pt-BR')}</td>
            <td>
              <button class="btn btn-primary btn-sm" onclick="salvarEmpresaPlataforma('${emp.id}')">Salvar</button>
              <button class="btn btn-secondary btn-sm" style="margin-top:4px" onclick="abrirModalEnterprise('${emp.id}')">Montar Enterprise</button>
              <button class="btn btn-secondary btn-sm" style="margin-top:4px" onclick="verArmazenamento('${emp.id}', this)">Ver armazenamento</button>
              <div id="armazenamento-${emp.id}" style="font-size:11px; color:var(--text-muted); margin-top:4px"></div>
              ${emp.status === 'cancelada' ? `<button class="btn btn-danger btn-sm" style="margin-top:4px" onclick="abrirModalExcluirEmpresa('${emp.id}')">Excluir definitivamente</button>` : ''}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function salvarEmpresaPlataforma(empresaId) {
  const status = document.getElementById(`pf-status-${empresaId}`).value;
  const trialDate = document.getElementById(`pf-trial-${empresaId}`).value;
  const plano = document.getElementById(`pf-plano-${empresaId}`).value;
  const limiteFornVal = document.getElementById(`pf-limite-forn-${empresaId}`).value;
  const limiteAdminsVal = document.getElementById(`pf-limite-admins-${empresaId}`).value;

  const body = {
    empresaId,
    status,
    trialTerminaEm: trialDate ? new Date(trialDate + 'T23:59:59').toISOString() : null,
    plano: plano || null,
    // vazio no campo = ilimitado (null no banco)
    limiteFornecedores: limiteFornVal === '' ? null : parseInt(limiteFornVal, 10),
    limiteAdmins: limiteAdminsVal === '' ? null : parseInt(limiteAdminsVal, 10),
  };

  const { data, error } = await supabaseClient.functions.invoke('superadmin-atualizar-empresa', { body });

  if (error || (data && data.ok === false)) {
    toastPlataforma('Erro: ' + ((data && data.error) || error?.message || 'falha ao salvar'));
    return;
  }

  toastPlataforma('Salvo!');
  await carregarEmpresasPlataforma();
}

// ============ REAJUSTE GERAL ============
function escopoReajusteSelecionado() {
  const escopo = [];
  if (document.getElementById('rg-essencial').checked) escopo.push('essencial');
  if (document.getElementById('rg-profissional').checked) escopo.push('profissional');
  if (document.getElementById('rg-enterprise').checked) escopo.push('enterprise');
  return escopo;
}

async function preverReajusteGeral() {
  const percentual = parseFloat(document.getElementById('rg-percentual').value);
  if (!percentual) { toastPlataforma('Digita um percentual válido.'); return; }
  const escopoPlanos = escopoReajusteSelecionado();
  if (!escopoPlanos.length) { toastPlataforma('Marca pelo menos um tipo de plano.'); return; }

  const wrap = document.getElementById('rg-preview-wrap');
  wrap.innerHTML = '<p class="sub" style="margin-top:12px">Calculando prévia...</p>';

  const { data, error } = await supabaseClient.functions.invoke('superadmin-reajustar-planos', {
    body: { percentual, modo: 'preview', escopoPlanos },
  });

  if (error || (data && data.ok === false)) {
    wrap.innerHTML = `<div class="empty-state" style="color:var(--danger)">Erro: ${(data && data.error) || error?.message}</div>`;
    return;
  }

  const linhasCatalogo = [...(data.catalogoPreview || []), ...(data.pacotesPreview || [])];
  const linhasEmpresas = data.empresasPreview || [];

  wrap.innerHTML = `
    <h3 style="font-size:13px; margin-top:18px; margin-bottom:8px">Catálogo (vale pra novos clientes)</h3>
    ${linhasCatalogo.length ? `<table><thead><tr><th>Item</th><th>Atual</th><th>Novo</th></tr></thead><tbody>
      ${linhasCatalogo.map(l => `<tr><td>${l.nome}</td><td>R$ ${l.precoAtual.toFixed(2).replace('.', ',')}</td><td style="color:var(--accent); font-weight:600">R$ ${l.precoNovo.toFixed(2).replace('.', ',')}</td></tr>`).join('')}
    </tbody></table>` : '<p class="sub">Nada no catálogo pra esse escopo.</p>'}

    <h3 style="font-size:13px; margin-top:18px; margin-bottom:8px">Clientes ativos (reajuste agendado pro próximo ciclo de cada um)</h3>
    ${linhasEmpresas.length ? `<table><thead><tr><th>Empresa</th><th>Plano</th><th>Atual</th><th>Novo</th></tr></thead><tbody>
      ${linhasEmpresas.map(l => `<tr><td>${l.nome}</td><td>${l.plano}</td><td>R$ ${l.valorAtual.toFixed(2).replace('.', ',')}</td><td style="color:var(--accent); font-weight:600">R$ ${l.valorNovo.toFixed(2).replace('.', ',')}</td></tr>`).join('')}
    </tbody></table>` : '<p class="sub">Nenhum cliente ativo nesse escopo (ou sem valor registrado ainda).</p>'}

    <button class="btn btn-primary" style="margin-top:16px" onclick="confirmarReajusteGeral(${percentual}, ${JSON.stringify(escopoPlanos)})">Confirmar reajuste</button>
  `;
}

async function confirmarReajusteGeral(percentual, escopoPlanos) {
  if (!confirm(`Confirma reajustar ${percentual}% pra ${escopoPlanos.join(', ')}? Isso já vai mexer nas assinaturas dos clientes ativos (com efeito no próximo ciclo de cada um) e mandar e-mail avisando.`)) return;

  toastPlataforma('Aplicando reajuste, pode levar alguns segundos...');
  const { data, error } = await supabaseClient.functions.invoke('superadmin-reajustar-planos', {
    body: { percentual, modo: 'aplicar', escopoPlanos },
  });

  if (error || (data && data.ok === false)) {
    toastPlataforma('Erro: ' + ((data && data.error) || error?.message));
    return;
  }

  document.getElementById('rg-preview-wrap').innerHTML = `
    <div class="link-result" style="margin-top:16px">
      Catálogo atualizado: ${data.catalogoAtualizado} plano(s) + ${data.pacotesAtualizados} pacote(s)<br>
      Clientes reajustados: ${data.empresasReajustadas}
      ${data.erros && data.erros.length ? `<br><br><b style="color:var(--danger)">Erros:</b><br>${data.erros.join('<br>')}` : ''}
    </div>
  `;
  await carregarPacotesPlataforma();
  await carregarEmpresasPlataforma();
}

// ============ ARMAZENAMENTO POR EMPRESA ============
async function verArmazenamento(empresaId, btnEl) {
  const alvo = document.getElementById(`armazenamento-${empresaId}`);
  const textoOriginal = btnEl.textContent;
  btnEl.disabled = true;
  btnEl.textContent = 'Calculando...';
  alvo.textContent = '';

  const { data, error } = await supabaseClient.functions.invoke('superadmin-calcular-armazenamento', {
    body: { empresaId },
  });

  btnEl.disabled = false;
  btnEl.textContent = textoOriginal;

  if (error || (data && data.ok === false)) {
    alvo.innerHTML = `<span style="color:var(--danger)">Erro ao calcular</span>`;
    return;
  }

  alvo.innerHTML = `<b>${data.totalFormatado}</b> (${data.totalArquivos} arquivo(s))`;
}

// ============ VALOR BASE PADRÃO (Enterprise) ============
let valorBasePadraoCache = 0;

async function carregarValorBasePadrao() {
  const { data, error } = await supabaseClient.from('configuracoes_plataforma').select('valor').eq('chave', 'enterprise_valor_base').maybeSingle();
  if (error || !data) { valorBasePadraoCache = 0; return; }
  valorBasePadraoCache = Number(data.valor) || 0;
  const campo = document.getElementById('cfg-valor-base-padrao');
  if (campo) campo.value = valorBasePadraoCache;
}

async function salvarValorBasePadrao() {
  const valor = parseFloat(document.getElementById('cfg-valor-base-padrao').value);
  if (isNaN(valor) || valor < 0) { toastPlataforma('Valor inválido.'); return; }

  const { error } = await supabaseClient.from('configuracoes_plataforma')
    .upsert({ chave: 'enterprise_valor_base', valor, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
  if (error) { toastPlataforma('Erro ao salvar: ' + error.message); return; }

  valorBasePadraoCache = valor;
  toastPlataforma('Valor base padrão salvo!');
}

// ============ PREÇOS DOS PLANOS (Essencial / Profissional) ============
// Usado só pra pré-preencher o valor base do modal Enterprise com o preço
// real do plano que a empresa já tem — não mexe em nada da cobrança dela.
let planosConfigCache = [];

async function carregarPlanosConfig() {
  const { data, error } = await supabaseClient.from('planos_config').select('chave, preco');
  if (error) { planosConfigCache = []; return; }
  planosConfigCache = data || [];
}

// ============ CATÁLOGO DE PACOTES ENTERPRISE ============
let pacotesCachePlataforma = [];

async function carregarPacotesPlataforma() {
  const { data, error } = await supabaseClient.from('pacotes_config').select('*').order('tipo').order('quantidade');
  if (error) {
    document.getElementById('pacotes-wrap').innerHTML = `<div class="empty-state">Erro ao carregar: ${error.message}</div>`;
    return;
  }
  pacotesCachePlataforma = data || [];
  renderPacotesPlataforma();
}

function renderPacotesPlataforma() {
  const wrap = document.getElementById('pacotes-wrap');
  if (!pacotesCachePlataforma.length) {
    wrap.innerHTML = '<div class="empty-state">Nenhum pacote cadastrado ainda — cria o primeiro aí embaixo.</div>';
    return;
  }
  wrap.innerHTML = `
    <table>
      <thead><tr><th>Nome</th><th>Tipo</th><th style="text-align:center">Qtd</th><th style="text-align:center">Preço</th><th style="text-align:center">Ativo</th><th></th></tr></thead>
      <tbody>
        ${pacotesCachePlataforma.map(p => `
          <tr>
            <td>${p.nome_exibicao}</td>
            <td>${p.tipo === 'admin' ? 'Admin' : 'Fornecedor'}</td>
            <td style="text-align:center">${p.quantidade}</td>
            <td style="text-align:center">R$ ${Number(p.preco).toFixed(2).replace('.', ',')}</td>
            <td style="text-align:center">
              <input type="checkbox" ${p.ativo ? 'checked' : ''} onchange="toggleAtivoPacote('${p.id}', this.checked)">
            </td>
            <td><button class="btn btn-secondary btn-sm" onclick="excluirPacote('${p.id}')">Excluir</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function salvarNovoPacote() {
  const tipo = document.getElementById('np-tipo').value;
  const quantidade = parseInt(document.getElementById('np-quantidade').value, 10);
  const preco = parseFloat(document.getElementById('np-preco').value);
  const nome = document.getElementById('np-nome').value.trim();

  if (!quantidade || quantidade <= 0) { toastPlataforma('Quantidade inválida.'); return; }
  if (isNaN(preco) || preco < 0) { toastPlataforma('Preço inválido.'); return; }
  if (!nome) { toastPlataforma('Dá um nome de exibição pro pacote.'); return; }

  const { error } = await supabaseClient.from('pacotes_config').insert({ tipo, quantidade, preco, nome_exibicao: nome });
  if (error) { toastPlataforma('Erro ao salvar: ' + error.message); return; }

  document.getElementById('np-quantidade').value = '';
  document.getElementById('np-preco').value = '';
  document.getElementById('np-nome').value = '';
  toastPlataforma('Pacote adicionado!');
  await carregarPacotesPlataforma();
}

async function toggleAtivoPacote(id, ativo) {
  const { error } = await supabaseClient.from('pacotes_config').update({ ativo }).eq('id', id);
  if (error) { toastPlataforma('Erro: ' + error.message); return; }
  const p = pacotesCachePlataforma.find(x => x.id === id);
  if (p) p.ativo = ativo;
}

async function excluirPacote(id) {
  if (!confirm('Excluir esse pacote do catálogo? Isso não afeta quem já tem ele na composição atual, só impede escolher de novo.')) return;
  const { error } = await supabaseClient.from('pacotes_config').delete().eq('id', id);
  if (error) { toastPlataforma('Erro ao excluir: ' + error.message); return; }
  toastPlataforma('Pacote excluído.');
  await carregarPacotesPlataforma();
}

// ============ CONSTRUTOR DE ENTERPRISE POR EMPRESA ============
let empresaEnterpriseAtual = null;
let pacotesEscolhidosModal = {}; // { pacoteId: quantidadeEscolhida }
let capacidadeInicialModal = { fornecedores: 0, admins: 0 }; // "foto" da capacidade no momento em que o modal abriu, pra mostrar "já tinha + adicionando" em vez de só o total final

function calcularCapacidadeAtual() {
  let fornecedores = 0, admins = 0;
  for (const [pacoteId, qtd] of Object.entries(pacotesEscolhidosModal)) {
    if (!qtd) continue;
    const pacote = pacotesCachePlataforma.find(p => p.id === pacoteId);
    if (!pacote) continue;
    const capacidade = pacote.quantidade * qtd;
    if (pacote.tipo === 'fornecedor') fornecedores += capacidade;
    if (pacote.tipo === 'admin') admins += capacidade;
  }
  return { fornecedores, admins };
}

async function abrirModalEnterprise(empresaId) {
  if (!pacotesCachePlataforma.length) await carregarPacotesPlataforma();

  const empresa = empresasCachePlataforma.find(e => e.id === empresaId);
  empresaEnterpriseAtual = empresaId;
  pacotesEscolhidosModal = {};

  document.getElementById('modal-enterprise-titulo').textContent = `Montar Enterprise — ${empresa ? empresa.nome : ''}`;

  // Prioridade pra decidir os pacotes pré-marcados:
  // 1) Empresa JÁ é Enterprise de verdade -> usa a composição salva dela
  //    (valor base incluso, exatamente como foi montado da última vez).
  // 2) Empresa está em Essencial/Profissional -> valor base continua
  //    sendo o valor base PADRÃO da plataforma (nunca o preço do plano
  //    dela), + pacotes com a quantidade que ela já tem hoje (limite_admins
  //    / limite_fornecedores) — a diferença de valor do plano antigo pro
  //    Enterprise vem só dos pacotes, não do valor base.
  // 3) Empresa sem plano nenhum (ex: trial puro) -> valor base padrão.
  let valorBaseInicial = valorBasePadraoCache || '';

  const composicaoExistente = empresa && empresa.plano === 'enterprise' && empresa.enterprise_composicao
    && Array.isArray(empresa.enterprise_composicao.pacotes)
    ? empresa.enterprise_composicao : null;

  if (composicaoExistente) {
    // Já é Enterprise confirmado: recupera o valor base e os pacotes exatos que tinha.
    valorBaseInicial = composicaoExistente.valorBase;
    for (const p of composicaoExistente.pacotes) {
      pacotesEscolhidosModal[p.pacoteId] = p.quantidadeEscolhida;
    }
  } else if (empresa && (empresa.plano === 'essencial' || empresa.plano === 'profissional')) {
    // Vem de Essencial/Profissional: valor base continua sendo o padrão da
    // plataforma — só a QUANTIDADE que ela já tinha entra pré-marcada.
    const pacoteAdmin1un = pacotesCachePlataforma.find(p => p.tipo === 'admin' && p.quantidade === 1 && p.ativo);
    const pacoteFornecedor1un = pacotesCachePlataforma.find(p => p.tipo === 'fornecedor' && p.quantidade === 1 && p.ativo);

    if (pacoteAdmin1un && empresa.limite_admins) pacotesEscolhidosModal[pacoteAdmin1un.id] = empresa.limite_admins;
    if (pacoteFornecedor1un && empresa.limite_fornecedores) pacotesEscolhidosModal[pacoteFornecedor1un.id] = empresa.limite_fornecedores;

    if ((empresa.limite_admins && !pacoteAdmin1un) || (empresa.limite_fornecedores && !pacoteFornecedor1un)) {
      toastPlataforma('Aviso: não achei um pacote de 1 unidade no catálogo pra representar a quantidade que o cliente já tinha — confere manualmente.');
    }
  }

  document.getElementById('me-valor-base').value = valorBaseInicial;
  document.getElementById('me-resultado').innerHTML = '';

  capacidadeInicialModal = calcularCapacidadeAtual();

  const pacotesAtivos = pacotesCachePlataforma.filter(p => p.ativo);
  const wrap = document.getElementById('me-pacotes-wrap');
  if (!pacotesAtivos.length) {
    wrap.innerHTML = '<div class="empty-state">Nenhum pacote ativo no catálogo ainda.</div>';
  } else {
    wrap.innerHTML = pacotesAtivos.map(p => {
      const qtdInicial = pacotesEscolhidosModal[p.id] || 0;
      return `
      <div class="pacote-row">
        <div class="pacote-nome">${p.nome_exibicao}<small>R$ ${Number(p.preco).toFixed(2).replace('.', ',')} cada · +${p.quantidade} ${p.tipo === 'admin' ? 'admin(s)' : 'fornecedor(es)'}</small></div>
        <div class="stepper">
          <button onclick="alterarQtdPacoteModal('${p.id}', -1)">−</button>
          <input type="number" min="0" value="${qtdInicial}" id="me-qtd-${p.id}" oninput="setQtdPacoteModal('${p.id}', this.value)">
          <button onclick="alterarQtdPacoteModal('${p.id}', 1)">+</button>
        </div>
      </div>
    `;
    }).join('');
  }

  recalcularTotalEnterprise();
  document.getElementById('modal-enterprise-overlay').classList.add('active');
}

function fecharModalEnterprise() {
  document.getElementById('modal-enterprise-overlay').classList.remove('active');
  empresaEnterpriseAtual = null;
}

function alterarQtdPacoteModal(pacoteId, delta) {
  const atual = pacotesEscolhidosModal[pacoteId] || 0;
  const novo = Math.max(0, atual + delta);
  pacotesEscolhidosModal[pacoteId] = novo;
  document.getElementById(`me-qtd-${pacoteId}`).value = novo;
  recalcularTotalEnterprise();
}

function setQtdPacoteModal(pacoteId, valorDigitado) {
  let novo = parseInt(valorDigitado, 10);
  if (isNaN(novo) || novo < 0) novo = 0;
  pacotesEscolhidosModal[pacoteId] = novo;
  document.getElementById(`me-qtd-${pacoteId}`).value = novo;
  recalcularTotalEnterprise();
}

function recalcularTotalEnterprise() {
  const valorBase = parseFloat(document.getElementById('me-valor-base').value) || 0;
  let total = valorBase;

  const capacidadeAtual = calcularCapacidadeAtual();
  for (const [pacoteId, qtd] of Object.entries(pacotesEscolhidosModal)) {
    if (!qtd) continue;
    const pacote = pacotesCachePlataforma.find(p => p.id === pacoteId);
    if (!pacote) continue;
    total += Number(pacote.preco) * qtd;
  }

  const fornAdicionado = capacidadeAtual.fornecedores - capacidadeInicialModal.fornecedores;
  const adminAdicionado = capacidadeAtual.admins - capacidadeInicialModal.admins;

  document.getElementById('me-total-valor').textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
  document.getElementById('me-total-fornecedores').textContent = fornAdicionado > 0
    ? `${capacidadeInicialModal.fornecedores} + ${fornAdicionado}` : `${capacidadeAtual.fornecedores}`;
  document.getElementById('me-total-admins').textContent = adminAdicionado > 0
    ? `${capacidadeInicialModal.admins} + ${adminAdicionado}` : `${capacidadeAtual.admins}`;
}

async function gerarCheckoutEnterprise() {
  if (!empresaEnterpriseAtual) return;
  const valorBase = parseFloat(document.getElementById('me-valor-base').value) || 0;
  const pacotes = Object.entries(pacotesEscolhidosModal)
    .filter(([, qtd]) => qtd > 0)
    .map(([pacoteId, quantidade]) => ({ pacoteId, quantidade }));

  const resultBox = document.getElementById('me-resultado');
  resultBox.innerHTML = '<p class="sub" style="margin-top:12px">Gerando link...</p>';

  const { data, error } = await supabaseClient.functions.invoke('superadmin-gerar-checkout-enterprise', {
    body: { empresaId: empresaEnterpriseAtual, valorBase, pacotes },
  });

  if (error || (data && data.ok === false)) {
    resultBox.innerHTML = `<div class="empty-state" style="color:var(--danger)">Erro: ${(data && data.error) || error?.message || 'falha ao gerar'}</div>`;
    return;
  }

  if (data.trocaImediata) {
    resultBox.innerHTML = `
      <div class="link-result">
        ${data.mensagem || 'Plano atualizado com sucesso!'}
      </div>
    `;
    await carregarEmpresasPlataforma();
    return;
  }

  resultBox.innerHTML = `
    <div class="link-result">
      Link gerado! Copia e manda pro cliente:<br>
      <input type="text" readonly value="${data.url}" style="margin-top:6px" onclick="this.select()">
      <button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="navigator.clipboard.writeText('${data.url}'); toastPlataforma('Link copiado!')">Copiar link</button>
    </div>
  `;
  await carregarEmpresasPlataforma();
}

// ============ EXCLUSÃO DEFINITIVA DE EMPRESA ============
let empresaExcluirAtual = null;

function abrirModalExcluirEmpresa(empresaId) {
  const empresa = empresasCachePlataforma.find(e => e.id === empresaId);
  if (!empresa) return;

  if (empresa.status !== 'cancelada') {
    toastPlataforma('Só é possível excluir definitivamente empresas com status "cancelada".');
    return;
  }

  empresaExcluirAtual = empresa;
  document.getElementById('modal-excluir-empresa-titulo').textContent = `Excluir "${empresa.nome}" definitivamente`;
  document.getElementById('ee-nome-confirmacao').value = '';
  document.getElementById('ee-resultado').innerHTML = '';
  document.getElementById('ee-btn-confirmar').disabled = true;
  document.getElementById('modal-excluir-empresa-overlay').classList.add('active');
}

function fecharModalExcluirEmpresa() {
  document.getElementById('modal-excluir-empresa-overlay').classList.remove('active');
  empresaExcluirAtual = null;
}

function validarConfirmacaoExcluirEmpresa() {
  const digitado = document.getElementById('ee-nome-confirmacao').value.trim();
  const btn = document.getElementById('ee-btn-confirmar');
  btn.disabled = !(empresaExcluirAtual && digitado === empresaExcluirAtual.nome);
}

async function confirmarExcluirEmpresa() {
  if (!empresaExcluirAtual) return;
  const nomeConfirmacao = document.getElementById('ee-nome-confirmacao').value.trim();

  if (!confirm(`Última confirmação: excluir "${empresaExcluirAtual.nome}" e TODOS os dados dela pra sempre? Não tem como desfazer.`)) return;

  const resultBox = document.getElementById('ee-resultado');
  resultBox.innerHTML = '<p class="sub" style="margin-top:12px">Excluindo — pode levar alguns segundos...</p>';
  document.getElementById('ee-btn-confirmar').disabled = true;

  const { data, error } = await supabaseClient.functions.invoke('superadmin-excluir-empresa-definitivamente', {
    body: { empresaId: empresaExcluirAtual.id, nomeConfirmacao },
  });

  if (error || (data && data.ok === false)) {
    resultBox.innerHTML = `<div class="empty-state" style="color:var(--danger)">Erro: ${(data && data.error) || error?.message || 'falha ao excluir'}</div>`;
    document.getElementById('ee-btn-confirmar').disabled = false;
    return;
  }

  toastPlataforma('Empresa excluída definitivamente.');
  fecharModalExcluirEmpresa();
  await carregarEmpresasPlataforma();
}

// Se já tiver sessão ativa (voltou pra página logado), tenta carregar direto.
(async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) await carregarEmpresasPlataforma();
})();
