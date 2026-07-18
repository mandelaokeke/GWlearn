"use client";

import { useEffect, useMemo, useState } from "react";
import { browserAWSConfig, type BrowserAWSConfigInput } from "../packages/browser/aws-config";
import { restoreSession, signOut, type AuthenticatedSession } from "../packages/browser/cognito-auth";

function useProductSession(configurationInput: BrowserAWSConfigInput) {
  const configuration = useMemo(() => browserAWSConfig(configurationInput), [configurationInput]);
  const [session, setSession] = useState<AuthenticatedSession | null>(null);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    if (!configuration.configured) { setChecking(false); return; }
    restoreSession(configuration.value).then((value) => {
      setSession(value);
      if (!value) window.location.replace("/?signin=required#upload");
    }).finally(() => setChecking(false));
  }, [configuration]);
  return { checking, configuration, session };
}

export function ProductAuthGate({ configurationInput }: { configurationInput: BrowserAWSConfigInput }) {
  const { checking, configuration, session } = useProductSession(configurationInput);
  if (!checking && configuration.configured && session) return null;
  return <div className="app-auth-state app-auth-overlay"><span className="app-loader" /><p>{configuration.configured ? "Opening your GWLearn workspace…" : "GWLearn needs its AWS connection."}</p></div>;
}

export function ProductAccount({ configurationInput }: { configurationInput: BrowserAWSConfigInput }) {
  const { configuration, session } = useProductSession(configurationInput);
  if (!configuration.configured || !session) return <div />;
  return <div className="product-account"><span>{session.email}</span><button type="button" onClick={() => { signOut(configuration.value); window.location.replace("/"); }}>Sign out</button></div>;
}
