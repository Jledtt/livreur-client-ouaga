import { creerClientService } from "@/lib/supabase/service";
import { validerLivreurAction, rejeterLivreurAction } from "./actions";

const BUCKET_PIECES = "pieces-identite";
const DUREE_URL_SIGNEE = 300; // secondes (7.5 : URL signee a duree courte)

type LivreurEnAttente = {
  utilisateur_id: string;
  plaque: string | null;
  piece_recto_url: string | null;
  piece_verso_url: string | null;
  selfie_url: string | null;
  cree_le: string;
  utilisateurs: { nom_complet: string | null; telephone: string } | null;
};

async function chargerLivreursEnAttente() {
  const supabase = creerClientService();

  const { data, error } = await supabase
    .from("livreurs")
    .select(
      "utilisateur_id, plaque, piece_recto_url, piece_verso_url, selfie_url, cree_le, utilisateurs(nom_complet, telephone)",
    )
    .eq("statut", "en_attente")
    .order("cree_le", { ascending: true });

  if (error) {
    throw error;
  }

  const livreurs = (data ?? []) as unknown as LivreurEnAttente[];

  return Promise.all(
    livreurs.map(async (livreur) => {
      const chemins = [livreur.piece_recto_url, livreur.piece_verso_url, livreur.selfie_url];
      const urlsSignees = await Promise.all(
        chemins.map(async (chemin) => {
          if (!chemin) return null;
          const { data: signee } = await supabase.storage
            .from(BUCKET_PIECES)
            .createSignedUrl(chemin, DUREE_URL_SIGNEE);
          return signee?.signedUrl ?? null;
        }),
      );

      return { ...livreur, urlsSignees };
    }),
  );
}

export default async function PageLivreursEnAttente() {
  const livreurs = await chargerLivreursEnAttente();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Validation des livreurs</h1>
        <p className="text-sm text-gray-500">
          {livreurs.length} inscription{livreurs.length > 1 ? "s" : ""} en attente
        </p>
      </div>

      {livreurs.length === 0 ? (
        <p className="text-sm text-gray-500">Aucune inscription en attente.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {livreurs.map((livreur) => (
            <li key={livreur.utilisateur_id} className="rounded border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-baseline justify-between">
                <div>
                  <p className="font-semibold">{livreur.utilisateurs?.nom_complet ?? "(sans nom)"}</p>
                  <p className="text-sm text-gray-500">
                    {livreur.utilisateurs?.telephone} — plaque {livreur.plaque ?? "?"}
                  </p>
                </div>
                <p className="text-xs text-gray-400">
                  {new Date(livreur.cree_le).toLocaleString("fr-FR")}
                </p>
              </div>

              <div className="mb-4 grid grid-cols-3 gap-2">
                {["Recto", "Verso", "Selfie"].map((libelle, index) =>
                  livreur.urlsSignees[index] ? (
                    <a key={libelle} href={livreur.urlsSignees[index]!} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- URL signee a duree courte, dimensions inconnues */}
                      <img
                        src={livreur.urlsSignees[index]!}
                        alt={libelle}
                        className="h-32 w-full rounded border border-gray-200 object-cover"
                      />
                    </a>
                  ) : (
                    <div
                      key={libelle}
                      className="flex h-32 items-center justify-center rounded border border-dashed border-gray-300 text-xs text-gray-400"
                    >
                      {libelle} manquant
                    </div>
                  ),
                )}
              </div>

              <div className="flex gap-2">
                <form action={validerLivreurAction}>
                  <input type="hidden" name="livreurId" value={livreur.utilisateur_id} />
                  <button
                    type="submit"
                    className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white"
                  >
                    Valider
                  </button>
                </form>

                <form action={rejeterLivreurAction} className="flex flex-1 gap-2">
                  <input type="hidden" name="livreurId" value={livreur.utilisateur_id} />
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
