/* ==========================================================================
   VITRINE DIGITAL DO CLIENTE — LÓGICA, CARROSSEL E CARRINHO
   ========================================================================== */

let lojaDados = null;
let termoBusca = "";
let carrinhoState = [];

// --------------------------------------------------------------------------
// 1. UTILITÁRIOS
// --------------------------------------------------------------------------
function slugDaUrl() {
  return decodeURIComponent(
    window.location.pathname.replace(/^\/+|\/+$/g, "").split("/")[0] || ""
  );
}

function reais(valor) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function obterTodasFotos(produto) {
  const fotos = [];
  if (produto.imagem_url) fotos.push(produto.imagem_url);
  const meta = produto.metadados || {};
  const extras = meta.fotos_extras || [];
  extras.forEach(f => {
    if (f && !fotos.includes(f)) fotos.push(f);
  });
  return fotos;
}

function linkWhatsApp(whatsapp, lojaNome, produto = null, orcamento = false) {
  let numero = String(whatsapp || "").replace(/\D/g, "");
  if (!numero) return "#";

  if (numero.length === 10 || numero.length === 11) {
    numero = "55" + numero;
  }

  let texto = "";
  if (produto) {
    const acao = orcamento ? "Gostaria de solicitar um orçamento para" : "Tenho interesse no produto";
    texto = encodeURIComponent(`Olá, ${lojaNome}!\n\n${acao}: *${produto.nome}*`);
  } else {
    texto = encodeURIComponent(`Olá, ${lojaNome}! Gostaria de mais informações.`);
  }

  return `https://wa.me/${numero}?text=${texto}`;
}

// --------------------------------------------------------------------------
// 2. IDENTIDADE VISUAL E CORES (APLICA CONTRASTE E COR SECUNDÁRIA)
// --------------------------------------------------------------------------
function eFundoEscuro(hex) {
  if (!hex || hex.charAt(0) !== '#') return false;
  const color = hex.replace('#', '');
  const r = parseInt(color.substring(0, 2), 16) || 0;
  const g = parseInt(color.substring(2, 4), 16) || 0;
  const b = parseInt(color.substring(4, 6), 16) || 0;
  
  // Fórmula de luminância percebida
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq < 128; // Retorna true se o fundo for escuro
}

function aplicarIdentidade(loja) {
  const iden = (loja.configuracoes && loja.configuracoes.identidade) || {};
  const root = document.documentElement.style;
  const corFundo = iden.cor_fundo || "#FAFAF9";
  
  root.setProperty("--cor-primaria", iden.cor_primaria || "#111827");
  root.setProperty("--cor-secundaria", iden.cor_secundaria || "#F59E0B");
  root.setProperty("--cor-fundo", corFundo);

  const conteudo = document.getElementById("conteudo");
  if (conteudo) {
    if (eFundoEscuro(corFundo)) {
      conteudo.classList.add("tema-escuro");
      conteudo.classList.remove("tema-claro");
    } else {
      conteudo.classList.add("tema-claro");
      conteudo.classList.remove("tema-escuro");
    }
  }

  document.title = loja.nome;
  document.getElementById("loja-nome").textContent = loja.nome;
  
  const textos = (loja.configuracoes && loja.configuracoes.textos) || {};
  document.getElementById("loja-subtitulo").textContent = textos.subtitulo || "";
  document.getElementById("loja-rodape").textContent = textos.rodape || "Atendimento via WhatsApp";

  // --- TRATAMENTO DINÂMICO DA CAPA E LOGO ---
  const header = document.getElementById("loja-header");
  const logoContainer = document.getElementById("logo-container");
  const bannerWrap = document.getElementById("banner-wrap");

  if (iden.banner_url) {
    const banner = document.getElementById("banner");
    banner.src = iden.banner_url;
    bannerWrap.classList.remove("hidden");
    
    // Liga a classe de layout com capa
    if (header) header.classList.add("tem-capa");
  } else {
    bannerWrap.classList.add("hidden");
    
    // Desliga a classe de layout com capa
    if (header) header.classList.remove("tem-capa");
  }

  if (iden.logo_url) {
    const logo = document.getElementById("logo");
    logo.src = iden.logo_url;
    if (logoContainer) logoContainer.classList.remove("hidden");
  }
}

// --------------------------------------------------------------------------
// 3. NAVEGAÇÃO, FILTROS E PESQUISA EM TEMPO REAL (SEM BUGS)
// --------------------------------------------------------------------------
function renderizarCarrosselCategorias(categorias) {
  const container = document.getElementById("abas-list");
  container.innerHTML = `
    <button id="btn-aba-todas" onclick="filtrarCategoria('todas')" class="px-4 py-1.5 rounded-full bg-secundaria text-white shrink-0 transition font-bold shadow-sm">
      Todas
    </button>
  ` + categorias.map((cat, i) => `
    <button id="btn-aba-cat-${i}" onclick="filtrarCategoria('cat-${i}')" class="px-4 py-1.5 rounded-full bg-white/10 text-white/90 hover:bg-white/20 shrink-0 transition font-semibold">
      ${cat.nome}
    </button>
  `).join("");
}

function filtrarCategoria(id) {
  // Reseta destaque visual dos botões
  document.querySelectorAll("#abas-list button").forEach(btn => {
    btn.className = "px-4 py-1.5 rounded-full bg-white/10 text-white/90 hover:bg-white/20 shrink-0 transition font-semibold";
  });

  if (id === 'todas') {
    const btnTodas = document.getElementById("btn-aba-todas");
    if (btnTodas) btnTodas.className = "px-4 py-1.5 rounded-full bg-secundaria text-white shrink-0 transition font-bold shadow-sm";

    document.querySelectorAll("section[id^='cat-']").forEach(secao => {
      secao.classList.remove("hidden");
      // Volta ao formato carrossel horizontal
      const container = secao.querySelector(".container-produtos");
      if (container) {
        container.className = "container-produtos flex gap-3.5 overflow-x-auto scroll-smooth no-scrollbar snap-x snap-mandatory py-1";
      }
      const acoesCarrossel = secao.querySelector(".acoes-carrossel");
      if (acoesCarrossel) acoesCarrossel.classList.remove("hidden");
    });
  } else {
    const btnAlvo = document.getElementById(`btn-aba-${id}`);
    if (btnAlvo) btnAlvo.className = "px-4 py-1.5 rounded-full bg-secundaria text-white shrink-0 transition font-bold shadow-sm";

    document.querySelectorAll("section[id^='cat-']").forEach(secao => {
      if (secao.id === id) {
        secao.classList.remove("hidden");
        // Transforma o carrossel em Grid Completo para ver todos os itens
        const container = secao.querySelector(".container-produtos");
        if (container) {
          container.className = "container-produtos grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 py-1";
        }
        const acoesCarrossel = secao.querySelector(".acoes-carrossel");
        if (acoesCarrossel) acoesCarrossel.classList.add("hidden");
      } else {
        secao.classList.add("hidden");
      }
    });
  }
}

function normalizarTexto(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function filtrarProdutosPorBusca(texto) {
  const termo = normalizarTexto(texto);
  const secoes = document.querySelectorAll("#conteudo section");

  secoes.forEach(secao => {
    const container = secao.querySelector(".container-produtos");
    const acoesCarrossel = secao.querySelector(".acoes-carrossel");
    const cards = secao.querySelectorAll(".wrapper-card");
    let prodsEncontrados = 0;

    cards.forEach(wrapper => {
      const nomeProduto = normalizarTexto(wrapper.querySelector("h3")?.textContent);
      const descProduto = normalizarTexto(wrapper.querySelector("p")?.textContent);

      const bateuNome = nomeProduto.includes(termo);
      const bateuDesc = descProduto.includes(termo);

      if (termo === "" || bateuNome || bateuDesc) {
        wrapper.style.display = "";
        prodsEncontrados++;
      } else {
        wrapper.style.display = "none";
      }
    });

    if (termo !== "") {
      // Quando estiver buscando, transforma o container em GRID para não cortar nada
      if (container) container.className = "container-produtos grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 py-1";
      if (acoesCarrossel) acoesCarrossel.classList.add("hidden");
    } else {
      // Se a busca for limpa, volta o layout original
      if (container) container.className = "container-produtos flex gap-3.5 overflow-x-auto scroll-smooth no-scrollbar snap-x snap-mandatory py-1";
      if (acoesCarrossel) acoesCarrossel.classList.remove("hidden");
    }

    if (prodsEncontrados > 0 || termo === "") {
      secao.style.display = "";
    } else {
      secao.style.display = "none";
    }
  });
}

// --------------------------------------------------------------------------
// 4. CARD DE PRODUTO (UTILIZA A COR SECUNDÁRIA NOS BOTÕES DE AÇÃO)
// --------------------------------------------------------------------------
function htmlProdutoCard(loja, produto, catIdx, prodIdx) {
  const orcamento = Number(produto.preco) === 0;
  const fotos = obterTodasFotos(produto);

  const precoHtml = orcamento
    ? `<span class="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100/90 px-2.5 py-1 rounded-lg">Sob Consulta</span>`
    : `<span class="text-sm font-extrabold text-slate-900">${reais(produto.preco)}</span>`;

  let areaImagemHTML = fotos.length > 0
    ? `<div onclick="abrirModal(${catIdx}, ${prodIdx})" class="cursor-pointer relative overflow-hidden bg-slate-100 group/img">
         <img src="${fotos[0]}" class="w-full h-40 sm:h-48 object-cover group-hover/img:scale-105 transition duration-300">
         ${fotos.length > 1 ? `<span class="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">+${fotos.length} fotos</span>` : ''}
       </div>`
    : `<div onclick="abrirModal(${catIdx}, ${prodIdx})" class="cursor-pointer flex h-40 sm:h-48 w-full items-center justify-center bg-slate-100 text-slate-300">
         <i data-lucide="package" class="w-8 h-8"></i>
       </div>`;

  const textoBotao = orcamento ? "Cotar" : "Adicionar";

  return `
    <article class="card-hover flex flex-col overflow-hidden rounded-2xl bg-white border border-slate-200/80 shadow-sm h-full">
      ${areaImagemHTML}
      <div class="flex flex-1 flex-col p-3.5 justify-between gap-3">
        <div onclick="abrirModal(${catIdx}, ${prodIdx})" class="cursor-pointer group/title">
          <div class="flex items-center justify-between gap-1">
            <h3 class="font-bold text-xs sm:text-sm text-slate-900 line-clamp-1 group-hover/title:text-indigo-600 transition">${produto.nome}</h3>
            <span class="text-[10px] font-semibold text-slate-400 group-hover/title:text-slate-700 flex items-center shrink-0">
              Detalhes <i data-lucide="chevron-right" class="w-3 h-3 ml-0.5"></i>
            </span>
          </div>
          <p class="mt-1 line-clamp-2 text-[11px] text-slate-500 whitespace-pre-line leading-relaxed">${produto.descricao || ""}</p>
        </div>

        <div class="flex items-center justify-between pt-2.5 border-t border-slate-100">
          ${precoHtml}
          <button type="button" onclick="adicionarAoCarrinho(${catIdx}, ${prodIdx})" 
                  class="btn-destaque font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-sm active:scale-95">
            <i data-lucide="${orcamento ? 'file-text' : 'plus'}" class="w-3.5 h-3.5"></i>
            <span>${textoBotao}</span>
          </button>
        </div>
      </div>
    </article>`;
}

// --------------------------------------------------------------------------
// 5. MODAL DE DETALHES
// --------------------------------------------------------------------------
function trocarFotoModal(el, url) {
  const imgPrincipal = document.getElementById('modal-img-principal');
  if (imgPrincipal) imgPrincipal.src = url;

  const miniaturas = document.querySelectorAll('#modal-galeria img');
  miniaturas.forEach(img => {
    img.className = "h-14 w-14 shrink-0 rounded-xl object-cover cursor-pointer border-2 border-transparent opacity-60 transition-all";
  });

  el.className = "h-14 w-14 shrink-0 rounded-xl object-cover cursor-pointer border-2 border-indigo-600 opacity-100 scale-105 transition-all shadow-md";
}

function abrirModal(catIndex, prodIndex) {
  const produto = lojaDados.categorias[catIndex].produtos[prodIndex];
  const orcamento = Number(produto.preco) === 0;
  const fotos = obterTodasFotos(produto);

  document.getElementById("modal-titulo").textContent = produto.nome;
  document.getElementById("modal-descricao").textContent = produto.descricao || "Sem descrição informada.";

  const imgPrincipal = document.getElementById("modal-img-principal");
  imgPrincipal.src = fotos[0] || "https://via.placeholder.com/400?text=Sem+Foto";

  const galeriaContainer = document.getElementById("modal-galeria");
  if (fotos.length > 1) {
    galeriaContainer.innerHTML = fotos.map((url, idx) => `
      <img src="${url}" 
           onclick="trocarFotoModal(this, '${url}')" 
           class="h-14 w-14 shrink-0 rounded-xl object-cover cursor-pointer border-2 ${idx === 0 ? 'border-indigo-600 scale-105 opacity-100 shadow-md' : 'border-transparent opacity-60'} hover:opacity-100 transition-all" />
    `).join("");
    galeriaContainer.classList.remove("hidden");
    galeriaContainer.classList.add("flex");
  } else {
    galeriaContainer.classList.add("hidden");
  }

  const divPreco = document.getElementById("modal-preco");
  divPreco.innerHTML = orcamento
    ? `<span class="inline-block rounded-lg bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Sob Consulta / Orçamento</span>`
    : `<span class="text-xl font-extrabold text-slate-900">${reais(produto.preco)}</span>`;

  const btnAction = document.getElementById("modal-btn-action");
  if (btnAction) {
    btnAction.onclick = (e) => {
      e.preventDefault();
      adicionarAoCarrinho(catIndex, prodIndex);
      fecharModal();
    };
  }
  document.getElementById("modal-btn-texto").textContent = orcamento ? "Adicionar à Cotação" : "Adicionar à Sacola";

  document.getElementById("modal-produto").classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

function fecharModal() {
  document.getElementById("modal-produto").classList.add("hidden");
}

// --------------------------------------------------------------------------
// 6. CARRINHO
// --------------------------------------------------------------------------
function adicionarAoCarrinho(catIdx, prodIdx) {
  const produto = lojaDados.categorias[catIdx].produtos[prodIdx];
  const itemExistente = carrinhoState.find(item => item.produto.id === produto.id);

  if (itemExistente) {
    itemExistente.quantidade++;
  } else {
    carrinhoState.push({ produto, quantidade: 1 });
  }

  atualizarInterfaceCarrinho();
  abrirCarrinho();
}

function alterarQtdCarrinho(idProduto, delta) {
  const index = carrinhoState.findIndex(item => item.produto.id === idProduto);
  if (index === -1) return;

  carrinhoState[index].quantidade += delta;

  if (carrinhoState[index].quantidade <= 0) {
    carrinhoState.splice(index, 1);
  }

  atualizarInterfaceCarrinho();
}

function atualizarInterfaceCarrinho() {
  const badge = document.getElementById("carrinho-qtd-badge");
  const listaContainer = document.getElementById("carrinho-itens-lista");
  const totalContainer = document.getElementById("carrinho-total-valor");

  const totalQtd = carrinhoState.reduce((acc, item) => acc + item.quantidade, 0);
  const totalValor = carrinhoState.reduce((acc, item) => acc + (item.produto.preco * item.quantidade), 0);

  if (badge) badge.textContent = totalQtd;
  if (totalContainer) totalContainer.textContent = reais(totalValor);

  if (!listaContainer) return;

  if (carrinhoState.length === 0) {
    listaContainer.innerHTML = `
      <div class="text-center py-12 text-slate-400 space-y-2">
        <i data-lucide="shopping-cart" class="w-10 h-10 mx-auto text-slate-300"></i>
        <p class="text-xs font-semibold">Sua sacola está vazia.</p>
      </div>`;
  } else {
    listaContainer.innerHTML = carrinhoState.map(item => `
      <div class="pt-3 flex items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <img src="${item.produto.imagem_url || 'https://via.placeholder.com/80'}" class="w-12 h-12 rounded-xl object-cover border shrink-0">
          <div class="min-w-0 flex-1">
            <h4 class="font-bold text-xs text-slate-900 truncate">${item.produto.nome}</h4>
            <p class="text-[11px] font-semibold text-emerald-600">${item.produto.preco > 0 ? reais(item.produto.preco) : 'Sob Consulta'}</p>
          </div>
        </div>

        <div class="flex items-center gap-2 bg-slate-100 rounded-xl p-1 border">
          <button onclick="alterarQtdCarrinho('${item.produto.id}', -1)" class="w-6 h-6 rounded-lg bg-white shadow-sm flex items-center justify-center text-xs font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-600">-</button>
          <span class="text-xs font-bold px-1 text-slate-800">${item.quantidade}</span>
          <button onclick="alterarQtdCarrinho('${item.produto.id}', 1)" class="w-6 h-6 rounded-lg bg-white shadow-sm flex items-center justify-center text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-600">+</button>
        </div>
      </div>
    `).join("");
  }

  if (window.lucide) lucide.createIcons();
}

function abrirCarrinho() {
  document.getElementById("modal-carrinho")?.classList.remove("hidden");
}

function fecharCarrinho() {
  document.getElementById("modal-carrinho")?.classList.add("hidden");
}

function enviarPedidoWhatsApp() {
  if (carrinhoState.length === 0) return;

  const numWhats = String(lojaDados?.whatsapp || "").replace(/\D/g, "");
  if (!numWhats) return alert("Número de WhatsApp não cadastrado no painel admin.");

  const possuiOrcamento = carrinhoState.some(item => Number(item.produto.preco) === 0);

  let mensagem = possuiOrcamento 
    ? `*SOLICITAÇÃO DE ORÇAMENTO - ${lojaDados.nome.toUpperCase()}*\n`
    : `*NOVO PEDIDO - ${lojaDados.nome.toUpperCase()}*\n`;

  mensagem += `-----------------------------------\n\n`;

  let totalGeral = 0;

  carrinhoState.forEach((item) => {
    const isItemOrcamento = Number(item.produto.preco) === 0;
    const subtotal = item.produto.preco * item.quantidade;
    totalGeral += subtotal;

    mensagem += `• *${item.quantidade}x* ${item.produto.nome}\n`;
    if (!isItemOrcamento) {
      mensagem += `   Subtotal: ${reais(subtotal)}\n`;
    }
  });

  mensagem += `\n-----------------------------------\n`;

  if (totalGeral > 0) {
    mensagem += `*TOTAL ESTIMADO: ${reais(totalGeral)}*\n\n`;
    mensagem += `Gostaria de confirmar a disponibilidade e prazo de entrega!`;
  } else {
    mensagem += `Gostaria de solicitar um orçamento para os itens listados acima!`;
  }

  const link = `https://wa.me/55${numWhats}?text=${encodeURIComponent(mensagem)}`;
  window.open(link, '_blank');
}

// --------------------------------------------------------------------------
// 7. RENDERIZAÇÃO DA VITRINE
// --------------------------------------------------------------------------
function renderizar(loja) {
  lojaDados = loja;
  aplicarIdentidade(loja);
  
  const main = document.getElementById("conteudo");
  const categorias = loja.categorias || [];
  
  if (!categorias.length) {
    main.innerHTML = `<p class="py-16 text-center text-slate-400 text-xs">Nenhum item disponível no momento.</p>`;
    return;
  }

  renderizarCarrosselCategorias(categorias);

  main.innerHTML = categorias.map((categoria, catIdx) => {
    const produtos = categoria.produtos || [];
    if (!produtos.length) return "";

    return `
    <section id="cat-${catIdx}" class="mb-8">
      <!-- Cabeçalho da Categoria com Classes de Tema Dinâmico -->
      <div class="flex items-center justify-between mb-3.5">
        <h2 class="titulo-cat text-sm sm:text-base font-extrabold flex items-center gap-2 tracking-tight">
          <span class="w-1.5 h-4 bg-secundaria rounded-full inline-block"></span>
          <span>${categoria.nome}</span>
        </h2>

        <div class="acoes-carrossel flex items-center gap-2">
          <button onclick="filtrarCategoria('cat-${catIdx}')" class="btn-ver-tudo text-xs font-semibold transition mr-2">
            Ver tudo
          </button>
          
          <button onclick="rolarCarrossel('carrossel-cat-${catIdx}', -300)" class="btn-seta-carrossel p-1.5 rounded-full transition">
            <i data-lucide="chevron-left" class="w-4 h-4"></i>
          </button>
          <button onclick="rolarCarrossel('carrossel-cat-${catIdx}', 300)" class="btn-seta-carrossel p-1.5 rounded-full transition">
            <i data-lucide="chevron-right" class="w-4 h-4"></i>
          </button>
        </div>
      </div>

      <!-- Carrossel de Produtos -->
      <div id="carrossel-cat-${catIdx}" class="container-produtos flex gap-3.5 overflow-x-auto scroll-smooth no-scrollbar snap-x snap-mandatory py-1">
        ${produtos.map((p, prodIdx) => `
          <div class="wrapper-card w-[280px] sm:w-[300px] shrink-0 snap-start">
            ${htmlProdutoCard(loja, p, catIdx, prodIdx)}
          </div>
        `).join("")}
      </div>
    </section>`;
  }).join("");

  if (window.lucide) lucide.createIcons();
}

function rolarCarrossel(idElemento, offset) {
  const container = document.getElementById(idElemento);
  if (container) {
    container.scrollBy({ left: offset, behavior: 'smooth' });
  }
}

async function carregar() {
  const slug = slugDaUrl();
  if (!slug) {
    document.getElementById("carregando").classList.add("hidden");
    document.getElementById("erro").textContent = "Acesse informando o slug na URL.";
    document.getElementById("erro").classList.remove("hidden");
    return;
  }

  try {
    const resp = await fetch("/api/" + encodeURIComponent(slug));
    if (!resp.ok) {
      document.getElementById("carregando").classList.add("hidden");
      document.getElementById("erro").textContent = "Loja não encontrada.";
      document.getElementById("erro").classList.remove("hidden");
      return;
    }

    const loja = await resp.json();
    document.getElementById("carregando").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");
    document.getElementById("app").classList.add("flex");
    
    renderizar(loja);
  } catch {
    document.getElementById("carregando").classList.add("hidden");
    document.getElementById("erro").textContent = "Erro ao conectar com a API.";
    document.getElementById("erro").classList.remove("hidden");
  }
}

// --------------------------------------------------------------------------
// SUPORTE A CLIQUE E ARRASTE COM O MOUSE NO PC (DRAG TO SCROLL)
// --------------------------------------------------------------------------
function ativarArrastarComMouse() {
  const carrosseis = document.querySelectorAll('.container-produtos');

  carrosseis.forEach(carrossel => {
    let estaPressionado = false;
    let inicioX;
    let scrollEsquerda;

    carrossel.addEventListener('mousedown', (e) => {
      estaPressionado = true;
      carrossel.classList.add('cursor-grabbing');
      carrossel.classList.remove('snap-x'); // Desativa o snap momentaneamente para arrastar suave
      inicioX = e.pageX - carrossel.offsetLeft;
      scrollEsquerda = carrossel.scrollLeft;
    });

    carrossel.addEventListener('mouseleave', () => {
      estaPressionado = false;
      carrossel.classList.remove('cursor-grabbing');
      carrossel.classList.add('snap-x');
    });

    carrossel.addEventListener('mouseup', () => {
      estaPressionado = false;
      carrossel.classList.remove('cursor-grabbing');
      carrossel.classList.add('snap-x');
    });

    carrossel.addEventListener('mousemove', (e) => {
      if (!estaPressionado) return;
      e.preventDefault();
      const x = e.pageX - carrossel.offsetLeft;
      const caminhado = (x - inicioX) * 1.5; // Multiplicador de velocidade do arraste
      carrossel.scrollLeft = scrollEsquerda - caminhado;
    });
  });
}

// Executa a função após renderizar a vitrine
const renderizarOriginal = renderizar;
renderizar = function(loja) {
  renderizarOriginal(loja);
  ativarArrastarComMouse();
};

window.onload = carregar;