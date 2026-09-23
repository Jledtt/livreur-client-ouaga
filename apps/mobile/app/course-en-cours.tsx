import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session-provider";
import type { Course, Zone } from "../lib/types";

type Expediteur = { nom_complet: string | null; telephone: string };
type Supplement = { motif: string; montant: number };

export default function CourseEnCours() {
  const { session } = useSession();
  const [course, setCourse] = useState<Course | null | undefined>(undefined);
  const [zones, setZones] = useState<Record<number, string>>({});
  const [expediteur, setExpediteur] = useState<Expediteur | null>(null);
  const [bareme, setBareme] = useState<Supplement[]>([]);

  const [codeRetrait, setCodeRetrait] = useState("");
  const [motifEchec, setMotifEchec] = useState("");
  const [actionEnCours, setActionEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!session) return;

    const { data } = await supabase
      .from("courses")
      .select("*")
      .eq("livreur_id", session.user.id)
      .in("statut", ["acceptee", "colis_recupere"])
      .maybeSingle();

    const courseActive = data as Course | null;
    setCourse(courseActive);

    if (!courseActive) return;

    const [{ data: zonesData }, { data: expediteurData }, { data: baremeData }] = await Promise.all([
      supabase.from("zones").select("id, nom"),
      supabase
        .from("utilisateurs")
        .select("nom_complet, telephone")
        .eq("id", courseActive.expediteur_id)
        .maybeSingle(),
      supabase.from("bareme_supplements").select("motif, montant").eq("actif", true),
    ]);

    setZones(Object.fromEntries(((zonesData as Zone[]) ?? []).map((z) => [z.id, z.nom])));
    setExpediteur((expediteurData as Expediteur) ?? null);
    setBareme((baremeData as Supplement[]) ?? []);
  }, [session]);

  useEffect(() => {
    Promise.resolve().then(() => charger());
  }, [charger]);

  async function recupererColis() {
    if (!course) return;
    setActionEnCours(true);
    const { error } = await supabase.rpc("recuperer_colis", { p_course_id: course.id });
    setActionEnCours(false);
    if (error) {
      Alert.alert("Erreur", "Impossible de marquer le colis comme recupere.");
      return;
    }
    charger();
  }

  async function declarerSupplement(motif: string) {
    if (!course) return;
    setActionEnCours(true);
    const { error } = await supabase.rpc("declarer_supplement", {
      p_course_id: course.id,
      p_motif: motif,
    });
    setActionEnCours(false);
    if (error) {
      Alert.alert("Erreur", "Impossible de declarer ce supplement.");
      return;
    }
    charger();
  }

  async function confirmerLivraison() {
    if (!course) return;
    if (codeRetrait.trim().length !== 4) {
      setErreur("Le code de retrait comporte quatre chiffres.");
      return;
    }
    setErreur(null);
    setActionEnCours(true);
    const { error } = await supabase.rpc("livrer_course", {
      p_course_id: course.id,
      p_code_retrait: codeRetrait.trim(),
    });
    setActionEnCours(false);

    if (error) {
      setErreur("Code incorrect. Reessayez.");
      return;
    }

    router.replace("/courses-disponibles");
  }

  async function declarerEchec() {
    if (!course) return;
    if (motifEchec.trim().length === 0) {
      setErreur("Le motif d'echec est obligatoire.");
      return;
    }
    setErreur(null);
    setActionEnCours(true);
    const { error } = await supabase.rpc("declarer_echec_course", {
      p_course_id: course.id,
      p_motif: motifEchec.trim(),
    });
    setActionEnCours(false);

    if (error) {
      Alert.alert("Erreur", "Impossible de declarer l'echec.");
      return;
    }

    router.replace("/courses-disponibles");
  }

  if (course === undefined) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator />
      </View>
    );
  }

  if (course === null) {
    return (
      <View style={styles.centre}>
        <Text style={styles.message}>Aucune course en cours.</Text>
        <Pressable onPress={() => router.replace("/courses-disponibles")}>
          <Text style={styles.lien}>Voir les courses disponibles</Text>
        </Pressable>
      </View>
    );
  }

  const montantAEncaisser = course.tarif + course.montant_marchandise;

  return (
    <ScrollView contentContainerStyle={styles.contenu}>
      <Text style={styles.titre}>
        {zones[course.zone_depart_id] ?? "?"} → {zones[course.zone_arrivee_id] ?? "?"}
      </Text>

      <View style={styles.bloc}>
        <Text style={styles.libelle}>Expediteur</Text>
        <Text style={styles.valeur}>{expediteur?.nom_complet ?? "?"}</Text>
        <Text style={styles.valeur}>{expediteur?.telephone}</Text>
      </View>

      <View style={styles.bloc}>
        <Text style={styles.libelle}>Colis</Text>
        <Text style={styles.valeur}>
          {course.nature_colis}
          {course.description_colis ? ` — ${course.description_colis}` : ""}
        </Text>
      </View>

      <View style={styles.bloc}>
        <Text style={styles.libelle}>Montant a encaisser a la remise</Text>
        <Text style={styles.montant}>{montantAEncaisser.toLocaleString("fr-FR")} FCFA</Text>
        <Text style={styles.details}>
          ({course.tarif.toLocaleString("fr-FR")} transport
          {course.montant_marchandise > 0
            ? ` + ${course.montant_marchandise.toLocaleString("fr-FR")} marchandise`
            : ""}
          )
        </Text>
      </View>

      {course.statut === "acceptee" ? (
        <Pressable style={styles.bouton} onPress={recupererColis} disabled={actionEnCours}>
          <Text style={styles.texteBouton}>Colis recupere</Text>
        </Pressable>
      ) : null}

      {course.statut === "colis_recupere" ? (
        <>
          <View style={styles.bloc}>
            <Text style={styles.libelle}>Declarer un supplement</Text>
            <View style={styles.rangeeChips}>
              {bareme.map((s) => (
                <Pressable
                  key={s.motif}
                  style={styles.chip}
                  onPress={() => declarerSupplement(s.motif)}
                  disabled={actionEnCours}
                >
                  <Text style={styles.texteChip}>
                    {s.motif} (+{s.montant} FCFA)
                  </Text>
                </Pressable>
              ))}
              {bareme.length === 0 ? (
                <Text style={styles.details}>Aucun motif de supplement configure.</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.bloc}>
            <Text style={styles.libelle}>Code de retrait communique par le destinataire</Text>
            <TextInput
              style={styles.champ}
              value={codeRetrait}
              onChangeText={setCodeRetrait}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="0000"
            />
          </View>

          {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}

          <Pressable style={styles.bouton} onPress={confirmerLivraison} disabled={actionEnCours}>
            {actionEnCours ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.texteBouton}>Confirmer la livraison</Text>
            )}
          </Pressable>

          <View style={styles.bloc}>
            <Text style={styles.libelle}>La course ne peut pas aboutir ?</Text>
            <TextInput
              style={styles.champ}
              value={motifEchec}
              onChangeText={setMotifEchec}
              placeholder="Motif de l'echec"
            />
            <Pressable style={styles.boutonSecondaire} onPress={declarerEchec} disabled={actionEnCours}>
              <Text style={styles.texteBoutonSecondaire}>Declarer un echec</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  message: { color: "#555", fontSize: 15 },
  lien: { color: "#0F4C5C", fontWeight: "600" },
  contenu: { padding: 24, gap: 16, paddingBottom: 60 },
  titre: { fontSize: 20, fontWeight: "700" },
  bloc: { gap: 4 },
  libelle: { fontSize: 13, fontWeight: "600", color: "#555" },
  valeur: { fontSize: 15 },
  montant: { fontSize: 24, fontWeight: "700", color: "#0F4C5C" },
  details: { fontSize: 13, color: "#777" },
  rangeeChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  texteChip: { fontSize: 13 },
  champ: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginTop: 4,
  },
  erreur: { color: "#B3261E", fontSize: 14 },
  bouton: {
    backgroundColor: "#0F4C5C",
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
  },
  texteBouton: { color: "#fff", fontSize: 16, fontWeight: "600" },
  boutonSecondaire: {
    borderWidth: 1,
    borderColor: "#B3261E",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  texteBoutonSecondaire: { color: "#B3261E", fontWeight: "600" },
});
