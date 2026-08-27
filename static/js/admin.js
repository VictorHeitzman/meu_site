/* ==========================================================================
   PAINEL DE GESTÃO DO LOJISTA — LÓGICA E INTERAÇÕES
   ========================================================================== */

let cropperInstance = null;
let lojaDados = null;
let itemParaExcluir = { id: null, tipo: null };
let fotosProdutoAtuais = [];

// --------------------------------------------------------------------------
// CONFIGURAÇÃO DO SUPABASE STORAGE
// --------------------------------------------------------------------------
const SUPABASE_URL = "https://eleqiuqecgkyzcoempuk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsZXFpdXFlY2dreXpjb2VtcHVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1OTI0MTgsImV4cCI6MjEwMzE2ODQxOH0.x7T3L9xFfQa377Vl7_MhpyHQ-Wkn4-G0ZTkpqdQDdOI";

async function uploadImagemParaStorage(arquivo) {
  const extensao = arquivo.name.split('.').pop();
  const nomeArquivo = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${extensao}`;
  const urlEndpoint = `${SUPABASE_URL}/storage/v1/object/produtos/${nomeArquivo}`;

  const response = await fetch(urlEndpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': arquivo.type
    },
    body: arquivo
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.message || errData.error || 'Falha no upload para o Storage.');
  }

  return `${SUPABASE_URL}/storage/v1/object/public/produtos/${nomeArquivo}`;
}

// --------------------------------------------------------------------------
// 1. UTILITÁRIOS E ALERTAS
// --------------------------------------------------------------------------
// Função auxiliar para preview rápido e envio da logo
async function uploadLogoAparencia(input) {
  if (!input.files || !input.files[0]) return;
  const arquivo = input.files[0];
  mostrarAlerta("Enviando logo para o Storage...");

  try {
    const urlPublica = await uploadImagemParaStorage(arquivo);
    
    // Atualiza a imagem de exibição na tela
    const img = document.getElementById('preview-logo');
    const ph = document.getElementById('ph-logo');
    if (img) {
      img.src = urlPublica;
      img.classList.remove('hidden');
    }
    if (ph) ph.classList.add('hidden');

    // Preenche o campo oculto que é enviado no salvarConfiguracoes()
    const inputHidden = document.getElementById('input-logo-url');
    if (inputHidden) inputHidden.value = urlPublica;

    mostrarAlerta("Logo atualizada no Storage! Clique em Salvar para aplicar.");
  } catch (err) {
    console.error(err);
    mostrarAlerta("Erro ao enviar logo.", true);
  }
}

// Fallback mantido caso o HTML ainda chame previewImagem
function previewImagem(input, idImgPreview, idPlaceholder, idInputHidden) {
  if (input.files && input.files[0]) {
    uploadLogoAparencia(input);
  }
}

function slugDaUrl() {
  return decodeURIComponent(
    window.location.pathname.replace('/admin/', '').replace(/^\/+|\/+$/g, '')
  );
}

function mostrarAlerta(msg, erro = false) {
  const box = document.getElementById('alerta');
  if (!box) return;
  box.textContent = msg;
  box.className = `p-4 rounded-xl font-medium text-sm shadow-sm ${
    erro
      ? 'bg-rose-100 text-rose-800 border border-rose-200'
      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
  }`;
  box.classList.remove('hidden');
  setTimeout(() => box.classList.add('hidden'), 4000);
}

function mudarAba(aba) {
  ['produtos', 'categorias', 'aparencia'].forEach((a) => {
    const sec = document.getElementById(`sec-${a}`);
    const tab = document.getElementById(`tab-${a}`);
    if (sec) sec.classList.add('hidden');
    if (tab)
      tab.className =
        'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-white text-slate-600 hover:bg-slate-200 transition';
  });

  const secAlvo = document.getElementById(`sec-${aba}`);
  const tabAlvo = document.getElementById(`tab-${aba}`);
  if (secAlvo) secAlvo.classList.remove('hidden');
  if (tabAlvo)
    tabAlvo.className =
      'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-slate-900 text-white shadow-sm transition';

  if (window.lucide) lucide.createIcons();
}

function mascaraWhatsapp(input) {
  let v = input.value.replace(/\D/g, "");
  if (v.length > 11) v = v.slice(0, 11);

  if (v.length > 10) {
    v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  } else if (v.length > 5) {
    v = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/, "($1) $2-$3");
  } else if (v.length > 2) {
    v = v.replace(/^(\d{2})(\d{0,5})$/, "($1) $2");
  } else {
    v = v.replace(/^(\d*)$/, "($1");
  }
  input.value = v;
}

// --------------------------------------------------------------------------
// 2. RECORTE DA CAPA DA LOJA E LOGO (CROPPER.JS + STORAGE)
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const inputBanner = document.getElementById('file-banner');
  if (inputBanner) {
    inputBanner.addEventListener('change', function (e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function (evt) {
        const cropImg = document.getElementById('img-crop-target');
        cropImg.src = evt.target.result;

        document.getElementById('modal-crop-banner').classList.remove('hidden');

        if (cropperInstance) cropperInstance.destroy();

        cropperInstance = new Cropper(cropImg, {
          aspectRatio: 4 / 1,
          viewMode: 1,
          dragMode: 'move',
          autoCropArea: 1,
          guides: true,
          center: true,
          cropBoxMovable: true,
          cropBoxResizable: true,
        });
      };
      reader.readAsDataURL(file);
    });
  }
});

function fecharModalCrop() {
  document.getElementById('modal-crop-banner').classList.add('hidden');
  if (cropperInstance) {
    cropperInstance.destroy();
    cropperInstance = null;
  }
  document.getElementById('file-banner').value = '';
}

async function confirmarRecorteCapa() {
  if (!cropperInstance) return;

  mostrarAlerta("Enviando capa para o Storage...");

  cropperInstance.getCroppedCanvas({
    width: 1200,
    height: 400,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
  }).toBlob(async (blob) => {
    if (!blob) return mostrarAlerta("Erro ao gerar capa.", true);

    try {
      const arquivoCapa = new File([blob], `capa_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const urlPublica = await uploadImagemParaStorage(arquivoCapa);

      const preview = document.getElementById('preview-banner');
      preview.src = urlPublica;
      preview.classList.remove('hidden');
      document.getElementById('ph-banner').classList.add('hidden');
      document.getElementById('input-banner-url').value = urlPublica;

      fecharModalCrop();
      mostrarAlerta("Capa atualizada no Storage!");
    } catch (err) {
      console.error(err);
      mostrarAlerta("Erro ao fazer upload da capa.", true);
    }
  }, 'image/jpeg', 0.85);
}

async function uploadLogoAparencia(input) {
  if (!input.files || !input.files[0]) return;
  const arquivo = input.files[0];
  mostrarAlerta("Enviando logo para o Storage...");

  try {
    const urlPublica = await uploadImagemParaStorage(arquivo);
    
    document.getElementById('preview-logo').src = urlPublica;
    document.getElementById('preview-logo').classList.remove('hidden');
    document.getElementById('ph-logo').classList.add('hidden');
    document.getElementById('input-logo-url').value = urlPublica;

    mostrarAlerta("Logo atualizada!");
  } catch (err) {
    console.error(err);
    mostrarAlerta("Erro ao enviar logo.", true);
  }
}

// --------------------------------------------------------------------------
// 3. GALERIA MÚLTIPLA DE IMAGENS DO PRODUTO (STORAGE)
// --------------------------------------------------------------------------
async function gerenciarUploadFotos(input) {
  if (!input.files || !input.files.length) return;

  const arquivos = Array.from(input.files);
  mostrarAlerta("Enviando imagens...");

  try {
    for (const file of arquivos) {
      const urlPublica = await uploadImagemParaStorage(file);
      fotosProdutoAtuais.push(urlPublica);
    }
    renderizarGridFotos();
    mostrarAlerta("Imagens salvas no Storage com sucesso!");
  } catch (err) {
    console.error(err);
    mostrarAlerta("Erro ao fazer upload das fotos.", true);
  } finally {
    input.value = '';
  }
}

function renderizarGridFotos() {
  const container = document.getElementById('grid-fotos-produto');
  if (!container) return;

  if (fotosProdutoAtuais.length === 0) {
    container.innerHTML = `<p class="text-[11px] text-slate-400 italic">Nenhuma foto adicionada.</p>`;
    return;
  }

  container.innerHTML = fotosProdutoAtuais
    .map(
      (url, idx) => `
    <div class="relative w-16 h-16 rounded-xl border border-slate-200 bg-slate-100 overflow-hidden group">
      <img src="${url}" class="w-full h-full object-cover">
      ${
        idx === 0
          ? `<span class="absolute top-1 left-1 bg-indigo-600 text-white text-[9px] font-bold px-1 rounded shadow">Capa</span>`
          : ''
      }
      <button type="button" onclick="removerFotoProduto(${idx})" 
              class="absolute top-1 right-1 bg-rose-600 text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shadow hover:bg-rose-700">
        ✕
      </button>
    </div>
  `
    )
    .join('');

  if (window.lucide) lucide.createIcons();
}

function removerFotoProduto(index) {
  fotosProdutoAtuais.splice(index, 1);
  renderizarGridFotos();
}

// --------------------------------------------------------------------------
// 4. MODAL DE CONFIRMAÇÃO DE EXCLUSÃO
// --------------------------------------------------------------------------
function abrirConfirmacaoExclusao(id, tipo, titulo, mensagem) {
  itemParaExcluir = { id: id, tipo: tipo };
  document.getElementById('confirm-titulo').textContent = titulo;
  document.getElementById('confirm-mensagem').textContent = mensagem;
  document.getElementById('modal-confirmar').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function fecharModalConfirm() {
  document.getElementById('modal-confirmar').classList.add('hidden');
  itemParaExcluir = { id: null, tipo: null };
}

async function executarExclusaoConfirmada() {
  const { id, tipo } = itemParaExcluir;
  if (!id || !tipo) return;

  fecharModalConfirm();

  try {
    const url =
      tipo === 'produto'
        ? `/api/admin/produtos/${id}`
        : `/api/admin/categorias/${id}`;

    const resp = await fetch(url, { method: 'DELETE' });

    if (resp.ok) {
      mostrarAlerta(
        tipo === 'produto' ? 'Produto excluído!' : 'Categoria excluída!'
      );
      if (tipo === 'categoria') {
        await atualizarApenasCategorias();
      } else {
        await atualizarApenasProdutos();
      }
    } else {
      mostrarAlerta('Erro ao excluir.', true);
    }
  } catch (err) {
    mostrarAlerta('Erro de conexão.', true);
  }
}

function deletarProduto(id) {
  abrirConfirmacaoExclusao(
    id,
    'produto',
    'Excluir Produto?',
    'Tem certeza que deseja remover este produto do catálogo?'
  );
}

function deletarCategoria(id) {
  abrirConfirmacaoExclusao(
    id,
    'categoria',
    'Excluir Categoria?',
    'Atenção: A exclusão da categoria também removerá todos os produtos vinculados a ela.'
  );
}

// --------------------------------------------------------------------------
// 5. CRUD CATEGORIAS (ISOLADO E RÁPIDO)
// --------------------------------------------------------------------------
async function cadastrarCategoria(e) {
  e.preventDefault();
  const slug = slugDaUrl();
  const inputNome = document.getElementById('cat_nome');
  const nome = inputNome ? inputNome.value.trim() : '';

  if (!nome) return;

  try {
    const resp = await fetch(`/api/admin/${slug}/categorias`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': obterTokenSessao() || ''
      },
      body: JSON.stringify({ nome }),
    });

    const data = await resp.json();

    if (resp.ok) {
      inputNome.value = '';
      mostrarAlerta('Categoria criada com sucesso!');
      await atualizarApenasCategorias();
    } else {
      mostrarAlerta(data.detail || 'Erro ao criar categoria.', true);
    }
  } catch {
    mostrarAlerta('Erro de conexão.', true);
  }
}

async function atualizarApenasCategorias() {
  const slug = slugDaUrl();
  const token = obterTokenSessao();
  
  try {
    const resp = await fetch(`/api/admin/${slug}/dados`, {
      headers: { "Authorization": token }
    });
    if (!resp.ok) return;

    lojaDados = await resp.json();

    const divCats = document.getElementById('lista-categorias');
    if (divCats) {
      divCats.innerHTML = (lojaDados.categorias || [])
        .map(c => `
          <span class="bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2">
            ${c.nome}
            <button type="button" onclick="deletarCategoria('${c.id}')" class="text-rose-500 hover:text-rose-700 font-bold">✕</button>
          </span>
        `).join('');
    }

    const selectCat = document.getElementById('prod_categoria');
    if (selectCat) {
      selectCat.innerHTML = (lojaDados.categorias || [])
        .map(c => `<option value="${c.id}">${c.nome}</option>`)
        .join('');
    }

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error("Erro ao atualizar lista de categorias:", err);
  }
}

// --------------------------------------------------------------------------
// 6. CRUD PRODUTOS (ISOLADO)
// --------------------------------------------------------------------------
function abrirModalProduto() {
  document.getElementById('prod_id_edit').value = '';
  document.getElementById('modal-prod-titulo').textContent = 'Novo Item';
  document.getElementById('prod_nome').value = '';
  document.getElementById('prod_preco').value = '';
  document.getElementById('prod_descricao').value = '';

  fotosProdutoAtuais = [];
  renderizarGridFotos();

  document.getElementById('modal-produto').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function fecharModalProduto() {
  document.getElementById('modal-produto').classList.add('hidden');
}

function editarProdutoModal(id) {
  let prod = null;
  (lojaDados?.categorias || []).forEach((c) => {
    (c.produtos || []).forEach((p) => {
      if (p.id === id) prod = p;
    });
  });

  if (!prod) return;

  document.getElementById('prod_id_edit').value = prod.id;
  document.getElementById('modal-prod-titulo').textContent = 'Editar Item';
  document.getElementById('prod_categoria').value = prod.categoria_id;
  document.getElementById('prod_nome').value = prod.nome;
  document.getElementById('prod_preco').value = prod.preco;
  document.getElementById('prod_descricao').value = prod.descricao || '';

  fotosProdutoAtuais = [];
  if (prod.imagem_url) fotosProdutoAtuais.push(prod.imagem_url);
  const extras = prod.metadados?.fotos_extras || [];
  extras.forEach((f) => {
    if (f && f !== prod.imagem_url) fotosProdutoAtuais.push(f);
  });

  renderizarGridFotos();

  document.getElementById('modal-produto').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

async function salvarProduto(e) {
  e.preventDefault();
  const slug = slugDaUrl();
  const prodId = document.getElementById('prod_id_edit').value;

  const imagemPrincipal = fotosProdutoAtuais.length > 0 ? fotosProdutoAtuais[0] : null;
  const fotosExtras = fotosProdutoAtuais.length > 1 ? fotosProdutoAtuais.slice(1) : [];

  const payload = {
    categoria_id: document.getElementById('prod_categoria').value,
    nome: document.getElementById('prod_nome').value,
    preco: parseFloat(document.getElementById('prod_preco').value) || 0.0,
    descricao: document.getElementById('prod_descricao').value,
    imagem_url: imagemPrincipal,
    fotos_extras: fotosExtras,
  };

  const url = prodId ? `/api/admin/produtos/${prodId}` : `/api/admin/${slug}/produtos`;
  const method = prodId ? 'PUT' : 'POST';

  try {
    const resp = await fetch(url, {
      method: method,
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': obterTokenSessao() || ''
      },
      body: JSON.stringify(payload),
    });

    if (resp.ok) {
      mostrarAlerta(prodId ? 'Item atualizado!' : 'Item cadastrado!');
      fecharModalProduto();
      await atualizarApenasProdutos();
    } else {
      mostrarAlerta('Erro ao salvar produto.', true);
    }
  } catch {
    mostrarAlerta('Erro de conexão.', true);
  }
}

async function atualizarApenasProdutos() {
  const slug = slugDaUrl();
  const token = obterTokenSessao();

  try {
    const resp = await fetch(`/api/admin/${slug}/dados`, {
      headers: { "Authorization": token }
    });
    if (!resp.ok) return;

    lojaDados = await resp.json();

    const divProds = document.getElementById('lista-produtos');
    if (divProds) {
      let todosProds = [];
      (lojaDados.categorias || []).forEach(c => {
        (c.produtos || []).forEach(p => todosProds.push({ ...p, categoria_nome: c.nome }));
      });

      if (todosProds.length === 0) {
        divProds.innerHTML = `<p class="text-slate-400 text-xs col-span-3 py-8 text-center bg-white rounded-2xl border border-dashed">Nenhum item cadastrado.</p>`;
      } else {
        divProds.innerHTML = todosProds.map(p => `
          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex gap-3 items-center hover:shadow-md transition">
            <div class="w-16 h-16 rounded-xl border border-slate-100 bg-slate-50 overflow-hidden shrink-0 flex items-center justify-center">
              ${p.imagem_url ? `<img src="${p.imagem_url}" class="w-full h-full object-cover">` : `<i data-lucide="package" class="w-6 h-6 text-slate-300"></i>`}
            </div>
            <div class="flex-1 min-w-0">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">${p.categoria_nome}</span>
              <h4 class="font-bold text-xs text-slate-900 truncate">${p.nome}</h4>
              <p class="text-xs font-semibold text-emerald-600 mt-0.5">${p.preco > 0 ? 'R$ ' + Number(p.preco).toFixed(2) : 'Sob Consulta'}</p>
            </div>
            <div class="flex gap-1">
              <button type="button" onclick="editarProdutoModal('${p.id}')" class="p-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">
                <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
              </button>
              <button type="button" onclick="deletarProduto('${p.id}')" class="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>
        `).join('');
      }
    }

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error("Erro ao atualizar produtos:", err);
  }
}

// --------------------------------------------------------------------------
// 7. SALVAR CONFIGURAÇÕES E APARÊNCIA
// --------------------------------------------------------------------------
async function salvarConfiguracoes(e) {
  e.preventDefault();
  const slug = slugDaUrl();
  
  const elWhats = document.getElementById('whatsapp');
  const rawWhats = elWhats ? elWhats.value.replace(/\D/g, "") : "";
  const inputNome = document.getElementById('loja_nome_input');

  const payload = {
    nome: inputNome ? inputNome.value.trim() : "",
    cor_primaria: document.getElementById('cor_primaria')?.value || "#111827",
    cor_secundaria: document.getElementById('cor_secundaria')?.value || "#F59E0B",
    cor_fundo: document.getElementById('cor_fundo')?.value || "#FAFAF9",
    subtitulo: document.getElementById('subtitulo')?.value || "",
    rodape: document.getElementById('rodape')?.value || "",
    whatsapp: rawWhats,
    logo_url: document.getElementById('input-logo-url')?.value || null,
    banner_url: document.getElementById('input-banner-url')?.value || null
  };

  try {
    const resp = await fetch(`/api/admin/${slug}/configuracoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (resp.ok) {
      mostrarAlerta("Configurações atualizadas com sucesso!");
    } else {
      const errData = await resp.json();
      mostrarAlerta(`Erro ao salvar: ${errData.detail || 'Verifique os dados'}`, true);
    }
  } catch (err) {
    mostrarAlerta("Erro de conexão.", true);
  }
}

function atualizarPreviewCores() {
  if (document.getElementById('hex-primaria'))
    document.getElementById('hex-primaria').textContent = document
      .getElementById('cor_primaria')
      .value.toUpperCase();
  if (document.getElementById('hex-secundaria'))
    document.getElementById('hex-secundaria').textContent = document
      .getElementById('cor_secundaria')
      .value.toUpperCase();
  if (document.getElementById('hex-fundo'))
    document.getElementById('hex-fundo').textContent = document
      .getElementById('cor_fundo')
      .value.toUpperCase();
}

// --------------------------------------------------------------------------
// 8. CARREGAMENTO INICIAL
// --------------------------------------------------------------------------
async function carregarDados() {
  const slug = slugDaUrl();
  const token = obterTokenSessao();

  if (!token) {
    window.location.href = "/login";
    return;
  }

  try {
    const resp = await fetch(`/api/admin/${slug}/dados`, {
      headers: { "Authorization": token }
    });

    if (resp.status === 401) {
      alert("Sessão expirada. Faça login novamente.");
      window.location.href = "/login";
      return;
    }

    if (!resp.ok) return mostrarAlerta('Erro ao carregar dados da loja.', true);

    lojaDados = await resp.json();

    const titulo = document.getElementById('admin-titulo');
    if (titulo) titulo.textContent = `Painel: ${lojaDados.nome}`;

    const linkVitrine = document.getElementById('btn-ver-vitrine');
    if (linkVitrine) {
      linkVitrine.href = `/${lojaDados.slug}`;
    }

    const inputNomeLoja = document.getElementById('loja_nome_input');
    if (inputNomeLoja) inputNomeLoja.value = lojaDados?.nome || '';

    const inputWhats = document.getElementById('whatsapp');
    if (inputWhats) {
      inputWhats.value = lojaDados?.whatsapp || '';
      mascaraWhatsapp(inputWhats);
    }

    const iden = lojaDados.configuracoes?.identidade || {};
    if (document.getElementById('cor_primaria'))
      document.getElementById('cor_primaria').value = iden.cor_primaria || '#111827';
    if (document.getElementById('cor_secundaria'))
      document.getElementById('cor_secundaria').value = iden.cor_secundaria || '#F59E0B';
    if (document.getElementById('cor_fundo'))
      document.getElementById('cor_fundo').value = iden.cor_fundo || '#FAFAF9';
    atualizarPreviewCores();

    if (iden.logo_url && document.getElementById('preview-logo')) {
      document.getElementById('preview-logo').src = iden.logo_url;
      document.getElementById('preview-logo').classList.remove('hidden');
      if (document.getElementById('ph-logo'))
        document.getElementById('ph-logo').classList.add('hidden');
      if (document.getElementById('input-logo-url'))
        document.getElementById('input-logo-url').value = iden.logo_url;
    }

    if (iden.banner_url && document.getElementById('preview-banner')) {
      document.getElementById('preview-banner').src = iden.banner_url;
      document.getElementById('preview-banner').classList.remove('hidden');
      if (document.getElementById('ph-banner'))
        document.getElementById('ph-banner').classList.add('hidden');
      if (document.getElementById('input-banner-url'))
        document.getElementById('input-banner-url').value = iden.banner_url;
    }

    const textos = lojaDados.configuracoes?.textos || {};
    if (document.getElementById('subtitulo'))
      document.getElementById('subtitulo').value = textos.subtitulo || '';
    if (document.getElementById('rodape'))
      document.getElementById('rodape').value = textos.rodape || '';

    await atualizarApenasCategorias();
    await atualizarApenasProdutos();

  } catch (err) {
    console.error('Erro no carregarDados:', err);
  }
}

// --------------------------------------------------------------------------
// FILTRO DE BUSCA EM TEMPO REAL NO ADMIN
// --------------------------------------------------------------------------
function normalizarTexto(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function filtrarProdutosAdmin(termo) {
  const busca = normalizarTexto(termo);
  const cards = document.querySelectorAll('#lista-produtos > div');

  cards.forEach(card => {
    const nome = normalizarTexto(card.querySelector('h4')?.textContent);
    const categoria = normalizarTexto(card.querySelector('span')?.textContent);

    if (busca === '' || nome.includes(busca) || categoria.includes(busca)) {
      card.style.display = 'flex';
    } else {
      card.style.display = 'none';
    }
  });
}

// --------------------------------------------------------------------------
// 9. PROTEÇÃO DE ROTA E AUTENTICAÇÃO
// --------------------------------------------------------------------------
function obterTokenSessao() {
  const slug = slugDaUrl();
  return localStorage.getItem(`session_admin_${slug}`);
}

function deslogarAdmin() {
  const slug = slugDaUrl();
  localStorage.removeItem(`session_admin_${slug}`);
  window.location.href = "/login";
}

(function checarAcessoApenasAdmin() {
  if (window.location.pathname.startsWith("/admin")) {
    const token = obterTokenSessao();
    if (!token) {
      window.location.href = "/login";
    }
  }
})();

window.onload = carregarDados;