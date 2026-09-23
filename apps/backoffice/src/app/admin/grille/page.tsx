import Link from "next/link";
import { creerClientServeur } from "@/lib/supabase/server";
import { creerGrilleAction, activerGrilleAction } from "./actions";

type Grille = { id: number; date_effet: string; etat: "brouillon" | "active" | "archivee" };

const LIBELLE_ETAT: Record<Grille["etat"], string> = {
  brouillon: "Brouillon",
  active: "Active",
  archivee: "Archivee",
};

const COULEUR_ETAT: Record<Grille["etat"], string> = {
  brouillon: "bg-amber-100 text-amber-800",
  active: "bg-emerald-100 text-emerald-800",
  archivee: "bg-gray-100 text-gray-500",
};

export default async function PageGrilles() {
  const supabase = await creerClientServeur();
  const { data } = await supabase
    .from("grilles")
    .select("id, date_effet, etat")
    .order("cree_le", { ascending: false });
  const grilles = (data ?? []) as Grille[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Grille tarifaire</h1>
        <p className="text-sm text-gray-500">
          Une seule version est active a la fois. L&apos;activation d&apos;une nouvelle grille
          archive automatiquement l&apos;ancienne.
        </p>
      </div>

      <form action={creerGrilleAction} className="flex flex-wrap items-end gap-2 rounded border border-gray-200 bg-white p-4">
        <label className="flex flex-col gap-1 text-sm">
          Date de prise d&apos;effet
          <input
            type="date"
            name="dateEffet"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Copier les tarifs depuis (optionnel)
          <select name="copierDepuis" className="rounded border border-gray-300 px-3 py-2">
            <option value="">Grille vide</option>
            {grilles.map((grille) => (
              <option key={grille.id} value={grille.id}>
                Grille #{grille.id} ({LIBELLE_ETAT[grille.etat]})
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white">
          Nouvelle grille
        </button>
      </form>

      <ul className="divide-y divide-gray-200 rounded border border-gray-200 bg-white">
        {grilles.map((grille) => (
          <li key={grille.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${COULEUR_ETAT[grille.etat]}`}>
                {LIBELLE_ETAT[grille.etat]}
              </span>
              <span className="text-sm">
                Grille #{grille.id} — effet au{" "}
                {new Date(grille.date_effet).toLocaleDateString("fr-FR")}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Link href={`/admin/grille/${grille.id}`} className="text-sm text-slate-600 hover:text-slate-900">
                {grille.etat === "brouillon" ? "Modifier" : "Consulter"}
              </Link>
              {grille.etat === "brouillon" ? (
                <form action={activerGrilleAction}>
                  <input type="hidden" name="grilleId" value={grille.id} />
                  <button type="submit" className="text-sm font-medium text-emerald-700 hover:text-emerald-900">
                    Activer
                  </button>
                </form>
              ) : null}
            </div>
          </li>
        ))}
        {grilles.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-gray-400">Aucune grille pour le moment.</li>
        ) : null}
      </ul>
    </div>
  );
}
