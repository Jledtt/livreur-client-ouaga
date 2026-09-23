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

Authentification admin (email/mot de passe) et module **Validation des livreurs** implémentés : `/connexion`, garde d'accès dans `src/app/admin/layout.tsx` (vérifie la table `administrateurs`), liste des inscriptions en attente avec aperçu des pièces (URL signées, 5 minutes) et actions Valider/Rejeter dans `src/app/admin/livreurs/`.

Reste à faire pour le [lot 0](../../docs/roadmap.md#lot-0--fondations) : grille tarifaire, gestion des zones. Puis lots suivants : courses (`a_verifier`), signalements, recharges, barème des suppléments, tableau de bord.
