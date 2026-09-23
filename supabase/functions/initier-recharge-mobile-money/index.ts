// Point d'entree unique pour initier une recharge mobile money.
//
// Regle de conception (section 7.3) : les deux integrations externes
// (SMS et mobile money) doivent etre encapsulees derriere une interface
// propre des la premiere ligne de code -- rien d'autre dans le reste du
// code ne doit connaitre le fournisseur. Cette fonction est ce point
// d'entree pour la recharge : le mobile ne parle jamais directement a
// l'agregateur.
//
// ETAT : L'AGREGATEUR MOBILE MONEY N'EST PAS ENCORE CHOISI (point ouvert
// contractuel, section 7.6/11 du cahier des charges -- "Choix de
// l'agregateur mobile money", "Entite juridique permettant l'acces au
// mobile money"). Cette fonction enregistre la demande de recharge et
// est prete a declencher l'appel a l'agregateur des que ce choix sera
// fait : chercher "TODO AGREGATEUR" ci-dessous.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse } from "../_shared/reponses.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const OPERATEURS_VALIDES = ["orange_money", "moov_money"] as const;
const MONTANT_MINIMUM = 500; // RG-20

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ erreur: "Methode non autorisee" }, 405);
  }

  const autorisation = req.headers.get("Authorization");
  if (!autorisation) {
    return jsonResponse({ erreur: "Authentification requise" }, 401);
  }

  let montant: number | undefined;
  let operateur: string | undefined;
  try {
    ({ montant, operateur } = await req.json());
  } catch {
    return jsonResponse({ erreur: "Corps de requete invalide" }, 400);
  }

  if (!montant || !Number.isInteger(montant) || montant < MONTANT_MINIMUM) {
    return jsonResponse(
      { erreur: `Le montant minimum de recharge est de ${MONTANT_MINIMUM} FCFA` },
      400,
    );
  }

  if (!operateur || !OPERATEURS_VALIDES.includes(operateur as (typeof OPERATEURS_VALIDES)[number])) {
    return jsonResponse({ erreur: "Operateur invalide" }, 400);
  }

  // Client lie a la session du livreur (JWT transmis par le mobile) : la
  // fonction RPC identifie l'auteur via auth.uid(), pas via un identifiant
  // envoye en clair par le client.
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: autorisation } },
  });

  const { data: recharge, error: erreurCreation } = await client.rpc("initier_recharge", {
    p_montant: montant,
    p_operateur: operateur,
  });

  if (erreurCreation) {
    console.error("Erreur initier_recharge:", erreurCreation);
    return jsonResponse({ erreur: "Impossible de creer la demande de recharge" }, 500);
  }

  // TODO AGREGATEUR : une fois l'agregateur choisi et contractualise,
  // declencher ici l'appel qui invite le livreur a valider la transaction
  // (le plus souvent un prompt USSD/push sur son telephone), en passant
  // recharge.id comme reference interne pour le rapprochement au webhook
  // (voir supabase/functions/webhook-recharge-mobile-money). En l'absence
  // d'agregateur, la recharge reste "en_attente" indefiniment : un
  // administrateur peut la rapprocher manuellement depuis le back-office
  // (module Recharges) une fois le paiement confirme par un autre canal.

  return jsonResponse({ recharge }, 201);
});
