# Bourse aux vignettes Bruxelles

PWA francophone pour organiser des échanges gratuits de vignettes entre adultes dans des lieux publics à Bruxelles. Le projet ne collecte aucune donnée concernant les enfants et n’est affilié à aucune marque d’album.

## Lancer le prototype

Prérequis : Node.js 20 ou plus récent.

```bash
pnpm install
pnpm dev
```

Sans variables d’environnement, l’application démarre en **mode démonstration**. L’inventaire, les rendez-vous et la confirmation adulte sont alors stockés uniquement dans `localStorage`. Les quatre collectionneurs visibles sont des données fictives.

## Brancher Supabase

1. Créer un projet Supabase en région Europe/Francfort.
2. Exécuter [`supabase/schema.sql`](supabase/schema.sql) dans l’éditeur SQL.
3. Activer l’authentification par lien email dans Supabase Auth.
4. Copier `.env.example` vers `.env.local` et compléter l’URL et la clé anonyme.
5. Ajouter l’URL locale et l’URL Cloudflare Pages aux Redirect URLs de Supabase.
6. Obtenir l’accord explicite de chaque lieu, puis passer sa colonne `approved` à `true`.

Le schéma contient les règles RLS, le matching réciproque, les propositions, les notifications internes de matching, les blocages, les signalements, le journal de modération et une confirmation atomique qui revérifie la disponibilité des vignettes.

## Notifications internes de matching

Quand un parent met à jour ses doubles ou ses vignettes recherchées, `queue_match_notifications` détecte les nouvelles correspondances réciproques et crée une notification `match` pour les deux parents concernés.

Ces alertes sont affichées directement dans l’application. Aucun service email payant, domaine personnalisé ou configuration Resend n’est requis. Chaque parent peut désactiver les notifications de matching dans l’écran “Sécurité et données”.

## Déployer gratuitement sur Cloudflare Pages

- Build command : `pnpm build`
- Build output : `dist`
- Variables : les variables publiques documentées dans `.env.example`
- Node version : 20 ou plus récent

Le domaine `*.pages.dev` permet de lancer le pilote sans achat de domaine. Ajoutez Turnstile aux fonctions serveur avant d’ouvrir l’inscription publiquement.

## Vérifications

```bash
pnpm test
pnpm build
```

Avant le pilote, tester aussi les politiques RLS avec deux utilisateurs réels, le blocage, la suppression, l’expiration après 48 heures, la concurrence lors d’une confirmation et les parcours clavier/mobile.

## Limites volontaires du MVP

- Un compte doit appartenir à une personne adulte.
- Aucun nom, âge, photo, école, téléphone ou adresse d’enfant.
- Aucun chat, texte public, vente, paiement ou géolocalisation.
- Rendez-vous parmi des lieux approuvés et des créneaux prédéfinis.
- La liste de collections est administrée ; aucune image officielle n’est reproduite.
- La colonne source `code_pays_numero` définit les 992 codes canoniques. L’application conserve leur écriture exacte (`MEX 2`, `BRA 14`, `FWC 19`, `CC12`, `00`) et ignore l’ordinal.

Les textes juridiques, l’analyse d’impact RGPD et la procédure de modération doivent être validés avant une ouverture publique.
