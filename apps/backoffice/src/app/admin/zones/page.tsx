import { creerClientServeur } from "@/lib/supabase/server";
import { creerZoneAction, definirStatutZoneAction } from "./actions";

type Zone = { id: number; nom: string; actif: boolean };

export default async function PageZones() {
  const supabase = await creerClientServeur();
  const { data } = await supabase.from("zones").select("id, nom, actif").order("nom");
  const zones = (data ?? []) as Zone[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Zones</h1>
        <p className="text-sm text-gray-500">
          Quartiers de Ouagadougou utilisables dans la grille tarifaire.
        </p>
      </div>

      <form action={creerZoneAction} className="flex gap-2">
        <input
          type="text"
          name="nom"
          placeholder="Nom du quartier"
          required
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white">
          Ajouter
        </button>
      </form>

      <ul className="divide-y divide-gray-200 rounded border border-gray-200 bg-white">
        {zones.map((zone) => (
          <li key={zone.id} className="flex items-center justify-between px-4 py-3">
            <span className={zone.actif ? "" : "text-gray-400 line-through"}>{zone.nom}</span>
            <form action={definirStatutZoneAction}>
              <input type="hidden" name="zoneId" value={zone.id} />
              <input type="hidden" name="actif" value={(!zone.actif).toString()} />
              <button type="submit" className="text-sm text-slate-600 hover:text-slate-900">
                {zone.actif ? "Desactiver" : "Activer"}
              </button>
            </form>
          </li>
        ))}
        {zones.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-gray-400">Aucune zone pour le moment.</li>
        ) : null}
      </ul>
    </div>
  );
}
