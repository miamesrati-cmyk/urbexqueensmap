export function describeStorageError(err: unknown, fallback: string) {
  const target = err as { code?: string; message?: string };
  console.error("Storage upload error", err);
  switch (target?.code) {
    case "storage/unauthorized":
    case "storage/permission-denied":
      return "Upload refusé par Firebase Storage.";
    case "storage/invalid-argument":
      return "Type de fichier non autorisé.";
    case "storage/canceled":
      return "Upload annulé.";
    case "storage/retry-limit-exceeded":
      return "Upload interrompu, réessaie plus tard.";
    case "storage/quota-exceeded":
      return "Espace de stockage saturé.";
  }

  if (typeof target?.message === "string" && target.message.length) {
    return target.message;
  }

  return fallback;
}
