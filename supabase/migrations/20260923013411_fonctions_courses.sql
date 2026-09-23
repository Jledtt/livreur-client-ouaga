-- Fonctions serveur transactionnelles pour le cycle de vie d'une course.
-- Toute la logique sensible (calcul du tarif, calcul du prelevement,
-- acceptation, generation/verification du code de retrait) reste cote
-- serveur -- voir section 7.2 du cahier des charges. Le client mobile
-- n'appelle jamais courses en INSERT/UPDATE direct : il passe par ces
-- fonctions RPC.

-- Nombre d'essais de saisie du code de retrait, pour la limite de 5.5.
alter table courses add column nb_essais_code integer not null default 0;

comment on column courses.nb_essais_code is
  'Nombre de saisies incorrectes du code de retrait. Au-dela du seuil, la course bascule en a_verifier (5.5).';

-- Plus de creation directe de course par le client : le tarif et le
-- prelevement doivent etre calcules par publier_course() (RG-01, RG-03).
drop policy if exists courses_insert_expediteur on courses;

-- ============================================================================
-- Fonctions de calcul (RG-06)
-- ============================================================================

create or replace function calculer_prelevement(p_tarif integer)
returns integer
language sql
immutable
as $$
  select least(500, ceil(p_tarif * 0.10)::integer);
$$;

comment on function calculer_prelevement is
  '10 % du tarif de transport, arrondi au franc superieur, plafonne a 500 FCFA (RG-06).';

create or replace function generer_code_retrait()
returns text
language sql
volatile
as $$
  select lpad(floor(random() * 10000)::text, 4, '0');
$$;

-- ============================================================================
-- publier_course -- RG-01 a RG-05, RG-22
-- ============================================================================

create or replace function publier_course(
  p_zone_depart_id integer,
  p_zone_arrivee_id integer,
  p_description_colis text,
  p_nature_colis text,
  p_tel_destinataire text,
  p_montant_marchandise integer default 0
)
returns courses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expediteur_id uuid := auth.uid();
  v_grille_id integer;
  v_tarif integer;
  v_prelevement integer;
  v_course courses;
begin
  if v_expediteur_id is null then
    raise exception 'Authentification requise' using errcode = '28000';
  end if;

  if p_montant_marchandise < 0 then
    raise exception 'Le montant de la marchandise ne peut pas etre negatif';
  end if;

  select id into v_grille_id from grilles where etat = 'active';
  if v_grille_id is null then
    raise exception 'Aucune grille tarifaire active : impossible de publier une course';
  end if;

  select montant into v_tarif
  from grille_tarifs
  where grille_id = v_grille_id
    and zone_depart_id = p_zone_depart_id
    and zone_arrivee_id = p_zone_arrivee_id;

  if v_tarif is null then
    raise exception 'Aucun tarif defini pour ce trajet' using errcode = 'P0001';
  end if;

  v_prelevement := calculer_prelevement(v_tarif);

  insert into courses (
    expediteur_id, zone_depart_id, zone_arrivee_id, tarif, grille_id,
    prelevement, montant_marchandise, description_colis, nature_colis,
    tel_destinataire, statut
  ) values (
    v_expediteur_id, p_zone_depart_id, p_zone_arrivee_id, v_tarif, v_grille_id,
    v_prelevement, p_montant_marchandise, p_description_colis, p_nature_colis,
    p_tel_destinataire, 'publiee'
  )
  returning * into v_course;

  return v_course;
end;
$$;

-- ============================================================================
-- lister_courses_disponibles -- 5.4, complement de courses_select_livreur
-- ============================================================================

-- Seul chemin par lequel un livreur peut parcourir les courses 'publiee'
-- avant de les accepter. Ne renvoie que les colonnes necessaires a cet
-- ecran : ni tel_destinataire, ni expediteur_id, ni code_retrait (7.5).
create or replace function lister_courses_disponibles()
returns table (
  id uuid,
  zone_depart_id integer,
  zone_arrivee_id integer,
  tarif integer,
  nature_colis text,
  description_colis text,
  montant_marchandise integer,
  publiee_le timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.zone_depart_id, c.zone_arrivee_id, c.tarif, c.nature_colis,
         c.description_colis, c.montant_marchandise, c.publiee_le
  from courses c
  where c.statut = 'publiee'
    and exists (
      select 1 from livreurs
      where livreurs.utilisateur_id = auth.uid()
        and livreurs.statut = 'valide'
    )
  order by c.publiee_le;
$$;

revoke execute on function lister_courses_disponibles() from public;
grant execute on function lister_courses_disponibles() to authenticated;

-- ============================================================================
-- accepter_course -- RG-13 a RG-19, RG-22, RG-23, RG-26
-- ============================================================================

create or replace function accepter_course(p_course_id uuid)
returns courses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_livreur_id uuid := auth.uid();
  v_livreur_statut statut_livreur;
  v_solde integer;
  v_course courses;
  v_frais_notification constant integer := 15;
begin
  if v_livreur_id is null then
    raise exception 'Authentification requise' using errcode = '28000';
  end if;

  select statut into v_livreur_statut from livreurs where utilisateur_id = v_livreur_id;
  if v_livreur_statut is distinct from 'valide' then
    raise exception 'Compte livreur non valide ou suspendu';
  end if;

  select solde_disponible into v_solde from soldes_livreurs where livreur_id = v_livreur_id;
  v_solde := coalesce(v_solde, 0);
  if v_solde <= 0 then
    raise exception 'Solde insuffisant : rechargez votre compte avant d''accepter une course' using errcode = 'P0001';
  end if;

  begin
    update courses
    set livreur_id = v_livreur_id,
        statut = 'acceptee',
        code_retrait = generer_code_retrait(),
        acceptee_le = now()
    where id = p_course_id
      and statut = 'publiee'
    returning * into v_course;
  exception when unique_violation then
    raise exception 'Vous avez deja une course en cours' using errcode = 'P0001';
  end;

  if not found then
    raise exception 'Cette course n''est plus disponible' using errcode = 'P0001';
  end if;

  insert into mouvements_credit (livreur_id, type, montant, course_id)
  values
    (v_livreur_id, 'prelevement', -v_course.prelevement, p_course_id),
    (v_livreur_id, 'frais_notification', -v_frais_notification, p_course_id);

  update courses
  set frais_notification = frais_notification + v_frais_notification
  where id = p_course_id
  returning * into v_course;

  -- Envoi du SMS au destinataire (gabarit d'acceptation, section 4.4). L'appel
  -- reel au prestataire est encapsule ailleurs (point ouvert : agregateur SMS,
  -- section 7.6) ; on journalise ici pour tracer le cout et permettre RG-11.
  insert into journal_sms (course_id, destinataire, gabarit, contenu, cout)
  values (p_course_id, v_course.tel_destinataire, 'acceptation', '', v_frais_notification);

  return v_course;
end;
$$;

comment on function accepter_course is
  'Fonction transactionnelle unique : verification du solde, verification/ecriture atomique du statut, prelevement + frais de notification, generation du code. Un echec a n''importe quelle etape annule l''ensemble (5.4).';

-- ============================================================================
-- recuperer_colis -- transition colis_recupere
-- ============================================================================

create or replace function recuperer_colis(p_course_id uuid)
returns courses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course courses;
begin
  update courses
  set statut = 'colis_recupere'
  where id = p_course_id
    and livreur_id = auth.uid()
    and statut = 'acceptee'
  returning * into v_course;

  if not found then
    raise exception 'Course introuvable ou non eligible' using errcode = 'P0001';
  end if;

  return v_course;
end;
$$;

-- ============================================================================
-- declarer_supplement -- RG-39 a RG-41
-- ============================================================================

create or replace function declarer_supplement(p_course_id uuid, p_motif text)
returns courses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_montant integer;
  v_course courses;
  v_frais_notification constant integer := 15;
begin
  select montant into v_montant
  from bareme_supplements
  where motif = p_motif and actif = true;

  if v_montant is null then
    raise exception 'Motif de supplement inconnu ou inactif' using errcode = 'P0001';
  end if;

  select * into v_course
  from courses
  where id = p_course_id
    and livreur_id = auth.uid()
    and statut in ('acceptee', 'colis_recupere');

  if not found then
    raise exception 'Course introuvable ou non eligible' using errcode = 'P0001';
  end if;

  begin
    insert into supplements (course_id, motif, montant)
    values (p_course_id, p_motif, v_montant);
  exception when unique_violation then
    raise exception 'Ce supplement a deja ete declare pour cette course' using errcode = 'P0001';
  end;

  insert into mouvements_credit (livreur_id, type, montant, course_id)
  values (v_course.livreur_id, 'frais_notification', -v_frais_notification, p_course_id);

  update courses
  set frais_notification = frais_notification + v_frais_notification
  where id = p_course_id
  returning * into v_course;

  insert into journal_sms (course_id, destinataire, gabarit, contenu, cout)
  values (p_course_id, v_course.tel_destinataire, 'supplement', '', v_frais_notification);

  return v_course;
end;
$$;

-- ============================================================================
-- livrer_course -- RG-25, clic destinataire, limite d'essais (5.5)
-- ============================================================================

create or replace function livrer_course(p_course_id uuid, p_code_retrait text)
returns courses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course courses;
  v_seuil_essais constant integer := 5;
begin
  select * into v_course
  from courses
  where id = p_course_id
    and livreur_id = auth.uid()
    and statut = 'colis_recupere'
  for update;

  if not found then
    raise exception 'Course introuvable ou non eligible' using errcode = 'P0001';
  end if;

  if v_course.code_retrait = p_code_retrait then
    update courses
    set statut = 'livree', livree_le = now()
    where id = p_course_id
    returning * into v_course;

    update livreurs
    set nb_livraisons = nb_livraisons + 1
    where utilisateur_id = auth.uid();

    return v_course;
  end if;

  -- Code incorrect : on ne leve surtout pas d'exception ici. Une exception
  -- annulerait toute la transaction de cet appel, y compris l'incrementation
  -- de nb_essais_code et l'ecriture dans journal_admin ci-dessous -- ce qui
  -- rendait le garde-fou "5 essais" totalement inoperant (le compteur
  -- revenait a zero a chaque appel). La fonction retourne donc normalement
  -- la course mise a jour ; c'est au client de comparer son statut pour
  -- distinguer succes, echec simple et bascule en a_verifier.
  update courses
  set nb_essais_code = nb_essais_code + 1,
      statut = case when nb_essais_code + 1 >= v_seuil_essais then 'a_verifier' else statut end
  where id = p_course_id
  returning * into v_course;

  insert into journal_admin (auteur_id, action, cible, motif)
  select auth.uid(), 'code_retrait_incident', p_course_id::text,
         'Code incorrect, essai ' || v_course.nb_essais_code
  where v_course.statut = 'a_verifier';

  return v_course;
end;
$$;

-- ============================================================================
-- declarer_echec_course -- RG-29, RG-30, RG-31, RG-32
-- ============================================================================

create or replace function declarer_echec_course(p_course_id uuid, p_motif text)
returns courses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course courses;
begin
  if p_motif is null or length(trim(p_motif)) = 0 then
    raise exception 'Le motif d''echec est obligatoire';
  end if;

  update courses
  set statut = 'echouee', motif_echec = p_motif
  where id = p_course_id
    and livreur_id = auth.uid()
    and statut in ('acceptee', 'colis_recupere')
  returning * into v_course;

  if not found then
    raise exception 'Course introuvable ou non eligible' using errcode = 'P0001';
  end if;

  -- Recredit integral du prelevement, differe de 72h (RG-30, RG-32). Le frais
  -- de notification n'est pas recredite : le SMS a ete rendu (RG-31).
  insert into mouvements_credit (livreur_id, type, montant, course_id, date_effet, motif)
  values (
    v_course.livreur_id, 'recredit_prelevement', v_course.prelevement, p_course_id,
    now() + interval '72 hours', 'Echec de course : ' || p_motif
  );

  return v_course;
end;
$$;

-- ============================================================================
-- annuler_course -- RG-28, RG-29, RG-30
-- ============================================================================

create or replace function annuler_course(p_course_id uuid)
returns courses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course courses;
begin
  select * into v_course
  from courses
  where id = p_course_id and expediteur_id = auth.uid()
  for update;

  if not found then
    raise exception 'Course introuvable' using errcode = 'P0001';
  end if;

  if v_course.statut = 'publiee' then
    update courses set statut = 'annulee' where id = p_course_id returning * into v_course;
    return v_course;
  end if;

  if v_course.statut in ('acceptee', 'colis_recupere') then
    update courses set statut = 'annulee' where id = p_course_id returning * into v_course;

    -- Meme traitement que l'echec (RG-30) : recredit integral differe de 72h.
    insert into mouvements_credit (livreur_id, type, montant, course_id, date_effet, motif)
    values (
      v_course.livreur_id, 'recredit_prelevement', v_course.prelevement, p_course_id,
      now() + interval '72 hours', 'Annulation par l''expediteur'
    );

    return v_course;
  end if;

  raise exception 'Cette course ne peut plus etre annulee' using errcode = 'P0001';
end;
$$;

-- ============================================================================
-- verifier_courses_expirees -- RG-27, tache planifiee
-- ============================================================================

create or replace function verifier_courses_expirees()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre integer;
begin
  update courses
  set statut = 'a_verifier'
  where statut in ('acceptee', 'colis_recupere')
    and acceptee_le < now() - interval '24 hours';

  get diagnostics v_nombre = row_count;
  return v_nombre;
end;
$$;

comment on function verifier_courses_expirees is
  'A planifier toutes les 15 minutes (pg_cron ou scheduler externe). Fait passer en a_verifier les courses non cloturees 24h apres acceptation (RG-27).';

do $$
begin
  create extension if not exists pg_cron with schema extensions;
exception when others then
  raise notice 'pg_cron indisponible dans cet environnement : planifier verifier_courses_expirees() manuellement (voir supabase/README.md).';
end;
$$;

do $$
begin
  perform cron.schedule(
    'verifier-courses-expirees',
    '*/15 * * * *',
    $cron$select public.verifier_courses_expirees();$cron$
  );
exception when others then
  raise notice 'pg_cron indisponible : planifier verifier_courses_expirees() manuellement (voir supabase/README.md).';
end;
$$;

-- ============================================================================
-- Recharges -- RG-18, RG-20
-- ============================================================================

create or replace function initier_recharge(p_montant integer, p_operateur text)
returns recharges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recharge recharges;
  v_statut statut_livreur;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise' using errcode = '28000';
  end if;

  select statut into v_statut from livreurs where utilisateur_id = auth.uid();
  if v_statut = 'suspendu' then
    raise exception 'Un compte suspendu ne peut plus recharger' using errcode = 'P0001';
  end if;

  insert into recharges (livreur_id, montant, operateur)
  values (auth.uid(), p_montant, p_operateur)
  returning * into v_recharge;

  return v_recharge;
end;
$$;

comment on function initier_recharge is
  'Cree une recharge en attente. La confirmation (et le credit effectif) arrive uniquement via confirmer_recharge, appelee par le webhook serveur a serveur de l''agregateur (5.3).';

create or replace function confirmer_recharge(
  p_recharge_id uuid,
  p_reference_externe text,
  p_succes boolean
)
returns recharges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recharge recharges;
begin
  update recharges
  set etat = case when p_succes then 'confirmee' else 'echouee' end,
      reference_externe = p_reference_externe,
      confirmee_le = now()
  where id = p_recharge_id and etat = 'en_attente'
  returning * into v_recharge;

  if not found then
    raise exception 'Recharge introuvable ou deja traitee' using errcode = 'P0001';
  end if;

  if p_succes then
    -- L'apurement d'une eventuelle dette (RG-18) est automatique : le solde
    -- est la somme des mouvements, aucune etape separee n'est necessaire.
    insert into mouvements_credit (livreur_id, type, montant, motif)
    values (v_recharge.livreur_id, 'recharge', v_recharge.montant, 'Recharge ' || v_recharge.operateur || ' (' || coalesce(p_reference_externe, 'sans reference') || ')');
  end if;

  return v_recharge;
end;
$$;

comment on function confirmer_recharge is
  'Reservee au webhook serveur a serveur de l''agregateur mobile money (cle de service). Ne doit jamais etre accessible a un client authentifie ordinaire.';

-- ============================================================================
-- Droits d'execution
-- ============================================================================

revoke execute on function calculer_prelevement(integer) from public;
revoke execute on function generer_code_retrait() from public;
revoke execute on function publier_course(integer, integer, text, text, text, integer) from public;
revoke execute on function accepter_course(uuid) from public;
revoke execute on function recuperer_colis(uuid) from public;
revoke execute on function declarer_supplement(uuid, text) from public;
revoke execute on function livrer_course(uuid, text) from public;
revoke execute on function declarer_echec_course(uuid, text) from public;
revoke execute on function annuler_course(uuid) from public;
revoke execute on function initier_recharge(integer, text) from public;
revoke execute on function confirmer_recharge(uuid, text, boolean) from public;
revoke execute on function verifier_courses_expirees() from public;

grant execute on function publier_course(integer, integer, text, text, text, integer) to authenticated;
grant execute on function accepter_course(uuid) to authenticated;
grant execute on function recuperer_colis(uuid) to authenticated;
grant execute on function declarer_supplement(uuid, text) to authenticated;
grant execute on function livrer_course(uuid, text) to authenticated;
grant execute on function declarer_echec_course(uuid, text) to authenticated;
grant execute on function annuler_course(uuid) to authenticated;
grant execute on function initier_recharge(integer, text) to authenticated;

-- confirmer_recharge n'est jamais accordee a "authenticated" : seule la cle de
-- service (utilisee par le webhook de l'agregateur) peut l'appeler.
grant execute on function confirmer_recharge(uuid, text, boolean) to service_role;
grant execute on function verifier_courses_expirees() to service_role;
