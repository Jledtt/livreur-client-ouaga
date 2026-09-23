// Normalisation des numeros burkinabe en E.164, partagee par les fonctions Edge.
// Regle metier : "Format de numero burkinabe accepte avec ou sans indicatif ;
// normalisation en E.164 avant stockage" (section 5.1 du cahier des charges).
//
// Le Burkina Faso (indicatif +226) utilise des numeros locaux a 8 chiffres.

export function normaliserTelephoneBurkina(saisie: string): string | null {
  const chiffres = saisie.replace(/[^0-9+]/g, "");

  let local: string | null = null;

  if (/^\+226\d{8}$/.test(chiffres)) {
    local = chiffres.slice(4);
  } else if (/^00226\d{8}$/.test(chiffres)) {
    local = chiffres.slice(5);
  } else if (/^226\d{8}$/.test(chiffres)) {
    local = chiffres.slice(3);
  } else if (/^\d{8}$/.test(chiffres)) {
    local = chiffres;
  }

  if (!local) {
    return null;
  }

  return `+226${local}`;
}
