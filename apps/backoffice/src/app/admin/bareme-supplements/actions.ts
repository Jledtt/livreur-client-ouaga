"use server";

import { revalidatePath } from "next/cache";
import { creerClientServeur } from "@/lib/supabase/server";

export async function creerMotifAction(formData: FormData) {
  const motif = formData.get("motif");
  const montant = formData.get("montant");
  if (typeof motif !== "string" || typeof montant !== "string") return;

  const supabase = await creerClientServeur();
  const { error } = await supabase.rpc("creer_motif_supplement", {
    p_motif: motif,
    p_montant: Number(montant),
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/bareme-supplements");
}

export async function modifierMotifAction(formData: FormData) {
  const id = formData.get("id");
  const montant = formData.get("montant");
  const actif = formData.get("actif");
  if (typeof id !== "string" || typeof montant !== "string") return;

  const supabase = await creerClientServeur();
  const { error } = await supabase.rpc("definir_motif_supplement", {
    p_id: Number(id),
    p_montant: Number(montant),
    p_actif: actif === "true",
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/bareme-supplements");
}
