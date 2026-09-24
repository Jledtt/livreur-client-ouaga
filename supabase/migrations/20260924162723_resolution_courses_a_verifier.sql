-- Lot 4 : traitement des courses remontees en a_verifier (section 9, module
-- Courses). Deux voies automatiques y menent : RG-27 (non cloturee 24h
-- apres acceptation, verifier_courses_expirees) et 5.5 (cinq codes de
-- retrait incorrects, livrer_course). Le cahier des charges ne fixe aucune
-- regle automatique de sortie -- "remonte au back-office" est la seule
-- consigne -- donc la resolution est entierement une decision
-- d'administrateur, journalisee et motivee.

create or replace function resoudre_course_a_verifier(
  p_course_id uuid,
  p_resolution text,
  p_motif text
)
returns courses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course courses;
begin
  if not exists (select 1 from administrateurs where id = auth.uid()) then
    raise exception 'Acces reserve aux administrateurs' using errcode = '42501';
  end if;

  if length(trim(coalesce(p_motif, ''))) = 0 then
    raise exception 'Un motif est obligatoire pour resoudre une course a verifier';
  end if;

  if p_resolution not in ('livree', 'echouee', 'annulee', 'colis_recupere') then
    raise exception 'Resolution invalide' using errcode = 'P0001';
  end if;

  select * into v_course from courses where id = p_course_id and statut = 'a_verifier' for update;
  if not found then
    raise exception 'Course introuvable ou non a verifier' using errcode = 'P0001';
  end if;

  if p_resolution = 'colis_recupere' then
    -- Redonne une chance de saisir le code : reinitialise le compteur
    -- d'essais et acceptee_le, sinon verifier_courses_expirees ferait
    -- rebasculer la course en a_verifier des la prochaine execution (24h
    -- calculees depuis l'acceptation d'origine, deja depassee).
    begin
      update courses
      set statut = 'colis_recupere', nb_essais_code = 0, acceptee_le = now()
      where id = p_course_id
      returning * into v_course;
    exception when unique_violation then
      raise exception 'Le livreur a deja une autre course en cours, impossible de reprendre celle-ci' using errcode = 'P0001';
    end;

  elsif p_resolution = 'livree' then
    update courses set statut = 'livree', livree_le = now() where id = p_course_id returning * into v_course;
    update livreurs set nb_livraisons = nb_livraisons + 1 where utilisateur_id = v_course.livreur_id;

  elsif p_resolution = 'echouee' then
    update courses set statut = 'echouee', motif_echec = p_motif where id = p_course_id returning * into v_course;
    -- Meme traitement que declarer_echec_course : recredit integral du
    -- prelevement, differe de 72h (RG-30, RG-32).
    insert into mouvements_credit (livreur_id, type, montant, course_id, date_effet, motif)
    values (
      v_course.livreur_id, 'recredit_prelevement', v_course.prelevement, p_course_id,
      now() + interval '72 hours', 'Resolution admin (echouee) : ' || p_motif
    );

  elsif p_resolution = 'annulee' then
    update courses set statut = 'annulee' where id = p_course_id returning * into v_course;
    insert into mouvements_credit (livreur_id, type, montant, course_id, date_effet, motif)
    values (
      v_course.livreur_id, 'recredit_prelevement', v_course.prelevement, p_course_id,
      now() + interval '72 hours', 'Resolution admin (annulee) : ' || p_motif
    );
  end if;

  insert into journal_admin (auteur_id, action, cible, motif)
  values (auth.uid(), 'resolution_course_a_verifier_' || p_resolution, p_course_id::text, p_motif);

  return v_course;
end;
$$;

comment on function resoudre_course_a_verifier is
  'colis_recupere relance la saisie du code (compteur d''essais et fenetre de 24h reinitialises) ; livree confirme manuellement la livraison ; echouee et annulee recreditent le prelevement comme les fonctions livreur equivalentes.';

revoke execute on function resoudre_course_a_verifier(uuid, text, text) from public;
grant execute on function resoudre_course_a_verifier(uuid, text, text) to authenticated;
