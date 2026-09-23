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
npm install
npm run dev
```

## Statut

Squelette Next.js généré (App Router, TypeScript, Tailwind CSS, ESLint). Reste à faire pour le [lot 0](../../docs/roadmap.md#lot-0--fondations) : connexion à Supabase, authentification admin, module de validation des livreurs.
