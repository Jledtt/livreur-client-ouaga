import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/supabase/server";
import DeconnexionBouton from "./deconnexion-bouton";

export default async function LayoutAdmin({ children }: { children: ReactNode }) {
  const supabase = await creerClientServeur();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion");
  }

  const { data: administrateur } = await supabase
    .from("administrateurs")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!administrateur) {
    redirect("/connexion");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <span className="font-semibold">Livreur-Client Ouaga — Back-office</span>
        <DeconnexionBouton />
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
