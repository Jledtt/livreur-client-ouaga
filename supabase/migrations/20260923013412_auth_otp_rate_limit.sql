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

-- peut_demander_otp et enregistrer_demande_otp existaient a l'origine comme
-- deux appels RPC separes (verifier puis enregistrer). Deux requetes
-- concurrentes pour le meme numero pouvaient toutes les deux lire un compte
-- sous la limite avant qu'aucune n'ait encore enregistre sa demande,
-- contournant la limite de trois par heure (verification-puis-action non
-- atomique entre deux transactions distinctes). demander_otp() fusionne les
-- deux en une seule fonction, un seul aller-retour, protegee par un verrou
-- consultatif scope au numero : les appels concurrents pour le meme numero
-- s'executent desormais en serie.
create or replace function demander_otp(p_telephone text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_autorise boolean;
begin
  perform pg_advisory_xact_lock(hashtext(p_telephone));

  select count(*) < 3 into v_autorise
  from demandes_otp
  where telephone = p_telephone
    and demande_le > now() - interval '1 hour';

  if v_autorise then
    insert into demandes_otp (telephone) values (p_telephone);
  end if;

  return v_autorise;
end;
$$;

revoke execute on function demander_otp(text) from public;
grant execute on function demander_otp(text) to service_role;
