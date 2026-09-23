import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect, router } from "expo-router";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session-provider";

type StatutLivreur = "en_attente" | "valide" | "rejete" | "suspendu";

type FicheLivreur = {
  statut: StatutLivreur;
  motif_statut: string | null;
} | null;

const LIBELLES_STATUT: Record<StatutLivreur, string> = {
  en_attente: "Votre inscription est en cours d'examen par un administrateur.",
  valide: "Compte livreur valide.",
  rejete: "Votre inscription a ete rejetee.",
  suspendu: "Votre compte livreur est suspendu.",
};

export default function Accueil() {
  const { session, chargement } = useSession();
  const [fiche, setFiche] = useState<FicheLivreur>(null);
  const [chargementFiche, setChargementFiche] = useState(true);

  useEffect(() => {
    if (!session) {
      Promise.resolve().then(() => setChargementFiche(false));
      return;
    }

    supabase
      .from("livreurs")
      .select("statut, motif_statut")
      .eq("utilisateur_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setFiche(data as FicheLivreur);
        setChargementFiche(false);
      });
  }, [session]);

  if (!chargement && !session) {
    return <Redirect href="/connexion/telephone" />;
  }

  return (
    <View style={styles.conteneur}>
      <Text style={styles.titre}>Connecte</Text>
      <Text style={styles.sousTitre}>{session?.user.phone}</Text>

      {chargementFiche ? (
        <ActivityIndicator style={{ marginTop: 16 }} />
      ) : fiche ? (
        <View style={styles.blocStatut}>
          <Text style={styles.texteStatut}>{LIBELLES_STATUT[fiche.statut]}</Text>
          {fiche.statut === "rejete" && fiche.motif_statut ? (
            <Text style={styles.motif}>Motif : {fiche.motif_statut}</Text>
          ) : null}
          {fiche.statut === "rejete" ? (
            <Pressable
              style={styles.boutonSecondaire}
              onPress={() => router.push("/inscription-livreur")}
            >
              <Text style={styles.texteBoutonSecondaire}>Soumettre une nouvelle inscription</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <Pressable
          style={styles.boutonSecondaire}
          onPress={() => router.push("/inscription-livreur")}
        >
          <Text style={styles.texteBoutonSecondaire}>Devenir livreur</Text>
        </Pressable>
      )}

      <Pressable style={styles.boutonSecondaire} onPress={() => router.push("/publier-course")}>
        <Text style={styles.texteBoutonSecondaire}>Envoyer un colis</Text>
      </Pressable>

      <Pressable style={styles.bouton} onPress={() => router.push("/mes-envois")}>
        <Text style={styles.texteBouton}>Mes envois</Text>
      </Pressable>

      {fiche?.statut === "valide" ? (
        <Pressable style={styles.bouton} onPress={() => router.push("/courses-disponibles")}>
          <Text style={styles.texteBouton}>Courses disponibles</Text>
        </Pressable>
      ) : null}

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
  blocStatut: {
    marginTop: 16,
    marginBottom: 16,
    gap: 8,
  },
  texteStatut: {
    fontSize: 15,
    color: "#333",
  },
  motif: {
    fontSize: 14,
    color: "#B3261E",
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
  boutonSecondaire: {
    backgroundColor: "#0F4C5C",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  texteBoutonSecondaire: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
