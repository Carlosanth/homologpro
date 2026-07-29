// ============ INIT: dispara depois que todos os outros arquivos já carregaram ============
// ============ INIT ============

// Precisa ser registrado ANTES do checkSession(): quando a pessoa chega aqui
// pelo link de "esqueci minha senha", o Supabase cria uma sessão temporária
// de recuperação e dispara esse evento — sem isso, checkSession() trataria
// essa sessão como um login normal e mandaria a pessoa reto pro dashboard,
// em vez de deixá-la definir a senha nova primeiro.
supabaseClient.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') mostrarRedefinirSenha();
});

initDB();
checkSession();
carregarPrecosPlanoPublico();

// Rede de segurança: se checkSession() travar por algum motivo, não deixa
// a pessoa presa na tela de carregamento pra sempre.
setTimeout(() => {
  const boot = document.getElementById('boot-loading');
  if (boot && boot.style.display !== 'none') {
    boot.style.display = 'none';
    if (document.getElementById('login-screen').style.display === 'none') {
      document.getElementById('login-screen').style.display = 'flex';
    }
  }
}, 6000);

// Retorno do checkout do Stripe (?checkout=sucesso|cancelado na URL)
(() => {
  const params = new URLSearchParams(window.location.search);
  const checkout = params.get('checkout');
  if (!checkout) return;
  window.history.replaceState({}, '', window.location.pathname);
  setTimeout(() => {
    if (checkout === 'sucesso') toast('Pagamento confirmado! Pode levar alguns segundos pra atualizar o status da sua conta.');
    if (checkout === 'cancelado') toast('Checkout cancelado — nenhuma cobrança foi feita.');
  }, 600);
})();

// Chegada vinda da landing page pública (?cadastro=1&plano=essencial|profissional|enterprise)
// — abre direto no cadastro, com o plano já marcado, sem precisar digitar nada de novo.
(() => {
  const params = new URLSearchParams(window.location.search);
  const cadastro = params.get('cadastro');
  const plano = params.get('plano');
  if (!cadastro && !plano) return;
  window.history.replaceState({}, '', window.location.pathname);
  setTimeout(() => {
    if (cadastro === '1') mostrarCadastroEmpresa();
    if (plano && ['essencial', 'profissional', 'enterprise'].includes(plano)) selecionarPlano(plano);
  }, 300);
})();


