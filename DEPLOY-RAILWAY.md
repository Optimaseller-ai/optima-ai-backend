# Déploiement Railway — optima-ai-backend

## Symptômes connus

| Symptôme | Cause | Correctif |
|----------|--------|-----------|
| **Healthcheck failure** | `start` utilisait `tsx` (devDependency) → crash en prod | `start` = `node dist/index.js` (voir `package.json`) |
| **400 `invalid_body` + `fieldErrors.messages`** | Ancienne version Railway (Phase 1) exigeait `messages[]` | Redéployer le backend **après** healthcheck OK |
| **502 orchestration / reply.ts introuvable** | Repo incomplet sur Railway | Voir « Root Directory » ci-dessous |

## Configuration Railway (recommandée)

1. **Repository** : repo Git **complet** `optima` (pas seulement le sous-dossier vide).
2. **Root Directory** : `optima-ai-backend`
3. **Build Command** : `npm ci && npm run build`
4. **Start Command** : `node dist/index.js`  
   (ou laisser `railway.toml` — ne pas mettre `npm run dev` / tsx)
5. **Healthcheck path** : `/health` (défini dans `railway.toml`)
6. **Variables d’environnement** :
   - `OPTIMA_AI_BACKEND_SECRET` (≥ 16 caractères, identique à Vercel)
   - `OPENROUTER_API_KEY`
   - `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (optionnel)
   - `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (optionnel)
   - `OPTIMA_MONOREPO_ROOT=..` si le cerveau `reply.ts` n’est pas détecté automatiquement

## Vérification après deploy

```bash
curl https://VOTRE-SERVICE.up.railway.app/health
# → {"ok":true,"service":"optima-ai-backend",...}
```

Logs Railway attendus sur un chat :

- `[OPTIMA_RAILWAY_ORCHESTRATOR] raw_body_json`
- `[OPTIMA_REPLY_PIPELINE] normalized_body_json`
- **pas** `fieldErrors.messages`

## Vercel

- `OPTIMA_AI_BACKEND_URL` = URL Railway (sans slash final)
- `OPTIMA_AI_BACKEND_SECRET` = même secret que Railway
- Ne pas définir `OPTIMA_RAILWAY_FULL_ORCHESTRATOR=0` sauf rollback volontaire
