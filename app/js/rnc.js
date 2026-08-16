// ============ MÓDULO RNC (Registro de Não Conformidade) ============
// Cada empresa monta o próprio modelo de RNC (seções + campos) — nasce vazio,
// sem nenhum modelo pré-cadastrado. O RNC não tem lógica de desconto própria:
// desconto continua 100% nos critérios da Conferência; o RNC só documenta e
// pode ser vinculado a um critério que já descontou (ver conferencia.js).

let _novaSecaoRncAberta = false;
let _secoesRncEmConstrucao = []; // seções do modelo sendo montado na tela "Novo modelo"
let _construtorModeloContexto = 'tab'; // 'tab' (aba Modelos de RNC) ou 'modal' (editando a partir do Ver RNC)
let _modeloRncEditandoId = null; // id do modelo em edição, ou null se estiver criando um novo
let _modeloRncEditandoInfo = null; // { nome, codigo, revisao } pra pré-preencher o formulário na edição

const TIPOS_SECAO_RNC = [
  { valor: 'checkbox_grupo', label: 'Marcar várias opções (grupo de checkbox)' },
  { valor: 'selecao_unica', label: 'Marcar uma única opção' },
  { valor: 'campos_diversos', label: 'Campos de texto/data/responsável' },
];

// Se o campo (de uma seção "campos_diversos") não tiver rótulo próprio, fica
// sem rótulo mesmo — só o valor aparece. Ele continua funcionando normalmente
// (mantém o tipo texto/data/responsável), só não mostra nome descritivo.
function rotuloCampoRnc(sec, campo) {
  return campo.label || '';
}

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
              <td><div class="actions">
                <button class="btn btn-secondary btn-sm" onclick="abrirEditarModeloRnc('${m.id}')">Editar</button>
                <button class="btn btn-danger btn-sm" onclick="excluirRncModelo('${m.id}')">Excluir</button>
              </div></td>
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
  _construtorModeloContexto = 'tab';
  _modeloRncEditandoId = null;
  _modeloRncEditandoInfo = null;
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
  const prefill = _modeloRncEditandoInfo || {};
  return `
    ${_construtorModeloContexto === 'modal' ? `<h3 style="margin-bottom:10px">Editar modelo de RNC</h3>` : ''}
    <div style="background:#fff; color:#1a1a1a; border:1px solid var(--border-strong, #ccc); border-radius:4px; padding:20px; font-family:inherit">

      <div style="font-size:13px; color:#999; font-style:italic; margin-bottom:10px">Nome da empresa (preenchido automaticamente)</div>

      <div style="border:1px solid #999; border-radius:2px; padding:8px 10px; margin-bottom:16px">
        <input type="text" id="rnc-modelo-nome" value="${escapeHtml(prefill.nome || '')}" placeholder="Nome que identifica esse formulário"
          oninput="atualizarInfoModeloConstrucao('nome', this.value)"
          style="border:none; outline:none; font-size:14px; font-weight:600; width:100%; padding:2px 0; background:transparent">
        <div style="display:flex; gap:16px; margin-top:4px">
          <input type="text" id="rnc-modelo-codigo" value="${escapeHtml(prefill.codigo || '')}" placeholder="Código (opcional)"
            oninput="atualizarInfoModeloConstrucao('codigo', this.value)"
            style="border:none; outline:none; font-size:11px; color:#666; width:150px; background:transparent">
          <input type="text" id="rnc-modelo-revisao" value="${escapeHtml(prefill.revisao || '')}" placeholder="Revisão (opcional)"
            oninput="atualizarInfoModeloConstrucao('revisao', this.value)"
            style="border:none; outline:none; font-size:11px; color:#666; width:150px; background:transparent">
        </div>
      </div>

      <table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:16px; opacity:.55">
        <tr style="background:#0A192F; color:#fff"><td style="padding:5px 6px">Nº RNC</td><td style="padding:5px 6px">Fornecedor</td><td style="padding:5px 6px">Nota fiscal</td><td style="padding:5px 6px">Data</td></tr>
        <tr><td style="padding:5px 6px; border:1px solid #ddd" colspan="4">preenchido automaticamente ao vincular</td></tr>
      </table>

      <div id="rnc-secoes-lista">
        ${_secoesRncEmConstrucao.map((sec, i) => renderSecaoRncHtml(sec, i)).join('')}
      </div>
      <button type="button" onclick="addSecaoRncConstrucao()"
        style="width:100%; border:1px dashed #bbb; background:transparent; color:#888; font-size:12px; padding:8px; border-radius:2px; cursor:pointer; margin-top:4px">+ Adicionar seção</button>
    </div>

    <label style="display:flex; align-items:center; gap:8px; font-size:12.5px; margin-top:12px; cursor:pointer">
      <input type="checkbox" id="rnc-modelo-exigir-confirmacao" ${(prefill.exigirConfirmacao) ? 'checked' : ''}>
      Exigir confirmação por e-mail do responsável (manda um link pra pessoa confirmar que foi ela)
    </label>

    <div style="margin-top:14px; display:flex; gap:8px">
      <button class="btn btn-primary" onclick="salvarModeloRnc()">Salvar modelo</button>
      ${_construtorModeloContexto === 'modal' ? `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>` : ''}
    </div>
  `;
}

function atualizarInfoModeloConstrucao(campo, valor) {
  if (!_modeloRncEditandoInfo) _modeloRncEditandoInfo = {};
  _modeloRncEditandoInfo[campo] = valor;
  // não re-renderiza — só guarda o valor, pra não perder o foco/cursor do input
}

function renderSecaoRncHtml(sec, i) {
  return `
    <div style="margin-bottom:14px" data-secao-index="${i}">
      <div style="background:#ebeef0; padding:5px 8px; border-radius:2px; margin-bottom:8px; display:flex; align-items:center; gap:8px">
        <input type="text" value="${escapeHtml(sec.titulo || '')}" placeholder="O que essa parte do formulário descreve"
          oninput="atualizarSecaoRncConstrucaoSemRender(${i}, 'titulo', this.value)"
          style="flex:1; border:none; outline:none; background:transparent; font-size:12px; font-weight:600; color:#1a1a1a">
        <select onchange="atualizarSecaoRncConstrucao(${i}, 'tipo', this.value)"
          style="font-size:10.5px; color:#666; border:1px solid #ccc; border-radius:2px; background:#fff; padding:1px 4px">
          <option value="" ${!sec.tipo ? 'selected' : ''} disabled>Formato...</option>
          ${TIPOS_SECAO_RNC.map(t => `<option value="${t.valor}" ${sec.tipo === t.valor ? 'selected' : ''}>${t.label}</option>`).join('')}
        </select>
        <button type="button" onclick="moverSecaoRncConstrucao(${i}, -1)" title="Mover para cima" ${i === 0 ? 'disabled' : ''}
          style="border:none; background:transparent; color:${i === 0 ? '#ccc' : '#666'}; cursor:${i === 0 ? 'default' : 'pointer'}; font-size:12px; line-height:1; padding:0 2px">▲</button>
        <button type="button" onclick="moverSecaoRncConstrucao(${i}, 1)" title="Mover para baixo" ${i === _secoesRncEmConstrucao.length - 1 ? 'disabled' : ''}
          style="border:none; background:transparent; color:${i === _secoesRncEmConstrucao.length - 1 ? '#ccc' : '#666'}; cursor:${i === _secoesRncEmConstrucao.length - 1 ? 'default' : 'pointer'}; font-size:12px; line-height:1; padding:0 2px">▼</button>
        <button type="button" onclick="removerSecaoRncConstrucao(${i})" title="Excluir seção"
          style="border:none; background:transparent; color:#c0392b; cursor:pointer; font-size:14px; line-height:1; padding:0 2px">×</button>
      </div>

      ${!sec.tipo ? '<p style="font-size:11px; color:#aaa; padding:0 4px">Escolha o formato da seção pra começar a preencher as opções.</p>' : `
        <div style="padding:0 4px">
          ${(sec.campos || []).map((campo, j) => renderCampoRncHtml(sec, i, campo, j)).join('')}
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px">
            ${sec.tipo === 'campos_diversos' ? '' : `<span style="display:inline-block; width:11px; height:11px; border:1px solid #bbb; flex-shrink:0"></span>`}
            <input type="text" placeholder="+ nova opção" onkeyup="if(event.key==='Enter') onNovaOpcaoRncConfirmar(this, ${i})" onblur="onNovaOpcaoRncConfirmar(this, ${i})"
              style="border:none; border-bottom:1px dashed #ccc; outline:none; background:transparent; font-size:12.5px; color:#888; flex:1; padding:2px 0">
          </div>
        </div>
      `}
    </div>
  `;
}

function renderCampoRncHtml(sec, secIndex, campo, campoIndex) {
  const precisaTipoValor = sec.tipo === 'campos_diversos';
  return `
    <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px">
      ${precisaTipoValor ? '' : `<span style="display:inline-block; width:11px; height:11px; border:1px solid #555; flex-shrink:0"></span>`}
      <input type="text" value="${escapeHtml(campo.label || '')}" placeholder="${precisaTipoValor ? 'Rótulo (opcional — pode deixar em branco)' : 'Como essa opção aparece no formulário'}"
        oninput="atualizarCampoRncConstrucaoSemRender(${secIndex}, ${campoIndex}, 'label', this.value)"
        style="flex:1; border:none; outline:none; background:transparent; font-size:12.5px; color:#1a1a1a; border-bottom:1px solid transparent" onfocus="this.style.borderBottomColor='#ccc'" onblur="this.style.borderBottomColor='transparent'">
      ${precisaTipoValor ? `
        <select onchange="atualizarCampoRncConstrucao(${secIndex}, ${campoIndex}, 'tipo_campo', this.value)"
          style="font-size:10.5px; color:#666; border:1px solid #ccc; border-radius:2px; background:#fff; padding:1px 4px">
          <option value="texto" ${campo.tipo_campo === 'texto' ? 'selected' : ''}>Texto</option>
          <option value="date" ${campo.tipo_campo === 'date' ? 'selected' : ''}>Data</option>
          <option value="usuario_ref" ${campo.tipo_campo === 'usuario_ref' ? 'selected' : ''}>Responsável</option>
        </select>` : ''}
      <button type="button" onclick="removerCampoRncConstrucao(${secIndex}, ${campoIndex})" title="Remover"
        style="border:none; background:transparent; color:#c0392b; cursor:pointer; font-size:13px; line-height:1; padding:0 2px">×</button>
    </div>
  `;
}

// Confirma a nova opção ao apertar Enter ou ao sair do campo (blur) — cria o
// campo de verdade e a linha "+ nova opção" reaparece em branco embaixo,
// pronta pra continuar digitando, igual escrever direto na folha.
function onNovaOpcaoRncConfirmar(inputEl, secIndex) {
  const valor = inputEl.value.trim();
  if (!valor) return;
  inputEl.value = ''; // evita duplicar caso o blur dispare de novo durante a re-renderização
  const sec = _secoesRncEmConstrucao[secIndex];
  const tipoDefault = sec.tipo === 'campos_diversos' ? 'texto' : undefined;
  sec.campos.push({ id: gerarIdCampoRnc(), label: valor, tipo_campo: tipoDefault });
  rerenderConstrutorModeloRnc();
  setTimeout(() => {
    const secaoEl = document.querySelectorAll('[data-secao-index]')[secIndex];
    const novoInput = secaoEl && secaoEl.querySelector('input[placeholder="+ nova opção"]');
    if (novoInput) novoInput.focus();
  }, 0);
}

function rerenderConstrutorModeloRnc() {
  if (_construtorModeloContexto === 'modal') openModal(renderConstrutorModeloRncHtml());
  else renderRncModelosTab();
}

function addSecaoRncConstrucao() {
  _secoesRncEmConstrucao.push({ id: gerarIdSecaoRnc(), titulo: '', tipo: '', campos: [] });
  rerenderConstrutorModeloRnc();
}
function removerSecaoRncConstrucao(i) {
  _secoesRncEmConstrucao.splice(i, 1);
  rerenderConstrutorModeloRnc();
}
function moverSecaoRncConstrucao(i, direcao) {
  const novoIndex = i + direcao;
  if (novoIndex < 0 || novoIndex >= _secoesRncEmConstrucao.length) return;
  const [sec] = _secoesRncEmConstrucao.splice(i, 1);
  _secoesRncEmConstrucao.splice(novoIndex, 0, sec);
  rerenderConstrutorModeloRnc();
}
function atualizarSecaoRncConstrucao(i, campo, valor) {
  _secoesRncEmConstrucao[i][campo] = valor;
  if (campo === 'tipo') {
    // "Campos de texto/data/responsável" já nasce com 1 campo pronto — o
    // rótulo pode ficar em branco (aí usa o título da seção na hora de
    // mostrar), assim não precisa digitar o mesmo nome duas vezes.
    if (valor === 'campos_diversos' && !_secoesRncEmConstrucao[i].campos.length) {
      _secoesRncEmConstrucao[i].campos.push({ id: gerarIdCampoRnc(), label: '', tipo_campo: 'texto' });
    }
    rerenderConstrutorModeloRnc(); // muda os campos disponíveis (ex: tipo_campo só existe em campos_diversos)
  }
}
// Versão usada no "oninput" do título da seção — não re-renderiza a cada
// tecla, só guarda o valor, senão o input perde o foco a cada letra digitada.
function atualizarSecaoRncConstrucaoSemRender(i, campo, valor) {
  _secoesRncEmConstrucao[i][campo] = valor;
}
function addCampoRncConstrucao(secIndex) {
  const tipoDefault = _secoesRncEmConstrucao[secIndex].tipo === 'campos_diversos' ? 'texto' : undefined;
  _secoesRncEmConstrucao[secIndex].campos.push({ id: gerarIdCampoRnc(), label: '', tipo_campo: tipoDefault });
  rerenderConstrutorModeloRnc();
}
function removerCampoRncConstrucao(secIndex, campoIndex) {
  _secoesRncEmConstrucao[secIndex].campos.splice(campoIndex, 1);
  rerenderConstrutorModeloRnc();
}
function atualizarCampoRncConstrucao(secIndex, campoIndex, chave, valor) {
  _secoesRncEmConstrucao[secIndex].campos[campoIndex][chave] = valor;
}
// Mesma ideia: usada no "oninput" do rótulo de um campo já existente, sem re-renderizar.
function atualizarCampoRncConstrucaoSemRender(secIndex, campoIndex, chave, valor) {
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

  const exigirConfirmacao = document.getElementById('rnc-modelo-exigir-confirmacao').checked;

  if (_modeloRncEditandoId) {
    const { error } = await supabaseClient.from('rnc_modelos').update({
      nome, codigo: codigo || null, revisao: revisao || null, secoes: _secoesRncEmConstrucao,
      exigir_confirmacao_responsavel: exigirConfirmacao,
    }).eq('id', _modeloRncEditandoId);
    if (error) { toast('Erro ao salvar modelo: ' + error.message); return; }
    addLog('rnc_modelo_editado', `${currentUser.email} editou o modelo de RNC "${nome}"`);
  } else {
    const { error } = await supabaseClient.from('rnc_modelos').insert({
      empresa_id: currentUser.empresaId,
      nome, codigo: codigo || null, revisao: revisao || null,
      secoes: _secoesRncEmConstrucao, ativo: true,
      exigir_confirmacao_responsavel: exigirConfirmacao,
    });
    if (error) { toast('Erro ao salvar modelo: ' + error.message); return; }
    addLog('rnc_modelo_criado', `${currentUser.email} criou o modelo de RNC "${nome}"`);
  }

  const eraModal = _construtorModeloContexto === 'modal';
  _secoesRncEmConstrucao = [];
  _novaSecaoRncAberta = false;
  _modeloRncEditandoId = null;
  _modeloRncEditandoInfo = null;
  _construtorModeloContexto = 'tab';
  await carregarRncModelos();
  if (eraModal) closeModal(); else renderRncModelosTab();
  toast('Modelo de RNC salvo!');
}

function abrirEditarModeloRnc(modeloId) {
  const d = db();
  const modelo = (d.rncModelos || []).find(m => m.id === modeloId);
  if (!modelo) { toast('Modelo não encontrado.'); return; }
  _construtorModeloContexto = 'modal';
  _modeloRncEditandoId = modelo.id;
  _modeloRncEditandoInfo = { nome: modelo.nome, codigo: modelo.codigo, revisao: modelo.revisao, exigirConfirmacao: modelo.exigir_confirmacao_responsavel };
  _secoesRncEmConstrucao = JSON.parse(JSON.stringify(modelo.secoes || []));
  openModal(renderConstrutorModeloRncHtml());
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
let _rncEditandoId = null; // se estiver editando as respostas de um RNC já salvo, o id dele; senão null

// RNCs preenchidos durante o lançamento de uma nova conferência, antes dela
// existir no banco — ficam em memória (chave = criterioId) até o clique em
// "Salvar conferência", que grava a conferência primeiro e os RNCs depois,
// já linkados ao conferencia_id recém-criado.
let _rncsPendentesLancamento = {};

function abrirVincularRnc(conferenciaId, criterioId, fornecedorId, numeroNf) {
  const d = db();
  const modelosAtivos = (d.rncModelos || []).filter(m => m.ativo);
  if (!modelosAtivos.length) {
    toast('Nenhum modelo de RNC configurado ainda. Crie um na aba "Modelos de RNC".');
    return;
  }
  _rncEditandoId = null;
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

// Preenche o RNC de um critério ANTES de a conferência existir de verdade —
// fica guardado em _rncsPendentesLancamento até o clique de "Salvar conferência".
function abrirPreencherRncPendente(criterioId) {
  const d = db();
  const modelosAtivos = (d.rncModelos || []).filter(m => m.ativo);
  if (!modelosAtivos.length) {
    toast('Nenhum modelo de RNC configurado ainda. Crie um na aba "Modelos de RNC".');
    return;
  }
  _rncEditandoId = null;
  _rncVinculoCtx = { pendente: true, criterioId };
  const jaPreenchido = _rncsPendentesLancamento[criterioId];
  _rncDadosEmPreenchimento = jaPreenchido ? { ...jaPreenchido.dados } : {};

  if (modelosAtivos.length === 1) {
    _rncModeloEmUso = modelosAtivos[0];
    openModal(renderFormularioRncHtml());
    return;
  }

  const modeloPreSelecionado = jaPreenchido ? jaPreenchido.modeloId : null;
  openModal(`
    <h3>Preencher RNC</h3>
    <p style="font-size:12px; color:var(--text-muted); margin-bottom:10px">Escolha o modelo de formulário a preencher.</p>
    <div class="form-group">
      <select id="rnc-escolher-modelo">
        ${modelosAtivos.map(m => `<option value="${m.id}" ${modeloPreSelecionado === m.id ? 'selected' : ''}>${escapeHtml(m.nome)}</option>`).join('')}
      </select>
    </div>
    <button class="btn btn-primary" onclick="selecionarModeloRncEContinuar()">Continuar</button>
  `);
}

// Lista os critérios de faixa fora do range no formulário de lançamento atual
// que ainda não têm RNC preenchido — lê os valores direto dos inputs em tela,
// já que a conferência ainda não foi salva.
function getCriteriosForaDaFaixaPendentesDeRnc() {
  const d = db();
  const pendentes = [];
  (d.criteriosConferencia || []).filter(c => c.ativo && c.tipo === 'faixa').forEach(c => {
    const min = parseFloat(document.querySelector(`.cf-faixa-min[data-criterio-id="${c.id}"]`)?.value);
    const max = parseFloat(document.querySelector(`.cf-faixa-max[data-criterio-id="${c.id}"]`)?.value);
    const recebida = parseFloat(document.querySelector(`.cf-faixa-recebida[data-criterio-id="${c.id}"]`)?.value);
    if (isNaN(min) || isNaN(max) || isNaN(recebida)) return;
    const dentro = recebida >= min && recebida <= max;
    if (!dentro && !_rncsPendentesLancamento[c.id]) pendentes.push(c.id);
  });
  return pendentes;
}

function abrirProximoRncPendente() {
  const pendentes = getCriteriosForaDaFaixaPendentesDeRnc();
  if (pendentes.length) abrirPreencherRncPendente(pendentes[0]);
}

// Container com "Preencher RNC" (se faltar algum) + "Salvar conferência"
// (desabilitado enquanto faltar) — vive no lugar onde só tinha o botão salvar.
function renderBotoesSalvarConferencia() {
  const wrap = document.getElementById('cf-botoes-salvar');
  if (!wrap) return;
  const pendentes = getCriteriosForaDaFaixaPendentesDeRnc();
  wrap.innerHTML = `
    <div style="display:flex; gap:8px; align-items:center">
      ${pendentes.length ? `<button type="button" class="btn btn-secondary" onclick="abrirProximoRncPendente()">Preencher RNC${pendentes.length > 1 ? ` (${pendentes.length})` : ''}</button>` : ''}
      <button class="btn btn-primary" onclick="salvarConferencia()" ${pendentes.length ? 'disabled title="Preencha o RNC das não conformidades antes de salvar"' : ''}>Salvar conferência</button>
    </div>
  `;
}

// Indicador visual (abaixo do RPNC) mostrando que o RNC daquele critério já
// foi preenchido em memória, com opção de reabrir e editar antes de salvar.
function atualizarIndicadorRncPendente(criterioId) {
  const el = document.getElementById(`cf-faixa-rnc-indicador-${criterioId}`);
  if (!el) return;
  const pendente = _rncsPendentesLancamento[criterioId];
  el.innerHTML = pendente
    ? `<div style="margin-top:6px; font-size:12px; color:var(--success); display:flex; align-items:center; gap:5px; cursor:pointer" onclick="abrirPreencherRncPendente('${criterioId}')">${ic('check', 13)} RNC preenchido — clique pra editar</div>`
    : '';
}

function renderFormularioRncHtml() {
  const modelo = _rncModeloEmUso;
  const d = db();
  const usuarios = d.usuarios || [];
  return `
    <h3>${_rncEditandoId ? 'Editar respostas — ' : ''}${escapeHtml(modelo.nome)}</h3>
    ${modelo.codigo || modelo.revisao ? `<p style="font-size:12px; color:var(--text-muted); margin-bottom:10px">${modelo.codigo ? escapeHtml(modelo.codigo) : ''}${modelo.codigo && modelo.revisao ? ' · ' : ''}${modelo.revisao ? 'Revisão ' + escapeHtml(modelo.revisao) : ''}</p>` : ''}
    <div id="rnc-form-secoes">
      ${modelo.secoes.map(sec => renderSecaoPreenchimentoHtml(sec, usuarios)).join('')}
    </div>
    <div style="display:flex; gap:8px; margin-top:14px">
      <button class="btn btn-primary" onclick="salvarRncVinculado()">${_rncEditandoId ? 'Salvar alterações' : 'Salvar RNC'}</button>
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
            <input type="checkbox" ${_rncDadosEmPreenchimento[campo.id] ? 'checked' : ''} onchange="atualizarDadoRnc('${campo.id}', this.checked)"> ${escapeHtml(campo.label)}
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
            <input type="radio" name="rnc-radio-${sec.id}" ${_rncDadosEmPreenchimento[campo.id] ? 'checked' : ''} onchange="atualizarDadoRncSelecaoUnica('${sec.id}', '${campo.id}')"> ${escapeHtml(campo.label)}
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
        ${sec.campos.map(campo => {
          const valorAtual = _rncDadosEmPreenchimento[campo.id];
          if (campo.tipo_campo === 'date') {
            return `<div class="form-group" style="margin:0"><label>${escapeHtml(rotuloCampoRnc(sec, campo))}</label><input type="date" value="${valorAtual || ''}" onchange="atualizarDadoRnc('${campo.id}', this.value)"></div>`;
          }
          if (campo.tipo_campo === 'usuario_ref') {
            return `<div class="form-group" style="margin:0"><label>${escapeHtml(rotuloCampoRnc(sec, campo))}</label><select onchange="atualizarDadoRnc('${campo.id}', this.value)"><option value="">Selecione</option>${usuarios.map(u => `<option value="${u.id}" ${valorAtual === u.id ? 'selected' : ''}>${escapeHtml(u.nome || u.email)}</option>`).join('')}</select></div>`;
          }
          return `<div class="form-group" style="margin:0"><label>${escapeHtml(rotuloCampoRnc(sec, campo))}</label><input type="text" value="${escapeHtml(valorAtual || '')}" onchange="atualizarDadoRnc('${campo.id}', this.value)"></div>`;
        }).join('')}
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

// Se o modelo desse RNC exige confirmação do responsável, gera um token
// único, grava e chama a Edge Function que manda o e-mail. Silencioso em
// caso de erro — não trava o fluxo principal de salvar o RNC por causa disso.
async function dispararConfirmacaoRncSeNecessario(rncSalvo, modelo) {
  if (!modelo || !modelo.exigir_confirmacao_responsavel || !rncSalvo.responsavel_user_id) return;
  const token = crypto.randomUUID();
  const { error } = await supabaseClient.from('rncs').update({
    confirmacao_token: token,
    confirmacao_enviada_em: new Date().toISOString(),
  }).eq('id', rncSalvo.id);
  if (error) { console.error('Erro ao gerar token de confirmação do RNC:', error.message); return; }
  supabaseClient.functions.invoke('enviar-confirmacao-rnc', { body: { rncId: rncSalvo.id } }).catch(() => {});
}

async function salvarRncVinculado() {
  const ctx = _rncVinculoCtx;
  const modelo = _rncModeloEmUso;

  const responsavelCampo = modelo.secoes.flatMap(s => s.campos).find(c => c.tipo_campo === 'usuario_ref');
  const responsavelUserId = responsavelCampo ? (_rncDadosEmPreenchimento[responsavelCampo.id] || null) : null;

  if (ctx && ctx.pendente) {
    _rncsPendentesLancamento[ctx.criterioId] = {
      modeloId: modelo.id,
      dados: { ..._rncDadosEmPreenchimento },
      responsavelUserId,
    };
    closeModal();
    _rncVinculoCtx = null; _rncModeloEmUso = null; _rncDadosEmPreenchimento = {};
    if (typeof atualizarIndicadorRncPendente === 'function') atualizarIndicadorRncPendente(ctx.criterioId);
    if (typeof renderBotoesSalvarConferencia === 'function') renderBotoesSalvarConferencia();
    toast('RNC preenchido — falta salvar a conferência pra confirmar.');
    return;
  }

  if (_rncEditandoId) {
    const { error } = await supabaseClient.from('rncs').update({
      dados: _rncDadosEmPreenchimento,
      responsavel_user_id: responsavelUserId,
    }).eq('id', _rncEditandoId);
    if (error) { toast('Erro ao salvar RNC: ' + error.message); return; }

    addLog('rnc_editado', `${currentUser.email} editou as respostas do RNC ${_rncEditandoId}`);
    closeModal();
    _rncEditandoId = null; _rncVinculoCtx = null; _rncModeloEmUso = null; _rncDadosEmPreenchimento = {};
    if (typeof rerenderListaConferencias === 'function') rerenderListaConferencias();
    if (typeof aplicarConferenciaVinculada === 'function' && document.getElementById('lp-nf')) aplicarConferenciaVinculada();
    toast('RNC atualizado!');
    return;
  }

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
  await dispararConfirmacaoRncSeNecessario(rncSalvo, modelo);
  closeModal();
  _rncVinculoCtx = null; _rncModeloEmUso = null; _rncDadosEmPreenchimento = {};
  await carregarConferencias();
  if (typeof rerenderListaConferencias === 'function') rerenderListaConferencias();
  if (typeof aplicarConferenciaVinculada === 'function' && document.getElementById('lp-nf')) aplicarConferenciaVinculada();
  toast(`RNC ${numeroSequencial} salvo e vinculado!`);
}

// Chamada por salvarConferencia() (conferencia.js) logo depois de a
// conferência ser inserida de verdade no banco — grava cada RNC que ficou em
// memória durante o lançamento, já linkado ao conferencia_id recém-criado.
// Se a pessoa tiver digitado algo no campo RPNC daquele critério, esse texto
// vira o número do RNC; senão, gera o automático (RNC-{ano}-{sequência}).
async function salvarRncsPendentesAoLancarConferencia(conferencia, fornecedorId, numeroNf) {
  const anoAtual = new Date().getFullYear();
  for (const [criterioId, pendente] of Object.entries(_rncsPendentesLancamento)) {
    const rpncInp = document.querySelector(`.cf-faixa-rpnc[data-criterio-id="${criterioId}"]`);
    const rpncDigitado = rpncInp ? rpncInp.value.trim() : '';

    let numeroSequencial = rpncDigitado;
    if (!numeroSequencial) {
      const { count } = await supabaseClient.from('rncs')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', currentUser.empresaId)
        .like('numero_sequencial', `RNC-${anoAtual}-%`);
      numeroSequencial = `RNC-${anoAtual}-${String((count || 0) + 1).padStart(4, '0')}`;
    }

    const { data: rncSalvo, error } = await supabaseClient.from('rncs').insert({
      empresa_id: currentUser.empresaId,
      fornecedor_id: fornecedorId,
      numero_nf: numeroNf,
      numero_sequencial: numeroSequencial,
      modelo_id: pendente.modeloId,
      conferencia_id: conferencia.id,
      criterio_conferencia_id: criterioId,
      dados: pendente.dados,
      responsavel_user_id: pendente.responsavelUserId,
      criado_por: currentUser.id,
    }).select().single();

    if (error) { toast('Erro ao salvar RNC vinculado: ' + error.message); continue; }
    addLog('rnc_criado', `${currentUser.email} vinculou o RNC ${numeroSequencial} à NF ${numeroNf}`);
    const modeloDesseRnc = (db().rncModelos || []).find(m => m.id === pendente.modeloId);
    await dispararConfirmacaoRncSeNecessario(rncSalvo, modeloDesseRnc);

    // Marca, dentro do array de respostas da conferência, qual resposta ficou
    // vinculada a esse RNC — re-busca porque, com mais de um RNC pendente,
    // cada volta desse loop precisa enxergar o patch da volta anterior.
    const { data: confAtual } = await supabaseClient.from('conferencias').select('respostas').eq('id', conferencia.id).single();
    if (confAtual) {
      const respostasAtualizadas = (confAtual.respostas || []).map(r =>
        r.criterioId === criterioId ? { ...r, rncId: rncSalvo.id, rncNumeroSequencial: numeroSequencial } : r
      );
      await supabaseClient.from('conferencias').update({ respostas: respostasAtualizadas }).eq('id', conferencia.id);
    }
  }
  _rncsPendentesLancamento = {};
}

function abrirEditarRespostasRnc(rncId) {
  supabaseClient.from('rncs').select('*').eq('id', rncId).single().then(({ data: rnc, error }) => {
    if (error || !rnc) { toast('Não foi possível carregar o RNC.'); return; }
    const d = db();
    const modelo = (d.rncModelos || []).find(m => m.id === rnc.modelo_id);
    if (!modelo) { toast('O modelo original desse RNC foi excluído — não é possível editar as respostas sem ele.'); return; }
    _rncEditandoId = rnc.id;
    _rncVinculoCtx = { conferenciaId: rnc.conferencia_id, criterioId: rnc.criterio_conferencia_id, fornecedorId: rnc.fornecedor_id, numeroNf: rnc.numero_nf };
    _rncModeloEmUso = modelo;
    _rncDadosEmPreenchimento = { ...rnc.dados };
    openModal(renderFormularioRncHtml());
  });
}

// ---------- Visualizar RNC já vinculado ----------
async function abrirVisualizarRnc(rncId) {
  const { data: rnc, error } = await supabaseClient.from('rncs').select('*').eq('id', rncId).single();
  if (error || !rnc) { toast('Não foi possível carregar o RNC.'); return; }

  const d = db();
  const modelo = (d.rncModelos || []).find(m => m.id === rnc.modelo_id);
  const usuarios = d.usuarios || [];
  const fornecedor = (d.fornecedores || []).find(f => f.id === rnc.fornecedor_id);

  const checkboxSvg = (marcado) => `<span style="display:inline-block; width:11px; height:11px; border:1px solid #555; background:${marcado ? '#0A192F' : 'transparent'}; flex-shrink:0"></span>`;

  const corpoSecoes = !modelo
    ? '<p style="font-size:12px; color:var(--text-muted)">Modelo original foi excluído — mostrando dados salvos, sem o layout original.</p>'
    : modelo.secoes.map(sec => `
      <div style="margin-bottom:20px">
        <div style="background:#ebeef0; padding:4px 8px; font-size:12px; font-weight:600; color:#1a1a1a; border-radius:2px; margin-bottom:8px">${escapeHtml(sec.titulo)}</div>
        ${sec.tipo === 'campos_diversos'
          ? `<div style="display:grid; grid-template-columns:repeat(${sec.campos.length}, 1fr); gap:8px">
              ${sec.campos.map(c => {
                const valor = c.tipo_campo === 'usuario_ref'
                  ? ((usuarios.find(u => u.id === rnc.dados[c.id]) || {}).nome || '—')
                  : (rnc.dados[c.id] || '—');
                const selo = (c.tipo_campo === 'usuario_ref' && rnc.confirmacao_token)
                  ? (rnc.confirmacao_confirmada_em
                      ? `<div style="font-size:10.5px; color:var(--success); margin-top:2px; display:flex; align-items:center; gap:4px">${ic('check', 11)}Confirmado em ${new Date(rnc.confirmacao_confirmada_em).toLocaleString('pt-BR')}</div>`
                      : `<div style="font-size:10.5px; color:var(--warning, #b45309); margin-top:2px; display:flex; align-items:center; gap:4px">${ic('clock', 11)}Aguardando confirmação</div>`)
                  : '';
                return `<div><div style="font-size:10px; color:var(--text-muted)">${escapeHtml(rotuloCampoRnc(sec, c))}</div><div style="font-size:13px">${escapeHtml(String(valor))}</div>${selo}</div>`;
              }).join('')}
            </div>`
          : `<div style="display:grid; grid-template-columns:1fr 1fr; gap:6px 12px">
              ${sec.campos.map(c => `
                <label style="display:flex; align-items:center; gap:6px; font-size:12.5px">${checkboxSvg(!!rnc.dados[c.id])}${escapeHtml(c.label)}</label>
              `).join('')}
            </div>`}
      </div>
    `).join('');

  openModal(`
    <div style="font-size:14px; font-weight:500; margin-bottom:10px">${d.nomeEmpresa || 'Empresa'}</div>
    <div style="border:1px solid #999; border-radius:2px; padding:8px 10px; margin-bottom:14px">
      <div style="font-size:13px; font-weight:600">${modelo ? escapeHtml(modelo.nome) : 'Registro de não conformidade'}</div>
      ${modelo && (modelo.codigo || modelo.revisao) ? `<div style="display:flex; gap:18px; font-size:11px; color:#666; margin-top:4px">${modelo.codigo ? `<span>Código: ${escapeHtml(modelo.codigo)}</span>` : ''}${modelo.revisao ? `<span>Revisão: ${escapeHtml(modelo.revisao)}</span>` : ''}</div>` : ''}
    </div>

    <table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:16px">
      <tr style="background:#0A192F; color:#fff">
        <td style="padding:5px 6px">Nº RNC</td><td style="padding:5px 6px">Fornecedor</td><td style="padding:5px 6px">Nota fiscal</td><td style="padding:5px 6px">Data</td>
      </tr>
      <tr>
        <td style="padding:5px 6px; border:1px solid #ddd">${escapeHtml(rnc.numero_sequencial || '—')}</td>
        <td style="padding:5px 6px; border:1px solid #ddd">${fornecedor ? escapeHtml(fornecedor.nome) : '—'}</td>
        <td style="padding:5px 6px; border:1px solid #ddd">${escapeHtml(rnc.numero_nf)}</td>
        <td style="padding:5px 6px; border:1px solid #ddd">${new Date(rnc.criado_em).toLocaleDateString('pt-BR')}</td>
      </tr>
    </table>

    ${corpoSecoes}

    <div style="display:flex; gap:8px; margin-top:14px; flex-wrap:wrap">
      <button class="btn btn-primary btn-sm" onclick="gerarPDFRnc('${rnc.id}')">${ic('fileText', 13)} Baixar PDF</button>
      ${modelo ? `<button class="btn btn-secondary btn-sm" onclick="abrirEditarRespostasRnc('${rnc.id}')">Editar respostas</button>` : ''}
      ${modelo ? `<button class="btn btn-secondary btn-sm" onclick="abrirEditarModeloRnc('${modelo.id}')">Editar modelo</button>` : ''}
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
    y += 11;

    if (sec.tipo === 'campos_diversos') {
      const colLarguraCd = largura / 2;
      let precisaLinhaExtra = false;
      sec.campos.forEach((campo, i) => {
        const col = i % 2;
        if (col === 0 && i > 0) y += 5.5;
        const x = margem + col * colLarguraCd;
        const valorBruto = rnc.dados[campo.id];
        const valor = campo.tipo_campo === 'usuario_ref'
          ? ((usuarios.find(u => u.id === valorBruto) || {}).nome || '—')
          : (valorBruto || '—');
        doc.setFontSize(8.5);
        const rotulo = rotuloCampoRnc(sec, campo);
        doc.text(rotulo ? `${rotulo}: ${valor}` : String(valor), x + 2, y);
        if (campo.tipo_campo === 'usuario_ref' && rnc.confirmacao_token) {
          precisaLinhaExtra = true;
          doc.setFontSize(7);
          if (rnc.confirmacao_confirmada_em) {
            doc.setTextColor(22, 163, 74);
            doc.text(`Confirmado em ${new Date(rnc.confirmacao_confirmada_em).toLocaleString('pt-BR')}`, x + 2, y + 3.5);
          } else {
            doc.setTextColor(180, 83, 9);
            doc.text('Aguardando confirmação', x + 2, y + 3.5);
          }
          doc.setTextColor(0, 0, 0);
        }
      });
      if (precisaLinhaExtra) y += 3.5;
      y += 5.5;
    } else {
      // checkbox_grupo ou selecao_unica: desenha caixinha marcada/desmarcada em 2 colunas
      const colLargura = largura / 2;
      sec.campos.forEach((campo, i) => {
        const col = i % 2;
        if (col === 0 && i > 0) y += 5.5;
        const x = margem + col * colLargura;
        const marcado = !!rnc.dados[campo.id];
        if (marcado) {
          doc.setDrawColor(10, 25, 47);
          doc.setFillColor(10, 25, 47);
          doc.rect(x, y - 3, 3, 3, 'FD'); // preenche o quadrado inteiro, não só o miolo
        } else {
          doc.setDrawColor(120);
          doc.rect(x, y - 3, 3, 3, 'D');
        }
        doc.setFontSize(8.5);
        doc.text(campo.label, x + 5, y - 0.3);
      });
      y += 6;
    }
    y += 2;
  });

  // Rodapé: marca do HomologPro (discreto, cinza claro) — o nome do cliente já
  // está no topo do documento, não precisa repetir aqui.
  doc.setFontSize(7.5);
  doc.setTextColor(160, 160, 160);
  doc.text('HomologPro | homologpro.com.br', margem + largura, 289, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  doc.save(`${rnc.numero_sequencial || 'rnc'}.pdf`);
  addLog('rnc_pdf_gerado', `${currentUser.email} gerou o PDF do RNC ${rnc.numero_sequencial || rnc.id}`);
}
