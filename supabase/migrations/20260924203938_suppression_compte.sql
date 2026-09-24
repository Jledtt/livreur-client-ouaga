-- Suppression de compte depuis l'application (section 7.4/lot 4, exigee
-- par les regles d'achat integre d'Apple des lors que la creation de compte
-- est possible dans l'app).
--
-- Une suppression "physique" (DELETE en cascade) est exclue : courses,
-- mouvements_credit (journal immuable, 6.3), signalements et notations
-- sont des enregistrements transactionnels/comptables qui doivent survivre
-- au compte qui les a produits (litiges, comptabilite, RG-21). La strategie
-- retenue est donc l'anonymisation : le compte devient inutilisable et ses
-- donnees personnelles sont effacees, mais son identifiant subsiste pour
-- que l'historique reste coherent.
--
-- Cote authentification, cette fonction ne fait que la moitie du travail :
-- elle anonymise les donnees applicatives via la session de l'utilisateur.
-- La suppression de l'identite Supabase Auth elle-meme (auth.admin.deleteUser,
-- qui exige la cle de service) est faite par la fonction Edge
-- supprimer-compte, juste apres cet appel.

alter table utilisateurs add column supprime_le timestamptz;

comment on column utilisateurs.supprime_le is
  'Renseigne des que l''utilisateur supprime son compte. Les colonnes personnelles sont alors videes ; la ligne subsiste pour l''integrite referentielle avec l''historique des courses.';

create or replace function supprimer_mon_compte()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utilisateur_id uuid := auth.uid();
  v_course_en_cours boolean;
begin
  if v_utilisateur_id is null then
    raise exception 'Authentification requise' using errcode = '28000';
  end if;

  select exists (
    select 1 from courses
    where (expediteur_id = v_utilisateur_id and statut in ('publiee', 'acceptee', 'colis_recupere'))
       or (livreur_id = v_utilisateur_id and statut in ('acceptee', 'colis_recupere'))
  ) into v_course_en_cours;

  if v_course_en_cours then
    raise exception 'Impossible de supprimer le compte : une course est en cours' using errcode = 'P0001';
  end if;

  -- Retire les pieces d'identite du stockage prive (6.3).
  delete from storage.objects
  where bucket_id = 'pieces-identite'
    and (storage.foldername(name))[1] = v_utilisateur_id::text;

  -- Un eventuel solde positif est simplement perdu : le credit est
  -- consommable et non remboursable (RG-20), suppression de compte ou pas.
  update livreurs
  set piece_recto_url = null,
      piece_verso_url = null,
      selfie_url = null,
      plaque = null,
      statut = 'rejete',
      motif_statut = 'Compte supprime par l''utilisateur'
  where utilisateur_id = v_utilisateur_id;

  update utilisateurs
  set nom_complet = null,
      -- Libere le numero (colonne unique) pour une future inscription,
      -- tout en gardant une valeur non nulle.
      telephone = 'supprime-' || v_utilisateur_id::text,
      est_livreur = false,
      supprime_le = now()
  where id = v_utilisateur_id;

  insert into journal_admin (auteur_id, action, cible, motif)
  values (v_utilisateur_id, 'suppression_compte', v_utilisateur_id::text, 'Suppression demandee par l''utilisateur');
end;
$$;

revoke execute on function supprimer_mon_compte() from public;
grant execute on function supprimer_mon_compte() to authenticated;
