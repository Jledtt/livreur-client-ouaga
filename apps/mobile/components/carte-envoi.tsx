import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../lib/supabase";
import { MOTIFS_SIGNALEMENT } from "../lib/signalements";
import type { Course } from "../lib/types";

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
type Notation = { note: number; commentaire: string | null };

export default function CarteEnvoi({
  course,
  zoneDepart,
  zoneArrivee,
  livreur,
  notation,
  onChange,
}: {
  course: Course;
  zoneDepart: string;
  zoneArrivee: string;
  livreur: LivreurAssigne | null;
  notation: Notation | null;
  onChange: () => void;
}) {
  const [formulaireOuvert, setFormulaireOuvert] = useState<"note" | "contestation" | "signalement" | null>(
    null,
  );
  const [noteChoisie, setNoteChoisie] = useState(0);
  const [commentaire, setCommentaire] = useState("");
  const [motifContestation, setMotifContestation] = useState("");
  const [motifSignalement, setMotifSignalement] = useState<string | null>(null);
  const [descriptionSignalement, setDescriptionSignalement] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function annuler() {
    const { error } = await supabase.rpc("annuler_course", { p_course_id: course.id });
    if (error) {
      Alert.alert("Erreur", "Impossible d'annuler cette course.");
      return;
    }
    onChange();
  }

  async function envoyerNotation() {
    if (noteChoisie < 1) return;
    setEnCours(true);
    const { error } = await supabase
      .from("notations")
      .insert({ course_id: course.id, note: noteChoisie, commentaire: commentaire.trim() || null });
    setEnCours(false);

    if (error) {
      Alert.alert("Erreur", "Impossible d'enregistrer votre note.");
      return;
    }
    setFormulaireOuvert(null);
    onChange();
  }

  async function confirmerMarchandise(recue: boolean) {
    if (!recue) {
      setFormulaireOuvert("contestation");
      return;
    }
    setEnCours(true);
    const { error } = await supabase.rpc("confirmer_reversement_marchandise", {
      p_course_id: course.id,
      p_confirme: true,
    });
    setEnCours(false);

    if (error) {
      Alert.alert("Erreur", "Impossible d'enregistrer votre confirmation.");
      return;
    }
    onChange();
  }

  async function envoyerContestation() {
    if (motifContestation.trim().length === 0) return;
    setEnCours(true);
    const { error } = await supabase.rpc("confirmer_reversement_marchandise", {
      p_course_id: course.id,
      p_confirme: false,
      p_motif_contestation: motifContestation.trim(),
    });
    setEnCours(false);

    if (error) {
      Alert.alert("Erreur", "Impossible d'enregistrer votre contestation.");
      return;
    }
    setFormulaireOuvert(null);
    Alert.alert("Signalement envoye", "Le livreur a ete suspendu en attendant verification.");
    onChange();
  }

  async function envoyerSignalement() {
    if (!motifSignalement) return;
    setEnCours(true);
    const { error } = await supabase.from("signalements").insert({
      course_id: course.id,
      auteur: "expediteur",
      motif: motifSignalement,
      description: descriptionSignalement.trim() || null,
    });
    setEnCours(false);

    if (error) {
      Alert.alert("Erreur", "Impossible d'envoyer le signalement.");
      return;
    }
    setFormulaireOuvert(null);
    setMotifSignalement(null);
    setDescriptionSignalement("");
    Alert.alert("Signalement envoye", "Merci, votre signalement a ete transmis.");
  }

  const proposerNotation = course.statut === "livree" && !notation;
  const proposerMarchandise =
    course.statut === "livree" && course.montant_marchandise > 0 && course.marchandise_confirmee === null;
  const peutSignaler = course.statut !== "publiee" && course.statut !== "annulee";

  return (
    <View style={styles.carte}>
      <View style={styles.carteEntete}>
        <Text style={styles.trajet}>
          {zoneDepart} → {zoneArrivee}
        </Text>
        <Text style={styles.tarif}>{course.tarif.toLocaleString("fr-FR")} FCFA</Text>
      </View>
      <Text style={styles.statut}>{LIBELLES_STATUT[course.statut]}</Text>

      {livreur ? (
        <Text style={styles.livreurInfo}>
          Livreur : {livreur.nom_complet ?? "?"}
          {livreur.note_moyenne ? ` · ${livreur.note_moyenne}/5` : ""} · {livreur.nb_livraisons} livraison
          {livreur.nb_livraisons > 1 ? "s" : ""}
        </Text>
      ) : null}

      {course.code_retrait ? <Text style={styles.code}>Code de retrait : {course.code_retrait}</Text> : null}

      {course.statut === "publiee" ? (
        <Pressable onPress={annuler}>
          <Text style={styles.lienAnnuler}>Annuler cet envoi</Text>
        </Pressable>
      ) : null}

      {course.montant_marchandise > 0 && course.marchandise_confirmee === true ? (
        <Text style={styles.confirmation}>Marchandise recue, confirme</Text>
      ) : null}
      {course.montant_marchandise > 0 && course.marchandise_confirmee === false ? (
        <Text style={styles.contestationTexte}>Reversement conteste — livreur suspendu en attente de verification</Text>
      ) : null}

      {proposerMarchandise && formulaireOuvert !== "contestation" ? (
        <View style={styles.bloc}>
          <Text style={styles.question}>
            Avez-vous recu les {course.montant_marchandise.toLocaleString("fr-FR")} FCFA de marchandise ?
          </Text>
          <View style={styles.rangeeBoutons}>
            <Pressable style={styles.boutonSecondaire} onPress={() => confirmerMarchandise(true)} disabled={enCours}>
              <Text style={styles.texteBoutonSecondaire}>Oui, recu</Text>
            </Pressable>
            <Pressable style={styles.boutonDanger} onPress={() => confirmerMarchandise(false)} disabled={enCours}>
              <Text style={styles.texteBoutonDanger}>Non</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {formulaireOuvert === "contestation" ? (
        <View style={styles.bloc}>
          <Text style={styles.question}>Expliquez ce qui s&apos;est passe</Text>
          <TextInput
            style={styles.champ}
            value={motifContestation}
            onChangeText={setMotifContestation}
            placeholder="Le livreur n'a rien remis..."
          />
          <View style={styles.rangeeBoutons}>
            <Pressable style={styles.boutonDanger} onPress={envoyerContestation} disabled={enCours}>
              <Text style={styles.texteBoutonDanger}>Envoyer le signalement</Text>
            </Pressable>
            <Pressable onPress={() => setFormulaireOuvert(null)}>
              <Text style={styles.lienAnnuler}>Annuler</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {notation ? (
        <Text style={styles.confirmation}>Votre note : {notation.note}/5</Text>
      ) : proposerNotation ? (
        formulaireOuvert === "note" ? (
          <View style={styles.bloc}>
            <Text style={styles.question}>Notez ce livreur</Text>
            <View style={styles.rangeeBoutons}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable
                  key={n}
                  style={[styles.etoile, noteChoisie >= n && styles.etoileSelectionnee]}
                  onPress={() => setNoteChoisie(n)}
                >
                  <Text style={[styles.texteEtoile, noteChoisie >= n && styles.texteEtoileSelectionnee]}>
                    {n}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.champ}
              value={commentaire}
              onChangeText={setCommentaire}
              placeholder="Commentaire (optionnel)"
            />
            <Pressable
              style={styles.boutonSecondaire}
              onPress={envoyerNotation}
              disabled={enCours || noteChoisie < 1}
            >
              <Text style={styles.texteBoutonSecondaire}>Envoyer la note</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setFormulaireOuvert("note")}>
            <Text style={styles.lienAction}>Noter ce livreur</Text>
          </Pressable>
        )
      ) : null}

      {peutSignaler ? (
        formulaireOuvert === "signalement" ? (
          <View style={styles.bloc}>
            <Text style={styles.question}>Motif du signalement</Text>
            <View style={styles.rangeeChips}>
              {MOTIFS_SIGNALEMENT.map((motif) => (
                <Pressable
                  key={motif}
                  style={[styles.chip, motifSignalement === motif && styles.chipSelectionne]}
                  onPress={() => setMotifSignalement(motif)}
                >
                  <Text style={[styles.texteChip, motifSignalement === motif && styles.texteChipSelectionne]}>
                    {motif}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.champ}
              value={descriptionSignalement}
              onChangeText={setDescriptionSignalement}
              placeholder="Details (optionnel)"
            />
            <View style={styles.rangeeBoutons}>
              <Pressable
                style={styles.boutonDanger}
                onPress={envoyerSignalement}
                disabled={enCours || !motifSignalement}
              >
                <Text style={styles.texteBoutonDanger}>Envoyer</Text>
              </Pressable>
              <Pressable onPress={() => setFormulaireOuvert(null)}>
                <Text style={styles.lienAnnuler}>Annuler</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => setFormulaireOuvert("signalement")}>
            <Text style={styles.lienAction}>Signaler un probleme</Text>
          </Pressable>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
  lienAction: { fontSize: 13, color: "#0F4C5C", fontWeight: "600", marginTop: 8 },
  confirmation: { fontSize: 13, color: "#1B7A3D", marginTop: 4 },
  contestationTexte: { fontSize: 13, color: "#B3261E", marginTop: 4 },
  bloc: { marginTop: 8, gap: 8 },
  question: { fontSize: 13, fontWeight: "600" },
  rangeeBoutons: { flexDirection: "row", gap: 10, alignItems: "center" },
  rangeeChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipSelectionne: { backgroundColor: "#0F4C5C", borderColor: "#0F4C5C" },
  texteChip: { fontSize: 12, color: "#333" },
  texteChipSelectionne: { color: "#fff" },
  champ: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  boutonSecondaire: {
    backgroundColor: "#0F4C5C",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  texteBoutonSecondaire: { color: "#fff", fontWeight: "600", fontSize: 13 },
  boutonDanger: {
    backgroundColor: "#B3261E",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  texteBoutonDanger: { color: "#fff", fontWeight: "600", fontSize: 13 },
  etoile: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#ccc",
    alignItems: "center",
    justifyContent: "center",
  },
  etoileSelectionnee: { backgroundColor: "#0F4C5C", borderColor: "#0F4C5C" },
  texteEtoile: { fontSize: 14, color: "#333" },
  texteEtoileSelectionnee: { color: "#fff" },
});
