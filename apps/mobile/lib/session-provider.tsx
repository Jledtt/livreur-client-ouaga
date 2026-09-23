import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type SessionContextValue = {
  session: Session | null;
  chargement: boolean;
};

const SessionContext = createContext<SessionContextValue>({ session: null, chargement: true });

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChargement(false);
    });

    const { data: abonnement } = supabase.auth.onAuthStateChange((_evenement, nouvelleSession) => {
      setSession(nouvelleSession);
    });

    return () => abonnement.subscription.unsubscribe();
  }, []);

  return <SessionContext.Provider value={{ session, chargement }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
