import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/supabase/server";
import DeconnexionBouton from "./deconnexion-bouton";

const LIENS_NAV = [
  { href: "/admin/livreurs", libelle: "Livreurs" },
  { href: "/admin/zones", libelle: "Zones" },
  { href: "/admin/grille", libelle: "Grille tarifaire" },
  { href: "/admin/recharges", libelle: "Recharges" },
];

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
        <div className="flex items-center gap-6">
          <span className="font-semibold">Livreur-Client Ouaga — Back-office</span>
          <nav className="flex gap-4 text-sm text-gray-500">
            {LIENS_NAV.map((lien) => (
              <Link key={lien.href} href={lien.href} className="hover:text-gray-900">
                {lien.libelle}
              </Link>
            ))}
          </nav>
        </div>
        <DeconnexionBouton />
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
