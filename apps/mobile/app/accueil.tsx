import { Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session-provider";

export default function Accueil() {
  const { session, chargement } = useSession();

  if (!chargement && !session) {
    return <Redirect href="/connexion/telephone" />;
  }

  return (
    <View style={styles.conteneur}>
      <Text style={styles.titre}>Connecte</Text>
      <Text style={styles.sousTitre}>{session?.user.phone}</Text>

      <Text style={styles.note}>
        Ecrans a venir (lot 0/1) : publication d'une course, inscription livreur, liste des
        courses disponibles.
      </Text>

      <Pressable style={styles.bouton} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.texteBouton}>Se deconnecter</Text>
      </Pressable>
    </View>
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
    fontSize: 16,
    color: "#555",
  },
  note: {
    fontSize: 14,
    color: "#777",
    marginTop: 16,
    marginBottom: 16,
  },
  bouton: {
    borderWidth: 1,
    borderColor: "#0F4C5C",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  texteBouton: {
    color: "#0F4C5C",
    fontSize: 16,
    fontWeight: "600",
  },
});
