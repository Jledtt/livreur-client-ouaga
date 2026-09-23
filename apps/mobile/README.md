# Application mobile

Application Expo (React Native) — base de code unique pour les deux rôles (livreur, expéditeur) et les deux plateformes cibles (Android en premier, iOS ensuite — voir [lot 5](../../docs/roadmap.md#lot-5--publication-ios)).

## Contraintes de conception

- Fluide sur Android d'entrée de gamme (2 Go de RAM, réseau dégradé) : c'est la référence de performance.
- Soignée sur un appareil récent haut de gamme : c'est la référence de qualité visuelle.
- Icônes et illustrations en vectoriel uniquement, mise en page adaptative de 320 à 430 points de large.
- Taille visée sous 25 Mo.

Détails complets en section 1.4 et 8 du [cahier des charges](../../docs/cahier-des-charges-livraison-burkina.pdf).

## À initialiser (Lot 0)

```bash
npx create-expo-app@latest . 
```

Ce dossier est un placeholder en attendant l'amorçage du projet Expo (lot 0 de la [roadmap](../../docs/roadmap.md)).
