import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session-provider";
import type { Course, Zone } from "../lib/types";

const LIBELLES_STATUT: Record<Course["statut"], string> = {
  publiee: "En attente d'un livreur",
  acceptee: "Livreur en route",
  colis_recupere: "Colis recupere, en livraison",
  livree: "Livree",
  annulee: "Annulee",
  echouee: "Echouee",
  a_verifier: "A verifier",
};

type LivreurAssigne = { nom_complet: string | null; note_moyenne: number | null; nb_livraisons: number };

export default function MesEnvois() {
  const { session } = useSession();
  const [zones, setZones] = useState<Record<number, string>>({});
  const [courses, setCourses] = useState<Course[]>([]);
  const [livreurs, setLivreurs] = useState<Record<string, LivreurAssigne>>({});
  const [chargement, setChargement] = useState(true);
  const [erreurChargement, setErreurChargement] = useState(false);

  const charger = useCallback(async () => {
    if (!session) return;
    setChargement(true);
    setErreurChargement(false);

    const [{ data: zonesData }, { data: coursesData, error: erreurCourses }] = await Promise.all([
      supabase.from("zones").select("id, nom"),
      supabase
        .from("courses")
        .select("*")
        .eq("expediteur_id", session.user.id)
        .order("publiee_le", { ascending: false }),
    ]);

    if (erreurCourses) {
      setErreurChargement(true);
      setChargement(false);
      return;
    }

    setZones(Object.fromEntries(((zonesData as Zone[]) ?? []).map((z) => [z.id, z.nom])));
    const listeCourses = (coursesData as Course[]) ?? [];
    setCourses(listeCourses);

    const idsLivreurs = [...new Set(listeCourses.map((c) => c.livreur_id).filter(Boolean))] as string[];
    if (idsLivreurs.length > 0) {
      const [{ data: utilisateursData }, { data: livreursData }] = await Promise.all([
        supabase.from("utilisateurs").select("id, nom_complet").in("id", idsLivreurs),
        supabase.from("livreurs").select("utilisateur_id, note_moyenne, nb_livraisons").in("utilisateur_id", idsLivreurs),
      ]);

      const noms = Object.fromEntries(
        ((utilisateursData as { id: string; nom_complet: string | null }[]) ?? []).map((u) => [u.id, u.nom_complet]),
      );

      const infos: Record<string, LivreurAssigne> = {};
      for (const l of (livreursData as { utilisateur_id: string; note_moyenne: number | null; nb_livraisons: number }[]) ?? []) {
        infos[l.utilisateur_id] = {
          nom_complet: noms[l.utilisateur_id] ?? null,
          note_moyenne: l.note_moyenne,
          nb_livraisons: l.nb_livraisons,
        };
      }
      setLivreurs(infos);
    }

    setChargement(false);
  }, [session]);

  useEffect(() => {
    Promise.resolve().then(() => charger());
  }, [charger]);

  async function annuler(courseId: string) {
    const { error } = await supabase.rpc("annuler_course", { p_course_id: courseId });
    if (error) {
      Alert.alert("Erreur", "Impossible d'annuler cette course.");
      return;
    }
    charger();
  }

  return (
    <View style={styles.conteneur}>
      <View style={styles.entete}>
        <Text style={styles.titre}>Mes envois</Text>
        <Pressable onPress={() => router.push("/publier-course")}>
          <Text style={styles.lienNouveau}>+ Nouveau</Text>
        </Pressable>
      </View>

      {erreurChargement ? (
        <Pressable onPress={charger}>
          <Text style={styles.erreurChargement}>
            Impossible de charger vos envois. Toucher pour reessayer.
          </Text>
        </Pressable>
      ) : null}

      <FlatList
        data={courses}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={chargement} onRefresh={charger} />}
        contentContainerStyle={styles.liste}
        ListEmptyComponent={
          !chargement && !erreurChargement ? (
            <Text style={styles.vide}>Aucun envoi pour le moment.</Text>
          ) : null
        }
        renderItem={({ item }) => {
          const livreur = item.livreur_id ? livreurs[item.livreur_id] : null;
          return (
            <View style={styles.carte}>
              <View style={styles.carteEntete}>
                <Text style={styles.trajet}>
                  {zones[item.zone_depart_id] ?? "?"} → {zones[item.zone_arrivee_id] ?? "?"}
                </Text>
                <Text style={styles.tarif}>{item.tarif.toLocaleString("fr-FR")} FCFA</Text>
              </View>
              <Text style={styles.statut}>{LIBELLES_STATUT[item.statut]}</Text>

              {livreur ? (
                <Text style={styles.livreurInfo}>
                  Livreur : {livreur.nom_complet ?? "?"}
                  {livreur.note_moyenne ? ` · ${livreur.note_moyenne}/5` : ""} ·{" "}
                  {livreur.nb_livraisons} livraison{livreur.nb_livraisons > 1 ? "s" : ""}
                </Text>
              ) : null}

              {item.code_retrait ? (
                <Text style={styles.code}>Code de retrait : {item.code_retrait}</Text>
              ) : null}

              {item.statut === "publiee" ? (
                <Pressable onPress={() => annuler(item.id)}>
                  <Text style={styles.lienAnnuler}>Annuler cet envoi</Text>
                </Pressable>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, paddingTop: 12 },
  entete: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  titre: { fontSize: 22, fontWeight: "700" },
  lienNouveau: { color: "#0F4C5C", fontWeight: "600" },
  liste: { paddingHorizontal: 24, paddingBottom: 40, gap: 12 },
  vide: { textAlign: "center", color: "#999", marginTop: 40 },
  erreurChargement: { color: "#B3261E", fontSize: 13, paddingHorizontal: 24, marginBottom: 12 },
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
  statut: { fontSize: 13, color: "#555" },
  livreurInfo: { fontSize: 13, color: "#555" },
  code: { fontSize: 14, fontWeight: "600", marginTop: 4 },
  lienAnnuler: { fontSize: 13, color: "#B3261E", marginTop: 6 },
});
