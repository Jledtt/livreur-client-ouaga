import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import { supabase } from "./supabase";

// Stockage prive : chaque livreur ne peut deposer que sous son propre
// prefixe {auth.uid()}/..., impose par la policy storage.objects (6.3, 7.5).
const BUCKET = "pieces-identite";

export type TypePiece = "recto" | "verso" | "selfie";

export async function televerserPieceIdentite(
  utilisateurId: string,
  type: TypePiece,
  uriLocal: string,
): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uriLocal, {
    encoding: "base64",
  });

  const chemin = `${utilisateurId}/${type}-${Date.now()}.jpg`;

  const { error } = await supabase.storage.from(BUCKET).upload(chemin, decode(base64), {
    contentType: "image/jpeg",
    upsert: false,
  });

  if (error) {
    throw error;
  }

  return chemin;
}
