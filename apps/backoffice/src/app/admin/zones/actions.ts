"use server";

import { revalidatePath } from "next/cache";
import { creerClientServeur } from "@/lib/supabase/server";

export async function creerZoneAction(formData: FormData) {
  const nom = formData.get("nom");
  if (typeof nom !== "string" || nom.trim().length === 0) return;

  const supabase = await creerClientServeur();
  const { error } = await supabase.rpc("creer_zone", { p_nom: nom });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/zones");
}

export async function definirStatutZoneAction(formData: FormData) {
  const zoneId = formData.get("zoneId");
  const actif = formData.get("actif");
  if (typeof zoneId !== "string") return;

  const supabase = await creerClientServeur();
  const { error } = await supabase.rpc("definir_statut_zone", {
    p_zone_id: Number(zoneId),
    p_actif: actif === "true",
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/zones");
}
