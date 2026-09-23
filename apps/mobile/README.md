# Application mobile

Application Expo (React Native) — base de code unique pour les deux rôles (livreur, expéditeur) et les deux plateformes cibles (Android en premier, iOS ensuite — voir [lot 5](../../docs/roadmap.md#lot-5--publication-ios)).

## Contraintes de conception

- Fluide sur Android d'entrée de gamme (2 Go de RAM, réseau dégradé) : c'est la référence de performance.
- Soignée sur un appareil récent haut de gamme : c'est la référence de qualité visuelle.
- Icônes et illustrations en vectoriel uniquement, mise en page adaptative de 320 à 430 points de large.
- Taille visée sous 25 Mo.

Détails complets en section 1.4 et 8 du [cahier des charges](../../docs/cahier-des-charges-livraison-burkina.pdf).

## Démarrage

```bash
cd apps/mobile
npm install
npx expo start
```

Voir `AGENTS.md` dans ce dossier pour les conventions Expo/React Native à jour (Expo Router, EAS, etc.).

## Configuration

Copier `.env.example` en `.env.local` et renseigner l'URL et la clé anonyme du projet Supabase (voir [supabase/README.md](../../supabase/README.md)).

## Statut

- **Authentification** (`app/connexion/`) — téléphone/OTP : demande de code via la fonction Edge `demander-code-connexion` (limite de trois demandes par heure, 5.1), vérification avec `supabase.auth.verifyOtp`, session persistante via `lib/session-provider.tsx`.
- **Inscription livreur** (`app/inscription-livreur.tsx`) — nom complet, plaque, photos recto/verso de la pièce et selfie (via `expo-image-picker`), téléversées dans le bucket privé `pieces-identite` puis soumises à la fonction serveur `soumettre_inscription_livreur`. L'écran d'accueil (`app/accueil.tsx`) affiche le statut (en attente / validé / rejeté avec motif).
- **Publication d'une course** (`app/publier-course.tsx`) — sélection des zones, tarif affiché en direct (lecture de la grille active), nature/description du colis, numéro du destinataire, montant de marchandise optionnel.
- **Suivi expéditeur** (`app/mes-envois.tsx`) — liste des envois avec statut, infos du livreur une fois attribué (nom, note, nombre de livraisons), code de retrait, annulation avant acceptation.
- **Courses disponibles** (`app/courses-disponibles.tsx`) — réservé aux livreurs validés n'ayant pas de course en cours ; liste rafraîchie en temps réel (Supabase Realtime sur `courses`) et manuellement (pull-to-refresh), acceptation.
- **Course en cours** (`app/course-en-cours.tsx`) — coordonnées de l'expéditeur, montant à encaisser, déclaration de supplément (barème), saisie du code de retrait pour clôturer, déclaration d'échec.
- **Portefeuille** (`app/portefeuille.tsx`) — solde disponible, dette éventuelle, montants en attente (recrédits différés de 72h), historique des mouvements.
- **Recharge** (`app/recharger.tsx`) — montant et opérateur (Orange Money / Moov Money), envoie la demande via la fonction Edge `initier-recharge-mobile-money`. ⚠️ Le paiement réel ne peut pas encore aboutir : voir [supabase/README.md](../../supabase/README.md#️-point-important-non-résolu--agrégateur-mobile-money). En attendant, la recharge reste "en attente" jusqu'à rapprochement manuel côté back-office.

Navigation par [Expo Router](https://docs.expo.dev/router/introduction/).

Écrans de la boucle de base et infrastructure du portefeuille tous en place. Les notifications push (Expo Notifications + Firebase Cloud Messaging) ne sont pas encore câblées — elles nécessitent un projet Firebase, donc des identifiants que je n'ai pas ; le temps réel Supabase assure le rafraîchissement en attendant (7.2 : "le temps réel est un confort, jamais une dépendance").

**Limite connue du monorepo :** `apps/mobile` épingle `react@19.2.3` (exigé par le SDK Expo) alors que `apps/backoffice` (Next.js) utilise une version plus récente, hoistée à la racine. npm conserve donc une copie locale de React dans `apps/mobile/node_modules`, ce que signale `npx expo-doctor`. C'est sans effet fonctionnel (Metro résout toujours la copie locale en priorité) ; à isoler proprement du reste du workspace npm si cela devient gênant.
