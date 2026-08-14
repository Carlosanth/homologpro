// ============ MÓDULO RNC (Registro de Não Conformidade) ============
// Cada empresa monta o próprio modelo de RNC (seções + campos) — nasce vazio,
// sem nenhum modelo pré-cadastrado. O RNC não tem lógica de desconto própria:
// desconto continua 100% nos critérios da Conferência; o RNC só documenta e
// pode ser vinculado a um critério que já descontou (ver conferencia.js).

let _novaSecaoRncAberta = false;
let _secoesRncEmConstrucao = []; // seções do modelo sendo montado na tela "Novo modelo"

const TIPOS_SECAO_RNC = [
  { valor: 'checkbox_grupo', label: 'Marcar várias opções (grupo de checkbox)' },
  { valor: 'selecao_unica', label: 'Marcar uma única opção' },
  { valor: 'campos_diversos', label: 'Campos de texto/data/responsável' },
];

// ---------- Aba "Modelos de RNC" ----------
function renderRncModelosTab() {
  const d = db();
  const wrap = document.getElementById('conferencia-tab-rnc');
  const modelos = d.rncModelos || [];

  wrap.innerHTML = `
    <div class="card sup-new-card ${_novaSecaoRncAberta ? 'open' : ''}" id="novo-modelo-rnc-card" style="margin-bottom:16px">
      <div class="sup-new-card-header" onclick="toggleNovoModeloRncCard()">
        <div class="sup-new-icon">+</div>
        <div class="sup-new-card-title-wrap">
          <div class="sup-new-card-title">Novo modelo de RNC</div>
          <div class="sup-new-card-subtitle">Monte as seções e campos do formulário de não conformidade da sua empresa.</div>
        </div>
        <div class="sup-new-chevron">⌄</div>
      </div>
      <div class="sup-new-card-body" id="novo-modelo-rnc-body" style="${_novaSecaoRncAberta ? '' : 'display:none'}">
        ${renderConstrutorModeloRncHtml()}
      </div>
    </div>
    <div class="card">
      <div class="card-title">Modelos cadastrados (${modelos.length})</div>
      ${!modelos.length ? '<div class="empty-state"><p>Nenhum modelo de RNC cadastrado ainda. Crie um acima para poder vincular RNCs na Conferência.</p></div>' : `
        <div style="overflow-x:auto">
        <table>
          <thead><tr><th>Nome</th><th>Código</th><th>Revisão</th><th>Seções</th><th>Ativo</th><th></th></tr></thead>
          <tbody>
            ${modelos.map(m => `<tr>
              <td>${m.nome}</td>
              <td>${m.codigo || '—'}</td>
              <td>${m.revisao || '—'}</td>
              <td>${(m.secoes || []).length}</td>
              <td><input type="checkbox" ${m.ativo ? 'checked' : ''} onchange="toggleRncModeloAtivo('${m.id}', this.checked)"></td>
              <td><div class="actions"><button class="btn btn-danger btn-sm" onclick="excluirRncModelo('${m.id}')">Excluir</button></div></td>
            </tr>`).join('')}
          </tbody>
        </table>
        </div>
      `}
    </div>
  `;
}

function toggleNovoModeloRncCard() {
  _novaSecaoRncAberta = !_novaSecaoRncAberta;
  if (_novaSecaoRncAberta && !_secoesRncEmConstrucao.length) {
    _secoesRncEmConstrucao = [{ id: gerarIdSecaoRnc(), titulo: '', tipo: 'checkbox_grupo', campos: [] }];
  }
  document.getElementById('novo-modelo-rnc-card').classList.toggle('open', _novaSecaoRncAberta);
  document.getElementById('novo-modelo-rnc-body').style.display = _novaSecaoRncAberta ? 'block' : 'none';
  if (_novaSecaoRncAberta) renderRncModelosTab();
}

function gerarIdSecaoRnc() {
  return 'sec_' + Math.random().toString(36).slice(2, 9);
}
function gerarIdCampoRnc() {
  return 'campo_' + Math.random().toString(36).slice(2, 9);
}

function renderConstrutorModeloRncHtml() {
  return `
    <div class="form-row three">
      <div class="form-group"><label>Nome do modelo</label><input type="text" id="rnc-modelo-nome" placeholder="Nome que identifica esse formulário para sua equipe"></div>
      <div class="form-group"><label>Código do documento (opcional)</label><input type="text" id="rnc-modelo-codigo" placeholder="Se sua empresa usa um código interno de documento"></div>
      <div class="form-group"><label>Revisão (opcional)</label><input type="text" id="rnc-modelo-revisao" placeholder="Se sua empresa controla versão/revisão do documento"></div>
    </div>

    <div id="rnc-secoes-lista">
      ${_secoesRncEmConstrucao.map((sec, i) => renderSecaoRncHtml(sec, i)).join('')}
    </div>
    <button type="button" class="btn btn-secondary btn-sm" style="margin-top:8px" onclick="addSecaoRncConstrucao()">+ Adicionar seção</button>
    <button class="btn btn-primary" style="margin-top:10px; margin-left:8px" onclick="salvarModeloRnc()">Salvar modelo</button>
  `;
}

function renderSecaoRncHtml(sec, i) {
  return `
    <div class="card" style="margin:12px 0; padding:12px" data-secao-index="${i}">
      <div class="form-row" style="grid-template-columns:2fr 2fr auto; align-items:flex-end">
        <div class="form-group" style="margin:0">
          <label>Título da seção</label>
          <input type="text" class="rnc-sec-titulo" value="${sec.titulo || ''}" placeholder="O que essa parte do formulário descreve"
            onchange="atualizarSecaoRncConstrucao(${i}, 'titulo', this.value)">
        </div>
        <div class="form-group" style="margin:0">
          <label>Formato da seção</label>
          <select class="rnc-sec-tipo" onchange="atualizarSecaoRncConstrucao(${i}, 'tipo', this.value)">
            ${TIPOS_SECAO_RNC.map(t => `<option value="${t.valor}" ${sec.tipo === t.valor ? 'selected' : ''}>${t.label}</option>`).join('')}
          </select>
        </div>
        <button type="button" class="btn btn-danger btn-sm" onclick="removerSecaoRncConstrucao(${i})">Excluir seção</button>
      </div>

      <div style="margin-top:10px">
        ${(sec.campos || []).map((campo, j) => renderCampoRncHtml(sec, i, campo, j)).join('')}
      </div>
      <button type="button" class="btn btn-secondary btn-sm" style="margin-top:6px" onclick="addCampoRncConstrucao(${i})">+ Adicionar campo</button>
    </div>
  `;
}

function renderCampoRncHtml(sec, secIndex, campo, campoIndex) {
  const precisaTipoValor = sec.tipo === 'campos_diversos';
  return `
    <div class="form-row" style="grid-template-columns:${precisaTipoValor ? '2fr 1fr auto' : '1fr auto'}; align-items:flex-end; margin-bottom:6px">
      <div class="form-group" style="margin:0">
        <label>Rótulo do campo</label>
        <input type="text" class="rnc-campo-label" value="${campo.label || ''}" placeholder="Como esse campo aparece no formulário"
          onchange="atualizarCampoRncConstrucao(${secIndex}, ${campoIndex}, 'label', this.value)">
      </div>
      ${precisaTipoValor ? `
      <div class="form-group" style="margin:0">
        <label>Tipo de valor</label>
        <select onchange="atualizarCampoRncConstrucao(${secIndex}, ${campoIndex}, 'tipo_campo', this.value)">
          <option value="texto" ${campo.tipo_campo === 'texto' ? 'selected' : ''}>Texto livre</option>
          <option value="date" ${campo.tipo_campo === 'date' ? 'selected' : ''}>Data</option>
          <option value="usuario_ref" ${campo.tipo_campo === 'usuario_ref' ? 'selected' : ''}>Responsável (usuário cadastrado)</option>
        </select>
      </div>` : ''}
      <button type="button" class="btn btn-danger btn-sm" onclick="removerCampoRncConstrucao(${secIndex}, ${campoIndex})">Excluir</button>
    </div>
  `;
}

function addSecaoRncConstrucao() {
  _secoesRncEmConstrucao.push({ id: gerarIdSecaoRnc(), titulo: '', tipo: 'checkbox_grupo', campos: [] });
  renderRncModelosTab();
}
function removerSecaoRncConstrucao(i) {
  _secoesRncEmConstrucao.splice(i, 1);
  renderRncModelosTab();
}
function atualizarSecaoRncConstrucao(i, campo, valor) {
  _secoesRncEmConstrucao[i][campo] = valor;
  if (campo === 'tipo') renderRncModelosTab(); // muda os campos disponíveis (ex: tipo_campo só existe em campos_diversos)
}
function addCampoRncConstrucao(secIndex) {
  const tipoDefault = _secoesRncEmConstrucao[secIndex].tipo === 'campos_diversos' ? 'texto' : undefined;
  _secoesRncEmConstrucao[secIndex].campos.push({ id: gerarIdCampoRnc(), label: '', tipo_campo: tipoDefault });
  renderRncModelosTab();
}
function removerCampoRncConstrucao(secIndex, campoIndex) {
  _secoesRncEmConstrucao[secIndex].campos.splice(campoIndex, 1);
  renderRncModelosTab();
}
function atualizarCampoRncConstrucao(secIndex, campoIndex, chave, valor) {
  _secoesRncEmConstrucao[secIndex].campos[campoIndex][chave] = valor;
}

async function salvarModeloRnc() {
  const nome = document.getElementById('rnc-modelo-nome').value.trim();
  const codigo = document.getElementById('rnc-modelo-codigo').value.trim();
  const revisao = document.getElementById('rnc-modelo-revisao').value.trim();

  if (!nome) { toast('Informe o nome do modelo.'); return; }
  if (!_secoesRncEmConstrucao.length || _secoesRncEmConstrucao.some(s => !s.titulo.trim())) {
    toast('Toda seção precisa de um título.'); return;
  }
  if (_secoesRncEmConstrucao.some(s => !s.campos.length)) {
    toast('Toda seção precisa de pelo menos um campo.'); return;
  }

  const { error } = await supabaseClient.from('rnc_modelos').insert({
    empresa_id: currentUser.empresaId,
    nome, codigo: codigo || null, revisao: revisao || null,
    secoes: _secoesRncEmConstrucao, ativo: true,
  });
  if (error) { toast('Erro ao salvar modelo: ' + error.message); return; }

  addLog('rnc_modelo_criado', `${currentUser.email} criou o modelo de RNC "${nome}"`);
  _secoesRncEmConstrucao = [];
  _novaSecaoRncAberta = false;
  await carregarRncModelos();
  renderRncModelosTab();
  toast('Modelo de RNC salvo!');
}

async function toggleRncModeloAtivo(id, ativo) {
  const { error } = await supabaseClient.from('rnc_modelos').update({ ativo }).eq('id', id);
  if (error) { toast('Erro ao atualizar modelo: ' + error.message); return; }
  await carregarRncModelos();
  renderRncModelosTab();
}

async function excluirRncModelo(id) {
  if (!confirm('Excluir esse modelo? RNCs já preenchidos com ele não são afetados.')) return;
  const { error } = await supabaseClient.from('rnc_modelos').delete().eq('id', id);
  if (error) { toast('Erro ao excluir modelo: ' + error.message); return; }
  await carregarRncModelos();
  renderRncModelosTab();
}

// ---------- Vincular/preencher RNC a partir da Conferência ----------
// Contexto da conferência de origem, guardado enquanto o modal está aberto.
let _rncVinculoCtx = null;
let _rncModeloEmUso = null;
let _rncDadosEmPreenchimento = {};

function abrirVincularRnc(conferenciaId, criterioId, fornecedorId, numeroNf) {
  const d = db();
  const modelosAtivos = (d.rncModelos || []).filter(m => m.ativo);
  if (!modelosAtivos.length) {
    toast('Nenhum modelo de RNC configurado ainda. Crie um na aba "Modelos de RNC".');
    return;
  }
  _rncVinculoCtx = { conferenciaId, criterioId, fornecedorId, numeroNf };
  _rncDadosEmPreenchimento = {};

  if (modelosAtivos.length === 1) {
    _rncModeloEmUso = modelosAtivos[0];
    openModal(renderFormularioRncHtml());
    return;
  }

  openModal(`
    <h3>Vincular RNC</h3>
    <p style="font-size:12px; color:var(--text-muted); margin-bottom:10px">Escolha o modelo de formulário a preencher.</p>
    <div class="form-group">
      <select id="rnc-escolher-modelo">
        ${modelosAtivos.map(m => `<option value="${m.id}">${escapeHtml(m.nome)}</option>`).join('')}
      </select>
    </div>
    <button class="btn btn-primary" onclick="selecionarModeloRncEContinuar()">Continuar</button>
  `);
}

function selecionarModeloRncEContinuar() {
  const d = db();
  const modeloId = document.getElementById('rnc-escolher-modelo').value;
  _rncModeloEmUso = (d.rncModelos || []).find(m => m.id === modeloId);
  openModal(renderFormularioRncHtml());
}

function renderFormularioRncHtml() {
  const modelo = _rncModeloEmUso;
  const d = db();
  const usuarios = d.usuarios || [];
  return `
    <h3>${escapeHtml(modelo.nome)}</h3>
    ${modelo.codigo || modelo.revisao ? `<p style="font-size:12px; color:var(--text-muted); margin-bottom:10px">${modelo.codigo ? escapeHtml(modelo.codigo) : ''}${modelo.codigo && modelo.revisao ? ' · ' : ''}${modelo.revisao ? 'Revisão ' + escapeHtml(modelo.revisao) : ''}</p>` : ''}
    <div id="rnc-form-secoes">
      ${modelo.secoes.map(sec => renderSecaoPreenchimentoHtml(sec, usuarios)).join('')}
    </div>
    <div style="display:flex; gap:8px; margin-top:14px">
      <button class="btn btn-primary" onclick="salvarRncVinculado()">Salvar RNC</button>
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    </div>
  `;
}

function renderSecaoPreenchimentoHtml(sec, usuarios) {
  if (sec.tipo === 'checkbox_grupo') {
    return `
      <div style="margin-bottom:14px">
        <p style="font-size:12px; font-weight:600; color:var(--text-sec); margin-bottom:6px">${escapeHtml(sec.titulo)}</p>
        ${sec.campos.map(campo => `
          <label style="display:flex; align-items:center; gap:8px; font-size:13px; margin-bottom:4px">
            <input type="checkbox" onchange="atualizarDadoRnc('${campo.id}', this.checked)"> ${escapeHtml(campo.label)}
          </label>
        `).join('')}
      </div>
    `;
  }
  if (sec.tipo === 'selecao_unica') {
    return `
      <div style="margin-bottom:14px">
        <p style="font-size:12px; font-weight:600; color:var(--text-sec); margin-bottom:6px">${escapeHtml(sec.titulo)}</p>
        ${sec.campos.map(campo => `
          <label style="display:flex; align-items:center; gap:8px; font-size:13px; margin-bottom:4px">
            <input type="radio" name="rnc-radio-${sec.id}" onchange="atualizarDadoRncSelecaoUnica('${sec.id}', '${campo.id}')"> ${escapeHtml(campo.label)}
          </label>
        `).join('')}
      </div>
    `;
  }
  // campos_diversos
  return `
    <div style="margin-bottom:14px">
      <p style="font-size:12px; font-weight:600; color:var(--text-sec); margin-bottom:6px">${escapeHtml(sec.titulo)}</p>
      <div class="form-row" style="grid-template-columns:repeat(${sec.campos.length}, 1fr)">
        ${sec.campos.map(campo => `
          <div class="form-group" style="margin:0">
            <label>${escapeHtml(campo.label)}</label>
            ${campo.tipo_campo === 'date'
              ? `<input type="date" onchange="atualizarDadoRnc('${campo.id}', this.value)">`
              : campo.tipo_campo === 'usuario_ref'
              ? `<select onchange="atualizarDadoRnc('${campo.id}', this.value)"><option value="">Selecione</option>${usuarios.map(u => `<option value="${u.id}">${escapeHtml(u.nome || u.email)}</option>`).join('')}</select>`
              : `<input type="text" onchange="atualizarDadoRnc('${campo.id}', this.value)">`}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function atualizarDadoRnc(campoId, valor) {
  _rncDadosEmPreenchimento[campoId] = valor;
}
function atualizarDadoRncSelecaoUnica(secaoId, campoId) {
  // zera as outras opções da mesma seção antes de marcar a escolhida
  _rncModeloEmUso.secoes.find(s => s.id === secaoId).campos.forEach(c => { delete _rncDadosEmPreenchimento[c.id]; });
  _rncDadosEmPreenchimento[campoId] = true;
}

async function salvarRncVinculado() {
  const ctx = _rncVinculoCtx;
  const modelo = _rncModeloEmUso;

  const responsavelCampo = modelo.secoes.flatMap(s => s.campos).find(c => c.tipo_campo === 'usuario_ref');
  const responsavelUserId = responsavelCampo ? (_rncDadosEmPreenchimento[responsavelCampo.id] || null) : null;

  const anoAtual = new Date().getFullYear();
  const { count: totalDoAno } = await supabaseClient
    .from('rncs')
    .select('id', { count: 'exact', head: true })
    .eq('empresa_id', currentUser.empresaId)
    .like('numero_sequencial', `RNC-${anoAtual}-%`);
  const numeroSequencial = `RNC-${anoAtual}-${String((totalDoAno || 0) + 1).padStart(4, '0')}`;

  const { data: rncSalvo, error } = await supabaseClient.from('rncs').insert({
    empresa_id: currentUser.empresaId,
    fornecedor_id: ctx.fornecedorId,
    numero_nf: ctx.numeroNf,
    numero_sequencial: numeroSequencial,
    modelo_id: modelo.id,
    conferencia_id: ctx.conferenciaId,
    criterio_conferencia_id: ctx.criterioId,
    dados: _rncDadosEmPreenchimento,
    responsavel_user_id: responsavelUserId,
    criado_por: currentUser.id,
  }).select().single();

  if (error) { toast('Erro ao salvar RNC: ' + error.message); return; }

  // Marca, dentro do array de respostas da conferência, qual resposta ficou
  // vinculada a esse RNC — assim o botão "Vincular RNC" vira "Ver RNC" sem
  // precisar de outra tabela de junção.
  const { data: confAtual, error: errBusca } = await supabaseClient
    .from('conferencias').select('respostas').eq('id', ctx.conferenciaId).single();
  if (!errBusca && confAtual) {
    const respostasAtualizadas = (confAtual.respostas || []).map(r =>
      r.criterioId === ctx.criterioId ? { ...r, rncId: rncSalvo.id, rncNumeroSequencial: numeroSequencial } : r
    );
    await supabaseClient.from('conferencias').update({ respostas: respostasAtualizadas }).eq('id', ctx.conferenciaId);
  }

  addLog('rnc_criado', `${currentUser.email} vinculou o RNC ${numeroSequencial} à NF ${ctx.numeroNf}`);
  closeModal();
  _rncVinculoCtx = null; _rncModeloEmUso = null; _rncDadosEmPreenchimento = {};
  await carregarConferencias();
  if (typeof rerenderListaConferencias === 'function') rerenderListaConferencias();
  if (typeof aplicarConferenciaVinculada === 'function' && document.getElementById('lp-nf')) aplicarConferenciaVinculada();
  toast(`RNC ${numeroSequencial} salvo e vinculado!`);
}

// ---------- Visualizar RNC já vinculado ----------
async function abrirVisualizarRnc(rncId) {
  const { data: rnc, error } = await supabaseClient.from('rncs').select('*').eq('id', rncId).single();
  if (error || !rnc) { toast('Não foi possível carregar o RNC.'); return; }

  const d = db();
  const modelo = (d.rncModelos || []).find(m => m.id === rnc.modelo_id);
  const usuarios = d.usuarios || [];

  openModal(`
    <h3>${modelo ? escapeHtml(modelo.nome) : 'RNC'} ${rnc.numero_sequencial ? '— ' + escapeHtml(rnc.numero_sequencial) : ''}</h3>
    <p style="font-size:12px; color:var(--text-muted); margin-bottom:10px">NF ${escapeHtml(rnc.numero_nf)} · ${new Date(rnc.criado_em).toLocaleDateString('pt-BR')}</p>
    ${!modelo ? '<p style="font-size:12px; color:var(--text-muted)">Modelo original foi excluído — mostrando dados salvos.</p>' : modelo.secoes.map(sec => `
      <div style="margin-bottom:12px">
        <p style="font-size:12px; font-weight:600; color:var(--text-sec); margin-bottom:4px">${escapeHtml(sec.titulo)}</p>
        ${sec.campos.filter(c => rnc.dados[c.id] !== undefined && rnc.dados[c.id] !== '' && rnc.dados[c.id] !== false).map(c => `
          <div style="font-size:13px; margin-bottom:2px">
            ${escapeHtml(c.label)}${sec.tipo === 'campos_diversos' ? ': ' + escapeHtml(c.tipo_campo === 'usuario_ref' ? ((usuarios.find(u => u.id === rnc.dados[c.id]) || {}).nome || '—') : String(rnc.dados[c.id])) : ''}
          </div>
        `).join('') || '<div style="font-size:12px; color:var(--text-muted)">Nada marcado nessa seção.</div>'}
      </div>
    `).join('')}
    <div style="display:flex; gap:8px; margin-top:6px">
      <button class="btn btn-primary btn-sm" onclick="gerarPDFRnc('${rnc.id}')">${ic('fileText', 13)} Baixar PDF</button>
      <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    </div>
  `);
}

// ---------- Gerar PDF do RNC (formato de formulário, pra imprimir) ----------
async function gerarPDFRnc(rncId) {
  const { data: rnc, error } = await supabaseClient.from('rncs').select('*').eq('id', rncId).single();
  if (error || !rnc) { toast('Não foi possível carregar o RNC.'); return; }

  const d = db();
  const modelo = (d.rncModelos || []).find(m => m.id === rnc.modelo_id);
  const usuarios = d.usuarios || [];
  const fornecedor = d.fornecedores.find(f => f.id === rnc.fornecedor_id);
  const responsavel = rnc.responsavel_user_id ? usuarios.find(u => u.id === rnc.responsavel_user_id) : null;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const margem = 14;
  const largura = 210 - margem * 2;
  let y = 16;

  // Cabeçalho: nome da empresa + título/código/revisão do modelo (igual a caixa de topo do formulário em papel)
  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.text(d.nomeEmpresa || 'Empresa', margem, y);
  y += 7;

  doc.setDrawColor(180);
  doc.rect(margem, y, largura, 16);
  doc.setFontSize(11);
  doc.text(modelo ? modelo.nome : 'Registro de Não Conformidade', margem + 3, y + 6);
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text(`Código: ${modelo && modelo.codigo ? modelo.codigo : '—'}`, margem + 3, y + 12);
  doc.text(`Revisão: ${modelo && modelo.revisao ? modelo.revisao : '—'}`, margem + largura / 2, y + 12);
  y += 22;

  // Dados de identificação (fornecedor, NF, data, número do RNC)
  doc.setFontSize(9);
  const linhaId = [
    ['Nº RNC', rnc.numero_sequencial || '—'],
    ['Fornecedor', fornecedor ? fornecedor.nome : '—'],
    ['Nota Fiscal', rnc.numero_nf || '—'],
    ['Data', new Date(rnc.criado_em).toLocaleDateString('pt-BR')],
  ];
  doc.autoTable({
    startY: y, body: [linhaId.map(l => l[1])], head: [linhaId.map(l => l[0])],
    styles: { fontSize: 8, cellPadding: 2.5 }, headStyles: { fillColor: [10, 25, 47] },
    margin: { left: margem, right: margem },
  });
  y = doc.lastAutoTable.finalY + 8;

  // Seções do modelo, com checkbox desenhado (□ / ■) igual ao formulário em papel
  const secoes = modelo ? modelo.secoes : [];
  secoes.forEach(sec => {
    if (y > 260) { doc.addPage(); y = 16; }

    doc.setFillColor(235, 238, 240);
    doc.rect(margem, y, largura, 6, 'F');
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text(sec.titulo, margem + 2, y + 4.3);
    doc.setFont(undefined, 'normal');
    y += 9;

    if (sec.tipo === 'campos_diversos') {
      sec.campos.forEach(campo => {
        const valorBruto = rnc.dados[campo.id];
        const valor = campo.tipo_campo === 'usuario_ref'
          ? ((usuarios.find(u => u.id === valorBruto) || {}).nome || '—')
          : (valorBruto || '—');
        doc.setFontSize(8.5);
        doc.text(`${campo.label}: ${valor}`, margem + 2, y);
        y += 5.5;
      });
    } else {
      // checkbox_grupo ou selecao_unica: desenha caixinha marcada/desmarcada em 2 colunas
      const colLargura = largura / 2;
      sec.campos.forEach((campo, i) => {
        const col = i % 2;
        if (col === 0 && i > 0) y += 6;
        const x = margem + col * colLargura;
        const marcado = !!rnc.dados[campo.id];
        doc.setDrawColor(80);
        doc.rect(x, y - 3, 3, 3);
        if (marcado) { doc.setFillColor(10, 25, 47); doc.rect(x + 0.5, y - 2.5, 2, 2, 'F'); }
        doc.setFontSize(8.5);
        doc.text(campo.label, x + 5, y - 0.3);
      });
      y += 8;
    }
    y += 3;
  });

  // Responsável (equivalente à assinatura do formulário em papel)
  if (y > 265) { doc.addPage(); y = 16; }
  doc.setDrawColor(180);
  doc.line(margem, y, margem + largura, y);
  y += 5;
  doc.setFontSize(8.5);
  doc.text(`Responsável: ${responsavel ? (responsavel.nome || responsavel.email) : '—'}`, margem, y);

  // Rodapé: marca do HomologPro (discreto, cinza claro) — o nome do cliente já
  // está no topo do documento, não precisa repetir aqui.
  doc.setFontSize(7.5);
  doc.setTextColor(160, 160, 160);
  doc.text('HomologPro | homologpro.com.br', margem + largura, 289, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  doc.save(`${rnc.numero_sequencial || 'rnc'}.pdf`);
  addLog('rnc_pdf_gerado', `${currentUser.email} gerou o PDF do RNC ${rnc.numero_sequencial || rnc.id}`);
}
