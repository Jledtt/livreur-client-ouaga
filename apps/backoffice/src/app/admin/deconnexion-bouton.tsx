"use client";

import { useRouter } from "next/navigation";
import { creerClientNavigateur } from "@/lib/supabase/browser";

export default function DeconnexionBouton() {
  const router = useRouter();

  async function seDeconnecter() {
    const supabase = creerClientNavigateur();
    await supabase.auth.signOut();
    router.replace("/connexion");
    router.refresh();
  }

  return (
    <button onClick={seDeconnecter} className="text-sm text-gray-500 hover:text-gray-800">
      Se deconnecter
    </button>
  );
}
