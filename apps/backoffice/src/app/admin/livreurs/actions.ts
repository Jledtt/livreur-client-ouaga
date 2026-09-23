"use server";

import { revalidatePath } from "next/cache";
import { creerClientServeur } from "@/lib/supabase/server";

// Ces actions utilisent le client lie a la session de l'administrateur
// (pas la cle de service) : les fonctions RPC verifient auth.uid() contre
// la table administrateurs et journalisent cette identite dans journal_admin.

export async function validerLivreurAction(formData: FormData) {
  const livreurId = formData.get("livreurId");
  if (typeof livreurId !== "string") return;

  const supabase = await creerClientServeur();
  const { error } = await supabase.rpc("valider_livreur", { p_livreur_id: livreurId });

  if (error) {
    console.error("Erreur valider_livreur:", error);
  }

  revalidatePath("/admin/livreurs");
}

export async function rejeterLivreurAction(formData: FormData) {
  const livreurId = formData.get("livreurId");
  const motif = formData.get("motif");
  if (typeof livreurId !== "string" || typeof motif !== "string") return;

  const supabase = await creerClientServeur();
  const { error } = await supabase.rpc("rejeter_livreur", {
    p_livreur_id: livreurId,
    p_motif: motif,
  });

  if (error) {
    console.error("Erreur rejeter_livreur:", error);
  }

  revalidatePath("/admin/livreurs");
}
