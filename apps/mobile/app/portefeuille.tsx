import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session-provider";

type Mouvement = {
  id: number;
  type: string;
  montant: number;
  date_effet: string;
  motif: string | null;
};

const LIBELLES_TYPE: Record<string, string> = {
  recharge: "Recharge",
  prelevement: "Prelevement",
  frais_notification: "Frais de notification",
  recredit_prelevement: "Recredit",
  recredit_frais: "Recredit (frais)",
  ajustement: "Ajustement administrateur",
};

export default function Portefeuille() {
  const { session } = useSession();
  const [solde, setSolde] = useState<number | null>(null);
  const [enAttente, setEnAttente] = useState(0);
  const [mouvements, setMouvements] = useState<Mouvement[]>([]);
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(async () => {
    if (!session) return;
    setChargement(true);

    const maintenant = new Date().toISOString();

    // Le montant "en attente" est calcule sur tous les mouvements futurs,
    // pas seulement sur les 50 derniers de l'historique affiche : un livreur
    // tres actif pourrait sinon faire sortir un recredit encore du a
    // echeance de cette fenetre.
    const [{ data: soldeData }, { data: mouvementsData }, { data: enAttenteData }] = await Promise.all([
      supabase.from("soldes_livreurs").select("solde_disponible").maybeSingle(),
      supabase
        .from("mouvements_credit")
        .select("id, type, montant, date_effet, motif")
        .eq("livreur_id", session.user.id)
        .order("cree_le", { ascending: false })
        .limit(50),
      supabase
        .from("mouvements_credit")
        .select("montant")
        .eq("livreur_id", session.user.id)
        .gt("date_effet", maintenant),
    ]);

    setSolde(soldeData?.solde_disponible ?? 0);
    setMouvements((mouvementsData as Mouvement[]) ?? []);
    setEnAttente(
      ((enAttenteData as { montant: number }[]) ?? []).reduce((total, m) => total + m.montant, 0),
    );
    setChargement(false);
  }, [session]);

  useEffect(() => {
    Promise.resolve().then(() => charger());
  }, [charger]);

  return (
    <View style={styles.conteneur}>
      <View style={styles.entete}>
        <Text style={styles.libelleSolde}>Solde disponible</Text>
        <Text style={[styles.solde, (solde ?? 0) < 0 && styles.soldeNegatif]}>
          {(solde ?? 0).toLocaleString("fr-FR")} FCFA
        </Text>
        {(solde ?? 0) < 0 ? (
          <Text style={styles.dette}>Dette a apurer a la prochaine recharge</Text>
        ) : null}
        {enAttente > 0 ? (
          <Text style={styles.attente}>
            + {enAttente.toLocaleString("fr-FR")} FCFA en attente (recredits programmes)
          </Text>
        ) : null}

        <Pressable style={styles.bouton} onPress={() => router.push("/recharger")}>
          <Text style={styles.texteBouton}>Recharger mon compte</Text>
        </Pressable>
      </View>

      <Text style={styles.titreHistorique}>Historique</Text>

      <FlatList
        data={mouvements}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={chargement} onRefresh={charger} />}
        contentContainerStyle={styles.liste}
        ListEmptyComponent={
          !chargement ? <Text style={styles.vide}>Aucun mouvement pour le moment.</Text> : null
        }
        renderItem={({ item }) => (
          <View style={styles.ligne}>
            <View>
              <Text style={styles.typeLigne}>{LIBELLES_TYPE[item.type] ?? item.type}</Text>
              {item.motif ? <Text style={styles.motifLigne}>{item.motif}</Text> : null}
              <Text style={styles.dateLigne}>
                {new Date(item.date_effet).toLocaleDateString("fr-FR")}
              </Text>
            </View>
            <Text style={[styles.montantLigne, item.montant < 0 && styles.montantNegatif]}>
              {item.montant > 0 ? "+" : ""}
              {item.montant.toLocaleString("fr-FR")} FCFA
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, paddingTop: 12 },
  entete: { paddingHorizontal: 24, marginBottom: 16 },
  libelleSolde: { fontSize: 14, color: "#555" },
  solde: { fontSize: 32, fontWeight: "700", color: "#0F4C5C" },
  soldeNegatif: { color: "#B3261E" },
  dette: { fontSize: 13, color: "#B3261E", marginTop: 2 },
  attente: { fontSize: 13, color: "#777", marginTop: 2 },
  bouton: {
    backgroundColor: "#0F4C5C",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  texteBouton: { color: "#fff", fontSize: 16, fontWeight: "600" },
  titreHistorique: { fontSize: 16, fontWeight: "700", paddingHorizontal: 24, marginBottom: 8 },
  liste: { paddingHorizontal: 24, paddingBottom: 40, gap: 10 },
  vide: { textAlign: "center", color: "#999", marginTop: 20 },
  ligne: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    paddingBottom: 10,
  },
  typeLigne: { fontSize: 14, fontWeight: "600" },
  motifLigne: { fontSize: 12, color: "#777" },
  dateLigne: { fontSize: 12, color: "#999", marginTop: 2 },
  montantLigne: { fontSize: 14, fontWeight: "600", color: "#0F4C5C" },
  montantNegatif: { color: "#B3261E" },
});
