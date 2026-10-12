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
- **Supabase** (projet `fauve`, ref `tfxkhktofgtljlqlksba`, Paris) : `supabase link --project-ref tfxkhktofgtljlqlksba` puis `supabase db push` applique `supabase/migrations`. Types : `npm run db:types`.
- **Connexion par téléphone** (Supabase → Authentication) :
  - Sign In / Providers → **Phone** activé (aucun fournisseur SMS nécessaire) ;
  - Hooks → **Send SMS** → HTTPS, URL `https://<domaine>/api/auth/send-sms`, générer le secret et le copier dans `SEND_SMS_HOOK_SECRET` sur Vercel ;
  - URL Configuration → Site URL = le domaine de production.
  - WhatsApp Manager : modèle `login_code` (catégorie *Authentification*, bouton « Copier le code »).
- **WhatsApp** (Meta → WhatsApp → Configuration) : URL de rappel `https://<domaine>/api/whatsapp/webhook`, jeton de vérification = `WHATSAPP_VERIFY_TOKEN`, abonnement au champ `messages`.
