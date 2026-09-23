import { notFound } from "next/navigation";
import { creerClientServeur } from "@/lib/supabase/server";
import { definirTarifsAction } from "./actions";
import SelecteurZoneDepart from "./selecteur-zone-depart";

type Grille = { id: number; date_effet: string; etat: "brouillon" | "active" | "archivee" };
type Zone = { id: number; nom: string; actif: boolean };
type TarifExistant = { zone_arrivee_id: number; montant: number };

const LIBELLE_ETAT: Record<Grille["etat"], string> = {
  brouillon: "brouillon, modifiable",
  active: "active, figee",
  archivee: "archivee, figee",
};

export default async function PageEditionGrille({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ depart?: string }>;
}) {
  const { id } = await params;
  const { depart } = await searchParams;
  const grilleId = Number(id);

  const supabase = await creerClientServeur();

  const [{ data: grille }, { data: zonesData }] = await Promise.all([
    supabase.from("grilles").select("id, date_effet, etat").eq("id", grilleId).maybeSingle(),
    supabase.from("zones").select("id, nom, actif").order("nom"),
  ]);

  if (!grille) {
    notFound();
  }

  const zones = (zonesData ?? []) as Zone[];
  const zoneDepartId = depart ? Number(depart) : zones[0]?.id;

  const { data: tarifsData } = zoneDepartId
    ? await supabase
        .from("grille_tarifs")
        .select("zone_arrivee_id, montant")
        .eq("grille_id", grilleId)
        .eq("zone_depart_id", zoneDepartId)
    : { data: [] as TarifExistant[] };

  const montantParZone = new Map(
    ((tarifsData ?? []) as TarifExistant[]).map((t) => [t.zone_arrivee_id, t.montant]),
  );

  const modifiable = (grille as Grille).etat === "brouillon";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Grille #{(grille as Grille).id}</h1>
        <p className="text-sm text-gray-500">
          Effet au {new Date((grille as Grille).date_effet).toLocaleDateString("fr-FR")} —{" "}
          {LIBELLE_ETAT[(grille as Grille).etat]}
        </p>
        <a
          href={`/admin/grille/${(grille as Grille).id}/export`}
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          Exporter en CSV
        </a>
      </div>

      {zones.length === 0 ? (
        <p className="text-sm text-gray-500">
          Aucune zone n&apos;existe encore.{" "}
          <a href="/admin/zones" className="underline">
            En creer une
          </a>
          .
        </p>
      ) : (
        <>
          <SelecteurZoneDepart zones={zones} zoneSelectionneeId={zoneDepartId!} />

          <form action={definirTarifsAction} className="rounded border border-gray-200 bg-white">
            <input type="hidden" name="grilleId" value={(grille as Grille).id} />
            <input type="hidden" name="zoneDepartId" value={zoneDepartId} />
            <input type="hidden" name="zoneArriveeIds" value={zones.map((z) => z.id).join(",")} />

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="px-4 py-2 font-medium">Zone d&apos;arrivee</th>
                  <th className="px-4 py-2 font-medium">Tarif (FCFA)</th>
                  {modifiable ? <th className="px-4 py-2 font-medium">Asymetrique</th> : null}
                </tr>
              </thead>
              <tbody>
                {zones.map((zone) => (
                  <tr key={zone.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-2">
                      {zone.nom}
                      {zone.id === zoneDepartId ? (
                        <span className="ml-2 text-xs text-gray-400">(meme zone)</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2">
                      {modifiable ? (
                        <input
                          type="number"
                          min={1}
                          step={1}
                          name={`montant_${zone.id}`}
                          defaultValue={montantParZone.get(zone.id) ?? ""}
                          className="w-28 rounded border border-gray-300 px-2 py-1"
                        />
                      ) : (
                        (montantParZone.get(zone.id) ?? "—")
                      )}
                    </td>
                    {modifiable ? (
                      <td className="px-4 py-2">
                        <input type="checkbox" name={`asym_${zone.id}`} />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>

            {modifiable ? (
              <div className="p-4">
                <button
                  type="submit"
                  className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white"
                >
                  Enregistrer les tarifs pour cette zone de depart
                </button>
                <p className="mt-2 text-xs text-gray-400">
                  Chaque tarif est applique aussi dans l&apos;autre sens (symetrie par defaut),
                  sauf case &quot;Asymetrique&quot; cochee.
                </p>
              </div>
            ) : null}
          </form>
        </>
      )}
    </div>
  );
}
