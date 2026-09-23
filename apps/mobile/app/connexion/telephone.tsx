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
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";
import { normaliserTelephoneBurkina } from "../../lib/telephone";

export default function SaisieTelephone() {
  const [telephone, setTelephone] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function demanderCode() {
    const telephoneNormalise = normaliserTelephoneBurkina(telephone);
    if (!telephoneNormalise) {
      setErreur("Entrez un numero burkinabe valide (8 chiffres, avec ou sans +226).");
      return;
    }

    setErreur(null);
    setEnvoiEnCours(true);

    const { error } = await supabase.functions.invoke("demander-code-connexion", {
      body: { telephone: telephoneNormalise },
    });

    setEnvoiEnCours(false);

    if (error) {
      setErreur("Impossible d'envoyer le code. Verifiez votre connexion et reessayez.");
      return;
    }

    router.push({ pathname: "/connexion/code", params: { telephone: telephoneNormalise } });
  }

  return (
    <KeyboardAvoidingView
      style={styles.conteneur}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.titre}>Votre numero de telephone</Text>
      <Text style={styles.sousTitre}>
        Nous vous envoyons un code par SMS pour vous connecter. Pas de mot de passe.
      </Text>

      <TextInput
        style={styles.champ}
        placeholder="70 00 00 00"
        keyboardType="phone-pad"
        autoFocus
        value={telephone}
        onChangeText={setTelephone}
        editable={!envoiEnCours}
      />

      {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}

      <Pressable
        style={[styles.bouton, envoiEnCours && styles.boutonDesactive]}
        onPress={demanderCode}
        disabled={envoiEnCours}
      >
        {envoiEnCours ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.texteBouton}>Recevoir le code</Text>
        )}
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
});
