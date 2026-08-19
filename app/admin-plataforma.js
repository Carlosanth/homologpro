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

// supabaseClient.functions.invoke() não coloca a mensagem de erro real
// (o "error" que a Edge Function devolve no corpo JSON) em error.message —
// ele só devolve um texto genérico tipo "Edge Function returned a non-2xx
// status code". A mensagem de verdade fica em error.context, que é a
// Response bruta; essa função lê o corpo dela pra mostrar o motivo real.
async function mensagemErroFuncao(error) {
  if (!error) return 'Erro desconhecido.';
  try {
    if (error.context && typeof error.context.json === 'function') {
      const corpo = await error.context.clone().json();
      if (corpo && corpo.error) return corpo.error;
    }
  } catch (_e) {
    // corpo não veio em JSON — segue pro fallback abaixo
  }
  return error.message || 'Erro desconhecido.';
}

async function doLoginPlataforma() {
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const senha = document.getElementById('login-senha').value;
  const errBox = document.getElementById('login-error');
  errBox.style.display = 'none';

  const btn = document.getElementById('login-btn');
  const textoOriginalBtn = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-spinner"></span>';

  const { error: erroLogin } = await supabaseClient.auth.signInWithPassword({ email, password: senha });
  if (erroLogin) {
    errBox.textContent = 'E-mail ou senha inválidos.';
    errBox.style.display = 'block';
    btn.disabled = false;
    btn.innerHTML = textoOriginalBtn;
    return;
  }

  const ok = await carregarEmpresasPlataforma();
  if (!ok) {
    errBox.textContent = 'Acesso negado. Essa conta não tem permissão de administrador da plataforma.';
    errBox.style.display = 'block';
    await supabaseClient.auth.signOut();
    btn.disabled = false;
    btn.innerHTML = textoOriginalBtn;
  }
  // Em caso de sucesso não precisa restaurar o botão — a tela de login
  // já vai ser escondida por carregarEmpresasPlataforma().
}

async function sairPlataforma() {
  await supabaseClient.auth.signOut();
  document.getElementById('app-view').style.display = 'none';
  document.getElementById('login-view').style.display = 'flex';
  document.getElementById('login-email').value = '';
  document.getElementById('login-senha').value = '';
  const btn = document.getElementById('login-btn');
  btn.disabled = false;
  btn.innerHTML = 'Entrar';
}

// Retorna true/false — usado tanto no login quanto pra recarregar a lista depois de editar.
async function carregarEmpresasPlataforma() {
  const { data, error } = await supabaseClient.functions.invoke('superadmin-listar-empresas');

  if (error || (data && data.ok === false)) {
    return false;
  }

  empresasCachePlataforma = data.empresas || [];
  await carregarNotasFiscaisPlataforma();
  document.getElementById('login-view').style.display = 'none';
  document.getElementById('app-view').style.display = 'block';
  document.getElementById('topbar-sub').textContent = `${empresasCachePlataforma.length} empresa(s) cadastrada(s)`;
  renderKPIsPlataforma();
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

function renderEmpresasPlataforma(listaFiltrada) {
  const wrap = document.getElementById('empresas-wrap');
  const lista = listaFiltrada || empresasCachePlataforma;

  if (!lista.length) {
    wrap.innerHTML = `<div class="empty-state">${empresasCachePlataforma.length ? 'Nenhuma empresa encontrada com esse filtro.' : 'Nenhuma empresa cadastrada ainda.'}</div>`;
    return;
  }

  wrap.innerHTML = `
    <div class="emp-list">
      ${lista.map(emp => `
        <div class="emp-card">
          <div class="emp-row">
            <div class="emp-id">
              <div class="nome">
                ${emp.nome} ${badgeStatusHTML(emp.status)}
                ${emp.status === 'cancelada' && emp.cancelada_em ? `<span class="badge-tempo-cancelada${ehCanceladaHaMaisDeUmAno(emp) ? ' antiga' : ''}">cancelada ${formatarTempoDesde(emp.cancelada_em)}</span>` : ''}
                <span onclick="abrirModalDetalhesEmpresa('${emp.id}')" title="Ver detalhes completos" class="info-ico">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                </span>
                <span onclick="copiarCaminhoR2('${emp.id}')" title="Copiar caminho da pasta no R2" class="info-ico">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </span>
              </div>
              <div class="meta">
                <span>Criada em ${new Date(emp.criado_em).toLocaleDateString('pt-BR')}</span>
                ${emp.adminMasterEmail ? `<span>✉️ ${emp.adminMasterEmail}</span>` : ''}
                ${emp.cnpj ? `<span>CNPJ ${emp.cnpj}</span>` : ''}
              </div>
            </div>

            <div class="emp-stats">
              <div class="stat plano"><div class="n">${emp.plano ? emp.plano[0].toUpperCase() + emp.plano.slice(1) : '—'}</div><div class="l">Plano</div></div>
              <div class="stat valor"><div class="n${emp.valor_mensal_atual == null ? ' vazio' : ''}">${emp.valor_mensal_atual != null ? `R$ ${Number(emp.valor_mensal_atual).toFixed(2).replace('.', ',')}` : '—'}</div><div class="l">Valor</div></div>
              <div class="stat"><div class="n">${emp.totalUsuarios}</div><div class="l">Usuários</div></div>
              <div class="stat"><div class="n">${emp.totalFornecedores}</div><div class="l">Fornec.</div></div>
            </div>

            <div class="emp-actions">
              <button class="btn btn-secondary btn-sm" onclick="toggleEditEmpresa('${emp.id}')">Editar</button>
              <button class="btn btn-secondary btn-sm" onclick="abrirModalEnterprise('${emp.id}')">Montar Enterprise</button>
              <button class="btn btn-secondary btn-sm warn" onclick="abrirModalNotasFiscais('${emp.id}')">
                🧾 NF${contarNotasPendentes(emp.id) > 0 ? ` <span class="badge badge-nf-pendente">${contarNotasPendentes(emp.id)}</span>` : ''}
              </button>
              <div class="kebab-wrap">
                <button class="btn btn-secondary btn-sm btn-icon" onclick="toggleKebabEmpresa('${emp.id}')">⋮</button>
                <div class="kebab-menu" id="kebab-${emp.id}">
                  <button onclick="abrirModalDetalhesEmpresa('${emp.id}')">Ver detalhes completos</button>
                  ${emp.status === 'cancelada' ? `<button class="danger" onclick="abrirModalExcluirEmpresa('${emp.id}')">Excluir definitivamente</button>` : ''}
                </div>
              </div>
            </div>
          </div>

          <div class="emp-edit" id="edit-${emp.id}">
            <div class="edit-grid">
              <div class="field">
                <label>Status</label>
                <select id="pf-status-${emp.id}">
                  <option value="trial" ${emp.status === 'trial' ? 'selected' : ''}>Trial</option>
                  <option value="ativa" ${emp.status === 'ativa' ? 'selected' : ''}>Ativa</option>
                  <option value="expirada" ${emp.status === 'expirada' ? 'selected' : ''}>Expirada</option>
                  <option value="cancelada" ${emp.status === 'cancelada' ? 'selected' : ''}>Cancelada</option>
                </select>
              </div>
              <div class="field">
                <label>Trial até</label>
                <input type="date" id="pf-trial-${emp.id}" value="${emp.trial_termina_em ? emp.trial_termina_em.slice(0, 10) : ''}">
              </div>
              <div class="field">
                <label>Plano</label>
                <select id="pf-plano-${emp.id}">
                  <option value="" ${!emp.plano ? 'selected' : ''}>—</option>
                  <option value="essencial" ${emp.plano === 'essencial' ? 'selected' : ''}>Essencial</option>
                  <option value="profissional" ${emp.plano === 'profissional' ? 'selected' : ''}>Profissional</option>
                  <option value="enterprise" ${emp.plano === 'enterprise' ? 'selected' : ''}>Enterprise</option>
                </select>
              </div>
              <div class="field num">
                <label>Limite forn.</label>
                <input type="number" min="0" placeholder="ilimitado" id="pf-limite-forn-${emp.id}" value="${emp.limite_fornecedores ?? ''}">
              </div>
              <div class="field num">
                <label>Limite admins</label>
                <input type="number" min="0" placeholder="ilimitado" id="pf-limite-admins-${emp.id}" value="${emp.limite_admins ?? ''}">
              </div>
              <button class="btn btn-primary btn-sm" onclick="salvarEmpresaPlataforma('${emp.id}')">Salvar</button>
            </div>
            ${emp.proximo_valor_mensal != null ? `<div style="font-size:11px; color:var(--warn); margin-top:10px">Reajuste agendado: → R$ ${Number(emp.proximo_valor_mensal).toFixed(2).replace('.', ',')} em ${new Date(emp.proximo_reajuste_em).toLocaleDateString('pt-BR')}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function toggleEditEmpresa(empresaId) {
  document.getElementById(`edit-${empresaId}`).classList.toggle('open');
}

function toggleKebabEmpresa(empresaId) {
  document.querySelectorAll('.kebab-menu').forEach(m => { if (m.id !== `kebab-${empresaId}`) m.classList.remove('open'); });
  document.getElementById(`kebab-${empresaId}`).classList.toggle('open');
}

document.addEventListener('click', (ev) => {
  if (!ev.target.closest('.kebab-wrap')) {
    document.querySelectorAll('.kebab-menu').forEach(m => m.classList.remove('open'));
  }
});

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
    toastPlataforma('Erro: ' + ((data && data.error) || await mensagemErroFuncao(error)));
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
    wrap.innerHTML = `<div class="empty-state" style="color:var(--danger)">Erro: ${(data && data.error) || await mensagemErroFuncao(error)}</div>`;
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
    toastPlataforma('Erro: ' + ((data && data.error) || await mensagemErroFuncao(error)));
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
function abrirModalDetalhesEmpresa(empresaId) {
  const emp = empresasCachePlataforma.find(e => e.id === empresaId);
  if (!emp) return;

  document.getElementById('de-titulo').textContent = emp.nome;

  const linha = (label, valor) => `
    <div style="display:flex; justify-content:space-between; gap:12px; padding:6px 0; border-bottom:1px solid var(--border)">
      <span style="color:var(--text-muted)">${label}</span>
      <span style="text-align:right; font-family:monospace; font-size:12px">${valor}</span>
    </div>`;

  document.getElementById('de-conteudo').innerHTML = `
    ${linha('ID da empresa', emp.id)}
    ${linha('ID do admin master', emp.adminMasterId || '<span style="color:var(--text-muted)">— sem admin master —</span>')}
    ${linha('E-mail do admin master', emp.adminMasterEmail || '—')}
    ${linha('Cadastrada em', new Date(emp.criado_em).toLocaleString('pt-BR'))}
    ${linha('Plano atual', emp.plano || '—')}
    ${linha('Nesse plano desde', emp.plano_desde ? new Date(emp.plano_desde).toLocaleDateString('pt-BR') : '—')}
    ${linha('Acessos hoje', emp.acessosHoje)}
    ${linha('Média de acessos/dia (30d)', emp.mediaAcessosPorDia)}
    ${linha('Termos aceitos em', emp.termos_aceitos_em
      ? `${new Date(emp.termos_aceitos_em).toLocaleString('pt-BR')} <span style="color:var(--text-muted)">(versão ${emp.termos_versao || '—'})</span>`
      : '<span style="color:var(--warn)">— não registrado (empresa anterior a essa exigência) —</span>')}
    ${linha('Armazenamento', '<span id="de-armazenamento">Calculando...</span>')}
  `;

  document.getElementById('modal-detalhes-empresa-overlay').classList.add('active');

  supabaseClient.functions.invoke('superadmin-calcular-armazenamento', { body: { empresaId } })
    .then(({ data, error }) => {
      const alvo = document.getElementById('de-armazenamento');
      if (!alvo) return; // modal já foi fechado antes da resposta chegar
      if (error || (data && data.ok === false)) {
        alvo.innerHTML = '<span style="color:var(--danger)">Erro ao calcular</span>';
        return;
      }
      alvo.textContent = `${data.totalFormatado} (${data.totalArquivos} arquivo(s))`;
    });
}

function fecharModalDetalhesEmpresa() {
  document.getElementById('modal-detalhes-empresa-overlay').classList.remove('active');
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
    resultBox.innerHTML = `<div class="empty-state" style="color:var(--danger)">Erro: ${(data && data.error) || await mensagemErroFuncao(error)}</div>`;
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
    resultBox.innerHTML = `<div class="empty-state" style="color:var(--danger)">Erro: ${(data && data.error) || await mensagemErroFuncao(error)}</div>`;
    document.getElementById('ee-btn-confirmar').disabled = false;
    return;
  }

  toastPlataforma('Empresa excluída definitivamente.');
  fecharModalExcluirEmpresa();
  await carregarEmpresasPlataforma();
}

// ============ NOTAS FISCAIS EMITIDAS ============
//
// Agora usa as Edge Functions reais (superadmin-listar-notas-fiscais e
// superadmin-enviar-nota-fiscal). Se elas ainda não tiverem sido
// deployadas no seu projeto Supabase (ex: primeira vez rodando essa
// versão), cai automaticamente pro dado mockado, só pra não quebrar a
// tela — assim que a migration + as functions existirem, passa a usar
// dado real sem precisar mudar mais nada aqui.

// empresaId -> array de notas: { id, valor, referenteA, cobradoEm, status: 'pendente'|'enviada', enviadoEm }
let notasFiscaisCachePlataforma = {};

async function carregarNotasFiscaisPlataforma() {
  const { data, error } = await supabaseClient.functions.invoke('superadmin-listar-notas-fiscais');
  if (error || !data || data.ok === false) {
    console.warn('superadmin-listar-notas-fiscais indisponível ainda, usando dado de exemplo:', error || data?.error);
    seedNotasFiscaisMock();
    return;
  }
  notasFiscaisCachePlataforma = data.notasPorEmpresa || {};
}

// Dado de exemplo — só usado como fallback enquanto a Edge Function real
// não estiver deployada (ver carregarNotasFiscaisPlataforma acima).
function seedNotasFiscaisMock() {
  empresasCachePlataforma.forEach((emp, i) => {
    if (notasFiscaisCachePlataforma[emp.id]) return; // não reseta se já existe (ex: depois de "Enviar")

    const hoje = new Date();
    const mockPorEmpresa = [
      {
        id: `mock-${emp.id}-1`,
        valor: emp.valor_mensal_atual || 297,
        referenteA: `${new Date(hoje.getFullYear(), hoje.getMonth() - 1, 20).toLocaleDateString('pt-BR')} a ${new Date(hoje.getFullYear(), hoje.getMonth(), 19).toLocaleDateString('pt-BR')}`,
        cobradoEm: new Date(hoje.getFullYear(), hoje.getMonth(), 20).toISOString(),
        status: 'pendente',
      },
    ];
    // Uma minoria das empresas (índice par) ganha também uma nota já
    // enviada no mês anterior, só pra mostrar como fica o estado "enviada".
    if (i % 2 === 0) {
      mockPorEmpresa.push({
        id: `mock-${emp.id}-0`,
        valor: emp.valor_mensal_atual || 297,
        referenteA: `${new Date(hoje.getFullYear(), hoje.getMonth() - 2, 20).toLocaleDateString('pt-BR')} a ${new Date(hoje.getFullYear(), hoje.getMonth() - 1, 19).toLocaleDateString('pt-BR')}`,
        cobradoEm: new Date(hoje.getFullYear(), hoje.getMonth() - 1, 20).toISOString(),
        status: 'enviada',
        enviadoEm: new Date(hoje.getFullYear(), hoje.getMonth() - 1, 22).toISOString(),
      });
    }
    notasFiscaisCachePlataforma[emp.id] = mockPorEmpresa;
  });
}

function contarNotasPendentes(empresaId) {
  const notas = notasFiscaisCachePlataforma[empresaId] || [];
  return notas.filter(n => n.status === 'pendente').length;
}

function formatarMoedaNF(valor) {
  return `R$ ${Number(valor).toFixed(2).replace('.', ',')}`;
}

function abrirModalNotasFiscais(empresaId) {
  const empresa = empresasCachePlataforma.find(e => e.id === empresaId);
  document.getElementById('nf-titulo').textContent = `Notas Fiscais — ${empresa ? empresa.nome : ''}`;
  document.getElementById('nf-lista-wrap').dataset.empresaId = empresaId;
  renderNotasFiscaisModal(empresaId);
  document.getElementById('modal-notas-fiscais-overlay').classList.add('active');
}

function fecharModalNotasFiscais() {
  document.getElementById('modal-notas-fiscais-overlay').classList.remove('active');
}

function sealSvg(tipo) {
  // Mesmo selo tracejado da marca (login/topbar), reaproveitado em miniatura
  // pro status de cada nota fiscal — "enviada" com o check, "pendente" sem.
  const check = tipo === 'enviada' ? '<path d="M40 61 L53 75 L82 45" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>' : '';
  return `
    <svg class="nf-seal ${tipo}" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="60" cy="60" r="54" stroke="currentColor" stroke-width="3" stroke-dasharray="4 7"/>
      <circle cx="60" cy="60" r="44" stroke="currentColor" stroke-width="1.4"/>
      ${check}
    </svg>`;
}

function renderNotasFiscaisModal(empresaId) {
  const wrap = document.getElementById('nf-lista-wrap');
  const notas = [...(notasFiscaisCachePlataforma[empresaId] || [])]
    .sort((a, b) => new Date(b.cobradoEm) - new Date(a.cobradoEm));

  if (!notas.length) {
    wrap.innerHTML = '<div class="empty-state">Nenhuma cobrança registrada pra essa empresa ainda.</div>';
    return;
  }

  wrap.innerHTML = notas.map(nota => {
    if (nota.status === 'enviada') {
      return `
        <div class="nf-row enviada">
          ${sealSvg('enviada')}
          <div class="nf-info">
            <div class="nf-valor">${formatarMoedaNF(nota.valor)}</div>
            <div class="nf-periodo">Referente a ${nota.referenteA}</div>
            <div class="nf-status enviada">✓ Enviada em ${new Date(nota.enviadoEm).toLocaleDateString('pt-BR')}</div>
          </div>
        </div>
      `;
    }
    return `
      <div class="nf-row" id="nf-row-${nota.id}">
        ${sealSvg('pendente')}
        <div class="nf-info">
          <div class="nf-valor">${formatarMoedaNF(nota.valor)}</div>
          <div class="nf-periodo">Referente a ${nota.referenteA}</div>
          <div class="nf-status">Cobrado em ${new Date(nota.cobradoEm).toLocaleDateString('pt-BR')} — pendente de nota</div>
        </div>
        <div class="nf-acoes">
          <input type="file" accept="application/pdf" id="nf-arquivo-${nota.id}" onchange="atualizarBotaoEnviarNota('${nota.id}')">
          <button class="btn btn-primary btn-sm" id="nf-btn-enviar-${nota.id}" disabled onclick="enviarNotaFiscal('${nota.id}', '${empresaId}')">Enviar</button>
        </div>
      </div>
    `;
  }).join('');
}

function atualizarBotaoEnviarNota(notaId) {
  const input = document.getElementById(`nf-arquivo-${notaId}`);
  const btn = document.getElementById(`nf-btn-enviar-${notaId}`);
  const arquivo = input.files[0];
  if (arquivo && arquivo.type !== 'application/pdf') {
    toastPlataforma('Só é possível anexar arquivo em PDF.');
    input.value = '';
    btn.disabled = true;
    return;
  }
  btn.disabled = !arquivo;
}

async function enviarNotaFiscal(notaId, empresaId) {
  const input = document.getElementById(`nf-arquivo-${notaId}`);
  const arquivo = input.files[0];
  if (!arquivo) return;

  const btn = document.getElementById(`nf-btn-enviar-${notaId}`);
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  // Notas com id "mock-..." são só o fallback visual (Edge Functions ainda
  // não deployadas) — não dá pra mandar de verdade, só simula.
  if (notaId.startsWith('mock-')) {
    await new Promise(resolve => setTimeout(resolve, 700));
    const notas = notasFiscaisCachePlataforma[empresaId] || [];
    const nota = notas.find(n => n.id === notaId);
    if (nota) { nota.status = 'enviada'; nota.enviadoEm = new Date().toISOString(); }
    toastPlataforma('Nota enviada! (simulado — Edge Functions ainda não deployadas)');
    renderNotasFiscaisModal(empresaId);
    renderEmpresasPlataforma();
    return;
  }

  const formData = new FormData();
  formData.append('notaFiscalId', notaId);
  formData.append('arquivo', arquivo);

  const { data, error } = await supabaseClient.functions.invoke(
    'superadmin-enviar-nota-fiscal', { body: formData }
  );

  if (error || (data && data.ok === false)) {
    toastPlataforma('Erro: ' + ((data && data.error) || await mensagemErroFuncao(error)));
    btn.disabled = false;
    btn.textContent = 'Enviar';
    return;
  }

  toastPlataforma(data.avisoSemEmail
    ? 'Nota enviada, mas a empresa não tem admin_master com e-mail cadastrado — ninguém foi avisado.'
    : (data.emailEnviado ? 'Nota enviada e e-mail entregue ao cliente!' : 'Nota marcada como enviada, mas o e-mail falhou — confira o Resend.'));

  await carregarNotasFiscaisPlataforma();
  renderNotasFiscaisModal(empresaId);
  renderEmpresasPlataforma();
}

// ============ KPIs (calculados a partir do cache já carregado — sem chamada extra) ============
function renderKPIsPlataforma() {
  const ativas = empresasCachePlataforma.filter(e => e.status === 'ativa');
  const mrr = ativas.reduce((soma, e) => soma + (Number(e.valor_mensal_atual) || 0), 0);

  let totalPendentesNF = 0, empresasComPendencia = 0;
  Object.values(notasFiscaisCachePlataforma).forEach(notas => {
    const pend = notas.filter(n => n.status === 'pendente').length;
    if (pend > 0) { totalPendentesNF += pend; empresasComPendencia++; }
  });

  const em7dias = new Date(); em7dias.setDate(em7dias.getDate() + 7);
  const agora = new Date();
  const trialsTerminando = empresasCachePlataforma.filter(e =>
    e.status === 'trial' && e.trial_termina_em &&
    new Date(e.trial_termina_em) >= agora && new Date(e.trial_termina_em) <= em7dias
  ).length;

  const canceladasAntigas = empresasCachePlataforma.filter(ehCanceladaHaMaisDeUmAno);

  document.getElementById('kpi-ativas').textContent = ativas.length;
  document.getElementById('kpi-ativas-sub').textContent = `de ${empresasCachePlataforma.length} empresa(s) no total`;
  document.getElementById('kpi-mrr').textContent = `R$ ${mrr.toFixed(2).replace('.', ',')}`;
  document.getElementById('kpi-mrr-sub').textContent = ativas.length ? `média R$ ${(mrr / ativas.length).toFixed(2).replace('.', ',')} / empresa` : '\u00A0';
  document.getElementById('kpi-nf').textContent = totalPendentesNF;
  document.getElementById('kpi-nf-sub').textContent = totalPendentesNF ? `em ${empresasComPendencia} empresa(s)` : 'tudo em dia';
  document.getElementById('kpi-trials').textContent = trialsTerminando;
  document.getElementById('kpi-canceladas-antigas').textContent = canceladasAntigas.length;
  document.getElementById('kpi-canceladas-antigas-sub').textContent = canceladasAntigas.length ? 'candidatas a limpeza' : 'nenhuma por enquanto';
}

// Cancelada há mais de 365 dias — candidata a exclusão manual (limpeza de
// conta morta que nunca reativou). Empresas com exclusão já em andamento
// (status exclusao_agendada) não entram aqui, esse KPI é só pra quem ficou
// esquecida como 'cancelada' sem ninguém nunca ter pedido a exclusão.
function ehCanceladaHaMaisDeUmAno(emp) {
  if (emp.status !== 'cancelada' || !emp.cancelada_em) return false;
  const umAnoAtras = new Date(); umAnoAtras.setDate(umAnoAtras.getDate() - 365);
  return new Date(emp.cancelada_em) <= umAnoAtras;
}

// "há 3 dias" / "há 5 meses" / "há 2 anos" — usado no selo de cada card e
// no filtro do chip "Canceladas há +1 ano".
function formatarTempoDesde(dataISO) {
  const dias = Math.floor((Date.now() - new Date(dataISO).getTime()) / 86400000);
  if (dias < 30) return `há ${dias} dia${dias === 1 ? '' : 's'}`;
  if (dias < 365) { const m = Math.floor(dias / 30); return `há ${m} ${m === 1 ? 'mês' : 'meses'}`; }
  const a = Math.floor(dias / 365);
  return `há ${a} ${a === 1 ? 'ano' : 'anos'}`;
}

// No R2 não existe "pasta" de verdade — o que parece pasta é só o prefixo
// do nome do arquivo, sempre o id da empresa (ex: "3c04d0ea-.../notas-
// fiscais/nota.pdf"). Copia esse prefixo pra colar direto na busca do
// painel do Cloudflare, já que renomear pasta não é uma operação que
// existe em storage S3-compatível (teria que copiar arquivo por arquivo).
function copiarCaminhoR2(empresaId) {
  const caminho = `${empresaId}/`;
  navigator.clipboard.writeText(caminho).then(() => {
    toastPlataforma(`Caminho copiado: ${caminho}`);
  }).catch(() => {
    toastPlataforma('Não foi possível copiar automaticamente. Caminho: ' + caminho);
  });
}

// ============ Busca + filtro por status (aba Empresas) ============
let filtroStatusAtualPlataforma = '';

function filtrarEmpresasPlataforma() {
  const termo = document.getElementById('empresa-busca').value.trim().toLowerCase();
  let lista = empresasCachePlataforma;
  if (filtroStatusAtualPlataforma === 'cancelada_antiga') {
    lista = lista.filter(ehCanceladaHaMaisDeUmAno);
  } else if (filtroStatusAtualPlataforma) {
    lista = lista.filter(e => e.status === filtroStatusAtualPlataforma);
  }
  if (termo) lista = lista.filter(e => e.nome.toLowerCase().includes(termo));
  renderEmpresasPlataforma(lista);
}

document.addEventListener('DOMContentLoaded', () => {
  const chipsWrap = document.getElementById('empresa-chips');
  if (!chipsWrap) return;
  chipsWrap.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chipsWrap.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      filtroStatusAtualPlataforma = chip.dataset.status;
      filtrarEmpresasPlataforma();
    });
  });
});

// ============ Abas (Empresas / Catálogo Enterprise / Reajuste geral) ============
function trocarAbaPlataforma(aba) {
  document.querySelectorAll('.tab-bar .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === aba));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-panel-${aba}`));
}

// Se já tiver sessão ativa (voltou pra página logado), tenta carregar direto.
(async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) await carregarEmpresasPlataforma();
})();
