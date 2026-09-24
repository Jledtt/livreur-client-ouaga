import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";

export default function SupprimerCompte() {
  const [confirmation, setConfirmation] = useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function confirmerSuppression() {
    setErreur(null);
    setSuppressionEnCours(true);

    const { error } = await supabase.functions.invoke("supprimer-compte");

    if (error) {
      setSuppressionEnCours(false);
      setErreur(
        "Impossible de supprimer le compte pour le moment. Si une course est en cours, terminez-la ou faites-la annuler avant de reessayer.",
      );
      return;
    }

    await supabase.auth.signOut();
    router.replace("/connexion/telephone");
  }

  if (!confirmation) {
    return (
      <View style={styles.conteneur}>
        <Text style={styles.titre}>Supprimer mon compte</Text>

        <Text style={styles.paragraphe}>
          Cette action est definitive. Votre nom, votre numero de telephone et vos pieces
          d&apos;identite seront effaces.
        </Text>
        <Text style={styles.paragraphe}>
          L&apos;historique de vos courses est conserve a des fins comptables, mais n&apos;est plus
          rattache a vos informations personnelles.
        </Text>
        <Text style={styles.paragraphe}>
          Si vous etes livreur, tout credit restant est definitivement perdu (il n&apos;est jamais
          remboursable).
        </Text>
        <Text style={styles.paragraphe}>
          La suppression est impossible tant qu&apos;une course est en cours.
        </Text>

        <Pressable style={styles.boutonDanger} onPress={() => setConfirmation(true)}>
          <Text style={styles.texteBoutonDanger}>Continuer</Text>
        </Pressable>

        <Pressable onPress={() => router.back()}>
          <Text style={styles.lienRetour}>Annuler</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.conteneur}>
      <Text style={styles.titre}>Confirmer la suppression</Text>
      <Text style={styles.paragraphe}>
        Etes-vous certain de vouloir supprimer definitivement votre compte ?
      </Text>

      {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}

      <Pressable
        style={[styles.boutonDanger, suppressionEnCours && styles.boutonDesactive]}
        onPress={confirmerSuppression}
        disabled={suppressionEnCours}
      >
        {suppressionEnCours ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.texteBoutonDanger}>Supprimer definitivement mon compte</Text>
        )}
      </Pressable>

      <Pressable onPress={() => setConfirmation(false)} disabled={suppressionEnCours}>
        <Text style={styles.lienRetour}>Annuler</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 12 },
  titre: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  paragraphe: { fontSize: 14, color: "#555" },
  erreur: { fontSize: 13, color: "#B3261E" },
  boutonDanger: {
    backgroundColor: "#B3261E",
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 20,
  },
  boutonDesactive: { opacity: 0.6 },
  texteBoutonDanger: { color: "#fff", fontSize: 16, fontWeight: "600" },
  lienRetour: { textAlign: "center", marginTop: 16, color: "#0F4C5C", fontSize: 14 },
});
