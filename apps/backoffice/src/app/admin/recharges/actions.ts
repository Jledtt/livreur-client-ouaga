"use server";

import { revalidatePath } from "next/cache";
import { creerClientServeur } from "@/lib/supabase/server";

export async function confirmerRechargeAction(formData: FormData) {
  const rechargeId = formData.get("rechargeId");
  const motif = formData.get("motif");
  if (typeof rechargeId !== "string" || typeof motif !== "string") return;

  const supabase = await creerClientServeur();
  const { error } = await supabase.rpc("confirmer_recharge_manuellement", {
    p_recharge_id: rechargeId,
    p_succes: true,
    p_motif: motif,
  });

  if (error) {
    console.error("Erreur confirmer_recharge_manuellement:", error);
  }

  revalidatePath("/admin/recharges");
}

export async function rejeterRechargeAction(formData: FormData) {
  const rechargeId = formData.get("rechargeId");
  const motif = formData.get("motif");
  if (typeof rechargeId !== "string" || typeof motif !== "string") return;

  const supabase = await creerClientServeur();
  const { error } = await supabase.rpc("confirmer_recharge_manuellement", {
    p_recharge_id: rechargeId,
    p_succes: false,
    p_motif: motif,
  });

  if (error) {
    console.error("Erreur confirmer_recharge_manuellement:", error);
  }

  revalidatePath("/admin/recharges");
}
