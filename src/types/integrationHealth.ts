export type IntegrationStatus = {
  status: "ok" | "degraded" | "down";
  note?: string;
  lastEventAt?: string;
};

export type FirebaseIntegrationStatus = IntegrationStatus & {
  appCheckOk: boolean;
};

export type IntegrationHealthData = {
  checkedAt: string;
  stripe: IntegrationStatus;
  printful: IntegrationStatus;
  mapbox: IntegrationStatus;
  firebase: FirebaseIntegrationStatus;
};
