import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";

const OPERATEURS = [
  { valeur: "orange_money", libelle: "Orange Money" },
  { valeur: "moov_money", libelle: "Moov Money" },
] as const;

const MONTANTS_SUGGERES = [500, 1000, 2000, 5000];

export default function Recharger() {
  const [montant, setMontant] = useState("");
  const [operateur, setOperateur] = useState<(typeof OPERATEURS)[number]["valeur"] | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState(false);

  async function demanderRecharge() {
    const montantNombre = Number(montant);
    if (!Number.isInteger(montantNombre) || montantNombre < 500) {
      setErreur("Le montant minimum de recharge est de 500 FCFA.");
      return;
    }
    if (!operateur) {
      setErreur("Choisissez un operateur.");
      return;
    }

    setErreur(null);
    setEnvoiEnCours(true);

    const { error } = await supabase.functions.invoke("initier-recharge-mobile-money", {
      body: { montant: montantNombre, operateur },
    });

    setEnvoiEnCours(false);

    if (error) {
      setErreur("Impossible de creer la demande de recharge. Reessayez.");
      return;
    }

    setConfirmation(true);
  }

  if (confirmation) {
    return (
      <View style={styles.centre}>
        <Text style={styles.titre}>Demande enregistree</Text>
        <Text style={styles.message}>
          Votre demande de recharge est en attente de confirmation. Le credit sera ajoute des que
          le paiement sera confirme.
        </Text>
        <Pressable style={styles.bouton} onPress={() => router.replace("/portefeuille")}>
          <Text style={styles.texteBouton}>Retour au portefeuille</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.conteneur}>
      <Text style={styles.titre}>Recharger mon compte</Text>

      <Text style={styles.libelle}>Montant (FCFA)</Text>
      <View style={styles.rangeeChips}>
        {MONTANTS_SUGGERES.map((m) => (
          <Pressable key={m} style={styles.chip} onPress={() => setMontant(m.toString())}>
            <Text style={styles.texteChip}>{m.toLocaleString("fr-FR")}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.champ}
        value={montant}
        onChangeText={setMontant}
        keyboardType="number-pad"
        placeholder="Montant libre (minimum 500)"
      />

      <Text style={styles.libelle}>Operateur</Text>
      <View style={styles.rangeeChips}>
        {OPERATEURS.map((op) => (
          <Pressable
            key={op.valeur}
            style={[styles.chip, operateur === op.valeur && styles.chipSelectionne]}
            onPress={() => setOperateur(op.valeur)}
          >
            <Text style={[styles.texteChip, operateur === op.valeur && styles.texteChipSelectionne]}>
              {op.libelle}
            </Text>
          </Pressable>
        ))}
      </View>

      {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}

      <Pressable
        style={[styles.bouton, envoiEnCours && styles.boutonDesactive]}
        onPress={demanderRecharge}
        disabled={envoiEnCours}
      >
        {envoiEnCours ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.texteBouton}>Recharger</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, padding: 24, gap: 8 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  titre: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  message: { fontSize: 15, color: "#555", textAlign: "center" },
  libelle: { fontSize: 14, fontWeight: "600", marginTop: 12, marginBottom: 6 },
  rangeeChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
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
