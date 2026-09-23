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

La migration [`20260923012927_schema_initial.sql`](migrations/20260923012927_schema_initial.sql) couvre les tables de la section 6.2 du cahier des charges (`utilisateurs`, `livreurs`, `courses`, `mouvements_credit`, `zones`, `grilles`, `grille_tarifs`, `recharges`, `supplements`, `bareme_supplements`, `notations`, `signalements`, `journal_sms`, `journal_admin`), les contraintes qui en découlent (RG-24, RG-43, etc.) et les politiques RLS de lecture de base.

Reste à écrire, en fonctions serveur `security definer` (jamais côté client) :
- l'acceptation atomique d'une course (RG-22, RG-23, RG-13) ;
- le calcul du tarif et du prélèvement à la publication (RG-01, RG-06) ;
- le recrédit différé de 72 heures après échec (RG-32) ;
- l'apurement automatique du découvert à la recharge (RG-18).
