import { NextResponse } from "next/server";
import { verifierAdministrateurConnecte } from "@/lib/supabase/server";

// Echappement RFC 4180 : un champ contenant une virgule, un guillemet ou un
// saut de ligne doit etre entoure de guillemets, avec les guillemets internes
// doubles. Les noms de zones sont une saisie libre (creer_zone n'interdit que
// la chaine vide) : sans cela, une zone nommee "Ouaga 2000, secteur 15"
// decale les colonnes de tout le fichier.
function echapperCsv(valeur: string | number): string {
  const texte = String(valeur);
  if (/[",\n]/.test(texte)) {
    return `"${texte.replace(/"/g, '""')}"`;
  }
  return texte;
}

// Export CSV pour relire une grille a froid (5.2). Les noms de zones sont
// resolus manuellement plutot que via une relation imbriquee PostgREST : la
// table grille_tarifs a deux cles etrangeres vers zones (depart et arrivee),
// ambigues pour une jointure automatique.
//
// Important : les Route Handlers (ce fichier) ne sont PAS proteges par
// app/admin/layout.tsx (qui ne s'applique qu'aux pages React) -- la
// verification d'acces doit donc etre faite explicitement ici.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await verifierAdministrateurConnecte();
  if (!session) {
    return NextResponse.json({ erreur: "Non autorise" }, { status: 401 });
  }
  const { supabase } = session;

  const { id } = await context.params;
  const grilleId = Number(id);

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
    lignes.push(`${echapperCsv(depart)},${echapperCsv(arrivee)},${tarif.montant}`);
  }

  return new NextResponse(lignes.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="grille-${grilleId}.csv"`,
    },
  });
}
