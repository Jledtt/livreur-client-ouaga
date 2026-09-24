import { creerClientServeur } from "@/lib/supabase/server";
import {
  prendreEnChargeAction,
  cloturerSignalementAction,
  suspendreLivreurAction,
  leverSuspensionAction,
} from "./actions";

type Signalement = {
  id: string;
  course_id: string;
  auteur: string;
  motif: string;
  description: string | null;
  etat: "ouvert" | "en_cours" | "clos";
  decision: string | null;
  cree_le: string;
};

type CourseContexte = {
  id: string;
  expediteur_id: string;
  livreur_id: string | null;
  zone_depart_id: number;
  zone_arrivee_id: number;
  tarif: number;
  statut: string;
};

type Utilisateur = { id: string; nom_complet: string | null; telephone: string };
type Zone = { id: number; nom: string };
type Livreur = { utilisateur_id: string; statut: string };

const LIBELLE_ETAT: Record<Signalement["etat"], string> = {
  ouvert: "Ouvert",
  en_cours: "En cours",
  clos: "Clos",
};

const COULEUR_ETAT: Record<Signalement["etat"], string> = {
  ouvert: "bg-red-100 text-red-700",
  en_cours: "bg-amber-100 text-amber-800",
  clos: "bg-gray-100 text-gray-500",
};

export default async function PageSignalements() {
  const supabase = await creerClientServeur();

  const { data: signalementsData } = await supabase
    .from("signalements")
    .select("id, course_id, auteur, motif, description, etat, decision, cree_le")
    .order("etat")
    .order("cree_le", { ascending: false });

  const signalements = (signalementsData ?? []) as Signalement[];
  const idsCourses = [...new Set(signalements.map((s) => s.course_id))];

  const { data: coursesData } =
    idsCourses.length > 0
      ? await supabase
          .from("courses")
          .select("id, expediteur_id, livreur_id, zone_depart_id, zone_arrivee_id, tarif, statut")
          .in("id", idsCourses)
      : { data: [] as CourseContexte[] };

  const courses = new Map(((coursesData ?? []) as CourseContexte[]).map((c) => [c.id, c]));

  const idsUtilisateurs = [
    ...new Set(
      [...courses.values()].flatMap((c) => [c.expediteur_id, c.livreur_id]).filter((id): id is string => !!id),
    ),
  ];

  const [{ data: utilisateursData }, { data: livreursData }, { data: zonesData }] = await Promise.all([
    idsUtilisateurs.length > 0
      ? supabase.from("utilisateurs").select("id, nom_complet, telephone").in("id", idsUtilisateurs)
      : Promise.resolve({ data: [] as Utilisateur[] }),
    idsUtilisateurs.length > 0
      ? supabase.from("livreurs").select("utilisateur_id, statut").in("utilisateur_id", idsUtilisateurs)
      : Promise.resolve({ data: [] as Livreur[] }),
    supabase.from("zones").select("id, nom"),
  ]);

  const utilisateurs = new Map(((utilisateursData ?? []) as Utilisateur[]).map((u) => [u.id, u]));
  const livreurs = new Map(((livreursData ?? []) as Livreur[]).map((l) => [l.utilisateur_id, l]));
  const zones = new Map(((zonesData ?? []) as Zone[]).map((z) => [z.id, z.nom]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Signalements</h1>
        <p className="text-sm text-gray-500">
          {signalements.filter((s) => s.etat !== "clos").length} signalement(s) a traiter.
        </p>
      </div>

      <ul className="flex flex-col gap-4">
        {signalements.map((signalement) => {
          const course = courses.get(signalement.course_id);
          const expediteur = course ? utilisateurs.get(course.expediteur_id) : null;
          const livreurUtilisateur = course?.livreur_id ? utilisateurs.get(course.livreur_id) : null;
          const livreurFiche = course?.livreur_id ? livreurs.get(course.livreur_id) : null;

          return (
            <li key={signalement.id} className="rounded border border-gray-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${COULEUR_ETAT[signalement.etat]}`}>
                  {LIBELLE_ETAT[signalement.etat]}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(signalement.cree_le).toLocaleString("fr-FR")}
                </span>
              </div>

              <p className="font-semibold">{signalement.motif}</p>
              <p className="text-sm text-gray-500">
                Signale par {signalement.auteur === "expediteur" ? "l'expediteur" : "le destinataire"}
                {signalement.description ? ` — ${signalement.description}` : ""}
              </p>

              {course ? (
                <p className="mt-2 text-sm text-gray-600">
                  Course : {zones.get(course.zone_depart_id) ?? "?"} → {zones.get(course.zone_arrivee_id) ?? "?"}
                  , {course.tarif.toLocaleString("fr-FR")} FCFA, statut {course.statut}
                  <br />
                  Expediteur : {expediteur?.nom_complet ?? "?"} ({expediteur?.telephone ?? "?"})
                  {course.livreur_id ? (
                    <>
                      {" "}
                      — Livreur : {livreurUtilisateur?.nom_complet ?? "?"} ({livreurUtilisateur?.telephone ?? "?"}) —{" "}
                      <span className="font-medium">{livreurFiche?.statut ?? "?"}</span>
                    </>
                  ) : null}
                </p>
              ) : null}

              {signalement.decision ? (
                <p className="mt-2 text-sm text-emerald-700">Decision : {signalement.decision}</p>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                {signalement.etat === "ouvert" ? (
                  <form action={prendreEnChargeAction}>
                    <input type="hidden" name="signalementId" value={signalement.id} />
                    <button type="submit" className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white">
                      Prendre en charge
                    </button>
                  </form>
                ) : null}

                {signalement.etat !== "clos" ? (
                  <form action={cloturerSignalementAction} className="flex flex-1 min-w-[240px] gap-2">
                    <input type="hidden" name="signalementId" value={signalement.id} />
                    <input
                      type="text"
                      name="decision"
                      placeholder="Decision (obligatoire pour cloturer)"
                      required
                      className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                    <button type="submit" className="rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white">
                      Cloturer
                    </button>
                  </form>
                ) : null}

                {course?.livreur_id && livreurFiche?.statut === "valide" ? (
                  <form action={suspendreLivreurAction} className="flex flex-1 min-w-[240px] gap-2">
                    <input type="hidden" name="livreurId" value={course.livreur_id} />
                    <input
                      type="text"
                      name="motif"
                      placeholder="Motif de suspension"
                      required
                      className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                    <button type="submit" className="rounded bg-red-700 px-3 py-1.5 text-sm font-medium text-white">
                      Suspendre le livreur
                    </button>
                  </form>
                ) : null}

                {course?.livreur_id && livreurFiche?.statut === "suspendu" ? (
                  <form action={leverSuspensionAction} className="flex flex-1 min-w-[240px] gap-2">
                    <input type="hidden" name="livreurId" value={course.livreur_id} />
                    <input
                      type="text"
                      name="motif"
                      placeholder="Motif de levee"
                      required
                      className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                    <button type="submit" className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white">
                      Lever la suspension
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          );
        })}
        {signalements.length === 0 ? (
          <li className="rounded border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-400">
            Aucun signalement.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
