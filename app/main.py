"""API do catálogo: Vitrine pública e API CRUD Completa para o Admin."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Optional

from fastapi import Header
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import Response, HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles

from pydantic import BaseModel
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select
from sqlalchemy.orm.attributes import flag_modified
from app.database import get_session
from app.models import Categoria, Loja, Produto
from sqlalchemy.exc import IntegrityError

app = FastAPI(title="Catálogos Digitais - Admin API", version="0.2.0")
templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="static"), name="static")

import bcrypt
from pydantic import BaseModel

class LoginSchema(BaseModel):
    email: str
    senha: str

@app.get("/apresentacao", response_class=HTMLResponse)
def pagina_apresentacao(request: Request):
    return templates.TemplateResponse(
        request=request, 
        name="apresentacao.html"
    )
# 1. Rota da página de login genérica
@app.get("/login")
def pagina_login(request: Request):
    return templates.TemplateResponse(request=request, name="login.html", context={})

# 2. Endpoint da API que busca a loja pelo e-mail e valida a senha
@app.post("/api/login")
def api_login_generico(dados: LoginSchema, session: Session = Depends(get_session)):
    email_limpo = dados.email.lower().strip()
    
    # Busca a loja diretamente pelo e-mail cadastrado
    loja = session.exec(select(Loja).where(Loja.email == email_limpo)).first()
    if not loja or not loja.senha_hash:
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos.")

    # Valida a senha enviada
    senha_bytes = dados.senha.encode('utf-8')[:72]
    hash_bytes = loja.senha_hash.encode('utf-8')

    if not bcrypt.checkpw(senha_bytes, hash_bytes):
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos.")

    # Retorna o token e o slug da loja encontrada para o redirecionamento
    return {
        "status": "sucesso", 
        "token": str(loja.id), 
        "slug": loja.slug
    }

# --- SCHEMAS DE ENTRADA (PYDANTIC) ---
class ConfiguracaoSchema(BaseModel):
    nome: Optional[str] = None
    cor_primaria: str
    cor_secundaria: str
    cor_fundo: str
    subtitulo: Optional[str] = ""
    rodape: Optional[str] = ""
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    whatsapp: Optional[str] = ""

class CategoriaSchema(BaseModel):
    nome: str

class ProdutoSchema(BaseModel):
    categoria_id: str
    nome: str
    preco: float = 0.0
    descricao: Optional[str] = ""
    imagem_url: Optional[str] = None
    fotos_extras: list[str] = []


def _json_nativo(valor: Any) -> Any:
    if isinstance(valor, uuid.UUID):
        return str(valor)
    if isinstance(valor, Decimal):
        return float(valor)
    if isinstance(valor, datetime):
        return valor.isoformat()
    if isinstance(valor, dict):
        return {chave: _json_nativo(item) for chave, item in valor.items()}
    if isinstance(valor, (list, tuple)):
        return [_json_nativo(item) for item in valor]
    return valor


def _buscar_loja_por_slug(session: Session, slug: str) -> Optional[Loja]:
    stmt = (
        select(Loja)
        .where(Loja.slug == slug)
        .options(selectinload(Loja.categorias).selectinload(Categoria.produtos))
    )
    return session.exec(stmt).first()


@app.get("/favicon.ico", include_in_schema=False)
def favicon() -> Response:
    return Response(status_code=204)

@app.get("/api/admin/{slug}/dados")
def buscar_dados_admin(slug: str, authorization: str = Header(None), session: Session = Depends(get_session)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Acesso não autorizado.")

    loja = _buscar_loja_por_slug(session, slug)

    if not loja or str(loja.id) != authorization:
        raise HTTPException(status_code=401, detail="Sessão inválida ou loja não encontrada.")

    return _json_nativo({
        "id": loja.id,
        "nome": loja.nome,
        "slug": loja.slug,
        "email": loja.email,
        "whatsapp": loja.whatsapp,
        "configuracoes": loja.configuracoes or {},
        "categorias": [
            {
                "id": cat.id,
                "nome": cat.nome,
                "produtos": [
                    {
                        "id": prod.id,
                        "categoria_id": prod.categoria_id,
                        "nome": prod.nome,
                        "preco": prod.preco,
                        "descricao": prod.descricao,
                        "imagem_url": prod.imagem_url,
                        "metadados": prod.metadados or {}
                    }
                    for prod in cat.produtos
                ]
            }
            for cat in loja.categorias
        ]
    })

# --- ROTAS DE PÁGINAS (HTML) ---
@app.get("/{slug}")
def vitrine(slug: str, request: Request):
    return templates.TemplateResponse(request=request, name="index.html", context={"slug": slug})

@app.get("/admin/{slug}")
def pagina_admin(slug: str, request: Request, session: Session = Depends(get_session)):
    loja = session.exec(select(Loja).where(Loja.slug == slug)).first()
    if not loja:
        raise HTTPException(status_code=404, detail="Loja não encontrada.")
    return templates.TemplateResponse(request=request, name="admin.html", context={"slug": slug})

# --- ROTAS DE API PÚBLICA ---
@app.get("/api/{slug}")
def api_catalogo(slug: str, session: Session = Depends(get_session)) -> dict[str, Any]:
    loja = _buscar_loja_por_slug(session, slug)
    if loja is None:
        raise HTTPException(status_code=404, detail="Loja não encontrada.")
    
    return _json_nativo({
        "id": loja.id,
        "nome": loja.nome,
        "slug": loja.slug,
        "whatsapp": loja.whatsapp,
        "configuracoes": loja.configuracoes or {},
        "categorias": [
            {
                "id": categoria.id,
                "nome": categoria.nome,
                "produtos": [
                    {
                        "id": produto.id,
                        "categoria_id": produto.categoria_id,
                        "nome": produto.nome,
                        "preco": produto.preco,
                        "descricao": produto.descricao,
                        "imagem_url": produto.imagem_url,
                        "metadados": produto.metadados or {},
                    }
                    for produto in categoria.produtos
                ],
            }
            for categoria in loja.categorias
        ],
    })

# --- ROTAS CRUD ADMIN ---

# 1. Configurações da Loja
# No app/main.py

@app.post("/api/admin/{slug}/configuracoes")
def salvar_configuracoes(slug: str, dados: ConfiguracaoSchema, session: Session = Depends(get_session)):
    loja = session.exec(select(Loja).where(Loja.slug == slug)).first()
    if not loja:
        raise HTTPException(status_code=404, detail="Loja não encontrada.")

    # 1. Atualiza diretamente a coluna 'nome' da tabela 'lojas'
    if dados.nome and dados.nome.strip():
        loja.nome = dados.nome.strip()

    # 2. Atualiza o WhatsApp
    if dados.whatsapp is not None:
        loja.whatsapp = dados.whatsapp

    # 3. Atualiza as configurações JSONB
    nova_config = {
        "identidade": {
            "cor_primaria": dados.cor_primaria,
            "cor_secundaria": dados.cor_secundaria,
            "cor_fundo": dados.cor_fundo,
            "logo_url": dados.logo_url,
            "banner_url": dados.banner_url
        },
        "textos": {
            "subtitulo": dados.subtitulo,
            "rodape": dados.rodape
        }
    }

    loja.configuracoes = nova_config
    flag_modified(loja, "configuracoes")

    # Força a persistência explicitamente
    session.add(loja)
    session.commit()
    session.refresh(loja)

    return {"status": "sucesso", "mensagem": "Configurações atualizadas!"}


# 2. Categorias (Criar e Deletar)
@app.post("/api/admin/{slug}/categorias")
def criar_categoria(slug: str, dados: CategoriaSchema, session: Session = Depends(get_session)):
    loja = session.exec(select(Loja).where(Loja.slug == slug)).first()
    if not loja:
        raise HTTPException(status_code=404, detail="Loja não encontrada.")

    nome_limpo = dados.nome.strip()
    if not nome_limpo:
        raise HTTPException(status_code=400, detail="Informe um nome válido.")

    try:
        loja_id_uuid = loja.id if isinstance(loja.id, uuid.UUID) else uuid.UUID(str(loja.id))
        
        nova_cat = Categoria(
            loja_id=loja_id_uuid,
            nome=nome_limpo
        )
        session.add(nova_cat)
        session.commit()
        session.refresh(nova_cat)

        return {"status": "sucesso", "id": str(nova_cat.id), "nome": nova_cat.nome}

    except IntegrityError:
        session.rollback()
        # Captura o nome duplicado e avisa ao usuário com status 400 em vez de crashar o servidor
        raise HTTPException(
            status_code=400, 
            detail=f"A categoria '{nome_limpo}' já está cadastrada nesta loja."
        )
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/admin/categorias/{categoria_id}")
def deletar_categoria(categoria_id: str, session: Session = Depends(get_session)):
    try:
        cat_uuid = uuid.UUID(categoria_id) if not isinstance(categoria_id, uuid.UUID) else categoria_id
        cat = session.exec(select(Categoria).where(Categoria.id == cat_uuid)).first()
        
        if not cat:
            raise HTTPException(status_code=404, detail="Categoria não encontrada.")

        session.delete(cat)
        session.commit()
        return {"status": "sucesso"}

    except ValueError:
        raise HTTPException(status_code=400, detail="ID de categoria inválido.")
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao deletar: {str(e)}")
# 3. Produtos (Criar, Editar e Deletar)

@app.post("/api/admin/{slug}/produtos")
def criar_produto(slug: str, dados: ProdutoSchema, session: Session = Depends(get_session)):
    loja = session.exec(select(Loja).where(Loja.slug == slug)).first()
    if not loja:
        raise HTTPException(status_code=404, detail="Loja não encontrada.")

    novo_prod = Produto(
        loja_id=loja.id,
        categoria_id=uuid.UUID(dados.categoria_id),
        nome=dados.nome,
        preco=Decimal(str(dados.preco)),
        descricao=dados.descricao,
        imagem_url=dados.imagem_url,
        metadados={"fotos_extras": dados.fotos_extras}
    )
    session.add(novo_prod)
    session.commit()
    return {"status": "sucesso"}

@app.put("/api/admin/produtos/{produto_id}")
def editar_produto(produto_id: str, dados: ProdutoSchema, session: Session = Depends(get_session)):
    prod = session.exec(select(Produto).where(Produto.id == uuid.UUID(produto_id))).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")

    prod.categoria_id = uuid.UUID(dados.categoria_id)
    prod.nome = dados.nome
    prod.preco = Decimal(str(dados.preco))
    prod.descricao = dados.descricao
    prod.imagem_url = dados.imagem_url
    prod.metadados = {"fotos_extras": dados.fotos_extras}

    session.add(prod)
    session.commit()
    return {"status": "sucesso"}

@app.delete("/api/admin/produtos/{produto_id}")
def deletar_produto(produto_id: str, session: Session = Depends(get_session)):
    prod = session.exec(select(Produto).where(Produto.id == uuid.UUID(produto_id))).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")
    session.delete(prod)
    session.commit()
    return {"status": "sucesso"}