-- Visibilite des coordonnees une fois une course attribuee, et activation
-- du temps reel sur la table courses (7.2 : "Le temps reel est un confort,
-- jamais une dependance" -- il complete la notification push et le
-- rafraichissement manuel, il ne les remplace pas).

-- Parcours 4.3 etape 13 : "les coordonnees de l'expediteur deviennent
-- visibles" pour le livreur une fois la course attribuee.
create policy utilisateurs_select_expediteur_assigne on utilisateurs
  for select using (
    exists (
      select 1 from courses
      where courses.expediteur_id = utilisateurs.id
        and courses.livreur_id = auth.uid()
    )
  );

-- Parcours 4.2 etape 8 : "notification, avec le nom du livreur, sa note,
-- son nombre de livraisons" pour l'expediteur une fois un livreur accepte.
create policy utilisateurs_select_livreur_assigne on utilisateurs
  for select using (
    exists (
      select 1 from courses
      where courses.livreur_id = utilisateurs.id
        and courses.expediteur_id = auth.uid()
    )
  );

create policy livreurs_select_expediteur on livreurs
  for select using (
    exists (
      select 1 from courses
      where courses.livreur_id = livreurs.utilisateur_id
        and courses.expediteur_id = auth.uid()
    )
  );

-- Simplification assumee en v1 : le numero du destinataire (courses.tel_destinataire)
-- est une colonne de la course elle-meme, donc visible du livreur des qu'il
-- l'a obtenue (RLS ligne par ligne), pas seulement au passage en
-- colis_recupere comme le souhaiterait idealement 7.5. Une securite
-- colonne-par-colonne exigerait une vue dediee ; reporte faute de necessite
-- immediate.

alter publication supabase_realtime add table courses;
