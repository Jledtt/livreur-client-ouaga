import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";

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

// Verifie que la requete provient d'un administrateur connecte. A appeler
// explicitement dans tout Route Handler (route.ts) sous /admin : contrairement
// aux pages, les Route Handlers ne sont PAS enveloppes par app/admin/layout.tsx
// (les layouts Next.js ne protegent que l'arbre de rendu React, jamais les
// gestionnaires de route). Retourne le client et l'utilisateur si autorise,
// ou null sinon -- a l'appelant de repondre 401/404.
export async function verifierAdministrateurConnecte(): Promise<
  { supabase: SupabaseClient; user: User } | null
> {
  const supabase = await creerClientServeur();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: administrateur } = await supabase
    .from("administrateurs")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!administrateur) {
    return null;
  }

  return { supabase, user };
}
