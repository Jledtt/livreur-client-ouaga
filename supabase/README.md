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

## À initialiser (Lot 0)

```bash
npx supabase init
npx supabase migration new schema_initial
```

Les migrations SQL prendront place dans `migrations/`, les politiques RLS dans `policies/`.
