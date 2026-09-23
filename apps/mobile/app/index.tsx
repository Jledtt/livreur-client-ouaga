import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { useSession } from "../lib/session-provider";

export default function Index() {
  const { session, chargement } = useSession();

  if (chargement) {
    return (
      <View style={styles.conteneur}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Redirect href={session ? "/accueil" : "/connexion/telephone"} />;
}

const styles = StyleSheet.create({
  conteneur: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
