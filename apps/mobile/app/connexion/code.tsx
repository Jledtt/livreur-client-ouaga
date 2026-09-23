import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "../../lib/supabase";

export default function SaisieCode() {
  const { telephone } = useLocalSearchParams<{ telephone: string }>();
  const [code, setCode] = useState("");
  const [verificationEnCours, setVerificationEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function verifierCode() {
    if (!telephone) {
      router.replace("/connexion/telephone");
      return;
    }

    if (code.trim().length < 6) {
      setErreur("Le code comporte six chiffres.");
      return;
    }

    setErreur(null);
    setVerificationEnCours(true);

    const { error } = await supabase.auth.verifyOtp({
      phone: telephone,
      token: code.trim(),
      type: "sms",
    });

    setVerificationEnCours(false);

    if (error) {
      setErreur("Code incorrect ou expire. Reessayez.");
      return;
    }

    router.replace("/accueil");
  }

  return (
    <KeyboardAvoidingView
      style={styles.conteneur}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.titre}>Code recu par SMS</Text>
      <Text style={styles.sousTitre}>Envoye au {telephone}</Text>

      <TextInput
        style={styles.champ}
        placeholder="123456"
        keyboardType="number-pad"
        autoFocus
        maxLength={6}
        value={code}
        onChangeText={setCode}
        editable={!verificationEnCours}
      />

      {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}

      <Pressable
        style={[styles.bouton, verificationEnCours && styles.boutonDesactive]}
        onPress={verifierCode}
        disabled={verificationEnCours}
      >
        {verificationEnCours ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.texteBouton}>Se connecter</Text>
        )}
      </Pressable>

      <Pressable onPress={() => router.replace("/connexion/telephone")}>
        <Text style={styles.lienRetour}>Changer de numero</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  titre: {
    fontSize: 24,
    fontWeight: "700",
  },
  sousTitre: {
    fontSize: 15,
    color: "#555",
    marginBottom: 12,
  },
  champ: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    letterSpacing: 4,
  },
  erreur: {
    color: "#B3261E",
    fontSize: 14,
  },
  bouton: {
    backgroundColor: "#0F4C5C",
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  boutonDesactive: {
    opacity: 0.6,
  },
  texteBouton: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  lienRetour: {
    textAlign: "center",
    marginTop: 16,
    color: "#0F4C5C",
    fontSize: 14,
  },
});
