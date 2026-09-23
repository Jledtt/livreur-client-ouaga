import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session-provider";
import CarteEnvoi from "../components/carte-envoi";
import type { Course, Zone } from "../lib/types";

type LivreurAssigne = { nom_complet: string | null; note_moyenne: number | null; nb_livraisons: number };
type Notation = { course_id: string; note: number; commentaire: string | null };

export default function MesEnvois() {
  const { session } = useSession();
  const [zones, setZones] = useState<Record<number, string>>({});
  const [courses, setCourses] = useState<Course[]>([]);
  const [livreurs, setLivreurs] = useState<Record<string, LivreurAssigne>>({});
  const [notations, setNotations] = useState<Record<string, Notation>>({});
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

    const idsCourses = listeCourses.map((c) => c.id);
    const idsLivreurs = [...new Set(listeCourses.map((c) => c.livreur_id).filter(Boolean))] as string[];

    const [reponseLivreurs, reponseNotations] = await Promise.all([
      idsLivreurs.length > 0
        ? Promise.all([
            supabase.from("utilisateurs").select("id, nom_complet").in("id", idsLivreurs),
            supabase
              .from("livreurs")
              .select("utilisateur_id, note_moyenne, nb_livraisons")
              .in("utilisateur_id", idsLivreurs),
          ])
        : null,
      idsCourses.length > 0
        ? supabase.from("notations").select("course_id, note, commentaire").in("course_id", idsCourses)
        : null,
    ]);

    if (reponseLivreurs) {
      const [{ data: utilisateursData }, { data: livreursData }] = reponseLivreurs;
      const noms = Object.fromEntries(
        ((utilisateursData as { id: string; nom_complet: string | null }[]) ?? []).map((u) => [
          u.id,
          u.nom_complet,
        ]),
      );

      const infos: Record<string, LivreurAssigne> = {};
      for (const l of (livreursData as
        | { utilisateur_id: string; note_moyenne: number | null; nb_livraisons: number }[]
        | null) ?? []) {
        infos[l.utilisateur_id] = {
          nom_complet: noms[l.utilisateur_id] ?? null,
          note_moyenne: l.note_moyenne,
          nb_livraisons: l.nb_livraisons,
        };
      }
      setLivreurs(infos);
    }

    if (reponseNotations) {
      const { data: notationsData } = reponseNotations;
      setNotations(
        Object.fromEntries(((notationsData as Notation[]) ?? []).map((n) => [n.course_id, n])),
      );
    }

    setChargement(false);
  }, [session]);

  useEffect(() => {
    Promise.resolve().then(() => charger());
  }, [charger]);

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
        renderItem={({ item }) => (
          <CarteEnvoi
            course={item}
            zoneDepart={zones[item.zone_depart_id] ?? "?"}
            zoneArrivee={zones[item.zone_arrivee_id] ?? "?"}
            livreur={item.livreur_id ? livreurs[item.livreur_id] ?? null : null}
            notation={notations[item.id] ?? null}
            onChange={charger}
          />
        )}
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
});
