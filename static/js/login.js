/* ==========================================================================
   LÓGICA DE AUTENTICAÇÃO GENÉRICA DO LOJISTA
   ========================================================================== */

function mostrarErro(mensagem) {
  const alerta = document.getElementById('alerta-erro');
  if (alerta) {
    alerta.textContent = mensagem;
    alerta.classList.remove('hidden');
  }
}

function ocultarErro() {
  const alerta = document.getElementById('alerta-erro');
  if (alerta) {
    alerta.classList.add('hidden');
  }
}

async function realizarLogin(e) {
  e.preventDefault();
  ocultarErro();

  const emailInput = document.getElementById('login_email');
  const senhaInput = document.getElementById('login_senha');
  const btnEntrar = document.getElementById('btn-entrar');

  const email = emailInput ? emailInput.value.trim() : "";
  const senha = senhaInput ? senhaInput.value.trim() : "";

  if (!email || !senha) {
    return mostrarErro("Preencha todos os campos.");
  }

  // Estado de carregamento no botão
  btnEntrar.disabled = true;
  btnEntrar.textContent = "Autenticando...";

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });

    const data = await response.json();

    if (response.ok) {
      // Salva a sessão associada ao slug da empresa retornada pela API
      localStorage.setItem(`session_admin_${data.slug}`, data.token);
      
      // Redireciona para o painel administrativo da loja encontrada
      window.location.href = `/admin/${data.slug}`;
    } else {
      mostrarErro(data.detail || 'E-mail ou senha incorretos.');
    }
  } catch (error) {
    console.error("Erro no login:", error);
    mostrarErro('Erro de conexão com o servidor. Tente novamente.');
  } finally {
    btnEntrar.disabled = false;
    btnEntrar.textContent = "Entrar no Painel";
  }
}

// Inicializa os ícones do Lucide ao carregar a página
window.onload = () => {
  if (window.lucide) {
    lucide.createIcons();
  }
};