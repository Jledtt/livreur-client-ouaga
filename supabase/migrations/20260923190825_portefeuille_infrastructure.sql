-- Infrastructure du portefeuille et de la recharge mobile money (lot 2).
--
-- POINT IMPORTANT NON RESOLU : l'agregateur mobile money couvrant le Burkina
-- Faso (Orange Money, Moov Money) n'est pas encore choisi -- c'est un point
-- ouvert contractuel du cahier des charges (section 7.6/11), qui conditionne
-- ce lot et ne depend pas de l'equipe de developpement. Cette migration
-- prepare tout ce qui peut l'etre sans lui : schema, fonctions, policies,
-- et l'unique point d'entree (fonctions Edge) ou son API sera branchee.
-- Voir supabase/functions/webhook-recharge-mobile-money/index.ts.

-- La vue de solde doit s'executer avec les droits de l'appelant, pas du
-- proprietaire, pour que la RLS de mouvements_credit s'applique normalement
-- (un livreur ne doit voir que son propre solde).
alter view soldes_livreurs set (security_invoker = true);

-- ============================================================================
-- Ajustement administrateur -- RG (5.3) : "Un ajustement administrateur
-- exige un motif obligatoire et reste trace."
-- ============================================================================

create or replace function ajuster_solde_livreur(
  p_livreur_id uuid,
  p_montant integer,
  p_motif text
)
returns mouvements_credit
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mouvement mouvements_credit;
begin
  if not exists (select 1 from administrateurs where id = auth.uid()) then
    raise exception 'Acces reserve aux administrateurs' using errcode = '42501';
  end if;

  if length(trim(coalesce(p_motif, ''))) = 0 then
    raise exception 'Le motif de l''ajustement est obligatoire';
  end if;

  if not exists (select 1 from livreurs where utilisateur_id = p_livreur_id) then
    raise exception 'Livreur introuvable' using errcode = 'P0001';
  end if;

  insert into mouvements_credit (livreur_id, type, montant, motif)
  values (p_livreur_id, 'ajustement', p_montant, p_motif)
  returning * into v_mouvement;

  insert into journal_admin (auteur_id, action, cible, motif)
  values (auth.uid(), 'ajustement_solde', p_livreur_id::text, p_motif || ' (' || p_montant || ' FCFA)');

  return v_mouvement;
end;
$$;

revoke execute on function ajuster_solde_livreur(uuid, integer, text) from public;
grant execute on function ajuster_solde_livreur(uuid, integer, text) to authenticated;

-- ============================================================================
-- Rapprochement manuel d'une recharge -- module back-office "Recharges"
-- (section 9 : "Suivi des transactions, rapprochement avec l'agregateur,
-- traitement des echecs"). Distinct de confirmer_recharge (reservee au
-- webhook automatique, service_role) : ici un administrateur agit
-- explicitement, et l'action est journalisee a son nom.
-- ============================================================================

create or replace function confirmer_recharge_manuellement(
  p_recharge_id uuid,
  p_succes boolean,
  p_motif text
)
returns recharges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recharge recharges;
begin
  if not exists (select 1 from administrateurs where id = auth.uid()) then
    raise exception 'Acces reserve aux administrateurs' using errcode = '42501';
  end if;

  if length(trim(coalesce(p_motif, ''))) = 0 then
    raise exception 'Un motif est obligatoire pour un rapprochement manuel';
  end if;

  update recharges
  set etat = case when p_succes then 'confirmee' else 'echouee' end,
      confirmee_le = now()
  where id = p_recharge_id and etat = 'en_attente'
  returning * into v_recharge;

  if not found then
    raise exception 'Recharge introuvable ou deja traitee' using errcode = 'P0001';
  end if;

  if p_succes then
    insert into mouvements_credit (livreur_id, type, montant, motif)
    values (
      v_recharge.livreur_id, 'recharge', v_recharge.montant,
      'Recharge ' || v_recharge.operateur || ' -- rapprochement manuel : ' || p_motif
    );
  end if;

  insert into journal_admin (auteur_id, action, cible, motif)
  values (
    auth.uid(),
    case when p_succes then 'recharge_confirmee_manuellement' else 'recharge_rejetee_manuellement' end,
    p_recharge_id::text,
    p_motif
  );

  return v_recharge;
end;
$$;

revoke execute on function confirmer_recharge_manuellement(uuid, boolean, text) from public;
grant execute on function confirmer_recharge_manuellement(uuid, boolean, text) to authenticated;

-- ============================================================================
-- Lecture administrative
-- ============================================================================

create policy recharges_select_admin on recharges
  for select using (
    exists (select 1 from administrateurs where id = auth.uid())
  );

create policy mouvements_credit_select_admin on mouvements_credit
  for select using (
    exists (select 1 from administrateurs where id = auth.uid())
  );
