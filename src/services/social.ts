import {
  addDoc,
  collection,
  collectionGroup,
  deleteField,
  doc,
  getDocs,
  increment,
  limit,
  
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  Timestamp,
  updateDoc,
  where,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { onSnapshot } from "../lib/firestoreHelpers";
import { v4 as uuid } from "uuid";
import { db } from "../lib/firebase";
import { ensureWritesAllowed } from "../lib/securityGuard";

export const URBEX_REACTIONS = ["🖤", "🔦", "🩸", "👣", "🧩", "👑"] as const;
export type UrbexReaction = (typeof URBEX_REACTIONS)[number];

export type PostLocation = {
  lat: number;
  lng: number;
  placeId?: string;
  label?: string;
};

export type Post = {
  id: string;
  postId: string;
  userId: string;
  mediaUrls: string[];
  caption: string;
  location?: PostLocation | null;
  createdAt: number;
  reactions: Record<string, number>;
  userReactions?: Record<string, string>;
  commentsCount: number;
  filter?: string;
  authorName?: string | null;
  authorAvatar?: string | null;
  authorIsPro?: boolean;
  authorUsername?: string | null;
};

export type Story = {
  id: string;
  userId: string;
  mediaUrl: string;
  text?: string;
  music?: string;
  createdAt: number;
  expiresAt: number;
  reactions?: Record<string, number>;
  userReactions?: Record<string, string>;
  authorName?: string | null;
  authorAvatar?: string | null;
  authorUsername?: string | null;
};

export type PostComment = {
  id: string;
  userId: string;
  text: string;
  createdAt: number;
  displayName?: string | null;
  username?: string | null;
};

const POSTS = collection(db, "posts");
const STORY_COLLECTION_NAME = "items"; // /stories/{uid}/items/{storyId}

function deserializePost(docSnap: any): Post {
  const data: any = docSnap.data();
  return {
    id: docSnap.id,
    postId: data.postId ?? docSnap.id,
    userId: data.userId,
    mediaUrls: data.mediaUrls ?? [],
    caption: data.caption ?? "",
    location: data.location ?? null,
    createdAt: data.createdAt?.toMillis?.() ?? data.createdAt ?? Date.now(),
    reactions: data.reactions ?? {},
    userReactions: data.reactionBy ?? data.userReactions ?? {},
    commentsCount: data.commentsCount ?? 0,
    filter: data.filter,
    authorName: data.authorName ?? null,
    authorAvatar: data.authorAvatar ?? null,
    authorIsPro: data.authorIsPro ?? false,
    authorUsername: data.authorUsername ?? null,
  };
}

function emptyReactions() {
  return URBEX_REACTIONS.reduce<Record<string, number>>((acc, r) => {
    acc[r] = 0;
    return acc;
  }, {});
}

export function listenPosts(
  limitCount: number,
  cb: (posts: Post[], cursor: QueryDocumentSnapshot | null) => void
) {
  const q = query(POSTS, orderBy("createdAt", "desc"), limit(limitCount));
  return onSnapshot(q, (snap) => {
    const posts: Post[] = [];
    snap.forEach((d) => posts.push(deserializePost(d)));
    const cursor = snap.docs[snap.docs.length - 1] ?? null;
    cb(posts, cursor);
  });
}

export async function fetchMorePosts(
  limitCount: number,
  cursor: QueryDocumentSnapshot | null
) {
  if (!cursor) return { posts: [], cursor: null };
  const q = query(
    POSTS,
    orderBy("createdAt", "desc"),
    startAfter(cursor),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  const posts = snap.docs.map((d) => deserializePost(d));
  const nextCursor = snap.docs[snap.docs.length - 1] ?? null;
  return { posts, cursor: nextCursor };
}

export async function createPost(input: {
  userId: string;
  mediaUrls: string[];
  caption: string;
  location?: PostLocation | null;
  filter?: string;
  authorName?: string | null;
  authorAvatar?: string | null;
  authorIsPro?: boolean;
  authorUsername?: string | null;
  postId?: string;
}) {
  ensureWritesAllowed();
  const postId = input.postId ?? uuid();
  await addDoc(POSTS, {
    postId,
    userId: input.userId,
    mediaUrls: input.mediaUrls,
    caption: input.caption,
    location: input.location ?? null,
    createdAt: serverTimestamp(),
    reactions: emptyReactions(),
    reactionBy: {},
    commentsCount: 0,
    filter: input.filter ?? null,
    authorName: input.authorName ?? null,
    authorAvatar: input.authorAvatar ?? null,
    authorIsPro: input.authorIsPro ?? false,
    authorUsername: input.authorUsername ?? null,
  });
  return postId;
}

export async function createProfilePost(input: {
  userId: string;
  mediaUrls: string[];
  caption: string;
  location?: PostLocation | null;
  filter?: string;
  authorName?: string | null;
  authorAvatar?: string | null;
  authorIsPro?: boolean;
  postId?: string;
}) {
  return createPost(input);
}

export function listenUserPosts(
  userId: string,
  limitCount: number,
  cb: (posts: Post[]) => void
) {
  const q = query(
    POSTS,
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );
  return onSnapshot(q, (snap) => {
    const posts = snap.docs.map((d) => deserializePost(d));
    cb(posts);
  });
}

export async function togglePostReaction(
  postId: string,
  userId: string,
  emoji: UrbexReaction
) {
  ensureWritesAllowed();
  const ref = doc(db, "posts", postId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data: any = snap.data();
    const current = data.reactionBy?.[userId] ?? null;
    const counts: Record<string, number> = data.reactions || emptyReactions();
    const update: Record<string, any> = {};

    if (current === emoji) {
      update[`reactions.${emoji}`] = Math.max((counts[emoji] ?? 1) - 1, 0);
      update[`reactionBy.${userId}`] = deleteField();
    } else {
      update[`reactions.${emoji}`] = (counts[emoji] ?? 0) + 1;
      update[`reactionBy.${userId}`] = emoji;
      if (current) {
        update[`reactions.${current}`] = Math.max(
          (counts[current] ?? 1) - 1,
          0
        );
      }
    }

    tx.update(ref, update);
  });
}

export async function addPostComment(input: {
  postId: string;
  userId: string;
  text: string;
  displayName?: string | null;
  username?: string | null;
}) {
  ensureWritesAllowed();
  const comments = collection(db, "posts", input.postId, "comments");
  await addDoc(comments, {
    userId: input.userId,
    text: input.text,
    createdAt: serverTimestamp(),
    displayName: input.displayName ?? null,
    username: input.username ?? null,
  });
  await updateDoc(doc(db, "posts", input.postId), {
    commentsCount: increment(1),
  });
}

export function listenPostComments(
  postId: string,
  cb: (comments: PostComment[]) => void
) {
  const comments = collection(db, "posts", postId, "comments");
  const q = query(comments, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const out: PostComment[] = [];
    snap.forEach((d) => {
      const x: any = d.data();
      out.push({
        id: d.id,
        userId: x.userId,
        text: x.text ?? "",
        createdAt: x.createdAt?.toMillis?.() ?? x.createdAt ?? Date.now(),
        displayName: x.displayName ?? null,
        username: x.username ?? null,
      });
    });
    cb(out);
  });
}

export async function createStory(input: {
  userId: string;
  mediaUrl: string;
  text?: string;
  music?: string;
  authorName?: string | null;
  authorAvatar?: string | null;
  authorUsername?: string | null;
}) {
  ensureWritesAllowed();
  const storyId = uuid();
  const stories = collection(db, "stories", input.userId, STORY_COLLECTION_NAME);
  const expiresAt = Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);
  await addDoc(stories, {
    userId: input.userId,
    storyId,
    mediaUrl: input.mediaUrl,
    text: input.text ?? null,
    music: input.music ?? null,
    createdAt: serverTimestamp(),
    expiresAt,
    reactions: emptyReactions(),
    reactionBy: {},
    authorName: input.authorName ?? null,
    authorAvatar: input.authorAvatar ?? null,
    authorUsername: input.authorUsername ?? null,
  });
  return storyId;
}

export function listenStories(cb: (stories: Story[]) => void) {
  const cg = collectionGroup(db, STORY_COLLECTION_NAME);
  const cutoff = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
  const q = query(cg, where("createdAt", ">=", cutoff), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const out: Story[] = [];
      snap.forEach((d) => {
        const x: any = d.data();
        out.push({
          id: d.id,
          userId: x.userId ?? d.ref.parent.parent?.id ?? "",
          mediaUrl: x.mediaUrl,
          text: x.text ?? "",
          music: x.music ?? "",
          createdAt: x.createdAt?.toMillis?.() ?? x.createdAt ?? Date.now(),
          expiresAt: x.expiresAt?.toMillis?.() ?? x.expiresAt ?? Date.now(),
          reactions: x.reactions ?? emptyReactions(),
          userReactions: x.reactionBy ?? x.userReactions ?? {},
          authorName: x.authorName ?? null,
          authorAvatar: x.authorAvatar ?? null,
          authorUsername: x.authorUsername ?? null,
        });
      });
      cb(out);
    },
    (err) => {
      // Avoid crashing the UI if an index is missing; surface it in console.
      console.error("listenStories error", err);
    }
  );
}

export async function toggleStoryReaction(
  story: Story,
  userId: string,
  emoji: UrbexReaction
) {
  ensureWritesAllowed();
  const ref = doc(db, "stories", story.userId, STORY_COLLECTION_NAME, story.id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data: any = snap.data();
    const current = data.reactionBy?.[userId] ?? null;
    const counts: Record<string, number> = data.reactions || emptyReactions();
    const update: Record<string, any> = {};

    if (current === emoji) {
      update[`reactions.${emoji}`] = Math.max((counts[emoji] ?? 1) - 1, 0);
      update[`reactionBy.${userId}`] = deleteField();
    } else {
      update[`reactions.${emoji}`] = (counts[emoji] ?? 0) + 1;
      update[`reactionBy.${userId}`] = emoji;
      if (current) {
        update[`reactions.${current}`] = Math.max(
          (counts[current] ?? 1) - 1,
          0
        );
      }
    }

    tx.update(ref, update);
  });
}
