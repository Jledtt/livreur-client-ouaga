import { NextResponse } from "next/server";
import { creerClientServeur } from "@/lib/supabase/server";

// Export CSV pour relire une grille a froid (5.2). Les noms de zones sont
// resolus manuellement plutot que via une relation imbriquee PostgREST : la
// table grille_tarifs a deux cles etrangeres vers zones (depart et arrivee),
// ambigues pour une jointure automatique.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const grilleId = Number(id);
  const supabase = await creerClientServeur();

  const [{ data: zonesData }, { data: tarifsData, error }] = await Promise.all([
    supabase.from("zones").select("id, nom"),
    supabase
      .from("grille_tarifs")
      .select("zone_depart_id, zone_arrivee_id, montant")
      .eq("grille_id", grilleId),
  ]);

  if (error) {
    return NextResponse.json({ erreur: error.message }, { status: 500 });
  }

  const nomParZone = new Map(((zonesData ?? []) as { id: number; nom: string }[]).map((z) => [z.id, z.nom]));

  const lignes = ["zone_depart,zone_arrivee,montant_fcfa"];
  for (const tarif of (tarifsData ?? []) as {
    zone_depart_id: number;
    zone_arrivee_id: number;
    montant: number;
  }[]) {
    const depart = nomParZone.get(tarif.zone_depart_id) ?? tarif.zone_depart_id;
    const arrivee = nomParZone.get(tarif.zone_arrivee_id) ?? tarif.zone_arrivee_id;
    lignes.push(`${depart},${arrivee},${tarif.montant}`);
  }

  return new NextResponse(lignes.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="grille-${grilleId}.csv"`,
    },
  });
}
