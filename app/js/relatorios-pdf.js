// relatorios-pdf.js
// versão: 08
// última atualização: 21/08/2026 17:30

// ============ RELATÓRIO & PDFs ============
// ---------- RELATÓRIO & PDFs ----------
let _ultimosResultadosAd = [];
let _ultimoPeriodoAd = '';
function renderAdRelatorio() {
  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();
  const d = db();
  document.getElementById('ad-page-relatorio').innerHTML = `
    <div class="page-header"><div><h2>Relatório & PDFs</h2><p>Selecione o período e gere certificados e cartas automaticamente</p></div></div>
    <div class="card">
      <div class="card-title">Desconto por documentação vencida</div>
      <p style="font-size:12px; color:var(--text-muted); margin-bottom:12px">Desligado por padrão. Calculado aqui, no fechamento do período (mesmo período usado pra gerar certificado/carta abaixo), com base em quantos dias o documento ficou vencido dentro daquele período — não é mais aplicado lançamento a lançamento no Avaliar.</p>
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:${d.descontoDocVencidoAtivo ? '14px' : '0'}">
        <input type="checkbox" id="desconto-doc-ativo" ${d.descontoDocVencidoAtivo ? 'checked' : ''} onchange="toggleDescontoDocVencidoVisibilidade()">
        <label style="margin:0">Descontar por documentação vencida</label>
      </div>
      <div id="desconto-doc-valor-wrap" style="display:${d.descontoDocVencidoAtivo ? 'block' : 'none'}">
        <div class="form-row" style="grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:10px">
          <div class="form-group" style="margin:0"><label>Desconta quanto</label><input type="number" step="0.1" min="0" id="desconto-doc-valor" value="${d.valorDescontoDocVencido}"></div>
          <div class="form-group" style="margin:0"><label>A cada quantos dias vencido</label><input type="number" step="1" min="1" id="desconto-doc-dias" value="${d.descontoDocVencidoDiasIntervalo}"></div>
        </div>
        <p style="font-size:11px; color:var(--text-muted); margin:-4px 0 10px">Ex.: -${d.valorDescontoDocVencido} a cada ${d.descontoDocVencidoDiasIntervalo} dias vencido. Só conta intervalos completos (${d.descontoDocVencidoDiasIntervalo} dias vencido = 1 vez; ${d.descontoDocVencidoDiasIntervalo * 2 - 1} dias = ainda 1 vez).</p>
        <div class="form-row" style="grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:10px">
          <div class="form-group" style="margin:0"><label>Desconto máximo (opcional)</label><input type="number" step="0.1" min="0" id="desconto-doc-max" placeholder="Sem teto" value="${d.descontoDocVencidoMax ?? ''}"></div>
          <div class="form-group" style="margin:0"><label>Aplica em</label>
            <select id="desconto-doc-aplica-em">
              <option value="produto" ${d.descontoDocVencidoAplicaEm === 'produto' ? 'selected' : ''}>Produto</option>
              <option value="servico" ${d.descontoDocVencidoAplicaEm === 'servico' ? 'selected' : ''}>Serviço</option>
              <option value="ambos" ${d.descontoDocVencidoAplicaEm === 'ambos' ? 'selected' : ''}>Ambos</option>
            </select>
          </div>
        </div>
        <button class="btn btn-primary" onclick="salvarDescontoDocVencido()">Salvar</button>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Período de avaliação</div>
      <div class="form-row three">
        <div class="form-group"><label>Mês inicial</label><select id="rel-mes-ini">${MESES.slice(1).map((m,i)=>`<option value="${i+1}" ${i+1===mesAtual?'selected':''}>${m}</option>`).join('')}</select></div>
        <div class="form-group"><label>Ano inicial</label><input type="number" id="rel-ano-ini" value="${anoAtual}"></div>
        <div></div>
        <div class="form-group"><label>Mês final</label><select id="rel-mes-fim">${MESES.slice(1).map((m,i)=>`<option value="${i+1}" ${i+1===mesAtual?'selected':''}>${m}</option>`).join('')}</select></div>
        <div class="form-group"><label>Ano final</label><input type="number" id="rel-ano-fim" value="${anoAtual}"></div>
      </div>
      <button class="btn btn-primary" onclick="gerarRelatorioAd()">Calcular médias</button>
    </div>
    <div id="relatorio-resultado-ad"></div>
  `;
}

function toggleDescontoDocVencidoVisibilidade() {
  const ativo = document.getElementById('desconto-doc-ativo').checked;
  document.getElementById('desconto-doc-valor-wrap').style.display = ativo ? 'block' : 'none';
  salvarDescontoDocVencido();
}

async function salvarDescontoDocVencido() {
  const ativo = document.getElementById('desconto-doc-ativo').checked;
  const valorInput = document.getElementById('desconto-doc-valor');
  const diasInput = document.getElementById('desconto-doc-dias');
  const maxInput = document.getElementById('desconto-doc-max');
  const aplicaEmSelect = document.getElementById('desconto-doc-aplica-em');

  const valor = valorInput ? (parseFloat(valorInput.value) || 0) : db().valorDescontoDocVencido;
  const dias = diasInput ? (parseInt(diasInput.value) || 15) : db().descontoDocVencidoDiasIntervalo;
  const max = maxInput && maxInput.value !== '' ? (parseFloat(maxInput.value) || 0) : null;
  const aplicaEm = aplicaEmSelect ? aplicaEmSelect.value : db().descontoDocVencidoAplicaEm;

  const { error } = await supabaseClient.from('empresas').update({
    desconto_doc_vencido_ativo: ativo,
    valor_desconto_doc_vencido: valor,
    desconto_doc_vencido_dias_intervalo: dias,
    desconto_doc_vencido_max: max,
    desconto_doc_vencido_aplica_em: aplicaEm,
  }).eq('id', currentUser.empresaId);
  if (error) { toast('Erro ao salvar configuração: ' + error.message); return; }

  empresaConfigCache.desconto_doc_vencido_ativo = ativo;
  empresaConfigCache.valor_desconto_doc_vencido = valor;
  empresaConfigCache.desconto_doc_vencido_dias_intervalo = dias;
  empresaConfigCache.desconto_doc_vencido_max = max;
  empresaConfigCache.desconto_doc_vencido_aplica_em = aplicaEm;
  addLog('desconto_doc_vencido_atualizado', `${currentUser.email} ${ativo ? 'ligou' : 'desligou'} o desconto por documentação vencida`);
  toast('Configuração salva!');
}

// Avaliação de produto não tem campo "periodo" pronto (tem uma data cheia, tipo
// "2026-07-05") — essa função extrai o "ano-mes" dela pra comparar com o período
// escolhido no relatório, do mesmo jeito que já é feito pras avaliações de serviço.
function periodoDeData(dataStr) {
  if (!dataStr) return null;
  const [ano, mes] = dataStr.split('-');
  return `${parseInt(ano, 10)}-${parseInt(mes, 10)}`;
}

// ---- Desconto por documentação vencida, calculado por período ----
// Substitui o antigo desconto fixo "por lançamento de NF". Agora, no
// fechamento do período (aqui, na geração do relatório/certificado/carta),
// olhamos o HISTÓRICO de validade de cada documento do fornecedor
// (documentos_historico_validade) e calculamos quantos dias, dentro do
// período selecionado, o fornecedor ficou com pelo menos um documento
// vencido — a mesma regra "um dia vencido conta uma vez só, não importa
// quantos documentos estejam vencidos" que já valia no desconto antigo.

function _diaUTC(valor) {
  // Normaliza qualquer data (string "YYYY-MM-DD", timestamptz, ou Date) pro
  // início do dia em UTC, só pra poder somar/subtrair em dias sem sustos de
  // fuso horário.
  const d = valor instanceof Date ? valor : new Date(valor);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function _somaDias(dataUTC, dias) {
  return new Date(dataUTC.getTime() + dias * 86400000);
}

// Busca o histórico de validade de todos os documentos da empresa de uma
// vez (mais barato que ficar consultando fornecedor a fornecedor) e agrupa
// por fornecedor, já em segmentos ordenados por data.
async function _buscarHistoricoValidadePorFornecedor() {
  const { data, error } = await supabaseClient
    .from('documentos_historico_validade')
    .select('documento_id, fornecedor_id, validade_nova, alterado_em')
    .eq('empresa_id', currentUser.empresaId)
    .order('alterado_em', { ascending: true });

  if (error) {
    console.error('Erro ao carregar histórico de validade:', error.message);
    return {};
  }

  const porFornecedor = {};
  (data || []).forEach(row => {
    if (!porFornecedor[row.fornecedor_id]) porFornecedor[row.fornecedor_id] = {};
    const porDoc = porFornecedor[row.fornecedor_id];
    if (!porDoc[row.documento_id]) porDoc[row.documento_id] = [];
    porDoc[row.documento_id].push({ validade: row.validade_nova, desde: new Date(row.alterado_em) });
  });
  return porFornecedor;
}

// Dado o histórico de um fornecedor (já agrupado por documento) e um
// período [periodoIni, periodoFim] (Date, em dia UTC), retorna quantos dias
// desse período o fornecedor ficou com PELO MENOS UM documento vencido.
function _diasComDocumentoVencidoNoPeriodo(historicoPorDoc, periodoIni, periodoFim) {
  if (!historicoPorDoc || periodoFim < periodoIni) return 0;
  const agora = _diaUTC(new Date());
  const fimReal = periodoFim > agora ? agora : periodoFim; // não conta dias no futuro

  // Junta os intervalos "vencido" de todos os documentos do fornecedor.
  const intervalos = [];
  Object.values(historicoPorDoc).forEach(registros => {
    for (let i = 0; i < registros.length; i++) {
      const segIni = _diaUTC(registros[i].desde);
      const segFim = i + 1 < registros.length ? _diaUTC(registros[i + 1].desde) : _somaDias(fimReal, 1);
      if (!registros[i].validade) continue; // documento sem validade cadastrada — não conta
      const vencidoDesde = _somaDias(_diaUTC(registros[i].validade), 1); // primeiro dia já vencido
      const ini = vencidoDesde > segIni ? vencidoDesde : segIni;
      const fim = segFim;
      // recorta pro período que estamos calculando
      const iniRecortado = ini > periodoIni ? ini : periodoIni;
      const fimRecortado = fim < _somaDias(fimReal, 1) ? fim : _somaDias(fimReal, 1);
      if (iniRecortado < fimRecortado) intervalos.push([iniRecortado.getTime(), fimRecortado.getTime()]);
    }
  });
  if (!intervalos.length) return 0;

  // Une os intervalos (união) e soma os dias cobertos.
  intervalos.sort((a, b) => a[0] - b[0]);
  let totalMs = 0;
  let [curIni, curFim] = intervalos[0];
  for (let i = 1; i < intervalos.length; i++) {
    const [ini, fim] = intervalos[i];
    if (ini <= curFim) { if (fim > curFim) curFim = fim; }
    else { totalMs += curFim - curIni; curIni = ini; curFim = fim; }
  }
  totalMs += curFim - curIni;
  return Math.round(totalMs / 86400000);
}

// Calcula o desconto (em pontos) pra um fornecedor num período, já
// aplicando intervalo em dias e teto configurados.
function _calcularDescontoDocVencido(d, historicoPorFornecedor, fornecedorId, periodoIni, periodoFim) {
  const dias = _diasComDocumentoVencidoNoPeriodo(historicoPorFornecedor[fornecedorId], periodoIni, periodoFim);
  if (!dias) return { dias: 0, desconto: 0 };
  const intervalo = d.descontoDocVencidoDiasIntervalo || 15;
  const intervalosCompletos = Math.floor(dias / intervalo);
  let desconto = intervalosCompletos * d.valorDescontoDocVencido;
  if (d.descontoDocVencidoMax != null) desconto = Math.min(desconto, d.descontoDocVencidoMax);
  return { dias, desconto };
}

async function gerarRelatorioAd() {
  const mesIni = parseInt(document.getElementById('rel-mes-ini').value);
  const anoIni = parseInt(document.getElementById('rel-ano-ini').value);
  const mesFim = parseInt(document.getElementById('rel-mes-fim').value);
  const anoFim = parseInt(document.getElementById('rel-ano-fim').value);
  const d = db();

  if (anoIni > anoFim || (anoIni === anoFim && mesIni > mesFim)) { toast('Período inválido.'); return; }

  const periodos = [];
  let m = mesIni, a = anoIni;
  while (a < anoFim || (a === anoFim && m <= mesFim)) { periodos.push(`${a}-${m}`); m++; if (m > 12) { m = 1; a++; } }

  const periodoIniUTC = new Date(Date.UTC(anoIni, mesIni - 1, 1));
  const periodoFimUTC = new Date(Date.UTC(anoFim, mesFim, 0)); // último dia do mês final

  const descontoAtivo = d.descontoDocVencidoAtivo;
  const aplicaEm = d.descontoDocVencidoAplicaEm || 'produto';
  const historicoPorFornecedor = descontoAtivo ? await _buscarHistoricoValidadePorFornecedor() : {};

  const resultados = d.fornecedores.flatMap(f => {
    const linhas = [];
    // Fornecedor de Produto: qualquer fornecedor com lançamento de nota fiscal no
    // período entra aqui, independente do "tipo" cadastrado — o cadastro pode
    // estar como "serviço" e mesmo assim ter avaliação de produto lançada (a
    // busca por CNPJ do Avaliar Produto não trava por tipo), então não dá pra
    // confiar só no f.tipo pra decidir se o fornecedor aparece no relatório.
    const avsP = d.avaliacoesProduto.filter(av => av.fornecedorId === f.id && periodos.includes(periodoDeData(av.data)));
    if (avsP.length) {
      let media = avsP.reduce((s, av) => s + av.notaGeral, 0) / avsP.length;
      const avaliadorIds = [...new Set(avsP.map(av => av.usuarioId).filter(Boolean))];
      let descontoDocVencido = null;
      if (descontoAtivo && (aplicaEm === 'produto' || aplicaEm === 'ambos')) {
        const { dias, desconto } = _calcularDescontoDocVencido(d, historicoPorFornecedor, f.id, periodoIniUTC, periodoFimUTC);
        if (desconto > 0) { descontoDocVencido = { dias, desconto }; media = Math.max(0, media - desconto); }
      }
      const sit = getSituacao(media);
      linhas.push({ ...f, id: `${f.id}__produto`, tipo: 'produto', media, sit, meses: avsP.length, totalMeses: periodos.length, avaliadorIds, descontoDocVencido });
    }
    // Fornecedor de Serviço: mesma lógica, mas pelas avaliações normais.
    const avs = d.avaliacoes.filter(av => av.fornecedorId === f.id && periodos.includes(av.periodo) && !av.semServico);
    if (avs.length) {
      let media = avs.reduce((s, av) => s + av.nota, 0) / avs.length;
      const avaliadorIds = [...new Set(avs.map(av => av.usuarioId).filter(Boolean))];
      const formularioIdsUsados = [...new Set(avs.map(av => av.formularioId).filter(Boolean))];
      const descricaoAvaliado = formularioIdsUsados
        .map(fid => d.formularios.find(fm => fm.id === fid))
        .map(fm => fm && fm.descricaoAvaliado)
        .filter(Boolean)
        .join(', ');
      let descontoDocVencido = null;
      if (descontoAtivo && (aplicaEm === 'servico' || aplicaEm === 'ambos')) {
        const { dias, desconto } = _calcularDescontoDocVencido(d, historicoPorFornecedor, f.id, periodoIniUTC, periodoFimUTC);
        if (desconto > 0) { descontoDocVencido = { dias, desconto }; media = Math.max(0, media - desconto); }
      }
      const sit = getSituacao(media);
      linhas.push({ ...f, id: `${f.id}__servico`, tipo: 'servico', media, sit, meses: avs.length, totalMeses: periodos.length, avaliadorIds, descricaoAvaliado, descontoDocVencido });
    }
    return linhas;
  });

  const periodoLabel = `${MESES[mesIni]}/${anoIni}` + (mesIni === mesFim && anoIni === anoFim ? '' : ` a ${MESES[mesFim]}/${anoFim}`);
  const wrap = document.getElementById('relatorio-resultado-ad');

  if (!resultados.length) {
    wrap.innerHTML = '<div class="card"><div class="empty-state"><p>Nenhuma avaliação encontrada para fornecedores neste período.</p></div></div>';
    return;
  }

  _ultimosResultadosAd = resultados;
  _ultimoPeriodoAd = periodoLabel;
  _selecionadosEmailAd.clear();

  wrap.innerHTML = `
    <div class="card">
      <div class="card-title">Resultados — ${periodoLabel}</div>
      <table>
        <thead><tr>
          <th style="width:32px"><input type="checkbox" id="chk-selecionar-todos-ad" onchange="toggleSelecionarTodosAd(this.checked)"></th>
          <th>Fornecedor</th><th>Tipo</th><th style="text-align:center">Média</th><th style="text-align:center">Avaliações</th><th>Situação</th><th style="text-align:right">Ações</th></tr></thead>
        <tbody>
          ${resultados.map(r => `<tr>
            <td><input type="checkbox" class="chk-selecionar-ad" data-id="${r.id}" onchange="toggleSelecaoEnvioAd('${r.id}', this.checked)"></td>
            <td style="font-weight:500">${r.nome}</td>
            <td><span class="tag-${r.tipo}">${r.tipo === 'produto' ? 'Produto' : 'Serviço'}</span></td>
            <td style="text-align:center; font-weight:600">${r.media.toFixed(1)}${r.descontoDocVencido ? `<div style="font-weight:400; font-size:11px; color:var(--danger)" title="${r.descontoDocVencido.dias} dia(s) com documentação vencida no período">-${r.descontoDocVencido.desconto.toFixed(1)} doc. vencida</div>` : ''}</td>
            <td style="text-align:center; color:var(--text-muted)">${r.meses}/${r.totalMeses}</td>
            <td>${badgeSit(r.sit)}</td>
            <td><div class="actions">
              <button class="btn btn-secondary btn-sm" onclick="baixarPDFIndividual('${r.id}')" title="Gerar apenas o PDF deste fornecedor" style="display:inline-flex; align-items:center; gap:6px">${ic('fileText', 13)}PDF</button>
            </div></td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div style="display:flex; justify-content:flex-end; margin-top:18px; gap:10px">
        <button class="btn btn-secondary" onclick='exportarExcelAd(${JSON.stringify(resultados).replace(/'/g,"&apos;")}, "${periodoLabel}")'>Exportar Excel</button>
        <button class="btn btn-success" onclick='gerarPDFsAd(${JSON.stringify(resultados).replace(/'/g,"&apos;")}, "${periodoLabel}")' style="display:inline-flex; align-items:center; gap:6px">${ic('fileText', 13)}Gerar PDFs (ZIP)</button>
        <button class="btn btn-primary" id="btn-enviar-selecionados-ad" onclick="enviarSelecionadosEmailAd()" disabled style="display:inline-flex; align-items:center; gap:6px">${ic('mail', 13)}Enviar selecionados</button>
      </div>
    </div>
  `;
}

// ---- Seleção + envio em lote por e-mail (com PDF anexado de verdade, via Resend) ----
const _selecionadosEmailAd = new Set();

function toggleSelecaoEnvioAd(fornecedorId, marcado) {
  if (marcado) _selecionadosEmailAd.add(fornecedorId); else _selecionadosEmailAd.delete(fornecedorId);
  const todosChk = document.getElementById('chk-selecionar-todos-ad');
  if (todosChk) todosChk.checked = _ultimosResultadosAd.length > 0 && _selecionadosEmailAd.size === _ultimosResultadosAd.length;
  atualizarBotaoEnviarSelecionadosAd();
}

function toggleSelecionarTodosAd(marcado) {
  _selecionadosEmailAd.clear();
  if (marcado) _ultimosResultadosAd.forEach(r => _selecionadosEmailAd.add(r.id));
  document.querySelectorAll('.chk-selecionar-ad').forEach(chk => { chk.checked = marcado; });
  atualizarBotaoEnviarSelecionadosAd();
}

function atualizarBotaoEnviarSelecionadosAd() {
  const btn = document.getElementById('btn-enviar-selecionados-ad');
  if (!btn) return;
  const n = _selecionadosEmailAd.size;
  btn.disabled = n === 0;
  btn.innerHTML = `${ic('mail', 13)}Enviar selecionados${n ? ` (${n})` : ''}`;
}

// Converte o Uint8Array do PDF (retorno de gerarPDFDoc) pra base64, em pedaços,
// pra não estourar o limite de argumentos do String.fromCharCode com PDFs grandes.
function _uint8ParaBase64(bytes) {
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function enviarSelecionadosEmailAd() {
  const ids = Array.from(_selecionadosEmailAd);
  if (!ids.length) return;
  const btn = document.getElementById('btn-enviar-selecionados-ad');
  const linhas = ids.map(id => _ultimosResultadosAd.find(r => r.id === id)).filter(Boolean);
  const semEmail = linhas.filter(r => !r.email);
  const comEmail = linhas.filter(r => r.email);

  if (!comEmail.length) { toast('Nenhum dos selecionados tem e-mail cadastrado.'); return; }

  let enviados = 0, falhas = 0;
  for (let i = 0; i < comEmail.length; i++) {
    const r = comEmail[i];
    if (btn) btn.innerHTML = `Enviando ${i + 1} de ${comEmail.length}...`;
    try {
      const pdf = gerarPDFDoc(r, _ultimoPeriodoAd);
      const pdfBase64 = _uint8ParaBase64(new Uint8Array(pdf));
      const { data, error } = await supabaseClient.functions.invoke('enviar-certificado-pdf-email', {
        body: {
          fornecedorId: r.id.replace(/__produto$|__servico$/, ''),
          tipo: r.tipo,
          periodoLabel: _ultimoPeriodoAd,
          sit: r.sit,
          subtitulo: getSubtituloDoc(r.sit),
          tituloDoc: getTituloDoc(r.sit),
          media: r.media,
          pdfBase64,
          pdfNomeArquivo: nomeArquivoDoc(r),
          avaliadorIds: r.avaliadorIds || [],
        },
      });
      if (error || !data || data.ok === false) { falhas++; } else { enviados++; }
    } catch (e) { falhas++; }
  }

  addLog('certificados_enviados_lote', `${currentUser.email} enviou ${enviados} certificado(s)/carta(s) por e-mail referente ao período ${_ultimoPeriodoAd}`);

  const partes = [`${enviados} enviado(s)`];
  if (semEmail.length) partes.push(`${semEmail.length} pulado(s) por falta de e-mail`);
  if (falhas) partes.push(`${falhas} falhou(aram)`);
  toast(partes.join(', ') + '.');

  atualizarBotaoEnviarSelecionadosAd();
}

// Aceita tanto o formato antigo (template = string simples) quanto o novo
// (template = array de runs, ver normalizarRuns mais abaixo) — nesse segundo
// caso substitui as variáveis dentro do texto de cada run, preservando a
// formatação (negrito/itálico) de cada trecho.
function aplicarTexto(template, fornecedor, nota, periodo, empresa, avaliado) {
  const substituir = (str) => String(str ?? '')
    .replace(/{fornecedor}/g, fornecedor).replace(/{nota}/g, nota).replace(/{periodo}/g, periodo)
    .replace(/{empresa}/g, empresa).replace(/{avaliado}/g, avaliado || '');
  if (Array.isArray(template)) return template.map(r => ({ ...r, texto: substituir(r.texto) }));
  return substituir(template);
}

function getTipoDoc(sit, tipo) {
  if (sit === 'certificado') return tipo === 'produto' ? 'cert-prod' : 'cert-serv';
  if (sit === 'aprovado') return tipo === 'produto' ? 'aprov-prod' : 'aprov-serv';
  if (sit === 'parcial') return tipo === 'produto' ? 'parcial-prod' : 'parcial-serv';
  return tipo === 'produto' ? 'reprov-prod' : 'reprov-serv';
}
function getTituloDoc(sit) { return sit === 'certificado' ? 'CERTIFICADO DE APROVAÇÃO' : 'CARTA DE AVALIAÇÃO'; }
function getSubtituloDoc(sit) {
  if (sit === 'certificado') return 'APROVADO COM NOTA MÁXIMA';
  if (sit === 'aprovado') return 'APROVADO';
  if (sit === 'parcial') return 'PARCIALMENTE APROVADO';
  return 'REPROVADO';
}

function hexParaRGB(hex) {
  const h = (hex || '#000000').replace('#', '');
  return [parseInt(h.substr(0,2),16) || 0, parseInt(h.substr(2,2),16) || 0, parseInt(h.substr(4,2),16) || 0];
}

// jsPDF não tem align:'justify' nativo — calcula a posição x de cada palavra,
// esticando o espaço entre elas até a linha ocupar exatamente "largura" (mesmo
// efeito do text-align:justify do CSS). Separado de desenharLinhaJustificada pra
// poder ser reaproveitado também no preview do editor de layout (config.js),
// que não desenha no PDF mas precisa saber onde cada palavra vai cair.
function calcularPosicoesJustificadas(doc, linha, x, largura) {
  const palavras = linha.split(' ').filter(Boolean);
  if (palavras.length <= 1) return [{ palavra: linha, x }];
  const larguraPalavras = palavras.reduce((soma, p) => soma + doc.getTextWidth(p), 0);
  const espacoEntrePalavras = (largura - larguraPalavras) / (palavras.length - 1);
  let curX = x;
  return palavras.map(p => {
    const posicao = { palavra: p, x: curX };
    curX += doc.getTextWidth(p) + espacoEntrePalavras;
    return posicao;
  });
}
function desenharLinhaJustificada(doc, linha, x, y, largura) {
  calcularPosicoesJustificadas(doc, linha, x, largura).forEach(p => doc.text(p.palavra, p.x, y));
}

// Fonte única de verdade sobre onde cada linha de um bloco quebra e (se
// align:'justify') onde cada palavra fica posicionada. Usada tanto na geração
// do PDF de verdade (gerarPDFDoc, logo abaixo) quanto no preview do editor de
// layout (renderLayoutBlocks, em config.js) — os dois chamam essa mesma função,
// passando uma instância de jsPDF já com a fonte/tamanho do bloco aplicados
// (doc.setFont/doc.setFontSize), pra garantir que o preview NUNCA decida uma
// quebra de linha diferente da que vai sair no PDF (o navegador não entra
// nessa decisão em nenhum momento).
// Retorna uma linha por item: { linha, y, vazio, posicoes, larguraLinha }.
// "posicoes" só vem preenchido quando a linha deve ser desenhada palavra a
// palavra (justify e não é a última linha do parágrafo); nos outros casos é
// null. "larguraLinha" (largura real do texto da linha, medida pelo próprio
// jsPDF) só vem preenchida quando NÃO é justify — é o que o preview usa pra
// posicionar linhas center/right sem depender do text-align do CSS (que mede a
// largura com a métrica do navegador, não a do jsPDF).
function calcularLinhasBloco(doc, texto, b) {
  const largura = b.largura || 160;
  const linhas = doc.splitTextToSize(texto, largura);
  let y = b.y;
  return linhas.map((linha, i) => {
    const proximaLinha = linhas[i + 1];
    const ehUltimaDoParagrafo = (i === linhas.length - 1) || (proximaLinha !== undefined && proximaLinha.trim() === '');
    const vazio = !linha.trim();
    const justificar = !vazio && b.align === 'justify' && !ehUltimaDoParagrafo;
    const item = {
      linha, y, vazio,
      posicoes: justificar ? calcularPosicoesJustificadas(doc, linha, b.x, largura) : null,
      larguraLinha: (!vazio && !justificar) ? doc.getTextWidth(linha) : null
    };
    y += b.tamanho * 0.5 + 1;
    return item;
  });
}

// ===== RUNS — texto com formatação por trecho (negrito/itálico dentro da mesma frase) =====
// Hoje só o bloco "Texto do status" (corpo_texto) usa esse motor — os demais
// blocos continuam com uma fonte só por bloco (calcularLinhasBloco acima).
// Textos salvos no formato antigo (string simples) continuam funcionando:
// normalizarRuns converte pra um run único sem formatação, então nenhuma
// empresa perde texto já configurado com essa mudança.

function normalizarRuns(valor) {
  if (Array.isArray(valor)) return valor.length ? valor : [{ texto: '' }];
  return [{ texto: String(valor ?? '') }];
}

function runsParaTexto(runs) {
  return normalizarRuns(runs).map(r => r.texto).join('');
}

function estiloFonte(negrito, italico) {
  return (negrito && italico) ? 'bolditalic' : negrito ? 'bold' : italico ? 'italic' : 'normal';
}

// Quebra os runs numa sequência de tokens (palavra/espaço/quebra de linha),
// cada palavra carregando o estilo (negrito/itálico) do run de onde veio.
function tokenizarRuns(runs) {
  const tokens = [];
  normalizarRuns(runs).forEach(r => {
    const negrito = !!r.negrito, italico = !!r.italico;
    String(r.texto ?? '').split('\n').forEach((paragrafo, pi) => {
      if (pi > 0) tokens.push({ tipo: 'quebra' });
      paragrafo.split(' ').forEach((palavra, wi) => {
        if (wi > 0) tokens.push({ tipo: 'espaco' });
        if (palavra !== '') tokens.push({ tipo: 'palavra', texto: palavra, negrito, italico });
      });
    });
  });
  return tokens;
}

// Quebra os runs em linhas que cabem em b.largura (mm), palavra por palavra —
// equivalente ao doc.splitTextToSize nativo, mas suportando negrito/itálico
// por trecho (o que o splitTextToSize não suporta, por aceitar só uma
// fonte/estilo por chamada). Validado (teste local) pra produzir exatamente
// as mesmas quebras de linha que o splitTextToSize quando o texto é um único
// run sem formatação — inclusive espaços múltiplos e palavras maiores que a
// largura do bloco (quebra por caractere).
function quebrarRunsEmLinhas(doc, runs, b) {
  const largura = b.largura || 160;
  const fonte = b.fonte || 'helvetica';
  doc.setFont(fonte, 'normal'); doc.setFontSize(b.tamanho);
  const larguraEspaco = doc.getTextWidth(' ');

  const linhas = [];
  let linhaAtual = [];
  let larguraAtual = 0;
  let espacosPendentes = 0;

  function fecharLinha() {
    linhas.push({ palavras: linhaAtual, vazio: linhaAtual.length === 0 });
    linhaAtual = [];
    larguraAtual = 0;
    espacosPendentes = 0;
  }

  function medir(texto, negrito, italico) {
    doc.setFont(fonte, estiloFonte(negrito, italico));
    doc.setFontSize(b.tamanho);
    return doc.getTextWidth(texto);
  }

  function adicionarPalavra(texto, negrito, italico) {
    const lp = medir(texto, negrito, italico);
    const espacosAntes = linhaAtual.length ? espacosPendentes : 0;
    const larguraComEspacos = espacosAntes * larguraEspaco + lp;
    if (linhaAtual.length > 0 && larguraAtual + larguraComEspacos > largura) {
      fecharLinha();
      adicionarPalavra(texto, negrito, italico);
      return;
    }
    // palavra maior que a largura inteira do bloco (ex: link sem espaços) — quebra por caractere
    if (lp > largura && linhaAtual.length === 0) {
      let restante = texto;
      while (restante) {
        let corte = restante.length;
        while (corte > 1 && medir(restante.slice(0, corte), negrito, italico) > largura) corte--;
        const pedaco = restante.slice(0, corte);
        restante = restante.slice(corte);
        linhaAtual.push({ texto: pedaco, negrito, italico, largura: medir(pedaco, negrito, italico), espacosAntes: 0 });
        larguraAtual = linhaAtual[linhaAtual.length - 1].largura;
        if (restante) fecharLinha();
      }
      return;
    }
    linhaAtual.push({ texto, negrito, italico, largura: lp, espacosAntes });
    larguraAtual += larguraComEspacos;
    espacosPendentes = 0;
  }

  tokenizarRuns(runs).forEach(tk => {
    if (tk.tipo === 'quebra') { fecharLinha(); return; }
    if (tk.tipo === 'espaco') { espacosPendentes++; return; }
    adicionarPalavra(tk.texto, tk.negrito, tk.italico);
  });
  fecharLinha();
  return linhas;
}

// Equivalente a calcularLinhasBloco, mas devolvendo "segmentos" (um por trecho
// de estilo consecutivo dentro da linha) já com a posição x calculada — quem
// desenha só percorre os segmentos e aplica doc.setFont em cada um, sem
// recalcular nada. Usada tanto no PDF final (gerarPDFDoc) quanto no preview
// do editor (renderLayoutBlocks, em config.js), pelo mesmo motivo do
// calcularLinhasBloco original: preview e PDF não podem decidir quebras de
// linha diferentes.
function calcularLinhasRuns(doc, runs, b) {
  const largura = b.largura || 160;
  const fonte = b.fonte || 'helvetica';
  const linhasPalavras = quebrarRunsEmLinhas(doc, runs, b);
  let y = b.y;
  doc.setFont(fonte, 'normal'); doc.setFontSize(b.tamanho);
  const larguraEspaco = doc.getTextWidth(' ');

  return linhasPalavras.map((linha, i) => {
    const item = { y, vazio: linha.vazio, segmentos: null, larguraLinha: null, justify: false };
    if (!linha.vazio) {
      const larguraNatural = linha.palavras.reduce((s, p) => s + (p.espacosAntes || 0) * larguraEspaco + p.largura, 0);
      const proxima = linhasPalavras[i + 1];
      const ehUltimaDoParagrafo = (i === linhasPalavras.length - 1) || (proxima && proxima.vazio);
      const justificar = b.align === 'justify' && !ehUltimaDoParagrafo && linha.palavras.length > 1;
      const espacoExtra = justificar ? (largura - linha.palavras.reduce((s, p) => s + p.largura, 0)) / (linha.palavras.length - 1) : null;
      let x = 0;
      item.segmentos = linha.palavras.map((p, idx) => {
        if (idx > 0) x += justificar ? espacoExtra : (p.espacosAntes || 1) * larguraEspaco;
        const seg = { texto: p.texto, negrito: p.negrito, italico: p.italico, x, largura: p.largura };
        x += p.largura;
        return seg;
      });
      item.larguraLinha = larguraNatural;
      item.justify = justificar;
    }
    y += b.tamanho * 0.5 + 1;
    return item;
  });
}

function gerarPDFDoc(fornecedor, periodo, layoutOverride) {
  const { jsPDF } = window.jspdf;
  const isCert = fornecedor.sit === 'certificado';
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: isCert ? 'landscape' : 'portrait' });
  const d = db();
  const empNome = d.nomeEmpresa || 'Empresa';
  const tipoDoc = getTipoDoc(fornecedor.sit, fornecedor.tipo);
  const corpoTexto = aplicarTexto(d.textos[tipoDoc] || '', fornecedor.nome, fornecedor.media.toFixed(1), periodo, empNome, fornecedor.descricaoAvaliado);
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const L = layoutOverride || getLayout()[isCert ? 'cert' : 'carta'];

  const fundo = getFundoConfig(isCert ? 'ap_fundo_certificado' : 'ap_fundo_carta');
  if (fundo) { try { doc.addImage(fundo, 'JPEG', 0, 0, W, H); } catch(e) {} }

  registrarFontesCustomNoPDF(doc);

  const ctx = { fornecedor, nota: fornecedor.media.toFixed(1), periodo, empresaNome: empNome, sit: fornecedor.sit, dadosEmpresa: d.empresa, corpoTexto, isCert };
  // cor dinâmica da "situação" (verde/laranja/vermelho), independe da cor configurada no bloco
  const corSituacao = { aprovado: [0,130,60], parcial: [180,100,0], reprovado: [180,0,0], certificado: [0,130,60] }[fornecedor.sit] || [40,40,40];

  (L.blocos || []).forEach(b => {
    // corpo_texto é o único campo preparado pra formatação por trecho
    // (negrito/itálico dentro da mesma frase) — os demais blocos (fixos ou
    // outras variáveis) continuam no motor antigo, de uma fonte só por bloco.
    if (b.variavel === 'corpo_texto') {
      const runs = normalizarRuns(ctx.corpoTexto);
      if (!runsParaTexto(runs).trim()) return;
      doc.setTextColor(...hexParaRGB(b.cor));
      calcularLinhasRuns(doc, runs, b).forEach(lr => {
        if (lr.vazio) return;
        const offset = b.align === 'center' ? (b.largura - lr.larguraLinha) / 2 : b.align === 'right' ? (b.largura - lr.larguraLinha) : 0;
        lr.segmentos.forEach(seg => {
          doc.setFont(b.fonte || 'helvetica', estiloFonte(seg.negrito, seg.italico));
          doc.setFontSize(b.tamanho);
          doc.text(seg.texto, b.x + offset + seg.x, lr.y);
        });
      });
      return;
    }

    const texto = b.tipo === 'fixo' ? b.conteudo : resolveVariavelValor(b.variavel, ctx);
    if (!texto) return;
    const estilo = (b.negrito && b.italico) ? 'bolditalic' : b.negrito ? 'bold' : b.italico ? 'italic' : 'normal';
    doc.setFont(b.fonte || 'helvetica', estilo);
    doc.setFontSize(b.tamanho);
    doc.setTextColor(...(b.variavel === 'situacao' ? corSituacao : hexParaRGB(b.cor)));
    calcularLinhasBloco(doc, texto, b).forEach(lr => {
      if (lr.vazio) return; // linha em branco (espaçamento entre parágrafos) — nada pra desenhar
      if (lr.posicoes) lr.posicoes.forEach(p => doc.text(p.palavra, p.x, lr.y));
      else if (b.align === 'justify') doc.text(lr.linha, b.x, lr.y);
      else doc.text(lr.linha, b.x, lr.y, { align: b.align });
    });
  });

  return doc.output('arraybuffer');
}

async function gerarPDFsAd(resultados, periodo) {
  const btn = event.currentTarget;
  btn.disabled = true; btn.textContent = 'Gerando...';
  try {
    const zip = new JSZip();
    resultados.forEach(r => {
      const pdf = gerarPDFDoc(r, periodo);
      zip.file(nomeArquivoDoc(r), pdf);
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Avaliacao_Fornecedores_${periodo.replace(/\//g,'-')}.zip`;
    a.click(); URL.revokeObjectURL(url);
    addLog('pdfs_gerados', `${currentUser.email} gerou ${resultados.length} documentos para o período ${periodo}`);
    toast('PDFs gerados com sucesso!');
  } catch(e) { toast('Erro ao gerar PDFs: ' + e.message); }
  btn.disabled = false; btn.innerHTML = `${ic('fileText', 13)}Gerar PDFs (ZIP)`;
}

function nomeArquivoDoc(r) {
  const sit = { certificado: 'Certificado', aprovado: 'Aprovado', parcial: 'Parcialmente_Aprovado', reprovado: 'Reprovado' }[r.sit];
  const tipoTag = r.tipo === 'produto' ? 'Produto' : 'Servico';
  return `${sit}_${tipoTag}_${r.nome.replace(/[^a-zA-Z0-9À-ÿ ]/g,'_')}.pdf`;
}

function baixarPDFIndividual(fornecedorId) {
  const r = _ultimosResultadosAd.find(x => x.id === fornecedorId);
  if (!r) { toast('Gere o relatório novamente antes de baixar.'); return; }
  const pdf = gerarPDFDoc(r, _ultimoPeriodoAd);
  const blob = new Blob([pdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nomeArquivoDoc(r);
  a.click(); URL.revokeObjectURL(url);
  addLog('pdf_individual_gerado', `${currentUser.email} gerou o documento individual de "${r.nome}" (${_ultimoPeriodoAd})`);
  toast('PDF gerado!');
  return r;
}

// Um único e-mail pro fornecedor, listando TODOS os documentos vencidos/
// vencendo dele de uma vez (não é por documento individual como o
// enviarCobrancaDocumento) — mesmo formato de texto usado no envio
// automático, pra ficar consistente.
async function enviarCobrancaConsolidadaFornecedor(fornecedorId) {
  const d = db();
  const forn = d.fornecedores.find(f => f.id === fornecedorId);
  if (!forn) return;
  if (!forn.email) { toast(`"${forn.nome}" não tem e-mail cadastrado. Adicione em Fornecedores › Editar.`); return; }

  const pendentes = d.documentos
    .filter(doc => doc.fornecedorId === fornecedorId)
    .map(doc => {
      const dias = diasParaVencer(doc.validade);
      const aviso = doc.diasAviso ?? DIAS_AVISO_PADRAO;
      const estado = dias < 0 ? 'vencido' : (dias <= aviso ? 'proximo' : null);
      return estado ? { ...doc, dias, estado } : null;
    })
    .filter(Boolean);

  if (!pendentes.length) { toast(`"${forn.nome}" não tem documento vencido ou vencendo no momento.`); return; }

  let linkPortalTexto = '';
  try {
    const { data: linkData } = await supabaseClient.functions.invoke('gerar-link-portal-fornecedor', { body: { fornecedorId } });
    if (linkData && linkData.ok && linkData.link) {
      linkPortalTexto = `\n\nVocê pode enviar os documentos atualizados diretamente por aqui, sem precisar responder este e-mail: ${linkData.link}`;
    }
  } catch (e) { /* segue sem o link */ }

  const linhas = pendentes.map(doc => {
    const dataFmt = new Date(doc.validade + 'T00:00:00').toLocaleDateString('pt-BR');
    return doc.estado === 'vencido'
      ? `- ${doc.nome}: VENCIDO desde ${dataFmt} (${Math.abs(doc.dias)} dia(s))`
      : `- ${doc.nome}: vence em ${doc.dias} dia(s), no dia ${dataFmt}`;
  }).join('\n');

  const temVencido = pendentes.some(doc => doc.estado === 'vencido');
  const empNome = d.nomeEmpresa || 'Empresa';
  const assunto = temVencido ? `Documentos pendentes — ${forn.nome}` : `Documentos vencendo em breve — ${forn.nome}`;
  const corpo = `Olá,\n\nSegue a situação dos documentos cadastrados referente à sua empresa:\n\n${linhas}\n\nSolicitamos o envio das versões atualizadas com a maior brevidade possível, para mantermos seu cadastro regularizado.${linkPortalTexto}\n\nAtenciosamente,\n${empNome}`;

  const link = `mailto:${encodeURIComponent(forn.email)}?cc=${encodeURIComponent(emailAdminMaster(d))}&subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
  addLog('cobranca_consolidada_enviada', `${currentUser.email} enviou cobrança consolidada (${pendentes.length} documento(s)) para "${forn.nome}"`);
  window.location.href = link;

  const agora = new Date().toISOString();
  pendentes.forEach(doc => {
    supabaseClient.from('documentos').update({ cobrado_em: agora }).eq('id', doc.id)
      .then(({ error }) => { if (!error) doc.cobradoEm = agora; });
  });
}

// E-mail do Admin+ da empresa, pra entrar em cópia nos e-mails de cobrança/
// notificação — assim ele tem prova de que o envio realmente aconteceu.
function emailAdminMaster(d) {
  const master = d.usuarios.find(u => u.papel === 'admin_master');
  return master ? master.email : '';
}

// Monta a lista de CC pras notificações de nota ao fornecedor: sempre o
// admin_master, mais o(s) avaliador(es) que tiverem ligado "Cópia de
// avaliação" em Usuários (toggle recebe_copia_avaliacao). Aceita um ou
// vários usuarioIds — a carta/certificado de período pode juntar avaliadores
// de meses/formulários diferentes. Sem duplicar e-mail.
function montarCcNotificacao(d, ...usuarioIds) {
  const emails = new Set();
  const master = emailAdminMaster(d);
  if (master) emails.add(master);
  usuarioIds.flat().filter(Boolean).forEach(id => {
    const u = d.usuarios.find(x => x.id === id);
    if (u && u.recebe_copia_avaliacao && u.email) emails.add(u.email);
  });
  return Array.from(emails).join(',');
}

function saudacaoPorHorario() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Bom dia';
  if (h >= 12 && h < 18) return 'Boa tarde';
  return 'Boa noite';
}

// ---------- NOTIFICAÇÃO PONTUAL — SERVIÇO ----------
// AJUSTE (ago/2026): antes montava um mailto: no navegador com o corpo
// inteiro escrito na mão (o fornecedor recebia texto puro). Agora sempre
// manda via enviar-avaliacao-html (Resend), com o mesmo template visual em
// HTML usado no resto da plataforma. Isso substitui de vez tanto o mailto
// antigo quanto o botão separado "Aprovar e enviar (HTML)" que existia ao
// lado — não faz mais sentido ter os dois, então virou um botão só. Continua
// disponível em qualquer modo de notificação automática configurado
// (cfg-notif-avaliacao-modo: desligado/automático/por aprovação) — serve
// pra notificar ou reenviar manualmente a qualquer momento.
async function notificarFornecedorNota(avId) {
  const d = db();
  const av = d.avaliacoes.find(a => a.id === avId);
  if (!av) return;
  const forn = d.fornecedores.find(f => f.id === av.fornecedorId);
  if (forn && !forn.email) { toast(`"${forn.nome}" não tem e-mail cadastrado. Adicione em Fornecedores › Editar.`); return; }

  mostrarCarregando('Enviando e-mail...');
  const { data, error } = await supabaseClient.functions.invoke('enviar-avaliacao-html', {
    body: { avaliacaoId: avId, tipo: 'servico' },
  });
  esconderProgresso();

  if (error || !data || data.ok === false) {
    toast((data && data.error) || (error && error.message) || 'Não foi possível enviar agora. Tenta de novo em instantes.');
    return;
  }

  av.notificadoEm = new Date().toISOString();
  addLog('notificacao_nota_enviada', `${currentUser.email} notificou "${forn ? forn.nome : ''}" sobre a nota do período ${av.periodo}`);
  toast('Notificação enviada!');
  verDetalheAvaliacao(avId);
  renderAdDashboard();
}

// Cálculo do prazo (dias úteis) foi movido pra core.js (prazoPlanoAcaoDiasUteis)
// — usado agora na config de Formulários → Catálogo, não mais aqui.

// Gera um link novo do portal pra esse fornecedor (reaproveita a mesma Edge
// Function que o botão "Gerar link do portal" já usa em Fornecedores — token
// novo, válido por 15 dias). Se falhar por qualquer motivo, devolve null e o
// e-mail sai sem o link, em vez de travar a notificação inteira.
async function gerarLinkPortalFornecedor(fornecedorId) {
  try {
    const { data, error } = await supabaseClient.functions.invoke('gerar-link-portal-fornecedor', { body: { fornecedorId } });
    if (error || !data || data.ok === false) return null;
    return data.link || null;
  } catch {
    return null;
  }
}

// Anexa o documento do plano de ação que o fornecedor mandou (por fora do
// sistema, hoje só por e-mail) a uma avaliação específica — assim fica
// rastreável depois, ligado direto à avaliação/NF que gerou a cobrança.
async function anexarPlanoAcao(tipo, avId) {
  const inputId = `plano-acao-file-${tipo}-${avId}`;
  const fileInput = document.getElementById(inputId);
  const file = fileInput && fileInput.files[0];
  if (!file) { toast('Escolha um arquivo primeiro.'); return; }

  const d = db();
  const tabela = tipo === 'produto' ? 'avaliacoes_produto' : 'avaliacoes';
  const lista = tipo === 'produto' ? d.avaliacoesProduto : d.avaliacoes;
  const av = lista.find(a => a.id === avId);
  if (!av) return;

  const nomeSeguro = sanitizarNomeArquivo(file.name);
  const caminho = `${currentUser.empresaId}/${currentUser.id}/${Date.now()}_${nomeSeguro}`;
  try {
    await r2Upload(caminho, file);
  } catch (err) { toast('Erro ao enviar o arquivo: ' + err.message); return; }

  // Nome de exibição sempre "Plano de Ação - DD-MM-AAAA.ext" (data do envio),
  // não importa se veio do fornecedor pelo portal ou anexado aqui manualmente
  // pelo admin — mesmo padrão nos dois casos.
  const agora = new Date();
  const extensao = file.name.includes('.') ? file.name.split('.').pop() : '';
  const dd = String(agora.getDate()).padStart(2, '0');
  const mm = String(agora.getMonth() + 1).padStart(2, '0');
  const nomeExibicao = `Plano de Ação - ${dd}-${mm}-${agora.getFullYear()}${extensao ? `.${extensao}` : ''}`;

  const anexo = { nome: nomeExibicao, tamanho: (file.size / 1024).toFixed(0) + ' KB', caminhoStorage: caminho, enviadoEm: agora.toISOString() };
  // Anexo manual do admin já entra aprovado (é o próprio admin anexando) —
  // não passa por plano_acao_status, só o envio pelo portal do fornecedor
  // fica aguardando_aprovacao.
  const { error } = await supabaseClient.from(tabela).update({ plano_acao_anexo: anexo, plano_acao_status: null }).eq('id', avId);
  if (error) { toast('Erro ao salvar o plano de ação: ' + error.message); return; }

  addLog('plano_acao_anexado', `${currentUser.email} anexou o plano de ação de ${tipo === 'produto' ? 'uma NF' : 'uma avaliação de serviço'}`);
  av.planoAcaoAnexo = anexo;
  av.planoAcaoStatus = null;
  toast('Plano de ação anexado!');
  if (tipo === 'produto') verDetalheAvaliacaoProduto(avId); else verDetalheAvaliacao(avId);
}

// Bloco de HTML (upload ou "já anexado") pro plano de ação — usado dentro dos
// dois modais de detalhe (Serviço e Produto), só aparece quando reprovado.
function blocoPlanoAcaoHtml(tipo, av) {
  const prazoLabel = av.planoAcaoPrazo ? new Date(av.planoAcaoPrazo + 'T00:00:00').toLocaleDateString('pt-BR') : null;
  return `
    <div style="margin-top:14px; padding:10px 12px; background:var(--surface2); border-radius:8px">
      <p style="font-size:12px; font-weight:600; margin-bottom:6px">Plano de ação${prazoLabel ? ` — prazo até ${prazoLabel}` : ''}</p>
      ${av.planoAcaoAnexo
        ? `<div style="font-size:12px; display:flex; align-items:center; gap:6px; color:${av.planoAcaoStatus === 'aguardando_aprovacao' ? 'var(--warning, #b45309)' : 'var(--success)'}">${ic('paperclip', 13)}<a href="#" onclick="event.preventDefault(); visualizarAnexo('${av.planoAcaoAnexo.caminhoStorage}', '${av.planoAcaoAnexo.nome}')">${av.planoAcaoAnexo.nome}</a> <span style="color:var(--text-muted)">— anexado em ${new Date(av.planoAcaoAnexo.enviadoEm).toLocaleDateString('pt-BR')}</span>${av.planoAcaoStatus === 'aguardando_aprovacao' ? ' <span class="badge badge-warn">Aguardando aprovação</span>' : ''}</div>`
        : `<div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap">
             <input type="file" id="plano-acao-file-${tipo}-${av.id}" style="font-size:11px; max-width:220px">
             <button class="btn btn-secondary btn-sm" onclick="anexarPlanoAcao('${tipo}', '${av.id}')">Anexar</button>
           </div>`}
    </div>
  `;
}

// ---------- NOTIFICAÇÃO PONTUAL — PRODUTO (NF) ----------
// AJUSTE (ago/2026): mesma migração do lado de Serviço — antes montava
// mailto: no navegador, agora sempre manda via enviar-avaliacao-produto-html
// (Resend). Isso substitui de vez tanto o mailto quanto o botão separado
// "E-mail automático (teste)" que existia ao lado (não fazia mais sentido
// ter os dois depois de validado o padrão visual do HTML). O botão de
// notificar já vive dentro do modal de "verDetalheAvaliacaoProduto"
// (avaliar.js) — aqui só fica a lógica de disparo em si.
async function notificarFornecedorProduto(avId) {
  const d = db();
  const av = d.avaliacoesProduto.find(a => a.id === avId);
  if (!av) return;
  const forn = d.fornecedores.find(f => f.id === av.fornecedorId);
  if (forn && !forn.email) { toast(`"${forn.nome}" não tem e-mail cadastrado. Adicione em Fornecedores › Editar.`); return; }

  mostrarCarregando('Enviando e-mail...');
  const { data, error } = await supabaseClient.functions.invoke('enviar-avaliacao-produto-html', { body: { avaliacaoId: avId } });
  esconderProgresso();

  if (error || !data || data.ok === false) {
    toast('Erro ao enviar: ' + ((data && data.error) || (error && error.message) || 'falha desconhecida'));
    return;
  }

  av.notificadoEm = new Date().toISOString();
  addLog('notificacao_produto_enviada', `${currentUser.email} notificou "${forn ? forn.nome : ''}" sobre a NF ${av.numeroNf || ''}`);
  toast('E-mail enviado!');
  await carregarAvaliacoesProduto();
  closeModal();
  renderAdDashboard();
}

// ---------- APROVAÇÃO DO PLANO DE AÇÃO — PRODUTO (NF) ----------
// Mesmo par aprovar/rejeitar que já existe pra Serviço em
// avaliacoes-recebidas.js, só que apontando pra avaliacoes_produto /
// d.avaliacoesProduto. Ver comentários lá pra entender o fluxo completo.
async function aprovarPlanoAcaoProduto(avaliacaoId) {
  if (!confirm('Aprovar esse plano de ação? A cobrança pra essa NF para.')) return;

  const { error } = await supabaseClient.from('avaliacoes_produto').update({
    plano_acao_status: null,
    plano_acao_revisado_por: currentUser.id,
    plano_acao_revisado_em: new Date().toISOString(),
    plano_acao_resolvido_em: new Date().toISOString(),
    plano_acao_resolvido_por: currentUser.id,
  }).eq('id', avaliacaoId);

  if (error) { toast('Erro ao aprovar: ' + error.message); return; }

  addLog('plano_acao_produto_aprovado', `${currentUser.email} aprovou o plano de ação da NF (avaliação produto ${avaliacaoId}).`);
  toast('Plano de ação aprovado.');
  await carregarAvaliacoesProduto();
  closeModal();
  renderAdDashboard();
}

async function rejeitarPlanoAcaoProduto(avaliacaoId) {
  const d = db();
  const av = d.avaliacoesProduto.find(a => a.id === avaliacaoId);
  if (!av || !av.planoAcaoAnexo) return;

  const motivo = prompt('Motivo da rejeição (opcional — vai ficar registrado no histórico):') || '';
  if (motivo === null) return;
  if (!confirm('Rejeitar esse plano de ação? O arquivo enviado é removido e o fornecedor precisa enviar um novo pelo mesmo link.')) return;

  if (av.planoAcaoAnexo.caminhoStorage) {
    try { await r2Remover(av.planoAcaoAnexo.caminhoStorage); }
    catch (e) { toast('Erro ao remover o arquivo: ' + e.message); return; }
  }

  const { error } = await supabaseClient.from('avaliacoes_produto').update({
    plano_acao_anexo: null,
    plano_acao_status: null,
    plano_acao_revisado_por: currentUser.id,
    plano_acao_revisado_em: new Date().toISOString(),
  }).eq('id', avaliacaoId);

  if (error) { toast('Erro ao rejeitar: ' + error.message); return; }

  addLog('plano_acao_produto_rejeitado', `${currentUser.email} rejeitou o plano de ação da NF (avaliação produto ${avaliacaoId})${motivo ? ` — motivo: ${motivo}` : ''}.`);
  toast('Plano de ação rejeitado. O fornecedor pode enviar de novo.');
  await carregarAvaliacoesProduto();
  closeModal();
  renderAdDashboard();
}

async function marcarPlanoAcaoResolvidoProduto(avaliacaoId) {
  if (!confirm('Marcar esse plano de ação como resolvido? Isso para os lembretes pro fornecedor.')) return;
  const { error } = await supabaseClient.from('avaliacoes_produto').update({
    plano_acao_resolvido_em: new Date().toISOString(), plano_acao_resolvido_por: currentUser.id,
  }).eq('id', avaliacaoId);
  if (error) { toast('Erro ao marcar como resolvido: ' + error.message); return; }
  addLog('plano_acao_produto_resolvido', `${currentUser.email} marcou como resolvido o plano de ação da NF (avaliação produto ${avaliacaoId}).`);
  toast('Marcado como resolvido.');
  await carregarAvaliacoesProduto();
  closeModal();
  renderAdDashboard();
}

async function enviarCobrancaDocumento(docId) {
  const d = db();
  const doc = d.documentos.find(x => x.id === docId);
  if (!doc) return;
  const forn = d.fornecedores.find(f => f.id === doc.fornecedorId);
  if (!forn) return;
  if (!forn.email) { toast(`"${forn.nome}" não tem e-mail cadastrado. Adicione em Fornecedores › Editar.`); return; }

  const diasReais = diasParaVencer(doc.validade); // negativo = já venceu, positivo = ainda vai vencer
  const dataFmt = new Date(doc.validade + 'T00:00:00').toLocaleDateString('pt-BR');
  const empNome = d.nomeEmpresa || 'Empresa';
  const jaVencido = diasReais < 0;

  // Gera (ou renova) o link do portal na hora, pra já ir junto no e-mail.
  // Se der qualquer problema aqui, segue sem o link — não trava a cobrança.
  let linkPortalTexto = '';
  try {
    const { data: linkData } = await supabaseClient.functions.invoke('gerar-link-portal-fornecedor', { body: { fornecedorId: forn.id } });
    if (linkData && linkData.ok && linkData.link) {
      linkPortalTexto = `\n\nVocê pode enviar o documento atualizado diretamente por aqui, sem precisar responder este e-mail: ${linkData.link}`;
    }
  } catch (e) { /* segue sem o link */ }

  const assunto = jaVencido
    ? `Documento vencido — ${doc.nome} — ${forn.nome}`
    : `Documento vence em breve — ${doc.nome} — ${forn.nome}`;

  const corpo = jaVencido
    ? `Olá,\n\nIdentificamos que o documento "${doc.nome}" referente ao cadastro de fornecedores está vencido desde ${dataFmt} (${Math.abs(diasReais)} dia(s)).\n\nSolicitamos o envio da versão atualizada com a maior brevidade possível, para mantermos seu cadastro regularizado.${linkPortalTexto}\n\nAtenciosamente,\n${empNome}`
    : `Olá,\n\nO documento "${doc.nome}" referente ao cadastro de fornecedores vence em ${diasReais} dia(s), no dia ${dataFmt}.\n\nPedimos que providencie a versão atualizada com antecedência, para mantermos seu cadastro regularizado sem interrupção.${linkPortalTexto}\n\nAtenciosamente,\n${empNome}`;

  const link = `mailto:${encodeURIComponent(forn.email)}?cc=${encodeURIComponent(emailAdminMaster(d))}&subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
  addLog('cobranca_enviada', `${currentUser.email} enviou ${jaVencido ? 'cobrança' : 'aviso de vencimento próximo'} do documento "${doc.nome}" para "${forn.nome}"`);
  window.location.href = link;

  supabaseClient.from('documentos').update({ cobrado_em: new Date().toISOString() }).eq('id', doc.id)
    .then(({ error }) => { if (!error) { doc.cobradoEm = new Date().toISOString(); } });
}

function exportarExcelAd(resultados, periodo) {
  const linhas = [['Nome', 'Tipo', 'Média', 'Situação']];
  resultados.forEach(r => linhas.push([r.nome, r.tipo === 'produto' ? 'Produto' : 'Serviço', r.media.toFixed(1), getSubtituloDoc(r.sit)]));
  const csv = linhas.map(l => l.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `Fornecedores_${periodo.replace(/\//g,'-')}.csv`; a.click();
  URL.revokeObjectURL(url);
  toast('Planilha exportada!');
}

// ---------- CONFIG ----------
