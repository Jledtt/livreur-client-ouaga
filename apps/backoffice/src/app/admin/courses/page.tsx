import { creerClientServeur } from "@/lib/supabase/server";
import { resoudreCourseAction } from "./actions";

type Course = {
  id: string;
  expediteur_id: string;
  livreur_id: string | null;
  zone_depart_id: number;
  zone_arrivee_id: number;
  tarif: number;
  montant_marchandise: number;
  tel_destinataire: string;
  code_retrait: string | null;
  nb_essais_code: number;
  acceptee_le: string | null;
  publiee_le: string;
};

type Utilisateur = { id: string; nom_complet: string | null; telephone: string };
type Zone = { id: number; nom: string };

const RESOLUTIONS = [
  { valeur: "colis_recupere", libelle: "Relancer la saisie du code", couleur: "bg-amber-600" },
  { valeur: "livree", libelle: "Marquer livree", couleur: "bg-emerald-700" },
  { valeur: "echouee", libelle: "Marquer echouee", couleur: "bg-red-700" },
  { valeur: "annulee", libelle: "Annuler", couleur: "bg-gray-600" },
] as const;

export default async function PageCourses() {
  const supabase = await creerClientServeur();

  const { data: coursesData } = await supabase
    .from("courses")
    .select(
      "id, expediteur_id, livreur_id, zone_depart_id, zone_arrivee_id, tarif, montant_marchandise, tel_destinataire, code_retrait, nb_essais_code, acceptee_le, publiee_le",
    )
    .eq("statut", "a_verifier")
    .order("acceptee_le");

  const courses = (coursesData ?? []) as Course[];

  const idsUtilisateurs = [
    ...new Set(courses.flatMap((c) => [c.expediteur_id, c.livreur_id]).filter((id): id is string => !!id)),
  ];

  const [{ data: utilisateursData }, { data: zonesData }] = await Promise.all([
    idsUtilisateurs.length > 0
      ? supabase.from("utilisateurs").select("id, nom_complet, telephone").in("id", idsUtilisateurs)
      : Promise.resolve({ data: [] as Utilisateur[] }),
    supabase.from("zones").select("id, nom"),
  ]);

  const utilisateurs = new Map(((utilisateursData ?? []) as Utilisateur[]).map((u) => [u.id, u]));
  const zones = new Map(((zonesData ?? []) as Zone[]).map((z) => [z.id, z.nom]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Courses a verifier</h1>
        <p className="text-sm text-gray-500">
          Remontees automatiquement 24h apres acceptation sans cloture (RG-27), ou apres cinq codes de
          retrait incorrects (5.5). {courses.length} en attente.
        </p>
      </div>

      <ul className="flex flex-col gap-4">
        {courses.map((course) => {
          const expediteur = utilisateurs.get(course.expediteur_id);
          const livreur = course.livreur_id ? utilisateurs.get(course.livreur_id) : null;

          return (
            <li key={course.id} className="rounded border border-gray-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-semibold">
                  {zones.get(course.zone_depart_id) ?? "?"} → {zones.get(course.zone_arrivee_id) ?? "?"} —{" "}
                  {course.tarif.toLocaleString("fr-FR")} FCFA
                </p>
                <span className="text-xs text-gray-400">
                  Acceptee le{" "}
                  {course.acceptee_le ? new Date(course.acceptee_le).toLocaleString("fr-FR") : "?"}
                </span>
              </div>

              <p className="text-sm text-gray-600">
                Expediteur : {expediteur?.nom_complet ?? "?"} ({expediteur?.telephone ?? "?"})
                <br />
                Livreur : {livreur?.nom_complet ?? "?"} ({livreur?.telephone ?? "?"})
                <br />
                Destinataire : {course.tel_destinataire} — Code : {course.code_retrait ?? "?"} — Essais
                incorrects : {course.nb_essais_code}
                {course.montant_marchandise > 0
                  ? ` — Marchandise a encaisser : ${course.montant_marchandise.toLocaleString("fr-FR")} FCFA`
                  : ""}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {RESOLUTIONS.map((resolution) => (
                  <form key={resolution.valeur} action={resoudreCourseAction} className="flex gap-2">
                    <input type="hidden" name="courseId" value={course.id} />
                    <input type="hidden" name="resolution" value={resolution.valeur} />
                    <input
                      type="text"
                      name="motif"
                      placeholder="Motif"
                      required
                      className="w-40 rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                    <button
                      type="submit"
                      className={`rounded px-3 py-1.5 text-sm font-medium text-white ${resolution.couleur}`}
                    >
                      {resolution.libelle}
                    </button>
                  </form>
                ))}
              </div>
            </li>
          );
        })}
        {courses.length === 0 ? (
          <li className="rounded border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-400">
            Aucune course a verifier.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
