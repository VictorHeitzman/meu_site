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
      if (data.total_lojas === 1) {
        // Se a conta tem apenas 1 loja, salva a sessão e entra direto
        const loja = data.lojas[0];
        localStorage.setItem(`session_admin_${loja.slug}`, loja.id);
        window.location.href = `/admin/${loja.slug}`;
      } else {
        // Se tem 2 ou mais lojas, salva a lista e vai para a tela de seleção
        localStorage.setItem('contas_lojas', JSON.stringify(data.lojas));
        window.location.href = '/selecionar-loja';
      }
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