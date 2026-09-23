"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { creerClientServeur } from "@/lib/supabase/server";

export async function creerGrilleAction(formData: FormData) {
  const dateEffet = formData.get("dateEffet");
  const copierDepuis = formData.get("copierDepuis");
  if (typeof dateEffet !== "string" || dateEffet.length === 0) return;

  const supabase = await creerClientServeur();
  const { data, error } = await supabase.rpc("creer_grille_brouillon", {
    p_date_effet: new Date(dateEffet).toISOString(),
    p_copier_depuis_grille_id:
      typeof copierDepuis === "string" && copierDepuis.length > 0 ? Number(copierDepuis) : null,
  });

  if (error || !data) {
    console.error("Erreur creer_grille_brouillon:", error);
    return;
  }

  revalidatePath("/admin/grille");
  redirect(`/admin/grille/${data.id}`);
}

export async function activerGrilleAction(formData: FormData) {
  const grilleId = formData.get("grilleId");
  if (typeof grilleId !== "string") return;

  const supabase = await creerClientServeur();
  const { error } = await supabase.rpc("activer_grille", { p_grille_id: Number(grilleId) });

  if (error) {
    console.error("Erreur activer_grille:", error);
  }

  revalidatePath("/admin/grille");
}
