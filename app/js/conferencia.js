// conferencia.js
// versão: 02
// última atualização: 20/08/2026 09:08

// ============ MÓDULO CONFERÊNCIA ============
// Formulário separado do de Avaliar Produto — pensado pra quem só confere
// uma PARTE do recebimento (ex: almoxarifado conferindo temperatura,
// transportadora), sem ver o resto do sistema. Liga/desliga por usuário
// como qualquer outro módulo (MODULOS_MENU / permissoesModulos).
//
// Junção com a avaliação de produto (js/avaliar.js) é OPCIONAL e ADITIVA,
// feita por NF + fornecedor (ver buscarConferencia em core.js):
//   - critério tipo 'sim_nao': se "Não", desconta ponto fixo na nota geral.
//   - critério tipo 'nota' (0 a 10): se o NOME bater com um critério do seu
//     formulário de produto, preenche e trava esse campo automaticamente lá.
//   - critério tipo 'texto': só informativo, não pontua nem trava nada.

let _abaConferencia = 'lancar';
let _conferirRecebimentoAberto = true;
let _novoCriterioConferenciaAberto = false;

function toggleConferirRecebimentoCard(forcarAberto) {
  _conferirRecebimentoAberto = typeof forcarAberto === 'boolean' ? forcarAberto : !_conferirRecebimentoAberto;
  const card = document.getElementById('conferir-recebimento-card');
  const body = document.getElementById('conferir-recebimento-body');
  if (card) card.classList.toggle('open', _conferirRecebimentoAberto);
  if (body) body.style.display = _conferirRecebimentoAberto ? 'block' : 'none';
}

function toggleNovoCriterioConferenciaCard() {
  _novoCriterioConferenciaAberto = !_novoCriterioConferenciaAberto;
  document.getElementById('novo-criterio-conferencia-card').classList.toggle('open', _novoCriterioConferenciaAberto);
  document.getElementById('novo-criterio-conferencia-body').style.display = _novoCriterioConferenciaAberto ? 'block' : 'none';
}

function renderAdConferencia() {
  const wrap = document.getElementById('ad-page-conferencia');
  wrap.innerHTML = `
    <div class="page-header"><div><h2>Conferência</h2><p>Confira o recebimento (temperatura, transportadora, etc.) — some automático na avaliação de produto pela mesma nota fiscal.</p></div></div>
    <div class="tabs" style="margin-bottom:16px">
      <button class="tab ${_abaConferencia === 'lancar' ? 'active' : ''}" onclick="mudarAbaConferencia('lancar', this)">Fazer conferência</button>
      <button class="tab ${_abaConferencia === 'criterios' ? 'active' : ''}" onclick="mudarAbaConferencia('criterios', this)">Critérios</button>
      <button class="tab ${_abaConferencia === 'rnc' ? 'active' : ''}" onclick="mudarAbaConferencia('rnc', this)">Modelos de RNC</button>
    </div>
    <div id="conferencia-tab-lancar" style="display:${_abaConferencia === 'lancar' ? 'block' : 'none'}"></div>
    <div id="conferencia-tab-criterios" style="display:${_abaConferencia === 'criterios' ? 'block' : 'none'}"></div>
    <div id="conferencia-tab-rnc" style="display:${_abaConferencia === 'rnc' ? 'block' : 'none'}"></div>
  `;
  if (_abaConferencia === 'lancar') renderLancarConferenciaTab();
  else if (_abaConferencia === 'criterios') renderCriteriosConferenciaTab();
  else renderRncModelosTab();
}

function mudarAbaConferencia(aba, btn) {
  _abaConferencia = aba;
  document.querySelectorAll('#ad-page-conferencia .tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('conferencia-tab-lancar').style.display = aba === 'lancar' ? 'block' : 'none';
  document.getElementById('conferencia-tab-criterios').style.display = aba === 'criterios' ? 'block' : 'none';
  document.getElementById('conferencia-tab-rnc').style.display = aba === 'rnc' ? 'block' : 'none';
  if (aba === 'lancar') renderLancarConferenciaTab();
  else if (aba === 'criterios') renderCriteriosConferenciaTab();
  else renderRncModelosTab();
}

// ---------- Fazer conferência ----------
function renderLancarConferenciaTab() {
  const d = db();
  const wrap = document.getElementById('conferencia-tab-lancar');
  const criteriosAtivos = d.criteriosConferencia.filter(c => c.ativo);
  if (typeof _rncsPendentesLancamento !== 'undefined') _rncsPendentesLancamento = {}; // começa do zero a cada vez que a tela é montada

  if (!criteriosAtivos.length) {
    wrap.innerHTML = `
      <div class="card" style="margin-bottom:16px">
        <div class="empty-state"><p>Cadastre ao menos um critério ativo na aba "Critérios" antes de conferir um novo recebimento.</p></div>
      </div>
      <div class="card">
        <div class="card-title">Conferências lançadas</div>
        ${renderListaConferenciasHtml()}
      </div>
    `;
    return;
  }

  window._fornecedorConferencia = { id: null, cnpj: '', novo: false };
  const hoje = new Date();

  wrap.innerHTML = `
    <div class="card sup-new-card ${_conferirRecebimentoAberto ? 'open' : ''}" id="conferir-recebimento-card" style="margin-bottom:16px">
      <div class="sup-new-card-header" onclick="toggleConferirRecebimentoCard()">
        <div class="sup-new-icon">+</div>
        <div class="sup-new-card-title-wrap">
          <div class="sup-new-card-title">Conferir recebimento</div>
          <div class="sup-new-card-subtitle">Preencha o CNPJ para autopreencher os campos.</div>
        </div>
        <div class="sup-new-chevron">⌄</div>
      </div>
      <div class="sup-new-card-body" id="conferir-recebimento-body" style="${_conferirRecebimentoAberto ? '' : 'display:none'}">
      <div class="form-row three">
        <div class="form-group">
          <label>CNPJ do fornecedor</label>
          <div style="display:flex; gap:6px">
            <input type="text" id="cf-cnpj" placeholder="00.000.000/0000-00" oninput="this.value = formatarCNPJ(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault(); buscarFornecedorPorCnpjConferencia();}" style="flex:1">
            <button type="button" class="btn btn-secondary btn-sm" onclick="buscarFornecedorPorCnpjConferencia()" style="display:inline-flex; align-items:center; gap:6px">${ic('search', 13)} Buscar</button>
          </div>
        </div>
        <div class="form-group">
          <label>Nome do fornecedor</label>
          <input type="text" id="cf-nome-fornecedor" placeholder="Busque o CNPJ primeiro" disabled>
          <div id="cf-status-fornecedor" style="margin-top:6px; font-size:11px"></div>
        </div>
        <div class="form-group"><label>Nº da Nota Fiscal</label><input type="text" id="cf-nf" placeholder="Ex: 117743" onblur="aplicarAvaliacaoVinculada()"></div>
        <div class="form-group"><label>Data</label><input type="date" id="cf-data" value="${hoje.toISOString().slice(0,10)}"></div>
      </div>
      <div id="cf-avaliacao-info"></div>
      <p style="font-size:12px; font-weight:600; color:var(--text-sec); margin:14px 0 8px">Critérios</p>
      <div class="form-row three" id="cf-criterios">
        ${criteriosAtivos.filter(c => c.tipo !== 'faixa' && !(c.tipo === 'nota' && c.opcoes && c.opcoes.length)).map(c => {
          const critProdutoMatch = c.tipo === 'nota'
            ? d.criteriosProduto.find(cp => cp.ativo && normalizarNomeCriterio(cp.nome) === normalizarNomeCriterio(c.nome))
            : null;
          const limiteNota = c.tipo === 'nota' ? (c.peso || (critProdutoMatch ? critProdutoMatch.peso : 10)) : null;
          return `
          <div class="form-group">
            <label>${c.nome}${c.tipo === 'sim_nao' ? ` <span style="color:var(--text-muted); font-weight:400">(desconta ${c.desconto_se_nao} se "Não")</span>` : ''}${c.tipo === 'nota' ? ` <span style="color:var(--text-muted); font-weight:400">(peso ${limiteNota})</span>` : ''}</label>
            ${c.tipo === 'sim_nao' ? `
              <select class="cf-resposta-input" data-criterio-id="${c.id}" data-tipo="sim_nao">
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            ` : c.tipo === 'nota' ? `
              <input type="number" min="0" max="${limiteNota}" step="0.5" class="cf-resposta-input" data-criterio-id="${c.id}" data-tipo="nota" data-criterio-nome="${c.nome}" placeholder="0 a ${limiteNota}" oninput="verificarNotaConferenciaAbaixoPeso(this)">
              <div id="cf-motivo-wrap-${c.id}"></div>
            ` : `
              <input type="text" class="cf-resposta-input" data-criterio-id="${c.id}" data-tipo="texto">
            `}
          </div>
        `;
        }).join('')}
      </div>
      <div id="cf-criterios-regua">
        ${criteriosAtivos.filter(c => c.tipo === 'nota' && c.opcoes && c.opcoes.length).map(c => `
          <div class="form-group lp-select-wrap" style="position:relative">
            <label>${c.nome} <span style="color:var(--text-muted); font-weight:400">(peso ${c.peso})</span></label>
            <input type="hidden" class="cf-resposta-input" data-criterio-id="${c.id}" data-tipo="nota" data-criterio-nome="${c.nome}" value="">
            <textarea class="cf-nota-motivo" data-criterio-id="${c.id}" style="display:none"></textarea>
            <div id="lp-select-closed-${c.id}" onclick="toggleLpSelectDropdown('${c.id}')" style="border:1px solid var(--border); border-radius:8px; padding:10px 12px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; gap:8px; background:var(--surface)">
              <span id="lp-select-label-${c.id}" style="color:var(--text-muted)">Selecione uma opção</span>
              <span style="color:var(--text-muted)">▾</span>
            </div>
            <div id="lp-select-dropdown-${c.id}" style="display:none; position:absolute; top:100%; left:0; right:0; z-index:20; background:var(--surface); border:1px solid var(--border); border-radius:8px; margin-top:4px; max-height:260px; overflow-y:auto; box-shadow:0 6px 18px rgba(0,0,0,.18)">
              ${c.opcoes.map((op, i) => `
                <div onclick="selecionarOpcaoCriterioConferencia('${c.id}', ${i})" style="padding:10px 12px; cursor:pointer; display:flex; justify-content:space-between; gap:10px; border-bottom:1px solid var(--border)">
                  <span>${op.label}</span><span style="font-weight:600; white-space:nowrap">${op.pontos}P</span>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
      ${criteriosAtivos.filter(c => c.tipo === 'faixa').map(c => `
        <div class="form-group" style="margin-top:10px">
          <label>${c.nome} <span style="color:var(--text-muted); font-weight:400">(opcional — desconta ${c.desconto_se_nao} se fora da faixa)</span></label>
          <div class="form-row three">
            <div><span style="font-size:11px; color:var(--text-muted)">Recomendada mín. (${c.unidade})</span>
              <input type="number" step="0.1" class="cf-faixa-min" data-criterio-id="${c.id}"></div>
            <div><span style="font-size:11px; color:var(--text-muted)">Recomendada máx. (${c.unidade})</span>
              <input type="number" step="0.1" class="cf-faixa-max" data-criterio-id="${c.id}"></div>
            <div><span style="font-size:11px; color:var(--text-muted)">Recebida (${c.unidade})</span>
              <input type="number" step="0.1" class="cf-faixa-recebida" data-criterio-id="${c.id}" oninput="atualizarStatusFaixa('${c.id}')"></div>
          </div>
          <div id="cf-faixa-status-${c.id}"></div>
        </div>
      `).join('')}
      <div id="cf-botoes-salvar" style="margin-top:16px"></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Conferências lançadas</div>
      <div class="form-row three" style="margin-bottom:14px">
        <div class="form-group"><label>De</label><input type="date" id="cf-filtro-de" onchange="rerenderListaConferencias()"></div>
        <div class="form-group"><label>Até</label><input type="date" id="cf-filtro-ate" onchange="rerenderListaConferencias()"></div>
        <div class="form-group"><label>Fornecedor</label><input type="text" id="cf-filtro-fornecedor" placeholder="Nome..." oninput="rerenderListaConferencias()"></div>
        <div class="form-group"><label>CNPJ</label><input type="text" id="cf-filtro-cnpj" placeholder="00.000.000/0000-00" oninput="this.value = formatarCNPJ(this.value); rerenderListaConferencias()"></div>
      </div>
      <div id="cf-lista-wrap">${renderListaConferenciasHtml()}</div>
    </div>
  `;
  if (typeof renderBotoesSalvarConferencia === 'function') renderBotoesSalvarConferencia();
}

let _conferenciasExpandidas = new Set();

function rerenderListaConferencias() {
  document.getElementById('cf-lista-wrap').innerHTML = renderListaConferenciasHtml();
}

function toggleConferenciaDetalhe(id) {
  if (_conferenciasExpandidas.has(id)) _conferenciasExpandidas.delete(id);
  else _conferenciasExpandidas.add(id);
  rerenderListaConferencias();
}

function conferenciasFiltradas() {
  const d = db();
  const de = document.getElementById('cf-filtro-de')?.value || '';
  const ate = document.getElementById('cf-filtro-ate')?.value || '';
  const fornecedorTexto = (document.getElementById('cf-filtro-fornecedor')?.value || '').trim().toLowerCase();
  const cnpjTexto = (document.getElementById('cf-filtro-cnpj')?.value || '').replace(/\D/g, '');

  return d.conferencias.filter(c => {
    if (de && c.data < de) return false;
    if (ate && c.data > ate) return false;
    const forn = d.fornecedores.find(f => f.id === c.fornecedorId);
    if (fornecedorTexto && !(forn && forn.nome.toLowerCase().includes(fornecedorTexto))) return false;
    if (cnpjTexto && !(forn && (forn.cnpj || '').replace(/\D/g, '').includes(cnpjTexto))) return false;
    return true;
  });
}

function iconeStatusSvg(ok) {
  return ok
    ? `<svg class="ic-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`
    : `<svg class="ic-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;
}

function renderDetalheResposta(r, ctx) {
  let valor, icone = '', extra = '';
  if (r.tipo === 'sim_nao') {
    valor = r.valor === 'nao' ? 'Não' : 'Sim';
    icone = iconeStatusSvg(r.valor !== 'nao');
  } else if (r.tipo === 'nota') {
    valor = `${r.valor}/10`;
  } else if (r.tipo === 'texto') {
    valor = escapeHtml(r.valor);
  } else if (r.tipo === 'faixa') {
    valor = `${r.valor}${r.unidade || ''} <span style="font-weight:400; color:var(--text-muted)">(rec. ${r.min}-${r.max}${r.unidade || ''})</span>`;
    icone = iconeStatusSvg(r.dentroFaixa);
    if (!r.dentroFaixa) {
      extra = `<div style="font-size:11px; color:var(--danger); margin-top:2px">RPNC: ${escapeHtml(r.rpnc)}</div>`;
      if (ctx) {
        extra += r.rncId
          ? `<button type="button" class="btn btn-secondary btn-sm" style="margin-top:4px" onclick="event.stopPropagation(); abrirVisualizarRnc('${r.rncId}')">${ic('fileText', 12)} Ver RNC ${r.rncNumeroSequencial ? escapeHtml(r.rncNumeroSequencial) : ''}</button>`
          : `<button type="button" class="btn btn-secondary btn-sm" style="margin-top:4px" onclick="event.stopPropagation(); abrirVincularRnc('${ctx.conferenciaId}', '${r.criterioId}', '${ctx.fornecedorId}', '${escapeHtml(ctx.numeroNf)}')">${ic('fileText', 12)} Vincular RNC</button>`;
      }
    }
  } else {
    valor = escapeHtml(r.valor);
  }
  return `
    <div style="min-width:150px">
      <div style="font-size:11px; color:var(--text-muted); margin-bottom:2px">${escapeHtml(r.nome)}</div>
      <div style="font-size:13px; font-weight:600; display:flex; align-items:center; gap:5px">${icone}${valor}</div>
      ${extra}
    </div>
  `;
}

function renderListaConferenciasHtml() {
  const d = db();
  const lista = conferenciasFiltradas();
  if (!d.conferencias.length) return '<div class="empty-state"><p>Nenhuma conferência lançada ainda.</p></div>';
  if (!lista.length) return '<div class="empty-state"><p>Nenhuma conferência encontrada com esses filtros.</p></div>';
  return lista.slice(0, 100).map(c => {
    const forn = d.fornecedores.find(f => f.id === c.fornecedorId);
    const expandida = _conferenciasExpandidas.has(c.id);
    return `
    <div class="sup-row-wrap ${expandida ? 'expanded' : ''}">
      <div class="sup-row clickable" onclick="toggleConferenciaDetalhe('${c.id}')">
        <span class="sup-status-dot" style="background:${c.descontoTotal > 0 ? 'var(--danger)' : 'var(--success)'}"></span>
        <div style="flex:1; min-width:0">
          <div class="sup-name-line">
            <span class="sup-name">${forn ? escapeHtml(forn.nome) : '—'}</span>
            ${c.descontoTotal > 0
              ? `<span class="sup-badge sup-badge-crit-alta">-${c.descontoTotal} ponto(s)</span>`
              : `<span class="sup-badge sup-badge-crit-baixa">Sem desconto</span>`}
          </div>
          <div class="sup-meta">
            <span class="sup-meta-item mono">${forn && forn.cnpj ? forn.cnpj : '—'}</span>
            <span class="sup-meta-sep">|</span>
            <span class="sup-meta-item mono">NF ${c.numeroNf}</span>
            <span class="sup-meta-sep">|</span>
            <span class="sup-meta-item">${fmtDataSimples(c.data)}</span>
            <span class="sup-meta-sep">|</span>
            <span class="sup-meta-item">${c.enviadoPorEmail || '—'}</span>
          </div>
        </div>
        <div class="sup-actions" onclick="event.stopPropagation()">
          <button class="sup-more-btn" onclick="excluirConferencia('${c.id}')" title="Excluir">${ic('trash', 16)}</button>
        </div>
        <span class="sup-chevron-ind">${ic('chevronDown', 15)}</span>
      </div>
      ${expandida ? `
        <div style="padding:14px 18px 18px 37px; border-top:1px solid var(--border); display:flex; flex-wrap:wrap; gap:14px 28px">
          ${c.respostas.map(r => renderDetalheResposta(r, { conferenciaId: c.id, fornecedorId: c.fornecedorId, numeroNf: c.numeroNf })).join('')}
        </div>
      ` : ''}
    </div>`;
  }).join('');
}

async function excluirConferencia(id) {
  if (!confirm('Excluir essa conferência? Se ela estiver vinculada a uma avaliação de produto, o desconto que ela aplicou lá NÃO é desfeito automaticamente.')) return;
  const { error } = await supabaseClient.from('conferencias').delete().eq('id', id);
  if (error) { toast('Erro ao excluir conferência: ' + error.message); return; }
  addLog('conferencia_excluida', `${currentUser.email} excluiu uma conferência`);
  _conferenciasExpandidas.delete(id);
  await carregarConferencias();
  rerenderListaConferencias();
  toast('Conferência excluída.');
}

function fmtDataSimples(iso) {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

async function buscarFornecedorPorCnpjConferencia() {
  const cnpjInput = document.getElementById('cf-cnpj');
  const cnpjLimpo = cnpjInput.value.replace(/\D/g, '');
  const nomeInput = document.getElementById('cf-nome-fornecedor');
  const statusEl = document.getElementById('cf-status-fornecedor');

  if (cnpjLimpo.length !== 14) { toast('CNPJ inválido.'); return; }

  const d = db();
  const existente = d.fornecedores.find(f => (f.cnpj || '').replace(/\D/g, '') === cnpjLimpo);
  if (existente) {
    window._fornecedorConferencia = { id: existente.id, cnpj: cnpjLimpo, novo: false };
    nomeInput.value = existente.nome;
    statusEl.innerHTML = `<span style="color:var(--success); font-weight:600; display:inline-flex; align-items:center; gap:5px">${ic('check', 12)} Fornecedor já cadastrado</span>`;
    return;
  }

  window._fornecedorConferencia = { id: null, cnpj: cnpjLimpo, novo: true };
  nomeInput.disabled = false;
  nomeInput.value = '';
  statusEl.innerHTML = '<span style="color:var(--warn); font-weight:600">Novo — será cadastrado ao salvar</span>';
}

function atualizarStatusFaixa(criterioId) {
  const min = parseFloat(document.querySelector(`.cf-faixa-min[data-criterio-id="${criterioId}"]`).value);
  const max = parseFloat(document.querySelector(`.cf-faixa-max[data-criterio-id="${criterioId}"]`).value);
  const recebida = parseFloat(document.querySelector(`.cf-faixa-recebida[data-criterio-id="${criterioId}"]`).value);
  const statusEl = document.getElementById(`cf-faixa-status-${criterioId}`);
  if (isNaN(min) || isNaN(max) || isNaN(recebida)) { statusEl.innerHTML = ''; if (typeof renderBotoesSalvarConferencia === 'function') renderBotoesSalvarConferencia(); return; }

  const dentro = recebida >= min && recebida <= max;
  if (dentro) {
    statusEl.innerHTML = `<div style="margin-top:6px; font-size:12px; color:var(--success); display:flex; align-items:center; gap:5px">${ic('check', 13)}Dentro da faixa recomendada</div>`;
  } else {
    statusEl.innerHTML = `
      <div style="margin-top:6px; font-size:12px; color:var(--danger); font-weight:600; display:flex; align-items:center; gap:5px">${ic('alertTriangle', 13)}Fora da faixa recomendada</div>
      <div class="form-group" style="margin-top:6px; max-width:280px">
        <label>RPNC</label>
        <input type="text" class="cf-faixa-rpnc" data-criterio-id="${criterioId}" placeholder="Nº ou referência da não conformidade">
      </div>
      <div id="cf-faixa-rnc-indicador-${criterioId}"></div>
    `;
    if (typeof atualizarIndicadorRncPendente === 'function') atualizarIndicadorRncPendente(criterioId);
  }
  if (typeof renderBotoesSalvarConferencia === 'function') renderBotoesSalvarConferencia();
}

// Compara a nota digitada aqui com o peso do critério de MESMO NOME lá no
// Avaliar Produto (normalizarNomeCriterio vem de avaliar.js) — se a nota
// ficar abaixo do peso, pede o motivo aqui mesmo, porque foi quem conferiu
// quem presenciou o problema (ex: caixas amassadas). Se não existir um
// critério correspondente no Avaliar Produto, não tem peso pra comparar —
// não pede motivo.
// Critério de Conferência com régua: mesmo campo fechado (dropdown) que o
// Avaliar Produto usa — reaproveita toggleLpSelectDropdown/
// fecharTodosLpSelectDropdopns (definidas em avaliar.js) já que o HTML segue
// o mesmo padrão de IDs (lp-select-*).
function selecionarOpcaoCriterioConferencia(critId, idx) {
  const d = db();
  const c = d.criteriosConferencia.find(x => x.id === critId);
  if (!c) return;
  const op = c.opcoes[idx];
  const respostaInp = document.querySelector(`.cf-resposta-input[data-criterio-id="${critId}"]`);
  const motivoInp = document.querySelector(`.cf-nota-motivo[data-criterio-id="${critId}"]`);
  const labelEl = document.getElementById(`lp-select-label-${critId}`);
  if (!respostaInp) return;

  respostaInp.value = op.pontos;
  if (motivoInp) motivoInp.value = op.pontos < c.peso ? op.label : '';
  if (labelEl) { labelEl.textContent = `${op.label} (${op.pontos}P)`; labelEl.style.color = 'var(--text)'; }

  fecharTodosLpSelectDropdowns();
}

function verificarNotaConferenciaAbaixoPeso(inp) {
  const criterioId = inp.dataset.criterioId;
  const nomeCriterio = inp.dataset.criterioNome;
  const wrap = document.getElementById(`cf-motivo-wrap-${criterioId}`);
  if (!wrap) return;
  if (inp.value === '') { inp.classList.remove('input-erro'); wrap.innerHTML = ''; return; }

  const d = db();
  const val = parseFloat(inp.value);
  const nomeNormalizado = normalizarNomeCriterio(nomeCriterio);
  const critProduto = d.criteriosProduto.find(c => c.ativo && normalizarNomeCriterio(c.nome) === nomeNormalizado);
  // Sem critério correspondente no Avaliar Produto, a nota daqui usa a escala padrão de 0 a 10.
  const limite = critProduto ? critProduto.peso : 10;

  if (val > limite) {
    inp.classList.add('input-erro');
    wrap.innerHTML = `<span style="color:var(--danger); font-size:11px">Valor máximo para este critério: ${limite}</span>`;
    return;
  }
  inp.classList.remove('input-erro');

  if (!critProduto || val >= critProduto.peso) { wrap.innerHTML = ''; return; }

  if (!wrap.querySelector('textarea')) {
    wrap.innerHTML = `
      <div class="form-group" style="margin-top:6px; max-width:280px">
        <label style="color:var(--danger); font-size:11px">Motivo (nota abaixo do peso máximo de ${critProduto.peso})</label>
        <textarea class="cf-nota-motivo" data-criterio-id="${criterioId}" rows="2" style="border-color:var(--danger-border)" placeholder="Ex: caixas amassadas na chegada"></textarea>
      </div>`;
  }
}

// Espelho de aplicarConferenciaVinculada (avaliar.js), no sentido contrário:
// se o Avaliar já foi feito primeiro pra essa NF+fornecedor, trava aqui os
// critérios de Conferência que tiverem o MESMO NOME de um critério já
// respondido lá no Avaliar Produto — usando a nota que já foi dada lá.
// Critérios sem par de mesmo nome no Avaliar continuam livres normalmente.
function aplicarAvaliacaoVinculada() {
  const estado = window._fornecedorConferencia;
  const numeroNf = document.getElementById('cf-nf').value.trim();
  window._avaliacaoVinculada = null;

  // Limpa qualquer trava anterior (ex: usuário trocou a NF depois de já ter linkado uma).
  document.querySelectorAll('.cf-resposta-input[data-tipo="nota"]').forEach(inp => {
    if (!inp.dataset.travadoAvaliacao) return;
    inp.disabled = false;
    inp.value = '';
    delete inp.dataset.travadoAvaliacao;
    delete inp.dataset.avaliadoPor;
    delete inp.dataset.motivo;
    const critId = inp.dataset.criterioId;
    const motivoWrap = document.getElementById(`cf-motivo-wrap-${critId}`);
    if (motivoWrap) motivoWrap.innerHTML = '';
    const closedBox = document.getElementById(`lp-select-closed-${critId}`);
    const labelEl = document.getElementById(`lp-select-label-${critId}`);
    if (closedBox) {
      closedBox.onclick = () => toggleLpSelectDropdown(critId);
      closedBox.style.cursor = 'pointer';
      closedBox.style.opacity = '1';
      closedBox.style.background = 'var(--surface)';
    }
    if (labelEl) { labelEl.textContent = 'Selecione uma opção'; labelEl.style.color = 'var(--text-muted)'; }
  });
  const infoBox = document.getElementById('cf-avaliacao-info');
  if (infoBox) infoBox.innerHTML = '';

  if (!estado || !estado.id || !numeroNf) return;
  const avaliacao = buscarAvaliacaoProduto(estado.id, numeroNf);
  if (!avaliacao) return;

  window._avaliacaoVinculada = avaliacao;
  const avaliadoPor = avaliacao.enviadoPorNome || avaliacao.enviadoPorEmail || '—';
  let algumCasou = false;

  avaliacao.notas.forEach(n => {
    const nomeNormalizado = normalizarNomeCriterio(n.nome);
    const inp = Array.from(document.querySelectorAll('.cf-resposta-input[data-tipo="nota"]')).find(
      el => normalizarNomeCriterio(el.dataset.criterioNome) === nomeNormalizado
    );
    if (!inp) return;

    algumCasou = true;
    inp.value = n.nota;
    inp.disabled = true;
    inp.dataset.travadoAvaliacao = '1';
    inp.dataset.avaliadoPor = avaliadoPor;
    inp.dataset.motivo = n.motivo || '';

    const critId = inp.dataset.criterioId;
    const motivoWrap = document.getElementById(`cf-motivo-wrap-${critId}`);
    if (motivoWrap) {
      motivoWrap.innerHTML = `<div style="margin-top:6px; font-size:11px; color:var(--text-sec)">Já avaliado por <b>${escapeHtml(avaliadoPor)}</b>${n.motivo ? ` — Motivo: ${escapeHtml(n.motivo)}` : ''}</div>`;
    }

    // Régua (opções): trava a caixinha fechada e atualiza o rótulo.
    const closedBox = document.getElementById(`lp-select-closed-${critId}`);
    const labelEl = document.getElementById(`lp-select-label-${critId}`);
    if (closedBox) {
      closedBox.onclick = null;
      closedBox.style.cursor = 'not-allowed';
      closedBox.style.opacity = '0.7';
      closedBox.style.background = 'var(--surface2)';
    }
    if (labelEl) {
      const opcaoTexto = n.opcoes?.find(op => op.pontos === n.nota)?.label;
      labelEl.textContent = opcaoTexto ? `${opcaoTexto} (${n.nota}P)` : `${n.nota}P (já avaliado)`;
      labelEl.style.color = 'var(--text)';
    }
  });

  if (infoBox && algumCasou) {
    infoBox.innerHTML = `<div style="margin:10px 0; padding:8px 12px; background:var(--surface2); border-radius:8px; font-size:12px; display:flex; align-items:center; gap:6px">
      ${ic('check', 13)} Avaliação encontrada pra essa NF (por ${escapeHtml(avaliadoPor)}) — critérios de mesmo nome foram preenchidos automaticamente.
    </div>`;
  }
  if (typeof renderBotoesSalvarConferencia === 'function') renderBotoesSalvarConferencia();
}

async function salvarConferencia() {
  const d = db();
  const estado = window._fornecedorConferencia;
  const data = document.getElementById('cf-data').value;
  const numeroNf = document.getElementById('cf-nf').value.trim();

  if (!estado || (!estado.id && !estado.novo)) { toast('Busque o CNPJ do fornecedor antes de conferir.'); return; }
  if (!data) { toast('Informe a data.'); return; }
  if (!numeroNf) { toast('Informe o número da nota fiscal.'); return; }

  // Fornecedor já existe? Então já dá pra checar se essa NF já foi conferida
  // antes de mexer em mais nada. Fornecedor "novo" nunca tem conferência prévia.
  if (estado.id && buscarConferencia(estado.id, numeroNf)) {
    toast('Conferência já feita para esse fornecedor/nota fiscal.');
    return;
  }

  let nomeFornecedor = estado.id
    ? (d.fornecedores.find(f => f.id === estado.id)?.nome || '')
    : document.getElementById('cf-nome-fornecedor').value.trim();
  if (!estado.id && !nomeFornecedor) { toast('Informe o nome do fornecedor.'); return; }

  const criteriosAtivos = d.criteriosConferencia.filter(c => c.ativo);
  const respostas = [];
  let descontoTotal = 0;
  let faltando = false;
  let acimaDoPeso = false;

  document.querySelectorAll('.cf-resposta-input').forEach(inp => {
    const criterio = criteriosAtivos.find(c => c.id === inp.dataset.criterioId);
    if (!criterio) return;
    if (inp.value === '') { faltando = true; return; }

    let valor = inp.value;
    let desconto = 0;
    let motivo = null;
    if (criterio.tipo === 'sim_nao') {
      if (valor === 'nao') desconto = Number(criterio.desconto_se_nao) || 0;
    } else if (criterio.tipo === 'nota') {
      valor = parseFloat(valor);
      const limite = criterio.peso || 10;
      if (valor > limite) { acimaDoPeso = true; return; }
      if (valor < limite) {
        if (inp.dataset.travadoAvaliacao) {
          // Motivo já foi escrito lá no Avaliar — vem junto no dataset.
          motivo = inp.dataset.motivo || '';
        } else {
          const motivoInp = document.querySelector(`.cf-nota-motivo[data-criterio-id="${criterio.id}"]`);
          motivo = motivoInp ? motivoInp.value.trim() : '';
          if (!motivo) { faltando = true; toast(`Informe o motivo de "${criterio.nome}" ter ficado abaixo do peso máximo (${limite}).`); return; }
        }
      }
    }
    descontoTotal += desconto;
    respostas.push({ criterioId: criterio.id, nome: criterio.nome, tipo: criterio.tipo, valor, desconto, motivo });
  });

  if (acimaDoPeso) { toast('Tem critério com nota acima do limite máximo permitido — corrija antes de salvar.'); return; }

  criteriosAtivos.filter(c => c.tipo === 'faixa').forEach(c => {
    const minRaw = document.querySelector(`.cf-faixa-min[data-criterio-id="${c.id}"]`)?.value;
    const maxRaw = document.querySelector(`.cf-faixa-max[data-criterio-id="${c.id}"]`)?.value;
    const recebidaRaw = document.querySelector(`.cf-faixa-recebida[data-criterio-id="${c.id}"]`)?.value;

    // Nem toda entrega tem esse tipo de conferência (ex: nem sempre dá pra
    // medir temperatura) — se os 3 campos ficaram em branco, pula esse
    // critério de vez: não bloqueia o salvamento e não entra nem no resumo
    // do Avaliar nem no histórico de conferências.
    if (!minRaw && !maxRaw && !recebidaRaw) return;

    const min = parseFloat(minRaw);
    const max = parseFloat(maxRaw);
    const recebida = parseFloat(recebidaRaw);
    if (isNaN(min) || isNaN(max) || isNaN(recebida)) { faltando = true; return; }

    const dentro = recebida >= min && recebida <= max;
    let desconto = 0;
    let rpnc = null;
    if (!dentro) {
      const rpncInp = document.querySelector(`.cf-faixa-rpnc[data-criterio-id="${c.id}"]`);
      rpnc = rpncInp ? rpncInp.value.trim() : '';
      // Não trava mais o salvamento se ficar em branco — quem trava agora é o
      // formulário de RNC não estar preenchido (checado logo abaixo). Se a
      // pessoa digitar algo aqui, esse texto vira o número do RNC vinculado.
      desconto = Number(c.desconto_se_nao) || 0;
    }
    descontoTotal += desconto;
    respostas.push({
      criterioId: c.id, nome: c.nome, tipo: 'faixa', unidade: c.unidade,
      min, max, valor: recebida, dentroFaixa: dentro, rpnc, desconto,
    });
  });

  if (faltando || !respostas.length) { toast('Preencha todos os critérios.'); return; }

  const criteriosSemRncPendente = respostas.filter(r =>
    r.tipo === 'faixa' && !r.dentroFaixa && !(typeof _rncsPendentesLancamento !== 'undefined' && _rncsPendentesLancamento[r.criterioId])
  );
  if (criteriosSemRncPendente.length) {
    toast(`Preencha o RNC de "${criteriosSemRncPendente[0].nome}" (ficou fora da faixa) antes de salvar.`);
    return;
  }

  mostrarCarregando('Salvando conferência...');

  let fornecedorId = estado.id;
  if (!fornecedorId) {
    const { data: novoForn, error: errForn } = await supabaseClient.from('fornecedores').insert({
      empresa_id: currentUser.empresaId, nome: nomeFornecedor, cnpj: formatarCNPJ(estado.cnpj),
      tipo: 'produto', ativo: true, diverso: true, campos_custom: {},
    }).select().single();
    if (errForn) { esconderProgresso(); toast('Erro ao cadastrar fornecedor: ' + errForn.message); return; }
    fornecedorId = novoForn.id;
    await carregarFornecedores();
  }

  const { data: conferenciaSalva, error } = await supabaseClient.from('conferencias').insert({
    empresa_id: currentUser.empresaId,
    fornecedor_id: fornecedorId,
    usuario_id: currentUser.id,
    data,
    numero_nf: numeroNf,
    respostas,
    desconto_total: descontoTotal,
    enviado_por_email: currentUser.email,
  }).select().single();

  if (error) { esconderProgresso(); toast('Erro ao salvar conferência: ' + error.message); return; }

  if (typeof salvarRncsPendentesAoLancarConferencia === 'function' && Object.keys(_rncsPendentesLancamento || {}).length) {
    await salvarRncsPendentesAoLancarConferencia(conferenciaSalva, fornecedorId, numeroNf);
  }

  addLog('conferencia_lancada', `${currentUser.email} lançou conferência da NF ${numeroNf} do fornecedor "${nomeFornecedor}"`);
  mostrarSucesso('Conferência salva!');
  await carregarConferencias();
  renderLancarConferenciaTab();
}

// ---------- Critérios (config) ----------
function renderCriteriosConferenciaTab() {
  const d = db();
  const wrap = document.getElementById('conferencia-tab-criterios');
  wrap.innerHTML = `
    <div class="card sup-new-card ${_novoCriterioConferenciaAberto ? 'open' : ''}" id="novo-criterio-conferencia-card" style="margin-bottom:16px">
      <div class="sup-new-card-header" onclick="toggleNovoCriterioConferenciaCard()">
        <div class="sup-new-icon">+</div>
        <div class="sup-new-card-title-wrap">
          <div class="sup-new-card-title">Novo critério</div>
          <div class="sup-new-card-subtitle">Sim/Não, Nota, Faixa numérica ou Texto livre.</div>
        </div>
        <div class="sup-new-chevron">⌄</div>
      </div>
      <div class="sup-new-card-body" id="novo-criterio-conferencia-body" style="${_novoCriterioConferenciaAberto ? '' : 'display:none'}">
      <div class="form-row three">
        <div class="form-group"><label>Nome</label><input type="text" id="cc-nome" placeholder="Ex: Temperatura de recebimento"></div>
        <div class="form-group">
          <label>Tipo</label>
          <select id="cc-tipo" onchange="atualizarCamposTipoCriterioConferencia()">
            <option value="sim_nao">Sim/Não (desconta ponto se "Não")</option>
            <option value="nota">Nota de 0 a 10 (liga com critério de mesmo nome no Avaliar Produto)</option>
            <option value="faixa">Faixa numérica (mín/máx recomendado + valor recebido — ex: temperatura, umidade, peso)</option>
            <option value="texto">Texto livre (só informativo)</option>
          </select>
        </div>
        <div class="form-group" id="cc-desconto-wrap"><label>Desconto se "Não"/fora da faixa</label><input type="number" id="cc-desconto" min="0" step="0.5" value="1"></div>
      </div>
      <div class="form-row three" id="cc-unidade-wrap" style="display:none">
        <div class="form-group"><label>Unidade</label><input type="text" id="cc-unidade" placeholder="Ex: º, %, kg" maxlength="6"></div>
      </div>
      <div class="form-row three" id="cc-peso-wrap" style="display:none">
        <div class="form-group">
          <label>Peso</label>
          <input type="number" id="cc-peso" min="1" step="1" value="10">
          <p style="font-size:11px; color:var(--text-muted); margin-top:4px">Se já existir um critério ativo de mesmo nome no Avaliar Produto com régua configurada, essa régua é copiada pra cá (o peso também vem de lá). Senão, geramos uma régua em branco do tamanho do peso pra você preencher.</p>
        </div>
      </div>
      <button class="btn btn-primary" style="margin-top:10px" onclick="addCriterioConferencia()">Adicionar critério</button>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Critérios cadastrados (${d.criteriosConferencia.length})</div>
      ${!d.criteriosConferencia.length ? '<div class="empty-state"><p>Nenhum critério cadastrado ainda.</p></div>' : `
        <div style="overflow-x:auto">
        <table>
          <thead><tr><th>Nome</th><th>Tipo</th><th>Peso</th><th>Régua</th><th>Desconto</th><th>Ativo</th><th></th></tr></thead>
          <tbody>
            ${d.criteriosConferencia.map(c => `<tr>
              <td>${c.nome}</td>
              <td>${c.tipo === 'sim_nao' ? 'Sim/Não' : c.tipo === 'nota' ? 'Nota (0-10)' : c.tipo === 'faixa' ? `Faixa (${c.unidade})` : 'Texto'}</td>
              <td>${c.tipo === 'nota' ? c.peso : '—'}</td>
              <td>${c.tipo === 'nota' ? ((c.opcoes && c.opcoes.length) ? `<span style="color:var(--accent); font-weight:600">${c.opcoes.length} opções</span>` : '<span style="color:var(--text-muted)">Livre</span>') : '—'}</td>
              <td>${(c.tipo === 'sim_nao' || c.tipo === 'faixa') ? c.desconto_se_nao : '—'}</td>
              <td><input type="checkbox" ${c.ativo ? 'checked' : ''} onchange="toggleCriterioConferenciaAtivo('${c.id}', this.checked)"></td>
              <td><div class="actions">${c.tipo === 'nota' ? `<button class="btn btn-secondary btn-sm" onclick="toggleReguaEditor('conferencia', '${c.id}')">Editar régua</button>` : ''} <button class="btn btn-danger btn-sm" onclick="excluirCriterioConferencia('${c.id}')">Excluir</button></div></td>
            </tr>
            ${(window._reguaEmEdicaoTipo === 'conferencia' && window._reguaEmEdicaoId === c.id) ? `<tr><td colspan="7">${renderReguaEditorHtml('conferencia', c)}</td></tr>` : ''}`).join('')}
          </tbody>
        </table>
        </div>
      `}
    </div>
  `;
}

function atualizarCamposTipoCriterioConferencia() {
  const tipo = document.getElementById('cc-tipo').value;
  document.getElementById('cc-desconto-wrap').style.display = (tipo === 'sim_nao' || tipo === 'faixa') ? 'block' : 'none';
  document.getElementById('cc-unidade-wrap').style.display = tipo === 'faixa' ? 'flex' : 'none';
  document.getElementById('cc-peso-wrap').style.display = tipo === 'nota' ? 'flex' : 'none';
}

async function addCriterioConferencia() {
  const nome = document.getElementById('cc-nome').value.trim();
  const tipo = document.getElementById('cc-tipo').value;
  const desconto = parseFloat(document.getElementById('cc-desconto').value) || 0;
  const unidade = document.getElementById('cc-unidade').value.trim();
  if (!nome) { toast('Informe o nome do critério.'); return; }
  if (tipo === 'faixa' && !unidade) { toast('Informe a unidade (ex: º, %, kg).'); return; }

  const d = db();
  let peso = 10;
  let opcoes = [];
  let origemRegua = '';

  if (tipo === 'nota') {
    peso = parseFloat(document.getElementById('cc-peso').value) || 10;
    const critProdutoMatch = d.criteriosProduto.find(cp => cp.ativo && normalizarNomeCriterio(cp.nome) === normalizarNomeCriterio(nome));
    if (critProdutoMatch && critProdutoMatch.opcoes && critProdutoMatch.opcoes.length) {
      // Já existe um critério ativo de mesmo nome no Avaliar Produto, com
      // régua configurada — copia a régua (e o peso) de lá, pra ficar igual.
      peso = critProdutoMatch.peso;
      opcoes = critProdutoMatch.opcoes.map(o => ({ ...o }));
      origemRegua = ' (régua copiada do Avaliar Produto)';
    } else {
      opcoes = getModeloReguaPadrao(nome, peso);
      origemRegua = ' com régua sugerida — revise e ajuste se quiser';
    }
  }

  const { error } = await supabaseClient.from('criterios_conferencia').insert({
    empresa_id: currentUser.empresaId, nome, tipo, desconto_se_nao: desconto,
    unidade: tipo === 'faixa' ? unidade : null, ativo: true,
    peso: tipo === 'nota' ? peso : null,
    opcoes: tipo === 'nota' ? opcoes : [],
  });
  if (error) { toast('Erro ao adicionar critério: ' + error.message); return; }

  addLog('criterio_conferencia_criado', `${currentUser.email} criou o critério de conferência "${nome}"`);
  await carregarCriteriosConferencia();
  renderCriteriosConferenciaTab();
  toast(`Critério adicionado${tipo === 'nota' ? origemRegua : ''}!`);
}

async function toggleCriterioConferenciaAtivo(id, ativo) {
  const { error } = await supabaseClient.from('criterios_conferencia').update({ ativo }).eq('id', id);
  if (error) { toast('Erro ao atualizar critério: ' + error.message); return; }
  await carregarCriteriosConferencia();
  renderCriteriosConferenciaTab();
}

async function excluirCriterioConferencia(id) {
  if (!confirm('Excluir esse critério? Conferências já lançadas não são afetadas (ficam com a foto de quando foram feitas).')) return;
  const { error } = await supabaseClient.from('criterios_conferencia').delete().eq('id', id);
  if (error) { toast('Erro ao excluir critério: ' + error.message); return; }
  await carregarCriteriosConferencia();
  renderCriteriosConferenciaTab();
}
