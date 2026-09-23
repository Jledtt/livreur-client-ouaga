// Motifs de signalement generique (5.8), a l'exclusion de "marchandise non
// reversee" qui passe par confirmer_reversement_marchandise() -- ce motif
// declenche une suspension automatique (RG-47) et ne doit avoir qu'un seul
// chemin de creation.
export const MOTIFS_SIGNALEMENT = [
  "Montant reclame superieur au tarif",
  "Colis non livre",
  "Colis endommage",
  "Comportement du livreur",
] as const;
