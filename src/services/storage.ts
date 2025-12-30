import { v4 as uuid } from "uuid";
import { getDownloadURL, ref, uploadBytes, type UploadMetadata } from "firebase/storage";
import { storage } from "../lib/firebase";
import { ensureWritesAllowed } from "../lib/securityGuard";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_MEDIA_SIZE = 25 * 1024 * 1024; // 25MB

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function buildUploadMetadata(
  file: File,
  folder: string,
  extras?: Record<string, string | undefined>
): UploadMetadata {
  const customMetadata: Record<string, string> = { folder };
  if (extras) {
    for (const [key, value] of Object.entries(extras)) {
      if (value != null && value !== "") {
        customMetadata[key] = value;
      }
    }
  }
  return {
    contentType: file.type,
    customMetadata,
  };
}

function ensureImage(file: File) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error(
      "Seules les images JPEG, PNG ou WEBP sont autorisées pour ce dossier."
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Image trop lourde (max 5 Mo).");
  }
}

export async function uploadProfileImage(uid: string, file: File) {
  ensureWritesAllowed();
  ensureImage(file);
  const key = uuid();
  const path = `avatars/${uid}/avatar-${key}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, buildUploadMetadata(file, "avatars", { uploadedBy: uid }));
  return getDownloadURL(storageRef);
}

export async function uploadSpotImage(placeId: string, uid: string, file: File) {
  ensureWritesAllowed();
  ensureImage(file);
  const key = uuid();
  const path = `spotImages/${placeId}/${uid}/${key}`;
  const storageRef = ref(storage, path);
  await uploadBytes(
    storageRef,
    file,
    buildUploadMetadata(file, "spotImages", {
      uploadedBy: uid,
      placeId,
    })
  );
  return getDownloadURL(storageRef);
}

export async function uploadHistoryImage(placeId: string, file: File) {
  ensureWritesAllowed();
  ensureImage(file);
  const key = uuid();
  const path = `historyImages/${placeId}/${key}`;
  const storageRef = ref(storage, path);
  await uploadBytes(
    storageRef,
    file,
    buildUploadMetadata(file, "historyImages", {
      placeId,
    })
  );
  return getDownloadURL(storageRef);
}

export async function uploadProductImage(productId: string, file: File) {
  ensureWritesAllowed();
  ensureImage(file);
  const key = uuid();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const path = `products/${productId}/${key}-${safeName}`;
  const storageRef = ref(storage, path);
  await uploadBytes(
    storageRef,
    file,
    buildUploadMetadata(file, "products", {
      productId,
    })
  );
  return getDownloadURL(storageRef);
}

function ensureMedia(file: File) {
  const allowedMediaTypes = [...ALLOWED_IMAGE_TYPES, "video/mp4"];
  if (!allowedMediaTypes.includes(file.type)) {
    throw new Error(
      "Seules les images (JPEG/PNG/WEBP) ou vidéos MP4 sont autorisées pour le feed."
    );
  }
  if (file.size > MAX_MEDIA_SIZE) {
    throw new Error("Fichier trop lourd (25 Mo max pour les posts, stories et DM).");
  }
}

export type UrbexUploadOptions = {
  folder?: string;
  postId?: string;
};

export async function uploadUrbexMedia(
  uid: string,
  file: File,
  options: UrbexUploadOptions = {}
) {
  ensureWritesAllowed();
  ensureMedia(file);
  const key = uuid();
  const folder = options.folder ?? "posts";
  const safePostId = options.postId?.trim();
  const prefix =
    folder === "posts" && safePostId ? `posts/${uid}/${safePostId}` : `${folder}/${uid}`;
  const path = `${prefix}/${key}`;
  const storageRef = ref(storage, path);
  await uploadBytes(
    storageRef,
    file,
    buildUploadMetadata(file, folder, {
      uploadedBy: uid,
      postId: safePostId ?? undefined,
    })
  );
  return getDownloadURL(storageRef);
}

export async function uploadDmMedia(uidA: string, uidB: string, file: File) {
  ensureWritesAllowed();
  ensureMedia(file);
  const key = uuid();
  const path = `dmMedia/${uidA}/${uidB}/${key}`;
  const storageRef = ref(storage, path);
  await uploadBytes(
    storageRef,
    file,
    buildUploadMetadata(file, "dmMedia", {
      uploadedBy: uidA,
      targetUser: uidB,
    })
  );
  return getDownloadURL(storageRef);
}
