"""Engine e sessão SQLModel para o PostgreSQL do Supabase.

Uma única instância / um único banco: o isolamento entre lojas
é por `loja_id` (e pelo `slug` na rota GET /{slug}), não por schema.
"""

from collections.abc import Generator

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlmodel import Session, SQLModel, create_engine


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str
    echo_sql: bool = False


settings = Settings()

# pool_pre_ping revalida conexões ociosas (comum no pooler do Supabase).
engine = create_engine(
    settings.database_url,
    echo=settings.echo_sql,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)


def create_db_and_tables() -> None:
    """Cria as tabelas a partir dos modelos SQLModel (dev / bootstrap)."""
    from app import models  # noqa: F401 — registra os mapeamentos

    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    """Dependência FastAPI: uma sessão por request, fechada ao final."""
    with Session(engine) as session:
        yield session
