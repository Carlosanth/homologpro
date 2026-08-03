// ============ RELATÓRIO & PDFs ============
// ---------- RELATÓRIO & PDFs ----------
let _ultimosResultadosAd = [];
let _ultimoPeriodoAd = '';
function renderAdRelatorio() {
  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();
  const textos = db().textos || {};
  document.getElementById('ad-page-relatorio').innerHTML = `
    <div class="page-header"><div><h2>Relatório & PDFs</h2><p>Selecione o período e gere certificados e cartas automaticamente</p></div></div>
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
    <div class="card" style="margin-top:16px">
      <div class="card-title">Texto da notificação pontual ao fornecedor</div>
      <p style="font-size:12px; color:var(--text-muted); margin-bottom:14px">
        Usado nos e-mails enviados ao clicar em "Ver / Notificar" no Dashboard — tanto pra avaliação de Serviço quanto pra Nota Fiscal (Produto).
        A saudação (bom dia/boa tarde) e os dados (nota, critérios com problema, motivos) são preenchidos automaticamente — aqui é só a parte do texto.
      </p>
      <div class="form-group">
        <label>Abertura</label>
        <textarea rows="2" onchange="salvarTextoDocumento('notif-abertura', this.value)">${textos['notif-abertura'] || ''}</textarea>
      </div>
      <div class="form-group">
        <label>Pedido de plano de ação (só entra quando a avaliação é reprovada)</label>
        <textarea rows="2" onchange="salvarTextoDocumento('notif-plano-acao', this.value)">${textos['notif-plano-acao'] || ''}</textarea>
      </div>
      <div class="form-group" style="max-width:260px">
        <label>Prazo pro fornecedor enviar o plano de ação (dias)</label>
        <input type="number" min="1" step="1" value="${textos['notif-prazo-dias'] || '10'}" onchange="salvarTextoDocumento('notif-prazo-dias', this.value)">
        <p style="font-size:11px; color:var(--text-muted); margin-top:4px">O sistema soma esses dias à data da cobrança e já escreve o prazo no e-mail.</p>
      </div>
      <div class="form-group">
        <label>Fechamento</label>
        <textarea rows="3" onchange="salvarTextoDocumento('notif-fechamento', this.value)">${textos['notif-fechamento'] || ''}</textarea>
      </div>
    </div>
  `;
}

// Avaliação de produto não tem campo "periodo" pronto (tem uma data cheia, tipo
// "2026-07-05") — essa função extrai o "ano-mes" dela pra comparar com o período
// escolhido no relatório, do mesmo jeito que já é feito pras avaliações de serviço.
function periodoDeData(dataStr) {
  if (!dataStr) return null;
  const [ano, mes] = dataStr.split('-');
  return `${parseInt(ano, 10)}-${parseInt(mes, 10)}`;
}

function gerarRelatorioAd() {
  const mesIni = parseInt(document.getElementById('rel-mes-ini').value);
  const anoIni = parseInt(document.getElementById('rel-ano-ini').value);
  const mesFim = parseInt(document.getElementById('rel-mes-fim').value);
  const anoFim = parseInt(document.getElementById('rel-ano-fim').value);
  const d = db();

  if (anoIni > anoFim || (anoIni === anoFim && mesIni > mesFim)) { toast('Período inválido.'); return; }

  const periodos = [];
  let m = mesIni, a = anoIni;
  while (a < anoFim || (a === anoFim && m <= mesFim)) { periodos.push(`${a}-${m}`); m++; if (m > 12) { m = 1; a++; } }

  const resultados = d.fornecedores.map(f => {
    // Fornecedor de Produto: notas vêm da tabela de lançamentos de nota fiscal (avaliacoesProduto).
    if (f.tipo === 'produto') {
      const avsP = d.avaliacoesProduto.filter(av => av.fornecedorId === f.id && periodos.includes(periodoDeData(av.data)));
      if (!avsP.length) return null;
      const media = avsP.reduce((s, av) => s + av.notaGeral, 0) / avsP.length;
      const sit = getSituacao(media);
      return { ...f, media, sit, meses: avsP.length, totalMeses: periodos.length };
    }
    // Fornecedor de Serviço: notas vêm da tabela de avaliações normais.
    const avs = d.avaliacoes.filter(av => av.fornecedorId === f.id && periodos.includes(av.periodo) && !av.semServico);
    if (!avs.length) return null;
    const media = avs.reduce((s, av) => s + av.nota, 0) / avs.length;
    const sit = getSituacao(media);
    return { ...f, media, sit, meses: avs.length, totalMeses: periodos.length };
  }).filter(Boolean);

  const periodoLabel = `${MESES[mesIni]}/${anoIni}` + (mesIni === mesFim && anoIni === anoFim ? '' : ` a ${MESES[mesFim]}/${anoFim}`);
  const wrap = document.getElementById('relatorio-resultado-ad');

  if (!resultados.length) {
    wrap.innerHTML = '<div class="card"><div class="empty-state"><p>Nenhuma avaliação encontrada para fornecedores neste período.</p></div></div>';
    return;
  }

  _ultimosResultadosAd = resultados;
  _ultimoPeriodoAd = periodoLabel;

  wrap.innerHTML = `
    <div class="card">
      <div class="card-title">Resultados — ${periodoLabel}</div>
      <table>
        <thead><tr><th>Fornecedor</th><th>Tipo</th><th style="text-align:center">Média</th><th style="text-align:center">Avaliações</th><th>Situação</th><th style="text-align:right">Ações</th></tr></thead>
        <tbody>
          ${resultados.map(r => `<tr>
            <td style="font-weight:500">${r.nome}</td>
            <td><span class="tag-${r.tipo}">${r.tipo === 'produto' ? 'Produto' : 'Serviço'}</span></td>
            <td style="text-align:center; font-weight:600">${r.media.toFixed(1)}</td>
            <td style="text-align:center; color:var(--text-muted)">${r.meses}/${r.totalMeses}</td>
            <td>${badgeSit(r.sit)}</td>
            <td><div class="actions">
              <button class="btn btn-secondary btn-sm" onclick="baixarPDFIndividual('${r.id}')" title="Gerar apenas o PDF deste fornecedor" style="display:inline-flex; align-items:center; gap:6px">${ic('fileText', 13)}PDF</button>
              <button class="btn btn-secondary btn-sm" onclick="enviarCertificadoEmail('${r.id}')" title="Baixa o PDF e abre seu cliente de e-mail" style="display:inline-flex; align-items:center; gap:6px">${ic('mail', 13)}E-mail</button>
            </div></td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div style="display:flex; justify-content:flex-end; margin-top:18px; gap:10px">
        <button class="btn btn-secondary" onclick='exportarExcelAd(${JSON.stringify(resultados).replace(/'/g,"&apos;")}, "${periodoLabel}")'>Exportar Excel</button>
        <button class="btn btn-success" onclick='gerarPDFsAd(${JSON.stringify(resultados).replace(/'/g,"&apos;")}, "${periodoLabel}")' style="display:inline-flex; align-items:center; gap:6px">${ic('fileText', 13)}Gerar PDFs (ZIP)</button>
      </div>
    </div>
  `;
}

function aplicarTexto(template, fornecedor, nota, periodo, empresa) {
  return template.replace(/{fornecedor}/g, fornecedor).replace(/{nota}/g, nota).replace(/{periodo}/g, periodo).replace(/{empresa}/g, empresa);
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

function gerarPDFDoc(fornecedor, periodo, layoutOverride) {
  const { jsPDF } = window.jspdf;
  const isCert = fornecedor.sit === 'certificado';
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: isCert ? 'landscape' : 'portrait' });
  const d = db();
  const empNome = d.nomeEmpresa || 'Empresa';
  const tipoDoc = getTipoDoc(fornecedor.sit, fornecedor.tipo);
  const corpoTexto = aplicarTexto(d.textos[tipoDoc] || '', fornecedor.nome, fornecedor.media.toFixed(1), periodo, empNome);
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
      const sit = { certificado: 'Certificado', aprovado: 'Aprovado', parcial: 'Parcialmente_Aprovado', reprovado: 'Reprovado' }[r.sit];
      zip.file(`${sit}_${r.nome.replace(/[^a-zA-Z0-9À-ÿ ]/g,'_')}.pdf`, pdf);
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
  return `${sit}_${r.nome.replace(/[^a-zA-Z0-9À-ÿ ]/g,'_')}.pdf`;
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

function enviarCertificadoEmail(fornecedorId) {
  const r = _ultimosResultadosAd.find(x => x.id === fornecedorId);
  if (!r) { toast('Gere o relatório novamente antes de enviar.'); return; }
  if (!r.email) { toast(`"${r.nome}" não tem e-mail cadastrado. Adicione em Fornecedores › Editar.`); return; }
  baixarPDFIndividual(fornecedorId);
  const d = db();
  const empNome = d.nomeEmpresa || 'Empresa';
  const titulo = getTituloDoc(r.sit);
  const assunto = `${titulo} — ${r.nome} (${_ultimoPeriodoAd})`;
  const corpo = `Olá,\n\nSegue referente à avaliação de fornecedores do período ${_ultimoPeriodoAd}: ${titulo.toLowerCase()}.\n\nO arquivo PDF foi baixado automaticamente nesta página (${nomeArquivoDoc(r)}) — por favor, anexe-o a este e-mail antes de enviar.\n\nAtenciosamente,\n${empNome}`;
  const link = `mailto:${encodeURIComponent(r.email)}?cc=${encodeURIComponent(emailAdminMaster(d))}&subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
  addLog('email_certificado_enviado', `${currentUser.email} abriu o cliente de e-mail para enviar o documento de "${r.nome}"`);
  setTimeout(() => { window.location.href = link; }, 350);
}

function saudacaoPorHorario() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Bom dia';
  if (h >= 12 && h < 18) return 'Boa tarde';
  return 'Boa noite';
}

// Notifica por e-mail com o conteúdo da avaliação ESCRITO no corpo (sem gerar/anexar PDF) —
// o fornecedor lê os critérios direto no e-mail, como se fosse o formulário em texto.
// Mostra a régua completa de cada critério (todas as opções, marcando a escolhida) e sugere
// automaticamente qual seria a melhor opção em cada critério abaixo do máximo — além da
// "Melhoria esperada" (justificativa) e "Observações" que o setor já preenche no formulário.
async function notificarFornecedorNota(avId) {
  const d = db();
  const av = d.avaliacoes.find(a => a.id === avId);
  if (!av) return;
  const forn = d.fornecedores.find(f => f.id === av.fornecedorId);
  if (!forn) return;
  if (!forn.email) { toast(`"${forn.nome}" não tem e-mail cadastrado. Adicione em Fornecedores › Editar.`); return; }
  const form = d.formularios.find(f => f.id === av.formularioId);
  const [ano, mes] = av.periodo.split('-');
  const periodoLabel = `${MESES[parseInt(mes)]}/${ano}`;
  const sit = getSituacao(av.nota);
  const empNome = d.nomeEmpresa || 'Empresa';
  const saudacao = saudacaoPorHorario();

  const blocosCriterios = [];
  const melhoriasAuto = [];
  let numero = 1;
  (form ? form.criterios : []).forEach(c => {
    const r = av.respostas[c.id];
    if (!r || r.naoHouve) return;
    const escolhida = c.opcoes[r.opcaoIndex];
    if (!escolhida) return;
    const regua = c.opcoes.map((o, i) => `   - ${o.label} — ${o.pontos.toFixed(1)}P${i === r.opcaoIndex ? ' (Sua nota)' : ''}`).join('\n');
    blocosCriterios.push(`${numero}. ${c.nome} (Sua nota: ${escolhida.pontos.toFixed(1)} de ${c.pesoMax.toFixed(1)}P)\nStatus: ${escolhida.label}.\nRégua do critério:\n${regua}`);
    const melhorOpcao = c.opcoes.reduce((best, o) => o.pontos > best.pontos ? o : best, c.opcoes[0]);
    if (melhorOpcao.pontos > escolhida.pontos) melhoriasAuto.push(`${c.nome}: buscar atingir "${melhorOpcao.label}".`);
    numero++;
  });

  const notaMax = form ? form.criterios.reduce((s, c) => s + c.pesoMax, 0) : null;
  const tipoLabel = form ? (form.tipo === 'produto' ? 'Produto' : 'Serviço') : '';
  const setorInfo = form ? `- Setor Avaliador: ${form.setor} · ${tipoLabel} (${form.nome})\n` : '';
  const secaoMelhoriaAuto = melhoriasAuto.length ? `\n📉 Melhoria Esperada para os Próximos Períodos:\n${melhoriasAuto.map(m => `- ${m}`).join('\n')}\n` : '';

  const textos = d.textos || {};
  const abertura = textos['notif-abertura'] || 'Informamos que foi concluída a análise referente à avaliação abaixo.';
  const planoAcaoTexto = textos['notif-plano-acao'] || 'Solicitamos o envio de um plano de ação para os pontos identificados.';
  const fechamento = textos['notif-fechamento'] || 'Apresentamos esses dados para que sua equipe possa analisar os pontos de melhoria e alinhar os processos internos. Permanecemos à disposição para esclarecer dúvidas e apoiar no que for necessário.\n\nAtenciosamente,';
  const prazo = sit === 'reprovado' ? calcularPrazoPlanoAcao(d) : null;

  let linkPortal = null;
  if (sit === 'reprovado') {
    toast('Gerando link do portal...');
    linkPortal = await gerarLinkPortalFornecedor(forn.id);
  }

  const assunto = `Avaliação de Desempenho de Fornecedores - ${periodoLabel} - ${forn.nome}`;
  let corpo = `${saudacao},\n${abertura}\n\n${setorInfo}- Nota Obtida: ${av.nota.toFixed(1)}${notaMax ? ` de ${notaMax.toFixed(1)}P` : ''} (${getSubtituloDoc(sit)})\n\n`;
  if (blocosCriterios.length) corpo += `Para sua ciência, detalhamos abaixo os critérios avaliados, a pontuação que sua empresa obteve e a nossa régua completa de avaliação:\n\n${blocosCriterios.join('\n\n')}\n${secaoMelhoriaAuto}`;
  if (av.justificativa) corpo += `\nOutras melhorias apontadas pelo setor avaliador:\n${av.justificativa}\n`;
  if (av.obs) corpo += `\nObservações:\n${av.obs}\n`;
  if (sit === 'reprovado') {
    corpo += `\n${planoAcaoTexto}${prazo ? `\nPrazo de entrega: até ${prazo.formatada}.` : ''}${linkPortal ? `\nVocê pode enviar o plano de ação diretamente por aqui, sem precisar responder este e-mail: ${linkPortal}` : ''}\n`;
  }
  corpo += `\n${fechamento}\n${empNome}`;

  const link = `mailto:${encodeURIComponent(forn.email)}?cc=${encodeURIComponent(emailAdminMaster(d))}&subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
  addLog('notificacao_nota_enviada', `${currentUser.email} notificou "${forn.nome}" sobre a nota do período ${periodoLabel}`);
  closeModal();
  window.location.href = link;

  // Grava quando foi notificado — assim o alerta do dashboard mostra
  // "Cobrado em DD/MM" em vez de ficar pedindo ação pra sempre. Não trava a
  // navegação: dispara depois do mailto, sem "await" no fluxo principal.
  supabaseClient.from('avaliacoes').update({ notificado_em: new Date().toISOString(), plano_acao_prazo: prazo ? prazo.iso : null }).eq('id', av.id)
    .then(({ error }) => { if (!error) { av.notificadoEm = new Date().toISOString(); av.planoAcaoPrazo = prazo ? prazo.iso : null; renderAdDashboard(); } });
}

// Calcula a data-limite pro fornecedor enviar o plano de ação (hoje + prazo
// configurado, em dias). Usado tanto na notificação de Serviço quanto Produto.
function calcularPrazoPlanoAcao(d) {
  const dias = parseInt((d.textos && d.textos['notif-prazo-dias']) || '10', 10) || 10;
  const data = new Date();
  data.setDate(data.getDate() + dias);
  return { iso: data.toISOString().slice(0, 10), formatada: data.toLocaleDateString('pt-BR') };
}

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

  const anexo = { nome: file.name, tamanho: (file.size / 1024).toFixed(0) + ' KB', caminhoStorage: caminho, enviadoEm: new Date().toISOString() };
  const { error } = await supabaseClient.from(tabela).update({ plano_acao_anexo: anexo }).eq('id', avId);
  if (error) { toast('Erro ao salvar o plano de ação: ' + error.message); return; }

  addLog('plano_acao_anexado', `${currentUser.email} anexou o plano de ação de ${tipo === 'produto' ? 'uma NF' : 'uma avaliação de serviço'}`);
  av.planoAcaoAnexo = anexo;
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
        ? `<div style="font-size:12px; display:flex; align-items:center; gap:6px; color:var(--success)">${ic('paperclip', 13)}<a href="#" onclick="event.preventDefault(); baixarAnexoAvaliacao('${av.planoAcaoAnexo.caminhoStorage}', '${av.planoAcaoAnexo.nome}')">${av.planoAcaoAnexo.nome}</a> <span style="color:var(--text-muted)">— anexado em ${new Date(av.planoAcaoAnexo.enviadoEm).toLocaleDateString('pt-BR')}</span></div>`
        : `<div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap">
             <input type="file" id="plano-acao-file-${tipo}-${av.id}" style="font-size:11px; max-width:220px">
             <button class="btn btn-secondary btn-sm" onclick="anexarPlanoAcao('${tipo}', '${av.id}')">Anexar</button>
           </div>`}
    </div>
  `;
}

// ---------- NOTIFICAÇÃO PONTUAL — PRODUTO (NF) ----------
// O botão de notificar já vive dentro do modal de "verDetalheAvaliacaoProduto"
// (avaliar.js) — aqui só fica a lógica de montar e mandar o e-mail em si.
async function notificarFornecedorProduto(avId) {
  const d = db();
  const av = d.avaliacoesProduto.find(a => a.id === avId);
  if (!av) return;
  const forn = d.fornecedores.find(f => f.id === av.fornecedorId);
  if (!forn) return;
  if (!forn.email) { toast(`"${forn.nome}" não tem e-mail cadastrado. Adicione em Fornecedores › Editar.`); return; }
  const empNome = d.nomeEmpresa || 'Empresa';
  const saudacao = saudacaoPorHorario();
  const dataLabel = av.data ? new Date(av.data + 'T00:00:00').toLocaleDateString('pt-BR') : '';

  const todosCriterios = av.notas || [];
  const descontos = av.descontoExtraDetalhe || [];

  const blocosCriterios = todosCriterios.map((n, i) =>
    `${i + 1}. ${n.nome} (Nota: ${n.nota} de ${n.peso})${n.motivo ? `\nMotivo: ${n.motivo}` : ''}`);
  const blocosDescontos = descontos.map(det => `- ${det.motivo}: desconto de ${det.valor} ponto(s)`);

  const textos = d.textos || {};
  const abertura = textos['notif-abertura'] || 'Informamos que foi concluída a análise referente à avaliação abaixo.';
  const planoAcaoTexto = textos['notif-plano-acao'] || 'Solicitamos o envio de um plano de ação para os pontos identificados.';
  const fechamento = textos['notif-fechamento'] || 'Apresentamos esses dados para que sua equipe possa analisar os pontos de melhoria e alinhar os processos internos. Permanecemos à disposição para esclarecer dúvidas e apoiar no que for necessário.\n\nAtenciosamente,';
  const sitProduto = getSituacao(av.notaGeral);
  const prazo = sitProduto === 'reprovado' ? calcularPrazoPlanoAcao(d) : null;

  let linkPortal = null;
  if (sitProduto === 'reprovado') {
    toast('Gerando link do portal...');
    linkPortal = await gerarLinkPortalFornecedor(forn.id);
  }

  const assunto = `Avaliação de Nota Fiscal ${av.numeroNf || ''} - ${forn.nome}`;
  let corpo = `${saudacao},\n${abertura}\n\n- Nota Fiscal: ${av.numeroNf || '—'}\n- Data: ${dataLabel}\n- Nota Obtida: ${av.notaGeral != null ? av.notaGeral.toFixed(1) : '—'} (${getSubtituloDoc(sitProduto)})\n\n`;

  if (blocosCriterios.length) corpo += `Para sua ciência, detalhamos abaixo os critérios avaliados e a pontuação obtida em cada um:\n\n${blocosCriterios.join('\n\n')}\n\n`;
  if (blocosDescontos.length) corpo += `Descontos aplicados:\n${blocosDescontos.join('\n')}\n\n`;
  if (av.justificativa) corpo += `Outras observações:\n${av.justificativa}\n\n`;
  if (sitProduto === 'reprovado') {
    corpo += `${planoAcaoTexto}${prazo ? `\nPrazo de entrega: até ${prazo.formatada}.` : ''}${linkPortal ? `\nVocê pode enviar o plano de ação diretamente por aqui, sem precisar responder este e-mail: ${linkPortal}` : ''}\n\n`;
  }
  corpo += `${fechamento}\n${empNome}`;

  const link = `mailto:${encodeURIComponent(forn.email)}?cc=${encodeURIComponent(emailAdminMaster(d))}&subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
  addLog('notificacao_produto_enviada', `${currentUser.email} notificou "${forn.nome}" sobre a NF ${av.numeroNf || ''}`);
  closeModal();
  window.location.href = link;

  supabaseClient.from('avaliacoes_produto').update({ notificado_em: new Date().toISOString(), plano_acao_prazo: prazo ? prazo.iso : null }).eq('id', av.id)
    .then(({ error }) => { if (!error) { av.notificadoEm = new Date().toISOString(); av.planoAcaoPrazo = prazo ? prazo.iso : null; renderAdDashboard(); } });
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
