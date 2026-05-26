# Optima AI Backend (Railway)

Service Node.js / Fastify pour l’orchestration IA d’Optima Seller AI.

## Rôle

| Couche | Responsabilité |
|--------|----------------|
| **Vercel (Next.js)** | UI, auth UI, dashboard, rendu chat client |
| **Railway (ce service)** | OpenRouter, orchestrateur, timing, Redis realtime |
| **Supabase** | Auth, users, conversations archivées, produits, analytics |
| **Upstash Redis** | Typing, sessions actives, anti-doublon, délais humains |

## Démarrage local

```bash
cd optima-ai-backend
cp .env.example .env
npm install
npm run dev
```

Health : `GET http://localhost:3100/health`

## Endpoints (Phase 1)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/v1/llm/chat` | Proxy OpenRouter chat (migration progressive depuis Vercel) |
| POST | `/v1/llm/embed` | Embeddings OpenRouter |
| POST | `/v1/chat/reply` | Orchestration (lock Redis + typing + OpenRouter) |

Auth : `Authorization: Bearer <OPTIMA_AI_BACKEND_SECRET>`

## Déploiement Railway

1. Créer un projet Railway depuis ce dossier
2. Variables : voir `.env.example`
3. Healthcheck : `/health`

## Migration progressive

1. **Phase 1 (actuelle)** : `OPTIMA_AI_BACKEND_URL` sur Vercel → les appels `openRouterChat` / `openRouterEmbed` passent par Railway
2. **Phase 2** : déplacer `generateAIReply` vers `/v1/chat/reply`
3. **Phase 3** : timing queue workers + retirer la logique lourde des API routes Vercel

Voir `docs/ARCHITECTURE-MIGRATION-V1.md` dans le repo frontend.
