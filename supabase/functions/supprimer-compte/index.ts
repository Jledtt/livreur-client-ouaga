// Suppression de compte, en deux temps :
//   1. supprimer_mon_compte() (SQL, executee avec la session de l'appelant)
//      anonymise les donnees applicatives -- voir le commentaire de cette
//      fonction pour pourquoi ce n'est pas un DELETE en cascade.
//   2. auth.admin.deleteUser() (cle de service) retire l'identite
//      Supabase Auth elle-meme, ce qu'un client authentifie ordinaire ne
//      peut pas faire. C'est pour cette seconde etape que cette suppression
//      passe par une fonction Edge plutot qu'un simple appel RPC depuis
//      le mobile.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse } from "../_shared/reponses.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

  const clientUtilisateur = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: autorisation } },
  });

  const {
    data: { user },
    error: erreurUtilisateur,
  } = await clientUtilisateur.auth.getUser();

  if (erreurUtilisateur || !user) {
    return jsonResponse({ erreur: "Session invalide" }, 401);
  }

  const { error: erreurAnonymisation } = await clientUtilisateur.rpc("supprimer_mon_compte");
  if (erreurAnonymisation) {
    return jsonResponse({ erreur: erreurAnonymisation.message }, 400);
  }

  const clientAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { error: erreurSuppressionAuth } = await clientAdmin.auth.admin.deleteUser(user.id);

  if (erreurSuppressionAuth) {
    console.error("Erreur auth.admin.deleteUser:", erreurSuppressionAuth);
    // Les donnees applicatives sont deja anonymisees (l'objectif de
    // confidentialite est atteint) ; seule l'identite d'authentification
    // subsiste, avec un numero de telephone qui ne correspond plus a rien.
    return jsonResponse(
      { ok: true, avertissement: "Compte anonymise ; suppression de l'identite d'authentification incomplete" },
      200,
    );
  }

  return jsonResponse({ ok: true }, 200);
});
