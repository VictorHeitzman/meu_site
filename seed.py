"""Cadastra lojas de exemplo para testar GET /{slug} e a vitrine.

Uso (na raiz do projeto, com .env e venv ativos):

    python seed.py
"""

from __future__ import annotations

from decimal import Decimal

from sqlmodel import Session, select

from app.database import create_db_and_tables, engine
from app.models import Categoria, ConfiguracoesLoja, HorarioFuncionamento, IdentidadeVisual, Loja, Produto

SLUG_BARBEARIA = "barbearia-pedreira"
SLUG_ACM = "acm-master"

FOTOS = {
    "corte": "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=800",
    "barba": "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800",
    "combo": "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800",
    "toldo": "https://images.unsplash.com/photo-1449844908441-8829872d2607?w=800",
    "banner": "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800",
    "fachada": "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800",
    "acm1": "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800",
    "acm2": "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800",
    "acm3": "https://images.unsplash.com/photo-1497215728101-856f4ea8437e?w=800",
}


def _horarios_semana(abre: str, fecha: str, domingo_fechado: bool = True) -> list[HorarioFuncionamento]:
    dias = [
        ("segunda", abre, fecha, False),
        ("terca", abre, fecha, False),
        ("quarta", abre, fecha, False),
        ("quinta", abre, fecha, False),
        ("sexta", abre, fecha, False),
        ("sabado", abre, fecha, False),
        ("domingo", None, None, domingo_fechado),
    ]
    return [
        HorarioFuncionamento(dia=dia, abre=abre_h, fecha=fecha_h, fechado=fechado)
        for dia, abre_h, fecha_h, fechado in dias
    ]


def _apagar_loja_por_slug(session: Session, slug: str) -> None:
    loja = session.exec(select(Loja).where(Loja.slug == slug)).first()
    if loja is None:
        return

    produtos = session.exec(select(Produto).where(Produto.loja_id == loja.id)).all()
    for produto in produtos:
        session.delete(produto)
    session.flush()

    categorias = session.exec(select(Categoria).where(Categoria.loja_id == loja.id)).all()
    for categoria in categorias:
        session.delete(categoria)
    session.flush()

    session.delete(loja)
    session.flush()


def _criar_categoria(session: Session, loja_id, nome: str) -> Categoria:
    categoria = Categoria(loja_id=loja_id, nome=nome)
    session.add(categoria)
    session.flush()
    return categoria


def _criar_produto(session: Session, loja_id, categoria_id, **kwargs) -> Produto:
    produto = Produto(loja_id=loja_id, categoria_id=categoria_id, **kwargs)
    session.add(produto)
    return produto


def seed_barbearia_pedreira(session: Session) -> Loja:
    loja = Loja(
        nome="Barbearia Pedreira",
        slug=SLUG_BARBEARIA,
        whatsapp="5511988880101",
        configuracoes=ConfiguracoesLoja(
            identidade=IdentidadeVisual(
                cor_primaria="#1C1917",
                cor_secundaria="#C2410C",
                cor_fundo="#FAFAF9",
                cor_texto="#1C1917",
            ),
            horarios=_horarios_semana("09:00", "20:00"),
            textos={
                "subtitulo": "Corte, barba e estilo no Pedreira.",
                "rodape": "Atendimento por ordem de chegada. Traga seu estilo.",
            },
        ).model_dump(),
    )
    session.add(loja)
    session.flush()

    cortes = _criar_categoria(session, loja.id, "Cortes")
    barbas = _criar_categoria(session, loja.id, "Barba")
    combos = _criar_categoria(session, loja.id, "Combos")

    _criar_produto(
        session,
        loja.id,
        cortes.id,
        nome="Corte clássico",
        preco=Decimal("45.00"),
        descricao="Máquina e tesoura, finalização com pomada.",
        imagem_url=FOTOS["corte"],
        metadados={},
    )
    _criar_produto(
        session,
        loja.id,
        cortes.id,
        nome="Degradê",
        preco=Decimal("55.00"),
        descricao="Fade médio ou high fade, alinhamento do pezinho.",
        imagem_url=FOTOS["corte"],
        metadados={},
    )
    _criar_produto(
        session,
        loja.id,
        barbas.id,
        nome="Barba completa",
        preco=Decimal("35.00"),
        descricao="Toalha quente, navalha e óleo hidratante.",
        imagem_url=FOTOS["barba"],
        metadados={},
    )
    _criar_produto(
        session,
        loja.id,
        combos.id,
        nome="Corte + barba",
        preco=Decimal("70.00"),
        descricao="Pacote completo para o visual da semana.",
        imagem_url=FOTOS["combo"],
        metadados={},
    )
    return loja


def seed_acm_master(session: Session) -> Loja:
    loja = Loja(
        nome="ACM Master",
        slug=SLUG_ACM,
        whatsapp="5511977770202",
        configuracoes=ConfiguracoesLoja(
            identidade=IdentidadeVisual(
                cor_primaria="#0F172A",
                cor_secundaria="#0369A1",
                cor_fundo="#F8FAFC",
                cor_texto="#0F172A",
            ),
            horarios=_horarios_semana("08:00", "18:00"),
            textos={
                "subtitulo": "Comunicação visual sob medida: toldos, banners e fachadas.",
                "rodape": "Orçamento sem compromisso. Atendemos São Paulo e ABC.",
            },
        ).model_dump(),
    )
    session.add(loja)
    session.flush()

    toldos = _criar_categoria(session, loja.id, "Toldos")
    banners = _criar_categoria(session, loja.id, "Banners e faixas")
    fachadas = _criar_categoria(session, loja.id, "Fachadas em ACM")

    descricao_toldo = (
        "Projeto e instalação de toldo retrátil ou fixo em lona PVC ou policarbonato. "
        "Inclui visita técnica para medição, definição de estrutura metálica, "
        "escolha de tecido (cores sólidas ou impressão digital) e instalação com "
        "garantia de ferragens. Indicado para fachadas comerciais, residências e "
        "áreas gourmet. O valor final depende de largura, projeção, tipo de acionamento "
        "(manual ou motorizado) e acesso ao local da obra."
    )
    descricao_banner = (
        "Impressão digital em lona 440g, com ou sem ilhós, acabamento em madeira ou "
        "bastão. Arte desenvolvida sob briefing: logotipo, paleta e textos longos de "
        "campanha. Formatos comuns: faixa de loja, backdrop para eventos e outdoor "
        "temporário. Sem preço de tabela — cada peça é orçada por m², quantidade e prazo."
    )
    descricao_fachada = (
        "Revestimento de fachada em placas de ACM (alumínio composto), com recortes CNC, "
        "iluminação em LED e letras caixa. Executamos desmontagem de frente antiga, "
        "estrutura, instalação e limpeza da obra. Portfólio com obras em shoppings, "
        "galerias e pontos de rua. Orçamento após análise de fotos da fachada atual "
        "e medidas aproximadas."
    )

    fotos_toldo = [FOTOS["toldo"], FOTOS["acm1"], FOTOS["acm2"]]
    fotos_banner = [FOTOS["banner"], FOTOS["acm2"], FOTOS["acm3"]]
    fotos_fachada = [FOTOS["fachada"], FOTOS["acm3"], FOTOS["acm1"]]

    _criar_produto(
        session,
        loja.id,
        toldos.id,
        nome="Toldo comercial sob medida",
        preco=Decimal("0.00"),
        descricao=descricao_toldo,
        imagem_url=FOTOS["toldo"],
        metadados={"fotos_extras": fotos_toldo, "fotos": fotos_toldo, "tamanhos": [], "cores": []},
    )
    _criar_produto(
        session,
        loja.id,
        banners.id,
        nome="Banner e faixa promocional",
        preco=Decimal("0.00"),
        descricao=descricao_banner,
        imagem_url=FOTOS["banner"],
        metadados={"fotos_extras": fotos_banner, "fotos": fotos_banner, "tamanhos": [], "cores": []},
    )
    _criar_produto(
        session,
        loja.id,
        fachadas.id,
        nome="Fachada em ACM + letras caixa",
        preco=Decimal("0.00"),
        descricao=descricao_fachada,
        imagem_url=FOTOS["fachada"],
        metadados={"fotos_extras": fotos_fachada, "fotos": fotos_fachada, "tamanhos": [], "cores": []},
    )
    return loja


def main() -> None:
    create_db_and_tables()
    with Session(engine) as session:
        _apagar_loja_por_slug(session, SLUG_BARBEARIA)
        _apagar_loja_por_slug(session, SLUG_ACM)
        barbearia = seed_barbearia_pedreira(session)
        acm = seed_acm_master(session)
        session.commit()
        print(f"OK  GET /{barbearia.slug}  →  {barbearia.nome}")
        print(f"OK  GET /{acm.slug}  →  {acm.nome}")


if __name__ == "__main__":
    main()
