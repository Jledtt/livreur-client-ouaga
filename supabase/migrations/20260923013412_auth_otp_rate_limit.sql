-- Limitation des demandes de code a usage unique par numero.
--
-- Chaque code envoye coute au fournisseur SMS, et rien n'empeche un tiers de
-- declencher des envois en boucle sur un numero qui ne lui appartient pas.
-- Trois demandes par numero et par heure constituent un plafond raisonnable
-- (section 5.1 du cahier des charges). Supabase Auth ne limite nativement
-- que par IP ou avec un delai minimal entre deux envois (auth.sms.max_frequency),
-- pas par destinataire sur une fenetre d'une heure : cette table et ces
-- fonctions sont appelees par la fonction Edge "demander-code-connexion"
-- (apps/mobile n'appelle jamais supabase.auth.signInWithOtp directement),
-- qui sert de garde-fou avant de declencher l'envoi reel.

create table demandes_otp (
  id bigserial primary key,
  telephone text not null,
  demande_le timestamptz not null default now()
);

create index demandes_otp_telephone_demande_le_idx
  on demandes_otp (telephone, demande_le);

alter table demandes_otp enable row level security;
-- Aucune policy : seule la cle de service (fonction Edge) y accede.

create or replace function peut_demander_otp(p_telephone text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select count(*) < 3
  from demandes_otp
  where telephone = p_telephone
    and demande_le > now() - interval '1 hour';
$$;

create or replace function enregistrer_demande_otp(p_telephone text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into demandes_otp (telephone) values (p_telephone);
$$;

revoke execute on function peut_demander_otp(text) from public;
revoke execute on function enregistrer_demande_otp(text) from public;

grant execute on function peut_demander_otp(text) to service_role;
grant execute on function enregistrer_demande_otp(text) to service_role;
