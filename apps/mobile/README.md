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

Navigation par [Expo Router](https://docs.expo.dev/router/introduction/).

Reste à faire pour le lot 1 : écrans de publication et de suivi de course.

**Limite connue du monorepo :** `apps/mobile` épingle `react@19.2.3` (exigé par le SDK Expo) alors que `apps/backoffice` (Next.js) utilise une version plus récente, hoistée à la racine. npm conserve donc une copie locale de React dans `apps/mobile/node_modules`, ce que signale `npx expo-doctor`. C'est sans effet fonctionnel (Metro résout toujours la copie locale en priorité) ; à isoler proprement du reste du workspace npm si cela devient gênant.
