"""Modelos de domínio: um schema, N lojas (multitenant por linha)."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Optional, List

from sqlalchemy import Column, DateTime, ForeignKey, Numeric, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlmodel import Field, Relationship, SQLModel


# ---------------------------------------------------------------------------
# Contratos JSONB (não são tabelas)
# ---------------------------------------------------------------------------


class IdentidadeVisual(SQLModel):
    cor_primaria: str = "#111827"
    cor_secundaria: str = "#F59E0B"
    cor_fundo: str = "#FFFFFF"
    cor_texto: str = "#111827"
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None


class HorarioFuncionamento(SQLModel):
    dia: str
    abre: Optional[str] = None
    fecha: Optional[str] = None
    fechado: bool = False


class ConfiguracoesLoja(SQLModel):
    identidade: IdentidadeVisual = Field(default_factory=IdentidadeVisual)
    horarios: List[HorarioFuncionamento] = Field(default_factory=list)
    textos: dict[str, str] = Field(default_factory=dict)


class MetadadosProduto(SQLModel):
    fotos_extras: List[str] = Field(default_factory=list)
    tamanhos: List[str] = Field(default_factory=list)
    cores: List[str] = Field(default_factory=list)


def _configuracoes_padrao() -> dict[str, Any]:
    return ConfiguracoesLoja().model_dump()


def _metadados_padrao() -> dict[str, Any]:
    return MetadadosProduto().model_dump()


# ---------------------------------------------------------------------------
# Tabelas
# ---------------------------------------------------------------------------


class Loja(SQLModel, table=True):
    __tablename__ = "lojas"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        sa_column=Column(
            PG_UUID(as_uuid=True),
            primary_key=True,
            server_default=text("gen_random_uuid()"),
        ),
    )
    nome: str = Field(max_length=120)
    slug: str = Field(max_length=80, unique=True, index=True)
    email: Optional[str] = Field(default=None)
    senha_hash: Optional[str] = Field(default=None)
    whatsapp: str = Field(max_length=20)
    configuracoes: dict[str, Any] = Field(
        default_factory=_configuracoes_padrao,
        sa_column=Column(
            JSONB,
            nullable=False,
            server_default=text("'{}'::jsonb"),
        ),
    )
    created_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False),
    )

    # Relacionamentos corrigidos usando typing.List
    categorias: List["Categoria"] = Relationship(back_populates="loja")
    produtos: List["Produto"] = Relationship(back_populates="loja")


class Categoria(SQLModel, table=True):
    __tablename__ = "categorias"
    __table_args__ = (UniqueConstraint("loja_id", "nome", name="uq_categorias_loja_nome"),)

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        sa_column=Column(
            PG_UUID(as_uuid=True),
            primary_key=True,
            server_default=text("gen_random_uuid()"),
        ),
    )
    loja_id: uuid.UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("lojas.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
    )
    nome: str = Field(max_length=80)

    loja: Optional[Loja] = Relationship(back_populates="categorias")
    produtos: List["Produto"] = Relationship(back_populates="categoria")


class Produto(SQLModel, table=True):
    __tablename__ = "produtos"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        sa_column=Column(
            PG_UUID(as_uuid=True),
            primary_key=True,
            server_default=text("gen_random_uuid()"),
        ),
    )
    loja_id: uuid.UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("lojas.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
    )
    categoria_id: uuid.UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("categorias.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
    )
    nome: str = Field(max_length=160)
    preco: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(10, 2), nullable=False, server_default="0.00"),
    )
    descricao: Optional[str] = Field(default=None, sa_column=Column(Text))
    imagem_url: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    metadados: dict[str, Any] = Field(
        default_factory=_metadados_padrao,
        sa_column=Column(
            JSONB,
            nullable=False,
            server_default=text("'{}'::jsonb"),
        ),
    )

    loja: Optional[Loja] = Relationship(back_populates="produtos")
    categoria: Optional[Categoria] = Relationship(back_populates="produtos")

    @property
    def eh_servico_orcamento(self) -> bool:
        fotos = (self.metadados or {}).get("fotos_extras") or []
        return self.preco <= 0 and bool(fotos)

    @property
    def eh_varejo(self) -> bool:
        fotos = (self.metadados or {}).get("fotos_extras") or []
        return self.preco > 0 and not fotos