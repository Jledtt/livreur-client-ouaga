import { creerClientServeur } from "@/lib/supabase/server";
import { confirmerRechargeAction, rejeterRechargeAction } from "./actions";

type Recharge = {
  id: string;
  livreur_id: string;
  montant: number;
  operateur: string;
  reference_externe: string | null;
  etat: "en_attente" | "confirmee" | "echouee";
  cree_le: string;
};

type Utilisateur = { id: string; nom_complet: string | null; telephone: string };

const LIBELLE_ETAT: Record<Recharge["etat"], string> = {
  en_attente: "En attente",
  confirmee: "Confirmee",
  echouee: "Echouee",
};

const COULEUR_ETAT: Record<Recharge["etat"], string> = {
  en_attente: "bg-amber-100 text-amber-800",
  confirmee: "bg-emerald-100 text-emerald-800",
  echouee: "bg-red-100 text-red-700",
};

export default async function PageRecharges() {
  const supabase = await creerClientServeur();

  const { data: rechargesData } = await supabase
    .from("recharges")
    .select("id, livreur_id, montant, operateur, reference_externe, etat, cree_le")
    .order("cree_le", { ascending: false })
    .limit(100);

  const recharges = (rechargesData ?? []) as Recharge[];

  const idsLivreurs = [...new Set(recharges.map((r) => r.livreur_id))];
  const { data: utilisateursData } =
    idsLivreurs.length > 0
      ? await supabase.from("utilisateurs").select("id, nom_complet, telephone").in("id", idsLivreurs)
      : { data: [] as Utilisateur[] };

  const nomParLivreur = new Map(
    ((utilisateursData ?? []) as Utilisateur[]).map((u) => [u.id, u]),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Recharges</h1>
        <p className="text-sm text-gray-500">
          Suivi des transactions mobile money et rapprochement manuel. L&apos;agregateur n&apos;etant
          pas encore branche, toute recharge reste en attente jusqu&apos;a confirmation manuelle ici.
        </p>
      </div>

      <ul className="divide-y divide-gray-200 rounded border border-gray-200 bg-white">
        {recharges.map((recharge) => {
          const livreur = nomParLivreur.get(recharge.livreur_id);
          return (
            <li key={recharge.id} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${COULEUR_ETAT[recharge.etat]}`}>
                    {LIBELLE_ETAT[recharge.etat]}
                  </span>
                  <span className="ml-3 text-sm font-medium">
                    {recharge.montant.toLocaleString("fr-FR")} FCFA — {recharge.operateur}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(recharge.cree_le).toLocaleString("fr-FR")}
                </span>
              </div>

              <p className="text-sm text-gray-500">
                {livreur?.nom_complet ?? "?"} — {livreur?.telephone ?? "?"}
                {recharge.reference_externe ? ` — ref. ${recharge.reference_externe}` : ""}
              </p>

              {recharge.etat === "en_attente" ? (
                <div className="flex gap-2">
                  <form action={confirmerRechargeAction} className="flex flex-1 gap-2">
                    <input type="hidden" name="rechargeId" value={recharge.id} />
                    <input
                      type="text"
                      name="motif"
                      placeholder="Motif (ex : paiement confirme par SMS operateur)"
                      required
                      className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                    <button
                      type="submit"
                      className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white"
                    >
                      Confirmer
                    </button>
                  </form>

                  <form action={rejeterRechargeAction} className="flex flex-1 gap-2">
                    <input type="hidden" name="rechargeId" value={recharge.id} />
                    <input
                      type="text"
                      name="motif"
                      placeholder="Motif du rejet"
                      required
                      className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                    <button
                      type="submit"
                      className="rounded bg-red-700 px-3 py-1.5 text-sm font-medium text-white"
                    >
                      Rejeter
                    </button>
                  </form>
                </div>
              ) : null}
            </li>
          );
        })}
        {recharges.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-gray-400">Aucune recharge pour le moment.</li>
        ) : null}
      </ul>
    </div>
  );
}
