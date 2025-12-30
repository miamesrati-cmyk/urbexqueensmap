import { auth, appCheck } from "../lib/firebase";
import { getToken } from "firebase/app-check";
import type { IntegrationHealthData } from "../types/integrationHealth";

export async function fetchIntegrationHealth(signal?: AbortSignal) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Authentification requise.");
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await user.getIdToken()}`,
  };
  if (appCheck) {
    const tokenResult = await getToken(appCheck);
    if (tokenResult?.token) {
      headers["X-Firebase-AppCheck"] = tokenResult.token;
    }
  }
  const response = await fetch("/api/admin/integrations/health", {
    method: "GET",
    headers,
    signal,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Erreur lors de la récupération");
  }
  return (await response.json()) as IntegrationHealthData;
}
