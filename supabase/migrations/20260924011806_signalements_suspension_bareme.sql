-- Lot 4 (amorce) : traitement des signalements, suspension/levee manuelle
-- par un administrateur (RG-46 a RG-49), et gestion du bareme des
-- supplements. Tout ce qui suit ne depend pas de l'agregateur SMS ni de
-- l'agregateur mobile money.

-- ============================================================================
-- Lecture administrative
-- ============================================================================

create policy signalements_select_admin on signalements
  for select using (
    exists (select 1 from administrateurs where id = auth.uid())
  );

-- Necessaire au tableau de bord (courses du jour, taux d'acceptation,
-- courses sans preneur, echecs) : aucune policy n'autorisait jusqu'ici un
-- administrateur a lire l'ensemble des courses (seuls l'expediteur et le
-- livreur concernes le pouvaient).
create policy courses_select_admin on courses
  for select using (
    exists (select 1 from administrateurs where id = auth.uid())
  );

-- Necessaire pour afficher le nom/telephone des parties (expediteur,
-- livreur) d'un signalement : un administrateur n'est ni l'un ni l'autre,
-- donc utilisateurs_select_expediteur_assigne/livreur_assigne ne s'appliquent pas.
create policy utilisateurs_select_admin on utilisateurs
  for select using (
    exists (select 1 from administrateurs where id = auth.uid())
  );

-- ============================================================================
-- Traitement d'un signalement -- section 9, module Signalements
-- ============================================================================

create or replace function traiter_signalement(
  p_signalement_id uuid,
  p_etat text,
  p_decision text default null
)
returns signalements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_signalement signalements;
begin
  if not exists (select 1 from administrateurs where id = auth.uid()) then
    raise exception 'Acces reserve aux administrateurs' using errcode = '42501';
  end if;

  if p_etat not in ('en_cours', 'clos') then
    raise exception 'Etat invalide' using errcode = 'P0001';
  end if;

  if p_etat = 'clos' and length(trim(coalesce(p_decision, ''))) = 0 then
    raise exception 'Une decision est obligatoire pour cloturer un signalement';
  end if;

  update signalements
  set etat = p_etat,
      decision = coalesce(p_decision, decision),
      traite_le = case when p_etat = 'clos' then now() else traite_le end
  where id = p_signalement_id
  returning * into v_signalement;

  if not found then
    raise exception 'Signalement introuvable' using errcode = 'P0001';
  end if;

  insert into journal_admin (auteur_id, action, cible, motif)
  values (auth.uid(), 'traitement_signalement_' || p_etat, p_signalement_id::text, p_decision);

  return v_signalement;
end;
$$;

revoke execute on function traiter_signalement(uuid, text, text) from public;
grant execute on function traiter_signalement(uuid, text, text) to authenticated;

-- ============================================================================
-- Suspension et levee de suspension manuelles -- RG-46 a RG-49
-- (le motif "marchandise non reversee" suspend deja automatiquement,
-- voir confirmer_reversement_marchandise ; ces deux fonctions couvrent le
-- cas general, decide par un administrateur apres instruction).
-- ============================================================================

create or replace function suspendre_livreur(p_livreur_id uuid, p_motif text)
returns livreurs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_livreur livreurs;
begin
  if not exists (select 1 from administrateurs where id = auth.uid()) then
    raise exception 'Acces reserve aux administrateurs' using errcode = '42501';
  end if;

  if length(trim(coalesce(p_motif, ''))) = 0 then
    raise exception 'Le motif de suspension est obligatoire';
  end if;

  update livreurs
  set statut = 'suspendu', motif_statut = p_motif
  where utilisateur_id = p_livreur_id and statut = 'valide'
  returning * into v_livreur;

  if not found then
    raise exception 'Livreur introuvable ou non valide' using errcode = 'P0001';
  end if;

  insert into journal_admin (auteur_id, action, cible, motif)
  values (auth.uid(), 'suspension_livreur', p_livreur_id::text, p_motif);

  return v_livreur;
end;
$$;

create or replace function lever_suspension_livreur(p_livreur_id uuid, p_motif text)
returns livreurs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_livreur livreurs;
begin
  if not exists (select 1 from administrateurs where id = auth.uid()) then
    raise exception 'Acces reserve aux administrateurs' using errcode = '42501';
  end if;

  if length(trim(coalesce(p_motif, ''))) = 0 then
    raise exception 'Le motif de levee est obligatoire';
  end if;

  update livreurs
  set statut = 'valide', motif_statut = null
  where utilisateur_id = p_livreur_id and statut = 'suspendu'
  returning * into v_livreur;

  if not found then
    raise exception 'Livreur introuvable ou non suspendu' using errcode = 'P0001';
  end if;

  insert into journal_admin (auteur_id, action, cible, motif)
  values (auth.uid(), 'levee_suspension_livreur', p_livreur_id::text, p_motif);

  return v_livreur;
end;
$$;

revoke execute on function suspendre_livreur(uuid, text) from public;
revoke execute on function lever_suspension_livreur(uuid, text) from public;
grant execute on function suspendre_livreur(uuid, text) to authenticated;
grant execute on function lever_suspension_livreur(uuid, text) to authenticated;

-- ============================================================================
-- Bareme des supplements -- section 9, module Bareme des supplements
-- ============================================================================

create or replace function creer_motif_supplement(p_motif text, p_montant integer)
returns bareme_supplements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_motif bareme_supplements;
begin
  if not exists (select 1 from administrateurs where id = auth.uid()) then
    raise exception 'Acces reserve aux administrateurs' using errcode = '42501';
  end if;

  if length(trim(coalesce(p_motif, ''))) = 0 then
    raise exception 'Le motif est obligatoire';
  end if;
  if p_montant <= 0 then
    raise exception 'Le montant doit etre positif';
  end if;

  insert into bareme_supplements (motif, montant) values (trim(p_motif), p_montant)
  returning * into v_motif;

  insert into journal_admin (auteur_id, action, cible, motif)
  values (auth.uid(), 'creation_motif_supplement', v_motif.id::text, p_motif || ' (' || p_montant || ' FCFA)');

  return v_motif;
end;
$$;

create or replace function definir_motif_supplement(
  p_id integer,
  p_montant integer,
  p_actif boolean
)
returns bareme_supplements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_motif bareme_supplements;
begin
  if not exists (select 1 from administrateurs where id = auth.uid()) then
    raise exception 'Acces reserve aux administrateurs' using errcode = '42501';
  end if;

  if p_montant <= 0 then
    raise exception 'Le montant doit etre positif';
  end if;

  update bareme_supplements
  set montant = p_montant, actif = p_actif
  where id = p_id
  returning * into v_motif;

  if not found then
    raise exception 'Motif introuvable' using errcode = 'P0001';
  end if;

  insert into journal_admin (auteur_id, action, cible, motif)
  values (auth.uid(), 'modification_motif_supplement', p_id::text, v_motif.motif || ' (' || p_montant || ' FCFA, actif=' || p_actif || ')');

  return v_motif;
end;
$$;

revoke execute on function creer_motif_supplement(text, integer) from public;
revoke execute on function definir_motif_supplement(integer, integer, boolean) from public;
grant execute on function creer_motif_supplement(text, integer) to authenticated;
grant execute on function definir_motif_supplement(integer, integer, boolean) to authenticated;
