-- Schema initial -- voir section 6 du cahier des charges (docs/cahier-des-charges-livraison-burkina.pdf)
-- et la synthese des regles de gestion (docs/regles-de-gestion.md).
--
-- Convention : utilisateurs.id est le meme identifiant que auth.uid() (Supabase Auth,
-- authentification par telephone + code a usage unique). Les policies RLS s'appuient
-- dessus. Le back-office (Next.js) opere avec la cle de service et n'est donc pas
-- soumis a ces policies (RG voir section 7.5 -- aucune cle de service dans le mobile).

-- ============================================================================
-- Types enumeres
-- ============================================================================

create type statut_livreur as enum ('en_attente', 'valide', 'rejete', 'suspendu');

create type statut_course as enum (
  'publiee',
  'acceptee',
  'colis_recupere',
  'livree',
  'annulee',
  'echouee',
  'a_verifier'
);

create type type_mouvement as enum (
  'recharge',
  'prelevement',
  'frais_notification',
  'recredit_prelevement',
  'recredit_frais',
  'ajustement'
);

create type etat_grille as enum ('brouillon', 'active', 'archivee');

-- ============================================================================
-- utilisateurs
-- ============================================================================

create table utilisateurs (
  id uuid primary key default gen_random_uuid(),
  telephone text not null unique,
  nom_complet text,
  est_livreur boolean not null default false,
  cree_le timestamptz not null default now()
);

comment on table utilisateurs is 'Un meme utilisateur peut etre expediteur et livreur (voir section 2 du cahier des charges).';
comment on column utilisateurs.telephone is 'Format E.164, sert d''identifiant de connexion (RG voir 5.1).';

-- ============================================================================
-- zones (quartiers de Ouagadougou)
-- ============================================================================

create table zones (
  id serial primary key,
  nom text not null unique,
  actif boolean not null default true
);

-- ============================================================================
-- grilles tarifaires (RG-01 a RG-05)
-- ============================================================================

create table grilles (
  id serial primary key,
  date_effet timestamptz not null,
  etat etat_grille not null default 'brouillon',
  auteur_id uuid references utilisateurs (id),
  cree_le timestamptz not null default now()
);

comment on table grilles is 'Une seule version de grille est active a un instant donne (RG-05).';

create table grille_tarifs (
  grille_id integer not null references grilles (id) on delete cascade,
  zone_depart_id integer not null references zones (id),
  zone_arrivee_id integer not null references zones (id),
  montant integer not null check (montant > 0),
  primary key (grille_id, zone_depart_id, zone_arrivee_id)
);

comment on table grille_tarifs is 'Matrice zone a zone. Symetrique par defaut, surcharge asymetrique possible (voir 5.2).';

-- Une seule grille active a la fois.
create unique index grilles_une_seule_active
  on grilles ((etat = 'active'))
  where etat = 'active';

-- ============================================================================
-- livreurs (extension de utilisateurs)
-- ============================================================================

create table livreurs (
  utilisateur_id uuid primary key references utilisateurs (id) on delete cascade,
  statut statut_livreur not null default 'en_attente',
  motif_statut text,
  piece_recto_url text,
  piece_verso_url text,
  selfie_url text,
  plaque text,
  nb_livraisons integer not null default 0,
  note_moyenne numeric(2, 1),
  nb_notations integer not null default 0,
  cree_le timestamptz not null default now()
);

comment on table livreurs is 'Piece d''identite dans un stockage prive, jamais d''URL publique (voir 6.3).';
comment on column livreurs.note_moyenne is 'Calculee, nulle sous cinq notations (RG-43).';

-- ============================================================================
-- courses (RG-22 a RG-27)
-- ============================================================================

create table courses (
  id uuid primary key default gen_random_uuid(),
  expediteur_id uuid not null references utilisateurs (id),
  livreur_id uuid references livreurs (utilisateur_id),
  zone_depart_id integer not null references zones (id),
  zone_arrivee_id integer not null references zones (id),
  tarif integer not null check (tarif > 0),
  grille_id integer not null references grilles (id),
  prelevement integer not null check (prelevement >= 0),
  frais_notification integer not null default 0 check (frais_notification >= 0),
  montant_marchandise integer not null default 0 check (montant_marchandise >= 0),
  description_colis text,
  nature_colis text,
  tel_destinataire text not null,
  code_retrait text,
  statut statut_course not null default 'publiee',
  motif_echec text,
  publiee_le timestamptz not null default now(),
  acceptee_le timestamptz,
  livree_le timestamptz,
  constraint courses_motif_echec_requis
    check (statut <> 'echouee' or motif_echec is not null)
);

comment on column courses.tarif is 'Fige a la publication (RG-02). Aucun champ de saisie libre du prix (1.2).';
comment on column courses.code_retrait is 'Quatre chiffres, genere a l''acceptation, jamais expose au livreur avant saisie (RG-26, 5.5).';

create index courses_livreur_id_idx on courses (livreur_id);
create index courses_expediteur_id_idx on courses (expediteur_id);
create index courses_statut_idx on courses (statut);

-- Un livreur ne peut detenir qu'une course active a la fois (RG-24).
create unique index courses_une_seule_active_par_livreur
  on courses (livreur_id)
  where statut in ('acceptee', 'colis_recupere');

-- ============================================================================
-- mouvements_credit -- journal immuable (RG-13 a RG-21)
-- ============================================================================

create table mouvements_credit (
  id bigserial primary key,
  livreur_id uuid not null references livreurs (utilisateur_id),
  type type_mouvement not null,
  montant integer not null,
  course_id uuid references courses (id),
  date_effet timestamptz not null default now(),
  motif text,
  cree_le timestamptz not null default now(),
  constraint mouvements_credit_motif_requis_si_ajustement
    check (type <> 'ajustement' or motif is not null)
);

comment on table mouvements_credit is
  'Journal immuable : le solde d''un livreur est la somme des montants dont date_effet est passee (RG-21, 6.3). Aucune mise a jour ni suppression n''est autorisee.';

create index mouvements_credit_livreur_id_idx on mouvements_credit (livreur_id);

-- Vue du solde disponible (jamais une colonne stockee, voir 6.3).
create view soldes_livreurs as
select
  livreur_id,
  coalesce(sum(montant), 0) as solde_disponible
from mouvements_credit
where date_effet <= now()
group by livreur_id;

-- ============================================================================
-- recharges (mobile money)
-- ============================================================================

create table recharges (
  id uuid primary key default gen_random_uuid(),
  livreur_id uuid not null references livreurs (utilisateur_id),
  montant integer not null check (montant >= 500),
  operateur text not null check (operateur in ('orange_money', 'moov_money')),
  reference_externe text,
  etat text not null default 'en_attente' check (etat in ('en_attente', 'confirmee', 'echouee')),
  cree_le timestamptz not null default now(),
  confirmee_le timestamptz
);

comment on column recharges.montant is 'Recharge minimale de 500 FCFA (RG-20).';
comment on table recharges is 'Le credit n''est porte au solde qu''a reception de la confirmation serveur a serveur (5.3).';

create index recharges_livreur_id_idx on recharges (livreur_id);

-- ============================================================================
-- bareme_supplements et supplements (RG-39 a RG-41)
-- ============================================================================

create table bareme_supplements (
  id serial primary key,
  motif text not null unique,
  montant integer not null check (montant > 0),
  actif boolean not null default true
);

create table supplements (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id),
  motif text not null,
  montant integer not null check (montant > 0),
  declare_le timestamptz not null default now()
);

comment on table supplements is 'Un seul supplement par motif et par course (5.6). Declaration uniquement entre acceptee et livree.';

create index supplements_course_id_idx on supplements (course_id);

-- ============================================================================
-- notations (RG-42 a RG-45)
-- ============================================================================

create table notations (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null unique references courses (id),
  note integer not null check (note between 1 and 5),
  commentaire text,
  cree_le timestamptz not null default now()
);

comment on table notations is 'Un enregistrement par course au plus, saisi par l''expediteur uniquement.';

-- ============================================================================
-- signalements (RG-46 a RG-49)
-- ============================================================================

create table signalements (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id),
  auteur text not null check (auteur in ('expediteur', 'destinataire')),
  motif text not null,
  description text,
  etat text not null default 'ouvert' check (etat in ('ouvert', 'en_cours', 'clos')),
  decision text,
  traite_le timestamptz,
  cree_le timestamptz not null default now()
);

comment on table signalements is 'Le motif "marchandise non reversee" suspend le livreur immediatement (RG-47).';

create index signalements_course_id_idx on signalements (course_id);
create index signalements_etat_idx on signalements (etat);

-- ============================================================================
-- journal_sms
-- ============================================================================

create table journal_sms (
  id bigserial primary key,
  course_id uuid references courses (id),
  destinataire text not null,
  gabarit text not null,
  contenu text not null,
  etat text not null default 'envoye' check (etat in ('envoye', 'remis', 'echoue')),
  cout integer not null default 15,
  reference_agregateur text,
  cree_le timestamptz not null default now()
);

comment on table journal_sms is 'Un SMS non remis declenche le recredit automatique du frais de notification (RG-11).';

create index journal_sms_course_id_idx on journal_sms (course_id);

-- ============================================================================
-- journal_admin
-- ============================================================================

create table journal_admin (
  id bigserial primary key,
  auteur_id uuid not null references utilisateurs (id),
  action text not null,
  cible text,
  motif text,
  horodatage timestamptz not null default now()
);

comment on table journal_admin is 'Toute action d''administration est journalisee et non modifiable depuis l''interface (7.5).';

-- ============================================================================
-- Securite au niveau des lignes (RLS) -- voir section 7.5
-- ============================================================================

alter table utilisateurs enable row level security;
alter table livreurs enable row level security;
alter table zones enable row level security;
alter table grilles enable row level security;
alter table grille_tarifs enable row level security;
alter table courses enable row level security;
alter table mouvements_credit enable row level security;
alter table recharges enable row level security;
alter table bareme_supplements enable row level security;
alter table supplements enable row level security;
alter table notations enable row level security;
alter table signalements enable row level security;
alter table journal_sms enable row level security;
alter table journal_admin enable row level security;

-- utilisateurs : chacun lit et met a jour sa propre fiche.
create policy utilisateurs_select_own on utilisateurs
  for select using (id = auth.uid());

create policy utilisateurs_update_own on utilisateurs
  for update using (id = auth.uid());

-- livreurs : un livreur lit sa propre fiche. Le profil public (nom, note, compteur)
-- est expose aux expediteurs via une fonction serveur dediee, pas par lecture directe.
create policy livreurs_select_own on livreurs
  for select using (utilisateur_id = auth.uid());

-- zones et grilles tarifaires : lecture publique (necessaire au calcul du tarif cote client),
-- ecriture reservee au back-office (cle de service, hors RLS).
create policy zones_select_all on zones
  for select using (true);

create policy grilles_select_all on grilles
  for select using (true);

create policy grille_tarifs_select_all on grille_tarifs
  for select using (true);

create policy bareme_supplements_select_all on bareme_supplements
  for select using (true);

-- courses : l'expediteur voit ses propres courses ; un livreur voit les courses
-- publiees (eligibles) et celles qu'il a obtenues.
create policy courses_select_expediteur on courses
  for select using (expediteur_id = auth.uid());

create policy courses_select_livreur on courses
  for select using (
    livreur_id = auth.uid()
    or (statut = 'publiee' and exists (
      select 1 from livreurs
      where livreurs.utilisateur_id = auth.uid()
        and livreurs.statut = 'valide'
    ))
  );

create policy courses_insert_expediteur on courses
  for insert with check (expediteur_id = auth.uid());

-- L'acceptation, le changement de statut et le debit sont executes par une fonction
-- serveur (security definer), pas par une mise a jour directe du client (7.5, 6.3).

-- mouvements_credit : un livreur ne lit que ses propres mouvements. Toute ecriture
-- passe par une fonction serveur (aucun insert/update direct autorise au client).
create policy mouvements_credit_select_own on mouvements_credit
  for select using (livreur_id = auth.uid());

-- recharges : un livreur voit ses propres transactions.
create policy recharges_select_own on recharges
  for select using (livreur_id = auth.uid());

-- supplements : visibles par l'expediteur et le livreur de la course concernee.
create policy supplements_select_parties on supplements
  for select using (
    exists (
      select 1 from courses
      where courses.id = supplements.course_id
        and (courses.expediteur_id = auth.uid() or courses.livreur_id = auth.uid())
    )
  );

-- notations : l'expediteur cree la notation de sa propre course.
create policy notations_select_parties on notations
  for select using (
    exists (
      select 1 from courses
      where courses.id = notations.course_id
        and (courses.expediteur_id = auth.uid() or courses.livreur_id = auth.uid())
    )
  );

create policy notations_insert_expediteur on notations
  for insert with check (
    exists (
      select 1 from courses
      where courses.id = notations.course_id
        and courses.expediteur_id = auth.uid()
        and courses.statut = 'livree'
    )
  );

-- signalements : l'expediteur de la course peut creer et lire son signalement.
create policy signalements_select_expediteur on signalements
  for select using (
    exists (
      select 1 from courses
      where courses.id = signalements.course_id
        and courses.expediteur_id = auth.uid()
    )
  );

create policy signalements_insert_expediteur on signalements
  for insert with check (
    exists (
      select 1 from courses
      where courses.id = signalements.course_id
        and courses.expediteur_id = auth.uid()
    )
  );

-- journal_sms et journal_admin : aucune policy client (lecture reservee au
-- back-office via la cle de service).
