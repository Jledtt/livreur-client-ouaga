# Back-office d'administration

Application Next.js séparée pour l'administration de la plateforme. Ce n'est pas un accessoire : sans elle, aucun livreur ne peut être validé et aucun signalement traité (voir section 9 du [cahier des charges](../../docs/cahier-des-charges-livraison-burkina.pdf)).

## Modules

- Validation des livreurs (file d'attente, pièces, décisions).
- Grille tarifaire (zones, matrice, versions).
- Courses (recherche, détail, traitement des courses en `a_verifier`).
- Signalements (file de traitement, décisions).
- Livreurs (fiche complète, suspension/levée).
- Recharges (suivi, rapprochement avec l'agrégateur).
- Barème des suppléments.
- Tableau de bord (courses du jour, taux d'acceptation, courses sans preneur, échecs, volume de prélèvement).

## Démarrage

```bash
cd apps/backoffice
cp .env.example .env.local   # renseigner les valeurs (voir ci-dessous)
npm install
npm run dev
```

## Configuration

`NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` viennent de `npx supabase status` (depuis `supabase/`, une fois `npx supabase start` lancé) ou de Settings > API sur un projet distant. `SUPABASE_SERVICE_ROLE_KEY` vient de la même page — **ne jamais** l'exposer au navigateur ni la committer.

## Créer le premier compte administrateur

Aucune inscription en libre-service (section 7.5 : accès back-office réservé). En local :

1. `npx supabase start` (depuis `supabase/`), puis ouvrir Supabase Studio (URL affichée par `supabase status`, en général `http://127.0.0.1:54323`).
2. Authentication > Add user : créer un compte email + mot de passe, cocher "Auto Confirm User".
3. SQL Editor : `insert into administrateurs (id) values ('<uuid de l''utilisateur cree>');`

Sur un projet distant, la meme procedure s'applique depuis le dashboard Supabase du projet.

## Statut

Lot 0 terminé côté back-office :

- **Authentification admin** (email/mot de passe) — `/connexion`, garde d'accès dans `src/app/admin/layout.tsx` (vérifie la table `administrateurs`).
- **Validation des livreurs** (`src/app/admin/livreurs/`) — liste des inscriptions en attente, aperçu des pièces (URL signées, 5 minutes), actions Valider/Rejeter.
- **Zones** (`src/app/admin/zones/`) — création et activation/désactivation des quartiers.
- **Grille tarifaire** (`src/app/admin/grille/`) — création d'une grille en brouillon (éventuellement copiée depuis une grille existante), édition zone de départ par zone de départ avec symétrie automatique (case miroir pré-remplie, sauf case "asymétrique" cochée), export CSV pour relecture à froid, activation explicite (archive automatiquement l'ancienne grille active — RG-05).

Infrastructure du lot 2 amorcée :

- **Recharges** (`src/app/admin/recharges/`) — liste des transactions mobile money avec leur état, rapprochement manuel (Confirmer/Rejeter avec motif obligatoire) tant que l'agrégateur n'est pas branché. ⚠️ Voir [supabase/README.md](../../supabase/README.md#️-point-important-non-résolu--agrégateur-mobile-money) — c'est le point bloquant du lot 2, contractuel, pas technique.

Prochains modules : courses (`a_verifier`), signalements, barème des suppléments, tableau de bord (voir [docs/roadmap.md](../../docs/roadmap.md)).
