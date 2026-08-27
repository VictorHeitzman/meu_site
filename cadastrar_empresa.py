import secrets
import string
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# from passlib.context import CryptContext
import bcrypt
from sqlmodel import Session, select
from app.database import engine
from app.models import Loja

# Configurações de E-mail (Ajuste com os seus dados de SMTP)
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
EMAIL_REMETENTE = "heitzmam@gmail.com"      # <-- Seu e-mail
SENHA_REMETENTE = "@Vic371191"          # <-- Sua senha de app do Gmail/SMTP

# pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def gerar_hash_senha(senha: str) -> str:
    # Garante o limite de bytes do bcrypt e gera o hash
    senha_bytes = senha.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(senha_bytes, salt).decode('utf-8')

def gerar_senha_aleatoria(tamanho=8):
    # Gera uma senha segura com letras e números (Ex: K8f92mA1)
    caracteres = string.ascii_letters + string.digits
    return ''.join(secrets.choice(caracteres) for _ in range(tamanho))

def enviar_email_acesso(email_destino, slug, senha):
    link_admin = f"http://localhost:8000/admin/{slug}" # Ou seu domínio em produção
    
    assunto = "Seu Acesso ao Painel do Catálogo Digital"
    corpo = f"""
    Olá!

    Sua conta no Catálogo Digital foi criada com sucesso.

    Acesse seu painel administrativo para configurar sua loja e cadastrar seus produtos:

    🔗 Link do Painel: {link_admin}
    👤 E-mail: {email_destino}
    🔑 Senha de Acesso: {senha}

    Recomendamos guardar este e-mail para acessos futuros.
    """

    msg = MIMEMultipart()
    msg['From'] = EMAIL_REMETENTE
    msg['To'] = email_destino
    msg['Subject'] = assunto
    msg.attach(MIMEText(corpo, 'plain', 'utf-8'))

    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(EMAIL_REMETENTE, SENHA_REMETENTE)
        server.sendmail(EMAIL_REMETENTE, email_destino, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print(f"⚠️ Erro ao enviar e-mail: {e}")
        return False

def criar_tenant_rapido():
    print("\n=== CADASTRO RÁPIDO DE CLIENTE (TENANT) ===")
    
    email = input("E-mail do Cliente: ").strip().lower()
    if not email or "@" not in email:
        print("❌ E-mail inválido.")
        return

    slug = input("Slug/Rota da Loja (ex: barbearia-silva): ").strip().lower()
    if not slug:
        print("❌ Slug é obrigatório.")
        return

    # Gera a senha aleatória
    senha_plana = gerar_senha_aleatoria(8)
    senha_hash = gerar_hash_senha(senha_plana)

    with Session(engine) as session:
        # Checa se o slug já existe
        if session.exec(select(Loja).where(Loja.slug == slug)).first():
            print(f"❌ A rota '/{slug}' já está em uso.")
            return

        # Cria a loja apenas com o essencial e configurações em branco/padrão
        nova_loja = Loja(
            nome=slug.replace("-", " ").title(), # Nome temporário baseado no slug
            slug=slug,
            email=email,
            senha_hash=senha_hash,
            whatsapp="",
            configuracoes={
                "identidade": {
                    "cor_primaria": "#111827",
                    "cor_secundaria": "#F59E0B",
                    "cor_fundo": "#FAFAF9",
                    "logo_url": None,
                    "banner_url": None
                },
                "textos": {
                    "subtitulo": "",
                    "rodape": ""
                }
            }
        )

        session.add(nova_loja)
        session.commit()

        # Resumo visual na tela
        print("\n" + "="*45)
        print("    CLIENTE CADASTRADO COM SUCESSO!")
        print("="*45)
        print(f"📧 E-mail:   {email}")
        print(f"🔑 Senha:    {senha_plana}")
        print(f"🌐 Slug:     {slug}")
        print(f"🔗 Admin:    http://localhost:8000/admin/{slug}")
        print("="*45)

        # Envia o e-mail automático
        print("Disparando e-mail com credenciais...")
        if enviar_email_acesso(email, slug, senha_plana):
            print("✉️  E-mail enviado com sucesso para o cliente!")
        else:
            print("⚠️  Não foi possível enviar o e-mail. Passe os dados acima manualmente.")

if __name__ == "__main__":
    criar_tenant_rapido()