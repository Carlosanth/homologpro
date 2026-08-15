// ============ DASHBOARD ============
// Cada bloco só aparece se o admin tiver acesso ao módulo relacionado
// (admin_master sempre vê tudo — temAcessoModulo() já trata isso).

// Donut SVG (Aprovado/Parcial/Reprovado) — sem dependência externa, só stroke-dasharray.
function donutSituacaoHTML(aprovados, parciais, reprovados) {
  const total = aprovados + parciais + reprovados;
  if (!total) return '<p style="font-size:12px; color:var(--text-muted)">Nenhuma avaliação enviada este mês ainda.</p>';

  const r = 54, c = 2 * Math.PI * r, strokeW = 17;
  const segmentos = [
    { valor: aprovados, cor: 'var(--success)', label: 'Aprovado' },
    { valor: parciais, cor: 'var(--warn)', label: 'Parcial' },
    { valor: reprovados, cor: 'var(--danger)', label: 'Reprovado' },
  ];

  let cumulativo = 0;
  const arcos = segmentos.filter(s => s.valor > 0).map(s => {
    const dash = (s.valor / total) * c;
    const svg = `<circle cx="70" cy="70" r="${r}" fill="none" stroke="${s.cor}" stroke-width="${strokeW}" stroke-dasharray="${dash.toFixed(2)} ${(c - dash).toFixed(2)}" stroke-dashoffset="${(-cumulativo).toFixed(2)}" transform="rotate(-90 70 70)"></circle>`;
    cumulativo += dash;
    return svg;
  }).join('');

  return `
    <div style="display:flex; justify-content:center">
      <svg width="140" height="140" viewBox="0 0 140 140">
        ${arcos}
        <text x="70" y="66" text-anchor="middle" font-size="24" font-weight="700" fill="var(--text)">${total}</text>
        <text x="70" y="83" text-anchor="middle" font-size="10.5" fill="var(--text-muted)">avaliação(ões)</text>
      </svg>
    </div>`;
}

async function dispensarOnboarding() {
  const { error } = await salvarConfigEmpresa('onboarding_dispensado', true);
  if (error) { toast('Erro ao salvar: ' + error.message); return; }
  renderAdDashboard();
}

function renderAdDashboard() {
  const d = db();
  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();
  const chaveMes = `${anoAtual}-${mesAtual}`;

  // Cards com "alerta-shake" agitam em sequência (efeito escada), não todos
  // de uma vez — cada card chamado por proximoShakeDelay() espera um pouco
  // mais que o anterior.
  let shakeIndex = 0;
  const proximoShakeDelay = () => (0.3 + (shakeIndex++ * 0.15)).toFixed(2);

  const podeFornecedores = temAcessoModulo('fornecedores');
  const podeAvaliacoes = temAcessoModulo('avaliacoes');
  const podeMeusDocumentos = temAcessoModulo('meusdocumentos');

  let alertaAprovacao = '';
  let alertaAvaliadoresPendentesHTML = '';
  let alertaNotificar = '';
  let alertaNotificarProduto = '';
  let alertaPlanoAcaoAtrasado = '';
  let alertaPlanoAcaoAprovacao = '';
  let alertasDoc = '';
  let alertaDocsEscalonados = '';
  let alertasDocUnidades = '';
  let dashGrid2HTML = '';
  let graficosHTML = '';
  let tabelaHTML = '';
  let assinaturaHTML = '';
  let lixeiraHTML = '';
  let atividadeHTML = '';
  let rankingHistoricoHTML = '';

  // ---------- ALERTA: DOCUMENTOS ENVIADOS PELO PORTAL, AGUARDANDO APROVAÇÃO ----------
  if (podeFornecedores) {
    const pendentesAprovacao = (d.documentosPendentesAprovacao || []).filter(p => p.status === 'pendente');
    if (pendentesAprovacao.length) {
      alertaAprovacao = `
        <div class="card alert-collapse alerta-shake" id="alerta-aprovacao-portal" style="margin-bottom:16px; animation-delay:${proximoShakeDelay()}s">
          <div class="alert-collapse-header" onclick="toggleAlertaCollapse('alerta-aprovacao-portal')">
            <div class="bar bar-accent"></div>
            <span style="flex:1; font-size:13px; font-weight:600">Documentos enviados pelo portal — aguardando aprovação</span>
            <span class="alert-count">${pendentesAprovacao.length} ocorrência(s)</span>
            <span class="alert-collapse-chevron">${ic('chevronDown', 16)}</span>
          </div>
          <div class="alert-collapse-body">
            ${pendentesAprovacao.map(p => {
              const forn = d.fornecedores.find(f => f.id === p.fornecedorId);
              const doc = d.documentos.find(x => x.id === p.documentoId);
              return `
                <div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--border); font-size:13px">
                  <div style="flex:1">
                    <b>${forn ? forn.nome : '—'}</b> enviou <b>${doc ? doc.nome : p.nomeArquivo}</b>
                    <div style="font-size:11px; color:var(--text-muted)">Nova validade: ${new Date(p.novaValidade + 'T00:00:00').toLocaleDateString('pt-BR')} · enviado em ${new Date(p.enviadoEm).toLocaleDateString('pt-BR')}</div>
                  </div>
                  ${p.caminhoStorage ? `<button class="btn btn-secondary btn-sm" onclick="baixarPendenteAprovacao('${p.id}')">${ic('fileText', 13)} Ver</button>` : ''}
                  <button class="btn btn-primary btn-sm" onclick="aprovarPendenteAprovacao('${p.id}')">${ic('check', 13)} Aprovar</button>
                  <button class="btn btn-danger btn-sm" onclick="rejeitarPendenteAprovacao('${p.id}')">${ic('x', 13)} Rejeitar</button>
                </div>`;
            }).join('')}
          </div>
        </div>`;
    }
  }

  if (podeAvaliacoes) {
    // Só entra aqui quem ainda tem alguma ação pendente do admin — depois que
    // o plano de ação é aprovado (planoAcaoResolvidoEm), o loop fechou, não
    // faz sentido continuar aparecendo em "para notificar" pro resto do mês.
    const reprovadosLista = d.avaliacoes.filter(av => av.periodo === chaveMes && !av.semServico && !av.planoAcaoResolvidoEm && (getSituacao(av.nota) === 'reprovado' || getSituacao(av.nota) === 'parcial'));

    if (temAcessoModulo('usuarios')) {
      const avaliadoresPendentesLista = d.usuarios
        .filter(u => u.papel === 'avaliador' && u.ativo)
        .map(u => ({ usuario: u, ...contarPendentesAvaliador(d, u.id) }))
        .filter(item => item.pendentes > 0)
        .sort((a, b) => b.atrasados - a.atrasados);

      if (avaliadoresPendentesLista.length) {
        alertaAvaliadoresPendentesHTML = `
          <div class="card alert-collapse alerta-shake" id="alerta-avaliadores-pendentes" style="margin-bottom:16px; animation-delay:${proximoShakeDelay()}s">
            <div class="alert-collapse-header" onclick="toggleAlertaCollapse('alerta-avaliadores-pendentes')">
              <div class="bar bar-warn"></div>
              <span style="flex:1; font-size:13px; font-weight:600">Avaliadores com avaliação pendente</span>
              <span class="alert-count">${avaliadoresPendentesLista.length} avaliador(es)</span>
              <span class="alert-collapse-chevron">${ic('chevronDown', 16)}</span>
            </div>
            <div class="alert-collapse-body">
              ${avaliadoresPendentesLista.map(item => `
                <div style="display:flex; align-items:center; gap:8px; padding:8px 0; border-bottom:1px solid var(--border); font-size:13px">
                  <span style="flex:1"><b>${item.usuario.nome}</b> — ${item.pendentes} pendente(s)${item.atrasados ? `, ${item.atrasados} atrasada(s)` : ''}</span>
                  ${item.atrasados ? '<span class="badge badge-danger">Atrasado</span>' : ''}
                </div>`).join('')}
              <div style="margin-top:12px">
                <button class="btn btn-primary btn-sm" onclick="enviarLembreteTodosAvaliadores()">${ic('mail', 13)} Lembrar todos</button>
              </div>
            </div>
          </div>`;
      }

    }

    // ---------- ALERTA: NOTIFICAR NOTA BAIXA (com "cobrado em") ----------
    if (reprovadosLista.length) {
      alertaNotificar = `
        <div class="card alert-collapse alerta-shake" id="alerta-notificar-reprovados" style="margin-bottom:16px; animation-delay:${proximoShakeDelay()}s">
          <div class="alert-collapse-header" onclick="toggleAlertaCollapse('alerta-notificar-reprovados')">
            <div class="bar bar-danger"></div>
            <span style="flex:1; font-size:13px; font-weight:600; color:var(--danger)">Fornecedores para notificar (Parcial/Reprovado — ${MESES[mesAtual]})</span>
            <span class="alert-count">${reprovadosLista.length} ocorrência(s)</span>
            <span class="alert-collapse-chevron">${ic('chevronDown', 16)}</span>
          </div>
          <div class="alert-collapse-body">
            ${reprovadosLista.map(av => {
              const forn = d.fornecedores.find(f => f.id === av.fornecedorId);
              const sit = getSituacao(av.nota);
              const acao = `<div style="margin-left:auto; display:flex; align-items:center; gap:10px">
                ${av.planoAcaoAnexo ? `<span style="font-size:11px; color:var(--success); font-weight:600; display:flex; align-items:center; gap:3px">${ic('check', 12)} Plano de ação enviado</span>` : ''}
                ${av.notificadoEm && !av.planoAcaoAnexo ? `<span style="font-size:11px; color:var(--success); font-weight:600; display:flex; align-items:center; gap:3px">${ic('mail', 12)} Cobrado em ${new Date(av.notificadoEm).toLocaleDateString('pt-BR')}</span>` : ''}
                <button class="btn btn-secondary btn-sm" style="display:inline-flex; align-items:center; gap:5px" onclick="verDetalheAvaliacao('${av.id}')">${ic('bell', 13)} ${av.planoAcaoAnexo ? 'Ver' : 'Ver / Notificar'}</button>
              </div>`;
              return `<div style="display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid var(--border); font-size:12px">
                <span><b>${forn ? forn.nome : '—'}</b> — nota ${av.nota.toFixed(1)}</span>
                ${badgeSit(sit)}
                ${acao}
              </div>`;
            }).join('')}
          </div>
        </div>`;
    }

    // ---------- ALERTA: NOTIFICAR NOTA BAIXA — PRODUTO (NF) ----------
    // Usa a mesma matriz de corte (Certificado/Aprovado/Parcial/Reprovado)
    // que a avaliação de Serviço já usa — a régua de "conceito" (Ótimo/
    // Intermediário/Ruim) é só uma classificação informativa do fornecedor,
    // não decide notificação.
    const produtoAtencaoLista = (d.avaliacoesProduto || []).filter(av =>
      periodoDeData(av.data) === chaveMes &&
      (getSituacao(av.notaGeral) === 'reprovado' || getSituacao(av.notaGeral) === 'parcial'));

    if (produtoAtencaoLista.length) {
      alertaNotificarProduto = `
        <div class="card alert-collapse alerta-shake" id="alerta-notificar-produto" style="margin-bottom:16px; animation-delay:${proximoShakeDelay()}s">
          <div class="alert-collapse-header" onclick="toggleAlertaCollapse('alerta-notificar-produto')">
            <div class="bar bar-danger"></div>
            <span style="flex:1; font-size:13px; font-weight:600; color:var(--danger)">Notas fiscais com ocorrência para notificar (${MESES[mesAtual]})</span>
            <span class="alert-count">${produtoAtencaoLista.length} ocorrência(s)</span>
            <span class="alert-collapse-chevron">${ic('chevronDown', 16)}</span>
          </div>
          <div class="alert-collapse-body">
            ${produtoAtencaoLista.map(av => {
              const forn = d.fornecedores.find(f => f.id === av.fornecedorId);
              const acao = `<div style="margin-left:auto; display:flex; align-items:center; gap:10px">
                ${av.planoAcaoAnexo ? `<span style="font-size:11px; color:var(--success); font-weight:600; display:flex; align-items:center; gap:3px">${ic('check', 12)} Plano de ação enviado</span>` : ''}
                ${av.notificadoEm && !av.planoAcaoAnexo ? `<span style="font-size:11px; color:var(--success); font-weight:600; display:flex; align-items:center; gap:3px">${ic('mail', 12)} Cobrado em ${new Date(av.notificadoEm).toLocaleDateString('pt-BR')}</span>` : ''}
                <button class="btn btn-secondary btn-sm" style="display:inline-flex; align-items:center; gap:5px" onclick="verDetalheAvaliacaoProduto('${av.id}')">${ic('bell', 13)} ${av.planoAcaoAnexo ? 'Ver' : 'Ver / Notificar'}</button>
              </div>`;
              return `<div style="display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid var(--border); font-size:12px">
                <span><b>${forn ? forn.nome : '—'}</b> — NF ${av.numeroNf || '—'} · nota ${av.notaGeral != null ? av.notaGeral.toFixed(1) : '—'}</span>
                ${badgeSit(getSituacao(av.notaGeral))}
                ${acao}
              </div>`;
            }).join('')}
          </div>
        </div>`;
    }

    // ---------- ALERTA: PLANO DE AÇÃO ENVIADO, AGUARDANDO APROVAÇÃO ----------
    // Mesmo padrão do card de documentos do portal — aprova/rejeita direto
    // aqui, sem precisar entrar em Avaliações recebidas.
    const planoAcaoAguardando = (d.avaliacoes || []).filter(av =>
      !av.semServico && av.planoAcaoAnexo && av.planoAcaoStatus === 'aguardando_aprovacao'
    );

    if (planoAcaoAguardando.length) {
      alertaPlanoAcaoAprovacao = `
        <div class="card alert-collapse alerta-shake" id="alerta-plano-acao-aprovacao" style="margin-bottom:16px; animation-delay:${proximoShakeDelay()}s">
          <div class="alert-collapse-header" onclick="toggleAlertaCollapse('alerta-plano-acao-aprovacao')">
            <div class="bar bar-accent"></div>
            <span style="flex:1; font-size:13px; font-weight:600">Plano de ação enviado — aguardando aprovação</span>
            <span class="alert-count">${planoAcaoAguardando.length} ocorrência(s)</span>
            <span class="alert-collapse-chevron">${ic('chevronDown', 16)}</span>
          </div>
          <div class="alert-collapse-body">
            ${planoAcaoAguardando.map(av => {
              const forn = d.fornecedores.find(f => f.id === av.fornecedorId);
              return `
                <div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--border); font-size:13px">
                  <div style="flex:1">
                    <b>${forn ? forn.nome : '—'}</b> enviou o plano de ação — ${av.periodo || '—'}
                    <div style="font-size:11px; color:var(--text-muted)">Anexado em ${new Date(av.planoAcaoAnexo.enviadoEm).toLocaleDateString('pt-BR')}</div>
                  </div>
                  <button class="btn btn-secondary btn-sm" onclick="visualizarAnexo('${av.planoAcaoAnexo.caminhoStorage}', '${av.planoAcaoAnexo.nome}')">${ic('fileText', 13)} Ver</button>
                  <button class="btn btn-primary btn-sm" onclick="aprovarPlanoAcao('${av.id}')">${ic('check', 13)} Aprovar</button>
                  <button class="btn btn-danger btn-sm" onclick="rejeitarPlanoAcao('${av.id}')">${ic('x', 13)} Rejeitar</button>
                </div>`;
            }).join('')}
          </div>
        </div>`;
    }

    // ---------- ALERTA: PLANO DE AÇÃO ATRASADO (recobrança) ----------
    // Já foi cobrado, o fornecedor tinha um prazo pra mandar o plano de ação,
    // esse prazo já passou e ainda não anexou nada — junta Serviço e Produto
    // no mesmo alerta, já que pro admin é a mesma ação (cobrar de novo).
    // Não filtra por mês — atraso é sobre a data do prazo, não de quando a
    // avaliação foi feita.
    const hojeISO = new Date().toISOString().slice(0, 10);
    const atrasadosServico = (d.avaliacoes || []).filter(av =>
      !av.semServico && av.notificadoEm && !av.planoAcaoAnexo && av.planoAcaoPrazo && av.planoAcaoPrazo < hojeISO
    ).map(av => ({ ...av, tipo: 'servico' }));
    const atrasadosProduto = (d.avaliacoesProduto || []).filter(av =>
      av.notificadoEm && !av.planoAcaoAnexo && av.planoAcaoPrazo && av.planoAcaoPrazo < hojeISO
    ).map(av => ({ ...av, tipo: 'produto' }));
    const planoAcaoAtrasado = [...atrasadosServico, ...atrasadosProduto];

    if (planoAcaoAtrasado.length) {
      alertaPlanoAcaoAtrasado = `
        <div class="card alert-collapse alerta-shake" id="alerta-plano-acao-atrasado" style="margin-bottom:16px; animation-delay:${proximoShakeDelay()}s">
          <div class="alert-collapse-header" onclick="toggleAlertaCollapse('alerta-plano-acao-atrasado')">
            <div class="bar bar-danger"></div>
            <span style="flex:1; font-size:13px; font-weight:600; color:var(--danger)">Plano de ação atrasado — fornecedor não respondeu no prazo</span>
            <span class="alert-count">${planoAcaoAtrasado.length} ocorrência(s)</span>
            <span class="alert-collapse-chevron">${ic('chevronDown', 16)}</span>
          </div>
          <div class="alert-collapse-body">
            ${planoAcaoAtrasado.map(av => {
              const forn = d.fornecedores.find(f => f.id === av.fornecedorId);
              const diasAtraso = Math.floor((new Date(hojeISO) - new Date(av.planoAcaoPrazo)) / 86400000);
              const titulo = av.tipo === 'produto' ? `NF ${av.numeroNf || '—'}` : `Serviço · ${av.periodo || '—'}`;
              const onclickVer = av.tipo === 'produto' ? `verDetalheAvaliacaoProduto('${av.id}')` : `verDetalheAvaliacao('${av.id}')`;
              return `<div style="display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid var(--border); font-size:12px">
                <span><b>${forn ? forn.nome : '—'}</b> — ${titulo}</span>
                <span class="badge badge-danger">${diasAtraso} dia${diasAtraso === 1 ? '' : 's'} de atraso</span>
                <button class="btn btn-secondary btn-sm" style="margin-left:auto; display:inline-flex; align-items:center; gap:5px" onclick="${onclickVer}">${ic('bell', 13)} Ver / Cobrar de novo</button>
              </div>`;
            }).join('')}
          </div>
        </div>`;
    }
    const avaliacoesMes = d.avaliacoes.filter(av => av.periodo === chaveMes && !av.semServico);
    const aprovados = avaliacoesMes.filter(av => getSituacao(av.nota) === 'aprovado').length;
    const parciais = avaliacoesMes.filter(av => getSituacao(av.nota) === 'parcial').length;
    const reprovados = avaliacoesMes.filter(av => getSituacao(av.nota) === 'reprovado').length;

    graficosHTML = `
      <div class="card" style="margin-bottom:16px">
        <div class="card-title">Avaliações por situação — ${MESES[mesAtual]}</div>
        ${donutSituacaoHTML(aprovados, parciais, reprovados)}
      </div>`;

    // ---------- TABELA ----------
    tabelaHTML = `
      <div class="card">
        <div class="card-title">Avaliações recentes</div>
        ${renderAvaliacoesTable(d.avaliacoes.slice().sort((a, b) => new Date(b.enviadoEm) - new Date(a.enviadoEm)).slice(0, 8), d)}
      </div>`;

    // ---------- PAINEL DUPLO: notas por fornecedor + participação por setor ----------
    const notasPorFornecedor = {};
    avaliacoesMes.forEach(av => {
      if (!notasPorFornecedor[av.fornecedorId]) notasPorFornecedor[av.fornecedorId] = [];
      notasPorFornecedor[av.fornecedorId].push(av.nota);
    });
    const dadosNotas = Object.keys(notasPorFornecedor).map(fornId => {
      const forn = d.fornecedores.find(f => f.id === fornId);
      const notas = notasPorFornecedor[fornId];
      const media = notas.reduce((a, b) => a + b, 0) / notas.length;
      const sit = getSituacao(media);
      const dotClasse = sit === 'aprovado' ? 'dot-ok' : (sit === 'parcial' ? 'dot-warn' : 'dot-danger');
      const notaClasse = sit === 'aprovado' ? 'alta' : (sit === 'parcial' ? 'media' : 'baixa');
      return { nome: forn ? forn.nome : '—', media, dotClasse, notaClasse };
    }).sort((a, b) => b.media - a.media);

    const dadosSetores = calcularSetoresEnviadosMes(d, chaveMes);

    dashGrid2HTML = `
      <div class="dash-grid2">
        <div class="dash-panel">
          <div class="dash-panel-title">Fornecedores avaliados — notas</div>
          <div class="dash-panel-sub">${MESES[mesAtual]} de ${anoAtual}</div>
          ${dadosNotas.length ? `
            <table>
              <thead><tr><th>Fornecedor</th><th style="text-align:center">Nota</th><th style="text-align:right">Status</th></tr></thead>
              <tbody>
                ${dadosNotas.map(n => `<tr>
                  <td>${n.nome}</td>
                  <td style="text-align:center" class="dash-nota ${n.notaClasse}">${n.media.toFixed(1)}</td>
                  <td style="text-align:right"><span class="dot ${n.dotClasse}"></span></td>
                </tr>`).join('')}
              </tbody>
            </table>` : '<div class="empty-state"><p>Nenhuma avaliação registrada este mês.</p></div>'}
        </div>
        <div class="dash-panel">
          <div class="dash-panel-title">Setores que enviaram avaliações</div>
          <div class="dash-panel-sub">Participação por setor — ${MESES[mesAtual]}</div>
          ${dadosSetores.length ? dadosSetores.map(s => barraPercentualHTML(s.nome, s.pct)).join('') : '<div class="empty-state"><p>Nenhum setor com formulário associado ainda.</p></div>'}
        </div>
      </div>`;

    // ---------- RANKING HISTÓRICO: fornecedores com mais reprovações (todos os períodos) ----------
    const notasPorFornecedorHistorico = {};
    d.avaliacoes.forEach(av => {
      if (av.semServico) return;
      if (!notasPorFornecedorHistorico[av.fornecedorId]) notasPorFornecedorHistorico[av.fornecedorId] = [];
      notasPorFornecedorHistorico[av.fornecedorId].push(av.nota);
    });
    const rankingHistorico = Object.keys(notasPorFornecedorHistorico).map(fornId => {
      const forn = d.fornecedores.find(f => f.id === fornId);
      const notas = notasPorFornecedorHistorico[fornId];
      const media = notas.reduce((a, b) => a + b, 0) / notas.length;
      const reprovacoes = notas.filter(n => getSituacao(n) === 'reprovado').length;
      const sit = getSituacao(media);
      const notaClasse = sit === 'aprovado' ? 'alta' : (sit === 'parcial' ? 'media' : 'baixa');
      return { nome: forn ? forn.nome : '—', media, total: notas.length, reprovacoes, notaClasse };
    })
      .filter(item => item.reprovacoes > 0)
      .sort((a, b) => b.reprovacoes - a.reprovacoes || a.media - b.media)
      .slice(0, 6);

    if (rankingHistorico.length) {
      rankingHistoricoHTML = `
        <div class="card">
          <div class="card-title">Fornecedores com mais reprovações — histórico</div>
          <table>
            <thead><tr><th>Fornecedor</th><th style="text-align:center">Nota média</th><th style="text-align:right">Reprovações</th></tr></thead>
            <tbody>
              ${rankingHistorico.map(r => `<tr>
                <td>${r.nome}</td>
                <td style="text-align:center" class="dash-nota ${r.notaClasse}">${r.media.toFixed(1)}</td>
                <td style="text-align:right">${r.reprovacoes} de ${r.total}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    }
  }

  // ---------- ALERTA: DOCUMENTOS DE FORNECEDOR VENCENDO (com "cobrado em") ----------
  if (podeFornecedores) {
    const { vencidos, proximos } = contarDocumentosVencendo(d);
    if (vencidos.length || proximos.length) {
      const linhaDoc = (doc, vencido) => {
        const forn = d.fornecedores.find(f => f.id === doc.fornecedorId);
        const falhouRecente = doc.ultimoErroCobranca && (!doc.cobradoEm || new Date(doc.ultimoErroCobrancaEm) > new Date(doc.cobradoEm));
        const botao = forn && forn.email ? `<button class="btn btn-secondary btn-sm" onclick="enviarCobrancaDocumento('${doc.id}')">${ic('mail', 13)} Cobrar</button>` : '<span style="font-size:11px; color:var(--text-muted)">sem e-mail</span>';
        const status = falhouRecente
          ? `<div style="font-size:10px; color:var(--danger); margin-top:2px; display:flex; align-items:center; gap:3px">${ic('xCircle', 11)} envio automático falhou — use o botão</div>`
          : (doc.cobradoEm ? `<div style="font-size:10px; color:var(--success); margin-top:2px; display:flex; align-items:center; gap:3px">${ic('mail', 11)} Cobrado em ${new Date(doc.cobradoEm).toLocaleDateString('pt-BR')}</div>` : '');
        const acao = `<div style="margin-left:auto; text-align:right">${botao}${status}</div>`;
        const dotClasse = vencido ? 'dot-danger' : 'dot-warn';
        const cor = vencido ? 'var(--danger)' : 'var(--warn)';
        const label = vencido ? 'Vencido' : `Vence em ${diasParaVencer(doc.validade)}d`;
        return `<div style="display:flex; align-items:center; gap:8px; padding:7px 0; border-bottom:1px solid var(--border); font-size:12px">
          <span class="dot ${dotClasse}"></span>
          <span style="color:${cor}; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:.02em">${label}</span>
          <span><b>${forn ? forn.nome : '—'}</b> — ${doc.nome}</span>
          <span style="color:var(--text-muted)">válido até ${new Date(doc.validade + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
          ${acao}
        </div>`;
      };
      alertasDoc = `
        <div class="card alert-collapse alerta-shake" id="alerta-docs-fornecedores" style="margin-bottom:16px; animation-delay:${proximoShakeDelay()}s">
          <div class="alert-collapse-header" onclick="toggleAlertaCollapse('alerta-docs-fornecedores')">
            <div class="bar bar-danger"></div>
            <span style="flex:1; font-size:13px; font-weight:600; color:var(--danger)">Documentos de fornecedores que precisam de atenção</span>
            <span class="alert-count">${vencidos.length + proximos.length} ocorrência(s)</span>
            <span class="alert-collapse-chevron">${ic('chevronDown', 16)}</span>
          </div>
          <div class="alert-collapse-body">
            ${vencidos.map(doc => linhaDoc(doc, true)).join('')}
            ${proximos.map(doc => linhaDoc(doc, false)).join('')}
            <div style="margin-top:10px">
              <button class="btn btn-secondary btn-sm" onclick="showAdPage('fornecedores')">Ver fornecedores →</button>
            </div>
          </div>
        </div>`;
    }

    // ---------- ALERTA: DOCUMENTAÇÃO VENCIDA HÁ MUITO TEMPO (escalonamento) ----------
    // Não bloqueia nada — é só um alerta a mais quando um documento continua
    // vencido por mais tempo que a tolerância configurada, mesmo já tendo
    // sido cobrado do fornecedor várias vezes (mesma tolerância que a
    // function automática usa pra mandar o e-mail escalonado pra vocês).
    const toleranciaDias = (d.toleranciaDocumentosMeses || 6) * 30;
    const docsEscalonados = (d.documentos || []).filter(doc => -diasParaVencer(doc.validade) > toleranciaDias);
    if (docsEscalonados.length) {
      alertaDocsEscalonados = `
        <div class="card alert-collapse alerta-shake" id="alerta-docs-escalonados" style="margin-bottom:16px; animation-delay:${proximoShakeDelay()}s">
          <div class="alert-collapse-header" onclick="toggleAlertaCollapse('alerta-docs-escalonados')">
            <div class="bar bar-danger"></div>
            <span style="flex:1; font-size:13px; font-weight:600; color:var(--danger)">Documentação vencida há muito tempo, sem retorno</span>
            <span class="alert-count">${docsEscalonados.length} ocorrência(s)</span>
            <span class="alert-collapse-chevron">${ic('chevronDown', 16)}</span>
          </div>
          <div class="alert-collapse-body">
            ${docsEscalonados.map(doc => {
              const forn = d.fornecedores.find(f => f.id === doc.fornecedorId);
              const diasVencido = -diasParaVencer(doc.validade);
              return `<div style="display:flex; align-items:center; gap:8px; padding:7px 0; border-bottom:1px solid var(--border); font-size:12px">
                <span><b>${forn ? forn.nome : '—'}</b> — ${doc.nome}</span>
                <span class="badge badge-danger">vencido há ${diasVencido} dias</span>
                ${doc.cobradoEm ? `<span style="color:var(--text-muted); font-size:11px">última cobrança em ${new Date(doc.cobradoEm).toLocaleDateString('pt-BR')}</span>` : ''}
              </div>`;
            }).join('')}
            <div style="margin-top:10px">
              <button class="btn btn-secondary btn-sm" onclick="showAdPage('fornecedores')">Ver fornecedores →</button>
            </div>
          </div>
        </div>`;
    }
  }

  // ---------- ALERTA: DOCUMENTOS DE "MEUS DOCUMENTOS" VENCENDO ----------
  if (podeMeusDocumentos) {
    const { vencidos: uVencidos, proximos: uProximos } = contarUnidadesDocumentosVencendo(d);
    if (uVencidos.length || uProximos.length) {
      const linhaU = (doc, vencido) => {
        const un = d.unidades.find(u => u.id === doc.unidadeId);
        const dotClasse = vencido ? 'dot-danger' : 'dot-warn';
        const cor = vencido ? 'var(--danger)' : 'var(--warn)';
        const label = vencido ? 'Vencido' : `Vence em ${diasParaVencer(doc.validade)}d`;
        return `<div style="display:flex; align-items:center; gap:8px; padding:7px 0; border-bottom:1px solid var(--border); font-size:12px">
          <span class="dot ${dotClasse}"></span>
          <span style="color:${cor}; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:.02em">${label}</span>
          <span><b>${un ? un.nome : '—'}</b> — ${doc.nome}</span>
          <span style="color:var(--text-muted); margin-left:auto">${new Date(doc.validade + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
        </div>`;
      };
      alertasDocUnidades = `
        <div class="card alert-collapse alerta-shake" id="alerta-docs-unidades" style="margin-bottom:16px; animation-delay:${proximoShakeDelay()}s">
          <div class="alert-collapse-header" onclick="toggleAlertaCollapse('alerta-docs-unidades')">
            <div class="bar bar-danger"></div>
            <span style="flex:1; font-size:13px; font-weight:600; color:var(--danger)">Documentos de "Meus Documentos" que precisam de atenção</span>
            <span class="alert-count">${uVencidos.length + uProximos.length} ocorrência(s)</span>
            <span class="alert-collapse-chevron">${ic('chevronDown', 16)}</span>
          </div>
          <div class="alert-collapse-body">
            ${uVencidos.map(doc => linhaU(doc, true)).join('')}
            ${uProximos.map(doc => linhaU(doc, false)).join('')}
            <div style="margin-top:10px">
              <button class="btn btn-secondary btn-sm" onclick="showAdPage('meusdocumentos')">Ver Meus Documentos →</button>
            </div>
          </div>
        </div>`;
    }
  }

  // ---------- CADASTRO FISCAL INCOMPLETO (falta CNPJ e/ou Inscrição Estadual) ----------
  // Só pro admin_master — é quem consegue ir preencher em Config, e é quem
  // vai receber a nota fiscal por e-mail depois.
  let alertaCadastroFiscalHtml = '';
  if (currentUser.papel === 'admin_master') {
    const faltando = [];
    if (!(d.empresa.cnpj || '').trim()) faltando.push('CNPJ');
    if (!(d.empresa.ie || '').trim()) faltando.push('Inscrição Estadual');

    if (faltando.length) {
      alertaCadastroFiscalHtml = `
        <div class="card" style="border-left:3px solid var(--warn); margin-bottom:16px">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap">
            <div style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:600">
              ${ic('alertTriangle', 16)} Complete seu cadastro
            </div>
            <button class="btn btn-primary btn-sm" onclick="irParaCompletarCadastroFiscal()">Completar agora</button>
          </div>
          <p style="font-size:12px; color:var(--text-muted); margin-top:6px">
            Falta ${faltando.join(' e ')} da sua empresa — esse dado é necessário pra gente conseguir emitir sua nota fiscal.
          </p>
        </div>`;
    }
  }

  // ---------- ONBOARDING GUIADO ----------
  let onboardingHTML = '';
  const podeOnboarding = podeFornecedores && temAcessoModulo('formularios') && podeAvaliacoes && temAcessoModulo('usuarios');
  if (podeOnboarding && !(empresaConfigCache.config || {}).onboarding_dispensado) {
    const passos = [
      { feito: d.fornecedores.length > 0, texto: 'Cadastre seu primeiro fornecedor', modulo: 'fornecedores' },
      { feito: d.formularios.length > 0, texto: 'Crie um formulário de avaliação', modulo: 'formularios' },
      { feito: d.usuarios.some(u => u.papel === 'avaliador'), texto: 'Convide um avaliador', modulo: 'usuarios' },
    ];
    if (passos.some(p => !p.feito)) {
      onboardingHTML = `
        <div class="card" style="border-left: 3px solid var(--accent); margin-bottom:16px">
          <div style="display:flex; justify-content:space-between; align-items:center">
            <div class="card-title" style="margin-bottom:0; display:flex; align-items:center; gap:7px">${ic('wave', 16)} Primeiros passos</div>
            <button class="btn btn-secondary btn-sm" onclick="dispensarOnboarding()">Dispensar</button>
          </div>
          <div style="margin-top:10px">
            ${passos.map(p => `
              <div style="display:flex; align-items:center; gap:8px; padding:6px 0; font-size:13px; ${p.feito ? 'opacity:.5; text-decoration:line-through' : 'cursor:pointer'}" ${p.feito ? '' : `onclick="showAdPage('${p.modulo}', document.querySelector('#sidebar .nav-item[onclick*=\\'${p.modulo}\\']'))"`}>
                <span>${p.feito ? ic('check', 14) : ic('circleEmpty', 14)}</span><span>${p.texto}</span>
              </div>
            `).join('')}
          </div>
        </div>`;
    }
  }

  // ---------- ASSINATURA (mesmos campos usados em Configurações > Minha empresa) ----------
  if (temAcessoModulo('config')) {
    const STATUS_LABELS = { trial: 'Trial', ativa: 'Ativa', expirada: 'Expirada', cancelada: 'Cancelada' };
    const STATUS_BADGE_CLASS = { trial: 'trial', ativa: 'ativo', expirada: 'expirado', cancelada: 'cancelado' };
    const PLANO_LABELS = { essencial: 'Essencial', profissional: 'Profissional', enterprise: 'Enterprise' };
    const statusAtual = d.statusEmpresa || 'ativa';
    const planoLabel = d.plano ? (PLANO_LABELS[d.plano] || d.plano) : 'Nenhum plano ativo';
    const badgeTexto = STATUS_LABELS[statusAtual] || statusAtual;
    const badgeClasse = STATUS_BADGE_CLASS[statusAtual] || 'ativo';

    let trialBannerHtml = '';
    if (statusAtual === 'trial' && d.trialTerminaEm) {
      const hoje0h = new Date(); hoje0h.setHours(0, 0, 0, 0);
      const fimTrial0h = new Date(d.trialTerminaEm); fimTrial0h.setHours(0, 0, 0, 0);
      const diasRestantes = Math.round((fimTrial0h - hoje0h) / 86400000);
      trialBannerHtml = `<div class="trial-banner-inline">
        ${ic('clock', 14)}
        ${diasRestantes > 0 ? `Faltam ${diasRestantes} dia${diasRestantes > 1 ? 's' : ''} pro fim do teste grátis` : 'Seu teste grátis acabou'}
      </div>`;
    }

    let renovaHtml = '';
    if (empresaConfigCache.proxima_cobranca_em) {
      const dataRenova = new Date(empresaConfigCache.proxima_cobranca_em);
      const dias = Math.max(0, Math.ceil((dataRenova.getTime() - Date.now()) / 86400000));
      renovaHtml = `<div style="font-size:12px; color:var(--text-muted); margin-top:8px">Renova em ${dataRenova.toLocaleDateString('pt-BR')} (${dias} dia(s))</div>`;
    }

    const iconFornecedoresAssinatura = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>';
    const pctFornecedores = d.limiteFornecedores ? Math.min(100, Math.round((d.fornecedores.length / d.limiteFornecedores) * 100)) : 0;

    assinaturaHTML = `
      <div class="card">
        <div class="card-title" style="display:flex; align-items:center; justify-content:space-between">
          <span>Assinatura</span>
          <span class="plan-badge ${badgeClasse}">${badgeTexto}</span>
        </div>
        <div style="font-size:15px; font-weight:700">${planoLabel}</div>
        ${trialBannerHtml}
        ${renovaHtml}
        <div class="usage-row" style="margin-top:8px">
          <div class="usage-row-icon">${iconFornecedoresAssinatura}</div>
          <div class="usage-row-body">
            <div class="usage-row-label">Fornecedores cadastrados</div>
            ${d.limiteFornecedores !== null ? `<div class="usage-bar"><div class="usage-bar-fill" style="width:${pctFornecedores}%"></div></div>` : ''}
          </div>
          <div class="usage-row-value">${d.fornecedores.length}${d.limiteFornecedores !== null ? ' / ' + d.limiteFornecedores : ' · sem limite'}</div>
        </div>
        <div style="margin-top:6px">
          <button class="btn btn-secondary btn-sm" onclick="showAdPage('config')">Ver configurações →</button>
        </div>
      </div>`;

    lixeiraHTML = `
      <div class="card">
        <div class="card-title" style="display:flex; align-items:center; gap:7px">${ic('trash', 15)} Lixeira</div>
        <p style="font-size:12px; color:var(--text-muted); margin-bottom:12px">Fornecedores e documentos excluídos ficam aqui por 90 dias antes de serem apagados de vez — dá pra restaurar a qualquer momento nesse período.</p>
        <button class="btn btn-secondary btn-sm" style="display:inline-flex; align-items:center; gap:5px" onclick="abrirLixeira()">${ic('trash', 13)} Ver Lixeira</button>
      </div>`;
  }

  let adminGridHTML = '';
  if (assinaturaHTML || lixeiraHTML) {
    const doisCards = assinaturaHTML && lixeiraHTML;
    adminGridHTML = `<div class="admin-grid2"${doisCards ? '' : ' style="grid-template-columns:1fr"'}>${assinaturaHTML}${lixeiraHTML}</div>`;
  }

  // ---------- ATIVIDADE RECENTE (mesmo dado que já alimenta o Log de auditoria) ----------
  if (temAcessoModulo('auditoria')) {
    const logsRecentes = (d.logs || []).slice(0, 6);
    if (logsRecentes.length) {
      atividadeHTML = `
        <div class="card">
          <div class="card-title" style="display:flex; align-items:center; justify-content:space-between">
            <span>Atividade recente</span>
            <button class="btn btn-secondary btn-sm" onclick="showAdPage('auditoria')">Ver tudo →</button>
          </div>
          ${logsRecentes.map(l => `
            <div class="log-item">
              <div class="log-dot"></div>
              <div class="log-text">
                <span><b>${escapeHtml(l.usuario)}</b> — ${escapeHtml(l.detalhe)}</span>
                <div class="log-time">${fmtData(l.timestamp)}</div>
              </div>
            </div>`).join('')}
        </div>`;
    }
  }

  let insightGridHTML = '';
  if (rankingHistoricoHTML || atividadeHTML) {
    const doisCards2 = rankingHistoricoHTML && atividadeHTML;
    insightGridHTML = `<div class="admin-grid2"${doisCards2 ? '' : ' style="grid-template-columns:1fr"'}>${rankingHistoricoHTML}${atividadeHTML}</div>`;
  }

  const semNadaParaMostrar = !alertaCadastroFiscalHtml && !alertaAprovacao && !alertaAvaliadoresPendentesHTML && !alertaNotificar && !alertaNotificarProduto && !alertaPlanoAcaoAprovacao && !alertaPlanoAcaoAtrasado && !alertasDoc && !alertaDocsEscalonados && !alertasDocUnidades && !dashGrid2HTML && !insightGridHTML && !graficosHTML && !tabelaHTML && !adminGridHTML;
  document.getElementById('ad-page-dashboard').innerHTML = `
    <div class="page-header"><div><h2>Dashboard e notificações</h2><p>${MESES[mesAtual]} de ${anoAtual}</p></div></div>
    ${alertaCadastroFiscalHtml}
    ${onboardingHTML}
    ${alertaAprovacao}
    ${alertaAvaliadoresPendentesHTML}
    ${alertaNotificar}
    ${alertaNotificarProduto}
    ${alertaPlanoAcaoAprovacao}
    ${alertaPlanoAcaoAtrasado}
    ${alertasDoc}
    ${alertaDocsEscalonados}
    ${alertasDocUnidades}
    ${adminGridHTML}
    ${dashGrid2HTML}
    ${insightGridHTML}
    ${graficosHTML}
    ${tabelaHTML}
    ${semNadaParaMostrar ? '<div class="card"><div class="empty-state"><p>Nenhum módulo com dados pra mostrar aqui — os módulos liberados pra você aparecem no menu ao lado.</p></div></div>' : ''}
  `;
}

// Colapsa/expande um card de alerta clicando no cabeçalho.
function toggleAlertaCollapse(cardId) {
  const card = document.getElementById(cardId);
  if (card) card.classList.toggle('open');
}

// ---------- MINI-RELATÓRIO "AVALIAÇÕES ENVIADAS" (popup do stat-card) ----------
// Por setor (= cada formulário), calcula quantas associações fornecedor↔avaliador
// daquele formulário já foram avaliadas neste mês vs. quantas deveriam ser.
// Isso dá o % de conclusão do setor (bate com a lógica do stat-card "Pendentes").
function calcularSetoresEnviadosMes(d, chaveMes) {
  return d.formularios.map(form => {
    const assocsDoForm = d.associacoes.filter(a => a.formularioId === form.id);
    const total = assocsDoForm.length;
    if (!total) return null;
    const completos = assocsDoForm.filter(a =>
      d.avaliacoes.some(av => av.formularioId === form.id && av.fornecedorId === a.fornecedorId && av.usuarioId === a.usuarioId && av.periodo === chaveMes)
    ).length;
    return { formId: form.id, nome: form.nome, total, completos, pct: Math.round((completos / total) * 100) };
  }).filter(Boolean).sort((a, b) => b.pct - a.pct || a.nome.localeCompare(b.nome));
}

function barraPercentualHTML(label, pct) {
  const cor = pct >= 100 ? 'var(--success)' : (pct > 0 ? 'var(--warn)' : 'var(--danger)');
  return `
    <div style="margin-bottom:12px">
      <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px">
        <span>${label}</span><span style="font-weight:700; color:${cor}">${pct}%</span>
      </div>
      <div style="background:var(--surface2); border-radius:6px; height:9px; overflow:hidden">
        <div style="width:${pct}%; height:100%; background:${cor}; border-radius:6px; transition:width .3s"></div>
      </div>
    </div>`;
}

function renderAvaliacoesTable(lista, d) {
  if (!lista.length) return '<div class="empty-state"><p>Nenhuma avaliação registrada ainda.</p></div>';
  return `<table>
    <thead><tr><th>Formulário</th><th>Fornecedor</th><th>Enviado por</th><th style="text-align:center">Nota</th><th>Situação</th><th>Data</th></tr></thead>
    <tbody>
      ${lista.map(av => {
        const form = d.formularios.find(f => f.id === av.formularioId);
        const forn = d.fornecedores.find(f => f.id === av.fornecedorId);
        const sit = av.semServico ? null : getSituacao(av.nota);
        return `<tr>
          <td style="font-weight:500">${form ? form.nome : '—'}</td>
          <td>${forn ? forn.nome : '—'}</td>
          <td style="color:var(--text-sec)">${av.enviadoPor}</td>
          <td style="text-align:center; font-weight:600">${av.semServico ? '—' : av.nota.toFixed(1)}</td>
          <td>${av.semServico ? '<span class="badge badge-neutral">Sem serviço</span>' : badgeSit(sit)}</td>
          <td style="color:var(--text-muted); font-size:11px">${fmtData(av.enviadoEm)}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;
}

// ---------- APROVAÇÃO DE DOCUMENTOS ENVIADOS PELO PORTAL ----------
// Essas 3 funções ficavam em fornecedores.js (o bloco de "aguardando
// aprovação" morava lá) e ficaram pra trás quando o bloco foi movido pra cá.
// O resto da lógica é idêntica à original, só troquei a chamada de
// renderPendentesAprovacao() por renderAdDashboard() (que é quem redesenha
// esse alerta agora).

async function baixarPendenteAprovacao(pendenteId) {
  const d = db();
  const p = (d.documentosPendentesAprovacao || []).find(x => x.id === pendenteId);
  if (!p || !p.caminhoStorage) return;
  try {
    await r2Baixar(p.caminhoStorage, p.nomeArquivo || 'documento');
  } catch (error) { toast('Erro ao abrir arquivo: ' + error.message); }
}

async function aprovarPendenteAprovacao(pendenteId) {
  const d = db();
  const p = (d.documentosPendentesAprovacao || []).find(x => x.id === pendenteId);
  if (!p) return;
  const doc = d.documentos.find(x => x.id === p.documentoId);
  if (!doc) { toast('Documento original não existe mais.'); return; }

  // Mesma lógica de "substituir arquivo": guarda a versão atual no histórico.
  if (doc.caminhoStorage) {
    await supabaseClient.from('documentos_versoes').insert({
      documento_id: doc.id, empresa_id: currentUser.empresaId,
      nome_arquivo: doc.nomeArquivo, caminho_storage: doc.caminhoStorage, substituido_por: currentUser.id,
    });
  }

  const { error: updErr } = await supabaseClient.from('documentos').update({
    validade: p.novaValidade, nome_arquivo: p.nomeArquivo, caminho_storage: p.caminhoStorage, cobrado_em: null,
  }).eq('id', doc.id);
  if (updErr) { toast('Erro ao aprovar: ' + updErr.message); return; }

  const { error: pendErr } = await supabaseClient.from('documentos_pendentes_aprovacao').update({
    status: 'aprovado', revisado_por: currentUser.id, revisado_em: new Date().toISOString(),
  }).eq('id', pendenteId);
  if (pendErr) { toast('Erro ao atualizar status: ' + pendErr.message); return; }

  if (doc.caminhoStorage) await limparVersoesAntigasDocumento(doc.id);

  addLog('documento_pendente_aprovado', `${currentUser.email} aprovou o documento enviado pelo portal (documento: "${doc.nome}")`);
  await carregarDocumentos();
  await carregarDocumentosVersoes();
  await carregarDocumentosPendentesAprovacao();
  renderAdDashboard();
  if (typeof renderAdFornecedores === 'function') renderAdFornecedores();
  toast('Aprovado! O documento já está atualizado.');
}

async function rejeitarPendenteAprovacao(pendenteId) {
  const motivo = prompt('Motivo da rejeição (opcional, o fornecedor não vê isso — é só pra seu controle):') || null;

  const d = db();
  const p = (d.documentosPendentesAprovacao || []).find(x => x.id === pendenteId);

  const { error } = await supabaseClient.from('documentos_pendentes_aprovacao').update({
    status: 'rejeitado', motivo_rejeicao: motivo, revisado_por: currentUser.id, revisado_em: new Date().toISOString(),
  }).eq('id', pendenteId);
  if (error) { toast('Erro ao rejeitar: ' + error.message); return; }

  // O registro em si fica no banco pra histórico/auditoria (quem rejeitou,
  // quando e por quê) — só o arquivo em si é removido do R2, já que um
  // documento rejeitado não serve mais pra nada e não vale a pena manter
  // ocupando espaço de armazenamento.
  if (p && p.caminhoStorage) {
    try { await r2Remover(p.caminhoStorage); }
    catch (e) { console.error('Falha ao remover arquivo rejeitado do R2:', e); }
  }

  addLog('documento_pendente_rejeitado', `${currentUser.email} rejeitou um documento enviado pelo portal`);
  await carregarDocumentosPendentesAprovacao();
  renderAdDashboard();
  toast('Rejeitado. O fornecedor pode enviar de novo pelo mesmo link.');
}

// Chamado pelo card "Complete seu cadastro" no dashboard — leva direto pra
// Config > Minha empresa, já na aba certa, sem o usuário precisar achar
// o caminho sozinho.
async function irParaCompletarCadastroFiscal() {
  const navBtn = document.querySelector("#sidebar .nav-item[onclick*='config']");
  showAdPage('config', navBtn);
  await renderAdConfig(); // garante que a aba já existe no DOM antes de trocar de sub-aba
  const tabBtn = document.querySelector('#ad-page-config .config-tab-btn[onclick*="\'empresa\'"]');
  if (tabBtn) showConfigTabAd('empresa', tabBtn);
}
