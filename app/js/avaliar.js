// ============ AVALIAR: preenchimento de avaliação (avaliador) + avaliação de produto (admin) ============
// ============ SHELL DO AVALIADOR ============
// Mesma lógica de renderAvFormularios, só que genérica pra qualquer
// usuarioId — usada no painel de Usuários (admin) pra saber quem tem
// pendência, sem precisar estar logado como aquele avaliador.
function contarPendentesAvaliador(d, usuarioId) {
  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();
  const chaveMes = `${anoAtual}-${mesAtual}`;
  const hoje = new Date();

  const minhasAssoc = d.associacoes.filter(a => a.usuarioId === usuarioId);
  let pendentes = 0, atrasados = 0;

  minhasAssoc.forEach(assoc => {
    const form = d.formularios.find(f => f.id === assoc.formularioId);
    if (!form) return;
    const jaPreenchido = d.avaliacoes.some(av => av.formularioId === form.id && av.fornecedorId === assoc.fornecedorId && av.usuarioId === usuarioId && av.periodo === chaveMes);
    if (jaPreenchido) return;
    pendentes++;
    if (form.prazoEntregaDia) {
      const prazoFinal = prazoFinalDiasUteis(hoje.getFullYear(), hoje.getMonth(), form.prazoEntregaDia);
      if (hoje > prazoFinal) atrasados++;
    }
  });

  return { pendentes, atrasados };
}

function renderAvaliadorShell() {
  const totalNotif = contarNotificacoesAvaliador(db(), currentUser.id);
  document.getElementById('sidebar').innerHTML = `
    <div class="sidebar-logo"><h1>HomologPro</h1><p>Área do avaliador</p></div>
    <div class="sidebar-user">
      <div class="sidebar-user-avatar">${(currentUser.responsavel || currentUser.nome).split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>
      <div class="sidebar-user-info">
        <p>${currentUser.responsavel || currentUser.nome}</p>
        <span>${currentUser.responsavel ? currentUser.nome + ' · ' : ''}${currentUser.email}</span><br>
        <span class="role-badge avaliador">Avaliador</span>
      </div>
    </div>
    <button class="nav-item active" onclick="showAvPage('formularios', this)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      Meus formulários
    </button>
    <button class="nav-item" onclick="showAvPage('historico', this)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      Histórico de envios
    </button>
    <button class="nav-item" onclick="showAvPage('notificacoes', this)">
      ${ic('bell', 16)}
      Notificações
      <span class="nav-badge" id="av-nav-notif-badge" style="display:${totalNotif > 0 ? 'inline-flex' : 'none'}">${totalNotif}</span>
    </button>
    <div class="nav-logout">
      <button class="nav-item" onclick="doLogout()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Sair
      </button>
    </div>
  `;
  document.getElementById('main').innerHTML = `
    <div class="page active" id="av-page-formularios"></div>
    <div class="page" id="av-page-historico"></div>
    <div class="page" id="av-page-notificacoes"></div>
  `;
  renderAvFormularios();
}

function showAvPage(page, btn) {
  document.querySelectorAll('#sidebar .nav-item').forEach(n => n.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.querySelectorAll('#main .page').forEach(p => p.classList.remove('active'));
  document.getElementById('av-page-' + page).classList.add('active');
  if (page === 'formularios') renderAvFormularios();
  if (page === 'historico') renderAvHistorico();
  if (page === 'notificacoes') renderAvNotificacoes();
}

// ---------- NOTIFICAÇÕES (plano de ação recebido + liberação de edição) ----------
// Contador não bate no banco: usa o mesmo avaliacoesCache que já alimenta
// "Meus formulários"/"Histórico" (carregado inteiro no login), então isso
// é só um filtro em memória — não pesa nada a mais no portal.
function contarNotificacoesAvaliador(d, usuarioId) {
  const minhas = (d.avaliacoes || []).filter(av => av.usuarioId === usuarioId);
  const planosNaoVistos = minhas.filter(av => av.planoAcaoAnexo && !av.planoAcaoVistoEm).length;
  // Liberação de edição "se resolve sozinha": liberado_edicao volta pra
  // false automaticamente quando o avaliador reenvia a avaliação corrigida
  // (ver enviarAvaliacao) — não precisa de campo "visto" separado pra isso.
  const liberacoesPendentes = minhas.filter(av => av.liberadoEdicao).length;
  return planosNaoVistos + liberacoesPendentes;
}

function atualizarBadgeNotificacoesAvaliador() {
  const el = document.getElementById('av-nav-notif-badge');
  if (!el) return;
  const n = contarNotificacoesAvaliador(db(), currentUser.id);
  el.textContent = n;
  el.style.display = n > 0 ? 'inline-flex' : 'none';
}

function renderAvNotificacoes() {
  const d = db();
  const minhas = d.avaliacoes.filter(av => av.usuarioId === currentUser.id);
  const planos = minhas.filter(av => av.planoAcaoAnexo && !av.planoAcaoVistoEm)
    .sort((a, b) => new Date(b.planoAcaoAnexo.enviadoEm) - new Date(a.planoAcaoAnexo.enviadoEm));
  const liberacoes = minhas.filter(av => av.liberadoEdicao)
    .sort((a, b) => new Date(b.enviadoEm) - new Date(a.enviadoEm));

  const wrap = document.getElementById('av-page-notificacoes');

  if (!planos.length && !liberacoes.length) {
    wrap.innerHTML = `
      <div class="page-header"><div><h2>Notificações</h2><p>Avisos sobre suas avaliações</p></div></div>
      <div class="card"><div class="empty-state"><p>Nada novo por aqui.</p></div></div>`;
    return;
  }

  const itemHtml = (av, tipo) => {
    const form = d.formularios.find(f => f.id === av.formularioId);
    const fornecedor = d.fornecedores.find(f => f.id === av.fornecedorId);
    const dataRef = tipo === 'plano' ? av.planoAcaoAnexo.enviadoEm : av.enviadoEm;
    const onclick = tipo === 'plano' ? `abrirNotificacaoPlanoAcao('${av.id}')` : `verDetalheAvaliacao('${av.id}')`;
    return `
      <div style="display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid var(--border); cursor:pointer" onclick="${onclick}">
        ${ic(tipo === 'plano' ? 'fileText' : 'bell', 15)}
        <div style="flex:1">
          <div style="font-size:12.5px; font-weight:500">${form ? form.nome : '—'}${fornecedor ? ` · ${fornecedor.nome}` : ''}</div>
          <div style="font-size:11px; color:var(--text-muted)">${tipo === 'plano' ? 'Plano de ação enviado pelo fornecedor' : 'Edição liberada pelo admin — reenvie a avaliação'} · ${fmtData(dataRef)}</div>
        </div>
      </div>`;
  };

  wrap.innerHTML = `
    <div class="page-header">
      <div><h2>Notificações</h2><p>Avisos sobre suas avaliações</p></div>
      ${planos.length ? `<button class="btn btn-secondary btn-sm" onclick="marcarTodasNotificacoesVistas()">Marcar tudo como lido</button>` : ''}
    </div>
    ${liberacoes.length ? `
      <div class="card" style="margin-bottom:14px">
        <b style="font-size:13px">Edições liberadas (${liberacoes.length})</b>
        ${liberacoes.map(av => itemHtml(av, 'liberacao')).join('')}
      </div>` : ''}
    ${planos.length ? `
      <div class="card">
        <b style="font-size:13px">Planos de ação recebidos (${planos.length})</b>
        ${planos.map(av => itemHtml(av, 'plano')).join('')}
      </div>` : ''}
  `;
}

async function abrirNotificacaoPlanoAcao(avId) {
  await marcarNotificacaoVista(avId);
  verDetalheAvaliacao(avId);
}

async function marcarNotificacaoVista(avId) {
  const agora = new Date().toISOString();
  const { error } = await supabaseClient.from('avaliacoes').update({ plano_acao_visto_em: agora }).eq('id', avId);
  if (error) { console.error('Erro ao marcar notificação como vista:', error.message); return; }
  const av = db().avaliacoes.find(a => a.id === avId);
  if (av) av.planoAcaoVistoEm = agora;
  atualizarBadgeNotificacoesAvaliador();
}

async function marcarTodasNotificacoesVistas() {
  const d = db();
  const pendentes = d.avaliacoes.filter(av => av.usuarioId === currentUser.id && av.planoAcaoAnexo && !av.planoAcaoVistoEm);
  if (!pendentes.length) return;
  const agora = new Date().toISOString();
  const { error } = await supabaseClient.from('avaliacoes').update({ plano_acao_visto_em: agora }).in('id', pendentes.map(av => av.id));
  if (error) { toast('Erro ao marcar como lido: ' + error.message); return; }
  pendentes.forEach(av => { av.planoAcaoVistoEm = agora; });
  atualizarBadgeNotificacoesAvaliador();
  renderAvNotificacoes();
}

function renderAvFormularios() {
  const d = db();
  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();

  const minhasAssoc = d.associacoes.filter(a => a.usuarioId === currentUser.id);

  const wrap = document.getElementById('av-page-formularios');
  if (!minhasAssoc.length) {
    wrap.innerHTML = `
      <div class="page-header"><div><h2>Meus formulários</h2><p>Nenhum formulário foi associado ao seu e-mail ainda. Fale com o administrador.</p></div></div>
      <div class="card"><div class="empty-state"><p>Sem formulários disponíveis.</p></div></div>`;
    return;
  }

  const pendentesNotificacao = d.avaliacoes.filter(av => av.usuarioId === currentUser.id && !av.notificadoEm).length;
  const chaveMesAtual = `${anoAtual}-${mesAtual}`;
  const refLabel = mesReferenciaLabel(chaveMesAtual, d.periodoAvaliadoMesesAntes);

  wrap.innerHTML = `
    <div class="page-header">
      <div><h2>Meus formulários</h2><p>${MESES[mesAtual]} de ${anoAtual}${refLabel ? ` · referente ao serviço prestado em ${refLabel}` : ''} — clique em um formulário para avaliar</p></div>
      ${pendentesNotificacao ? `<button class="btn btn-primary btn-sm" onclick="notificarAvaliacoesConcluidas()">Enviar notificação (${pendentesNotificacao})</button>` : ''}
    </div>
    <div class="forms-grid" id="av-forms-grid"></div>
  `;

  const grid = document.getElementById('av-forms-grid');
  grid.innerHTML = minhasAssoc.map(assoc => {
    const form = d.formularios.find(f => f.id === assoc.formularioId);
    if (!form) return '';
    const fornecedor = assoc.fornecedorId ? d.fornecedores.find(fn => fn.id === assoc.fornecedorId) : null;
    const chaveMes = `${anoAtual}-${mesAtual}`;
    // Pode ter MAIS DE UMA avaliação no mês (um atendimento por avaliação) —
    // pega todas e usa a mais recente pra mostrar status/nota no card.
    const avaliacoesDoMes = d.avaliacoes
      .filter(av => av.formularioId === form.id && av.fornecedorId === assoc.fornecedorId && av.usuarioId === currentUser.id && av.periodo === chaveMes)
      .sort((a, b) => new Date(b.enviadoEm) - new Date(a.enviadoEm));
    const jaPreenchido = avaliacoesDoMes[0] || null;
    const foiLiberado = jaPreenchido && jaPreenchido.liberadoEdicao;

    const camposLinha = (form.camposExtras && form.camposExtras.length)
      ? form.camposExtras.filter(c => c.valor).map(c => `${c.label}: ${c.valor}`).join(' · ')
      : '';

    let prazoLinha = '';
    if (form.prazoEntregaDia) {
      const hoje = new Date();
      const prazoFinal = prazoFinalDiasUteis(hoje.getFullYear(), hoje.getMonth(), form.prazoEntregaDia);
      const atrasado = hoje > prazoFinal && !jaPreenchido;
      prazoLinha = `<span style="color:${atrasado ? 'var(--danger)' : 'var(--text-muted)'}">Prazo: até ${fmtDataSimples(prazoFinal.toISOString().slice(0,10))} (${form.prazoEntregaDia} dias úteis)${atrasado ? ' — atrasado' : ''}</span>`;
    }

    const podeAbrirCard = !jaPreenchido || foiLiberado;
    return `
      <div class="form-card ${foiLiberado ? 'pendente' : jaPreenchido ? 'preenchido' : 'pendente'}" ${podeAbrirCard ? `onclick="abrirFormulario('${assoc.id}')" style="cursor:pointer"` : 'style="cursor:default"'}>
        <div class="form-card-top">
          <div>
            <h4>${fornecedor ? fornecedor.nome : 'Fornecedor a definir'}</h4>
            <p>${form.nome} · ${MESES[mesAtual]} de ${anoAtual}${refLabel ? ` · ref. ${refLabel}` : ''}</p>
            ${camposLinha || prazoLinha ? `<p style="margin-top:4px; font-size:11px; color:var(--text-muted)">${[camposLinha, prazoLinha].filter(Boolean).join(' &nbsp;·&nbsp; ')}</p>` : ''}
          </div>
          <span class="form-card-status ${foiLiberado ? 'pending' : jaPreenchido ? 'ok' : 'pending'}">${foiLiberado ? 'Reenviar' : jaPreenchido ? 'Enviado' : 'Pendente'}</span>
        </div>
        ${jaPreenchido ? `<div style="margin-top:10px; font-size:12px; color:var(--text-muted)">${avaliacoesDoMes.length > 1 ? `${avaliacoesDoMes.length} atendimentos avaliados · ` : ''}Nota mais recente: <b style="color:var(--text)">${jaPreenchido.nota !== null ? jaPreenchido.nota.toFixed(1) : '—'}</b> · enviado em ${fmtData(jaPreenchido.enviadoEm)}</div>` : `<div style="margin-top:10px; font-size:12px; color:var(--text-muted)">Setor: ${form.setor}${form.descricaoAvaliado ? ` · ${escapeHtml(form.descricaoAvaliado)}` : ''}</div>`}
        ${jaPreenchido && !foiLiberado ? `<div style="margin-top:10px"><button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); abrirFormulario('${assoc.id}', true)">+ Avaliar outro atendimento</button></div>` : ''}
      </div>
    `;
  }).join('');
}

function abrirFormulario(assocId, forcarNovo) {
  const d = db();
  const assoc = d.associacoes.find(a => a.id === assocId);
  const form = d.formularios.find(f => f.id === assoc.formularioId);
  const fornecedor = assoc.fornecedorId ? d.fornecedores.find(fn => fn.id === assoc.fornecedorId) : null;
  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();
  const chaveMes = `${anoAtual}-${mesAtual}`;

  const encontrada = d.avaliacoes
    .filter(av => av.formularioId === form.id && av.fornecedorId === assoc.fornecedorId && av.usuarioId === currentUser.id && av.periodo === chaveMes)
    .sort((a, b) => new Date(b.enviadoEm) - new Date(a.enviadoEm))[0] || null;
  // forcarNovo = "Avaliar outro atendimento": ignora o que já existe, abre em branco,
  // e o envio vira um registro NOVO (não sobrescreve o atendimento anterior).
  const existente = forcarNovo ? null : encontrada;
  // Se admin liberou edição, tratar como "não enviado" visualmente
  const liberado = existente && existente.liberadoEdicao;
  const travado = existente && existente.travado && !liberado;

  const wrap = document.getElementById('av-page-formularios');
  wrap.innerHTML = `
    <div class="page-header">
      <div>
        <h2>${form.nome}</h2>
        <p>${fornecedor ? fornecedor.nome + ' · ' : ''}${MESES[mesAtual]} de ${anoAtual}${mesReferenciaLabel(chaveMes, d.periodoAvaliadoMesesAntes) ? ` · referente ao serviço prestado em ${mesReferenciaLabel(chaveMes, d.periodoAvaliadoMesesAntes)}` : ''}${forcarNovo ? ' · novo atendimento' : ''}</p>
        ${form.descricaoAvaliado ? `<p style="font-size:12px; color:var(--text-muted); margin-top:2px">${escapeHtml(form.descricaoAvaliado)}</p>` : ''}
      </div>
      <button class="btn btn-secondary btn-sm" onclick="renderAvFormularios()">← Voltar</button>
    </div>
    ${travado ? `
      <div class="lock-banner">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        Esta avaliação já foi enviada e está travada para edição. Apenas o administrador pode liberar uma nova edição.
      </div>` : ''}
    ${liberado ? `
      <div class="alert alert-info" style="display:flex; align-items:center; gap:8px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        Edição liberada pelo administrador. Revise as respostas e reenvie o formulário.
      </div>` : ''}
    <div id="form-fill-wrap"></div>
  `;

  // Se liberado, passa como existente para pré-preencher mas travado=false para editar
  renderFormFill(form, fornecedor, assoc, existente, travado, chaveMes);
}

function renderFormFill(form, fornecedor, assoc, existente, travado, chaveMes) {
  const respostasIniciais = existente ? existente.respostas : {};
  window._formAtual = { form, fornecedor, assoc, existente, chaveMes, respostas: JSON.parse(JSON.stringify(respostasIniciais)), anexos: existente ? JSON.parse(JSON.stringify(existente.anexos || [])) : [], naoHouveGeral: !!(existente && existente.semServico) };

  const wrap = document.getElementById('form-fill-wrap');

  // Campos institucionais do formulário
  const camposLinha = (form.camposExtras && form.camposExtras.length)
    ? form.camposExtras.filter(c => c.valor).map(c => `<span><b style="font-weight:600">${c.label}:</b> ${c.valor}</span>`).join(' &nbsp;·&nbsp; ')
    : '';

  wrap.innerHTML = `
    <div class="card">
      ${camposLinha ? `<div style="padding:10px 14px; background:var(--surface2); border-radius:8px; margin-bottom:14px; font-size:12px; color:var(--text-sec); display:flex; flex-wrap:wrap; gap:12px">${camposLinha}</div>` : ''}
      <div id="criterios-wrap" style="${existente && existente.semServico ? 'opacity:.4; pointer-events:none' : ''}">
        ${form.criterios.map(crit => {
          const resp = respostasIniciais[crit.id];
          return `
          <div class="criterio-block">
            <div class="criterio-header">
              <span class="criterio-nome">${crit.nome}</span>
              <span class="criterio-peso">até ${crit.pesoMax.toFixed(1)}P</span>
            </div>
            ${crit.opcoes.map((op, i) => `
              <label class="opcao-row ${resp && resp.opcaoIndex === i && !resp.naoHouve ? 'selected' : ''}" onclick="selecionarOpcao('${crit.id}', ${i}, this)">
                <input type="radio" name="crit-${crit.id}" ${resp && resp.opcaoIndex === i && !resp.naoHouve ? 'checked' : ''} ${travado ? 'disabled' : ''}>
                <span class="opcao-label">${op.label}</span>
                <span class="opcao-pontos">${op.pontos.toFixed(1)}P</span>
              </label>
            `).join('')}
          </div>`;
        }).join('')}
      </div>

      <div class="nota-preview">
        <span class="nota-preview-label">Nota calculada</span>
        <span class="nota-preview-value" id="nota-preview-val">${existente && existente.nota !== null ? existente.nota.toFixed(1) : '—'}</span>
      </div>

      <div class="form-group" style="margin-top:14px">
        <label>Observação (opcional)</label>
        <textarea id="obs-formulario" rows="2" ${travado ? 'disabled' : ''}>${existente ? (existente.obs || '') : ''}</textarea>
      </div>

      <div class="form-group" style="margin-top:14px">
        <label>Anexar evidências (PDF, foto, relatório)</label>
        <div class="file-drop" onclick="document.getElementById('anexo-input').click()">
          <input type="file" id="anexo-input" multiple onchange="handleAnexo(event)" ${travado ? 'disabled' : ''}>
          <p style="font-size:12px; color:var(--text-muted)">Clique para selecionar arquivos</p>
        </div>
        <div id="anexos-lista"></div>
      </div>

      <label class="opcao-row ${existente && existente.semServico ? 'selected' : ''}" style="margin-top:14px; border-top:1px dashed var(--border); padding-top:14px">
        <input type="checkbox" id="chk-nao-houve-geral" ${existente && existente.semServico ? 'checked' : ''} ${travado ? 'disabled' : ''} onchange="toggleNaoHouveGeral(this.checked, this)">
        <span class="opcao-label">Não houve atendimento/fornecimento neste mês</span>
      </label>

      <div id="justificativa-wrap"></div>

      ${!travado ? `
        <div style="display:flex; justify-content:flex-end; margin-top:18px; gap:10px">
          <button class="btn btn-primary" onclick="enviarAvaliacao()">${existente ? 'Concluir correção' : 'Concluir avaliação'}</button>
        </div>
      ` : `
        <div style="display:flex; justify-content:flex-end; margin-top:18px">
          <button class="btn btn-secondary" onclick="solicitarLiberacao()">Solicitar liberação ao admin</button>
        </div>
      `}
    </div>
  `;
  renderAnexosLista();
  updateNotaPreview();
}

function selecionarOpcao(critId, idx, el) {
  if (!window._formAtual) return;
  window._formAtual.respostas[critId] = { opcaoIndex: idx, naoHouve: false };
  el.parentElement.querySelectorAll('.opcao-row').forEach(r => r.classList.remove('selected'));
  el.classList.add('selected');
  updateNotaPreview();
}

function selecionarNaoHouve(critId, el) {
  if (!window._formAtual) return;
  window._formAtual.respostas[critId] = { opcaoIndex: null, naoHouve: true };
  el.parentElement.querySelectorAll('.opcao-row').forEach(r => r.classList.remove('selected'));
  el.classList.add('selected');
  updateNotaPreview();
}

function updateNotaPreview() {
  const { form, respostas, naoHouveGeral } = window._formAtual;
  const result = naoHouveGeral ? { nota: null, semServico: true } : calcularNota(form, respostas);
  const el = document.getElementById('nota-preview-val');
  el.textContent = result.semServico ? 'Sem serviço' : (result.nota !== null ? result.nota.toFixed(1) : '—');

  const justWrap = document.getElementById('justificativa-wrap');
  const sit = result.semServico ? null : getSituacao(result.nota);
  if (sit === 'reprovado') {
    justWrap.innerHTML = `
      <div class="form-group" style="margin-top:14px">
        <label style="color:var(--danger)">Melhoria esperada (obrigatório para reprovados)</label>
        <textarea id="justificativa-reprovacao" rows="3" placeholder="O que o fornecedor precisa melhorar para atingir uma nota melhor na próxima avaliação..." style="border-color:var(--danger-border)">${window._formAtual.existente && window._formAtual.existente.justificativa ? escapeHtml(window._formAtual.existente.justificativa) : ''}</textarea>
      </div>`;
  } else {
    justWrap.innerHTML = '';
  }
}

function toggleNaoHouveGeral(checked, checkboxEl) {
  window._formAtual.naoHouveGeral = checked;
  const criteriosWrap = document.getElementById('criterios-wrap');
  if (criteriosWrap) criteriosWrap.style.cssText = checked ? 'opacity:.4; pointer-events:none' : '';
  if (checkboxEl && checkboxEl.closest) {
    const linha = checkboxEl.closest('.opcao-row');
    if (linha) linha.classList.toggle('selected', checked);
  }
  updateNotaPreview();
}

function handleAnexo(e) {
  const files = Array.from(e.target.files);
  files.forEach(f => {
    // "_file" é a referência real do arquivo escolhido — só sobe pro Storage
    // quando o formulário for enviado de verdade (enviarAvaliacao).
    window._formAtual.anexos.push({ nome: f.name, tamanho: (f.size / 1024).toFixed(0) + ' KB', _file: f });
  });
  renderAnexosLista();
  e.target.value = '';
}

function renderAnexosLista() {
  const wrap = document.getElementById('anexos-lista');
  if (!wrap) return;
  wrap.innerHTML = window._formAtual.anexos.map((a, i) => `
    <div class="anexo-item" style="display:flex; align-items:center; gap:5px">
      ${ic('paperclip', 12)}<span>${a.caminhoStorage ? `<a href="#" onclick="event.preventDefault(); baixarAnexoAvaliacao('${escapeForInlineHandler(a.caminhoStorage)}', '${escapeForInlineHandler(a.nome)}')">${escapeHtml(a.nome)}</a>` : escapeHtml(a.nome)}</span>
      <span style="color:var(--text-muted)">${a.tamanho}</span>
      <button onclick="removerAnexo(${i})">remover</button>
    </div>`).join('');
}

function removerAnexo(i) {
  window._formAtual.anexos.splice(i, 1);
  renderAnexosLista();
}

async function enviarAvaliacao() {
  const { form, fornecedor, assoc, existente, chaveMes, respostas, anexos, naoHouveGeral } = window._formAtual;
  const totalCriterios = form.criterios.length;
  const respondidos = Object.keys(respostas).filter(k => respostas[k]).length;

  if (!naoHouveGeral && respondidos < totalCriterios) {
    toast('Preencha todos os critérios antes de enviar.');
    return;
  }

  const result = naoHouveGeral ? { nota: null, semServico: true } : calcularNota(form, respostas);
  const sit = result.semServico ? null : getSituacao(result.nota);

  if (sit === 'reprovado') {
    const just = document.getElementById('justificativa-reprovacao').value.trim();
    if (!just) {
      toast('Indique a melhoria esperada para fornecedores reprovados.');
      return;
    }
  }

  const justificativa = sit === 'reprovado' ? document.getElementById('justificativa-reprovacao').value.trim() : '';
  const obs = document.getElementById('obs-formulario').value.trim();

  // Sobe pro Storage só os anexos NOVOS (que ainda têm o File em memória, "_file").
  // Os que já tinham caminhoStorage (de um envio anterior sendo corrigido) ficam como estão.
  const anexosFinal = [];
  for (const a of anexos) {
    if (!a._file) { anexosFinal.push({ nome: a.nome, tamanho: a.tamanho, caminhoStorage: a.caminhoStorage || null }); continue; }

    const nomeSeguro = sanitizarNomeArquivo(a.nome);
    const caminho = `${currentUser.empresaId}/${currentUser.id}/${Date.now()}_${nomeSeguro}`;
    try {
      await r2Upload(caminho, a._file);
    } catch (uploadErr) { toast('Erro ao enviar anexo "' + a.nome + '": ' + uploadErr.message); return; }
    anexosFinal.push({ nome: a.nome, tamanho: a.tamanho, caminhoStorage: caminho });
  }

  const payload = {
    formulario_id: form.id,
    // Congela a estrutura do formulário no momento do envio. A partir daqui,
    // editar ou arquivar o formulário "form" original não muda mais nada
    // nesta avaliação — ela sempre vai reler estes dados aqui, não a tabela
    // "formularios" ao vivo.
    formulario_snapshot: {
      nome: form.nome,
      setor: form.setor,
      criterios: form.criterios,
      descricaoAvaliado: form.descricaoAvaliado || null,
    },
    fornecedor_id: assoc.fornecedorId,
    usuario_id: currentUser.id,
    periodo: chaveMes,
    respostas,
    nota_media: result.semServico ? null : result.nota,
    sem_servico: result.semServico,
    situacao: sit,
    anexos: anexosFinal,
    obs,
    justificativa,
    enviado_em: new Date().toISOString(),
    enviado_por_email: currentUser.email,
    enviado_por_nome: currentUser.responsavel || currentUser.nome,
    bloqueada: true,
    liberado_edicao: false,
  };

  // Só REESCREVE a mesma avaliação se ela existia E o admin liberou a edição
  // (correção de um envio). Qualquer outro caso — inclusive "avaliar outro
  // atendimento" com um envio já travado no mês — cria uma linha NOVA, que
  // entra na média junto com as demais do período.
  let error, avaliacaoIdSalva;
  if (existente && existente.liberadoEdicao) {
    ({ error } = await supabaseClient.from('avaliacoes').update(payload).eq('id', existente.id));
    avaliacaoIdSalva = existente.id;
  } else {
    const { data: inserida, error: erroInsert } = await supabaseClient.from('avaliacoes').insert({ ...payload, empresa_id: currentUser.empresaId }).select('id').single();
    error = erroInsert;
    avaliacaoIdSalva = inserida ? inserida.id : null;
  }

  if (error) { toast('Erro ao enviar avaliação: ' + error.message); return; }

  addLog('avaliacao_enviada', `${currentUser.email} enviou avaliação do formulário "${form.nome}" (${MESES[parseInt(chaveMes.split('-')[1])]}/${chaveMes.split('-')[0]}) — nota: ${result.semServico ? 'sem serviço' : result.nota.toFixed(1)}`);

  // Se a empresa estiver em "Automático" + "No momento" (0h), tenta disparar
  // o e-mail pro fornecedor JÁ — sem esperar o cron de hora em hora. Disparo
  // silencioso: a function confere de novo no servidor se a config bate
  // (não confia no que o front manda), e se não bater, não faz nada e não
  // mostra erro nenhum pro avaliador — a maioria das empresas não usa esse
  // modo, então isso "não bater" é o caso normal, não uma falha.
  if (avaliacaoIdSalva && (sit === 'reprovado' || sit === 'parcial')) {
    supabaseClient.functions.invoke('enviar-avaliacao-html', { body: { avaliacaoId: avaliacaoIdSalva, instantaneo: true } }).catch(() => {});
  }

  await carregarAvaliacoes();
  renderAvFormularios();
  atualizarBadgeNotificacoesAvaliador();

  // Só pede pra clicar em "Enviar notificação" quando essa era a ÚLTIMA
  // avaliação pendente do mês — evita o avaliador ficar clicando o botão
  // a cada formulário enviado. Se ele não enviar mesmo assim, o cron de
  // varredura notifica o admin sozinho depois; isso aqui é só um empurrão
  // de UX, não é a única garantia de que o admin é avisado.
  const { pendentes } = contarPendentesAvaliador(db(), currentUser.id);
  if (pendentes === 0) {
    mostrarSucesso('Última avaliação enviada! Clique em "Enviar notificação" para avisar o admin.', 2600);
  } else {
    mostrarSucesso('Avaliação concluída!');
  }
}

async function notificarAvaliacoesConcluidas() {
  toast('Enviando notificação...');
  const { data, error } = await supabaseClient.functions.invoke('notificar-avaliacoes-lote', { body: {} });

  if (error || (data && data.ok === false)) {
    toast((data && data.error) || 'Não foi possível notificar agora. Tenta de novo em instantes.');
    return;
  }

  if (data.avaliadoresNotificados > 0) {
    toast('Notificação enviada pro admin!');
  } else {
    toast('Nada pendente pra notificar (ou nenhum admin marcado pra receber).');
  }

  await carregarAvaliacoes();
  renderAvFormularios();
}

function solicitarLiberacao() {
  addLog('solicitacao_liberacao', `${currentUser.email} solicitou liberação de edição para reabrir uma avaliação travada`);
  toast('Solicitação registrada. Avise o administrador para liberar a edição.');
}

function renderAvHistorico() {
  const d = db();
  const anoSel = document.getElementById('hist-filtro-ano');
  const mesSel = document.getElementById('hist-filtro-mes');
  const anoFiltro = anoSel ? anoSel.value : '';
  const mesFiltro = mesSel ? mesSel.value : '';

  const todasMinhas = d.avaliacoes.filter(av => av.usuarioId === currentUser.id);
  const anosDisponiveis = [...new Set(todasMinhas.map(av => av.periodo.split('-')[0]))].sort().reverse();

  let minhasAvaliacoes = todasMinhas;
  if (anoFiltro) minhasAvaliacoes = minhasAvaliacoes.filter(av => av.periodo.split('-')[0] === anoFiltro);
  if (mesFiltro) minhasAvaliacoes = minhasAvaliacoes.filter(av => av.periodo.split('-')[1] === mesFiltro);
  minhasAvaliacoes = minhasAvaliacoes.sort((a,b) => new Date(b.enviadoEm) - new Date(a.enviadoEm));

  const wrap = document.getElementById('av-page-historico');

  wrap.innerHTML = `
    <div class="page-header"><div><h2>Histórico de envios</h2><p>Todas as avaliações que você enviou</p></div></div>
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex; gap:10px; flex-wrap:wrap">
        <div class="form-group" style="margin:0; min-width:120px">
          <label>Ano</label>
          <select id="hist-filtro-ano" onchange="renderAvHistorico()">
            <option value="">Todos</option>
            ${anosDisponiveis.map(a => `<option value="${a}" ${a === anoFiltro ? 'selected' : ''}>${a}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0; min-width:150px">
          <label>Mês</label>
          <select id="hist-filtro-mes" onchange="renderAvHistorico()">
            <option value="">Todos</option>
            ${MESES.map((m, i) => i > 0 ? `<option value="${i}" ${String(i) === mesFiltro ? 'selected' : ''}>${m}</option>` : '').join('')}
          </select>
        </div>
      </div>
    </div>
    <div class="card">
      ${!minhasAvaliacoes.length ? '<div class="empty-state"><p>Nenhuma avaliação encontrada para esse período.</p></div>' : `
      <div style="overflow-x:auto">
      <table>
        <thead><tr><th>Formulário</th><th>Período</th><th style="text-align:center">Nota</th><th>Situação</th><th>Enviado em</th><th></th></tr></thead>
        <tbody>
          ${minhasAvaliacoes.map(av => {
            const form = d.formularios.find(f => f.id === av.formularioId);
            const [ano, mes] = av.periodo.split('-');
            const sit = situacaoDe(av);
            const temAnexo = (av.anexos && av.anexos.length) || av.planoAcaoAnexo;
            return `<tr style="cursor:pointer" onclick="verDetalheAvaliacao('${av.id}')">
              <td style="font-weight:500">${form ? form.nome : '—'}</td>
              <td>${MESES[parseInt(mes)]}/${ano}</td>
              <td style="text-align:center; font-weight:600">${av.semServico ? '—' : av.nota.toFixed(1)}</td>
              <td>${av.semServico ? '<span class="badge badge-neutral">Sem serviço</span>' : badgeSit(sit)}</td>
              <td style="color:var(--text-muted)">${fmtData(av.enviadoEm)}</td>
              <td>${temAnexo ? `<button class="btn btn-secondary btn-sm" title="Ver anexos" onclick="event.stopPropagation(); abrirPopupAnexos('${av.id}')" style="display:inline-flex; align-items:center; padding:5px 7px">${ic('paperclip', 14)}</button>` : ''}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      </div>`}
    </div>
  `;
}

// ---------- POPUP DE ANEXOS (histórico do avaliador) ----------
// Fica separado do modal grande de verDetalheAvaliacao (que continua
// mostrando tudo) — esse aqui é só um atalho rápido pros arquivos, com
// preview inline pra PDF/imagem (sem forçar download).
let _blobUrlAtualPreview = null;

function extensaoArquivo(nome) {
  const m = (nome || '').match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : '';
}

function tipoPreviewSuportado(nome) {
  return ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extensaoArquivo(nome));
}

function abrirPopupAnexos(avId) {
  const d = db();
  const av = d.avaliacoes.find(a => a.id === avId);
  if (!av) return;

  const anexos = av.anexos || [];
  const plano = av.planoAcaoAnexo;

  const itemHtml = a => `
    <div class="anexo-item" style="display:flex; align-items:center; gap:6px; padding:8px 0; border-bottom:1px solid var(--border)">
      ${ic('paperclip', 13)}
      <a href="#" onclick="event.preventDefault(); visualizarAnexoPopup('${escapeForInlineHandler(a.caminhoStorage)}', '${escapeForInlineHandler(a.nome)}')" style="flex:1">${escapeHtml(a.nome)}</a>
      ${a.tamanho ? `<span style="color:var(--text-muted); font-size:11px">${a.tamanho}</span>` : ''}
    </div>`;

  openModal(`
    <h3>Anexos</h3>
    <div style="margin-bottom:${plano ? '18px' : '0'}">
      <b style="font-size:12px">Anexos da avaliação (${anexos.length})</b>
      ${anexos.length ? anexos.map(itemHtml).join('') : '<p style="font-size:12px; color:var(--text-muted); margin-top:6px">Nenhum anexo enviado.</p>'}
    </div>
    ${plano ? `
      <div>
        <b style="font-size:12px">Plano de ação do fornecedor</b>
        ${itemHtml(plano)}
        <p style="font-size:11px; color:var(--text-muted); margin-top:2px">Enviado em ${fmtData(plano.enviadoEm)}</p>
      </div>` : ''}
    <div style="display:flex; justify-content:flex-end; margin-top:16px">
      <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    </div>
  `);
}

async function visualizarAnexoPopup(caminhoStorage, nomeArquivo) {
  if (!caminhoStorage) return;

  if (!tipoPreviewSuportado(nomeArquivo)) {
    // Tipo sem preview possível no navegador (ex: docx, xlsx) — baixa direto.
    try { await r2Baixar(caminhoStorage, nomeArquivo); }
    catch (error) { toast('Erro ao abrir anexo: ' + error.message); }
    return;
  }

  openModal(`<div class="empty-state"><p>Carregando...</p></div>`);

  try {
    if (_blobUrlAtualPreview) { URL.revokeObjectURL(_blobUrlAtualPreview); _blobUrlAtualPreview = null; }
    const blobUrl = await r2Visualizar(caminhoStorage);
    _blobUrlAtualPreview = blobUrl;
    const ehImagem = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extensaoArquivo(nomeArquivo));

    openModal(`
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; gap:10px">
        <h3 style="margin:0; font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${escapeHtml(nomeArquivo)}</h3>
        <button class="btn btn-secondary btn-sm" onclick="closeModal()">Fechar</button>
      </div>
      ${ehImagem
        ? `<img src="${blobUrl}" style="max-width:100%; max-height:70vh; display:block; margin:0 auto; border-radius:8px">`
        : `<iframe src="${blobUrl}" style="width:100%; height:70vh; border:none; border-radius:8px"></iframe>`}
    `);
  } catch (error) {
    toast('Erro ao abrir anexo: ' + error.message);
    closeModal();
  }
}
let _abaAvaliarProduto = 'avaliar';

function renderAdAvaliar() {
  document.getElementById('ad-page-avaliar').innerHTML = `
    <div class="page-header"><div><h2>Avaliar</h2><p>Escolha o tipo de avaliação.</p></div></div>
    <div style="display:flex; gap:16px; flex-wrap:wrap; margin-bottom:20px">
      <div class="card" style="flex:1; min-width:220px">
        <div class="card-title" style="display:flex; align-items:center; gap:7px">${ic('folder', 16)}Produto</div>
        <p style="font-size:12px; color:var(--text-muted)">Lançamento por nota fiscal — critérios com peso, conceito por faixa.</p>
      </div>
      <div class="card" style="flex:1; min-width:220px; cursor:pointer" onclick="irParaAvaliacaoServico()">
        <div class="card-title" style="display:flex; align-items:center; gap:7px">${ic('users', 16)}Serviço</div>
        <p style="font-size:12px; color:var(--text-muted)">Preenchido pelos setores (avaliadores). Configure quem avalia o quê em Associações →</p>
      </div>
    </div>
    <div class="tab-bar">
      <button class="tab ${_abaAvaliarProduto === 'avaliar' ? 'active' : ''}" onclick="mudarAbaAvaliarProduto('avaliar', this)">Avaliar Fornecedor</button>
      <button class="tab ${_abaAvaliarProduto === 'criterios' ? 'active' : ''}" onclick="mudarAbaAvaliarProduto('criterios', this)">Critérios</button>
      <button class="tab ${_abaAvaliarProduto === 'faixas' ? 'active' : ''}" onclick="mudarAbaAvaliarProduto('faixas', this)">Faixas de conceito</button>
    </div>
    <div id="avaliar-produto-tab"></div>
  `;
  renderAbaAvaliarProdutoAtual();
}

function renderAbaAvaliarProdutoAtual() {
  if (_abaAvaliarProduto === 'avaliar') renderAvaliarProdutoTab();
  else if (_abaAvaliarProduto === 'criterios') renderCriteriosProdutoTab();
  else renderFaixasConceitoTab();
}

function mudarAbaAvaliarProduto(aba, btn) {
  _abaAvaliarProduto = aba;
  document.querySelectorAll('#ad-page-avaliar .tab-bar .tab').forEach(el => el.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderAbaAvaliarProdutoAtual();
}

function irParaAvaliacaoServico() {
  showAdPage('formularios');
  showFormTabAd('associar', document.getElementById('tab-btn-associar'));
}

// ---- Cálculo de nota/conceito de produto ----
function calcularNotaGeralProduto(notasPorCriterio, criterios) {
  let somaPonderada = 0, somaPesos = 0;
  criterios.forEach(c => {
    const nota = notasPorCriterio[c.id];
    if (nota === undefined || nota === null || nota === '') return;
    somaPonderada += parseFloat(nota) * c.peso;
    somaPesos += c.peso;
  });
  if (somaPesos === 0) return null;
  return somaPonderada / somaPesos;
}

function getConceitoPorFaixa(nota, faixas) {
  if (nota === null) return null;
  const faixa = faixas.find(f => nota >= f.de && nota <= f.ate) || faixas[faixas.length - 1];
  return faixa || null;
}

// ---- Avaliar fornecedor (lançamento) + Fornecedores avaliados (histórico), empilhados ----
function renderAvaliarProdutoTab() {
  const d = db();
  const wrap = document.getElementById('avaliar-produto-tab');
  const criteriosAtivos = d.criteriosProduto.filter(c => c.ativo);

  if (!criteriosAtivos.length) {
    wrap.innerHTML = `<div class="empty-state"><p>Cadastre ao menos um critério ativo na aba "Critérios" antes de avaliar um fornecedor.</p></div>`;
    return;
  }

  // Estado do fornecedor sendo avaliado nesse lançamento — não é salvo em
  // lugar nenhum até "Salvar lançamento" ser clicado.
  window._fornecedorLancamento = { id: null, cnpj: '', novo: false };
  window._conferenciaVinculada = null;

  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();
  const fornecedoresProdutoTodos = d.fornecedores.filter(f => f.tipo === 'produto' || f.tipo === 'ambos');

  wrap.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="card-title">Avaliar fornecedor</div>
      <div class="form-row three">
        <div class="form-group">
          <label>CNPJ do fornecedor</label>
          <div style="display:flex; gap:6px">
            <input type="text" id="lp-cnpj" placeholder="00.000.000/0000-00" oninput="this.value = formatarCNPJ(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault(); buscarFornecedorPorCnpj();}" style="flex:1">
            <button type="button" class="btn btn-secondary btn-sm" onclick="buscarFornecedorPorCnpj()" style="display:inline-flex; align-items:center; gap:6px">${ic('search', 13)}Buscar</button>
          </div>
        </div>
        <div class="form-group">
          <label>Nome do fornecedor</label>
          <input type="text" id="lp-nome-fornecedor" placeholder="Busque o CNPJ primeiro" disabled>
          <div id="lp-status-fornecedor" style="margin-top:6px; font-size:11px"></div>
        </div>
        <div class="form-group"><label>Nº da Nota Fiscal</label><input type="text" id="lp-nf" placeholder="Ex: 117743" onblur="aplicarConferenciaVinculada()"></div>
        <div class="form-group"><label>Data</label><input type="date" id="lp-data" value="${hoje.toISOString().slice(0,10)}"></div>
      </div>
      <div id="lp-conferencia-info"></div>
      <div class="form-row three" style="margin-top:10px">
      </div>
      <p style="font-size:12px; font-weight:600; color:var(--text-sec); margin:14px 0 8px">Notas (0 a 10)</p>
      <div id="lp-criterios-regua">
        ${criteriosAtivos.filter(c => c.opcoes && c.opcoes.length).map(c => `
          <div class="form-group lp-select-wrap" style="position:relative">
            <label>${c.nome} <span style="color:var(--text-muted); font-weight:400">(peso ${c.peso})</span> <span id="lp-conf-icone-${c.id}"></span></label>
            <input type="hidden" class="lp-nota-input" data-criterio-id="${c.id}" data-criterio-nome="${c.nome}" data-peso="${c.peso}" value="">
            <textarea class="lp-motivo-input" data-criterio-id="${c.id}" style="display:none"></textarea>
            <div id="lp-select-closed-${c.id}" onclick="toggleLpSelectDropdown('${c.id}')" style="border:1px solid var(--border); border-radius:8px; padding:10px 12px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; gap:8px; background:var(--surface)">
              <span id="lp-select-label-${c.id}" style="color:var(--text-muted)">Selecione uma opção</span>
              <span style="color:var(--text-muted)">▾</span>
            </div>
            <div id="lp-select-dropdown-${c.id}" style="display:none; position:absolute; top:100%; left:0; right:0; z-index:20; background:var(--surface); border:1px solid var(--border); border-radius:8px; margin-top:4px; max-height:260px; overflow-y:auto; box-shadow:0 6px 18px rgba(0,0,0,.18)">
              ${c.opcoes.map((op, i) => `
                <div class="lp-select-opcao" onclick="selecionarOpcaoCriterioProduto('${c.id}', ${i})" style="padding:10px 12px; cursor:pointer; display:flex; justify-content:space-between; gap:10px; border-bottom:1px solid var(--border)">
                  <span>${op.label}</span><span style="font-weight:600; white-space:nowrap">${op.pontos}P</span>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
      <div class="form-row three" id="lp-criterios">
        ${criteriosAtivos.filter(c => !(c.opcoes && c.opcoes.length)).map(c => `
          <div class="form-group">
            <label>${c.nome} <span style="color:var(--text-muted); font-weight:400">(peso ${c.peso})</span> <span id="lp-conf-icone-${c.id}"></span></label>
            <input type="number" min="0" max="${c.peso}" step="0.5" class="lp-nota-input" data-criterio-id="${c.id}" data-criterio-nome="${c.nome}" data-peso="${c.peso}" oninput="verificarNotaProdutoLimites(this); atualizarPreviaNotaProduto()">
            <div id="lp-nota-msg-${c.id}" style="font-size:11px; margin-top:4px"></div>
            <div id="lp-motivo-wrap-${c.id}"></div>
          </div>
        `).join('')}
      </div>
      <div id="lp-previa" style="margin-top:10px; padding:10px 14px; background:var(--surface2); border-radius:8px; font-size:13px; display:none"></div>
      <div id="lp-justificativa-wrap"></div>
      <button class="btn btn-primary" style="margin-top:16px" onclick="salvarAvaliacaoProduto()">Salvar lançamento</button>
    </div>
    <div class="card">
      <div class="card-title">Fornecedores avaliados</div>
      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:14px">
        <div class="form-group" style="margin:0; min-width:200px"><label>Fornecedor</label>
          <select id="hp-fornecedor" onchange="renderFornecedoresAvaliadosBloco()">
            <option value="">Todos</option>
            ${fornecedoresProdutoTodos.map(f => `<option value="${f.id}">${f.nome}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0; min-width:150px"><label>Mês</label>
          <select id="hp-mes" onchange="renderFornecedoresAvaliadosBloco()">${MESES.map((m,i) => i>0?`<option value="${i}" ${i===mesAtual?'selected':''}>${m}</option>`:'').join('')}</select>
        </div>
        <div class="form-group" style="margin:0; min-width:110px"><label>Ano</label>
          <select id="hp-ano" onchange="renderFornecedoresAvaliadosBloco()">${[anoAtual, anoAtual-1].map(a => `<option value="${a}" ${a===anoAtual?'selected':''}>${a}</option>`).join('')}</select>
        </div>
      </div>
      <div id="hp-resultado"></div>
    </div>
  `;
  renderFornecedoresAvaliadosBloco();
}

function renderFornecedoresAvaliadosBloco() {
  const fSel = document.getElementById('hp-fornecedor');
  const mSel = document.getElementById('hp-mes');
  const aSel = document.getElementById('hp-ano');
  renderResultadoHistoricoProduto(fSel.value, parseInt(mSel.value), aSel.value);
}

// Busca o fornecedor pelo CNPJ: primeiro no seu próprio cadastro (evita
// duplicar); se não achar, consulta uma API pública (OpenCNPJ, com a
// BrasilAPI como reserva) só pra preencher o nome — nada é salvo agora,
// só quando "Salvar lançamento" for clicado.
async function buscarFornecedorPorCnpj() {
  const cnpjInput = document.getElementById('lp-cnpj');
  const cnpjLimpo = cnpjInput.value.replace(/\D/g, '');
  const nomeInput = document.getElementById('lp-nome-fornecedor');
  const statusEl = document.getElementById('lp-status-fornecedor');

  if (cnpjLimpo.length !== 14) { toast('CNPJ inválido — precisa ter 14 dígitos.'); return; }

  const d = db();
  const existente = d.fornecedores.find(f => (f.cnpj || '').replace(/\D/g, '') === cnpjLimpo);
  if (existente) {
    window._fornecedorLancamento = { id: existente.id, cnpj: cnpjLimpo, novo: false };
    nomeInput.value = existente.nome;
    nomeInput.disabled = true;
    const vencido = fornecedorTemDocumentoVencido(existente.id);
    const avisoVencido = vencido
      ? (d.descontoDocVencidoAtivo
          ? ` &nbsp;<span style="color:var(--danger); font-weight:600; display:inline-flex; align-items:center; gap:4px">${ic('alertTriangle', 13)}Documentação vencida (-${d.valorDescontoDocVencido} ponto(s))</span>`
          : ` &nbsp;<span style="color:var(--danger); font-weight:600; display:inline-flex; align-items:center; gap:4px">${ic('alertTriangle', 13)}Documentação vencida</span>`)
      : '';
    statusEl.innerHTML = '<span style="color:var(--accent); font-weight:600; display:inline-flex; align-items:center; gap:4px">' + ic('check', 13) + 'Já cadastrado</span>' + avisoVencido;
    atualizarPreviaNotaProduto();
    return;
  }

  statusEl.innerHTML = '<span style="color:var(--text-muted)">Buscando...</span>';
  nomeInput.disabled = false;
  nomeInput.value = '';

  let nomeEncontrado = null;
  try {
    const r = await fetch(`https://api.opencnpj.org/${cnpjLimpo}`);
    if (r.ok) {
      const j = await r.json();
      nomeEncontrado = j.razao_social || j.nome_fantasia || null;
    }
  } catch (e) { /* segue pra reserva abaixo */ }

  if (!nomeEncontrado) {
    try {
      const r2 = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
      if (r2.ok) {
        const j2 = await r2.json();
        nomeEncontrado = j2.razao_social || j2.nome_fantasia || null;
      }
    } catch (e) { /* segue sem achar — admin digita na mão */ }
  }

  window._fornecedorLancamento = { id: null, cnpj: cnpjLimpo, novo: true };
  nomeInput.value = nomeEncontrado || '';
  statusEl.innerHTML = nomeEncontrado
    ? '<span style="color:var(--success); font-weight:600; display:inline-flex; align-items:center; gap:6px"><span style="width:8px; height:8px; border-radius:50%; background:var(--success); flex-shrink:0"></span>Novo — será cadastrado ao salvar</span>'
    : '<span style="color:var(--warn); font-weight:600; display:inline-flex; align-items:center; gap:6px"><span style="width:8px; height:8px; border-radius:50%; background:var(--warn); flex-shrink:0"></span>Novo — não achamos os dados automaticamente, digite o nome</span>';
  atualizarPreviaNotaProduto();
}

// Busca (por NF + fornecedor) se existe uma conferência lançada pra essa
// nota fiscal e, se existir: trava/preenche os campos de nota (0-10) cujo
// nome bate com um critério da conferência, e guarda o desconto total pra
// somar na nota final. Opcional e aditivo — se não achar nada, não muda
// nada (os campos voltam a ficar livres, caso a NF tenha sido trocada).
// Compara nomes de critério ignorando maiúscula/minúscula, acentos e
// espaços nas pontas — "Transportadora", "transportadora " e "Transportadóra"
// contam como o mesmo nome pra fins de vínculo automático.
function normalizarNomeCriterio(nome) {
  return (nome || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Roda a cada tecla digitada num campo de nota do Avaliar Produto:
// - acima do peso do critério: barra o valor visualmente (borda vermelha + aviso)
// - abaixo do peso (e o campo NÃO veio travado da Conferência): pede motivo
//   obrigatório ali mesmo, porque foi quem lançou a NF que avaliou esse critério
// - abaixo do peso E o campo veio travado da Conferência: o motivo já foi
//   escrito lá, não pede de novo (fica só a exibição via o ícone de aviso)
// Critério de Produto com régua: campo fechado que abre uma listinha ao
// clicar (em vez de mostrar todas as opções já expandidas na tela). Clicar
// numa opção preenche o input escondido de nota (mesmo formato que o campo
// livre) e, se a opção não for a nota máxima, guarda o próprio texto da
// opção como motivo — sem precisar digitar nada.
function toggleLpSelectDropdown(critId) {
  const dropdown = document.getElementById(`lp-select-dropdown-${critId}`);
  if (!dropdown) return;
  const abrindo = dropdown.style.display === 'none';
  fecharTodosLpSelectDropdowns();
  if (abrindo) dropdown.style.display = 'block';
}

function fecharTodosLpSelectDropdowns() {
  document.querySelectorAll('[id^="lp-select-dropdown-"]').forEach(el => el.style.display = 'none');
}

if (!window._lpSelectOutsideClickBound) {
  window._lpSelectOutsideClickBound = true;
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.lp-select-wrap')) fecharTodosLpSelectDropdowns();
  });
}

function selecionarOpcaoCriterioProduto(critId, idx) {
  const d = db();
  const c = d.criteriosProduto.find(x => x.id === critId);
  if (!c) return;
  const op = c.opcoes[idx];
  const notaInp = document.querySelector(`.lp-nota-input[data-criterio-id="${critId}"]`);
  const motivoInp = document.querySelector(`.lp-motivo-input[data-criterio-id="${critId}"]`);
  const labelEl = document.getElementById(`lp-select-label-${critId}`);
  if (!notaInp) return;

  notaInp.value = op.pontos;
  if (motivoInp) motivoInp.value = op.pontos < c.peso ? op.label : '';
  if (labelEl) { labelEl.textContent = `${op.label} (${op.pontos}P)`; labelEl.style.color = 'var(--text)'; }

  fecharTodosLpSelectDropdowns();
  atualizarPreviaNotaProduto();
}

function verificarNotaProdutoLimites(inp) {
  const critId = inp.dataset.criterioId;
  const peso = parseFloat(inp.dataset.peso);
  const msgEl = document.getElementById(`lp-nota-msg-${critId}`);
  const motivoWrap = document.getElementById(`lp-motivo-wrap-${critId}`);

  if (inp.value === '') {
    inp.classList.remove('input-erro');
    if (msgEl) msgEl.innerHTML = '';
    if (motivoWrap && !inp.dataset.travadoConferencia) motivoWrap.innerHTML = '';
    return;
  }

  const val = parseFloat(inp.value);

  if (val > peso) {
    inp.classList.add('input-erro');
    if (msgEl) msgEl.innerHTML = `<span style="color:var(--danger)">Valor máximo para este critério: ${peso}</span>`;
    if (motivoWrap && !inp.dataset.travadoConferencia) motivoWrap.innerHTML = '';
    return;
  }

  inp.classList.remove('input-erro');
  if (msgEl) msgEl.innerHTML = '';

  // Campo travado pela Conferência: o motivo (se houver) já veio de lá,
  // exibido pelo ícone de aviso — não duplica campo de digitação aqui.
  if (inp.dataset.travadoConferencia) return;

  if (motivoWrap && val < peso) {
    if (!motivoWrap.querySelector('textarea')) {
      motivoWrap.innerHTML = `
        <div class="form-group" style="margin-top:6px">
          <label style="color:var(--danger); font-size:11px">Motivo (nota abaixo do peso máximo)</label>
          <textarea class="lp-motivo-input" data-criterio-id="${critId}" rows="2" style="border-color:var(--danger-border)" placeholder="Ex: caixas amassadas na chegada"></textarea>
        </div>`;
    }
  } else if (motivoWrap) {
    motivoWrap.innerHTML = '';
  }
}

// Ao clicar no ícone de aviso de um campo travado pela Conferência, mostra
// quem conferiu e o motivo (se a nota tiver ficado abaixo do peso lá).
// Clique de novo pra fechar. Funciona em toque também (não depende de hover).
function toggleInfoConferenciaCriterio(critId) {
  const box = document.getElementById(`lp-motivo-wrap-${critId}`);
  const inp = document.querySelector(`.lp-nota-input[data-criterio-id="${critId}"]`);
  if (!box || !inp) return;
  if (box.dataset.aberto === '1') { box.innerHTML = ''; box.dataset.aberto = '0'; return; }
  box.dataset.aberto = '1';
  box.innerHTML = `
    <div style="margin-top:6px; padding:8px 10px; background:var(--surface2); border-radius:8px; font-size:12px">
      Conferido por <b>${escapeHtml(inp.dataset.conferidoPor) || '—'}</b>${inp.dataset.motivo ? `<br>Motivo: ${escapeHtml(inp.dataset.motivo)}` : ''}
    </div>`;
}

function aplicarConferenciaVinculada() {
  const estado = window._fornecedorLancamento;
  const numeroNf = document.getElementById('lp-nf').value.trim();
  window._conferenciaVinculada = null;

  // Limpa qualquer trava anterior (ex: usuário trocou a NF depois de já ter linkado uma).
  document.querySelectorAll('.lp-nota-input').forEach(inp => {
    if (inp.dataset.travadoConferencia) {
      inp.disabled = false;
      inp.value = '';
      delete inp.dataset.travadoConferencia;
      delete inp.dataset.conferidoPor;
      delete inp.dataset.motivo;
      const critId = inp.dataset.criterioId;
      const motivoWrap = document.getElementById(`lp-motivo-wrap-${critId}`);
      if (motivoWrap) { motivoWrap.innerHTML = ''; motivoWrap.dataset.aberto = '0'; }
      // Destrava também a caixinha de régua/dropdown, se for esse o tipo de campo.
      const closedBox = document.getElementById(`lp-select-closed-${critId}`);
      const labelEl = document.getElementById(`lp-select-label-${critId}`);
      if (closedBox) {
        closedBox.onclick = () => toggleLpSelectDropdown(critId);
        closedBox.style.cursor = 'pointer';
        closedBox.style.opacity = '1';
        closedBox.style.background = 'var(--surface)';
      }
      if (labelEl) { labelEl.textContent = 'Selecione uma opção'; labelEl.style.color = 'var(--text-muted)'; }
    }
  });
  document.querySelectorAll('[id^="lp-conf-icone-"]').forEach(el => { el.innerHTML = ''; el.onclick = null; });
  const infoBox = document.getElementById('lp-conferencia-info');
  if (infoBox) infoBox.innerHTML = '';

  if (!estado || !estado.id || !numeroNf) return;
  const conferencia = buscarConferencia(estado.id, numeroNf);
  if (!conferencia) return;

  window._conferenciaVinculada = conferencia;

  conferencia.respostas.forEach(r => {
    if (r.tipo === 'nota') {
      const nomeNormalizado = normalizarNomeCriterio(r.nome);
      const inp = Array.from(document.querySelectorAll('.lp-nota-input')).find(
        el => normalizarNomeCriterio(el.dataset.criterioNome) === nomeNormalizado
      );
      if (inp) {
        inp.value = r.valor;
        inp.disabled = true;
        inp.dataset.travadoConferencia = '1';
        inp.dataset.conferidoPor = conferencia.enviadoPorEmail || '';
        inp.dataset.motivo = r.motivo || '';
        const critId = inp.dataset.criterioId;
        const motivoInpRegua = document.querySelector(`.lp-motivo-input[data-criterio-id="${critId}"]`);
        if (motivoInpRegua) motivoInpRegua.value = r.motivo || '';
        const icone = document.getElementById(`lp-conf-icone-${critId}`);
        if (icone) {
          icone.innerHTML = ic('alertTriangle', 14);
          icone.title = `Já conferido por ${conferencia.enviadoPorEmail || 'alguém do módulo Conferência'} — clique para detalhes`;
          icone.style.cursor = 'pointer';
          icone.onclick = () => toggleInfoConferenciaCriterio(critId);
        }
        // Critério com régua (lista de opções, ex: Transportadora): a nota fica
        // no input escondido, quem o usuário vê é a caixinha "lp-select-closed".
        // Trava ela também, senão o campo parece livre mesmo com a nota já presa.
        const closedBox = document.getElementById(`lp-select-closed-${critId}`);
        const labelEl = document.getElementById(`lp-select-label-${critId}`);
        if (closedBox) {
          closedBox.onclick = null;
          closedBox.style.cursor = 'not-allowed';
          closedBox.style.opacity = '0.7';
          closedBox.style.background = 'var(--surface2)';
        }
        if (labelEl) {
          labelEl.textContent = r.motivo ? `${r.motivo} (${r.valor}P)` : `${r.valor}P (já conferido)`;
          labelEl.style.color = 'var(--text)';
        }
        verificarNotaProdutoLimites(inp);
      }
    }
  });

  const infoTextos = conferencia.respostas.filter(r => r.tipo === 'texto').map(r => `${escapeHtml(r.nome)}: <b>${escapeHtml(r.valor)}</b>`);
  const infoFaixas = conferencia.respostas.filter(r => r.tipo === 'faixa').map(r =>
    `${escapeHtml(r.nome)}: <b>${r.valor}${r.unidade || ''}</b> (${r.min}-${r.max}${r.unidade || ''}) ${r.dentroFaixa ? ic('check', 12) : `${ic('alertTriangle', 12)} fora — RPNC ${escapeHtml(r.rpnc)}`}`
  );
  const infoPartes = [...infoTextos, ...infoFaixas];
  if (infoBox) {
    infoBox.innerHTML = `<div style="margin:10px 0; padding:8px 12px; background:var(--surface2); border-radius:8px; font-size:12px; display:flex; align-items:center; gap:6px; flex-wrap:wrap">
      ${ic('check', 13)} Conferência encontrada pra essa NF (por ${conferencia.enviadoPorEmail || '—'})${infoPartes.length ? ' — ' + infoPartes.join(' · ') : ''}${conferencia.descontoTotal > 0 ? ` — <span style="color:var(--danger)">desconto de ${conferencia.descontoTotal} ponto(s) será somado na nota</span>` : ''}
    </div>`;
  }
  atualizarPreviaNotaProduto();
}

function calcularDescontoExtraProduto(fornecedorId) {
  const d = db();
  const detalhe = [];
  let total = 0;
  if (d.descontoDocVencidoAtivo && fornecedorId && fornecedorTemDocumentoVencido(fornecedorId)) {
    detalhe.push({ motivo: 'Documentação vencida', valor: d.valorDescontoDocVencido });
    total += d.valorDescontoDocVencido;
  }
  if (window._conferenciaVinculada && window._conferenciaVinculada.descontoTotal > 0) {
    detalhe.push({ motivo: 'Conferência de recebimento', valor: window._conferenciaVinculada.descontoTotal });
    total += window._conferenciaVinculada.descontoTotal;
  }
  return { total, detalhe };
}

function atualizarPreviaNotaProduto() {
  const d = db();
  const criteriosAtivos = d.criteriosProduto.filter(c => c.ativo);
  const notas = {};
  document.querySelectorAll('.lp-nota-input').forEach(inp => {
    if (inp.value !== '') notas[inp.dataset.criterioId] = inp.value;
  });
  const notaBase = calcularNotaGeralProduto(notas, criteriosAtivos);
  const previa = document.getElementById('lp-previa');
  const justWrap = document.getElementById('lp-justificativa-wrap');
  if (notaBase === null) { previa.style.display = 'none'; if (justWrap) justWrap.innerHTML = ''; return; }
  const estado = window._fornecedorLancamento;
  const { total: descontoExtra } = calcularDescontoExtraProduto(estado ? estado.id : null);
  const nota = Math.max(0, notaBase - descontoExtra);
  const faixa = getConceitoPorFaixa(nota, d.faixasConceitoProduto);
  previa.style.display = 'block';
  previa.innerHTML = `Nota geral: <b>${nota.toFixed(1)}</b>${descontoExtra > 0 ? ` <span style="color:var(--text-muted); font-size:11px">(${notaBase.toFixed(1)} - ${descontoExtra} de desconto)</span>` : ''} &nbsp;·&nbsp; Conceito: <b style="color:${faixa ? faixa.cor : 'inherit'}">${faixa ? faixa.nome : '—'}</b>${(d.descontoOcorrenciaAtivo && nota < 10) ? ' <span style="color:var(--danger)">— conta como ocorrência</span>' : ''}`;

  // Conceito no pior degrau da lista de faixas (ex: "Ruim") — motivo obrigatório,
  // mesmo padrão já usado na avaliação de serviço pra "reprovado".
  if (justWrap) {
    const piorFaixa = [...d.faixasConceitoProduto].sort((a, b) => a.de - b.de)[0];
    const ehPiorFaixa = faixa && piorFaixa && faixa.nome === piorFaixa.nome;
    if (ehPiorFaixa) {
      if (!justWrap.querySelector('textarea')) {
        justWrap.innerHTML = `
          <div class="form-group" style="margin-top:14px">
            <label style="color:var(--danger)">Motivo do conceito "${faixa.nome}" (obrigatório)</label>
            <textarea id="lp-justificativa-input" rows="3" placeholder="O que precisa melhorar para uma nota melhor na próxima nota fiscal..." style="border-color:var(--danger-border)"></textarea>
          </div>`;
      }
    } else {
      justWrap.innerHTML = '';
    }
  }
}

async function salvarAvaliacaoProduto() {
  const d = db();
  const estado = window._fornecedorLancamento;
  const data = document.getElementById('lp-data').value;
  const numeroNf = document.getElementById('lp-nf').value.trim();

  if (!estado || (!estado.id && !estado.novo)) { toast('Busque o CNPJ do fornecedor antes de lançar.'); return; }
  if (!data) { toast('Informe a data.'); return; }

  let nomeFornecedor = estado.id
    ? (d.fornecedores.find(f => f.id === estado.id)?.nome || '')
    : document.getElementById('lp-nome-fornecedor').value.trim();
  if (!estado.id && !nomeFornecedor) { toast('Informe o nome do fornecedor.'); return; }

  const criteriosAtivos = d.criteriosProduto.filter(c => c.ativo);
  const notasPorCriterio = {};
  const motivosPorCriterio = {};
  let faltando = false;
  let acimaDoPeso = false;
  let motivoFaltando = false;
  document.querySelectorAll('.lp-nota-input').forEach(inp => {
    if (inp.value === '') { faltando = true; return; }
    const peso = parseFloat(inp.dataset.peso);
    const val = parseFloat(inp.value);
    if (val > peso) { acimaDoPeso = true; return; }
    notasPorCriterio[inp.dataset.criterioId] = val;

    if (val < peso) {
      if (inp.dataset.travadoConferencia) {
        // Motivo já foi escrito lá na Conferência — vem junto no dataset.
        motivosPorCriterio[inp.dataset.criterioId] = inp.dataset.motivo || '';
      } else {
        const motivoInp = document.querySelector(`.lp-motivo-input[data-criterio-id="${inp.dataset.criterioId}"]`);
        const motivo = motivoInp ? motivoInp.value.trim() : '';
        if (!motivo) { motivoFaltando = true; return; }
        motivosPorCriterio[inp.dataset.criterioId] = motivo;
      }
    }
  });
  if (faltando || !Object.keys(notasPorCriterio).length) { toast('Preencha a nota de todos os critérios.'); return; }
  if (acimaDoPeso) { toast('Tem critério com nota acima do peso máximo permitido — corrija antes de salvar.'); return; }
  if (motivoFaltando) { toast('Informe o motivo dos critérios que ficaram abaixo do peso máximo.'); return; }

  const notaBase = calcularNotaGeralProduto(notasPorCriterio, criteriosAtivos);

  // Só cadastra o fornecedor de verdade AGORA, depois de tudo validado —
  // se o admin desistisse antes disso, nada ficaria órfão no banco.
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

  // Desconto extra (doc vencido + conferência vinculada por NF+fornecedor)
  // — calculado de novo aqui (não confia só no que ficou na tela) pra
  // garantir que reflete o fornecedor/NF realmente sendo salvos agora.
  const conferenciaVinculada = buscarConferencia(fornecedorId, numeroNf);
  window._conferenciaVinculada = conferenciaVinculada;
  const { total: descontoExtra, detalhe: descontoExtraDetalhe } = calcularDescontoExtraProduto(fornecedorId);
  const notaGeral = Math.max(0, notaBase - descontoExtra);
  const faixa = getConceitoPorFaixa(notaGeral, d.faixasConceitoProduto);
  // Regra real (não é por faixa): qualquer nota fiscal que não tire 10 conta
  // como ocorrência — só desconta de fato se o interruptor estiver ligado.
  const contaOcorrencia = !!(d.descontoOcorrenciaAtivo && notaGeral < 10);

  // Se o conceito calculado for o pior da lista de faixas (ex: "Ruim"),
  // a melhoria esperada é obrigatória — mesmo padrão já usado na avaliação
  // de serviço pra "reprovado".
  const piorFaixa = [...d.faixasConceitoProduto].sort((a, b) => a.de - b.de)[0];
  const ehPiorFaixa = faixa && piorFaixa && faixa.nome === piorFaixa.nome;
  let justificativaConceito = '';
  if (ehPiorFaixa) {
    const justEl = document.getElementById('lp-justificativa-input');
    justificativaConceito = justEl ? justEl.value.trim() : '';
    if (!justificativaConceito) { toast(`Indique o motivo do conceito "${faixa.nome}" antes de salvar.`); return; }
  }

  // "Fotografia" dos critérios usados nesse lançamento — não quebra se
  // o critério for editado/excluído depois.
  const notasSnapshot = criteriosAtivos
    .filter(c => notasPorCriterio[c.id] !== undefined)
    .map(c => ({ criterioId: c.id, nome: c.nome, peso: c.peso, nota: notasPorCriterio[c.id], motivo: motivosPorCriterio[c.id] || null }));

  const { error } = await supabaseClient.from('avaliacoes_produto').insert({
    empresa_id: currentUser.empresaId,
    fornecedor_id: fornecedorId,
    usuario_id: currentUser.id,
    data,
    numero_nf: numeroNf,
    notas: notasSnapshot,
    nota_geral: notaGeral,
    conceito: faixa ? faixa.nome : null,
    conta_ocorrencia: contaOcorrencia,
    enviado_por_email: currentUser.email,
    enviado_por_nome: currentUser.responsavel || currentUser.nome,
    desconto_extra: descontoExtra,
    desconto_extra_detalhe: descontoExtraDetalhe,
    conferencia_id: conferenciaVinculada ? conferenciaVinculada.id : null,
    justificativa: justificativaConceito || null,
  });

  if (error) { toast('Erro ao salvar lançamento: ' + error.message); return; }

  addLog('avaliacao_produto_lancada', `${currentUser.email} lançou NF ${numeroNf || '(sem número)'} do fornecedor "${nomeFornecedor}" — nota ${notaGeral.toFixed(1)} (${faixa ? faixa.nome : '—'})`);

  await carregarAvaliacoesProduto();
  renderAvaliarProdutoTab();
  toast('Nota fiscal lançada!');
}

// ---- Fornecedores avaliados (histórico / conceito do período) ----
function renderResultadoHistoricoProduto(fornecedorId, mes, ano) {
  const d = db();
  const mesStr = String(mes).padStart(2, '0');
  const todos = fornecedorId === '';
  const nfsDoMes = d.avaliacoesProduto
    .filter(av => (todos || av.fornecedorId === fornecedorId) && av.data.startsWith(`${ano}-${mesStr}`))
    .sort((a, b) => new Date(a.data) - new Date(b.data));

  const wrap = document.getElementById('hp-resultado');

  if (!nfsDoMes.length) {
    wrap.innerHTML = '<div class="empty-state"><p>Nenhuma nota fiscal lançada nesse período.</p></div>';
    return;
  }

  // Média/desconto agregados só fazem sentido pra 1 fornecedor por vez —
  // misturar fornecedores diferentes numa média só não diria nada de útil.
  let agregadoHtml = '';
  if (!todos) {
    const conceitoPeriodo = nfsDoMes.reduce((s, av) => s + av.notaGeral, 0) / nfsDoMes.length;
    const ocorrencias = d.descontoOcorrenciaAtivo ? nfsDoMes.filter(av => av.contaOcorrencia).length : 0;
    const desconto = ocorrencias * d.valorDescontoOcorrencia;
    const notaFinal = Math.max(0, conceitoPeriodo - desconto);
    const faixaFinal = getConceitoPorFaixa(notaFinal, d.faixasConceitoProduto);
    agregadoHtml = `
    <div style="border-top:1px solid var(--border); padding-top:14px">
      <p style="font-size:13px; margin-bottom:4px">Conceito do período (média das ${nfsDoMes.length} NF${nfsDoMes.length > 1 ? 's' : ''}): <b>${conceitoPeriodo.toFixed(1)}</b></p>
      ${d.descontoOcorrenciaAtivo ? `<p style="font-size:13px; margin-bottom:4px">Ocorrências (notas ≠ 10): <b>${ocorrencias}</b> × ${d.valorDescontoOcorrencia} = <b style="color:var(--danger)">-${desconto.toFixed(1)}</b></p>` : ''}
      <p style="font-size:15px; margin-top:8px">Nota final do período: <b>${notaFinal.toFixed(1)}</b> &nbsp; <span style="padding:2px 8px; border-radius:10px; font-size:11px; font-weight:600; background:${faixaFinal ? faixaFinal.cor + '22' : 'var(--surface2)'}; color:${faixaFinal ? faixaFinal.cor : 'var(--text-muted)'}">${faixaFinal ? faixaFinal.nome : '—'}</span></p>
    </div>`;
  }

  wrap.innerHTML = `
    <div style="display:flex; justify-content:flex-end; margin-bottom:10px">
      <button class="btn btn-secondary btn-sm" onclick="abrirExportarRelatorioProduto('${fornecedorId}', ${mes}, ${ano})" style="display:inline-flex; align-items:center; gap:6px">${ic('chart', 13)}Exportar relatório</button>
    </div>
    <div style="margin-bottom:14px">
      <table>
        <thead><tr>${todos ? '<th>Fornecedor</th>' : ''}<th>Data</th><th>NF</th><th style="text-align:center">Nota</th><th>Conceito</th><th></th></tr></thead>
        <tbody>
          ${nfsDoMes.map(av => {
            const faixa = d.faixasConceitoProduto.find(f => f.nome === av.conceito);
            const nomeForn = todos ? ((d.fornecedores.find(f => f.id === av.fornecedorId) || {}).nome || '—') : null;
            return `<tr style="cursor:pointer" onclick="verDetalheAvaliacaoProduto('${av.id}')">
              ${todos ? `<td style="font-weight:500">${nomeForn}</td>` : ''}
              <td>${fmtDataSimples(av.data)}</td>
              <td>${av.numeroNf || '—'}</td>
              <td style="text-align:center; font-weight:600">${av.notaGeral.toFixed(1)}</td>
              <td><span style="padding:2px 8px; border-radius:10px; font-size:11px; font-weight:600; background:${faixa ? faixa.cor + '22' : 'var(--surface2)'}; color:${faixa ? faixa.cor : 'var(--text-muted)'}">${av.conceito || '—'}</span>${av.contaOcorrencia ? ` <span style="color:var(--danger); font-size:11px; display:inline-flex; align-items:center; gap:3px">${ic('alertTriangle', 11)}ocorrência</span>` : ''}</td>
              <td><button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); excluirAvaliacaoProduto('${av.id}')">Excluir</button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    ${agregadoHtml}
  `;
}

function verDetalheAvaliacaoProduto(id) {
  const d = db();
  const av = d.avaliacoesProduto.find(a => a.id === id);
  if (!av) return;
  const forn = d.fornecedores.find(f => f.id === av.fornecedorId);
  const faixa = d.faixasConceitoProduto.find(f => f.nome === av.conceito);

  openModal(`
    <h3>${forn ? escapeHtml(forn.nome) : 'Fornecedor'}</h3>
    <p style="font-size:12px; color:var(--text-muted); margin-bottom:4px">NF ${av.numeroNf || '(sem número)'} · ${fmtDataSimples(av.data)}</p>
    <p style="font-size:12px; color:var(--text-muted); margin-bottom:14px">Lançado por ${av.enviadoPorEmail || '—'}</p>
    <div style="margin-bottom:14px">
      <span style="padding:2px 8px; border-radius:10px; font-size:11px; font-weight:600; background:${faixa ? faixa.cor + '22' : 'var(--surface2)'}; color:${faixa ? faixa.cor : 'var(--text-muted)'}">${av.conceito || '—'}</span>
      <b style="margin-left:8px; font-size:15px">${av.notaGeral.toFixed(1)}</b>
      ${av.contaOcorrencia ? ` <span style="color:var(--danger); font-size:12px; display:inline-flex; align-items:center; gap:3px">${ic('alertTriangle', 12)}conta como ocorrência</span>` : ''}
    </div>
    ${(av.notas || []).map(n => `
      <div style="padding:6px 0; border-bottom:1px solid var(--border); font-size:13px">
        <div style="display:flex; justify-content:space-between">
          <span>${escapeHtml(n.nome)} <span style="color:var(--text-muted); font-size:11px">(peso ${n.peso})</span></span>
          <b>${parseFloat(n.nota).toFixed(1)}</b>
        </div>
        ${n.motivo ? `<div style="font-size:12px; color:var(--danger); margin-top:2px">Motivo: ${escapeHtml(n.motivo)}</div>` : ''}
      </div>
    `).join('')}
    ${(av.descontoExtraDetalhe && av.descontoExtraDetalhe.length) ? `
      <div style="margin-top:12px; padding:10px 12px; background:var(--danger-bg); border-radius:8px">
        <p style="font-size:12px; font-weight:600; color:var(--danger); margin-bottom:4px">Descontos extras (${av.descontoExtra} pontos)</p>
        ${av.descontoExtraDetalhe.map(det => `
          <div style="font-size:12px; color:var(--danger)">${escapeHtml(det.motivo)}: -${det.valor}</div>
        `).join('')}
      </div>
    ` : ''}
    ${av.justificativa ? `
      <div style="margin-top:12px; padding:10px 12px; background:var(--surface2); border-radius:8px">
        <p style="font-size:12px; font-weight:600; margin-bottom:4px">Motivo do conceito "${escapeHtml(av.conceito)}"</p>
        <p style="font-size:12px">${escapeHtml(av.justificativa)}</p>
      </div>
    ` : ''}
    ${getSituacao(av.notaGeral) === 'reprovado' ? blocoPlanoAcaoHtml('produto', av) : ''}
    <div class="no-print" style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px">
      ${(av.notas || []).some(n => n.motivo) || (av.descontoExtraDetalhe || []).length ? (
        av.planoAcaoAnexo
          ? `<span style="margin-right:auto; font-size:12px; color:var(--success); font-weight:600; display:flex; align-items:center; gap:4px">${ic('check', 13)}Plano de ação enviado</span>`
          : `
        <div style="margin-right:auto; display:flex; align-items:center; gap:12px; flex-wrap:wrap">
          ${av.notificadoEm ? `<span style="font-size:12px; color:var(--success); font-weight:600; display:flex; align-items:center; gap:4px">${ic('mail', 13)}Cobrado em ${new Date(av.notificadoEm).toLocaleDateString('pt-BR')}</span>` : ''}
          <button class="btn ${av.notificadoEm ? 'btn-secondary' : 'btn-primary'} btn-sm" onclick="notificarFornecedorProduto('${av.id}')" style="display:inline-flex; align-items:center; gap:6px">${ic('mail', 13)}${av.notificadoEm ? 'Notificar novamente' : 'Notificar por e-mail'}</button>
        </div>
      `) : ''}
      <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    </div>
  `);
}

function abrirExportarRelatorioProduto(fornecedorId, mes, ano) {
  const d = db();
  const mesStr = String(mes).padStart(2, '0');
  const ultimoDia = new Date(ano, mes, 0).getDate(); // dia 0 do mês seguinte = último dia do mês atual
  const de = `${ano}-${mesStr}-01`;
  const ate = `${ano}-${mesStr}-${String(ultimoDia).padStart(2, '0')}`;
  const fornecedoresProduto = d.fornecedores.filter(f => f.tipo === 'produto' || f.tipo === 'ambos');

  openModal(`
    <h3>Exportar relatório</h3>
    <div class="form-group" style="margin-bottom:12px">
      <label>Fornecedor</label>
      <select id="exp-fornecedor">
        <option value="">Todos</option>
        ${fornecedoresProduto.map(f => `<option value="${f.id}" ${f.id === fornecedorId ? 'selected' : ''}>${f.nome}</option>`).join('')}
      </select>
    </div>
    <div class="form-row" style="grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px">
      <div class="form-group" style="margin:0"><label>De</label><input type="date" id="exp-de" value="${de}"></div>
      <div class="form-group" style="margin:0"><label>Até</label><input type="date" id="exp-ate" value="${ate}"></div>
    </div>
    <div class="form-row" style="grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px">
      <div class="form-group" style="margin:0">
        <label>Tipo de relatório</label>
        <select id="exp-tipo">
          <option value="simples">Simples</option>
          <option value="detalhado">Detalhado (com nota de cada critério)</option>
        </select>
      </div>
      <div class="form-group" style="margin:0">
        <label>Formato</label>
        <select id="exp-formato">
          <option value="excel">Excel (.xlsx)</option>
          <option value="pdf">PDF</option>
        </select>
      </div>
    </div>
    <div style="display:flex; justify-content:flex-end; gap:8px">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="gerarRelatorioProduto()">Gerar relatório</button>
    </div>
  `);
}

function gerarRelatorioProduto() {
  const d = db();
  const fornecedorId = document.getElementById('exp-fornecedor').value;
  const de = document.getElementById('exp-de').value;
  const ate = document.getElementById('exp-ate').value;
  const tipo = document.getElementById('exp-tipo').value;
  const formato = document.getElementById('exp-formato').value;

  if (!de || !ate) { toast('Informe o período.'); return; }

  const nfs = d.avaliacoesProduto
    .filter(av => (!fornecedorId || av.fornecedorId === fornecedorId) && av.data >= de && av.data <= ate)
    .sort((a, b) => new Date(a.data) - new Date(b.data));

  if (!nfs.length) { toast('Nenhuma nota fiscal encontrada nesse período/fornecedor.'); return; }

  // Monta cabeçalho + linhas UMA vez — Excel e PDF reaproveitam a mesma tabela.
  let headers, linhasArray, linhasObjeto;
  if (tipo === 'simples') {
    headers = ['Fornecedor', 'Nota Fiscal', 'Data', 'Nota Geral', 'Conceito', 'Ocorrência'];
    linhasObjeto = nfs.map(av => ({
      'Fornecedor': (d.fornecedores.find(f => f.id === av.fornecedorId) || {}).nome || '—',
      'Nota Fiscal': av.numeroNf || '',
      'Data': fmtDataSimples(av.data),
      'Nota Geral': Number(av.notaGeral.toFixed(1)),
      'Conceito': av.conceito || '',
      'Ocorrência': av.contaOcorrencia ? 'Sim' : 'Não',
    }));
  } else {
    // Detalhado: uma coluna por critério — usa a união dos critérios que
    // aparecem nas fotografias salvas nesse período (podem variar se você
    // editou os critérios ao longo do tempo — isso é esperado, não é bug).
    const nomesCriterios = [...new Set(nfs.flatMap(av => (av.notas || []).map(n => n.nome)))];
    headers = ['Fornecedor', 'Nota Fiscal', 'Data', ...nomesCriterios, 'Nota Geral', 'Conceito', 'Ocorrência'];
    linhasObjeto = nfs.map(av => {
      const linha = {
        'Fornecedor': (d.fornecedores.find(f => f.id === av.fornecedorId) || {}).nome || '—',
        'Nota Fiscal': av.numeroNf || '',
        'Data': fmtDataSimples(av.data),
      };
      nomesCriterios.forEach(nome => {
        const item = (av.notas || []).find(n => n.nome === nome);
        linha[nome] = item ? Number(parseFloat(item.nota).toFixed(1)) : '';
      });
      linha['Nota Geral'] = Number(av.notaGeral.toFixed(1));
      linha['Conceito'] = av.conceito || '';
      linha['Ocorrência'] = av.contaOcorrencia ? 'Sim' : 'Não';
      return linha;
    });
  }
  linhasArray = linhasObjeto.map(obj => headers.map(h => obj[h] ?? ''));

  const nomeForn = fornecedorId ? ((d.fornecedores.find(f => f.id === fornecedorId) || {}).nome || '') : 'Todos os fornecedores';
  const nomeBase = `relatorio-produto-${de}_a_${ate}`;

  if (formato === 'excel') {
    const ws = XLSX.utils.json_to_sheet(linhasObjeto);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
    XLSX.writeFile(wb, `${nomeBase}.xlsx`);
  } else {
    const { jsPDF } = window.jspdf;
    const docPdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: headers.length > 6 ? 'landscape' : 'portrait' });
    docPdf.setFontSize(13);
    docPdf.text(d.empresa.nome || 'Relatório de Avaliação de Fornecedores', 14, 15);
    docPdf.setFontSize(9);
    docPdf.text(`Fornecedor: ${nomeForn}  |  Período: ${fmtDataSimples(de)} a ${fmtDataSimples(ate)}  |  Tipo: ${tipo === 'simples' ? 'Simples' : 'Detalhado'}`, 14, 21);
    docPdf.autoTable({ head: [headers], body: linhasArray, startY: 26, styles: { fontSize: 8 }, headStyles: { fillColor: [37, 99, 235] } });
    docPdf.save(`${nomeBase}.pdf`);
  }

  addLog('relatorio_produto_exportado', `${currentUser.email} exportou relatório de produto (${tipo}, ${formato}) de ${de} a ${ate}`);
  closeModal();
  toast('Relatório gerado!');
}

async function excluirAvaliacaoProduto(id) {
  if (!confirm('Excluir esse lançamento de nota fiscal? Isso recalcula o conceito do período.')) return;
  const { error } = await supabaseClient.from('avaliacoes_produto').delete().eq('id', id);
  if (error) { toast('Erro ao excluir lançamento: ' + error.message); return; }
  addLog('avaliacao_produto_excluida', `${currentUser.email} excluiu um lançamento de nota fiscal de produto`);
  await carregarAvaliacoesProduto();
  renderFornecedoresAvaliadosBloco();
  toast('Lançamento excluído.');
}

// ---- Critérios de produto ----

// Modelos de régua sugeridos (só usados quando peso = 10 e o nome bate com um
// dos 4 padrões — em qualquer outro caso a régua nasce em branco pro cliente
// montar do jeito dele). São só sugestão inicial: 100% editável depois.
const MODELOS_REGUA_PRODUTO = {
  'nota fiscal': [
    { label: 'Nota fiscal 100% conforme: quantidade, lote e dados corretos', pontos: 10 },
    { label: 'Pequena divergência de dado cadastral, sem afetar quantidade/lote', pontos: 9 },
    { label: 'Divergência de lote, sem afetar quantidade', pontos: 8 },
    { label: 'Falta de 1 item em relação ao faturado', pontos: 7 },
    { label: 'Falta de mais de 1 item, divergência pequena no total', pontos: 6 },
    { label: 'Divergência de quantidade relevante (parte do pedido não chegou)', pontos: 5 },
    { label: 'Divergência de quantidade e de lote juntas', pontos: 4 },
    { label: 'Divergência significativa de quantidade, vários itens', pontos: 3 },
    { label: 'Nota fiscal com múltiplos erros (quantidade, lote e dados)', pontos: 2 },
    { label: 'Nota fiscal totalmente divergente do que foi recebido', pontos: 1 },
  ],
  'prazo': [
    { label: 'Entregue no prazo combinado ou antes', pontos: 10 },
    { label: 'Atraso de até 1 dia', pontos: 9 },
    { label: 'Atraso de 2 dias', pontos: 8 },
    { label: 'Atraso de 3 dias', pontos: 7 },
    { label: 'Atraso de 4 dias', pontos: 6 },
    { label: 'Atraso de 5 dias', pontos: 5 },
    { label: 'Atraso de 6 a 7 dias', pontos: 4 },
    { label: 'Atraso de 8 a 9 dias', pontos: 3 },
    { label: 'Atraso de 10 dias', pontos: 2 },
    { label: 'Atraso de mais de 10 dias', pontos: 1 },
  ],
  'qualidade': [
    { label: 'Produto e embalagem em perfeito estado, sem nenhuma avaria', pontos: 10 },
    { label: 'Embalagem com pequena amassadura, sem afetar o produto', pontos: 9 },
    { label: 'Embalagem danificada, produto intacto', pontos: 8 },
    { label: 'Produto com avaria leve, mas utilizável', pontos: 7 },
    { label: 'Produto com avaria visível, uso comprometido em parte', pontos: 6 },
    { label: 'Parte do lote danificado', pontos: 5 },
    { label: 'Vários itens danificados', pontos: 4 },
    { label: 'Maior parte do lote com avaria', pontos: 3 },
    { label: 'Produto com avaria grave, quase todo o lote', pontos: 2 },
    { label: 'Produto todo danificado/impróprio', pontos: 1 },
  ],
  'transportadora': [
    { label: 'Descarregamento cuidadoso, sem nenhum indício de mau manuseio', pontos: 10 },
    { label: 'Pequeno deslize no manuseio, sem causar dano', pontos: 9 },
    { label: 'Manuseio inadequado pontual (ex: empilhamento incorreto), sem dano ao produto', pontos: 8 },
    { label: 'Manuseio inadequado, causou avaria leve', pontos: 7 },
    { label: 'Descarregamento com cuidado insuficiente, avaria perceptível', pontos: 6 },
    { label: 'Manuseio ruim, parte da carga afetada', pontos: 5 },
    { label: 'Manuseio ruim, vários itens afetados', pontos: 4 },
    { label: 'Descarregamento descuidado, maior parte da carga afetada', pontos: 3 },
    { label: 'Manuseio muito ruim, carga jogada/mal empilhada, quase toda afetada', pontos: 2 },
    { label: 'Descarregamento sem nenhum cuidado, carga toda comprometida', pontos: 1 },
  ],
};

// Empresa sem nenhum critério de produto cadastrado (nova, ou legada que nunca
// criou nenhum) ganha automaticamente os 4 critérios padrão, peso 10, já com
// a régua sugerida — pode excluir/editar à vontade depois. Empresa que já tem
// QUALQUER critério (mesmo 1 só, criado manualmente) nunca é tocada por isso,
// pra não duplicar o que ela já montou.
async function seedCriteriosProdutoPadrao() {
  if (criteriosProdutoCache.length > 0) return;
  const nomesPadrao = ['Nota Fiscal', 'Prazo', 'Qualidade', 'Transportadora'];
  const linhas = nomesPadrao.map(nome => ({
    empresa_id: currentUser.empresaId, nome, peso: 10, ativo: true,
    opcoes: getModeloReguaPadrao(nome, 10),
  }));
  const { error } = await supabaseClient.from('criterios_produto').insert(linhas);
  if (error) { console.error('Erro ao pré-cadastrar critérios de produto padrão:', error.message); return; }
  addLog('criterios_produto_seed', `${currentUser.email} — critérios padrão de produto pré-cadastrados automaticamente`);
  await carregarCriteriosProduto();
}

function getModeloReguaPadrao(nome, peso) {
  const chave = (nome || '').trim().toLowerCase();
  if (peso === 10 && MODELOS_REGUA_PRODUTO[chave]) return MODELOS_REGUA_PRODUTO[chave].map(o => ({ ...o }));
  // Nome não bate com um dos 4 padrões (ou o peso não é 10) — ainda assim,
  // oferece a régua genérica de 1 até o peso (nota já vem pronta, texto fica
  // em branco pro admin descrever o que aquele nível significa). Peso 5 gera
  // 5 linhas, peso 10 gera 10, etc.
  const n = Math.max(1, Math.round(peso));
  return Array.from({ length: n }, (_, i) => ({ label: '', pontos: n - i }));
}

function renderCriteriosProdutoTab() {
  const d = db();
  const wrap = document.getElementById('avaliar-produto-tab');
  wrap.innerHTML = `
    <div class="card" style="margin-bottom:14px">
      <div class="card-title">Novo critério</div>
      <div class="form-row three">
        <div class="form-group"><label>Nome do critério</label><input type="text" id="ncp-nome" placeholder="Ex: Nota Fiscal"></div>
        <div class="form-group"><label>Peso</label><input type="number" id="ncp-peso" min="0" step="0.5" value="1"></div>
        <div style="display:flex; align-items:flex-end"><button class="btn btn-primary btn-block" onclick="addCriterioProduto()">Adicionar critério</button></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Critérios cadastrados (${d.criteriosProduto.length})</div>
      <div id="criterios-produto-lista"></div>
    </div>
  `;
  renderCriteriosProdutoLista();
}

function renderCriteriosProdutoLista() {
  const d = db();
  const wrap = document.getElementById('criterios-produto-lista');
  if (!d.criteriosProduto.length) {
    wrap.innerHTML = '<div class="empty-state"><p>Nenhum critério cadastrado ainda. Adicione acima (ex: Nota Fiscal, Prazo, Quantidade, Condições).</p></div>';
    return;
  }
  wrap.innerHTML = `<table><thead><tr><th>Critério</th><th style="width:120px">Peso</th><th style="width:90px">Ativo</th><th style="width:100px">Régua</th><th></th></tr></thead><tbody>
    ${d.criteriosProduto.map(c => `<tr>
      <td style="font-weight:500">${c.nome}</td>
      <td><input type="number" min="0" step="0.5" value="${c.peso}" style="width:80px" onchange="salvarPesoCriterioProduto('${c.id}', this.value)"></td>
      <td><input type="checkbox" ${c.ativo ? 'checked' : ''} onchange="toggleCriterioProdutoAtivo('${c.id}', this.checked)"></td>
      <td>${(c.opcoes && c.opcoes.length) ? `<span style="color:var(--accent); font-weight:600">${c.opcoes.length} opções</span>` : '<span style="color:var(--text-muted)">Livre</span>'}</td>
      <td><div class="actions"><button class="btn btn-secondary btn-sm" onclick="toggleReguaEditor('produto', '${c.id}')">Editar régua</button> <button class="btn btn-danger btn-sm" onclick="excluirCriterioProduto('${c.id}')">Excluir</button></div></td>
    </tr>
    ${(window._reguaEmEdicaoTipo === 'produto' && window._reguaEmEdicaoId === c.id) ? `<tr><td colspan="5">${renderReguaEditorHtml('produto', c)}</td></tr>` : ''}`).join('')}
  </tbody></table>`;
}

// ---- Editor de régua (opções de texto + pontos) — compartilhado entre
// Critérios de Produto (Avaliar) e Critérios de Conferência. "tipo" decide
// qual tabela/cache/tela usar; o resto do fluxo é idêntico nos dois.
window._reguaEmEdicaoTipo = null;
window._reguaEmEdicaoId = null;
window._reguaBuilder = [];

function getReguaContexto(tipo) {
  const d = db();
  return tipo === 'conferencia'
    ? { tabela: 'criterios_conferencia', lista: d.criteriosConferencia, renderFn: renderCriteriosConferenciaTab, recarregarFn: carregarCriteriosConferencia, logChave: 'criterio_conferencia_regua_editada', logTexto: 'critério de conferência' }
    : { tabela: 'criterios_produto', lista: d.criteriosProduto, renderFn: renderCriteriosProdutoLista, recarregarFn: carregarCriteriosProduto, logChave: 'criterio_produto_regua_editada', logTexto: 'critério de produto' };
}

function toggleReguaEditor(tipo, id) {
  const ctx = getReguaContexto(tipo);
  if (window._reguaEmEdicaoTipo === tipo && window._reguaEmEdicaoId === id) {
    window._reguaEmEdicaoTipo = null; window._reguaEmEdicaoId = null; ctx.renderFn(); return;
  }
  const c = ctx.lista.find(x => x.id === id);
  if (!c) return;
  window._reguaEmEdicaoTipo = tipo;
  window._reguaEmEdicaoId = id;
  window._reguaBuilder = (c.opcoes && c.opcoes.length) ? c.opcoes.map(o => ({ ...o })) : [];
  ctx.renderFn();
}

function addReguaOpcao() {
  window._reguaBuilder.push({ label: '', pontos: 0 });
  getReguaContexto(window._reguaEmEdicaoTipo).renderFn();
}

function removeReguaOpcao(idx) {
  window._reguaBuilder.splice(idx, 1);
  getReguaContexto(window._reguaEmEdicaoTipo).renderFn();
}

function updateReguaOpcaoField(idx, field, value) {
  window._reguaBuilder[idx][field] = field === 'pontos' ? (parseFloat(value) || 0) : value;
}

function sugerirModeloReguaProduto(tipo, id) {
  const ctx = getReguaContexto(tipo);
  const c = ctx.lista.find(x => x.id === id);
  if (!c) return;
  const modelo = getModeloReguaPadrao(c.nome, c.peso);
  if (!modelo) { toast('Não há modelo padrão pra esse nome/peso — monte a régua manualmente.'); return; }
  window._reguaBuilder = modelo;
  ctx.renderFn();
}

async function salvarReguaCriterioProduto(tipo, id) {
  const ctx = getReguaContexto(tipo);
  const opcoes = window._reguaBuilder.filter(o => o.label.trim());
  if (window._reguaBuilder.some(o => !o.label.trim())) toast('Linhas sem texto foram descartadas ao salvar.');
  const { error } = await supabaseClient.from(ctx.tabela).update({ opcoes }).eq('id', id);
  if (error) { toast('Erro ao salvar régua: ' + error.message); return; }
  addLog(ctx.logChave, `${currentUser.email} atualizou a régua de um ${ctx.logTexto}`);
  window._reguaEmEdicaoTipo = null; window._reguaEmEdicaoId = null;
  await ctx.recarregarFn();
  ctx.renderFn();
  toast('Régua salva!');
}

function renderReguaEditorHtml(tipo, c) {
  const modeloDisponivel = getModeloReguaPadrao(c.nome, c.peso) !== null;
  return `
    <div class="criterio-block" style="margin:6px 0">
      <p style="font-size:11px; font-weight:600; color:var(--text-muted); margin-bottom:8px">
        Régua de "${c.nome}" — deixe em branco (sem opções) pra continuar com número livre de 0 a ${c.peso}
      </p>
      ${window._reguaBuilder.map((op, i) => `
        <div style="display:flex; gap:8px; align-items:center; margin-bottom:6px">
          <input type="text" value="${op.label}" placeholder="Ex: Entregue no prazo combinado" style="flex:1" oninput="updateReguaOpcaoField(${i},'label',this.value)">
          <input type="number" step="0.5" value="${op.pontos}" placeholder="Pts" style="width:70px" oninput="updateReguaOpcaoField(${i},'pontos',this.value)">
          <button class="btn btn-danger btn-sm" onclick="removeReguaOpcao(${i})">${ic('x', 12)}</button>
        </div>
      `).join('')}
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; flex-wrap:wrap; gap:8px">
        <div style="display:flex; gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="addReguaOpcao()">+ Opção</button>
          ${modeloDisponivel ? `<button class="btn btn-secondary btn-sm" onclick="sugerirModeloReguaProduto('${tipo}', '${c.id}')">Sugerir modelo padrão</button>` : ''}
        </div>
        <div style="display:flex; gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="toggleReguaEditor('${tipo}', '${c.id}')">Cancelar</button>
          <button class="btn btn-primary btn-sm" onclick="salvarReguaCriterioProduto('${tipo}', '${c.id}')">Salvar régua</button>
        </div>
      </div>
    </div>
  `;
}

async function addCriterioProduto() {
  const nome = document.getElementById('ncp-nome').value.trim();
  const peso = parseFloat(document.getElementById('ncp-peso').value) || 1;
  if (!nome) { toast('Informe o nome do critério.'); return; }

  const opcoes = getModeloReguaPadrao(nome, peso) || [];

  const { error } = await supabaseClient.from('criterios_produto').insert({
    empresa_id: currentUser.empresaId, nome, peso, ativo: true, opcoes,
  });
  if (error) { toast('Erro ao criar critério: ' + error.message); return; }

  addLog('criterio_produto_criado', `${currentUser.email} criou o critério de produto "${nome}" (peso ${peso})`);
  document.getElementById('ncp-nome').value = '';
  document.getElementById('ncp-peso').value = '1';
  await carregarCriteriosProduto();
  renderCriteriosProdutoTab();
  toast(opcoes.length ? 'Critério adicionado com régua sugerida — revise e ajuste se quiser.' : 'Critério adicionado!');
}

async function salvarPesoCriterioProduto(id, novoPeso) {
  const peso = parseFloat(novoPeso) || 0;
  const { error } = await supabaseClient.from('criterios_produto').update({ peso }).eq('id', id);
  if (error) { toast('Erro ao salvar peso: ' + error.message); return; }
  addLog('criterio_produto_editado', `${currentUser.email} alterou o peso de um critério de produto para ${peso}`);
  await carregarCriteriosProduto();
}

async function toggleCriterioProdutoAtivo(id, ativo) {
  const { error } = await supabaseClient.from('criterios_produto').update({ ativo }).eq('id', id);
  if (error) { toast('Erro ao atualizar critério: ' + error.message); return; }
  addLog('criterio_produto_status', `${currentUser.email} ${ativo ? 'ativou' : 'desativou'} um critério de produto`);
  await carregarCriteriosProduto();
}

async function excluirCriterioProduto(id) {
  const d = db();
  const c = d.criteriosProduto.find(x => x.id === id);
  if (!c) return;
  if (!confirm(`Excluir o critério "${c.nome}"? Avaliações que já usaram esse critério continuam com o registro delas intacto — só deixa de aparecer pra novos lançamentos.`)) return;

  const { error } = await supabaseClient.from('criterios_produto').delete().eq('id', id);
  if (error) { toast('Erro ao excluir critério: ' + error.message); return; }

  addLog('criterio_produto_excluido', `${currentUser.email} excluiu o critério de produto "${c.nome}"`);
  await carregarCriteriosProduto();
  renderCriteriosProdutoLista();
  toast('Critério excluído.');
}

// ---- Faixas de conceito de produto ----
let _faixasEmEdicao = null;

function renderFaixasConceitoTab() {
  const d = db();
  if (!_faixasEmEdicao) _faixasEmEdicao = JSON.parse(JSON.stringify(d.faixasConceitoProduto));
  const wrap = document.getElementById('avaliar-produto-tab');
  wrap.innerHTML = `
    <div class="card" style="margin-bottom:14px">
      <div class="card-title">Faixas de conceito</div>
      <p style="font-size:12px; color:var(--text-muted); margin-bottom:12px">Define como a nota de 0 a 10 vira um conceito (ex: 0 a 4 = Ruim). Adicione ou remova faixas como quiser.</p>
      <div id="faixas-conceito-lista">
        ${_faixasEmEdicao.map((f, i) => `
          <div class="form-row" style="grid-template-columns: 2fr 1fr 1fr 1fr auto; gap:8px; align-items:end; margin-bottom:10px">
            <div class="form-group" style="margin:0"><label>Nome</label><input type="text" id="faixa-nome-${i}" value="${f.nome}"></div>
            <div class="form-group" style="margin:0"><label>De</label><input type="number" step="0.1" id="faixa-de-${i}" value="${f.de}"></div>
            <div class="form-group" style="margin:0"><label>Até</label><input type="number" step="0.1" id="faixa-ate-${i}" value="${f.ate}"></div>
            <div class="form-group" style="margin:0"><label>Cor</label><input type="color" id="faixa-cor-${i}" value="${f.cor}" style="height:36px; padding:2px"></div>
            <button class="btn btn-danger btn-sm" onclick="removerFaixaConceito(${i})">Excluir</button>
          </div>
        `).join('')}
      </div>
      <div style="display:flex; gap:8px; margin-top:10px">
        <button class="btn btn-secondary" onclick="adicionarFaixaConceito()">+ Adicionar faixa</button>
        <button class="btn btn-primary" onclick="salvarFaixasConceito()">Salvar faixas</button>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Desconto por ocorrência</div>
      <p style="font-size:12px; color:var(--text-muted); margin-bottom:12px">Desligado por padrão — nunca é obrigatório. Se ligar, toda nota fiscal lançada com nota diferente de 10 desconta o valor abaixo do conceito do período (ex: 2 ocorrências × 0,5 = -1,0).</p>
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:${d.descontoOcorrenciaAtivo ? '14px' : '0'}">
        <input type="checkbox" id="desconto-ativo" ${d.descontoOcorrenciaAtivo ? 'checked' : ''} onchange="toggleDescontoOcorrenciaVisibilidade()">
        <label style="margin:0">Descontar por ocorrência</label>
      </div>
      <div id="desconto-valor-wrap" style="display:${d.descontoOcorrenciaAtivo ? 'flex' : 'none'}; gap:10px; align-items:flex-end">
        <div class="form-group" style="margin:0; max-width:160px"><label>Valor do desconto</label><input type="number" step="0.1" min="0" id="desconto-valor" value="${d.valorDescontoOcorrencia}"></div>
        <button class="btn btn-primary" onclick="salvarDescontoOcorrencia()">Salvar</button>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Desconto por documentação vencida</div>
      <p style="font-size:12px; color:var(--text-muted); margin-bottom:12px">Desligado por padrão. Se ligar, todo lançamento de um fornecedor que tenha QUALQUER documento vencido desconta o valor abaixo (uma vez só, não importa quantos documentos estejam vencidos).</p>
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:${d.descontoDocVencidoAtivo ? '14px' : '0'}">
        <input type="checkbox" id="desconto-doc-ativo" ${d.descontoDocVencidoAtivo ? 'checked' : ''} onchange="toggleDescontoDocVencidoVisibilidade()">
        <label style="margin:0">Descontar por documentação vencida</label>
      </div>
      <div id="desconto-doc-valor-wrap" style="display:${d.descontoDocVencidoAtivo ? 'flex' : 'none'}; gap:10px; align-items:flex-end">
        <div class="form-group" style="margin:0; max-width:160px"><label>Valor do desconto</label><input type="number" step="0.1" min="0" id="desconto-doc-valor" value="${d.valorDescontoDocVencido}"></div>
        <button class="btn btn-primary" onclick="salvarDescontoDocVencido()">Salvar</button>
      </div>
    </div>
  `;
}

function toggleDescontoDocVencidoVisibilidade() {
  const ativo = document.getElementById('desconto-doc-ativo').checked;
  document.getElementById('desconto-doc-valor-wrap').style.display = ativo ? 'flex' : 'none';
  salvarDescontoDocVencido();
}

async function salvarDescontoDocVencido() {
  const ativo = document.getElementById('desconto-doc-ativo').checked;
  const valorInput = document.getElementById('desconto-doc-valor');
  const valor = valorInput ? (parseFloat(valorInput.value) || 0) : db().valorDescontoDocVencido;

  const { error } = await supabaseClient.from('empresas').update({
    desconto_doc_vencido_ativo: ativo, valor_desconto_doc_vencido: valor,
  }).eq('id', currentUser.empresaId);
  if (error) { toast('Erro ao salvar configuração: ' + error.message); return; }

  empresaConfigCache.desconto_doc_vencido_ativo = ativo;
  empresaConfigCache.valor_desconto_doc_vencido = valor;
  addLog('desconto_doc_vencido_atualizado', `${currentUser.email} ${ativo ? 'ligou' : 'desligou'} o desconto por documentação vencida`);
  toast('Configuração salva!');
}

function capturarFaixasDoDOM() {
  _faixasEmEdicao.forEach((f, i) => {
    const nomeEl = document.getElementById(`faixa-nome-${i}`);
    if (!nomeEl) return; // linha já removida da tela
    f.nome = nomeEl.value.trim();
    f.de = parseFloat(document.getElementById(`faixa-de-${i}`).value);
    f.ate = parseFloat(document.getElementById(`faixa-ate-${i}`).value);
    f.cor = document.getElementById(`faixa-cor-${i}`).value;
  });
}

function adicionarFaixaConceito() {
  capturarFaixasDoDOM();
  _faixasEmEdicao.push({ nome: 'Nova faixa', de: 0, ate: 10, cor: '#94a3b8' });
  renderFaixasConceitoTab();
}

function removerFaixaConceito(index) {
  capturarFaixasDoDOM();
  _faixasEmEdicao.splice(index, 1);
  renderFaixasConceitoTab();
}

function toggleDescontoOcorrenciaVisibilidade() {
  const ativo = document.getElementById('desconto-ativo').checked;
  document.getElementById('desconto-valor-wrap').style.display = ativo ? 'flex' : 'none';
  salvarDescontoOcorrencia(); // salva o estado (ligado ou desligado) na hora, sem depender do botão escondido
}

async function salvarFaixasConceito() {
  capturarFaixasDoDOM();
  if (!_faixasEmEdicao.length) { toast('Cadastre ao menos uma faixa.'); return; }

  const { error } = await supabaseClient.from('empresas').update({ faixas_conceito_produto: _faixasEmEdicao }).eq('id', currentUser.empresaId);
  if (error) { toast('Erro ao salvar faixas: ' + error.message); return; }

  empresaConfigCache.faixas_conceito_produto = _faixasEmEdicao;
  _faixasEmEdicao = null; // próxima abertura recarrega do zero, já salvo
  addLog('faixas_conceito_atualizadas', `${currentUser.email} atualizou as faixas de conceito de produto`);
  renderFaixasConceitoTab();
  toast('Faixas salvas!');
}

async function salvarDescontoOcorrencia() {
  const ativo = document.getElementById('desconto-ativo').checked;
  const valorInput = document.getElementById('desconto-valor');
  const valor = valorInput ? (parseFloat(valorInput.value) || 0) : db().valorDescontoOcorrencia;

  const { error } = await supabaseClient.from('empresas').update({
    desconto_ocorrencia_ativo: ativo, valor_desconto_ocorrencia: valor,
  }).eq('id', currentUser.empresaId);
  if (error) { toast('Erro ao salvar configuração: ' + error.message); return; }

  empresaConfigCache.desconto_ocorrencia_ativo = ativo;
  empresaConfigCache.valor_desconto_ocorrencia = valor;
  addLog('desconto_ocorrencia_atualizado', `${currentUser.email} ${ativo ? 'ligou' : 'desligou'} o desconto por ocorrência`);
  toast('Configuração salva!');
}
