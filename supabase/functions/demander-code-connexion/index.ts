// Point d'entree unique pour demander un code de connexion (OTP) par SMS.
//
// L'application mobile n'appelle jamais supabase.auth.signInWithOtp()
// directement : elle passe par cette fonction, qui applique la limite
// metier de trois demandes par numero et par heure (section 5.1 du cahier
// des charges) avant de declencher l'envoi reel via Supabase Auth. Le SDK
// cote client se contente ensuite de verifier le code recu avec
// supabase.auth.verifyOtp(), qui n'a pas besoin de passer par une fonction
// Edge.
//
// Regle de conception (section 7.3) : cette fonction est l'unique porte
// d'entree qui connait le mecanisme d'envoi ; le reste du code ne s'en
// preoccupe pas.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { normaliserTelephoneBurkina } from "../_shared/telephone.ts";
import { CORS_HEADERS, jsonResponse } from "../_shared/reponses.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ erreur: "Methode non autorisee" }, 405);
  }

  let corps: Record<string, unknown>;
  try {
    corps = await req.json();
  } catch {
    return jsonResponse({ erreur: "Corps de requete invalide" }, 400);
  }

  if (typeof corps.telephone !== "string" || corps.telephone.length === 0) {
    return jsonResponse({ erreur: "Le numero de telephone est requis" }, 400);
  }

  const telephoneNormalise = normaliserTelephoneBurkina(corps.telephone);
  if (!telephoneNormalise) {
    return jsonResponse({ erreur: "Numero de telephone burkinabe invalide" }, 400);
  }

  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Verification et enregistrement de la demande en un seul appel atomique
  // (verrou consultatif cote SQL) : deux requetes concurrentes pour le meme
  // numero ne peuvent plus toutes les deux passer la limite de trois par
  // heure (voir le commentaire de demander_otp dans la migration).
  const { data: autorise, error: erreurLimite } = await client.rpc("demander_otp", {
    p_telephone: telephoneNormalise,
  });

  if (erreurLimite) {
    console.error("Erreur demander_otp:", erreurLimite);
    return jsonResponse({ erreur: "Erreur serveur" }, 500);
  }

  if (!autorise) {
    return jsonResponse(
      { erreur: "Trop de demandes pour ce numero. Reessayez dans une heure." },
      429,
    );
  }

  // L'envoi effectif du SMS depend du fournisseur configure dans
  // supabase/config.toml ([auth.sms]) -- agregateur encore a contractualiser
  // (point ouvert, section 7.6 du cahier des charges).
  const clientAnonyme = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error: erreurEnvoi } = await clientAnonyme.auth.signInWithOtp({
    phone: telephoneNormalise,
  });

  if (erreurEnvoi) {
    console.error("Erreur signInWithOtp:", erreurEnvoi);
    return jsonResponse({ erreur: "Impossible d'envoyer le code pour le moment" }, 502);
  }

  return jsonResponse({ ok: true }, 200);
});
