import { creerClientServeur } from "@/lib/supabase/server";

type CourseStatut = { statut: string };
type MouvementMontant = { montant: number };

function debutAujourdhui(): string {
  const maintenant = new Date();
  maintenant.setHours(0, 0, 0, 0);
  return maintenant.toISOString();
}

export default async function PageTableauDeBord() {
  const supabase = await creerClientServeur();
  const depuis = debutAujourdhui();

  const [{ data: coursesJourData }, { data: coursesSansPreneurData }, { data: mouvementsData }] =
    await Promise.all([
      supabase.from("courses").select("statut").gte("publiee_le", depuis),
      supabase.from("courses").select("statut").eq("statut", "publiee"),
      supabase
        .from("mouvements_credit")
        .select("montant")
        .eq("type", "prelevement")
        .gte("cree_le", depuis),
    ]);

  const coursesJour = (coursesJourData ?? []) as CourseStatut[];
  const coursesSansPreneur = (coursesSansPreneurData ?? []) as CourseStatut[];
  const mouvements = (mouvementsData ?? []) as MouvementMontant[];

  const nbPublieesJour = coursesJour.length;
  const nbAccepteesOuPlusJour = coursesJour.filter((c) =>
    ["acceptee", "colis_recupere", "livree"].includes(c.statut),
  ).length;
  const tauxAcceptation = nbPublieesJour > 0 ? Math.round((nbAccepteesOuPlusJour / nbPublieesJour) * 100) : null;
  const nbEchecsJour = coursesJour.filter((c) => c.statut === "echouee").length;
  const volumePrelevementJour = mouvements.reduce((total, m) => total + Math.abs(m.montant), 0);

  const cartes = [
    { libelle: "Courses publiees aujourd'hui", valeur: nbPublieesJour.toString() },
    {
      libelle: "Taux d'acceptation du jour",
      valeur: tauxAcceptation === null ? "—" : `${tauxAcceptation}%`,
    },
    { libelle: "Courses sans preneur (en ce moment)", valeur: coursesSansPreneur.length.toString() },
    { libelle: "Echecs declares aujourd'hui", valeur: nbEchecsJour.toString() },
    {
      libelle: "Volume de prelevement aujourd'hui",
      valeur: `${volumePrelevementJour.toLocaleString("fr-FR")} FCFA`,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Tableau de bord</h1>
        <p className="text-sm text-gray-500">
          Le taux de courses sans preneur est l&apos;indicateur qui revele une grille mal calibree.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cartes.map((carte) => (
          <div key={carte.libelle} className="rounded border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">{carte.libelle}</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{carte.valeur}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
