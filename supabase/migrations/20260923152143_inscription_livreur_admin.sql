-- Inscription livreur (parcours 4.5) et acces back-office (section 9).
--
-- Les administrateurs se connectent par email/mot de passe (Supabase Auth),
-- un parcours distinct de celui des livreurs/expediteurs (telephone + OTP).
-- Ils n'ont donc pas de ligne dans `utilisateurs` : la table `administrateurs`
-- les identifie separement, avec le meme id que auth.users.

create table administrateurs (
  id uuid primary key references auth.users (id) on delete cascade,
  nom_complet text,
  cree_le timestamptz not null default now()
);

comment on table administrateurs is
  'Comptes autorises a acceder au back-office. Aucune inscription en libre-service : ajoutes manuellement (voir supabase/README.md).';

alter table administrateurs enable row level security;

create policy administrateurs_select_own on administrateurs
  for select using (id = auth.uid());

-- journal_admin.auteur_id peut desormais correspondre a un administrateur
-- (auth.users) plutot qu'a un utilisateur du parcours telephone : on retire
-- la contrainte de cle etrangere vers `utilisateurs`, trop restrictive.
alter table journal_admin drop constraint if exists journal_admin_auteur_id_fkey;

-- ============================================================================
-- Stockage prive des pieces d'identite (6.3, 7.5)
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('pieces-identite', 'pieces-identite', false)
on conflict (id) do nothing;

-- Un livreur ne peut deposer/lire que ses propres fichiers, sous un prefixe
-- {auth.uid()}/... Les administrateurs y accedent via le service_role cote
-- back-office (URL signee a duree courte), jamais par une policy cliente.
create policy pieces_identite_insert_own on storage.objects
  for insert
  with check (
    bucket_id = 'pieces-identite'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy pieces_identite_select_own on storage.objects
  for select
  using (
    bucket_id = 'pieces-identite'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- soumettre_inscription_livreur -- parcours 4.5, etapes 19 a 24
-- ============================================================================

create or replace function soumettre_inscription_livreur(
  p_nom_complet text,
  p_plaque text,
  p_piece_recto_url text,
  p_piece_verso_url text,
  p_selfie_url text
)
returns livreurs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utilisateur_id uuid := auth.uid();
  v_statut_actuel statut_livreur;
  v_livreur livreurs;
begin
  if v_utilisateur_id is null then
    raise exception 'Authentification requise' using errcode = '28000';
  end if;

  if length(trim(coalesce(p_nom_complet, ''))) = 0 then
    raise exception 'Le nom complet est obligatoire';
  end if;

  if p_piece_recto_url is null or p_piece_verso_url is null or p_selfie_url is null then
    raise exception 'Les trois photos (recto, verso, selfie) sont obligatoires';
  end if;

  select statut into v_statut_actuel from livreurs where utilisateur_id = v_utilisateur_id;
  if v_statut_actuel is not null and v_statut_actuel <> 'rejete' then
    raise exception 'Une inscription est deja en cours ou validee pour ce compte' using errcode = 'P0001';
  end if;

  update utilisateurs
  set nom_complet = p_nom_complet, est_livreur = true
  where id = v_utilisateur_id;

  insert into livreurs (
    utilisateur_id, statut, motif_statut, piece_recto_url, piece_verso_url, selfie_url, plaque
  ) values (
    v_utilisateur_id, 'en_attente', null, p_piece_recto_url, p_piece_verso_url, p_selfie_url, p_plaque
  )
  on conflict (utilisateur_id) do update
    set statut = 'en_attente',
        motif_statut = null,
        piece_recto_url = excluded.piece_recto_url,
        piece_verso_url = excluded.piece_verso_url,
        selfie_url = excluded.selfie_url,
        plaque = excluded.plaque
  returning * into v_livreur;

  return v_livreur;
end;
$$;

comment on function soumettre_inscription_livreur is
  'Une nouvelle soumission est autorisee apres un rejet (re-inscription), pas apres une validation ou pendant un examen en cours.';

revoke execute on function soumettre_inscription_livreur(text, text, text, text, text) from public;
grant execute on function soumettre_inscription_livreur(text, text, text, text, text) to authenticated;

-- ============================================================================
-- Validation / rejet par un administrateur -- parcours 4.5 etape 25, module 9
-- ============================================================================

create policy livreurs_select_admin on livreurs
  for select using (
    exists (select 1 from administrateurs where id = auth.uid())
  );

create or replace function valider_livreur(p_livreur_id uuid)
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

  update livreurs
  set statut = 'valide', motif_statut = null
  where utilisateur_id = p_livreur_id and statut = 'en_attente'
  returning * into v_livreur;

  if not found then
    raise exception 'Livreur introuvable ou deja traite' using errcode = 'P0001';
  end if;

  insert into journal_admin (auteur_id, action, cible, motif)
  values (auth.uid(), 'validation_livreur', p_livreur_id::text, null);

  return v_livreur;
end;
$$;

create or replace function rejeter_livreur(p_livreur_id uuid, p_motif text)
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
    raise exception 'Le motif de rejet est obligatoire';
  end if;

  update livreurs
  set statut = 'rejete', motif_statut = p_motif
  where utilisateur_id = p_livreur_id and statut = 'en_attente'
  returning * into v_livreur;

  if not found then
    raise exception 'Livreur introuvable ou deja traite' using errcode = 'P0001';
  end if;

  insert into journal_admin (auteur_id, action, cible, motif)
  values (auth.uid(), 'rejet_livreur', p_livreur_id::text, p_motif);

  return v_livreur;
end;
$$;

revoke execute on function valider_livreur(uuid) from public;
revoke execute on function rejeter_livreur(uuid, text) from public;
grant execute on function valider_livreur(uuid) to authenticated;
grant execute on function rejeter_livreur(uuid, text) to authenticated;
