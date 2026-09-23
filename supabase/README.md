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

Reste à écrire : grille tarifaire (admin), notation, signalements (traitement), tableau de bord.

## Fonctions Edge

`functions/demander-code-connexion/` est le point d'entrée unique que le mobile appelle pour demander un code de connexion (jamais `supabase.auth.signInWithOtp()` directement) : il applique la limite de trois demandes par heure et par numéro avant de déclencher l'envoi réel. L'envoi effectif dépend d'un fournisseur SMS à configurer dans `config.toml` ([auth.sms]) — l'agrégateur couvrant le Burkina Faso reste un point ouvert (section 7.6/11 du cahier des charges) ; en local, seuls les numéros listés dans `[auth.sms.test_otp]` fonctionnent.

```bash
npx supabase functions serve demander-code-connexion
```
