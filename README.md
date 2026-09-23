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

## ⚠️ Points bloquants à régler (non techniques)

Deux décisions ne dépendent pas de l'équipe de développement et conditionnent le lot 2. À engager dès maintenant (section 7.6/11 du cahier des charges) :

1. **Choix de l'agrégateur mobile money** (Orange Money / Moov Money) — contractuel.
2. **Entité juridique permettant l'accès au mobile money** — administratif, délai non maîtrisé.

Tant qu'ils ne sont pas tranchés, aucune recharge ne peut aboutir automatiquement : toute demande de recharge reste `en_attente` et doit être rapprochée à la main depuis le back-office (module **Recharges**). Détails et TODO précis dans [supabase/README.md](supabase/README.md#️-point-important-non-résolu--agrégateur-mobile-money).

(Un point du même ordre existe côté SMS — agrégateur non choisi non plus — mais il est moins bloquant : les codes de connexion fonctionnent déjà en local via `[auth.sms.test_otp]`.)

## Statut

**Lots 0 et 1 terminés ; lot 2 (portefeuille) prêt côté code ; lot 3 (destinataire et réputation) bien avancé** :

- **Base de données** (`supabase/migrations/`) — schéma complet, politiques RLS, fonctions serveur transactionnelles du cycle de vie d'une course, inscription livreur, validation admin, gestion des zones et de la grille tarifaire, temps réel activé sur `courses`, infrastructure du portefeuille, et désormais confirmation/contestation du reversement de marchandise avec suspension automatique (RG-47). Voir [supabase/README.md](supabase/README.md).
- **Mobile** (`apps/mobile/`) — authentification téléphone/OTP, inscription livreur, publication et suivi de course, acceptation par le livreur jusqu'à la clôture, portefeuille et demande de recharge, et désormais **notation du livreur**, **confirmation/contestation de la marchandise** et **signalements** depuis l'écran de suivi des envois. Voir [apps/mobile/README.md](apps/mobile/README.md).
- **Back-office** (`apps/backoffice/`) — authentification admin, validation des livreurs, gestion des zones et de la grille tarifaire, module Recharges (rapprochement manuel). Voir [apps/backoffice/README.md](apps/backoffice/README.md).

Reste pour clore le lot 3 : le **traitement** des signalements créés (file d'attente, décision) côté back-office — prévu au lot 4 par la roadmap.

Le prélèvement à l'acceptation d'une course est déjà exigible (un livreur au solde nul ou négatif ne peut pas accepter, hors découvert d'une seule course) — ce qui, en pratique, bloque toute nouvelle inscription tant qu'un administrateur ne crédite pas manuellement le compte (`ajuster_solde_livreur`) en l'absence d'agrégateur mobile money.

Non câblé pour l'instant : les **notifications push** (nécessitent un projet Firebase externe) — le temps réel Supabase sert de mécanisme de rafraîchissement en attendant.
