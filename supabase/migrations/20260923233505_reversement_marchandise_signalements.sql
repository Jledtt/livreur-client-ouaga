-- Lot 3 : encaissement de marchandise et confirmation de reversement
-- (RG-35 a RG-38), suspension immediate sur contestation pour marchandise
-- non reversee (RG-47, RG-48, RG-49).
--
-- La notation (notations) et la creation generique de signalement
-- (signalements) n'ont pas besoin de fonction dediee : leurs policies RLS
-- d'insertion direct existent deja (notations_insert_expediteur,
-- signalements_insert_expediteur, section 6.2). Seule la confirmation de
-- reversement de marchandise a une consequence financiere/disciplinaire
-- (suspension) qui justifie une fonction security definer.

alter table courses add column marchandise_confirmee boolean;

comment on column courses.marchandise_confirmee is
  'Null tant que l''expediteur n''a pas repondu. RG-38 : confirme ou conteste la reception de la somme.';

create or replace function confirmer_reversement_marchandise(
  p_course_id uuid,
  p_confirme boolean,
  p_motif_contestation text default null
)
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
  where id = p_course_id
    and expediteur_id = auth.uid()
    and statut = 'livree'
    and montant_marchandise > 0
    and marchandise_confirmee is null
  for update;

  if not found then
    raise exception 'Course introuvable, sans marchandise a confirmer, ou deja traitee' using errcode = 'P0001';
  end if;

  if not p_confirme and length(trim(coalesce(p_motif_contestation, ''))) = 0 then
    raise exception 'Un motif est obligatoire pour contester le reversement';
  end if;

  update courses
  set marchandise_confirmee = p_confirme
  where id = p_course_id
  returning * into v_course;

  if not p_confirme then
    -- RG-38 : la contestation cree un signalement.
    insert into signalements (course_id, auteur, motif, description)
    values (p_course_id, 'expediteur', 'marchandise non reversee', p_motif_contestation);

    -- RG-47 : ce motif precis suspend le livreur immediatement, avant
    -- instruction. RG-48 : son solde reste acquis, non rembourse (aucune
    -- ecriture sur mouvements_credit ici).
    update livreurs
    set statut = 'suspendu',
        motif_statut = 'Suspension automatique : marchandise non reversee (course ' || p_course_id || ')'
    where utilisateur_id = v_course.livreur_id
      and statut <> 'suspendu';

    -- RG-49 : toute suspension est journalisee avec son auteur et son motif.
    -- Suspension automatique, pas une decision d'administrateur : auteur_id
    -- porte l'identite de l'expediteur dont la contestation l'a declenchee.
    insert into journal_admin (auteur_id, action, cible, motif)
    values (
      auth.uid(), 'suspension_automatique_marchandise', v_course.livreur_id::text,
      p_motif_contestation
    );
  end if;

  return v_course;
end;
$$;

comment on function confirmer_reversement_marchandise is
  'La plateforme n''est pas partie au reversement (RG-37) : cette fonction n''effectue aucun mouvement financier, elle enregistre la reponse de l''expediteur et, en cas de contestation, cree le signalement et suspend le livreur.';

revoke execute on function confirmer_reversement_marchandise(uuid, boolean, text) from public;
grant execute on function confirmer_reversement_marchandise(uuid, boolean, text) to authenticated;
