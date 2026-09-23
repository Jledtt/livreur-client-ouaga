import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Redirect, router } from "expo-router";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session-provider";
import type { Course, Zone } from "../lib/types";

export default function CoursesDisponibles() {
  const { session } = useSession();
  const [statutLivreur, setStatutLivreur] = useState<string | null | undefined>(undefined);
  const [courseEnCours, setCourseEnCours] = useState<boolean | undefined>(undefined);
  const [zones, setZones] = useState<Record<number, string>>({});
  const [courses, setCourses] = useState<Course[]>([]);
  const [chargement, setChargement] = useState(true);
  const [acceptationEnCours, setAcceptationEnCours] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!session) return;
    setChargement(true);

    const { data: courseActive } = await supabase
      .from("courses")
      .select("id")
      .eq("livreur_id", session.user.id)
      .in("statut", ["acceptee", "colis_recupere"])
      .maybeSingle();
    setCourseEnCours(!!courseActive);

    if (courseActive) {
      setChargement(false);
      return;
    }

    const [{ data: zonesData }, { data: coursesData }] = await Promise.all([
      supabase.from("zones").select("id, nom"),
      supabase.from("courses").select("*").eq("statut", "publiee").order("publiee_le"),
    ]);

    setZones(Object.fromEntries(((zonesData as Zone[]) ?? []).map((z) => [z.id, z.nom])));
    setCourses((coursesData as Course[]) ?? []);
    setChargement(false);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("livreurs")
      .select("statut")
      .eq("utilisateur_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => setStatutLivreur(data?.statut ?? null));
  }, [session]);

  useEffect(() => {
    if (statutLivreur === "valide") {
      Promise.resolve().then(() => charger());
    }
  }, [statutLivreur, charger]);

  // Le temps reel est un confort : il rafraichit la liste quand l'app est
  // ouverte et le reseau tient. Le rafraichissement manuel (pull-to-refresh)
  // reste toujours disponible (7.2, 8.1).
  useEffect(() => {
    if (statutLivreur !== "valide" || courseEnCours) return;

    const canal = supabase
      .channel("courses-publiees")
      .on("postgres_changes", { event: "*", schema: "public", table: "courses" }, () => {
        charger();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [statutLivreur, courseEnCours, charger]);

  async function accepter(courseId: string) {
    setAcceptationEnCours(courseId);
    const { error } = await supabase.rpc("accepter_course", { p_course_id: courseId });
    setAcceptationEnCours(null);

    if (error) {
      Alert.alert("Impossible d'accepter", error.message ?? "Reessayez.");
      charger();
      return;
    }

    router.replace("/course-en-cours");
  }

  if (statutLivreur === undefined) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator />
      </View>
    );
  }

  if (statutLivreur !== "valide") {
    return (
      <View style={styles.centre}>
        <Text style={styles.message}>
          {statutLivreur === "en_attente"
            ? "Votre inscription est en cours d'examen."
            : "Vous devez etre un livreur valide pour voir les courses disponibles."}
        </Text>
      </View>
    );
  }

  if (courseEnCours) {
    return <Redirect href="/course-en-cours" />;
  }

  return (
    <View style={styles.conteneur}>
      <Text style={styles.titre}>Courses disponibles</Text>

      <FlatList
        data={courses}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={chargement} onRefresh={charger} />}
        contentContainerStyle={styles.liste}
        ListEmptyComponent={
          !chargement ? <Text style={styles.vide}>Aucune course disponible pour le moment.</Text> : null
        }
        renderItem={({ item }) => (
          <View style={styles.carte}>
            <View style={styles.carteEntete}>
              <Text style={styles.trajet}>
                {zones[item.zone_depart_id] ?? "?"} → {zones[item.zone_arrivee_id] ?? "?"}
              </Text>
              <Text style={styles.tarif}>{item.tarif.toLocaleString("fr-FR")} FCFA</Text>
            </View>
            <Text style={styles.details}>
              {item.nature_colis}
              {item.description_colis ? ` — ${item.description_colis}` : ""}
            </Text>
            {item.montant_marchandise > 0 ? (
              <Text style={styles.details}>
                Encaissement marchandise : {item.montant_marchandise.toLocaleString("fr-FR")} FCFA
              </Text>
            ) : null}

            <Pressable
              style={styles.bouton}
              onPress={() => accepter(item.id)}
              disabled={acceptationEnCours === item.id}
            >
              {acceptationEnCours === item.id ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.texteBouton}>Accepter</Text>
              )}
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, paddingTop: 12 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  message: { textAlign: "center", color: "#555", fontSize: 15 },
  titre: { fontSize: 22, fontWeight: "700", paddingHorizontal: 24, marginBottom: 12 },
  liste: { paddingHorizontal: 24, paddingBottom: 40, gap: 12 },
  vide: { textAlign: "center", color: "#999", marginTop: 40 },
  carte: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 10,
    padding: 14,
    gap: 4,
  },
  carteEntete: { flexDirection: "row", justifyContent: "space-between" },
  trajet: { fontSize: 15, fontWeight: "600" },
  tarif: { fontSize: 15, fontWeight: "600", color: "#0F4C5C" },
  details: { fontSize: 13, color: "#555" },
  bouton: {
    backgroundColor: "#0F4C5C",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 8,
  },
  texteBouton: { color: "#fff", fontWeight: "600" },
});
