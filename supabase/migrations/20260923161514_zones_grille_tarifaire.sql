-- Gestion des zones et de la grille tarifaire depuis le back-office
-- (section 5.2 et module "Grille tarifaire" de la section 9).
--
-- Meme schema d'autorisation que les fonctions d'inscription/validation
-- livreur : reservees aux administrateurs, verifie en debut de fonction.
-- Les mutations cellule par cellule (definir_tarif) ne sont pas journalisees
-- individuellement dans journal_admin (190 couples pour une grille de vingt
-- zones rendrait le journal illisible) ; seules les actions structurantes le
-- sont : creation/activation de zone, creation/activation de grille.

-- ============================================================================
-- Zones
-- ============================================================================

create or replace function creer_zone(p_nom text)
returns zones
language plpgsql
security definer
set search_path = public
as $$
declare
  v_zone zones;
begin
  if not exists (select 1 from administrateurs where id = auth.uid()) then
    raise exception 'Acces reserve aux administrateurs' using errcode = '42501';
  end if;

  if length(trim(coalesce(p_nom, ''))) = 0 then
    raise exception 'Le nom de la zone est obligatoire';
  end if;

  insert into zones (nom) values (trim(p_nom)) returning * into v_zone;

  insert into journal_admin (auteur_id, action, cible, motif)
  values (auth.uid(), 'creation_zone', v_zone.id::text, p_nom);

  return v_zone;
end;
$$;

create or replace function definir_statut_zone(p_zone_id integer, p_actif boolean)
returns zones
language plpgsql
security definer
set search_path = public
as $$
declare
  v_zone zones;
begin
  if not exists (select 1 from administrateurs where id = auth.uid()) then
    raise exception 'Acces reserve aux administrateurs' using errcode = '42501';
  end if;

  update zones set actif = p_actif where id = p_zone_id returning * into v_zone;

  if not found then
    raise exception 'Zone introuvable' using errcode = 'P0001';
  end if;

  insert into journal_admin (auteur_id, action, cible, motif)
  values (
    auth.uid(),
    case when p_actif then 'activation_zone' else 'desactivation_zone' end,
    p_zone_id::text,
    null
  );

  return v_zone;
end;
$$;

revoke execute on function creer_zone(text) from public;
revoke execute on function definir_statut_zone(integer, boolean) from public;
grant execute on function creer_zone(text) to authenticated;
grant execute on function definir_statut_zone(integer, boolean) to authenticated;

-- ============================================================================
-- Grilles tarifaires -- RG-01 a RG-05
-- ============================================================================

create or replace function creer_grille_brouillon(
  p_date_effet timestamptz,
  p_copier_depuis_grille_id integer default null
)
returns grilles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grille grilles;
begin
  if not exists (select 1 from administrateurs where id = auth.uid()) then
    raise exception 'Acces reserve aux administrateurs' using errcode = '42501';
  end if;

  insert into grilles (date_effet, etat, auteur_id)
  values (p_date_effet, 'brouillon', auth.uid())
  returning * into v_grille;

  if p_copier_depuis_grille_id is not null then
    insert into grille_tarifs (grille_id, zone_depart_id, zone_arrivee_id, montant)
    select v_grille.id, zone_depart_id, zone_arrivee_id, montant
    from grille_tarifs
    where grille_id = p_copier_depuis_grille_id;
  end if;

  insert into journal_admin (auteur_id, action, cible, motif)
  values (
    auth.uid(), 'creation_grille', v_grille.id::text,
    case when p_copier_depuis_grille_id is not null
      then 'copiee depuis la grille ' || p_copier_depuis_grille_id
      else null
    end
  );

  return v_grille;
end;
$$;

-- Symetrique par defaut (5.2) : ecrit aussi la case miroir, sauf
-- p_asymetrique = true. Seule une grille en brouillon peut etre modifiee ;
-- une grille active ou archivee est figee (RG-02).
create or replace function definir_tarif(
  p_grille_id integer,
  p_zone_depart_id integer,
  p_zone_arrivee_id integer,
  p_montant integer,
  p_asymetrique boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_etat etat_grille;
begin
  if not exists (select 1 from administrateurs where id = auth.uid()) then
    raise exception 'Acces reserve aux administrateurs' using errcode = '42501';
  end if;

  if p_montant <= 0 then
    raise exception 'Le montant doit etre positif';
  end if;

  -- Verrou sur la ligne grilles : sans lui, cette lecture et l'UPDATE
  -- d'activer_grille() sur la meme ligne pourraient s'entrelacer et laisser
  -- passer un tarif ecrit juste apres l'activation de la grille (RG-02 :
  -- une grille active est figee).
  select etat into v_etat from grilles where id = p_grille_id for update;
  if v_etat is null then
    raise exception 'Grille introuvable' using errcode = 'P0001';
  end if;
  if v_etat <> 'brouillon' then
    raise exception 'Seule une grille en brouillon peut etre modifiee' using errcode = 'P0001';
  end if;

  insert into grille_tarifs (grille_id, zone_depart_id, zone_arrivee_id, montant)
  values (p_grille_id, p_zone_depart_id, p_zone_arrivee_id, p_montant)
  on conflict (grille_id, zone_depart_id, zone_arrivee_id)
  do update set montant = excluded.montant;

  if not p_asymetrique and p_zone_depart_id <> p_zone_arrivee_id then
    insert into grille_tarifs (grille_id, zone_depart_id, zone_arrivee_id, montant)
    values (p_grille_id, p_zone_arrivee_id, p_zone_depart_id, p_montant)
    on conflict (grille_id, zone_depart_id, zone_arrivee_id)
    do update set montant = excluded.montant;
  end if;
end;
$$;

-- Passage d'une version a la suivante : action explicite, jamais automatique
-- (5.2). Toutes les verifications precedent la moindre ecriture, pour ne
-- jamais se retrouver sans grille active si l'activation echoue en cours de
-- route.
create or replace function activer_grille(p_grille_id integer)
returns grilles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_etat_cible etat_grille;
  v_nb_tarifs integer;
  v_grille grilles;
begin
  if not exists (select 1 from administrateurs where id = auth.uid()) then
    raise exception 'Acces reserve aux administrateurs' using errcode = '42501';
  end if;

  select etat into v_etat_cible from grilles where id = p_grille_id;
  if v_etat_cible is null then
    raise exception 'Grille introuvable' using errcode = 'P0001';
  end if;
  if v_etat_cible <> 'brouillon' then
    raise exception 'Seule une grille en brouillon peut etre activee' using errcode = 'P0001';
  end if;

  select count(*) into v_nb_tarifs from grille_tarifs where grille_id = p_grille_id;
  if v_nb_tarifs = 0 then
    raise exception 'La grille ne contient aucun tarif' using errcode = 'P0001';
  end if;

  update grilles set etat = 'archivee' where etat = 'active';
  update grilles set etat = 'active' where id = p_grille_id returning * into v_grille;

  insert into journal_admin (auteur_id, action, cible, motif)
  values (auth.uid(), 'activation_grille', p_grille_id::text, null);

  return v_grille;
end;
$$;

revoke execute on function creer_grille_brouillon(timestamptz, integer) from public;
revoke execute on function definir_tarif(integer, integer, integer, integer, boolean) from public;
revoke execute on function activer_grille(integer) from public;

grant execute on function creer_grille_brouillon(timestamptz, integer) to authenticated;
grant execute on function definir_tarif(integer, integer, integer, integer, boolean) to authenticated;
grant execute on function activer_grille(integer) to authenticated;
