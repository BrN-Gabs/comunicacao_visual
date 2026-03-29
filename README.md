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
- `FRONTEND_URL`
- `CORS_ORIGINS`
- `INITIAL_ADMIN_*`

3. Suba os containers:

```bash
docker compose up -d --build
```

4. Acesse:

- Frontend: `http://localhost:3001`
- Backend: `http://localhost:3000/api`

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

## Observacoes

- O backend aplica `prisma migrate deploy` ao iniciar o container.
- Se o banco estiver vazio, o backend cria automaticamente o primeiro `ADMIN` usando `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD`.
- As imagens enviadas ficam persistidas no volume `backend_uploads`.
- Os dados do Postgres ficam persistidos no volume `postgres_data`.
- Para deploy externo, ajuste `NEXT_PUBLIC_API_URL`, `FRONTEND_URL` e `CORS_ORIGINS` para os dominios reais.
