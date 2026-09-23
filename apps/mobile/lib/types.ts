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
