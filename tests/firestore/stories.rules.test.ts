import { readFileSync } from "node:fs";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { Firestore, doc, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { afterAll, afterEach, beforeAll, describe, it } from "vitest";

const PROJECT_ID = "urbex-map-test";
const OWNER_UID = "story-owner";
const STORY_ID = "story-guard";
const ADMIN_UID = "AQqXqFOgu4aCRSDUAS8wwUZcJB53";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync("firestore.rules", "utf-8"),
    },
  });
});

afterAll(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

afterEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
});

function storyRef(db: Firestore) {
  return doc(db, "stories", OWNER_UID, "items", STORY_ID);
}

async function seedStory(expiresAt?: Timestamp | null) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const data: Record<string, unknown> = {
      userId: OWNER_UID,
      storyId: STORY_ID,
      mediaUrl: "https://example.com/story.jpg",
      createdAt: Timestamp.fromMillis(Date.now()),
      reactions: {},
      reactionBy: {},
      authorName: "Urbex",
      authorAvatar: "https://example.com/avatar.png",
      authorUsername: "urbex-owner",
    };
    if (expiresAt !== undefined) {
      if (expiresAt !== null) {
        data.expiresAt = expiresAt;
      }
    }
    await setDoc(storyRef(context.firestore()), data);
  });
}

describe("stories expiry guard", () => {
  it("allows owner and reaction updates before expiry", async () => {
    const expiresAt = Timestamp.fromMillis(Date.now() + 60 * 60 * 1000);
    await seedStory(expiresAt);

    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(
      updateDoc(storyRef(ownerDb), {
        text: "Owner text update",
      })
    );

    const reactorDb = testEnv.authenticatedContext("reactor").firestore();
    await assertSucceeds(
      updateDoc(storyRef(reactorDb), {
        reactions: { love: 1 },
        reactionBy: { reactor: "love" },
      })
    );
  });

  it("blocks owner/reaction updates after expiry but still allows admin", async () => {
    const expiresAt = Timestamp.fromMillis(Date.now() - 1);
    await seedStory(expiresAt);

    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertFails(
      updateDoc(storyRef(ownerDb), {
        text: "Can’t edit after expiration",
      })
    );

    const reactorDb = testEnv.authenticatedContext("reactor").firestore();
    await assertFails(
      updateDoc(storyRef(reactorDb), {
        reactions: { heart: 1 },
        reactionBy: { reactor: "heart" },
      })
    );

    const adminDb = testEnv.authenticatedContext(ADMIN_UID).firestore();
    await assertSucceeds(
      updateDoc(storyRef(adminDb), {
        text: "Admin override",
      })
    );
  });

  it("fails closed when expiresAt is missing", async () => {
    await seedStory();

    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertFails(
      updateDoc(storyRef(ownerDb), {
        text: "Owner update without expiresAt",
      })
    );

    const reactorDb = testEnv.authenticatedContext("reactor").firestore();
    await assertFails(
      updateDoc(storyRef(reactorDb), {
        reactions: { flash: 1 },
        reactionBy: { reactor: "flash" },
      })
    );

    const adminDb = testEnv.authenticatedContext(ADMIN_UID).firestore();
    await assertSucceeds(
      updateDoc(storyRef(adminDb), {
        text: "Admin still wins",
      })
    );
  });
});
