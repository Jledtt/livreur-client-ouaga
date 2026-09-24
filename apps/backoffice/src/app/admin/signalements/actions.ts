"use server";

import { revalidatePath } from "next/cache";
import { creerClientServeur } from "@/lib/supabase/server";

export async function prendreEnChargeAction(formData: FormData) {
  const signalementId = formData.get("signalementId");
  if (typeof signalementId !== "string") return;

  const supabase = await creerClientServeur();
  const { error } = await supabase.rpc("traiter_signalement", {
    p_signalement_id: signalementId,
    p_etat: "en_cours",
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/signalements");
}

export async function cloturerSignalementAction(formData: FormData) {
  const signalementId = formData.get("signalementId");
  const decision = formData.get("decision");
  if (typeof signalementId !== "string" || typeof decision !== "string") return;

  const supabase = await creerClientServeur();
  const { error } = await supabase.rpc("traiter_signalement", {
    p_signalement_id: signalementId,
    p_etat: "clos",
    p_decision: decision,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/signalements");
}

export async function suspendreLivreurAction(formData: FormData) {
  const livreurId = formData.get("livreurId");
  const motif = formData.get("motif");
  if (typeof livreurId !== "string" || typeof motif !== "string") return;

  const supabase = await creerClientServeur();
  const { error } = await supabase.rpc("suspendre_livreur", {
    p_livreur_id: livreurId,
    p_motif: motif,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/signalements");
}

export async function leverSuspensionAction(formData: FormData) {
  const livreurId = formData.get("livreurId");
  const motif = formData.get("motif");
  if (typeof livreurId !== "string" || typeof motif !== "string") return;

  const supabase = await creerClientServeur();
  const { error } = await supabase.rpc("lever_suspension_livreur", {
    p_livreur_id: livreurId,
    p_motif: motif,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/signalements");
}
