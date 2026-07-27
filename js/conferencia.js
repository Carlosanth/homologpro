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
let _cabecalhoConferenciaAberto = false;
let _novoCriterioConferenciaAberto = false;

function toggleConferirRecebimentoCard(forcarAberto) {
  _conferirRecebimentoAberto = typeof forcarAberto === 'boolean' ? forcarAberto : !_conferirRecebimentoAberto;
  const card = document.getElementById('conferir-recebimento-card');
  const body = document.getElementById('conferir-recebimento-body');
  if (card) card.classList.toggle('open', _conferirRecebimentoAberto);
  if (body) body.style.display = _conferirRecebimentoAberto ? 'block' : 'none';
}

function toggleCabecalhoConferenciaCard() {
  _cabecalhoConferenciaAberto = !_cabecalhoConferenciaAberto;
  document.getElementById('cabecalho-conferencia-card').classList.toggle('open', _cabecalhoConferenciaAberto);
  document.getElementById('cabecalho-conferencia-body').style.display = _cabecalhoConferenciaAberto ? 'block' : 'none';
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
    </div>
    <div id="conferencia-tab-lancar" style="display:${_abaConferencia === 'lancar' ? 'block' : 'none'}"></div>
    <div id="conferencia-tab-criterios" style="display:${_abaConferencia === 'criterios' ? 'block' : 'none'}"></div>
  `;
  if (_abaConferencia === 'lancar') renderLancarConferenciaTab();
  else renderCriteriosConferenciaTab();
}

function mudarAbaConferencia(aba, btn) {
  _abaConferencia = aba;
  document.querySelectorAll('#ad-page-conferencia .tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('conferencia-tab-lancar').style.display = aba === 'lancar' ? 'block' : 'none';
  document.getElementById('conferencia-tab-criterios').style.display = aba === 'criterios' ? 'block' : 'none';
  if (aba === 'lancar') renderLancarConferenciaTab();
  else renderCriteriosConferenciaTab();
}

// ---------- Fazer conferência ----------
function renderLancarConferenciaTab() {
  const d = db();
  const wrap = document.getElementById('conferencia-tab-lancar');
  const criteriosAtivos = d.criteriosConferencia.filter(c => c.ativo);

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
            <input type="text" id="cf-cnpj" placeholder="00.000.000/0000-00" oninput="this.value = formatarCNPJ(this.value)" style="flex:1">
            <button type="button" class="btn btn-secondary btn-sm" onclick="buscarFornecedorPorCnpjConferencia()" style="display:inline-flex; align-items:center; gap:6px">${ic('search', 13)} Buscar</button>
          </div>
        </div>
        <div class="form-group">
          <label>Nome do fornecedor</label>
          <input type="text" id="cf-nome-fornecedor" placeholder="Busque o CNPJ primeiro" disabled>
          <div id="cf-status-fornecedor" style="margin-top:6px; font-size:11px"></div>
        </div>
        <div class="form-group"><label>Nº da Nota Fiscal</label><input type="text" id="cf-nf" placeholder="Ex: 117743"></div>
        <div class="form-group"><label>Data</label><input type="date" id="cf-data" value="${hoje.toISOString().slice(0,10)}"></div>
      </div>
      <p style="font-size:12px; font-weight:600; color:var(--text-sec); margin:14px 0 8px">Critérios</p>
      <div class="form-row three" id="cf-criterios">
        ${criteriosAtivos.filter(c => c.tipo !== 'faixa').map(c => `
          <div class="form-group">
            <label>${c.nome}${c.tipo === 'sim_nao' ? ` <span style="color:var(--text-muted); font-weight:400">(desconta ${c.desconto_se_nao} se "Não")</span>` : ''}</label>
            ${c.tipo === 'sim_nao' ? `
              <select class="cf-resposta-input" data-criterio-id="${c.id}" data-tipo="sim_nao">
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            ` : c.tipo === 'nota' ? `
              <input type="number" min="0" max="10" step="0.5" class="cf-resposta-input" data-criterio-id="${c.id}" data-tipo="nota" placeholder="0 a 10">
            ` : `
              <input type="text" class="cf-resposta-input" data-criterio-id="${c.id}" data-tipo="texto">
            `}
          </div>
        `).join('')}
      </div>
      ${criteriosAtivos.filter(c => c.tipo === 'faixa').map(c => `
        <div class="form-group" style="margin-top:10px">
          <label>${c.nome} <span style="color:var(--text-muted); font-weight:400">(desconta ${c.desconto_se_nao} se fora da faixa)</span></label>
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
      <button class="btn btn-primary" style="margin-top:16px" onclick="salvarConferencia()">Salvar conferência</button>
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
      <button class="btn btn-secondary btn-sm" style="margin-bottom:14px" onclick="gerarRelatorioConferencia()">${ic('fileText', 13)} Gerar relatório (PDF)</button>
      <div id="cf-lista-wrap">${renderListaConferenciasHtml()}</div>
    </div>
  `;
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

function renderDetalheResposta(r) {
  let valor, icone = '', extra = '';
  if (r.tipo === 'sim_nao') {
    valor = r.valor === 'nao' ? 'Não' : 'Sim';
    icone = iconeStatusSvg(r.valor !== 'nao');
  } else if (r.tipo === 'nota') {
    valor = `${r.valor}/10`;
  } else if (r.tipo === 'texto') {
    valor = r.valor;
  } else if (r.tipo === 'faixa') {
    valor = `${r.valor}${r.unidade || ''} <span style="font-weight:400; color:var(--text-muted)">(rec. ${r.min}-${r.max}${r.unidade || ''})</span>`;
    icone = iconeStatusSvg(r.dentroFaixa);
    if (!r.dentroFaixa) extra = `<div style="font-size:11px; color:var(--danger); margin-top:2px">RPNC: ${r.rpnc}</div>`;
  } else {
    valor = r.valor;
  }
  return `
    <div style="min-width:150px">
      <div style="font-size:11px; color:var(--text-muted); margin-bottom:2px">${r.nome}</div>
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
            <span class="sup-name">${forn ? forn.nome : '—'}</span>
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
          ${c.respostas.map(r => renderDetalheResposta(r)).join('')}
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

function formatarRespostaTextoPdf(r) {
  if (!r) return '—';
  if (r.tipo === 'sim_nao') return r.valor === 'nao' ? 'Não' : 'Sim';
  if (r.tipo === 'nota') return `${r.valor}/10`;
  if (r.tipo === 'texto') return r.valor || '—';
  if (r.tipo === 'faixa') {
    return r.dentroFaixa
      ? `Recomendado ${r.min}-${r.max}${r.unidade || ''} · Recebido ${r.valor}${r.unidade || ''} (dentro da faixa)`
      : `Recomendado ${r.min}-${r.max}${r.unidade || ''} · Recebido ${r.valor}${r.unidade || ''} (FORA — RPNC ${r.rpnc})`;
  }
  return String(r.valor ?? '—');
}

// Relatório em PDF pra imprimir/levar em reunião — respeita os filtros
// atuais (De/Até/Fornecedor/CNPJ). As colunas de critério vêm do que foi
// REALMENTE respondido em cada conferência da lista filtrada — não do
// estado atual dos critérios — assim uma conferência antiga não perde a
// coluna se o critério for desativado ou renomeado depois (mesmo
// princípio da situação congelada nas avaliações).
function gerarRelatorioConferencia() {
  const d = db();
  const lista = conferenciasFiltradas();
  if (!lista.length) { toast('Nenhuma conferência encontrada com os filtros atuais pra gerar o relatório.'); return; }

  const colunasCriterios = [];
  const vistos = new Set();
  lista.forEach(c => c.respostas.forEach(r => {
    if (!vistos.has(r.criterioId)) { vistos.add(r.criterioId); colunasCriterios.push({ id: r.criterioId, nome: r.nome }); }
  }));

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });

  let y = 14;
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text(d.nomeEmpresa || 'Empresa', 14, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  (d.conferenciaCabecalho || []).forEach(linha => {
    if (!linha.rotulo && !linha.valor) return;
    doc.text(`${linha.rotulo}: ${linha.valor}`, 14, y);
    y += 5;
  });
  y += 3;

  const head = [['Data', 'Fornecedor', 'NF', ...colunasCriterios.map(c => c.nome), 'Quem avaliou']];
  const body = lista.map(c => {
    const forn = d.fornecedores.find(f => f.id === c.fornecedorId);
    return [
      fmtDataSimples(c.data),
      forn ? forn.nome : '—',
      c.numeroNf,
      ...colunasCriterios.map(col => formatarRespostaTextoPdf(c.respostas.find(r => r.criterioId === col.id))),
      c.enviadoPorEmail || '—',
    ];
  });

  doc.autoTable({
    head, body, startY: y,
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [8, 60, 81] },
  });

  doc.save(`conferencia-${new Date().toISOString().slice(0, 10)}.pdf`);
  addLog('relatorio_conferencia_gerado', `${currentUser.email} gerou um relatório de conferência (${lista.length} registro(s))`);
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
  if (isNaN(min) || isNaN(max) || isNaN(recebida)) { statusEl.innerHTML = ''; return; }

  const dentro = recebida >= min && recebida <= max;
  if (dentro) {
    statusEl.innerHTML = '<div style="margin-top:6px; font-size:12px; color:var(--success)">✅ Dentro da faixa recomendada</div>';
  } else {
    statusEl.innerHTML = `
      <div style="margin-top:6px; font-size:12px; color:var(--danger); font-weight:600">⚠️ Fora da faixa recomendada</div>
      <div class="form-group" style="margin-top:6px; max-width:280px">
        <label>RPNC (obrigatório, fora da faixa)</label>
        <input type="text" class="cf-faixa-rpnc" data-criterio-id="${criterioId}" placeholder="Nº ou referência da não conformidade">
      </div>
    `;
  }
}

async function salvarConferencia() {
  const d = db();
  const estado = window._fornecedorConferencia;
  const data = document.getElementById('cf-data').value;
  const numeroNf = document.getElementById('cf-nf').value.trim();

  if (!estado || (!estado.id && !estado.novo)) { toast('Busque o CNPJ do fornecedor antes de conferir.'); return; }
  if (!data) { toast('Informe a data.'); return; }
  if (!numeroNf) { toast('Informe o número da nota fiscal.'); return; }

  let nomeFornecedor = estado.id
    ? (d.fornecedores.find(f => f.id === estado.id)?.nome || '')
    : document.getElementById('cf-nome-fornecedor').value.trim();
  if (!estado.id && !nomeFornecedor) { toast('Informe o nome do fornecedor.'); return; }

  const criteriosAtivos = d.criteriosConferencia.filter(c => c.ativo);
  const respostas = [];
  let descontoTotal = 0;
  let faltando = false;

  document.querySelectorAll('.cf-resposta-input').forEach(inp => {
    const criterio = criteriosAtivos.find(c => c.id === inp.dataset.criterioId);
    if (!criterio) return;
    if (inp.value === '') { faltando = true; return; }

    let valor = inp.value;
    let desconto = 0;
    if (criterio.tipo === 'sim_nao') {
      if (valor === 'nao') desconto = Number(criterio.desconto_se_nao) || 0;
    } else if (criterio.tipo === 'nota') {
      valor = parseFloat(valor);
    }
    descontoTotal += desconto;
    respostas.push({ criterioId: criterio.id, nome: criterio.nome, tipo: criterio.tipo, valor, desconto });
  });

  criteriosAtivos.filter(c => c.tipo === 'faixa').forEach(c => {
    const min = parseFloat(document.querySelector(`.cf-faixa-min[data-criterio-id="${c.id}"]`)?.value);
    const max = parseFloat(document.querySelector(`.cf-faixa-max[data-criterio-id="${c.id}"]`)?.value);
    const recebida = parseFloat(document.querySelector(`.cf-faixa-recebida[data-criterio-id="${c.id}"]`)?.value);
    if (isNaN(min) || isNaN(max) || isNaN(recebida)) { faltando = true; return; }

    const dentro = recebida >= min && recebida <= max;
    let desconto = 0;
    let rpnc = null;
    if (!dentro) {
      const rpncInp = document.querySelector(`.cf-faixa-rpnc[data-criterio-id="${c.id}"]`);
      rpnc = rpncInp ? rpncInp.value.trim() : '';
      if (!rpnc) { faltando = true; toast(`Informe o RPNC de "${c.nome}" (ficou fora da faixa).`); return; }
      desconto = Number(c.desconto_se_nao) || 0;
    }
    descontoTotal += desconto;
    respostas.push({
      criterioId: c.id, nome: c.nome, tipo: 'faixa', unidade: c.unidade,
      min, max, valor: recebida, dentroFaixa: dentro, rpnc, desconto,
    });
  });

  if (faltando || !respostas.length) { toast('Preencha todos os critérios.'); return; }

  let fornecedorId = estado.id;
  if (!fornecedorId) {
    const { data: novoForn, error: errForn } = await supabaseClient.from('fornecedores').insert({
      empresa_id: currentUser.empresaId, nome: nomeFornecedor, cnpj: formatarCNPJ(estado.cnpj),
      tipo: 'produto', ativo: true, diverso: true, campos_custom: {},
    }).select().single();
    if (errForn) { toast('Erro ao cadastrar fornecedor: ' + errForn.message); return; }
    fornecedorId = novoForn.id;
    await carregarFornecedores();
  }

  const { error } = await supabaseClient.from('conferencias').insert({
    empresa_id: currentUser.empresaId,
    fornecedor_id: fornecedorId,
    usuario_id: currentUser.id,
    data,
    numero_nf: numeroNf,
    respostas,
    desconto_total: descontoTotal,
    enviado_por_email: currentUser.email,
  });

  if (error) { toast('Erro ao salvar conferência: ' + error.message); return; }

  addLog('conferencia_lancada', `${currentUser.email} lançou conferência da NF ${numeroNf} do fornecedor "${nomeFornecedor}"`);
  toast('Conferência salva!');
  await carregarConferencias();
  renderLancarConferenciaTab();
}

// ---------- Critérios (config) ----------
function renderCriteriosConferenciaTab() {
  const d = db();
  const wrap = document.getElementById('conferencia-tab-criterios');
  wrap.innerHTML = `
    <div class="card sup-new-card ${_cabecalhoConferenciaAberto ? 'open' : ''}" id="cabecalho-conferencia-card" style="margin-bottom:16px">
      <div class="sup-new-card-header" onclick="toggleCabecalhoConferenciaCard()">
        <div class="sup-new-icon">+</div>
        <div class="sup-new-card-title-wrap">
          <div class="sup-new-card-title">Cabeçalho do relatório impresso</div>
          <div class="sup-new-card-subtitle">Livre — título, código do documento, revisão, ou qualquer campo específico da sua empresa.</div>
        </div>
        <div class="sup-new-chevron">⌄</div>
      </div>
      <div class="sup-new-card-body" id="cabecalho-conferencia-body" style="${_cabecalhoConferenciaAberto ? '' : 'display:none'}">
      <div id="cc-cabecalho-linhas">
        ${(d.conferenciaCabecalho.length ? d.conferenciaCabecalho : [{ rotulo: '', valor: '' }]).map((linha, i) => `
          <div class="form-row" style="grid-template-columns:1fr 1fr auto; align-items:flex-end; margin-bottom:8px" data-linha-index="${i}">
            <div class="form-group" style="margin:0"><label>Rótulo</label><input type="text" class="cc-cab-rotulo" value="${linha.rotulo || ''}" placeholder="Ex: Título"></div>
            <div class="form-group" style="margin:0"><label>Valor</label><input type="text" class="cc-cab-valor" value="${linha.valor || ''}" placeholder="Ex: Controle de Temperatura de Recebimento"></div>
            <button type="button" class="btn btn-danger btn-sm" onclick="removerLinhaCabecalhoConferencia(this)">Excluir</button>
          </div>
        `).join('')}
      </div>
      <button type="button" class="btn btn-secondary btn-sm" onclick="addLinhaCabecalhoConferencia()">+ Adicionar linha</button>
      <button class="btn btn-primary" style="margin-top:10px; margin-left:8px" onclick="salvarCabecalhoConferencia()">Salvar cabeçalho</button>
      </div>
    </div>
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
      <button class="btn btn-primary" style="margin-top:10px" onclick="addCriterioConferencia()">Adicionar critério</button>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Critérios cadastrados (${d.criteriosConferencia.length})</div>
      ${!d.criteriosConferencia.length ? '<div class="empty-state"><p>Nenhum critério cadastrado ainda.</p></div>' : `
        <table>
          <thead><tr><th>Nome</th><th>Tipo</th><th>Desconto</th><th>Ativo</th><th></th></tr></thead>
          <tbody>
            ${d.criteriosConferencia.map(c => `<tr>
              <td>${c.nome}</td>
              <td>${c.tipo === 'sim_nao' ? 'Sim/Não' : c.tipo === 'nota' ? 'Nota (0-10)' : c.tipo === 'faixa' ? `Faixa (${c.unidade})` : 'Texto'}</td>
              <td>${(c.tipo === 'sim_nao' || c.tipo === 'faixa') ? c.desconto_se_nao : '—'}</td>
              <td><input type="checkbox" ${c.ativo ? 'checked' : ''} onchange="toggleCriterioConferenciaAtivo('${c.id}', this.checked)"></td>
              <td><button class="btn btn-danger btn-sm" onclick="excluirCriterioConferencia('${c.id}')">Excluir</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      `}
    </div>
  `;
}

function atualizarCamposTipoCriterioConferencia() {
  const tipo = document.getElementById('cc-tipo').value;
  document.getElementById('cc-desconto-wrap').style.display = (tipo === 'sim_nao' || tipo === 'faixa') ? 'block' : 'none';
  document.getElementById('cc-unidade-wrap').style.display = tipo === 'faixa' ? 'flex' : 'none';
}

function addLinhaCabecalhoConferencia() {
  const container = document.getElementById('cc-cabecalho-linhas');
  const div = document.createElement('div');
  div.className = 'form-row';
  div.style.cssText = 'grid-template-columns:1fr 1fr auto; align-items:flex-end; margin-bottom:8px';
  div.innerHTML = `
    <div class="form-group" style="margin:0"><label>Rótulo</label><input type="text" class="cc-cab-rotulo" placeholder="Ex: Código"></div>
    <div class="form-group" style="margin:0"><label>Valor</label><input type="text" class="cc-cab-valor" placeholder="Ex: ANX.ALM.001"></div>
    <button type="button" class="btn btn-danger btn-sm" onclick="removerLinhaCabecalhoConferencia(this)">Excluir</button>
  `;
  container.appendChild(div);
}

function removerLinhaCabecalhoConferencia(btn) {
  btn.closest('.form-row').remove();
}

async function salvarCabecalhoConferencia() {
  const linhas = [];
  document.querySelectorAll('#cc-cabecalho-linhas .form-row').forEach(row => {
    const rotulo = row.querySelector('.cc-cab-rotulo').value.trim();
    const valor = row.querySelector('.cc-cab-valor').value.trim();
    if (rotulo || valor) linhas.push({ rotulo, valor });
  });

  const { error } = await supabaseClient.from('empresas').update({ conferencia_cabecalho: linhas }).eq('id', currentUser.empresaId);
  if (error) { toast('Erro ao salvar cabeçalho: ' + error.message); return; }

  empresaConfigCache.conferencia_cabecalho = linhas;
  addLog('cabecalho_conferencia_atualizado', `${currentUser.email} atualizou o cabeçalho do relatório de conferência`);
  toast('Cabeçalho salvo!');
}

async function addCriterioConferencia() {
  const nome = document.getElementById('cc-nome').value.trim();
  const tipo = document.getElementById('cc-tipo').value;
  const desconto = parseFloat(document.getElementById('cc-desconto').value) || 0;
  const unidade = document.getElementById('cc-unidade').value.trim();
  if (!nome) { toast('Informe o nome do critério.'); return; }
  if (tipo === 'faixa' && !unidade) { toast('Informe a unidade (ex: º, %, kg).'); return; }

  const { error } = await supabaseClient.from('criterios_conferencia').insert({
    empresa_id: currentUser.empresaId, nome, tipo, desconto_se_nao: desconto,
    unidade: tipo === 'faixa' ? unidade : null, ativo: true,
  });
  if (error) { toast('Erro ao adicionar critério: ' + error.message); return; }

  addLog('criterio_conferencia_criado', `${currentUser.email} criou o critério de conferência "${nome}"`);
  await carregarCriteriosConferencia();
  renderCriteriosConferenciaTab();
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
