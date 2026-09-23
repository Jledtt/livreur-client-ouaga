# Découpage du développement

Le découpage suit une logique simple : faire fonctionner la boucle métier complète avant d'y introduire l'argent, puis durcir. Chaque lot doit être utilisable et testable de bout en bout. Détail dans la section 10 du cahier des charges.

## Lot 0 — Fondations

- Schéma de base de données complet et politiques de sécurité au niveau des lignes.
- Authentification par téléphone et code à usage unique.
- Inscription livreur avec dépôt des pièces, back-office de validation.
- Gestion des zones et première grille tarifaire.

> À l'issue de ce lot, un livreur peut exister et être validé, et un tarif peut être calculé.

## Lot 1 — Boucle de course, sans argent

- Publication d'une course avec calcul du tarif.
- Diffusion aux livreurs, acceptation atomique, attribution.
- Suivi des états jusqu'à la clôture par code de retrait.
- Notifications push et rafraîchissement temps réel.

> Le prélèvement est calculé et enregistré mais non exigible : le solde peut être négatif. Cela permet de tester tout le cycle sans dépendre de l'agrégateur de paiement.

## Lot 2 — Portefeuille et prélèvement

- Portefeuille, journal des mouvements, calcul du solde, prélèvement et frais de notification comme mouvements distincts.
- Recharge par mobile money avec confirmation serveur à serveur, et apurement automatique de la dette.
- Découvert autorisé : condition de solde strictement positif, blocage après une course, annonce avant confirmation.
- Déclaration d'échec et recrédit différé de 72 heures.

> **Statut :** tout ce qui précède est implémenté côté code (schéma, fonctions serveur, écrans mobile portefeuille/recharge, module back-office Recharges) — voir [supabase/README.md](../supabase/README.md#️-point-important-non-résolu--agrégateur-mobile-money). **Bloqué en pratique par les deux points ouverts marqués ⚠️ ci-dessous** : sans agrégateur choisi et contractualisé, aucune recharge ne peut être confirmée automatiquement.

## Lot 3 — Destinataire et réputation

- Envoi des SMS au destinataire et journal des envois.
- Réception des réponses entrantes et création de signalements.
- Notation après course, calcul de la moyenne, compteur de livraisons.
- Encaissement de marchandise et confirmation de reversement par l'expéditeur.

> **Statut :** notation, confirmation/contestation du reversement de marchandise (avec suspension automatique du livreur sur contestation, RG-47) et création de signalement implémentés côté code et écran mobile. Le journal des SMS s'écrit déjà à chaque envoi (`journal_sms`), mais l'envoi réel et la **réception des réponses entrantes du destinataire** restent bloqués par le même point ouvert que le SMS de connexion : l'agrégateur SMS couvrant le Burkina Faso n'est pas choisi (section 7.6/11). Le **traitement** des signalements créés (file d'attente, décision, levée de suspension) reste au back-office, prévu au lot 4.

## Lot 4 — Durcissement avant pilote

- Suppléments et barème.
- File de signalements et suspension.
- Tableau de bord d'administration.
- Tests sur appareils réels d'entrée de gamme, en conditions de réseau dégradé, et sur au moins un appareil récent.
- Suppression de compte depuis l'application, exigée pour la publication iOS.
- Conditions d'utilisation intégrées au parcours d'inscription.

## Lot 5 — Publication iOS

- Configuration du projet iOS, certificats, notifications APNs.
- Reprise d'interface pour les spécificités iOS : zones sûres, encoches, gestes de navigation.
- Préparation du dossier de relecture, en particulier la justification du crédit prépayé au regard des règles d'achat intégré (voir section 7.4 du cahier des charges).
- Dépôt une fois la version Android stabilisée en production.

## Points ouverts

Ces points ne bloquent pas le démarrage du développement, mais doivent être tranchés avant les lots indiqués (détail section 11 du cahier des charges).

| Question | À trancher avant | Nature |
|---|---|---|
| Liste définitive des zones de Ouagadougou | Lot 0 | Terrain |
| Montants de la grille tarifaire initiale | Lot 1 | Terrain — enquête auprès des livreurs |
| Barème des suppléments | Lot 4 | Décision |
| Seuil d'échecs déclenchant un examen du compte | Lot 2 | Décision |
| Durée définitive du recrédit différé (72 h proposées) | Lot 2 | Décision |
| Délai avant qu'une course sans preneur soit signalée | Lot 1 | Décision |
| Réception des réponses SMS entrantes par l'agrégateur | Lot 3 | Technique — conditionne le canal de signalement du destinataire |
| Taux effectif élevé sur les petites courses (13 % à 500 FCFA) | Lot 1 | Décision — critère de calibrage de la grille |
| ⚠️ Choix de l'agrégateur mobile money | Lot 2 | Contractuel — **bloquant, à engager maintenant** |
| ⚠️ Entité juridique permettant l'accès au mobile money | Lot 2 | Administratif — **bloquant, délai non maîtrisé** |
| Rédaction des conditions d'utilisation | Lot 4 | Juridique |
| Validation de la clause de non-responsabilité | Lot 4 | Juridique — juriste burkinabè |
| Qualification du crédit prépayé au regard des règles Apple | Lot 5 | Bloquant potentiel — à vérifier avant le développement iOS |
| Ouverture du compte développeur Apple | Lot 5 | Administratif — délai non maîtrisé |
| Procédure de reversement de la marchandise | Lot 3 | Décision |
| Périodicité de révision de la grille | Après pilote | Décision |

**Deux points ont un délai qui ne dépend pas de l'équipe de développement** : la constitution de l'entité juridique et le conventionnement avec l'agrégateur mobile money. Ils conditionnent le lot 2 et doivent être engagés dès maintenant.
