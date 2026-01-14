export type BuildMetadata = {
  buildSha: string;
  buildTime: string;
};

export type EnvValidationIssue = {
  name: string;
  reason: string;
};

export type EnvMissingResult = BuildMetadata & {
  ok: false;
  type: "missing";
  missing: string[];
};

export type EnvInvalidResult = BuildMetadata & {
  ok: false;
  type: "invalid";
  issues: EnvValidationIssue[];
};

export type EnvSuccessResult = BuildMetadata & {
  ok: true;
};

export type EnvCheckResult = EnvSuccessResult | EnvMissingResult | EnvInvalidResult;
