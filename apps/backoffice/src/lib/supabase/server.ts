import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Client lie a la session de l'administrateur connecte (cookies). A utiliser
// pour toute lecture/ecriture qui doit porter son identite (auth.uid() dans
// les fonctions RPC, journal_admin.auteur_id).
export async function creerClientServeur() {
  const magasinCookies = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return magasinCookies.getAll();
        },
        setAll(cookiesASetter) {
          try {
            cookiesASetter.forEach(({ name, value, options }) =>
              magasinCookies.set(name, value, options),
            );
          } catch {
            // Ignorable depuis un Server Component (pas d'ecriture de cookie
            // possible) ; le middleware se charge du rafraichissement.
          }
        },
      },
    },
  );
}
