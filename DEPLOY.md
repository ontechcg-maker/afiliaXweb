# AfiliaX SaaS — Guia de Deploy no Coolify & VPS

Este repositório está pronto para deploy automatizado usando **Coolify** (ou Docker Compose / Nginx manual).

---

## 🚀 Opção 1: Deploy Simplificado via Coolify (Recomendado)

O Coolify é o PaaS open-source auto-hospedado que gerencia Docker, domínios e certificados SSL automaticamente.

### Passos no Dashboard do Coolify:

1. **Adicionar Novo Recurso**:
   - Vá em **Projects** -> **+ New**.
   - Selecione **Public Repository** ou **GitHub App** e escolha o repositório `ontechcg-maker/afiliaXweb`.

2. **Configurar o Frontend (React + Vite)**:
   - Tipo de Build: **Dockerfile**
   - Caminho do Dockerfile: `Dockerfile.frontend`
   - Porta Interna: `80`
   - Domínio / FQDN: `https://app.ontechcg.cloud`
   - **Variáveis de Ambiente (Build & Runtime):**
     - `VITE_SUPABASE_URL`: Suas credenciais do Supabase
     - `VITE_SUPABASE_ANON_KEY`: Sua chave anônima

3. **Configurar o Backend (Node.js API + Worker)**:
   - Tipo de Build: **Dockerfile**
   - Caminho do Dockerfile: `Dockerfile.backend`
   - Porta Interna: `3001`
   - Domínio / FQDN: `https://app.ontechcg.cloud/api` (ou um subdomínio como `https://api.ontechcg.cloud`)
   - **Variáveis de Ambiente:**
     - `PORT`: `3001`
     - `ALLOWED_ORIGINS`: `https://app.ontechcg.cloud`
     - `SUPABASE_URL`: Suas credenciais do Supabase
     - `SUPABASE_ANON_KEY`: Sua chave anônima
     - `SUPABASE_SERVICE_ROLE_KEY`: Sua chave privada/service role
     - `EVOLUTION_BASE_URL`: `https://api.ontechcg.cloud`
     - `EVOLUTION_API_KEY`: Sua chave da Evolution API

---

## 🐳 Opção 2: Deploy com Docker Compose

Você também pode subir a aplicação inteira com um único comando na sua VPS:

```bash
docker-compose up -d --build
```

---

## 🛠 Arquivos de Configuração Criados no Repositório

- [Dockerfile.frontend](file:///c:/Projetos/afiliax/Dockerfile.frontend): Build multi-stage Node + Nginx para a SPA React.
- [Dockerfile.backend](file:///c:/Projetos/afiliax/Dockerfile.backend): Container Node 20 para a API Express + Worker.
- [nginx.conf](file:///c:/Projetos/afiliax/nginx.conf): Roteamento Nginx com suporte a SPA Fallback.
- [docker-compose.yml](file:///c:/Projetos/afiliax/docker-compose.yml): Orquestração dos contêineres para o Coolify.
