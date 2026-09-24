import { creerClientServeur } from "@/lib/supabase/server";
import { creerMotifAction, modifierMotifAction } from "./actions";

type Motif = { id: number; motif: string; montant: number; actif: boolean };

export default async function PageBaremeSupplements() {
  const supabase = await creerClientServeur();
  const { data } = await supabase.from("bareme_supplements").select("id, motif, montant, actif").order("motif");
  const motifs = (data ?? []) as Motif[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Bareme des supplements</h1>
        <p className="text-sm text-gray-500">
          Liste fermee de motifs proposee au livreur pendant une course (5.6).
        </p>
      </div>

      <form
        action={creerMotifAction}
        className="flex flex-wrap items-end gap-2 rounded border border-gray-200 bg-white p-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          Motif
          <input type="text" name="motif" required className="rounded border border-gray-300 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Montant (FCFA)
          <input
            type="number"
            name="montant"
            min={1}
            required
            className="w-32 rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <button type="submit" className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white">
          Ajouter
        </button>
      </form>

      <ul className="divide-y divide-gray-200 rounded border border-gray-200 bg-white">
        {motifs.map((motif) => (
          <li key={motif.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className={motif.actif ? "" : "text-gray-400 line-through"}>{motif.motif}</span>

            <form action={modifierMotifAction} className="flex items-center gap-2">
              <input type="hidden" name="id" value={motif.id} />
              <input
                type="number"
                name="montant"
                defaultValue={motif.montant}
                min={1}
                className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
              />
              <input type="hidden" name="actif" value={motif.actif.toString()} />
              <button type="submit" className="text-sm text-slate-600 hover:text-slate-900">
                Enregistrer le montant
              </button>
            </form>

            <form action={modifierMotifAction}>
              <input type="hidden" name="id" value={motif.id} />
              <input type="hidden" name="montant" value={motif.montant} />
              <input type="hidden" name="actif" value={(!motif.actif).toString()} />
              <button type="submit" className="text-sm text-slate-600 hover:text-slate-900">
                {motif.actif ? "Desactiver" : "Activer"}
              </button>
            </form>
          </li>
        ))}
        {motifs.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-gray-400">Aucun motif pour le moment.</li>
        ) : null}
      </ul>
    </div>
  );
}
