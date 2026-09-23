// Webhook serveur a serveur : l'agregateur mobile money appelle cette
// fonction pour confirmer (ou signaler l'echec) d'une recharge, en dehors
// de toute session utilisateur (pas de JWT Supabase). C'est pourquoi
// `verify_jwt = false` pour cette fonction (voir supabase/config.toml) --
// l'authenticite de l'appel doit etre verifiee autrement (voir ci-dessous).
//
// ETAT : L'AGREGATEUR MOBILE MONEY N'EST PAS ENCORE CHOISI (point ouvert
// contractuel, section 7.6/11 du cahier des charges). Deux choses restent
// donc a faire une fois le choix arrete -- chercher "TODO AGREGATEUR" :
//   1. Verifier l'authenticite de la requete entrante (signature HMAC,
//      secret partage en en-tete, ou allow-list d'IP -- selon ce que
//      l'agregateur propose). SANS CETTE VERIFICATION, N'IMPORTE QUI
//      POURRAIT CREDITER UN COMPTE : ne jamais deployer cette fonction en
//      production avant de l'avoir implementee.
//   2. Adapter `interpreterChargeUtile` a la forme exacte du payload que
//      l'agregateur retenu envoie effectivement (les noms de champs
//      ci-dessous sont des hypotheses raisonnables, pas une specification).
//
// Le reste -- rapprochement avec confirmer_recharge, idempotence,
// journalisation -- est deja fonctionnel et n'aura pas a changer.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { jsonResponse } from "../_shared/reponses.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type ChargeUtileAgregateur = {
  rechargeId: string;
  referenceExterne: string;
  succes: boolean;
};

// TODO AGREGATEUR : remplacer par le format reel documente par l'agregateur
// retenu. Cette implementation suppose que notre reference interne
// (`recharge.id`, transmise a l'aller dans initier-recharge-mobile-money)
// revient telle quelle dans la reponse, sous un nom de champ a confirmer.
function interpreterChargeUtile(corps: Record<string, unknown>): ChargeUtileAgregateur | null {
  const rechargeId = corps.reference_interne ?? corps.merchant_reference;
  const referenceExterne = corps.transaction_id ?? corps.external_reference;
  const statut = corps.status ?? corps.statut;

  if (typeof rechargeId !== "string" || typeof referenceExterne !== "string") {
    return null;
  }

  return {
    rechargeId,
    referenceExterne,
    succes: statut === "success" || statut === "successful" || statut === "SUCCESSFUL",
  };
}

// TODO AGREGATEUR : verifier l'authenticite de la requete (signature,
// secret partage, etc.) avant de faire confiance a son contenu.
function requeteAuthentique(_req: Request): boolean {
  return true;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ erreur: "Methode non autorisee" }, 405);
  }

  if (!requeteAuthentique(req)) {
    return jsonResponse({ erreur: "Requete non authentifiee" }, 401);
  }

  let corps: Record<string, unknown>;
  try {
    corps = await req.json();
  } catch {
    return jsonResponse({ erreur: "Corps de requete invalide" }, 400);
  }

  const chargeUtile = interpreterChargeUtile(corps);
  if (!chargeUtile) {
    return jsonResponse({ erreur: "Format de notification non reconnu" }, 400);
  }

  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // confirmer_recharge ne modifie que les recharges encore "en_attente" :
  // un second appel pour la meme recharge (retentative de l'agregateur)
  // est donc sans effet, ce qui rend ce webhook idempotent par construction.
  const { error } = await client.rpc("confirmer_recharge", {
    p_recharge_id: chargeUtile.rechargeId,
    p_reference_externe: chargeUtile.referenceExterne,
    p_succes: chargeUtile.succes,
  });

  if (error) {
    console.error("Erreur confirmer_recharge:", error);
    return jsonResponse({ erreur: "Impossible de traiter la notification" }, 500);
  }

  return jsonResponse({ ok: true }, 200);
});
