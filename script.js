// Mesmo projeto Supabase do app — login feito aqui já autentica pro app
// também, porque a sessão fica salva no navegador pro domínio inteiro.
const SUPABASE_URL = 'https://qmvfsgwzbrhbxyonntgh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_JjiXWFQTcOrUf5RXjsfeVw_5cwLPHf3';
const landingSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

function toggleLoginDropdown() {
  document.getElementById('loginDropdown').classList.toggle('open');
}
document.addEventListener('click', (e) => {
  const wrap = document.querySelector('.login-dropdown-wrap');
  if (wrap && !wrap.contains(e.target)) document.getElementById('loginDropdown').classList.remove('open');
});

async function landingLogin() {
  const email = document.getElementById('ld-email').value.trim().toLowerCase();
  const senha = document.getElementById('ld-senha').value;
  const errBox = document.getElementById('loginDropdownError');
  const okBox = document.getElementById('loginDropdownOk');
  errBox.style.display = 'none';
  okBox.style.display = 'none';

  const { error } = await landingSupabase.auth.signInWithPassword({ email, password: senha });
  if (error) {
    errBox.textContent = 'E-mail ou senha inválidos.';
    errBox.style.display = 'block';
    return;
  }
  // Sessão já fica salva pro app também (mesmo domínio) — só leva pra lá.
  window.location.href = 'app/index.html';
}

async function landingEsqueciSenha() {
  const email = document.getElementById('ld-email').value.trim().toLowerCase();
  const errBox = document.getElementById('loginDropdownError');
  const okBox = document.getElementById('loginDropdownOk');
  errBox.style.display = 'none';
  okBox.style.display = 'none';

  if (!email) { errBox.textContent = 'Digite seu e-mail no campo acima primeiro.'; errBox.style.display = 'block'; return; }

  await landingSupabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/app/index.html',
  });
  // Mesma mensagem sempre, exista ou não o e-mail (por segurança).
  okBox.textContent = 'Se esse e-mail estiver cadastrado, enviamos um link de redefinição pra ele.';
  okBox.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', () => {
  // Envio do Formulário de Contato — salva no banco e notifica por e-mail
  // via Edge Function (a chave do serviço de e-mail fica protegida lá, não aqui).
  const leadForm = document.getElementById('leadForm');
  leadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = leadForm.querySelector('button[type="submit"]');
    const textoOriginal = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    const payload = {
      nome: document.getElementById('nome').value.trim(),
      email: document.getElementById('email').value.trim(),
      empresa: document.getElementById('empresa').value.trim(),
      fornecedores: document.getElementById('fornecedores').value,
      admins: document.getElementById('admins').value,
      mensagem: document.getElementById('mensagem').value.trim(),
      website: document.getElementById('website').value, // honeypot
    };

    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/lead-contato`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.erro || 'Falha ao enviar');
      alert('Obrigado! Recebemos suas informações e entraremos em contato em breve.');
      leadForm.reset();
    } catch (err) {
      alert('Não foi possível enviar agora. Tente novamente em instantes ou escreva pra contato@homologpro.com.br.');
    } finally {
      btn.disabled = false;
      btn.textContent = textoOriginal;
    }
  });
});

// Preço dos planos ao vivo, vindo da mesma tabela (planos_config) que o app usa —
// assim a landing nunca mostra um valor desatualizado.
async function carregarPrecosPlanoLanding() {
  try {
    const { data, error } = await landingSupabase.from('planos_config').select('chave, preco');
    if (error || !data) return;
    data.forEach(row => {
      const el = document.querySelector(`.price-tag[data-plano-preco="${row.chave}"]`);
      if (el && row.preco != null) {
        el.innerHTML = `R$ ${Number(row.preco).toFixed(2).replace('.', ',')}<span>/mês</span>`;
      }
    });
  } catch (e) {
    // se falhar, os preços padrão já escritos no HTML continuam visíveis
  }
}
carregarPrecosPlanoLanding();
