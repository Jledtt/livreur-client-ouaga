# Supabase — base de données et logique serveur

PostgreSQL managé (Supabase). Schéma relationnel décrit en section 6 du [cahier des charges](../docs/cahier-des-charges-livraison-burkina.pdf).

## Points d'attention structurants

- **L'acceptation d'une course doit être une fonction serveur transactionnelle** (vérification du statut, du solde, écriture du prélèvement et du frais de notification, attribution, génération du code — un échec à n'importe quelle étape annule l'ensemble).
- **Le solde d'un livreur n'est jamais une colonne modifiable** : il se calcule à partir du journal des mouvements (`mouvements_credit`), qui est immuable.
- **Sécurité au niveau des lignes (RLS) activée sur toutes les tables** : un utilisateur ne lit que ses propres courses, un livreur que ses propres mouvements de crédit.
- **Aucune clé de service dans l'application mobile.** Toute opération privilégiée passe par une fonction serveur (Edge Function).
- Les pièces d'identité vont dans un stockage privé, jamais d'URL publique — accès par URL signée à durée courte.

## Tables principales

`utilisateurs`, `livreurs`, `courses`, `mouvements_credit`, `zones`, `grilles`, `grille_tarifs`, `recharges`, `supplements`, `bareme_supplements`, `notations`, `signalements`, `journal_sms`, `journal_admin`.

Détail des colonnes en section 6.2 du cahier des charges.

## Démarrage

```bash
cd supabase
npx supabase start          # démarre l'instance locale (nécessite Docker)
npx supabase db reset       # applique les migrations sur la base locale
```

Pour lier ce dossier à un projet Supabase distant : `npx supabase link --project-ref <ref>`, puis `npx supabase db push` pour appliquer les migrations.

## Statut

- [`20260923012927_schema_initial.sql`](migrations/20260923012927_schema_initial.sql) — tables de la section 6.2 du cahier des charges, contraintes (RG-24, RG-43, etc.) et politiques RLS de lecture de base.
- [`20260923013411_fonctions_courses.sql`](migrations/20260923013411_fonctions_courses.sql) — cycle de vie complet d'une course en fonctions `security definer` (jamais d'écriture directe côté client) : `publier_course` (calcul tarif + prélèvement, RG-01 à RG-05), `accepter_course` (transaction unique : solde, débit, code de retrait, RG-13 à RG-19/RG-22/RG-23), `recuperer_colis`, `declarer_supplement` (RG-39 à RG-41), `livrer_course` (vérification du code, limite d'essais, RG-25/5.5), `declarer_echec_course` et `annuler_course` (recrédit différé de 72h, RG-30/RG-32), `verifier_courses_expirees` (RG-27, planifiée via `pg_cron` si disponible), `initier_recharge`/`confirmer_recharge` (RG-18, cette dernière réservée au `service_role`).
- [`20260923013412_auth_otp_rate_limit.sql`](migrations/20260923013412_auth_otp_rate_limit.sql) — limite de trois demandes de code par numéro et par heure (5.1), appelée par la fonction Edge `demander-code-connexion`.
- [`20260923152143_inscription_livreur_admin.sql`](migrations/20260923152143_inscription_livreur_admin.sql) — table `administrateurs` (accès back-office, distinct du parcours téléphone/OTP), bucket de stockage privé `pieces-identite` avec policies scopées par dossier utilisateur, `soumettre_inscription_livreur` (parcours 4.5), `valider_livreur`/`rejeter_livreur` (réservées aux administrateurs, journalisées dans `journal_admin`).
- [`20260923161514_zones_grille_tarifaire.sql`](migrations/20260923161514_zones_grille_tarifaire.sql) — `creer_zone`/`definir_statut_zone`, `creer_grille_brouillon` (avec copie optionnelle d'une grille existante), `definir_tarif` (symétrique par défaut, RG-05), `activer_grille` (archive l'ancienne grille active dans la même transaction, RG-02). Réservées aux administrateurs.
- [`20260923185220_visibilite_contacts_realtime.sql`](migrations/20260923185220_visibilite_contacts_realtime.sql) — une fois une course attribuée, l'expéditeur peut lire le nom/note/compteur du livreur et le livreur peut lire les coordonnées de l'expéditeur (parcours 4.2/4.3) ; active le temps réel Supabase sur `courses`.
- [`20260923190825_portefeuille_infrastructure.sql`](migrations/20260923190825_portefeuille_infrastructure.sql) — infrastructure du lot 2 : `ajuster_solde_livreur` (RG voir 5.3, mouvement `ajustement`, utile aussi pour créditer un livreur en développement tant que l'agrégateur n'est pas branché), `confirmer_recharge_manuellement` (rapprochement admin, distinct du webhook automatique), lecture admin sur `recharges`/`mouvements_credit`.
- [`20260923233505_reversement_marchandise_signalements.sql`](migrations/20260923233505_reversement_marchandise_signalements.sql) — `confirmer_reversement_marchandise` (RG-35 à RG-38) : l'expéditeur confirme ou conteste avoir reçu la marchandise ; une contestation crée un signalement **et suspend immédiatement le livreur** (RG-47). La notation et la création générique d'un signalement n'ont pas de fonction dédiée : leurs policies RLS d'insertion directe existaient déjà (`notations_insert_expediteur`, `signalements_insert_expediteur`).
- [`20260924011806_signalements_suspension_bareme.sql`](migrations/20260924011806_signalements_suspension_bareme.sql) — `traiter_signalement` (prise en charge, clôture avec décision obligatoire), `suspendre_livreur`/`lever_suspension_livreur` (suspension manuelle après instruction, RG-46 à RG-49), `creer_motif_supplement`/`definir_motif_supplement` (barème). Lecture admin ajoutée sur `courses`, `signalements`, `utilisateurs` (nécessaire au tableau de bord et au contexte des signalements).
- [`20260924162723_resolution_courses_a_verifier.sql`](migrations/20260924162723_resolution_courses_a_verifier.sql) — `resoudre_course_a_verifier` : le cahier des charges ne fixe aucune règle de sortie automatique pour une course `a_verifier`, seulement "remonte au back-office" — quatre résolutions possibles (relancer la saisie du code, marquer livrée, échouée ou annulée), motif obligatoire, recrédit différé de 72h pour les deux derniers cas.
- [`20260924203938_suppression_compte.sql`](migrations/20260924203938_suppression_compte.sql) — `supprimer_mon_compte` (section 7.4, exigée pour la publication iOS) : anonymisation plutôt que suppression physique (l'historique des courses, mouvements de crédit, signalements et notations doit survivre au compte, RG-21), pièces d'identité retirées du stockage, bloquée si une course est en cours. Complétée côté authentification par la fonction Edge `supprimer-compte` (voir plus bas).

Reste à écrire : recherche/historique libre des courses (au-delà de la file `a_verifier`). Réception des réponses SMS entrantes du destinataire (RG-46) : bloquée par le même point ouvert que ci-dessous (agrégateur SMS).

## ⚠️ Point important non résolu : agrégateur mobile money

L'agrégateur mobile money couvrant le Burkina Faso (Orange Money, Moov Money) **n'est pas encore choisi**. C'est un point ouvert **contractuel**, pas technique (section 7.6 et 11 du cahier des charges), qui conditionne tout le lot 2 et ne dépend pas de l'équipe de développement — à engager dès maintenant, au même titre que l'entité juridique permettant l'accès au mobile money (même section).

Tout ce qui peut être préparé sans lui l'est déjà : schéma, fonctions, policies, et les deux fonctions Edge ci-dessous qui constituent l'unique point d'entrée où son API sera branchée (principe de 7.3 : encapsuler chaque intégration externe derrière une interface unique). En attendant, toute recharge reste `en_attente` indéfiniment et doit être rapprochée manuellement depuis le back-office (module **Recharges**).

## Fonctions Edge

- `functions/demander-code-connexion/` — point d'entrée unique que le mobile appelle pour demander un code de connexion (jamais `supabase.auth.signInWithOtp()` directement) : applique la limite de trois demandes par heure et par numéro avant de déclencher l'envoi réel. L'envoi effectif dépend d'un fournisseur SMS à configurer dans `config.toml` ([auth.sms]) — l'agrégateur SMS couvrant le Burkina Faso reste aussi un point ouvert (section 7.6/11) ; en local, seuls les numéros listés dans `[auth.sms.test_otp]` fonctionnent.
- `functions/initier-recharge-mobile-money/` — appelée par le livreur authentifié pour créer une demande de recharge (`initier_recharge`). L'appel effectif à l'agrégateur est marqué `TODO AGREGATEUR` dans le code : rien à faire tant que le point ci-dessus n'est pas tranché.
- `functions/webhook-recharge-mobile-money/` — reçue en théorie de l'agrégateur, hors session Supabase (`verify_jwt = false`). **Ne pas déployer en production avant d'avoir implémenté la vérification d'authenticité de la requête** (`requeteAuthentique`, actuellement un stub qui accepte tout) ni adapté `interpreterChargeUtile` au format réel de l'agrégateur retenu — les deux sont marqués `TODO AGREGATEUR`.
- `functions/supprimer-compte/` — appelle `supprimer_mon_compte` (anonymisation) avec la session de l'utilisateur, puis `auth.admin.deleteUser` avec la clé de service pour retirer l'identité Supabase Auth elle-même — la seule des deux étapes qu'un client authentifié ordinaire ne peut pas faire, d'où le passage par une fonction Edge plutôt qu'un simple appel RPC.

```bash
npx supabase functions serve
```
