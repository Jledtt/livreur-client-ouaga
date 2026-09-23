"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { creerClientNavigateur } from "@/lib/supabase/browser";

export default function PageConnexion() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [connexionEnCours, setConnexionEnCours] = useState(false);

  async function seConnecter(evenement: React.FormEvent) {
    evenement.preventDefault();
    setErreur(null);
    setConnexionEnCours(true);

    const supabase = creerClientNavigateur();
    const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });

    setConnexionEnCours(false);

    if (error) {
      setErreur("Identifiants incorrects.");
      return;
    }

    router.replace("/admin/livreurs");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-bold">Back-office</h1>
      <p className="text-sm text-gray-500">Livreur-Client Ouaga — acces administrateur</p>

      <form onSubmit={seConnecter} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Mot de passe
          <input
            type="password"
            required
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>

        {erreur ? <p className="text-sm text-red-600">{erreur}</p> : null}

        <button
          type="submit"
          disabled={connexionEnCours}
          className="mt-2 rounded bg-slate-800 px-4 py-2 font-medium text-white disabled:opacity-60"
        >
          {connexionEnCours ? "Connexion..." : "Se connecter"}
        </button>
      </form>
    </main>
  );
}
