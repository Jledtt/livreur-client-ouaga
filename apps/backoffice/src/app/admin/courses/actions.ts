"use server";

import { revalidatePath } from "next/cache";
import { creerClientServeur } from "@/lib/supabase/server";

export async function resoudreCourseAction(formData: FormData) {
  const courseId = formData.get("courseId");
  const resolution = formData.get("resolution");
  const motif = formData.get("motif");
  if (typeof courseId !== "string" || typeof resolution !== "string" || typeof motif !== "string") {
    return;
  }

  const supabase = await creerClientServeur();
  const { error } = await supabase.rpc("resoudre_course_a_verifier", {
    p_course_id: courseId,
    p_resolution: resolution,
    p_motif: motif,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/courses");
}
