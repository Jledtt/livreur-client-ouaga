"use server";

import { revalidatePath } from "next/cache";
import { creerClientServeur } from "@/lib/supabase/server";

export async function definirTarifsAction(formData: FormData) {
  const grilleId = formData.get("grilleId");
  const zoneDepartId = formData.get("zoneDepartId");
  const zoneArriveeIds = formData.get("zoneArriveeIds");

  if (
    typeof grilleId !== "string" ||
    typeof zoneDepartId !== "string" ||
    typeof zoneArriveeIds !== "string"
  ) {
    return;
  }

  const supabase = await creerClientServeur();
  const erreurs: string[] = [];

  for (const zoneArriveeId of zoneArriveeIds.split(",").filter(Boolean)) {
    const montantBrut = formData.get(`montant_${zoneArriveeId}`);
    if (typeof montantBrut !== "string" || montantBrut.trim().length === 0) continue;

    const montant = Number(montantBrut);
    if (!Number.isFinite(montant) || montant <= 0) continue;

    const { error } = await supabase.rpc("definir_tarif", {
      p_grille_id: Number(grilleId),
      p_zone_depart_id: Number(zoneDepartId),
      p_zone_arrivee_id: Number(zoneArriveeId),
      p_montant: montant,
      p_asymetrique: formData.get(`asym_${zoneArriveeId}`) === "on",
    });

    if (error) {
      erreurs.push(`zone ${zoneArriveeId} : ${error.message}`);
    }
  }

  revalidatePath(`/admin/grille/${grilleId}`);

  // Chaque cellule est independante (definir_tarif est idempotente), donc on
  // essaie toutes les zones plutot que de s'arreter a la premiere erreur --
  // mais on ne doit pas laisser l'echec passer inapercu pour autant.
  if (erreurs.length > 0) {
    throw new Error(`Certains tarifs n'ont pas ete enregistres : ${erreurs.join(" ; ")}`);
  }
}
