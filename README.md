# Livreur-Client Ouaga

Application de mise en relation entre livreurs indépendants et expéditeurs à Ouagadougou, Burkina Faso.

## Objet

L'application met en relation des livreurs indépendants avec des personnes ayant un colis à faire livrer dans Ouagadougou. Elle ne gère pas la logistique : elle publie des demandes de course, les propose aux livreurs disponibles, et encadre le déroulement de la livraison jusqu'à sa clôture.

La plateforme se rémunère en vendant aux livreurs un crédit prépayé, sur lequel elle prélève 10 % du tarif de chaque course acceptée (plafonné à 500 FCFA), auquel s'ajoute un frais de notification de 15 FCFA couvrant le SMS envoyé au destinataire. Elle ne manipule jamais l'argent des courses.

Le cahier des charges complet est disponible dans [`docs/cahier-des-charges-livraison-burkina.pdf`](docs/cahier-des-charges-livraison-burkina.pdf). Une synthèse des règles de gestion référencées dans le code se trouve dans [`docs/regles-de-gestion.md`](docs/regles-de-gestion.md), et le découpage en lots dans [`docs/roadmap.md`](docs/roadmap.md).

## Principes directeurs

1. **Aucun flux financier de course ne transite par la plateforme.** Le seul argent que le système manipule est le crédit prépayé des livreurs.
2. **Le tarif est calculé par le système, jamais saisi.** Il découle de la grille zone à zone.
3. **Le destinataire n'installe rien.** Il est informé par SMS et n'a pas de compte.
4. **L'application doit fonctionner sur un Android d'entrée de gamme en réseau dégradé**, tout en restant soignée sur un appareil récent.

## Périmètre de la version 1

Inclus : inscription livreur avec vérification manuelle, inscription expéditeur par téléphone, publication/acceptation de courses, grille tarifaire zone à zone, portefeuille de crédit et recharge mobile money, prélèvement automatique, SMS au destinataire avec code de retrait, paiement à la livraison, notation, suppléments, signalements/suspension, back-office d'administration.

Exclu de la v1 : suivi GPS temps réel, paiement en ligne du transport, chat intégré, livraisons hors Ouagadougou, programmation à l'avance, comptes multi-utilisateurs, parrainage, publication iOS simultanée (décalée), traduction en langues locales.

## Architecture technique

| Composant | Choix |
|---|---|
| Application mobile | React Native via Expo (base de code unique, rôles livreur + expéditeur) |
| Back-office | Next.js, application web séparée |
| Base de données | PostgreSQL managé (Supabase) |
| Authentification | Téléphone et code à usage unique (pas de mot de passe) |
| Logique serveur critique | Fonctions PostgreSQL et fonctions serveur (Edge Functions) |
| Temps réel | Abonnement aux changements de la table `courses` |
| Notifications push | Expo Notifications au-dessus de Firebase Cloud Messaging |
| SMS | Agrégateur local ou international couvrant le Burkina Faso |
| Paiement mobile money | Agrégateur couvrant Orange Money et Moov Money |
| Stockage des pièces | Bucket privé avec accès par URL signée |

Détails et justifications dans la section 7 du cahier des charges.

## Structure du dépôt

```
.
├── apps/
│   ├── mobile/          # Application Expo (React Native, TypeScript) — livreurs et expéditeurs
│   └── backoffice/      # Application Next.js (App Router, TypeScript, Tailwind) — administration
├── supabase/
│   ├── config.toml      # Configuration du projet Supabase local
│   └── migrations/      # Migrations SQL (schéma, contraintes, policies RLS)
└── docs/
    ├── cahier-des-charges-livraison-burkina.pdf
    ├── regles-de-gestion.md
    └── roadmap.md
```

## Démarrage rapide

```bash
# Mobile (Expo)
cd apps/mobile && npm install && npx expo start

# Back-office (Next.js)
cd apps/backoffice && npm install && npm run dev

# Base de données locale (nécessite Docker)
cd supabase && npx supabase start
```

## Découpage du développement

Le développement suit une logique de lots : faire fonctionner la boucle métier complète avant d'y introduire l'argent, puis durcir. Voir [`docs/roadmap.md`](docs/roadmap.md) pour le détail des lots 0 à 5 et les points ouverts à trancher.

## Statut

**Lot 0 terminé, lot 1 (boucle de course sans argent) fonctionnel de bout en bout** :

- **Base de données** (`supabase/migrations/`) — schéma complet, politiques RLS, fonctions serveur transactionnelles du cycle de vie d'une course (publication, acceptation atomique, suppléments, livraison, échec/annulation avec recrédit différé, expiration à 24h, recharge), inscription livreur, validation admin, gestion des zones et de la grille tarifaire, temps réel activé sur `courses`. Voir [supabase/README.md](supabase/README.md).
- **Mobile** (`apps/mobile/`) — authentification téléphone/OTP, inscription livreur, **publication d'une course** avec tarif en direct, **suivi des envois** (expéditeur), **liste des courses disponibles** (temps réel + rafraîchissement manuel) et **suivi jusqu'à la clôture** par code de retrait (livreur). Voir [apps/mobile/README.md](apps/mobile/README.md).
- **Back-office** (`apps/backoffice/`) — authentification admin, validation des livreurs, gestion des zones, édition de la grille tarifaire. Voir [apps/backoffice/README.md](apps/backoffice/README.md).

Le prélèvement est déjà calculé et enregistré à chaque acceptation (fonctions du lot 0), mais non exigible tant que le portefeuille n'existe pas : c'est le principe même du découpage en lots (tester la boucle complète avant d'y introduire l'argent). **Lot 2** : portefeuille, prélèvement effectif, recharge mobile money, découvert — voir [docs/roadmap.md](docs/roadmap.md).

Non câblé pour l'instant : les **notifications push** (nécessitent un projet Firebase externe) — le temps réel Supabase sert de mécanisme de rafraîchissement en attendant.

Voir la section 11 du cahier des charges pour les points ouverts qui doivent être tranchés avant certains lots (liste des zones, montants de la grille tarifaire, choix des agrégateurs, etc.) — notamment l'**agrégateur SMS**, dont dépend l'envoi réel des codes de connexion et des notifications aux destinataires.
