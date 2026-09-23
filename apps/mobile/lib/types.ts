export type Zone = { id: number; nom: string };

export type StatutCourse =
  | "publiee"
  | "acceptee"
  | "colis_recupere"
  | "livree"
  | "annulee"
  | "echouee"
  | "a_verifier";

export type Course = {
  id: string;
  expediteur_id: string;
  livreur_id: string | null;
  zone_depart_id: number;
  zone_arrivee_id: number;
  tarif: number;
  prelevement: number;
  frais_notification: number;
  montant_marchandise: number;
  description_colis: string | null;
  nature_colis: string | null;
  tel_destinataire: string;
  code_retrait: string | null;
  statut: StatutCourse;
  motif_echec: string | null;
  publiee_le: string;
  acceptee_le: string | null;
  livree_le: string | null;
};

export const NATURES_COLIS = ["Documents", "Repas", "Vetements", "Electronique", "Autre"] as const;

// Sous-ensemble de colonnes renvoye par lister_courses_disponibles() : pas
// de tel_destinataire ni d'expediteur_id, volontairement (7.5) -- voir
// supabase/migrations/20260923013411_fonctions_courses.sql.
export type CourseDisponible = {
  id: string;
  zone_depart_id: number;
  zone_arrivee_id: number;
  tarif: number;
  nature_colis: string | null;
  description_colis: string | null;
  montant_marchandise: number;
  publiee_le: string;
};
