// formularios.js
// versão: 03
// última atualização: 21/08/2026 17:30

// ============ FORMULÁRIOS ============
function renderAdFormularios() {
  const d = db();
  document.getElementById('ad-page-formularios').innerHTML = `
    <div class="page-header"><div><h2>Formulários de avaliação</h2><p>Estruturas de critérios usadas pelos setores. ${d.formularios.length} cadastrados.</p></div></div>

    <div class="tab-bar">
      <button class="tab active" onclick="showFormTabAd('catalogo', this)">Catálogo</button>
      <button class="tab" onclick="showFormTabAd('criar', this)">Criar formulário</button>
      <button class="tab" id="tab-btn-associar" onclick="showFormTabAd('associar', this)">Associar a e-mail</button>
    </div>

    <div id="form-tab-catalogo" class="form-tab-ad">
      <div class="card">
        <div class="card-title"><span>Regras gerais de prazo e período</span></div>
        <p style="font-size:12px; color:var(--text-muted); margin-bottom:14px">Valem pra todos os formulários de uma vez — não é configuração de um formulário específico.</p>

        <div class="cobranca-field-row" style="grid-template-columns:1fr 1fr; margin-bottom:0">
          <div class="form-group" style="margin-bottom:0">
            <label>Período avaliado${infoTip('Use isso se a avaliação do mês é sempre sobre o serviço prestado em mês(es) anterior(es) — ex: avaliar em Agosto o serviço prestado em Julho. Informe quantos meses de defasagem. Aparece pro avaliador e no e-mail do fornecedor. Deixe 0 se a avaliação é sempre sobre o mês corrente.')}</label>
            <div class="input-suffix-group">
              <input type="number" class="no-spinner" id="fm-periodo-avaliado-meses" min="0" max="12" step="1" value="${d.periodoAvaliadoMesesAntes || 0}">
              <span>meses</span>
            </div>
          </div>
          <div class="form-group" style="margin-bottom:0; display:flex; align-items:end">
            <button class="btn btn-primary" onclick="salvarPeriodoAvaliadoFormularios()">Salvar</button>
          </div>
        </div>

        <div class="cobranca-field-row" style="grid-template-columns:1fr 1fr; margin-top:14px; margin-bottom:0">
          <div class="form-group" style="margin-bottom:0">
            <label>Prazo pro fornecedor enviar o plano de ação${infoTip('Contado em dias úteis a partir de hoje (a data em que o e-mail de cobrança é enviado) — sábados e domingos não contam. Usado no e-mail de notificação, tanto pra Serviço quanto pra Produto/NF.')}</label>
            <div class="input-suffix-group">
              <input type="number" class="no-spinner" id="fm-prazo-plano-acao-dias" min="1" max="60" step="1" value="${(db().textos && db().textos['notif-prazo-dias']) || '10'}">
              <span>dias úteis</span>
            </div>
          </div>
          <div class="form-group" style="margin-bottom:0; display:flex; align-items:end">
            <button class="btn btn-primary" onclick="salvarPrazoPlanoAcaoFormularios()">Salvar</button>
          </div>
        </div>

        <div class="form-group" style="margin-top:14px; margin-bottom:0">
          <label>Pedido de plano de ação${infoTip('Texto usado nos e-mails enviados ao clicar em "Ver / Notificar" no Dashboard — tanto pra avaliação de Serviço quanto pra Nota Fiscal (Produto). Só entra quando a avaliação é reprovada. A saudação (bom dia/boa tarde) e os dados (nota, critérios com problema, motivos) são preenchidos automaticamente — aqui é só a parte do texto.')}</label>
          <textarea rows="2" onchange="salvarTextoDocumento('notif-plano-acao', this.value)">${(db().textos && db().textos['notif-plano-acao']) || ''}</textarea>
        </div>
      </div>

      <div class="card">
        <div class="card-title">
          <span>Catálogo de formulários</span>
          <div style="display:flex; align-items:center; gap:8px">
            <button class="btn btn-secondary btn-sm" id="btn-lote-toggle" onclick="toggleModoLote()">Atualizar prazo em lote</button>
          </div>
        </div>
        <div id="lote-actions" style="display:none; margin-bottom:14px; padding:12px 14px; background:var(--accent-bg); border-radius:8px; align-items:center; gap:10px; flex-wrap:wrap">
          <span style="font-size:12px; color:#1d4ed8">Selecione os formulários abaixo e defina o novo prazo:</span>
          <div class="input-suffix-group" style="max-width:110px">
            <input type="number" class="no-spinner" id="lote-dias-uteis" min="1" max="99" step="1" placeholder="Ex: 10">
            <span>dias úteis</span>
          </div>
          <button class="btn btn-primary btn-sm" onclick="aplicarPrazoLote()">Aplicar aos selecionados</button>
        </div>
        <div id="formularios-catalogo"></div>
      </div>
    </div>

    <div id="form-tab-criar" class="form-tab-ad" style="display:none">
      <div class="card">
        <div class="card-title" id="nfm-titulo">Novo formulário</div>
        <div class="form-row three">
          <div class="form-group"><label>Nome do formulário</label><input type="text" id="nfm-nome" placeholder="Ex: Manutenção predial"></div>
          <div class="form-group"><label>Setor</label><input type="text" id="nfm-setor" placeholder="Ex: Setor Técnico"></div>
          <div class="form-group"><label>O que está sendo avaliado <span style="font-weight:400; color:var(--text-muted)">(opcional)</span></label><input type="text" id="nfm-descricao-avaliado" placeholder="Ex: Manutenção preventiva e corretiva do Alinity"></div>
          <div class="form-group"><label>Tipo</label><select id="nfm-tipo"><option value="servico">Serviço</option><option value="produto">Produto</option></select></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Prazo de entrega (dias úteis a partir do 1º dia útil do mês)</label><input type="number" id="nfm-prazo-dia" min="1" max="22" placeholder="Ex: 10 (10 dias úteis após o 1º dia útil do mês)"></div>
          <div></div>
        </div>

        <p style="font-size:12px; font-weight:600; color:var(--text-sec); margin:6px 0 8px">Campos institucionais deste formulário${infoTip('Os campos que você deixar preenchidos aqui viram automaticamente o padrão pros próximos formulários que você criar — não precisa cadastrar em outro lugar. Editar um formulário já existente não muda esse padrão, só afeta ele mesmo.')}</p>
        <div id="nfm-campos-extras" style="margin-bottom:16px"></div>

        <div id="nfm-criterios"></div>
        <button class="btn btn-secondary btn-sm" onclick="addCriterioBuilder()" style="margin:8px 0 16px">+ Adicionar critério</button>
        <div style="display:flex; justify-content:space-between; align-items:center; padding-top:12px; border-top:1px solid var(--border)">
          <span style="font-size:12px; color:var(--text-muted)">Total de pontos: <b id="nfm-total-pontos" style="color:var(--text)">0.0</b> (ideal: 10,0)</span>
          <div style="display:flex; gap:8px">
            <button class="btn btn-secondary" id="nfm-cancelar-edicao" style="display:none" onclick="cancelarEdicaoFormulario()">Cancelar edição</button>
            <button class="btn btn-primary" id="nfm-salvar-btn" onclick="salvarNovoFormulario()">Salvar formulário</button>
          </div>
        </div>
      </div>
    </div>

    <div id="form-tab-associar" class="form-tab-ad" style="display:none">
      <div class="card">
        <div class="card-title">Associar e-mail a um formulário</div>
        <p style="font-size:12px; color:var(--text-muted); margin-bottom:14px">É essa associação que define quais formulários aparecem quando o avaliador faz login.</p>
        <div class="form-row three">
          <div class="form-group"><label>E-mail do avaliador</label>
            <select id="assoc-email">${d.usuarios.filter(u=>u.papel==='avaliador').map(u => `<option value="${escapeHtml(u.email)}">${escapeHtml(u.email)}</option>`).join('')}</select>
          </div>
          <div class="form-group"><label>Formulário</label>
            <select id="assoc-form">${d.formularios.filter(f => !f.arquivadoEm).map(f => `<option value="${f.id}">${escapeHtml(f.nome)}</option>`).join('')}</select>
          </div>
          <div class="form-group"><label>Fornecedor vinculado</label>
            <select id="assoc-fornecedor"><option value="">Selecione um fornecedor...</option>${d.fornecedores.map(fn => `<option value="${fn.id}">${escapeHtml(fn.nome)}</option>`).join('')}</select>
          </div>
        </div>
        <button class="btn btn-primary" onclick="addAssociacao()">Associar</button>
      </div>
      <div class="card">
        <div class="card-title">Associações ativas (${d.associacoes.length})</div>
        <div id="assoc-lista"></div>
      </div>
    </div>
  `;
  renderAssocLista();
  renderFormulariosCatalogo();
  window._criterioBuilder = [];
  window._camposExtrasBuilder = db().camposGlobais.map(c => ({ ...c }));
  window._editandoFormularioId = null;
  renderCriteriosBuilder();
  renderCamposExtrasBuilder();
}

async function salvarPeriodoAvaliadoFormularios() {
  const meses = parseInt(document.getElementById('fm-periodo-avaliado-meses').value, 10) || 0;
  mostrarCarregando('Salvando...');

  const { error } = await supabaseClient.from('empresas').update({ periodo_avaliado_meses_antes: meses }).eq('id', currentUser.empresaId);
  if (error) { esconderProgresso(); toast('Erro ao salvar: ' + error.message); return; }

  empresaConfigCache.periodo_avaliado_meses_antes = meses;
  addLog('config_periodo_avaliado', `${currentUser.email} mudou o período avaliado para ${meses} mês(es) antes`);
  mostrarSucesso('Salvo!');
}

// Movido de Relatórios & PDFs (ago/2026) — Carlos pediu que o prazo do plano
// de ação seja em dias ÚTEIS (não mais dias corridos), e que fique junto com
// as outras "regras gerais de prazo e período" em vez de dentro do card de
// texto do e-mail. Reaproveita a mesma chave notif-prazo-dias em
// empresas.config.textos (mesma que enviar-avaliacao-html e
// enviar-avaliacao-produto-html já leem) — só muda onde se edita e como o
// valor é interpretado (dias úteis em vez de corridos).
async function salvarPrazoPlanoAcaoFormularios() {
  const dias = parseInt(document.getElementById('fm-prazo-plano-acao-dias').value, 10);
  if (!dias || dias < 1) { toast('Informe um número de dias úteis válido.'); return; }

  mostrarCarregando('Salvando...');
  const textos = { ...db().textos, 'notif-prazo-dias': String(dias) };
  const { error } = await salvarConfigEmpresa('textos', textos);
  if (error) { esconderProgresso(); toast('Erro ao salvar: ' + error.message); return; }

  addLog('config_prazo_plano_acao', `${currentUser.email} mudou o prazo do plano de ação para ${dias} dia(s) útil(eis)`);
  mostrarSucesso('Salvo!');
}

function showFormTabAd(tab, btn) {
  document.querySelectorAll('.form-tab-ad').forEach(el => el.style.display = 'none');
  document.querySelectorAll('#ad-page-formularios > .tab-bar > .tab').forEach(el => el.classList.remove('active'));
  document.getElementById('form-tab-' + tab).style.display = 'block';
  btn.classList.add('active');
}

// ---- Campos extras por formulário (builder) ----
function renderCamposExtrasBuilder() {
  const wrap = document.getElementById('nfm-campos-extras');
  if (!wrap) return;
  if (!window._camposExtrasBuilder.length) {
    wrap.innerHTML = '<p style="font-size:12px; color:var(--text-muted)">Nenhum campo institucional ainda — adicione abaixo.</p>';
  } else {
    wrap.innerHTML = window._camposExtrasBuilder.map((c, i) => `
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px">
        <div class="form-group" style="width:160px"><input type="text" value="${c.label}" placeholder="Nome do campo" oninput="window._camposExtrasBuilder[${i}].label=this.value"></div>
        <div class="form-group" style="flex:1"><input type="text" value="${c.valor}" placeholder="Valor" oninput="window._camposExtrasBuilder[${i}].valor=this.value"></div>
        <button class="btn btn-danger btn-sm" onclick="removeCampoExtraBuilder(${i})">${ic('x', 12)}</button>
      </div>
    `).join('');
  }
  wrap.innerHTML += `<button class="btn btn-secondary btn-sm" onclick="addCampoExtraBuilder()" style="margin-top:4px">+ Campo institucional</button>`;
}

function addCampoExtraBuilder() {
  window._camposExtrasBuilder.push({ chave: 'ce' + Date.now(), label: '', valor: '' });
  renderCamposExtrasBuilder();
}
function removeCampoExtraBuilder(i) {
  window._camposExtrasBuilder.splice(i, 1);
  renderCamposExtrasBuilder();
}

// ---- Modo lote de prazo de entrega ----
function toggleModoLote() {
  window._modoLote = !window._modoLote;
  document.getElementById('lote-actions').style.display = window._modoLote ? 'flex' : 'none';
  document.getElementById('btn-lote-toggle').textContent = window._modoLote ? 'Cancelar seleção' : 'Atualizar prazo em lote';
  renderFormulariosCatalogo();
}

async function aplicarPrazoLote() {
  const diasUteis = parseInt(document.getElementById('lote-dias-uteis').value, 10);
  if (!diasUteis || diasUteis < 1) { toast('Informe quantos dias úteis.'); return; }
  const checks = document.querySelectorAll('.lote-check:checked');
  if (!checks.length) { toast('Selecione ao menos um formulário.'); return; }
  const ids = Array.from(checks).map(chk => chk.value);

  mostrarCarregando('Atualizando prazo...');

  const { error } = await supabaseClient.from('formularios').update({ prazo_entrega_dia: diasUteis }).in('id', ids);
  if (error) { esconderProgresso(); toast('Erro ao atualizar: ' + error.message); return; }

  const d = db();
  ids.forEach(id => {
    const f = d.formularios.find(x => x.id === id);
    if (f) f.prazoEntregaDia = diasUteis;
  });

  addLog('prazo_lote_atualizado', `${currentUser.email} atualizou o prazo de entrega para ${diasUteis} dias úteis em ${ids.length} formulário(s)`);
  mostrarSucesso(`Prazo atualizado em ${ids.length} formulário(s).`);
  window._modoLote = false;
  document.getElementById('lote-actions').style.display = 'none';
  document.getElementById('btn-lote-toggle').textContent = 'Atualizar prazo em lote';
  renderFormulariosCatalogo();
}

// ---- Construtor de critérios/opções ----
function addCriterioBuilder() {
  window._criterioBuilder.push({ tempId: 'tc' + Date.now(), nome: '', pesoMax: 0, opcoes: [{ label: '', pontos: 0 }] });
  renderCriteriosBuilder();
}

function removeCriterioBuilder(tempId) {
  window._criterioBuilder = window._criterioBuilder.filter(c => c.tempId !== tempId);
  renderCriteriosBuilder();
}

function addOpcaoBuilder(tempId) {
  const crit = window._criterioBuilder.find(c => c.tempId === tempId);
  crit.opcoes.push({ label: '', pontos: 0 });
  renderCriteriosBuilder();
}

function removeOpcaoBuilder(tempId, idx) {
  const crit = window._criterioBuilder.find(c => c.tempId === tempId);
  crit.opcoes.splice(idx, 1);
  renderCriteriosBuilder();
}

function updateCriterioField(tempId, field, value) {
  const crit = window._criterioBuilder.find(c => c.tempId === tempId);
  crit[field] = field === 'pesoMax' ? parseFloat(value) || 0 : value;
  updateTotalPontosPreview();
}

function updateOpcaoField(tempId, idx, field, value) {
  const crit = window._criterioBuilder.find(c => c.tempId === tempId);
  crit.opcoes[idx][field] = field === 'pontos' ? parseFloat(value) || 0 : value;
}

function updateTotalPontosPreview() {
  const total = window._criterioBuilder.reduce((s,c) => s + (c.pesoMax || 0), 0);
  const el = document.getElementById('nfm-total-pontos');
  if (el) el.textContent = total.toFixed(1);
}

function renderCriteriosBuilder() {
  const wrap = document.getElementById('nfm-criterios');
  if (!wrap) return;
  if (!window._criterioBuilder.length) {
    wrap.innerHTML = '<div class="empty-state" style="padding:24px"><p>Nenhum critério adicionado. Clique em "Adicionar critério" abaixo.</p></div>';
    return;
  }
  wrap.innerHTML = window._criterioBuilder.map(c => `
    <div class="criterio-block">
      <div class="form-row" style="margin-bottom:10px">
        <div class="form-group"><label>Nome do critério</label><input type="text" value="${escapeHtml(c.nome)}" placeholder="Ex: Atendimento" oninput="updateCriterioField('${c.tempId}','nome',this.value)"></div>
        <div class="form-group"><label>Peso máximo (pontos)</label><input type="number" step="0.1" value="${c.pesoMax || ''}" placeholder="Ex: 3.0" oninput="updateCriterioField('${c.tempId}','pesoMax',this.value); updateTotalPontosPreview()"></div>
      </div>
      <p style="font-size:11px; font-weight:600; color:var(--text-muted); margin-bottom:8px">Opções de resposta e pontuação</p>
      ${c.opcoes.map((op, i) => `
        <div style="display:flex; gap:8px; align-items:center; margin-bottom:6px">
          <div class="form-group" style="flex:1"><input type="text" value="${op.label}" placeholder="Ex: Dentro da expectativa" oninput="updateOpcaoField('${c.tempId}',${i},'label',this.value)"></div>
          <div class="form-group" style="width:70px"><input type="number" step="0.1" value="${op.pontos || ''}" placeholder="Pts" oninput="updateOpcaoField('${c.tempId}',${i},'pontos',this.value)"></div>
          <button class="btn btn-danger btn-sm" onclick="removeOpcaoBuilder('${c.tempId}',${i})">${ic('x', 12)}</button>
        </div>
      `).join('')}
      <div style="display:flex; justify-content:space-between; margin-top:8px">
        <button class="btn btn-secondary btn-sm" onclick="addOpcaoBuilder('${c.tempId}')">+ Opção</button>
        <button class="btn btn-danger btn-sm" onclick="removeCriterioBuilder('${c.tempId}')">Remover critério</button>
      </div>
    </div>
  `).join('');
  updateTotalPontosPreview();
}

function editarFormulario(id) {
  const d = db();
  const f = d.formularios.find(x => x.id === id);
  if (!f) return;
  if (d.avaliacoes.some(av => av.formularioId === id)) {
    alert('Este formulário já possui avaliações registradas e não pode mais ser editado. Arquive-o e crie um novo, se precisar mudar algo.');
    return;
  }

  window._editandoFormularioId = id;
  window._criterioBuilder = f.criterios.map(c => ({
    tempId: c.id,
    nome: c.nome,
    pesoMax: c.pesoMax,
    opcoes: c.opcoes.map(o => ({ ...o }))
  }));
  window._camposExtrasBuilder = (f.camposExtras || []).map(c => ({ ...c }));

  // muda para a aba criar
  document.querySelectorAll('.form-tab-ad').forEach(el => el.style.display = 'none');
  document.querySelectorAll('#ad-page-formularios > .tab-bar > .tab').forEach(el => el.classList.remove('active'));
  document.getElementById('form-tab-criar').style.display = 'block';
  document.querySelectorAll('#ad-page-formularios > .tab-bar > .tab')[1].classList.add('active');

  document.getElementById('nfm-titulo').textContent = `Editando: ${f.nome}`;
  document.getElementById('nfm-nome').value = f.nome;
  document.getElementById('nfm-setor').value = f.setor;
  document.getElementById('nfm-descricao-avaliado').value = f.descricaoAvaliado || '';
  document.getElementById('nfm-tipo').value = f.tipo;
  document.getElementById('nfm-prazo-dia').value = f.prazoEntregaDia || '';
  document.getElementById('nfm-cancelar-edicao').style.display = 'inline-flex';
  document.getElementById('nfm-salvar-btn').textContent = 'Salvar alterações';

  renderCriteriosBuilder();
  renderCamposExtrasBuilder();
}

function cancelarEdicaoFormulario() {
  window._editandoFormularioId = null;
  window._criterioBuilder = [];
  window._camposExtrasBuilder = db().camposGlobais.map(c => ({ ...c }));
  document.getElementById('nfm-titulo').textContent = 'Novo formulário';
  document.getElementById('nfm-nome').value = '';
  document.getElementById('nfm-setor').value = '';
  document.getElementById('nfm-descricao-avaliado').value = '';
  document.getElementById('nfm-prazo-dia').value = '';
  document.getElementById('nfm-cancelar-edicao').style.display = 'none';
  document.getElementById('nfm-salvar-btn').textContent = 'Salvar formulário';
  renderCriteriosBuilder();
  renderCamposExtrasBuilder();
}

async function salvarNovoFormulario() {
  const d = db();
  if (window._editandoFormularioId && d.avaliacoes.some(av => av.formularioId === window._editandoFormularioId)) {
    toast('Este formulário já possui avaliações registradas e não pode mais ser editado.');
    return;
  }

  const nome = document.getElementById('nfm-nome').value.trim();
  const setor = document.getElementById('nfm-setor').value.trim();
  const descricaoAvaliado = document.getElementById('nfm-descricao-avaliado').value.trim();
  const tipo = document.getElementById('nfm-tipo').value;
  const prazoDia = document.getElementById('nfm-prazo-dia').value;

  if (!nome || !setor) { toast('Informe o nome e o setor do formulário.'); return; }
  if (!window._criterioBuilder.length) { toast('Adicione ao menos um critério.'); return; }

  for (const c of window._criterioBuilder) {
    if (!c.nome.trim()) { toast('Todos os critérios precisam de um nome.'); return; }
    if (!c.pesoMax || c.pesoMax <= 0) { toast(`Defina o peso máximo do critério "${c.nome}".`); return; }
    if (!c.opcoes.length || c.opcoes.some(o => !o.label.trim())) { toast(`Preencha o texto de todas as opções do critério "${c.nome}".`); return; }
  }

  const camposExtras = window._camposExtrasBuilder.filter(c => c.label.trim()).map(c => ({ chave: c.chave, label: c.label.trim(), valor: c.valor.trim() }));
  const criterios = window._criterioBuilder.map((c, i) => ({
    id: (c.tempId && c.tempId.startsWith('tc')) ? 'c' + (i + 1) : (c.tempId || 'c' + (i + 1)),
    nome: c.nome.trim(),
    pesoMax: c.pesoMax,
    opcoes: c.opcoes.map(o => ({ label: o.label.trim(), pontos: o.pontos })),
  }));

  const payload = {
    nome, setor, tipo,
    descricao_avaliado: descricaoAvaliado || null,
    prazo_entrega_dia: prazoDia ? parseInt(prazoDia) : null,
    campos_extras: camposExtras,
    criterios,
  };

  if (window._editandoFormularioId) {
    const { error } = await supabaseClient.from('formularios').update(payload).eq('id', window._editandoFormularioId);
    if (error) { toast('Erro ao atualizar formulário: ' + error.message); return; }
    addLog('formulario_editado', `${currentUser.email} editou o formulário "${nome}"`);
    toast('Formulário atualizado!');
  } else {
    const { error } = await supabaseClient.from('formularios').insert({ ...payload, empresa_id: currentUser.empresaId });
    if (error) { toast('Erro ao criar formulário: ' + error.message); return; }
    addLog('formulario_criado', `${currentUser.email} criou o formulário "${nome}" (setor: ${setor}, ${criterios.length} critérios)`);

    // Memoriza os campos institucionais usados aqui como o novo padrão pros
    // PRÓXIMOS formulários criados — só ao criar, nunca ao editar um já
    // existente (editar um formulário específico não deve mudar o padrão
    // global sem querer).
    const { error: padraoErr } = await salvarConfigEmpresa('camposGlobaisPadrao', camposExtras);
    if (padraoErr) console.error('Erro ao memorizar padrão de campos institucionais:', padraoErr.message);

    toast('Formulário criado! Agora associe a um e-mail na aba "Associar a e-mail".');
  }

  window._criterioBuilder = [];
  window._editandoFormularioId = null;
  await carregarFormularios();
  renderAdFormularios();
}


function renderAssocLista() {
  const d = db();
  const wrap = document.getElementById('assoc-lista');
  if (!d.associacoes.length) { wrap.innerHTML = '<div class="empty-state"><p>Nenhuma associação configurada.</p></div>'; return; }
  wrap.innerHTML = `<table><thead><tr><th>E-mail</th><th>Formulário</th><th>Fornecedor</th><th></th></tr></thead><tbody>
    ${d.associacoes.map(a => {
      const usuario = d.usuarios.find(u => u.id === a.usuarioId);
      const form = d.formularios.find(f => f.id === a.formularioId);
      const forn = a.fornecedorId ? d.fornecedores.find(f => f.id === a.fornecedorId) : null;
      return `<tr>
        <td style="font-weight:500">${usuario ? usuario.email : '—'}</td>
        <td>${form ? form.nome : '—'}</td>
        <td style="color:var(--text-sec)">${forn ? forn.nome : '—'}</td>
        <td><div class="actions"><button class="btn btn-danger btn-sm" onclick="removeAssociacao('${a.id}')">Remover</button></div></td>
      </tr>`;
    }).join('')}
  </tbody></table>`;
}

async function addAssociacao() {
  const email = document.getElementById('assoc-email').value;
  const formularioId = document.getElementById('assoc-form').value;
  const fornecedorId = document.getElementById('assoc-fornecedor').value;
  if (!email || !formularioId) { toast('Selecione e-mail e formulário.'); return; }
  if (!fornecedorId) { toast('Selecione o fornecedor vinculado — esse campo agora é obrigatório.'); return; }
  const d = db();
  const usuario = d.usuarios.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!usuario) { toast('Usuário não encontrado.'); return; }

  mostrarCarregando('Associando...');

  const { error } = await supabaseClient.from('associacoes').insert({
    empresa_id: currentUser.empresaId,
    usuario_id: usuario.id,
    formulario_id: formularioId,
    fornecedor_id: fornecedorId,
  });

  if (error) { esconderProgresso(); toast('Erro ao criar associação: ' + error.message); return; }

  const form = d.formularios.find(f => f.id === formularioId);
  addLog('associacao_criada', `${currentUser.email} associou o formulário "${form.nome}" ao e-mail ${email}`);
  await carregarAssociacoes();
  renderAssocLista();
  mostrarSucesso('Associado!');
}

async function removeAssociacao(id) {
  const { error } = await supabaseClient.from('associacoes').delete().eq('id', id);
  if (error) { toast('Erro ao remover associação: ' + error.message); return; }
  addLog('associacao_removida', `${currentUser.email} removeu uma associação de formulário`);
  await carregarAssociacoes();
  renderAssocLista();
  toast('Associação removida.');
}

function renderFormulariosCatalogo() {
  const d = db();
  const wrap = document.getElementById('formularios-catalogo');
  if (!d.formularios.length) { wrap.innerHTML = '<div class="empty-state"><p>Nenhum formulário cadastrado.</p></div>'; return; }
  const modoLote = !!window._modoLote;
  // Um formulário fica imutável (sem editar/excluir) assim que existe pelo
  // menos uma avaliação usando ele — mesma trava que existe no banco. Aqui
  // só reflete isso na tela; quem garante de verdade é o trigger no Supabase.
  const formIdsAvaliados = new Set(d.avaliacoes.map(av => av.formularioId));
  wrap.innerHTML = d.formularios.map(f => {
    const temAvaliacao = formIdsAvaliados.has(f.id);
    const arquivado = !!f.arquivadoEm;
    return `
    <div style="padding:12px 0; border-bottom:1px solid var(--border); ${arquivado ? 'opacity:.6' : ''}">
      <div style="display:flex; justify-content:space-between; align-items:center">
        <div style="display:flex; align-items:center; gap:10px">
          ${modoLote ? `<input type="checkbox" class="lote-check" value="${f.id}" style="accent-color:var(--accent)">` : ''}
          <div>
            <span style="font-weight:500; font-size:13px">${escapeHtml(f.nome)}</span>
            <span class="tag-${f.tipo}" style="margin-left:8px">${f.tipo === 'produto' ? 'Produto' : 'Serviço'}</span>
            ${f.prazoEntregaDia ? `<span class="badge badge-accent" style="margin-left:6px">Vence em ${fmtDataSimples(prazoFinalDiasUteis(new Date().getFullYear(), new Date().getMonth(), f.prazoEntregaDia).toISOString().slice(0,10))} (${f.prazoEntregaDia} dias úteis)</span>` : ''}
            ${arquivado ? `<span class="badge" style="margin-left:6px; background:var(--text-muted); color:#fff">Arquivado</span>` : temAvaliacao ? `<span class="badge badge-accent" style="margin-left:6px">Já avaliado — travado</span>` : ''}
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:10px">
          <span style="font-size:11px; color:var(--text-muted)">${f.criterios.length} critérios · máx ${f.criterios.reduce((s,c)=>s+c.pesoMax,0).toFixed(1)}P</span>
          <button class="btn btn-secondary btn-sm" onclick="verFormularioDetalhe('${f.id}')">Ver</button>
          ${!temAvaliacao ? `<button class="btn btn-secondary btn-sm" onclick="editarFormulario('${f.id}')">Editar</button>` : ''}
          <button class="btn btn-secondary btn-sm" onclick="duplicarFormularioAd('${f.id}')">Duplicar</button>
          ${arquivado
            ? `<button class="btn btn-secondary btn-sm" onclick="desarquivarFormularioAd('${f.id}')">Desarquivar</button>`
            : `<button class="btn btn-secondary btn-sm" onclick="arquivarFormularioAd('${f.id}')">Arquivar</button>`}
          ${!temAvaliacao ? `<button class="btn btn-danger btn-sm" onclick="removeFormularioAd('${f.id}')">Remover</button>` : ''}
        </div>
      </div>
      <p style="font-size:11px; color:var(--text-muted); margin-top:4px">Setor: ${f.setor} · ${f.criterios.map(c=>c.nome).join(', ')}${f.camposExtras && f.camposExtras.length ? ' · ' + f.camposExtras.map(c=>`${c.label}: ${c.valor}`).join(' · ') : ''}</p>
    </div>
  `;
  }).join('');
}

// Arquivar/desarquivar são simples UPDATE em "arquivado_em" — o trigger no
// banco permite isso mesmo em formulário já avaliado (só bloqueia mudança
// de conteúdo). Formulário arquivado some do dropdown de novas associações,
// mas continua existindo pra não quebrar avaliações antigas que apontam pra ele.
async function arquivarFormularioAd(id) {
  if (!confirm('Arquivar este formulário? Ele deixa de aparecer para novas associações, mas continua existindo para avaliações já feitas.')) return;
  const { error } = await supabaseClient.from('formularios').update({ arquivado_em: new Date().toISOString() }).eq('id', id);
  if (error) { alert('Erro ao arquivar: ' + error.message); return; }
  await carregarFormularios();
  renderFormulariosCatalogo();
}

async function desarquivarFormularioAd(id) {
  const { error } = await supabaseClient.from('formularios').update({ arquivado_em: null }).eq('id', id);
  if (error) { alert('Erro ao desarquivar: ' + error.message); return; }
  await carregarFormularios();
  renderFormulariosCatalogo();
}

async function duplicarFormularioAd(id) {
  const d = db();
  const f = d.formularios.find(x => x.id === id);
  if (!f) return;

  const { error } = await supabaseClient.from('formularios').insert({
    empresa_id: currentUser.empresaId,
    nome: f.nome + ' (cópia)',
    setor: f.setor,
    tipo: f.tipo,
    descricao_avaliado: f.descricaoAvaliado || null,
    prazo_entrega_dia: f.prazoEntregaDia,
    campos_extras: f.camposExtras,
    criterios: f.criterios,
  });

  if (error) { toast('Erro ao duplicar formulário: ' + error.message); return; }

  addLog('formulario_duplicado', `${currentUser.email} duplicou o formulário "${f.nome}"`);
  await carregarFormularios();
  renderFormulariosCatalogo();
  toast('Formulário duplicado! Já pode editar o nome e os critérios da cópia.');
}

function verFormularioDetalhe(id) {
  const d = db();
  const f = d.formularios.find(x => x.id === id);
  openModal(`
    <h3>${escapeHtml(f.nome)}</h3>
    <p style="font-size:12px; color:var(--text-muted); margin-bottom:6px">Setor: ${f.setor} · ${f.tipo === 'produto' ? 'Produto' : 'Serviço'} · máx ${f.criterios.reduce((s,c)=>s+c.pesoMax,0).toFixed(1)}P</p>
    ${f.camposExtras && f.camposExtras.length ? `<p style="font-size:12px; color:var(--text-sec); margin-bottom:14px">${f.camposExtras.map(c=>`<b>${c.label}:</b> ${c.valor}`).join(' &nbsp;·&nbsp; ')}</p>` : ''}
    ${f.prazoEntregaDia ? `<p style="font-size:12px; color:var(--accent); margin-bottom:14px">Prazo de entrega: ${f.prazoEntregaDia} dias úteis a partir do 1º dia útil do mês (este mês vence em ${fmtDataSimples(prazoFinalDiasUteis(new Date().getFullYear(), new Date().getMonth(), f.prazoEntregaDia).toISOString().slice(0,10))})</p>` : ''}
    ${f.criterios.map(c => `
      <div style="margin-bottom:12px">
        <p style="font-size:12px; font-weight:600">${escapeHtml(c.nome)} <span style="font-weight:400; color:var(--text-muted)">(até ${c.pesoMax.toFixed(1)}P)</span></p>
        ${c.opcoes.map(o => `<div style="font-size:12px; color:var(--text-sec); padding:2px 0 2px 10px">• ${o.label} — ${o.pontos.toFixed(1)}P</div>`).join('')}
      </div>
    `).join('')}
    <div style="display:flex; justify-content:flex-end; margin-top:14px">
      <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    </div>
  `);
}

async function removeFormularioAd(id) {
  const d = db();
  const f = d.formularios.find(x => x.id === id);
  if (d.avaliacoes.some(av => av.formularioId === id)) {
    alert('Este formulário já possui avaliações registradas e não pode ser excluído. Use "Arquivar" em vez disso.');
    return;
  }
  const emUso = d.associacoes.some(a => a.formularioId === id);
  if (emUso) {
    if (!confirm(`"${f.nome}" está associado a um ou mais e-mails. Remover o formulário também removerá essas associações. Continuar?`)) return;
  } else {
    if (!confirm(`Remover o formulário "${f.nome}"?`)) return;
  }

  // O banco já tem "on delete cascade" em associacoes.formulario_id,
  // então apagar o formulário remove as associações dele automaticamente.
  const { error } = await supabaseClient.from('formularios').delete().eq('id', id);
  if (error) { toast('Erro ao remover formulário: ' + error.message); return; }

  addLog('formulario_removido', `${currentUser.email} removeu o formulário "${f.nome}"`);
  await carregarFormularios();
  await carregarAssociacoes();
  renderAdFormularios();
  toast('Formulário removido.');
}

// ---------- USUÁRIOS ----------
