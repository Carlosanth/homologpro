// app/js/r2-client.js
//
// Substitui todo uso de "supabaseClient.storage.from(bucket)..." — agora
// os arquivos ficam no Cloudflare R2, não mais no Supabase Storage.
//
// Toda chamada passa pela Edge Function "gerar-url-r2", que confere
// permissão (mesma regra que o RLS do Storage garantia) e devolve uma
// URL assinada de curta duração. O upload/download real acontece direto
// entre o navegador e o R2 (não passa pelo servidor), então não pesa na
// Edge Function.
//
// Uso:
//   await r2Upload(caminhoStorage, file)
//   await r2Baixar(caminhoStorage, nomeArquivoParaSalvar)
//   await r2Remover(caminhoStorage)
//
// Em caso de erro, essas três funções lançam uma exceção (throw) com uma
// mensagem já pronta pra mostrar no toast — é só envolver a chamada num
// try/catch, igual você já faz hoje com "error.message".

async function pedirUrlR2(acao, caminho, contentType) {
  const { data: sessao } = await supabaseClient.auth.getSession();
  const token = sessao && sessao.session ? sessao.session.access_token : null;
  if (!token) throw new Error('Sessão expirada. Atualize a página e faça login novamente.');

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/gerar-url-r2`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ acao, caminho, contentType }),
  });

  let corpo;
  try { corpo = await resp.json(); } catch { corpo = null; }
  if (!corpo || corpo.ok === false) {
    throw new Error((corpo && corpo.error) || 'Erro ao gerar acesso ao arquivo.');
  }
  return corpo.url;
}

async function r2Upload(caminho, file) {
  const contentType = file.type || 'application/octet-stream';
  const url = await pedirUrlR2('upload', caminho, contentType);
  const resp = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });
  if (!resp.ok) throw new Error(`Falha ao enviar o arquivo (R2 respondeu ${resp.status}).`);
}

async function r2Baixar(caminho, nomeArquivoParaSalvar) {
  const url = await pedirUrlR2('download', caminho);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Falha ao abrir o arquivo (R2 respondeu ${resp.status}).`);
  const blob = await resp.blob();
  const objUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objUrl;
  link.download = nomeArquivoParaSalvar || 'documento';
  link.click();
  URL.revokeObjectURL(objUrl);
}

async function r2Remover(caminho) {
  const url = await pedirUrlR2('delete', caminho);
  const resp = await fetch(url, { method: 'DELETE' });
  if (!resp.ok) throw new Error(`Falha ao remover o arquivo (R2 respondeu ${resp.status}).`);
}
