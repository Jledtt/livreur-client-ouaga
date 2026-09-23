// Normalisation des numeros burkinabe en E.164 (section 5.1 du cahier des
// charges). Duplique volontairement de supabase/functions/_shared/telephone.ts :
// deux runtimes distincts (React Native vs Deno) qui ne partagent pas de
// module, le fichier est assez court pour que la duplication soit moins
// couteuse qu'un package partage a ce stade.

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
