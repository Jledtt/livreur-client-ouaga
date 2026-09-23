import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { normaliserTelephoneBurkina } from "../lib/telephone";
import { NATURES_COLIS, type Zone } from "../lib/types";

export default function PublierCourse() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [grilleActiveId, setGrilleActiveId] = useState<number | null>(null);
  const [zoneDepartId, setZoneDepartId] = useState<number | null>(null);
  const [zoneArriveeId, setZoneArriveeId] = useState<number | null>(null);

  const [natureColis, setNatureColis] = useState<string>(NATURES_COLIS[0]);
  const [descriptionColis, setDescriptionColis] = useState("");
  const [telDestinataire, setTelDestinataire] = useState("");
  const [montantMarchandise, setMontantMarchandise] = useState("");

  const [publicationEnCours, setPublicationEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreurChargement, setErreurChargement] = useState(false);
  const [tentativeChargement, setTentativeChargement] = useState(0);

  useEffect(() => {
    let annule = false;

    Promise.all([
      supabase.from("zones").select("id, nom").eq("actif", true).order("nom"),
      supabase.from("grilles").select("id").eq("etat", "active").maybeSingle(),
    ]).then(([reponseZones, reponseGrille]) => {
      if (annule) return;
      if (reponseZones.error || reponseGrille.error) {
        setErreurChargement(true);
        return;
      }
      setZones((reponseZones.data as Zone[]) ?? []);
      setGrilleActiveId(reponseGrille.data?.id ?? null);
    });

    return () => {
      annule = true;
    };
  }, [tentativeChargement]);

  const paireZones = zoneDepartId && zoneArriveeId ? `${zoneDepartId}-${zoneArriveeId}` : null;
  const [tarifResolu, setTarifResolu] = useState<{ paire: string; montant: number | null } | null>(
    null,
  );
  const tarif = tarifResolu && tarifResolu.paire === paireZones ? tarifResolu.montant : undefined;

  useEffect(() => {
    if (!grilleActiveId || !zoneDepartId || !zoneArriveeId || !paireZones) {
      return;
    }

    let annule = false;
    supabase
      .from("grille_tarifs")
      .select("montant")
      .eq("grille_id", grilleActiveId)
      .eq("zone_depart_id", zoneDepartId)
      .eq("zone_arrivee_id", zoneArriveeId)
      .maybeSingle()
      .then(({ data }) => {
        if (!annule) setTarifResolu({ paire: paireZones, montant: data?.montant ?? null });
      });

    return () => {
      annule = true;
    };
  }, [grilleActiveId, zoneDepartId, zoneArriveeId, paireZones]);

  async function publier() {
    if (!zoneDepartId || !zoneArriveeId) {
      setErreur("Choisissez les deux zones.");
      return;
    }
    if (!tarif) {
      setErreur("Aucun tarif n'est defini pour ce trajet.");
      return;
    }
    const telNormalise = normaliserTelephoneBurkina(telDestinataire);
    if (!telNormalise) {
      setErreur("Entrez un numero de destinataire valide.");
      return;
    }

    const montantMarchandiseNombre = montantMarchandise.trim() ? Number(montantMarchandise) : 0;
    if (!Number.isFinite(montantMarchandiseNombre) || montantMarchandiseNombre < 0) {
      setErreur("Le montant de marchandise est invalide.");
      return;
    }

    setErreur(null);
    setPublicationEnCours(true);

    const { error } = await supabase.rpc("publier_course", {
      p_zone_depart_id: zoneDepartId,
      p_zone_arrivee_id: zoneArriveeId,
      p_description_colis: descriptionColis.trim() || null,
      p_nature_colis: natureColis,
      p_tel_destinataire: telNormalise,
      p_montant_marchandise: montantMarchandiseNombre,
    });

    setPublicationEnCours(false);

    if (error) {
      setErreur("Impossible de publier la course. Reessayez.");
      console.error(error);
      return;
    }

    router.replace("/mes-envois");
  }

  return (
    <KeyboardAvoidingView
      style={styles.conteneur}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.titre}>Envoyer un colis</Text>

        {erreurChargement ? (
          <Pressable onPress={() => setTentativeChargement((n) => n + 1)}>
            <Text style={styles.erreur}>
              Impossible de charger les zones. Toucher pour reessayer.
            </Text>
          </Pressable>
        ) : null}

        <Text style={styles.libelle}>Zone de retrait</Text>
        <View style={styles.rangeeChips}>
          {zones.map((zone) => (
            <Pressable
              key={zone.id}
              style={[styles.chip, zoneDepartId === zone.id && styles.chipSelectionne]}
              onPress={() => setZoneDepartId(zone.id)}
            >
              <Text style={[styles.texteChip, zoneDepartId === zone.id && styles.texteChipSelectionne]}>
                {zone.nom}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.libelle}>Zone de livraison</Text>
        <View style={styles.rangeeChips}>
          {zones.map((zone) => (
            <Pressable
              key={zone.id}
              style={[styles.chip, zoneArriveeId === zone.id && styles.chipSelectionne]}
              onPress={() => setZoneArriveeId(zone.id)}
            >
              <Text style={[styles.texteChip, zoneArriveeId === zone.id && styles.texteChipSelectionne]}>
                {zone.nom}
              </Text>
            </Pressable>
          ))}
        </View>

        {zoneDepartId && zoneArriveeId ? (
          <View style={styles.blocTarif}>
            {tarif === undefined ? (
              <ActivityIndicator />
            ) : tarif === null ? (
              <Text style={styles.tarifIndisponible}>Aucun tarif defini pour ce trajet.</Text>
            ) : (
              <Text style={styles.tarif}>{tarif.toLocaleString("fr-FR")} FCFA</Text>
            )}
          </View>
        ) : null}

        <Text style={styles.libelle}>Nature du colis</Text>
        <View style={styles.rangeeChips}>
          {NATURES_COLIS.map((nature) => (
            <Pressable
              key={nature}
              style={[styles.chip, natureColis === nature && styles.chipSelectionne]}
              onPress={() => setNatureColis(nature)}
            >
              <Text style={[styles.texteChip, natureColis === nature && styles.texteChipSelectionne]}>
                {nature}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.libelle}>Description (une ligne)</Text>
        <TextInput
          style={styles.champ}
          value={descriptionColis}
          onChangeText={setDescriptionColis}
          placeholder="Ex : un carton de vaisselle"
        />

        <Text style={styles.libelle}>Numero du destinataire</Text>
        <TextInput
          style={styles.champ}
          value={telDestinataire}
          onChangeText={setTelDestinataire}
          keyboardType="phone-pad"
          placeholder="70 00 00 00"
        />

        <Text style={styles.libelle}>Montant de marchandise a encaisser (optionnel)</Text>
        <TextInput
          style={styles.champ}
          value={montantMarchandise}
          onChangeText={setMontantMarchandise}
          keyboardType="number-pad"
          placeholder="0"
        />

        {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}

        <Pressable
          style={[styles.bouton, publicationEnCours && styles.boutonDesactive]}
          onPress={publier}
          disabled={publicationEnCours}
        >
          {publicationEnCours ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.texteBouton}>Publier la course</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1 },
  contenu: { padding: 24, gap: 8, paddingBottom: 60 },
  titre: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  libelle: { fontSize: 14, fontWeight: "600", marginTop: 12, marginBottom: 6 },
  rangeeChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipSelectionne: { backgroundColor: "#0F4C5C", borderColor: "#0F4C5C" },
  texteChip: { fontSize: 14, color: "#333" },
  texteChipSelectionne: { color: "#fff" },
  blocTarif: { marginTop: 16, alignItems: "center" },
  tarif: { fontSize: 28, fontWeight: "700", color: "#0F4C5C" },
  tarifIndisponible: { fontSize: 14, color: "#B3261E" },
  champ: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  erreur: { color: "#B3261E", fontSize: 14, marginTop: 12 },
  bouton: {
    backgroundColor: "#0F4C5C",
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  boutonDesactive: { opacity: 0.6 },
  texteBouton: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
