import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session-provider";
import { televerserPieceIdentite, type TypePiece } from "../lib/pieces-identite";

type Photos = Partial<Record<TypePiece, string>>;

const LIBELLES: Record<TypePiece, { titre: string; consigne: string }> = {
  recto: { titre: "Piece d'identite (recto)", consigne: "Photographiez le recto de votre piece." },
  verso: { titre: "Piece d'identite (verso)", consigne: "Photographiez le verso de votre piece." },
  selfie: {
    titre: "Selfie avec la piece",
    consigne: "Prenez-vous en photo en tenant votre piece a cote de votre visage.",
  },
};

export default function InscriptionLivreur() {
  const { session } = useSession();
  const [nomComplet, setNomComplet] = useState("");
  const [plaque, setPlaque] = useState("");
  const [photos, setPhotos] = useState<Photos>({});
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function prendrePhoto(type: TypePiece) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setErreur("L'acces a l'appareil photo est necessaire pour cette etape.");
      return;
    }

    const resultat = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.5,
      base64: false,
    });

    if (!resultat.canceled && resultat.assets[0]) {
      setPhotos((precedent) => ({ ...precedent, [type]: resultat.assets[0].uri }));
    }
  }

  async function soumettre() {
    if (!session) return;

    if (nomComplet.trim().length === 0) {
      setErreur("Le nom complet est obligatoire.");
      return;
    }
    if (plaque.trim().length === 0) {
      setErreur("La plaque d'immatriculation est obligatoire.");
      return;
    }
    if (!photos.recto || !photos.verso || !photos.selfie) {
      setErreur("Les trois photos sont obligatoires.");
      return;
    }

    setErreur(null);
    setEnvoiEnCours(true);

    try {
      const utilisateurId = session.user.id;
      const [cheminRecto, cheminVerso, cheminSelfie] = await Promise.all([
        televerserPieceIdentite(utilisateurId, "recto", photos.recto),
        televerserPieceIdentite(utilisateurId, "verso", photos.verso),
        televerserPieceIdentite(utilisateurId, "selfie", photos.selfie),
      ]);

      const { error } = await supabase.rpc("soumettre_inscription_livreur", {
        p_nom_complet: nomComplet.trim(),
        p_plaque: plaque.trim(),
        p_piece_recto_url: cheminRecto,
        p_piece_verso_url: cheminVerso,
        p_selfie_url: cheminSelfie,
      });

      if (error) {
        throw error;
      }

      router.replace("/accueil");
    } catch (e) {
      setErreur("Une erreur est survenue. Verifiez votre connexion et reessayez.");
      console.error(e);
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.conteneur}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.titre}>Devenir livreur</Text>
        <Text style={styles.sousTitre}>
          Votre compte sera examine par un administrateur avant de pouvoir accepter des courses.
        </Text>

        <Text style={styles.libelleChamp}>Nom complet (comme sur la piece d'identite)</Text>
        <TextInput
          style={styles.champ}
          value={nomComplet}
          onChangeText={setNomComplet}
          editable={!envoiEnCours}
        />

        <Text style={styles.libelleChamp}>Plaque d'immatriculation</Text>
        <TextInput
          style={styles.champ}
          value={plaque}
          onChangeText={setPlaque}
          autoCapitalize="characters"
          editable={!envoiEnCours}
        />

        {(Object.keys(LIBELLES) as TypePiece[]).map((type) => (
          <View key={type} style={styles.blocPhoto}>
            <Text style={styles.libelleChamp}>{LIBELLES[type].titre}</Text>
            <Text style={styles.consigne}>{LIBELLES[type].consigne}</Text>
            {photos[type] ? (
              <Image source={{ uri: photos[type] }} style={styles.apercu} />
            ) : null}
            <Pressable
              style={styles.boutonSecondaire}
              onPress={() => prendrePhoto(type)}
              disabled={envoiEnCours}
            >
              <Text style={styles.texteBoutonSecondaire}>
                {photos[type] ? "Reprendre la photo" : "Prendre la photo"}
              </Text>
            </Pressable>
          </View>
        ))}

        {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}

        <Pressable
          style={[styles.bouton, envoiEnCours && styles.boutonDesactive]}
          onPress={soumettre}
          disabled={envoiEnCours}
        >
          {envoiEnCours ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.texteBouton}>Envoyer mon inscription</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    flex: 1,
  },
  contenu: {
    padding: 24,
    gap: 8,
  },
  titre: {
    fontSize: 22,
    fontWeight: "700",
  },
  sousTitre: {
    fontSize: 14,
    color: "#555",
    marginBottom: 16,
  },
  libelleChamp: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 12,
  },
  consigne: {
    fontSize: 13,
    color: "#777",
    marginBottom: 8,
  },
  champ: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  blocPhoto: {
    marginTop: 8,
  },
  apercu: {
    width: "100%",
    height: 180,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: "#eee",
  },
  boutonSecondaire: {
    borderWidth: 1,
    borderColor: "#0F4C5C",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  texteBoutonSecondaire: {
    color: "#0F4C5C",
    fontWeight: "600",
  },
  erreur: {
    color: "#B3261E",
    fontSize: 14,
    marginTop: 16,
  },
  bouton: {
    backgroundColor: "#0F4C5C",
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 20,
    marginBottom: 40,
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
