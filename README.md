# Comunicacao Visual

Estrutura Docker pronta para subir o projeto inteiro com:

- `frontend` em Next.js
- `backend` em NestJS
- `postgres` para o banco
- volume persistente para `backend/uploads`

## Como subir com Docker

1. Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

2. Ajuste os valores do `.env`, principalmente:

- `JWT_SECRET`
- `SMTP_*`
- `NEXT_PUBLIC_API_URL`
- `INTERNAL_API_URL`
- `FRONTEND_URL`
- `CORS_ORIGINS`
- `CORS_ALLOW_TRYCLOUDFLARE`
- `INITIAL_ADMIN_*`

3. Suba os containers:

```bash
docker compose up -d --build
```

4. Acesse:

- Frontend: `http://localhost:3001`
- Backend: `http://localhost:3000/api`
- Uploads: `http://localhost:3001/uploads/...`

## Comandos uteis

Subir novamente apos alteracoes:

```bash
docker compose up -d --build
```

Parar tudo:

```bash
docker compose down
```

Ver logs:

```bash
docker compose logs -f
```

## Link publico da sua maquina

Com essa configuracao, o frontend faz proxy de `/api` e `/uploads` para o backend. Isso permite publicar so a porta `3001`.

Opcao recomendada com Cloudflare Tunnel:

1. Instale o `cloudflared`
2. Com os containers de pe, rode:

```bash
cloudflared tunnel --url http://localhost:3001
```

3. Compartilhe o link `https://...trycloudflare.com`

Observacoes sobre esse modo:

- Seu PC precisa ficar ligado e com internet
- Se o link publico mudar, atualize `FRONTEND_URL` se quiser que emails de recuperacao apontem para o endereco publico correto
- `CORS_ALLOW_TRYCLOUDFLARE=true` permite usar Quick Tunnel da Cloudflare sem editar o CORS a cada novo subdominio
- O backend e o Postgres ficam publicados so em `127.0.0.1`, para nao expor portas desnecessarias

## Observacoes

- O backend aplica `prisma migrate deploy` ao iniciar o container.
- Se o banco estiver vazio, o backend cria automaticamente o primeiro `ADMIN` usando `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD`.
- As imagens enviadas ficam persistidas no volume `backend_uploads`.
- Os dados do Postgres ficam persistidos no volume `postgres_data`.
- O frontend reescreve `/api` e `/uploads` para o backend usando `INTERNAL_API_URL`.
- Para deploy externo, ajuste `FRONTEND_URL` e `CORS_ORIGINS` para os dominios reais.
