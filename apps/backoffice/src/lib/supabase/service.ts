import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cle de service : uniquement cote serveur (jamais dans un composant client),
// pour la lecture administrative (liste des livreurs, URL signees des pieces
// d'identite). Les ecritures qui doivent porter l'identite de l'administrateur
// passent par creerClientServeur() (lib/supabase/server.ts), pas par ce client.
export function creerClientService() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
