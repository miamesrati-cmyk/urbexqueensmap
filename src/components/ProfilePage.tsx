import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from "react";
import { onAuthStateChanged, type User, updateProfile } from "firebase/auth";
import { auth } from "../lib/firebase";
import "../styles/profile-gaming.css";
import "../styles/profile-responsive.css";
import "../styles/profile-hero-enhanced.css";
import {
  listenUserProfile,
  type UserProfile,
  upsertUserProfile,
  SPOT_TYPE_LABELS,
  getUnlockedBadges,
  getUrbexLevel,
  ALL_BADGES,
} from "../services/userProfiles";
import { listenUserProfile as listenBasicProfile } from "../services/users";
import { listenUserPlaces, type UserPlacesMap } from "../services/userPlaces";
import {
  ACHIEVEMENTS,
  listenUserAchievements,
  type AchievementTier,
  type UserAchievementRecord,
} from "../services/achievements";
import { buildUserSpotCollections } from "../lib/userSpotStats";
import { useUserSpotStats } from "../hooks/useUserSpotStats";
import { useOptimisticAction } from "../hooks/useOptimisticAction";
import { listenPlaces, type Place } from "../services/places";
import { uploadProfileImage } from "../services/storage";
import { listenUserPosts, type Post } from "../services/social";
import {
  acceptFollowRequest,
  declineFollowRequest,
  followUser,
  listenFollowers,
  listenFollowRequests,
  listenFollowing,
  requestFollow,
  unfollowUser,
  type Follow,
  type FollowRequest,
} from "../services/follows";
import {
  loadSettingsFromFirestore,
  getDefaultSettings,
  type UserSettings,
} from "../services/userSettings";
import { shareLink } from "../utils/share";
import { useToast } from "../contexts/useToast";
import { describeStorageError } from "../utils/uploadErrors";
import ProUnlockPanel from "./ProUnlockPanel";
import { ProfileSkeleton } from "./skeletons/SkeletonVariants";
import StatCard from "./profile/StatCard";
import BadgeItem from "./profile/BadgeItem";
import AchievementCard from "./profile/AchievementCard";
import { ProfilePostModal, ProfilePostsGrid } from "./ProfilePosts";
import Skeleton from "./Skeleton";
import UQImage from "./UQImage";
import type { ProfileViewSection } from "../lib/profileViews";

type Props = {
  uid: string;
  onBack?: () => void;
  view?: ProfileViewSection;
};

type EditSectionKey = "bio" | "media" | "privacy" | "favs";

function haversineKm(a: Place, b: Place) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const PROFILE_PRO_FEATURES = [
  {
    icon: "👻",
    title: "Ghost Maps (PRO)",
    detail: "Lieux paranormaux visibles, filtres dédiés et textures irisées pour tes runs nocturnes.",
  },
  {
    icon: "🧭",
    title: "Pathfinder (PRO)",
    detail: "Trace tes itinéraires, combine filtres de danger et planifie des raids urbex précis.",
  },
  {
    icon: "✨",
    title: "Spots légendaires & historiques",
    detail: "Badges 'Légendaire', récits complets et archives réservées au club PRO.",
  },
];

export default function ProfilePage({ uid, onBack, view }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [userPlaces, setUserPlaces] = useState<UserPlacesMap>({});
  const [userAchievements, setUserAchievements] = useState<
    Record<string, UserAchievementRecord>
  >({});
  const [places, setPlaces] = useState<Place[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profileSettings, setProfileSettings] = useState<UserSettings | null>(null);
  const visitedSectionRef = useRef<HTMLDivElement | null>(null);
  const favoritesSectionRef = useRef<HTMLDivElement | null>(null);
  const postsSectionRef = useRef<HTMLDivElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formBio, setFormBio] = useState("");
  const [formPhoto, setFormPhoto] = useState("");
  const [formBanner, setFormBanner] = useState("");
  const [formFavs, setFormFavs] = useState<string[]>([]);
  const [formAvatarCropX, setFormAvatarCropX] = useState(0);
  const [formAvatarCropY, setFormAvatarCropY] = useState(0);
  const [formAvatarZoom, setFormAvatarZoom] = useState(1);
  const [formAvatarMode, setFormAvatarMode] = useState<"cover" | "logo">("cover");
  const [editError, setEditError] = useState<string | null>(null);
  const [formPrivate, setFormPrivate] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [isCropModalOpen, setCropModalOpen] = useState(false);
  const [modalCrop, setModalCrop] = useState({ x: 0, y: 0 });
  const [modalZoom, setModalZoom] = useState(1);
  const [dragState, setDragState] = useState<
    | {
        startX: number;
        startY: number;
        offsetX: number;
        offsetY: number;
      }
    | null
  >(null);
  const clampCrop = (value: number) => Math.min(140, Math.max(-140, value));
  const toast = useToast();

  const closeCropModal = () => {
    setCropModalOpen(false);
    setDragState(null);
  };

  const handleAvatarBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    closeCropModal();
  };

  const handleAvatarBackdropKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      closeCropModal();
      event.preventDefault();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      closeCropModal();
    }
  };

  useEffect(() => {
    if (!isCropModalOpen) return;
    setModalCrop({ x: formAvatarCropX, y: formAvatarCropY });
    setModalZoom(formAvatarZoom);
  }, [isCropModalOpen, formAvatarCropX, formAvatarCropY, formAvatarZoom]);

  useEffect(() => {
    if (!isCropModalOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeCropModal();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isCropModalOpen]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      startX: event.clientX,
      startY: event.clientY,
      offsetX: modalCrop.x,
      offsetY: modalCrop.y,
    });
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragState) return;
    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    setModalCrop({
      x: clampCrop(dragState.offsetX + deltaX),
      y: clampCrop(dragState.offsetY + deltaY),
    });
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragState) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragState(null);
  };

  const handleCropSave = () => {
    setFormAvatarCropX(modalCrop.x);
    setFormAvatarCropY(modalCrop.y);
    setFormAvatarZoom(modalZoom);
    closeCropModal();
  };
  const [followers, setFollowers] = useState<Follow[]>([]);
  const [myFollowing, setMyFollowing] = useState<Follow[]>([]);
  const {
    state: optimisticFollowers,
    applyOptimistic: applyOptimisticFollowers,
    commit: commitFollowerAction,
  } = useOptimisticAction("profile:followers", followers);
  const {
    state: optimisticFollowing,
    applyOptimistic: applyOptimisticFollowing,
    commit: commitFollowingAction,
  } = useOptimisticAction("profile:following", myFollowing);
  const [followRequests, setFollowRequests] = useState<FollowRequest[]>([]);
  const [requestedLocal, setRequestedLocal] = useState(false);
  const [pendingFollowAction, setPendingFollowAction] = useState<"follow" | "unfollow" | null>(null);
  const [isProViewer, setIsProViewer] = useState(false);
  const [profileIsPro, setProfileIsPro] = useState(false);
  const [profilePosts, setProfilePosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [editSections, setEditSections] = useState<Record<EditSectionKey, boolean>>({
    bio: true,
    media: true,
    privacy: true,
    favs: true,
  });

  useEffect(() => {
    let profileUnsub: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u || null);
      profileUnsub?.();
      if (u) {
        profileUnsub = listenBasicProfile(u.uid, (profile) => {
          setIsProViewer(profile.isPro);
        });
      } else {
        setIsProViewer(false);
      }
    });
    return () => {
      unsubAuth();
      profileUnsub?.();
    };
  }, []);

  useEffect(() => {
    setProfileLoaded(false);
    const unsubProfile = listenUserProfile(uid, (p) => {
      setProfileLoaded(true);
      setProfile(p);
    });
    const unsubUserPlaces = listenUserPlaces(uid, setUserPlaces);
    const unsubPlaces = listenPlaces(setPlaces, { isPro: isProViewer });
    const unsubProFlag = listenBasicProfile(uid, (p) => setProfileIsPro(p.isPro));
    return () => {
      unsubProfile();
      unsubUserPlaces();
      unsubPlaces();
      unsubProFlag();
    };
  }, [uid, isProViewer]);

  useEffect(() => {
    loadSettingsFromFirestore(uid, { persistLocal: false })
      .then((s) => setProfileSettings(s))
      .catch(() => setProfileSettings(getDefaultSettings()));
  }, [uid]);

  useEffect(() => {
    if (!view) return;
    const sectionMap: Record<
      ProfileViewSection,
      RefObject<HTMLDivElement | null>
    > = {
      spots: visitedSectionRef,
      done: visitedSectionRef,
      favorites: favoritesSectionRef,
      posts: postsSectionRef,
    };
    const target = sectionMap[view] ?? visitedSectionRef;
    target.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [view]);

  useEffect(() => {
    const unsubFollowers = listenFollowers(uid, setFollowers);
    return () => unsubFollowers();
  }, [uid]);

  useEffect(() => {
    if (!currentUser) return;
    const unsub = listenFollowing(currentUser.uid, setMyFollowing);
    return () => unsub();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const unsub = listenFollowRequests(uid, setFollowRequests);
    return () => unsub();
  }, [uid, currentUser]);

  useEffect(() => {
    if (!profile) return;
    setFormBio(profile.bio || "");
    setPhotoSafely(profile.photoURL);
    setBannerSafely(profile.bannerURL);
    setFormFavs(profile.favoriteSpotTypes || []);
    setFormPrivate(!!profile.isPrivate);
    setFormAvatarCropX(profile.avatarCropX ?? 0);
    setFormAvatarCropY(profile.avatarCropY ?? 0);
    setFormAvatarZoom(profile.avatarZoom ?? 1);
    setFormAvatarMode(profile.avatarMode ?? "cover");
  }, [profile]);

  const spotCollections = useMemo(
    () => buildUserSpotCollections(places, userPlaces),
    [places, userPlaces]
  );
  const visited = spotCollections.donePlaces.map((entry) => entry.place);
  const saved = spotCollections.savedPlaces.map((entry) => entry.place);

  const addedByUser = useMemo(
    () => places.filter((p) => p.addedBy === uid),
    [places, uid]
  );
  const { favoritesCount, completedCount } = useUserSpotStats(uid);

  const isOwner = currentUser?.uid === uid;
  const effectiveSettings = profileSettings ?? getDefaultSettings();
  const stealthActive = effectiveSettings.stealthMode && !isOwner;
  const profileVisible = effectiveSettings.profilePublic || isOwner;
  const canShowVisited = isOwner || effectiveSettings.showDonePublic;
  const canShowFavorites = isOwner || effectiveSettings.showFavoritesPublic;
  const canReceiveMessages = isOwner || effectiveSettings.allowMessages;

  const visibleVisited = useMemo(
    () => (canShowVisited ? visited : []),
    [canShowVisited, visited]
  );
  const visibleSaved = useMemo(
    () => (canShowFavorites ? saved : []),
    [canShowFavorites, saved]
  );
  const firstMapSpot = visibleVisited[0] || visited[0];

  const kmExplored = useMemo(() => {
    if (visibleVisited.length < 2) return 0;
    const ordered = [...visibleVisited].sort(
      (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)
    );
    let total = 0;
    for (let i = 1; i < ordered.length; i++) {
      total += haversineKm(ordered[i - 1], ordered[i]);
    }
    return Math.round(total);
  }, [visibleVisited]);

  const stats = useMemo(
    () => ({
      spotsVisitedCount: completedCount,
      spotsSavedCount: favoritesCount,
      spotsAddedCount: addedByUser.length,
      kmExplored,
    }),
    [
      completedCount,
      favoritesCount,
      addedByUser.length,
      kmExplored,
    ]
  );

  const levelData = useMemo(() => getUrbexLevel(stats), [stats]);
  const statTiles = useMemo(
    () => [
      { icon: "📍", label: "Spots visités", value: completedCount },
      { icon: "⭐", label: "Favoris", value: favoritesCount },
      { icon: "➕", label: "Spots ajoutés", value: addedByUser.length },
      { icon: "🛰", label: "KM explorés", value: `${kmExplored} km` },
    ],
    [
      completedCount,
      favoritesCount,
      addedByUser.length,
      kmExplored,
    ]
  );
  const achievementTiles = useMemo(() => {
    const tierOrder: Record<AchievementTier, number> = {
      GHOST: 0,
      LEGEND: 1,
      RARE: 2,
      COMMON: 3,
    };
    return ACHIEVEMENTS.map((definition) => ({
      ...definition,
      unlocked: Boolean(userAchievements[definition.id]),
      unlockedAt: userAchievements[definition.id]?.unlockedAt ?? 0,
    })).sort((a, b) => {
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
      if (tierOrder[a.tier] !== tierOrder[b.tier]) {
        return tierOrder[a.tier] - tierOrder[b.tier];
      }
      return a.title.localeCompare(b.title);
    });
  }, [userAchievements]);
  const featuredVisited = useMemo(() => visibleVisited.slice(0, 9), [visibleVisited]);
  const achievementsUnlockedCount = achievementTiles.filter((tile) => tile.unlocked).length;
  const PROFILE_PHOTO_INPUT_ID = "profile-photo-url";
  const PROFILE_BANNER_INPUT_ID = "profile-banner-url";
  const PROFILE_PRIVACY_TOGGLE_ID = "profile-privacy-toggle";

  function renderSpotItem(place: Place) {
    const typeLabel =
      SPOT_TYPE_LABELS[place.category || ""] ||
      place.category ||
      "autre";
    const accessLabel = place.access || "inconnu";
    const riskLabel = place.riskLevel || "non évalué";
    return (
      <div key={place.id} className="profile-visited-item">
        <div>
          <div className="profile-visited-title">
            {place.title}
            {place.isLegend && (
              <span className="legendary-pill">Légendaire</span>
            )}
          </div>
          <div className="profile-visited-meta">
            {typeLabel} · accès {accessLabel} · risque {riskLabel}
          </div>
        </div>
        <a className="profile-visited-link" href={`/spot/${place.id}`}>
          Histoire →
        </a>
      </div>
    );
  }

  const safeProfile: UserProfile =
    profile || {
      displayName: null,
      photoURL: null,
      bannerURL: null,
      bio: null,
      username: null,
      favoriteSpotTypes: [],
      level: "beginner",
      stats: {
        spotsVisitedCount: 0,
        spotsSavedCount: 0,
        spotsAddedCount: 0,
        kmExplored: 0,
      },
      badges: {},
      qrSlug: null,
      isPrivate: false,
      followersCount: 0,
      followingCount: 0,
    };

  const displayNameBase =
    safeProfile.displayName ||
    currentUser?.displayName ||
    currentUser?.email?.split("@")[0] ||
    uid.slice(0, 6);
  const displayName = stealthActive ? "Explorateur anonyme" : displayNameBase;
  const photoUrl = stealthActive ? null : safeProfile.photoURL;
  const bannerUrl = stealthActive ? null : safeProfile.bannerURL;
  const profileHandle = safeProfile.username || safeProfile.qrSlug;
  const handleSlug = stealthActive ? "explorateur" : profileHandle || uid.slice(0, 8);
  const croppingImage = formPhoto || photoUrl || undefined;

  const profileUrl = useMemo(
    () => `${window.location.origin}/${profileHandle ? `u/${profileHandle}` : `profile/${uid}`}`,
    [profileHandle, uid]
  );

  const qrUrl = useMemo(
    () =>
      `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
        profileUrl
      )}`,
    [profileUrl]
  );
  const handleShareProfile = useCallback(async () => {
    const result = await shareLink(
      profileUrl,
      "Profil UrbexQueens",
      `Découvre le profil de ${displayName} sur UrbexQueens`
    );
    if (result.shared) {
      toast.info("Lien partagé");
    } else if (result.copied) {
      toast.success("Lien copié 📎");
    }
  }, [displayName, profileUrl, toast]);

  const handleShareProfileQr = useCallback(async () => {
    const result = await shareLink(
      profileUrl,
      "Profil UrbexQueens",
      `Scanne ou ouvre le profil de ${displayName}`
    );
    if (result.shared) {
      toast.info("Lien partagé");
    } else if (result.copied) {
      toast.success("Lien copié 📎");
    }
  }, [displayName, profileUrl, toast]);

  const avatarLetter = (displayName || "U")[0]?.toUpperCase() || "U";

  const unlockedBadges = useMemo(
    () => getUnlockedBadges(stats, visibleVisited, safeProfile.favoriteSpotTypes || []),
    [stats, visibleVisited, safeProfile.favoriteSpotTypes]
  );
  const isPrivate = !!safeProfile.isPrivate;
  const followerCount = safeProfile.followersCount ?? optimisticFollowers.length;
  const followingCount = safeProfile.followingCount ?? optimisticFollowing.length;
  const isFollowing = useMemo(
    () => optimisticFollowers.some((f) => f.fromUid === currentUser?.uid),
    [optimisticFollowers, currentUser?.uid]
  );
  const myRequestStatus = followRequests.find((r) => r.fromUid === currentUser?.uid)?.status;
  const isRequested = requestedLocal || myRequestStatus === "pending";
  const canViewPrivate = !isPrivate || isOwner || isFollowing;

  useEffect(() => {
    if (!canViewPrivate) {
      setUserAchievements({});
      return;
    }
    const unsub = listenUserAchievements(uid, setUserAchievements);
    return () => unsub();
  }, [uid, canViewPrivate]);

  useEffect(() => {
    if (isPrivate && !canViewPrivate) {
      setProfilePosts([]);
      setPostsLoading(false);
      return;
    }
    setPostsLoading(true);
    const unsub = listenUserPosts(uid, 30, (posts) => {
      setProfilePosts(posts);
      setPostsLoading(false);
    });
    return () => unsub();
    }, [uid, isPrivate, canViewPrivate]);

  const handleFollow = useCallback(async () => {
    if (!currentUser || isOwner || pendingFollowAction) return;
    const currentUid = currentUser.uid;
    if (isFollowing) {
      setPendingFollowAction("unfollow");
      applyOptimisticFollowers((previous) =>
        previous.filter((entry) => entry.fromUid !== currentUid)
      );
      applyOptimisticFollowing((previous) =>
        previous.filter((entry) => entry.toUid !== uid)
      );
      try {
        const actionPromise = unfollowUser(currentUid, uid);
        await Promise.all([
          commitFollowerAction(actionPromise),
          commitFollowingAction(actionPromise),
        ]);
      } catch (error) {
        console.error("[ProfilePage] unfollow", error);
        toast.error("Action annulée (sync impossible)");
      } finally {
        setPendingFollowAction(null);
      }
      return;
    }

    setPendingFollowAction("follow");
    if (isPrivate) {
      try {
        await requestFollow(uid, currentUid);
        setRequestedLocal(true);
      } catch (error) {
        console.error("[ProfilePage] request follow", error);
        toast.error("Action annulée (sync impossible)");
      } finally {
        setPendingFollowAction(null);
      }
      return;
    }

    const followerEntry: Follow = {
      id: currentUid,
      fromUid: currentUid,
      toUid: uid,
      createdAt: Date.now(),
    };
    const followingEntry: Follow = {
      id: uid,
      fromUid: currentUid,
      toUid: uid,
      createdAt: Date.now(),
    };
    applyOptimisticFollowers((previous) => {
      if (previous.some((entry) => entry.fromUid === currentUid)) {
        return previous;
      }
      return [...previous, followerEntry];
    });
    applyOptimisticFollowing((previous) => {
      if (previous.some((entry) => entry.toUid === uid)) {
        return previous;
      }
      return [...previous, followingEntry];
    });
    try {
      const actionPromise = followUser(currentUid, uid);
      await Promise.all([
        commitFollowerAction(actionPromise),
        commitFollowingAction(actionPromise),
      ]);
    } catch (error) {
      console.error("[ProfilePage] follow", error);
      toast.error("Action annulée (sync impossible)");
    } finally {
      setPendingFollowAction(null);
    }
  }, [
    currentUser,
    isOwner,
    isFollowing,
    isPrivate,
    pendingFollowAction,
    uid,
    applyOptimisticFollowers,
    applyOptimisticFollowing,
    commitFollowerAction,
    commitFollowingAction,
    setRequestedLocal,
    setPendingFollowAction,
    toast,
  ]);

  if (!profileLoaded) {
    return (
      <div className="profile-page uq-profile-page">
        <div className="uq-profile-left">
          <ProfileSkeleton />
        </div>
      </div>
    );
  }

  if (!profileVisible && !isOwner) {
    return (
      <div className="profile-page">
        <div className="profile-card">
          <h2>Profil non visible</h2>
          <p>Ce membre a choisi de cacher son profil.</p>
          {onBack && (
            <button className="story-back-btn" onClick={onBack}>
              ← Retour
            </button>
          )}
        </div>
      </div>
    );
  }

  const FAVORITE_OPTIONS = [
    "hospitals",
    "manors",
    "industries",
    "villages_ghosts",
    "schools",
    "religious",
    "others",
  ];

  function setPhotoSafely(url: string | null) {
    setFormPhoto(url || "");
  }

  function setBannerSafely(url: string | null) {
    setFormBanner(url || "");
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!isOwner) return;
    setSaving(true);
    setEditError(null);
    try {
      await upsertUserProfile(uid, {
        bio: formBio,
        photoURL: formPhoto || null,
        bannerURL: formBanner || null,
        favoriteSpotTypes: formFavs,
        isPrivate: formPrivate,
        avatarCropX: formAvatarCropX,
        avatarCropY: formAvatarCropY,
        avatarZoom: formAvatarZoom,
        avatarMode: formAvatarMode,
      });
      setEditing(false);
    } catch (err) {
      console.error("Erreur sauvegarde profil", err);
      setEditError("Impossible d’enregistrer le profil pour le moment.");
    } finally {
      setSaving(false);
    }
  }

  function toggleFav(value: string) {
    setFormFavs((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  function toggleSection(section: EditSectionKey) {
    setEditSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  async function handleAvatarFile(file: File | null) {
    if (!file || !isOwner) return;
    setAvatarError(null);
    setAvatarUploading(true);
    try {
      const url = await uploadProfileImage(uid, file);
      setFormPhoto(url);
      await upsertUserProfile(uid, { photoURL: url });
      const activeUser = auth.currentUser;
      if (activeUser) {
        await updateProfile(activeUser, { photoURL: url });
      }
    } catch (err: unknown) {
      const target = err as { code?: string; message?: string };
      console.error("[AvatarUpload] failure", {
        code: target?.code,
        message: target?.message,
        err,
      });
      setAvatarError(describeStorageError(err, "Upload impossible pour le moment."));
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = "";
      }
    }
  }

  function handleMessage() {
    window.dispatchEvent(
      new CustomEvent("urbex-nav", { detail: { path: `/dm/${uid}` } })
    );
  }

  async function handleAccept(id: string) {
    if (!isOwner) return;
    await acceptFollowRequest(uid, id);
  }

  async function handleDecline(id: string) {
    if (!isOwner) return;
    await declineFollowRequest(uid, id);
  }

  return (
    <div className="profile-page uq-profile-page">
      <div className="uq-profile-left">
        <div className="uq-profile-hero">
          <div
            className={`uq-profile-banner${bannerUrl ? " has-photo" : ""}`}
            style={
              bannerUrl
                ? {
                    backgroundImage: `linear-gradient(140deg, rgba(5, 5, 12, 0.7), rgba(8, 4, 18, 0.4)), url(${bannerUrl})`,
                  }
                : undefined
            }
          />
          <div className="uq-profile-hero-inner">
            <div className="uq-profile-hero-top">
              <div className="uq-profile-avatar-block">
                {photoUrl ? (
                  <UQImage src={photoUrl} alt={displayName} />
                ) : (
                  <span className="uq-profile-avatar-initial">{avatarLetter}</span>
                )}
                {isOwner && (
                  <>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => handleAvatarFile(e.target.files?.[0] || null)}
                    />
                    <button
                      type="button"
                      className="uq-profile-change-photo-btn"
                      onClick={() => setCropModalOpen(true)}
                      disabled={avatarUploading}
                    >
                      {avatarUploading ? "Upload..." : "Changer"}
                    </button>
                  </>
                )}
              </div>

              <div className="uq-profile-info">
                <div className="uq-profile-name-row">
                  <h1 className="uq-profile-name">{displayName}</h1>
                  <span className="uq-profile-username">@{handleSlug}</span>
                  {profileIsPro && <span className="uq-profile-pro-pill">PRO ✨</span>}
                </div>

                <div className="uq-profile-level-row">
                  <span className="uq-profile-rank-pill" title={levelData.description}>
                    {levelData.shortLabel}
                  </span>
                  {isPrivate && <span className="profile-private-chip">Compte privé</span>}
                </div>

                <p className="uq-profile-bio">
                  {safeProfile.bio ||
                    "Ton identité urbex, tes vibes et tes obsessions : montre qui tu es à la communauté."}
                </p>

                <div className="uq-profile-follow-row">
                  <button className="uq-profile-follow-stat" type="button">
                    <strong>{followerCount}</strong> abonnés
                  </button>
                  <button className="uq-profile-follow-stat" type="button">
                    <strong>{followingCount}</strong> abonnements
                  </button>
                </div>
                {avatarError && <p className="profile-hint">{avatarError}</p>}
              </div>

              <div className="uq-profile-hero-actions">
                <div className="uq-profile-action-stack">
                  {onBack && (
                    <button className="story-back-btn" onClick={onBack}>
                      ← Retour
                    </button>
                  )}
                  <button
                    className="uq-share-btn"
                    type="button"
                    onClick={handleShareProfile}
                  >
                    🔗 Partager
                  </button>
                </div>
                <div className="uq-profile-action-stack">
                  {isOwner ? (
                    <button className="uq-profile-edit-pill" onClick={() => setEditing(true)}>
                      ✏️ Editer mon profil
                    </button>
                  ) : (
                    <>
                      <button
                        className={`profile-follow-btn${
                          pendingFollowAction ? " is-pending" : ""
                        }`}
                        onClick={handleFollow}
                        disabled={!!pendingFollowAction}
                      >
                        {isFollowing
                          ? "Abonné"
                          : isPrivate
                            ? isRequested
                              ? "En attente"
                              : "Demander à suivre"
                            : "Suivre"}
                      </button>
                      <button
                        className="profile-message-btn"
                        onClick={handleMessage}
                        disabled={!canReceiveMessages}
                        title={
                          canReceiveMessages
                            ? "Envoyer un message"
                            : "Ce membre ne reçoit pas de messages"
                        }
                      >
                        ✉️ Message
                      </button>
                    </>
                  )}
                  <a
                    className="story-map-btn"
                    href={`https://www.google.com/maps/search/?api=1&query=${firstMapSpot?.lat ?? 45.5},${firstMapSpot?.lng ?? -73.56}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    🌍 Carte
                  </a>
                </div>
              </div>
            </div>

            <div className="uq-profile-stat-tiles profile-hero-stats uq-profile-stats">
              {statTiles.map((stat) => (
                <StatCard
                  key={stat.label}
                  value={stat.value}
                  label={stat.label}
                  icon={stat.icon}
                  color="pink"
                />
              ))}
            </div>
          </div>
        </div>

        {!isProViewer && (
          <ProUnlockPanel
            className="profile-pro-panel"
            subtitle="Ghost Maps, Pathfinder et les spots légendaires restent floutés pour les comptes gratuits."
            features={PROFILE_PRO_FEATURES}
            lockedNote="Passe en PRO pour débloquer tous les récits, filtres avancés et badges exclusifs."
          />
        )}

        <div className="uq-profile-content-grid">
          {isPrivate && !canViewPrivate && (
            <div className="uq-profile-card">
              <h2 className="uq-profile-section-title">Compte privé</h2>
              <p className="profile-hint">Abonne-toi pour voir les stories, posts et stats de ce profil.</p>
            </div>
          )}

          {isOwner && followRequests.some((r) => r.status === "pending") && (
          <div className="uq-profile-card">
            <h2 className="uq-profile-section-title">Demandes d’abonnement</h2>
            {followRequests
              .filter((r) => r.status === "pending")
              .map((r) => (
                <div key={r.id} className="profile-request-row">
                  <div>@{r.fromUid.slice(0, 8)}</div>
                  <div className="profile-request-actions">
                    <button onClick={() => handleAccept(r.id)}>Accepter</button>
                    <button onClick={() => handleDecline(r.id)}>Refuser</button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {(!isPrivate || canViewPrivate) && (
          <>
            <section className="uq-profile-card profile-identity-card" ref={postsSectionRef}>
              <div className="uq-profile-section-head">
                <h2 className="uq-profile-section-title">Identité</h2>
                <span className="profile-hint">
                  Ta biographie, tes obsessions urbex et tes spots fétiches.
                </span>
              </div>
              <p className="uq-profile-bio">
                {safeProfile.bio ||
                  "Parle de ton univers urbex, de ce que tu recherches, et des vibes qui te font vibrer dans les lieux abandonnés."}
              </p>

              <div className="uq-profile-subtitle">Types de spots préférés</div>
              <div className="uq-profile-tags">
                {(safeProfile.favoriteSpotTypes || ["others"]).map((t) => (
                  <span key={t} className="uq-profile-tag">
                    {SPOT_TYPE_LABELS[t] || t}
                  </span>
                ))}
              </div>
            </section>

            <section className="uq-profile-card uq-profile-share">
              <h2 className="uq-profile-section-title">QR Profil</h2>
              <p className="profile-hint">Partage ta fiche UrbexQueens</p>
              <div className="uq-profile-qr-image">
                <img src={qrUrl} alt="QR code profil" />
              </div>
              <button
                type="button"
                className="uq-share-btn"
                onClick={handleShareProfileQr}
              >
                🔗 Partager
              </button>
              <a className="uq-profile-qr-button" href={qrUrl} download>
                Télécharger
              </a>
            </section>

            <section className="uq-profile-section">
              <h2 className="uq-profile-section-title">🏆 Badges</h2>
              <div className="uq-profile-badges-list">
                {ALL_BADGES.map((badge) => {
                  const unlocked = unlockedBadges.find((b) => b.id === badge.id)?.unlocked || false;
                  return (
                    <BadgeItem
                      key={badge.id}
                      icon={badge.icon}
                      label={badge.label}
                      description={badge.description}
                      unlockHint={badge.unlockHint}
                      unlocked={unlocked}
                    />
                  );
                })}
              </div>
            </section>

            <section className="uq-profile-section profile-achievements-card">
              <div className="uq-profile-section-head">
                <h2 className="uq-profile-section-title">
                  Achievements
                  <span className="profile-section-count">
                    {achievementsUnlockedCount}/{ACHIEVEMENTS.length}
                  </span>
                </h2>
                <span className="profile-hint">
                  {achievementsUnlockedCount > 0
                    ? `Tu as débloqué ${achievementsUnlockedCount} achievements.`
                    : "Débloque des achievements en marquant tes runs et en accumulant l’XP."}
                </span>
              </div>
              <div className="profile-achievement-grid">
                {achievementTiles.map((achievement) => (
                  <AchievementCard
                    key={achievement.id}
                    id={achievement.id}
                    icon={achievement.icon}
                    title={achievement.title}
                    description={achievement.description}
                    unlockHint={achievement.unlockHint}
                    xp={achievement.xp}
                    tier={achievement.tier}
                    proOnly={achievement.proOnly ?? false}
                    unlocked={achievement.unlocked}
                    unlockedAt={achievement.unlockedAt}
                  />
                ))}
              </div>
            </section>

            <section className="uq-profile-card uq-profile-explore-card">
              <div className="uq-profile-section-head">
                <h2 className="uq-profile-section-title">Explorations</h2>
                <span className="profile-hint">Mini-feed visuel de tes runs urbex</span>
              </div>
              <div className="uq-profile-explore-grid">
                {featuredVisited.map((p) => {
                  const thumb = p.historyImages?.[0];
                  return (
                    <a key={p.id} className="uq-profile-explore-item" href={`/spot/${p.id}`}>
                      <div
                        className="uq-profile-explore-thumb"
                        style={thumb ? { backgroundImage: `url(${thumb})` } : undefined}
                        aria-hidden
                      />
                      <div className="uq-profile-explore-title">{p.title}</div>
                    </a>
                  );
                })}
                {featuredVisited.length === 0 && (
                  <div className="uq-profile-explore-empty">
                    {isOwner
                      ? "Ajoute tes premières explorations pour montrer ton style."
                      : "Aucune exploration partagée pour le moment."}
                  </div>
                )}
              </div>
            </section>

            <section className="uq-profile-card profile-posts-section">
              <div className="uq-profile-section-head">
                <h2 className="uq-profile-section-title">Posts urbex</h2>
                {postsLoading && <Skeleton className="profile-hint-skeleton" />}
              </div>
              <ProfilePostsGrid
                posts={profilePosts}
                loading={postsLoading}
                onSelect={(p) => setSelectedPost(p)}
                emptyMessage={isOwner ? "Partage ton premier post urbex." : "Aucun post pour l’instant."}
              />
            </section>

            <section className="uq-profile-card" ref={visitedSectionRef}>
              <div className="uq-profile-section-head">
                <h2 className="uq-profile-section-title">
                  Spots faits
                  <span className="profile-section-count">
                    {visibleVisited.length}
                  </span>
                </h2>
                <span className="profile-hint">
                  Ton journal d’explorations urbex et les lieux déjà cochés.
                </span>
              </div>
              {canShowVisited ? (
                visibleVisited.length > 0 ? (
                  <div className="profile-visited-list">
                    {visibleVisited.map(renderSpotItem)}
                  </div>
                ) : (
                  <p className="profile-hint">
                    Aucun spot visité pour le moment.
                  </p>
                )
              ) : (
                <p className="profile-hint">
                  Les spots visités sont masqués par ce membre.
                </p>
              )}
            </section>

            <section className="uq-profile-card" ref={favoritesSectionRef}>
              <div className="uq-profile-section-head">
                <h2 className="uq-profile-section-title">
                  Favoris
                  <span className="profile-section-count">
                    {canShowFavorites ? visibleSaved.length : 0}
                  </span>
                </h2>
                <span className="profile-hint">
                  Les lieux que tu as gardés précieusement.
                </span>
              </div>
              {canShowFavorites ? (
                visibleSaved.length > 0 ? (
                  <div className="profile-visited-list">
                    {visibleSaved.map(renderSpotItem)}
                  </div>
                ) : (
                  <p className="profile-hint">
                    Aucun favori pour l’instant.
                  </p>
                )
              ) : (
                <p className="profile-hint">
                  Les favoris sont masqués par ce membre.
                </p>
              )}
            </section>
          </>
        )}
        </div>
        
        {isOwner && (
          <div className="uq-profile-card profile-edit-shell">
            <div className="profile-edit-header">
              <div>
                <h2 className="uq-profile-section-title">✏️ Editer mon profil</h2>
                <p className="profile-hint">Ajuste ta bio, tes visuels et ce qui reste privé.</p>
              </div>
              <button
                type="button"
                className="uq-profile-edit-pill"
                onClick={() => setEditing((v) => !v)}
              >
                {editing ? "Fermer" : "Editer mon profil"}
              </button>
            </div>
            {editing && (
              <form className="profile-edit-form" onSubmit={handleSaveProfile}>
                <div className={`profile-accordion ${editSections.bio ? "is-open" : ""}`}>
                  <button
                    type="button"
                    className="profile-accordion-trigger"
                    onClick={() => toggleSection("bio")}
                  >
                    <span>Bio</span>
                    <span className="profile-accordion-chevron">{editSections.bio ? "−" : "+"}</span>
                  </button>
                  {editSections.bio && (
                    <div className="profile-accordion-panel">
                      <label className="profile-edit-row">
                        <span>Bio</span>
                        <textarea
                          value={formBio}
                          onChange={(e) => setFormBio(e.target.value)}
                          rows={4}
                          placeholder="Parle de ton univers urbex, de ce que tu recherches, et des vibes qui te font vibrer dans les lieux abandonnés."
                        />
                      </label>
                    </div>
                  )}
                </div>

                <div className={`profile-accordion ${editSections.media ? "is-open" : ""}`}>
                  <button
                    type="button"
                    className="profile-accordion-trigger"
                    onClick={() => toggleSection("media")}
                  >
                    <span>Photo / Bannière</span>
                    <span className="profile-accordion-chevron">{editSections.media ? "−" : "+"}</span>
                  </button>
                  {editSections.media && (
                    <div className="profile-accordion-panel">
                      <label className="profile-edit-row" htmlFor={PROFILE_PHOTO_INPUT_ID}>
                        <span>URL Photo</span>
                        <input
                          id={PROFILE_PHOTO_INPUT_ID}
                          value={formPhoto}
                          onChange={(e) => setFormPhoto(e.target.value)}
                          placeholder="https://…"
                        />
                      </label>

                      <label className="profile-edit-row" htmlFor={PROFILE_BANNER_INPUT_ID}>
                        <span>URL Bannière</span>
                        <input
                          id={PROFILE_BANNER_INPUT_ID}
                          value={formBanner}
                          onChange={(e) => setFormBanner(e.target.value)}
                          placeholder="https://…"
                        />
                      </label>
                    </div>
                  )}
                </div>

                <div className={`profile-accordion ${editSections.privacy ? "is-open" : ""}`}>
                  <button
                    type="button"
                    className="profile-accordion-trigger"
                    onClick={() => toggleSection("privacy")}
                  >
                    <span>Profil privé</span>
                    <span className="profile-accordion-chevron">{editSections.privacy ? "−" : "+"}</span>
                  </button>
                  {editSections.privacy && (
                    <div className="profile-accordion-panel">
                      <label
                        className="profile-edit-row profile-privacy-toggle"
                        htmlFor={PROFILE_PRIVACY_TOGGLE_ID}
                        aria-label="Rendre mon profil privé"
                      >
                        <div className="uq-toggle">
                          <input
                            id={PROFILE_PRIVACY_TOGGLE_ID}
                            type="checkbox"
                            checked={formPrivate}
                            onChange={(e) => setFormPrivate(e.target.checked)}
                          />
                          <span className="uq-toggle-track" />
                          <span className="uq-toggle-thumb" />
                        </div>
                        <div>
                          <div className="profile-edit-label">Rendre mon profil privé</div>
                          <p className="profile-hint">
                            Cache tes stats et posts aux non-abonnés. Les demandes devront être validées.
                          </p>
                        </div>
                      </label>
                    </div>
                  )}
                </div>

                <div className={`profile-accordion ${editSections.favs ? "is-open" : ""}`}>
                  <button
                    type="button"
                    className="profile-accordion-trigger"
                    onClick={() => toggleSection("favs")}
                  >
                    <span>Types de spots préférés</span>
                    <span className="profile-accordion-chevron">{editSections.favs ? "−" : "+"}</span>
                  </button>
                  {editSections.favs && (
                    <div className="profile-accordion-panel">
                      <div className="profile-fav-grid">
                        {FAVORITE_OPTIONS.map((opt) => (
                          <label
                            key={opt}
                            className={`profile-fav-chip ${formFavs.includes(opt) ? "is-selected" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={formFavs.includes(opt)}
                              onChange={() => toggleFav(opt)}
                            />
                            <div className="profile-fav-icon">✨</div>
                            <span>{SPOT_TYPE_LABELS[opt] || opt}</span>
                            <span className="profile-fav-check">✓</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {editError && <p className="map-add-alert">{editError}</p>}

                <div className="profile-edit-actions">
                  <button
                    type="button"
                    className="profile-cancel"
                    onClick={() => {
                      setEditing(false);
                      setFormBio(safeProfile.bio || "");
                      setPhotoSafely(safeProfile.photoURL);
                      setBannerSafely(safeProfile.bannerURL);
                      setFormFavs(safeProfile.favoriteSpotTypes || []);
                      setFormPrivate(!!safeProfile.isPrivate);
                      setFormAvatarCropX(safeProfile.avatarCropX ?? 0);
                      setFormAvatarCropY(safeProfile.avatarCropY ?? 0);
                      setFormAvatarZoom(safeProfile.avatarZoom ?? 1);
                      setFormAvatarMode(safeProfile.avatarMode ?? "cover");
                    }}
                  >
                    Annuler
                  </button>
                  <button type="submit" className="story-map-btn profile-save-btn" disabled={saving}>
                    {saving ? "Enregistrement..." : "Sauvegarder"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {isCropModalOpen && (
      <div
        className="avatar-crop-modal"
        role="button"
        tabIndex={0}
        aria-label="Fermer la modale de recadrage de l’avatar"
        onClick={handleAvatarBackdropClick}
        onKeyDown={handleAvatarBackdropKeyDown}
      >
        <div
          className="avatar-crop-modal-content"
          role="dialog"
          aria-modal="true"
          aria-label="Recadrer l’avatar"
        >
            <header className="avatar-crop-modal-header">
              <div>
                <strong>Recadrer l’avatar</strong>
                <p>Glisse l’image et ajuste le zoom pour centrer ton logo.</p>
              </div>
              <button
                type="button"
                className="avatar-crop-modal-close"
                onClick={closeCropModal}
                aria-label="Fermer"
              >
                ×
              </button>
            </header>
            <div
              className="avatar-crop-preview"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <div
                className="avatar-crop-preview-inner"
                style={{
                  transform: `translate(${modalCrop.x}px, ${modalCrop.y}px) scale(${modalZoom})`,
                }}
              >
                {croppingImage ? (
                  <img
                    src={croppingImage}
                    alt={`Avatar de ${displayName}`}
                    loading="lazy"
                    style={{
                      objectFit: formAvatarMode === "logo" ? "contain" : "cover",
                    }}
                  />
                ) : (
                  <span>{avatarLetter}</span>
                )}
              </div>
            </div>
            <div className="avatar-crop-controls">
              <label className="avatar-crop-slider">
                <span>
                  Zoom
                  <strong>{modalZoom.toFixed(2)}x</strong>
                </span>
                <input
                  type="range"
                  min={1}
                  max={2}
                  step={0.01}
                  value={modalZoom}
                  onChange={(event) => setModalZoom(Number(event.target.value))}
                />
              </label>
              <label className="avatar-crop-checkbox">
                <input
                  type="checkbox"
                  checked={formAvatarMode === "logo"}
                  onChange={(event) =>
                    setFormAvatarMode(
                      event.target.checked ? "logo" : "cover"
                    )
                  }
                />
                <span>Logo mode (contain)</span>
              </label>
            </div>
            <div className="avatar-crop-actions">
              <button
                type="button"
                className="avatar-crop-btn avatar-crop-btn--ghost"
                onClick={closeCropModal}
              >
                Annuler
              </button>
              <button
                type="button"
                className="avatar-crop-btn avatar-crop-btn--primary"
                onClick={handleCropSave}
              >
                Enregistrer
              </button>
            </div>
            <div className="avatar-crop-upload">
              <button
                type="button"
                className="avatar-crop-btn avatar-crop-btn--upload"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
              >
                {avatarUploading ? "Upload..." : "Importer une nouvelle photo"}
              </button>
            </div>
          </div>
        </div>
      )}
      {selectedPost && (
        <ProfilePostModal post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}
    </div>
  );
}
