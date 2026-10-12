# Mila

Community manager IA pour studios de Pilates, yoga et barre, qui vit dans WhatsApp. Le cahier des charges est dans [`CLAUDE.md`](CLAUDE.md), la maquette dans [`docs/maquette/`](docs/maquette/).

```
apps/web        Next.js 16 (landing, web app, webhook WhatsApp) → Vercel
packages/agent  prompts, tools et schémas Zod de Mila (plan de montage, statuts, coûts)
supabase/       migrations SQL + seed de démo
```

## Démarrer en local

```bash
npm install
cp .env.example apps/web/.env.local   # puis remplir
npm run dev                           # http://localhost:3000
npm test && npm run typecheck && npm run lint
```

## Déploiement

- **Vercel** : *Root Directory* = `apps/web` (Settings → Build & Deployment). Le framework Next.js est détecté, l'install se fait depuis la racine du monorepo.
- **Supabase** : `supabase link --project-ref <ref>` puis `supabase db push` applique `supabase/migrations`. Avec l'intégration GitHub de Supabase, les migrations s'appliquent à chaque merge sur `main`.
- **WhatsApp** (Meta → WhatsApp → Configuration) : URL de rappel `https://<domaine>/api/whatsapp/webhook`, jeton de vérification = `WHATSAPP_VERIFY_TOKEN`, abonnement au champ `messages`.
