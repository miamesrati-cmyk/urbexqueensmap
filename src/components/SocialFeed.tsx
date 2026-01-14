import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { v4 as uuid } from "uuid";
import { auth } from "../lib/firebase";
import {
  listenPlacesPage,
  type Place,
  type PlacesPageCursor,
} from "../services/places";
import {
  addPostComment,
  createPost,
  createStory,
  fetchMorePosts,
  listenPostComments,
  listenPosts,
  listenStories,
  togglePostReaction,
  toggleStoryReaction,
  type Post,
  type PostComment,
  type Story,
} from "../services/social";
import { uploadUrbexMedia } from "../services/storage";
import { listenFollowing, type Follow } from "../services/follows";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import { useLiveUserProfile, useLiveUserProfiles } from "../hooks/useLiveUserProfiles";
import type { LiveUserProfileSummary } from "../hooks/useLiveUserProfiles";
import { shareLink } from "../utils/share";
import { describeStorageError } from "../utils/uploadErrors";
import UrbexFeedUserSearch from "./UrbexFeed/UserSearch";
import UQImage from "./UQImage";
import { QuickReactions } from "./feed/interactions/QuickReactions";
import PullToRefreshIndicator from "./ui/PullToRefreshIndicator";
import Skeleton from "./Skeleton";
import { FeedPostCardSkeleton } from "./skeletons/LayoutSkeletons";
import { useAuthUI } from "../contexts/useAuthUI";
import type { RequireAuthOptions } from "../contexts/authUICore";
import { useToast } from "../contexts/useToast";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { DoubleTapLike } from "./feed/interactions/DoubleTapLike";
import { SaveButton } from "./feed/interactions/SaveButton";
import { listenSavedPostIds } from "../services/savedPosts";
import {
  listenLikedPostIds,
  likePostForUser,
  unlikePostForUser,
} from "../services/postsLikes";
import { ImageCarousel } from "./feed/interactions/ImageCarousel";
import type { MediaItem as CarouselMediaItem } from "./feed/interactions/ImageCarousel";
import { AutoPlayVideo } from "./feed/interactions/AutoPlayVideo";
import { ViewTracker } from "./feed/interactions/ViewTracker";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";

type ReactionHandler = (emoji: string) => void;

type FeedMode = "all" | "following" | "mine";

const FEED_MODES: { id: FeedMode; label: string }[] = [
  { id: "all", label: "Tous les posts" },
  { id: "following", label: "Comptes suivis" },
  { id: "mine", label: "Mes posts" },
];

const PLACES_PAGE_SIZE = 60;
const VIDEO_URL_REGEX = /\.(mp4|mov|webm|mkv|ogv|ogg)(\?.*)?$/i;

function relativeTime(timestamp: number) {
  const diff = Date.now() - timestamp;
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 0) return `Il y a ${day} jour${day > 1 ? "s" : ""}`;
  if (hr > 0) return `Il y a ${hr} h`;
  if (min > 0) return `Il y a ${min} min`;
  return "À l’instant";
}

function getLocationLabel(post: Post) {
  if (post.location?.label) return post.location.label;
  if (post.location?.placeId) return "Spot lié";
  if (post.location) {
    return `Lat ${post.location.lat.toFixed(3)}, Lng ${post.location.lng.toFixed(3)}`;
  }
  return "";
}

function FeedPostTile({
  post,
  onOpen,
  isSaved,
  isLiked,
  onToggleLike,
  onRequireAuthForSave,
  onRequireAuthForLike,
  onReact,
  currentUserId,
  isGuest,
}: {
  post: Post;
  onOpen: (post: Post) => void;
  isSaved: boolean;
  isLiked: boolean;
  onToggleLike: (next: boolean) => Promise<void>;
  onRequireAuthForSave?: () => void;
  onRequireAuthForLike?: () => void;
  onReact: (emoji: string) => Promise<void>;
  currentUserId: string | null;
  isGuest: boolean;
}) {
  type CarouselMedia = CarouselMediaItem & { type: "image" | "video" };
  const mediaItems: CarouselMedia[] = useMemo(
    () =>
      post.mediaUrls.map((url) => ({
        url,
        alt: post.caption || "Post urbex",
        type: VIDEO_URL_REGEX.test(url) ? "video" : "image",
      })),
    [post.mediaUrls, post.caption]
  );
  const carouselBase: CarouselMediaItem[] = useMemo(
    () => mediaItems.map(({ url, alt }) => ({ url, alt })),
    [mediaItems]
  );
  const coverItem = mediaItems[0];
  const reactionTotal = Object.values(post.reactions || {}).reduce(
    (acc, v) => acc + (v || 0),
    0
  );
  const commentCount = post.commentsCount ?? 0;
  const authorName = post.authorName || "Urbex Queen";
  const avatarInitial = authorName.charAt(0).toUpperCase();
  const locationLabel = getLocationLabel(post);
  const isProAuthor = post.authorIsPro;
  const captionText = post.caption?.trim() || "Aucune légende pour ce moment.";
  const timestamp = relativeTime(post.createdAt);
  const commentSnippets =
    captionText && captionText !== "Aucune légende pour ce moment."
      ? captionText
          .split(/[\.\n]/)
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 2)
      : [];
  const commentRows =
    commentSnippets.length > 0 ? commentSnippets : ["Fragments de terrain", "Traces humaines"];
  const currentReaction =
    currentUserId && post.userReactions
      ? post.userReactions[currentUserId] ?? null
      : null;

  const renderCarouselImage = useCallback(
    (item: CarouselMediaItem, idx: number, isActive: boolean) => {
      const mediaItem = mediaItems[idx];
      if (mediaItem?.type === "video") {
        return (
          <AutoPlayVideo
            src={mediaItem.url}
            className="feed-post-cover"
            threshold={0.65}
          />
        );
      }

      const image = (
        <UQImage
          src={mediaItem?.url ?? item.url}
          alt={mediaItem?.alt ?? item.alt ?? "Post urbex"}
          className="feed-post-cover"
        />
      );

      if (!isActive) {
        return image;
      }

      return (
        <DoubleTapLike
          postId={post.id}
          isLiked={isLiked}
          likeCount={reactionTotal}
          onRequireAuth={onRequireAuthForLike}
          onToggleLike={onToggleLike}
          className="feed-post-media-surface"
        >
          {image}
        </DoubleTapLike>
      );
    },
    [isLiked, onRequireAuthForLike, onToggleLike, post.id, reactionTotal, mediaItems]
  );

  return (
    <ViewTracker postId={post.id}>
      <div
        role="button"
        tabIndex={0}
        className="feed-post-card"
        onClick={() => onOpen(post)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen(post);
          }
        }}
        aria-label="Ouvrir le post urbex"
      >
      <header className="feed-post-card-header">
        <div className="feed-card-avatar">
          {post.authorAvatar ? (
            <UQImage src={post.authorAvatar} alt={authorName} />
          ) : (
            <span>{avatarInitial}</span>
          )}
        </div>
        <div className="feed-card-meta">
          <div className="feed-card-name-row">
            <strong className="feed-card-name">{authorName}</strong>
            {isProAuthor && <span className="feed-card-pro">PRO</span>}
          </div>
          <span className="feed-card-time">{timestamp}</span>
          {locationLabel && (
            <span className="feed-card-sub">{locationLabel}</span>
          )}
        </div>
      </header>

      <div className="feed-post-media">
        {mediaItems.length > 1 ? (
          <ImageCarousel
            media={carouselBase}
            aspect="auto"
            renderImage={renderCarouselImage}
          />
        ) : coverItem ? (
          coverItem.type === "video" ? (
            <AutoPlayVideo
              src={coverItem.url}
              className="feed-post-cover"
            />
          ) : (
            <DoubleTapLike
              postId={post.id}
              isLiked={isLiked}
              likeCount={reactionTotal}
              onRequireAuth={onRequireAuthForLike}
              onToggleLike={onToggleLike}
              className="feed-post-media-surface"
            >
              <UQImage
                src={coverItem.url}
                alt={coverItem.alt || "Post urbex"}
                className="feed-post-cover"
              />
            </DoubleTapLike>
          )
        ) : (
          <div className="feed-post-placeholder">📸</div>
        )}
      </div>

      <div className="feed-post-actions">
        <QuickReactions
          postId={post.id}
          currentReaction={currentReaction}
          onRequireAuth={onRequireAuthForLike}
          onReact={async (emoji: string) => onReact(emoji)}
          isGuest={isGuest}
        >
          <button
            type="button"
            className={`feed-post-reaction-btn ${currentReaction ? "is-active" : ""}`}
            onClick={() => onReact("🖤")}
            aria-label="Aimer ce post"
            aria-pressed={!!currentReaction}
            disabled={isGuest}
          >
            {currentReaction || "🤍"} {reactionTotal}
          </button>
        </QuickReactions>
        <span>💬 {commentCount}</span>
        <SaveButton
          postId={post.id}
          initialSaved={isSaved}
          onRequireAuth={onRequireAuthForSave}
          className="feed-post-save-btn"
        />
        <span>🔗</span>
      </div>

      <div className="feed-caption-block">
        <p className="feed-caption-line">{captionText}</p>
        <button
          type="button"
          className="feed-caption-more"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(post);
          }}
        >
          Voir plus
        </button>
      </div>

      <div className="feed-comment-section">
        <div className="feed-comment-preview">
          {commentRows.map((line, idx) => (
            <span key={line + idx} className="feed-comment-line">
              {line}
            </span>
          ))}
        </div>
        <button
          type="button"
          className="feed-comment-link"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(post);
          }}
        >
          Voir tous les commentaires
          {commentCount > 0 ? ` (${commentCount})` : " · 0"}
        </button>
      </div>

      <div
        className="feed-comment-input"
        onClick={(event) => {
          event.stopPropagation();
          onOpen(post);
        }}
      >
        <input
          type="text"
          readOnly
          aria-label="Ajouter un commentaire"
          placeholder="Ajouter un commentaire…"
        />
        <span aria-hidden="true">↗</span>
      </div>
      </div>
    </ViewTracker>
  );
}

// Mémoïser pour éviter re-renders inutiles
const MemoizedFeedPostTile = memo(FeedPostTile, (prev, next) => {
  return (
    prev.post.id === next.post.id &&
    prev.post.createdAt === next.post.createdAt &&
    prev.isSaved === next.isSaved &&
    prev.isLiked === next.isLiked &&
    prev.currentUserId === next.currentUserId
  );
});

function applyOptimisticReaction(post: Post, userId: string, emoji: string) {
  const counts: Record<string, number> = { ...(post.reactions || {}) };
  const userReactions = { ...(post.userReactions || {}) };
  const previous = userReactions[userId];

  if (previous === emoji) {
    counts[emoji] = Math.max((counts[emoji] ?? 1) - 1, 0);
    delete userReactions[userId];
  } else {
    counts[emoji] = (counts[emoji] ?? 0) + 1;
    userReactions[userId] = emoji;
    if (previous) {
      counts[previous] = Math.max((counts[previous] ?? 1) - 1, 0);
    }
  }

  return {
    ...post,
    reactions: counts,
    userReactions,
  };
}

type FilterChoice = { id: string; label: string; desc: string };

function FeedPostModal({
  post,
  currentUser,
  comments,
  commentDraft,
  onDraftChange,
  onSendComment,
  onReact,
  onClose,
  onShare,
  onNavigateProfile,
  profiles,
  isGuest,
  onRequireAuth,
}: {
  post: Post;
  currentUser: User | null;
  comments: PostComment[];
  commentDraft: string;
  onDraftChange: (value: string) => void;
  onSendComment: () => void;
  onReact: ReactionHandler;
  onClose: () => void;
  onShare: () => void;
  onNavigateProfile: (username: string | null, uid: string) => void;
  profiles: Record<string, LiveUserProfileSummary>;
  isGuest: boolean;
  onRequireAuth: () => void;
}) {
  const reactionTotal = Object.values(post.reactions || {}).reduce(
    (acc, v) => acc + (v || 0),
    0
  );
  const isLiked = post.userReactions?.[currentUser?.uid || ""] === "🖤";
  const locationLabel = getLocationLabel(post);
  const mediaUrl = post.mediaUrls[0];
  const commentInputRef = useRef<HTMLInputElement | null>(null);
  const modalDetailsRef = useRef<HTMLDivElement | null>(null);
  const authorProfile = profiles[post.userId];
  const authorDisplayName =
    authorProfile?.displayName ?? post.authorName ?? "Urbex Queen";
  const authorNavigationUsername = authorProfile?.username ?? post.authorUsername ?? "";
  const authorHandle = authorNavigationUsername ? `@${authorNavigationUsername}` : null;
  const authorAvatar = authorProfile?.photoURL ?? post.authorAvatar;
  const authorIsPro = authorProfile?.isPro ?? post.authorIsPro ?? false;

  // Forcer le scroll en haut du modal quand il s'ouvre
  useEffect(() => {
    // Réinitialiser immédiatement
    if (modalDetailsRef.current) {
      modalDetailsRef.current.scrollTop = 0;
    }
    
    // Puis après le rendu avec requestAnimationFrame
    requestAnimationFrame(() => {
      if (modalDetailsRef.current) {
        modalDetailsRef.current.scrollTop = 0;
      }
    });
    
    // Et une dernière fois avec un petit délai pour être sûr
    const timer = setTimeout(() => {
      if (modalDetailsRef.current) {
        modalDetailsRef.current.scrollTop = 0;
      }
    }, 10);
    
    return () => clearTimeout(timer);
  }, [post.id]);

  return (
    <div className="feed-post-modal">
      <div className="feed-post-modal-backdrop" onClick={onClose} />
      <div className="feed-post-modal-card" role="dialog" aria-modal="true">
        <div className="feed-post-modal-media">
          {mediaUrl ? (
            <UQImage
              src={mediaUrl}
              alt=""
              className="feed-post-modal-image"
            />
          ) : (
            <div className="feed-post-modal-placeholder">📸</div>
          )}
          <div className="feed-post-modal-noise" />
          {post.mediaUrls.length > 1 && (
            <span className="feed-post-modal-more">+{post.mediaUrls.length - 1}</span>
          )}
        </div>
        <div className="feed-post-modal-details" ref={modalDetailsRef}>
          <div className="feed-post-modal-header">
            <button
              type="button"
              className="feed-post-modal-author feed-post-modal-author-link"
              onClick={() =>
                onNavigateProfile(authorNavigationUsername, post.userId)
              }
            >
              <div className="ig-avatar">
                {authorAvatar ? (
                  <UQImage src={authorAvatar} alt={authorDisplayName} />
                ) : (
                  <span>{(authorDisplayName || "U")[0].toUpperCase()}</span>
                )}
              </div>
              <div className="feed-post-modal-author-texts">
                <span className="feed-post-modal-username">
                  {authorDisplayName}
                </span>
                {authorHandle && (
                  <small className="feed-post-modal-handle">{authorHandle}</small>
                )}
              </div>
              {authorIsPro && <span className="feed-post-modal-pro">PRO ✨</span>}
            </button>
            <div className="feed-post-modal-header-actions">
              <button
                type="button"
                className="feed-post-modal-share"
                onClick={(event) => {
                  event.stopPropagation();
                  onShare();
                }}
                aria-label="Partager le post"
              >
                🔗
              </button>
              <button
                type="button"
                className="feed-post-modal-close"
                onClick={onClose}
                aria-label="Fermer le post"
              >
                ✕
              </button>
            </div>
          </div>

          <p className="feed-post-modal-caption">{post.caption || "Aucune légende"}</p>
          {locationLabel && (
            <p className="feed-post-modal-location">📍 {locationLabel}</p>
          )}
          <div className="feed-post-modal-meta">
            <span>{relativeTime(post.createdAt)}</span>
          </div>

          <div className="feed-post-modal-actions">
            <button
              type="button"
              className={`modal-like-btn ${isLiked ? "is-active" : ""}`}
              onClick={() => {
                if (isGuest) {
                  onRequireAuth();
                  return;
                }
                onReact("🖤");
              }}
              aria-disabled={isGuest}
            >
              {isLiked ? "❤️" : "🤍"} {reactionTotal}
            </button>
            <button
              type="button"
              className="modal-comment-btn"
              onClick={() => {
                if (isGuest) {
                  onRequireAuth();
                  return;
                }
                commentInputRef.current?.focus();
              }}
              aria-disabled={isGuest}
            >
              🗨️ Commentaires
            </button>
          </div>

          <div className="feed-post-modal-comment-block">
            {comments.length === 0 ? (
              <p className="feed-post-modal-comment-empty">Commentaires à venir…</p>
            ) : (
              comments.map((comment) => {
                const commenterProfile = profiles[comment.userId];
                const commenterName =
                  commenterProfile?.displayName ??
                  commenterProfile?.username ??
                  comment.displayName ??
                  comment.username ??
                  "Exploratrice";
                const commenterHandle = commenterProfile?.username
                  ? `@${commenterProfile.username}`
                  : null;
                const handleCommenterClick = () => {
                  onNavigateProfile(commenterProfile?.username ?? null, comment.userId);
                };
                return (
                  <div key={comment.id} className="feed-post-modal-comment">
                    <button
                      type="button"
                      className="feed-post-modal-comment-username"
                      onClick={handleCommenterClick}
                    >
                      {commenterName}
                      {commenterHandle && (
                        <small className="feed-post-modal-handle">{commenterHandle}</small>
                      )}
                    </button>
                    <span>{comment.text}</span>
                  </div>
                );
              })
            )}

            {isGuest ? (
              <div className="feed-comment-guard">
                <p>Connecte-toi pour commenter ce spot.</p>
                <button type="button" onClick={onRequireAuth}>
                  Se connecter
                </button>
              </div>
            ) : (
              <div className="feed-post-modal-comment-form">
                <input
                  ref={commentInputRef}
                  value={commentDraft}
                  onChange={(event) => onDraftChange(event.target.value)}
                  placeholder="Écris un commentaire..."
                />
                <button
                  type="button"
                  onClick={onSendComment}
                  disabled={!commentDraft.trim()}
                >
                  Envoyer
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
const FILTERS: FilterChoice[] = [
  { id: "grunge", label: "Grunge", desc: "Contraste dur + grain sale" },
  { id: "glitch", label: "Glitch", desc: "Teintes froides et décalage RGB" },
  { id: "vhs", label: "VHS", desc: "Dé-saturation + lignes VHS" },
  { id: "film35", label: "Film 35mm", desc: "Chaleur vintage + vignette" },
];

const CHALLENGES = [
  {
    id: "weekly",
    title: "Défi de la semaine",
    desc: "Trouve un escalier monumental et capture-le de nuit.",
    tag: "Legend",
    reward: "+150 XP",
  },
  {
    id: "ghost",
    title: "Défi paranormal",
    desc: "Explore un lieu hanté classé Ghost (reste safe).",
    tag: "Ghost",
    reward: "+200 XP",
  },
  {
    id: "speedrun",
    title: "Speedrun Urbex",
    desc: "Visite 3 spots en 24h sans te faire repérer.",
    tag: "Rush",
    reward: "+120 XP",
  },
];

const POST_FLOW_STEPS = [
  { id: 1, label: "A. Sélection média" },
  { id: 2, label: "B. Édition / crop" },
  { id: 3, label: "C. Preview + infos" },
  { id: 4, label: "D. Publier" },
];

const STORY_FLOW_STEPS = [
  { id: 1, label: "A. Choisir un visuel" },
  { id: 2, label: "B. Ajuster + frame" },
  { id: 3, label: "C. Ajouter un texte" },
  { id: 4, label: "D. Publier" },
];

const POST_FLOW_RATIOS = [
  { id: "1-1", label: "1:1" },
  { id: "4-5", label: "4:5" },
  { id: "9-16", label: "9:16" },
];

const STORY_FLOW_RATIOS = [
  { id: "4-5", label: "4:5" },
  { id: "9-16", label: "9:16" },
];

export default function SocialFeed() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [places, setPlaces] = useState<Place[]>([]);
  const [placesLoading, setPlacesLoading] = useState(true);
  const [placesHasMore, setPlacesHasMore] = useState(true);
  const [placesLoadingMore, setPlacesLoadingMore] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [placesCursor, setPlacesCursor] = useState<PlacesPageCursor | null>(null);
  const placesAdditionalUnsubs = useRef<(() => void)[]>([]);
  const [livePosts, setLivePosts] = useState<Post[]>([]);
  const [olderPosts, setOlderPosts] = useState<Post[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const postsCursor = useRef<QueryDocumentSnapshot | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);
  const refreshPromiseRef = useRef<(() => void) | null>(null);

  const [stories, setStories] = useState<Story[]>([]);
  const [following, setFollowing] = useState<Follow[]>([]);
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [feedMode, setFeedMode] = useState<FeedMode>("all");
  const [postFlowOpen, setPostFlowOpen] = useState(false);
  const [postFlowStep, setPostFlowStep] = useState(1);
  const [postFlowRatio, setPostFlowRatio] = useState(
    POST_FLOW_RATIOS[1]?.id ?? "4-5"
  );
  const [postFlowZoom, setPostFlowZoom] = useState(1);
  const [postFlowOffset, setPostFlowOffset] = useState({ x: 0, y: 0 });
  const [postPreviewUrl, setPostPreviewUrl] = useState<string | null>(null);
  const [postCoverFrame, setPostCoverFrame] = useState(0);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [caption, setCaption] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [locationLat, setLocationLat] = useState("");
  const [locationLng, setLocationLng] = useState("");
  const [linkedPlaceId, setLinkedPlaceId] = useState("");
  const [filter, setFilter] = useState<string>("grunge");
  const [uploadingPost, setUploadingPost] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const [storyFile, setStoryFile] = useState<File | null>(null);
  const [storyText, setStoryText] = useState("");
  const [storyMusic, setStoryMusic] = useState("");
  const [storyUploading, setStoryUploading] = useState(false);
  const [storyError, setStoryError] = useState<string | null>(null);
  const [storyFlowOpen, setStoryFlowOpen] = useState(false);
  const [storyFlowStep, setStoryFlowStep] = useState(1);
  const [storyFlowRatio, setStoryFlowRatio] = useState(
    STORY_FLOW_RATIOS[1]?.id ?? "9-16"
  );
  const [storyFlowZoom, setStoryFlowZoom] = useState(1);
  const [storyFlowOffset, setStoryFlowOffset] = useState({ x: 0, y: 0 });
  const [storyPreviewUrl, setStoryPreviewUrl] = useState<string | null>(null);
  const [storyCoverFrame, setStoryCoverFrame] = useState(0);

  const [commentsMap, setCommentsMap] = useState<Record<string, PostComment[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const commentUnsubs = useRef<Record<string, () => void>>({});
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const preloadedUrls = useRef<Set<string>>(new Set());

  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [storyProgress, setStoryProgress] = useState(0);
  const [storyGlitch, setStoryGlitch] = useState(false);
  const storyRaf = useRef<number | null>(null);
  const storyStart = useRef<number>(0);
  const storySwipeStart = useRef<{ y: number; time: number } | null>(null);
  const toast = useToast();
  const storyFileInputRef = useRef<HTMLInputElement | null>(null);
  const postFileInputRef = useRef<HTMLInputElement | null>(null);
  const currentProfile = useLiveUserProfile(user?.uid ?? null);
  const isProUser = currentProfile?.isPro ?? false;
  const isGuest = !user;
  const { requireAuth } = useAuthUI();
  const ensureAuth = useCallback(
    async (options: RequireAuthOptions) => {
      if (user) return true;
      return requireAuth({
        mode: options.mode ?? "login",
        reason: options.reason,
        redirectTo: options.redirectTo,
      });
    },
    [requireAuth, user]
  );

  const requireAuthForSave = useCallback(() => {
    requireAuth({
      mode: "login",
      reason: "Connecte-toi pour sauvegarder un post",
    });
  }, [requireAuth]);

  const requireAuthForLike = useCallback(() => {
    requireAuth({
      mode: "login",
      reason: "Connecte-toi pour liker un post",
    });
  }, [requireAuth]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setFollowing([]);
      return;
    }
    const unsub = listenFollowing(user.uid, setFollowing);
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setSavedPostIds(new Set());
      return;
    }
    const unsubscribe = listenSavedPostIds(user.uid, (ids) => {
      setSavedPostIds(new Set(ids));
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setLikedPostIds(new Set());
      return;
    }
    const unsubscribe = listenLikedPostIds(user.uid, (ids) => {
      setLikedPostIds(new Set(ids));
    });
    return () => unsubscribe();
  }, [user]);

  const handleToggleLike = useCallback(
    async (postId: string, next: boolean) => {
      if (!user) {
        requireAuthForLike();
        return;
      }
      setLikedPostIds((prev) => {
        const copy = new Set(prev);
        if (next) {
          copy.add(postId);
        } else {
          copy.delete(postId);
        }
        return copy;
      });

      try {
        if (next) {
          await likePostForUser(user.uid, postId);
        } else {
          await unlikePostForUser(user.uid, postId);
        }
      } catch (error) {
        console.error("[SocialFeed] like toggle failed", error);
        setLikedPostIds((prev) => {
          const copy = new Set(prev);
          if (next) {
            copy.delete(postId);
          } else {
            copy.add(postId);
          }
          return copy;
        });
        toast.error("Impossible de mettre à jour ton like pour l’instant.");
      }
    },
    [requireAuthForLike, toast, user]
  );

  useEffect(() => {
    placesAdditionalUnsubs.current.forEach((fn) => fn());
    placesAdditionalUnsubs.current = [];
    setPlaces([]);
    setPlacesCursor(null);
    setPlacesHasMore(true);
    setPlacesError(null);
    setPlacesLoading(true);
    setPlacesLoadingMore(false);

    const unsub = listenPlacesPage(
      { pageSize: PLACES_PAGE_SIZE, isPro: isProUser },
      ({ places: nextPlaces, lastDoc }) => {
        setPlaces(nextPlaces);
        setPlacesCursor(lastDoc);
        setPlacesHasMore(!!lastDoc);
        setPlacesLoading(false);
      },
      (error) => {
        console.error("[SocialFeed] listenPlacesPage failed", error);
        setPlacesError("Impossible de charger les spots pour l’instant.");
        setPlacesLoading(false);
      }
    );

    return () => {
      unsub();
      placesAdditionalUnsubs.current.forEach((fn) => fn());
      placesAdditionalUnsubs.current = [];
    };
  }, [isProUser]);

  const loadMorePlaces = useCallback(() => {
    if (
      placesLoading ||
      placesLoadingMore ||
      !placesHasMore ||
      !placesCursor
    ) {
      return;
    }
    setPlacesLoadingMore(true);
    const unsub = listenPlacesPage(
      {
        pageSize: PLACES_PAGE_SIZE,
        cursor: placesCursor,
        isPro: isProUser,
      },
      ({ places: nextPlaces, lastDoc }) => {
        setPlaces((prev) => [...prev, ...nextPlaces]);
        setPlacesCursor(lastDoc);
        setPlacesHasMore(!!lastDoc);
        setPlacesLoadingMore(false);
        unsub();
      },
      (error) => {
        console.error("[SocialFeed] loadMorePlaces failed", error);
        setPlacesError("Impossible de charger plus de spots pour l’instant.");
        setPlacesLoadingMore(false);
        unsub();
      }
    );
    placesAdditionalUnsubs.current.push(unsub);
  }, [
    isProUser,
    placesCursor,
    placesHasMore,
    placesLoading,
    placesLoadingMore,
  ]);

  useEffect(() => {
    setLivePosts([]);
    setOlderPosts([]);
    postsCursor.current = null;
    setLoadingMore(false);
    setLoadingFeed(true);
    const unsub = listenPosts(15, (items, cursor) => {
      setLivePosts(items);
      postsCursor.current = cursor;
      setLoadingFeed(false);
      if (refreshPromiseRef.current) {
        refreshPromiseRef.current();
        refreshPromiseRef.current = null;
      }
    });
    return () => {
      unsub();
      if (refreshPromiseRef.current) {
        refreshPromiseRef.current();
        refreshPromiseRef.current = null;
      }
    };
  }, [feedRefreshKey]);

  const refreshFeed = useCallback(() => {
    if (refreshPromiseRef.current) {
      refreshPromiseRef.current();
    }
    setLivePosts([]);
    setOlderPosts([]);
    postsCursor.current = null;
    setLoadingMore(false);
    setLoadingFeed(true);
    return new Promise<void>((resolve) => {
      refreshPromiseRef.current = resolve;
      setFeedRefreshKey((prev) => prev + 1);
    });
  }, []);

  useEffect(() => {
    const unsub = listenStories(setStories);
    return () => unsub();
  }, []);

  useEffect(() => {
    const cleanupFns = Object.values(commentUnsubs.current);
    return () => {
      cleanupFns.forEach((fn) => fn());
    };
  }, []);

  const ensureComments = useCallback((postId: string) => {
    if (commentUnsubs.current[postId]) return;
    commentUnsubs.current[postId] = listenPostComments(postId, (items) => {
      setCommentsMap((prev) => ({ ...prev, [postId]: items }));
    });
  }, []);

  const releaseComments = useCallback((postId: string) => {
    const unsub = commentUnsubs.current[postId];
    if (unsub) {
      unsub();
      delete commentUnsubs.current[postId];
    }
  }, []);

  const closePostModal = useCallback(() => {
    setSelectedPost((prev) => {
      if (!prev) return null;
      releaseComments(prev.id);
      return null;
    });
  }, [releaseComments]);

  function openPostModal(post: Post) {
    if (selectedPost?.id && selectedPost.id !== post.id) {
      releaseComments(selectedPost.id);
    }
    ensureComments(post.id);
    setSelectedPost(post);
  }

  const handlePostDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const files = Array.from(event.dataTransfer.files);
      if (!files.length) return;
      const valid = files.filter(
        (file) => file.type.startsWith("image/") || file.type.startsWith("video/")
      );
      if (!valid.length) return;
      setMediaFiles(valid);
      setPostFlowStep(2);
    },
    []
  );

  const handlePostFileSelect = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const valid = Array.from(files).filter((file) =>
      file.type.startsWith("image/") || file.type.startsWith("video/")
    );
    if (!valid.length) return;
    setMediaFiles(valid);
    setPostFlowStep(2);
  }, []);

  const handleStoryDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const files = Array.from(event.dataTransfer.files);
      if (!files.length) return;
      const file = files.find(
        (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
      );
      if (!file) return;
      setStoryFile(file);
      setStoryFlowStep(2);
    },
    []
  );

  const handleStoryFileSelect = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const file = Array.from(files).find(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
    );
    if (!file) return;
    setStoryFile(file);
    setStoryFlowStep(2);
  }, []);

  const adjustPostOffset = useCallback((dx: number, dy: number) => {
    setPostFlowOffset((prev) => ({
      x: Math.max(-30, Math.min(30, prev.x + dx)),
      y: Math.max(-30, Math.min(30, prev.y + dy)),
    }));
  }, []);

  const adjustStoryOffset = useCallback((dx: number, dy: number) => {
    setStoryFlowOffset((prev) => ({
      x: Math.max(-30, Math.min(30, prev.x + dx)),
      y: Math.max(-30, Math.min(30, prev.y + dy)),
    }));
  }, []);

  useEffect(() => {
    if (!selectedPost) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePostModal();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [selectedPost, closePostModal]);

  const feedPosts = useMemo(() => {
    const ids = new Set<string>();
    const merged: Post[] = [];
    livePosts.forEach((p) => {
      ids.add(p.id);
      merged.push(p);
    });
    olderPosts.forEach((p) => {
      if (!ids.has(p.id)) merged.push(p);
    });
    return merged;
  }, [livePosts, olderPosts]);

  useEffect(() => {
    const urls = feedPosts.slice(0, 8).flatMap((p) => p.mediaUrls);
    urls.forEach((url) => {
      if (preloadedUrls.current.has(url)) return;
      preloadedUrls.current.add(url);
      if (url.match(/\\.(mp4|mov|webm|mkv)$/i)) {
        const v = document.createElement("video");
        v.src = url;
        v.preload = "metadata";
      } else {
        const img = new Image();
        img.src = url;
      }
    });
  }, [feedPosts]);

  useEffect(() => {
    if (!mediaFiles[0]) {
      setPostPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(mediaFiles[0]);
    setPostPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [mediaFiles]);

  useEffect(() => {
    if (!storyFile) {
      setStoryPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(storyFile);
    setStoryPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [storyFile]);

  const linkedPlace = places.find((p) => p.id === linkedPlaceId);
  const activeStory = stories[activeStoryIndex];
  const activeStoryIsVideo = !!activeStory?.mediaUrl.match(/\\.(mp4|mov|webm|mkv)$/i);
  const activePostMedia = mediaFiles[0];
  const activePostIsVideo = activePostMedia?.type.startsWith("video/");
  const followingIds = useMemo(
    () => new Set(following.map((f) => f.toUid)),
    [following]
  );
  const userUid = useMemo(() => user?.uid ?? null, [user?.uid]);
  const visiblePosts = useMemo(() => {
    if (feedMode === "following") {
      return feedPosts.filter((p) => followingIds.has(p.userId));
    }
    if (feedMode === "mine") {
      if (!userUid) return [];
      return feedPosts.filter((p) => p.userId === userUid);
    }
    return feedPosts;
  }, [feedPosts, feedMode, followingIds, userUid]);

  // Infinite scroll optimisé : charge 20 posts initiaux, puis 10 par 10
  const {
    visibleItems: paginatedPosts,
    hasMore,
    sentinelRef,
  } = useInfiniteScroll(visiblePosts, 20, 10);

  const commentAuthorIds = useMemo(() => {
    const ids = new Set<string>();
    Object.values(commentsMap).forEach((items) =>
      items.forEach((comment) => ids.add(comment.userId))
    );
    return Array.from(ids);
  }, [commentsMap]);

  const profileIds = useMemo(() => {
    const ids = new Set<string>();
    feedPosts.forEach((post) => ids.add(post.userId));
    commentAuthorIds.forEach((id) => ids.add(id));
    return Array.from(ids);
  }, [feedPosts, commentAuthorIds]);

  const profiles = useLiveUserProfiles(profileIds);

  const emptyStateTitle =
    feedMode === "mine" ? "Pas encore de posts." : "Aucun post pour l’instant.";
  const emptyStateSub =
    feedMode === "mine"
      ? "Partage ton premier post pour faire vibrer la communauté."
      : "Sois la première à ouvrir le bal.";

  const {
    attachSurface: attachFeedSurface,
    pullDistance: feedPullDistance,
    status: feedPullStatus,
  } = usePullToRefresh({
    onRefresh: refreshFeed,
    threshold: 70,
    minSpinnerTime: 800,
  });

  const handleCreatePost = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      const ok = await ensureAuth({
        reason: "Connecte-toi pour publier un post",
      });
      if (!ok || !user) return;
      if (!mediaFiles.length) {
        setPostError("Ajoute au moins une photo ou vidéo.");
        return;
      }

      setUploadingPost(true);
      setPostError(null);
      let success = false;
      try {
        const postId = uuid();
        const urls = await Promise.all(
          mediaFiles.map((f) => uploadUrbexMedia(user.uid, f, { postId }))
        );

        const parsedLat = parseFloat(locationLat);
        const parsedLng = parseFloat(locationLng);
        let location: {
          lat: number;
          lng: number;
          placeId?: string;
          label?: string;
        } | null = null;
        if (linkedPlace) {
          location = {
            lat: linkedPlace.lat,
            lng: linkedPlace.lng,
            placeId: linkedPlace.id,
            label: linkedPlace.title,
          };
        } else if (!Number.isNaN(parsedLat) && !Number.isNaN(parsedLng)) {
          location = {
            lat: parsedLat,
            lng: parsedLng,
            label: locationLabel || undefined,
          };
        } else if (locationLabel) {
          location = { lat: 0, lng: 0, label: locationLabel };
        }

        await createPost({
          userId: user.uid,
          mediaUrls: urls,
          caption,
          location,
          filter,
          authorName: user.displayName || user.email?.split("@")[0] || "exploratrice",
          authorAvatar: user.photoURL,
          authorUsername: currentProfile?.username ?? null,
          authorIsPro: isProUser,
          postId,
        });

        setMediaFiles([]);
        setCaption("");
        setLocationLabel("");
        setLocationLat("");
        setLocationLng("");
        setLinkedPlaceId("");
        setFilter("grunge");
        success = true;
      } catch (err: unknown) {
        const target = err as { code?: string; message?: string };
        console.error("[FeedUpload] failure", {
          code: target?.code,
          message: target?.message,
          err,
        });
        setPostError(describeStorageError(err, "Impossible de publier pour l’instant."));
      } finally {
        setUploadingPost(false);
      }
      return success;
    },
    [
      ensureAuth,
      user,
      mediaFiles,
      linkedPlace,
      locationLat,
      locationLng,
      locationLabel,
      caption,
      filter,
      currentProfile,
      isProUser,
    ]
  );

  const resetPostFlow = useCallback(() => {
    setPostFlowOpen(false);
    setPostFlowStep(1);
    setPostFlowZoom(1);
    setPostFlowOffset({ x: 0, y: 0 });
    setPostCoverFrame(0);
    setMediaFiles([]);
    setCaption("");
    setLocationLabel("");
    setLocationLat("");
    setLocationLng("");
    setLinkedPlaceId("");
    setFilter("grunge");
    setPostError(null);
  }, []);

  const publishPostFlow = useCallback(async () => {
    const ok = await handleCreatePost();
    if (ok) {
      resetPostFlow();
    }
  }, [handleCreatePost, resetPostFlow]);

  const handlePostFlowClose = useCallback(() => {
    resetPostFlow();
  }, [resetPostFlow]);

  const handleLoadMore = useCallback(async () => {
    if (!postsCursor.current || loadingMore) return;
    setLoadingMore(true);
    try {
      const { posts, cursor } = await fetchMorePosts(10, postsCursor.current);
      setOlderPosts((prev) => [...prev, ...posts]);
      postsCursor.current = cursor;
    } catch (err) {
      console.error("loadMore posts", err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore]);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      { rootMargin: "240px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [handleLoadMore]);

  async function handleReactPost(postId: string, emoji: string) {
    const ok = await ensureAuth({
      reason: "Connecte-toi pour liker ce post",
    });
    if (!ok || !user) return;
    const previousLive = livePosts;
    const previousOlder = olderPosts;
    const previousSelected = selectedPost;
    const optimisticUpdate = (post: Post) =>
      post.id === postId ? applyOptimisticReaction(post, user.uid, emoji) : post;

    setLivePosts((prev) => prev.map(optimisticUpdate));
    setOlderPosts((prev) => prev.map(optimisticUpdate));
    setSelectedPost((prev) =>
      prev?.id === postId ? applyOptimisticReaction(prev, user.uid, emoji) : prev
    );

    try {
      await togglePostReaction(postId, user.uid, emoji as any);
    } catch (err) {
      console.error("toggle post reaction failed", err);
      setLivePosts(previousLive);
      setOlderPosts(previousOlder);
      setSelectedPost(previousSelected);
    }
  }

  async function handleReactStory(story: Story, emoji: string) {
    const ok = await ensureAuth({
      reason: "Connecte-toi pour liker cette story",
    });
    if (!ok || !user) return;
    await toggleStoryReaction(story, user.uid, emoji as any);
  }

  const handleSharePost = useCallback(
    async (post: Post) => {
      const url = `${window.location.origin}/feed?post=${post.id}`;
      const result = await shareLink(
        url,
        "UrbexQueens — Post",
        post.caption || "Post urbex"
      );
      if (result.shared) {
        toast.info("Lien partagé");
      } else if (result.copied) {
        toast.success("Lien copié 📎");
      }
    },
    [toast]
  );

  const handleShareStory = useCallback(
    async (story: Story) => {
      const url = `${window.location.origin}/story/${story.id || "urbex"}`;
      const result = await shareLink(
        url,
        "Story UrbexQueens",
        story.text || "Vibe urbex"
      );
      if (result.shared) {
        toast.info("Lien partagé");
      } else if (result.copied) {
        toast.success("Lien copié 📎");
      }
    },
    [toast]
  );

  function goToProfileHandle(username: string, uid: string) {
    const handle = username.trim();
    window.dispatchEvent(
      new CustomEvent("urbex-nav", {
        detail: { path: handle ? `/u/${handle}` : `/profile/${uid}` },
      })
    );
  }

  async function handleSendComment(postId: string) {
    const ok = await ensureAuth({
      reason: "Connecte-toi pour commenter ce post",
    });
    if (!ok || !user) return;
    const draft = commentDrafts[postId] || "";
    if (!draft.trim()) return;
    setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
    const displayName =
      currentProfile?.displayName ??
      user.displayName ??
      user.email?.split("@")[0] ??
      "Exploratrice";
    const username = currentProfile?.username ?? null;
    await addPostComment({
      postId,
      userId: user.uid,
      text: draft.trim(),
      displayName,
      username,
    });
  }

  const handleFeedModalRequireAuth = useCallback(() => {
    void ensureAuth({
      reason: "Connecte-toi pour interagir avec ce post",
    });
  }, [ensureAuth]);

  function openStoryViewer(index: number) {
    setStoryProgress(0);
    setActiveStoryIndex(index);
    setStoryViewerOpen(true);
    setStoryGlitch(true);
    setTimeout(() => setStoryGlitch(false), 150);
  }

  function closeStoryViewer() {
    setStoryViewerOpen(false);
    setStoryProgress(0);
    if (storyRaf.current) cancelAnimationFrame(storyRaf.current);
  }

  const nextStory = useCallback(() => {
    setStoryProgress(0);
    setStoryGlitch(true);
    setActiveStoryIndex((prev) => {
      const next = prev + 1;
      if (next >= stories.length) {
        closeStoryViewer();
        return prev;
      }
      return next;
    });
    setTimeout(() => setStoryGlitch(false), 150);
  }, [stories.length]);

  function prevStory() {
    setStoryProgress(0);
    setStoryGlitch(true);
    setActiveStoryIndex((prev) => Math.max(prev - 1, 0));
    setTimeout(() => setStoryGlitch(false), 150);
  }

  useEffect(() => {
    if (!storyViewerOpen || !stories[activeStoryIndex]) return;
    if (storyRaf.current) cancelAnimationFrame(storyRaf.current);
    const duration = 6000;
    storyStart.current = performance.now();

    const step = (now: number) => {
      const elapsed = now - storyStart.current;
      const pct = Math.min((elapsed / duration) * 100, 100);
      setStoryProgress(pct);
      if (pct >= 100) {
        nextStory();
        return;
      }
      storyRaf.current = requestAnimationFrame(step);
    };

    storyRaf.current = requestAnimationFrame(step);
    return () => {
      if (storyRaf.current) cancelAnimationFrame(storyRaf.current);
    };
  }, [activeStoryIndex, storyViewerOpen, stories, nextStory]);

  const handleCreateStory = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      const ok = await ensureAuth({
        reason: "Connecte-toi pour créer une story",
      });
      if (!ok || !user) return;
      if (!storyFile) {
        setStoryError("Ajoute un visuel ou une courte vidéo.");
        return;
      }
      setStoryUploading(true);
      setStoryError(null);
      let success = false;
      try {
        const mediaUrl = await uploadUrbexMedia(user.uid, storyFile, { folder: "stories" });
        await createStory({
          userId: user.uid,
          mediaUrl,
          text: storyText,
          music: storyMusic,
          authorName: user.displayName || user.email?.split("@")[0] || "Urbex",
          authorAvatar: user.photoURL,
          authorUsername: currentProfile?.username ?? null,
        });
        setStoryFile(null);
        setStoryText("");
        setStoryMusic("");
        success = true;
      } catch (err: unknown) {
        setStoryError(describeStorageError(err, "Impossible de publier la story."));
      } finally {
        setStoryUploading(false);
      }
      return success;
    },
    [ensureAuth, user, storyFile, storyText, storyMusic, currentProfile]
  );

  const resetStoryFlow = useCallback(() => {
    setStoryFlowOpen(false);
    setStoryFlowStep(1);
    setStoryFlowZoom(1);
    setStoryFlowOffset({ x: 0, y: 0 });
    setStoryFile(null);
    setStoryText("");
    setStoryMusic("");
    setStoryCoverFrame(0);
    setStoryError(null);
  }, []);

  const publishStoryFlow = useCallback(async () => {
    const ok = await handleCreateStory();
    if (ok) {
      resetStoryFlow();
    }
  }, [handleCreateStory, resetStoryFlow]);

  const handleStoryFlowClose = useCallback(() => {
    resetStoryFlow();
  }, [resetStoryFlow]);

  const handleStoryComposerTrigger = useCallback(async () => {
    const ok = await ensureAuth({
      reason: "Connecte-toi pour créer une story",
    });
    if (!ok) return;
    setStoryFlowStep(1);
    setStoryFlowZoom(1);
    setStoryFlowOffset({ x: 0, y: 0 });
    setStoryCoverFrame(0);
    setStoryFlowOpen(true);
  }, [ensureAuth]);

  const openPostFlow = useCallback(() => {
    setPostFlowStep(1);
    setPostFlowZoom(1);
    setPostFlowOffset({ x: 0, y: 0 });
    setPostCoverFrame(0);
    setPostFlowOpen(true);
  }, []);

  if (authLoading) {
    return <div className="uq-feed-loading">Loading feed…</div>;
  }

  return (
    <div className="feed-shell" ref={attachFeedSurface}>
      <PullToRefreshIndicator pullDistance={feedPullDistance} status={feedPullStatus} />
      <div className="social-feed-inner">
        <header className="social-feed-header">
          <div className="social-feed-title-row">
            <span className="social-feed-label">URBEXQUEENS FEED</span>
            <strong className="social-feed-title">Explorer sans bruit</strong>
          </div>
          <div className="social-feed-search">
            <UrbexFeedUserSearch
              onSelect={(profile) => goToProfileHandle(profile.username || "", profile.uid)}
            />
          </div>
        </header>
        <div className="social-feed-filter-row">
          {FEED_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={`feed-filter-pill ${feedMode === mode.id ? "is-active" : ""}`}
              onClick={() => setFeedMode(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {/* UI: stories rail + creation */}
        <div className="feed-stories-shell">
          <div className="ig-stories-bar">
            <div className="ig-stories-row">
              <button
                type="button"
                className="ig-story your-story"
                onClick={handleStoryComposerTrigger}
                aria-disabled={isGuest}
                title={isGuest ? "Connecte-toi pour créer une story" : undefined}
              >
                <div className="ig-story-ring your">
                  <div className="ig-story-avatar">
                    {user?.photoURL ? (
                      <UQImage src={user.photoURL} alt="Ta story" />
                    ) : (
                      <span>{(user?.displayName || "U")[0]}</span>
                    )}
                  </div>
                </div>
                <div className="ig-story-name">Ta story</div>
              </button>

              {stories.map((story, idx) => (
                <button
                  key={story.id}
                  className="ig-story"
                  type="button"
                  onClick={() => openStoryViewer(idx)}
                  onDoubleClick={() => handleReactStory(story, "🖤")}
                >
                <div className="ig-story-ring">
                  <div className="ig-story-avatar">
                    <UQImage
                      src={story.mediaUrl}
                      alt={
                        story.authorName
                          ? `${story.authorName} • story`
                          : "Story preview"
                      }
                    />
                  </div>
                </div>
                  <div className="ig-story-name">
                    {(story.authorName || story.userId || "user").slice(0, 10)}
                  </div>
                </button>
              ))}

              <div className="ig-story placeholder">
                <div className="ig-story-ring ghost">
                  <div className="ig-story-avatar">
                    <span>👻</span>
                  </div>
                </div>
                <div className="ig-story-name">À venir</div>
              </div>
            </div>
          </div>

          {isGuest && (
            <div className="feed-guest-cta">
              <p>Connecte-toi pour commenter, liker et partager tes explorations.</p>
              <div className="feed-guest-cta-actions">
                <button
                  type="button"
                  onClick={() =>
                    requireAuth({ mode: "login", reason: "Se connecter" })
                  }
                >
                  Se connecter
                </button>
                <button
                  type="button"
                  onClick={() =>
                    requireAuth({ mode: "signup", reason: "Créer un compte" })
                  }
                >
                  Créer un compte
                </button>
              </div>
            </div>
          )}

          {!isGuest && (
            <>
              <div className="story-inline-actions">
                <button
                  type="button"
                  className="story-open-btn"
                  onClick={handleStoryComposerTrigger}
                >
                  {storyFlowOpen ? "Fermer le flow story" : "Créer / publier une story"}
                </button>
              </div>

              <div
                className="ig-quick-composer"
                onClick={openPostFlow}
                role="button"
                tabIndex={0}
              >
                <div className="ig-avatar small">
                  {user?.photoURL ? (
                    <UQImage
                      src={user.photoURL}
                      alt={`${user?.displayName || "Utilisateur"} • avatar`}
                    />
                  ) : (
                    <span>🖤</span>
                  )}
                </div>
                <div className="ig-quick-placeholder">Partage une exploration...</div>
                <div className="ig-quick-icon">➕</div>
              </div>
            </>
          )}
        </div>

        {loadingFeed ? (
          <div className="feed-skeleton-list">
            {Array.from({ length: 3 }).map((_, idx) => (
              <FeedPostCardSkeleton key={`feed-skel-${idx}`} />
            ))}
          </div>
        ) : (
          <div className="feed-post-grid">
            {paginatedPosts.map((post) => (
              <MemoizedFeedPostTile
                key={post.id}
                post={post}
                onOpen={openPostModal}
                isSaved={savedPostIds.has(post.id)}
                isLiked={likedPostIds.has(post.id)}
                onToggleLike={(next) => handleToggleLike(post.id, next)}
                onRequireAuthForSave={requireAuthForSave}
                onRequireAuthForLike={isGuest ? requireAuthForLike : undefined}
                onReact={(emoji) => handleReactPost(post.id, emoji)}
                currentUserId={userUid}
                isGuest={isGuest}
              />
            ))}
            {/* Sentinel pour infinite scroll */}
            {hasMore && (
              <div 
                ref={sentinelRef} 
                style={{ 
                  gridColumn: '1 / -1',
                  height: '20px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '20px',
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '12px'
                }}
              >
                Chargement...
              </div>
            )}
            {paginatedPosts.length === 0 && (
              <div className="feed-empty">
                <span className="feed-empty-icon">👑</span>
                <div className="feed-empty-texts">
                  <div className="feed-empty-title">{emptyStateTitle}</div>
                  <div className="feed-empty-sub">{emptyStateSub}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {postsCursor.current && (
          <div className="feed-loadmore" ref={loadMoreRef}>
            <button type="button" onClick={handleLoadMore} disabled={loadingMore}>
              {loadingMore ? (
                <Skeleton
                  className="feed-loadmore-skeleton__pill"
                  rounded
                />
              ) : (
                "Charger plus de posts"
              )}
            </button>
          </div>
        )}

        {/* UI: challenges as actionable cards */}
        <section className="uq-panel feed-challenges uq-fade-card">
          <div className="feed-section-head feed-section-tabs">
            <div>
              <p className="feed-eyebrow">Défis Urbex</p>
              <h3 className="feed-subtitle">Boost tes stats, reste en mouvement</h3>
            </div>
            <div className="feed-tab-switch">
              <button type="button" className="feed-tab is-active">
                Défis urbex
              </button>
              <button type="button" className="feed-tab">
                Missions sociales
              </button>
            </div>
          </div>
          <div className="feed-challenge-grid">
            {CHALLENGES.map((c) => (
              <div key={c.id} className="feed-challenge-card">
                <div className="feed-challenge-top">
                  <span className="uq-pill">{c.tag}</span>
                  <span className="feed-challenge-reward">{c.reward}</span>
                </div>
                <div className="feed-challenge-body">
                  <div className="feed-challenge-title">{c.title}</div>
                  <div className="feed-challenge-desc">{c.desc}</div>
                </div>
                <div className="feed-challenge-cta">
                  <button type="button" className="challenge-cta-btn">
                    Participer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>

      {postFlowOpen && (
        <div
          className="feed-flow-overlay"
          role="presentation"
          onClick={handlePostFlowClose}
        >
          <div
            className="feed-flow-modal"
            role="dialog"
            aria-label="Créer un post urbex"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="feed-flow-modal-header">
              <div>
                <p className="flow-eyebrow">Cadence post</p>
                <h3>Flow de création</h3>
              </div>
              <button
                type="button"
                className="flow-close"
                onClick={handlePostFlowClose}
                aria-label="Fermer le flow post"
              >
                ✕
              </button>
            </header>
            <div className="flow-step-indicator">
              {POST_FLOW_STEPS.map((step) => (
                <div
                  key={step.id}
                  className={`flow-step ${
                    postFlowStep === step.id ? "is-active" : ""
                  } ${postFlowStep > step.id ? "is-complete" : ""}`}
                >
                  {step.label}
                </div>
              ))}
            </div>
            <div className="flow-stage">
              {postFlowStep === 1 && (
                <div className="flow-selection">
                  <div
                    className="flow-dropzone"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={handlePostDrop}
                  >
                    <input
                      ref={postFileInputRef}
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      onChange={(event) => handlePostFileSelect(event.target.files)}
                    />
                    <p>Glisse ton média ou sélectionne-le</p>
                    <small>Photos / vidéos (25 Mo max)</small>
                    <button
                      type="button"
                      className="flow-upload-btn"
                      onClick={() => postFileInputRef.current?.click()}
                    >
                      Parcourir les fichiers
                    </button>
                  </div>
                  {mediaFiles.length > 0 && (
                    <div className="flow-file-list">
                      {mediaFiles.map((file) => (
                        <span key={file.name}>
                          {file.type.startsWith("video/") ? "🎥" : "🖼"} {file.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {postFlowStep === 2 && (
                <div className="flow-editing">
                  <div
                    className={`flow-preview-frame ratio-${postFlowRatio}`}
                    style={{
                      transform: `scale(${postFlowZoom}) translate(${postFlowOffset.x}%, ${postFlowOffset.y}%)`,
                    }}
                  >
                    {postPreviewUrl ? (
                      activePostIsVideo ? (
                        <video
                          src={postPreviewUrl}
                          autoPlay={false}
                          muted
                          loop
                          playsInline
                        />
                      ) : (
                        <UQImage
                          src={postPreviewUrl}
                          alt="Prévisualisation"
                          className="flow-preview-media"
                        />
                      )
                    ) : (
                      <div className="flow-preview-empty">Aucun média sélectionné</div>
                    )}
                  </div>
                  <div className="flow-adjustments">
                    <div className="flow-ratio-pills">
                      {POST_FLOW_RATIOS.map((ratio) => (
                        <button
                          key={ratio.id}
                          type="button"
                          className={`flow-ratio-pill ${
                            postFlowRatio === ratio.id ? "is-active" : ""
                          }`}
                          onClick={() => setPostFlowRatio(ratio.id)}
                        >
                          {ratio.label}
                        </button>
                      ))}
                    </div>
                    <label className="flow-slider">
                      Zoom {postFlowZoom.toFixed(2)}x
                      <input
                        type="range"
                        min={1}
                        max={2}
                        step={0.01}
                        value={postFlowZoom}
                        onChange={(event) => setPostFlowZoom(Number(event.target.value))}
                      />
                    </label>
                    <div className="flow-position-controls">
                      <button type="button" onClick={() => adjustPostOffset(0, -5)}>
                        ↑
                      </button>
                      <div className="flow-position-row">
                        <button type="button" onClick={() => adjustPostOffset(-5, 0)}>
                          ←
                        </button>
                        <button type="button" onClick={() => adjustPostOffset(5, 0)}>
                          →
                        </button>
                      </div>
                      <button type="button" onClick={() => adjustPostOffset(0, 5)}>
                        ↓
                      </button>
                    </div>
                    {activePostIsVideo && (
                      <div className="flow-cover-selector">
                        <label>Frame cover {postCoverFrame}%</label>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={postCoverFrame}
                          onChange={(event) => setPostCoverFrame(Number(event.target.value))}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
              {postFlowStep === 3 && (
                <div className="flow-preview-info">
                  {postError && <div className="feed-error">{postError}</div>}
                  <div
                    className={`flow-preview-frame ratio-${postFlowRatio}`}
                    style={{
                      transform: `scale(${postFlowZoom}) translate(${postFlowOffset.x}%, ${postFlowOffset.y}%)`,
                    }}
                  >
                    {postPreviewUrl ? (
                      activePostIsVideo ? (
                        <video src={postPreviewUrl} muted loop playsInline />
                      ) : (
                        <UQImage
                          src={postPreviewUrl}
                          alt="Prévisualisation"
                          className="flow-preview-media"
                        />
                      )
                    ) : (
                      <div className="flow-preview-empty">Prévisualisation</div>
                    )}
                  </div>
                  <div className="flow-preview-details">
                    <textarea
                      value={caption}
                      onChange={(event) => setCaption(event.target.value)}
                      placeholder="Légende immersive"
                    />
                    <div className="flow-location-grid">
                      <input
                        type="text"
                        value={locationLabel}
                        onChange={(event) => setLocationLabel(event.target.value)}
                        placeholder="Lieu ou vibe"
                      />
                      <input
                        type="text"
                        value={locationLat}
                        onChange={(event) => setLocationLat(event.target.value)}
                        placeholder="Latitude"
                      />
                      <input
                        type="text"
                        value={locationLng}
                        onChange={(event) => setLocationLng(event.target.value)}
                        placeholder="Longitude"
                      />
                      <select
                        value={linkedPlaceId}
                        onChange={(event) => setLinkedPlaceId(event.target.value)}
                      >
                        <option value="">Lier à un spot</option>
                        {places.map((place) => (
                          <option key={place.id} value={place.id}>
                            {place.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="feed-place-actions">
                      <button
                        type="button"
                        onClick={loadMorePlaces}
                        disabled={
                          placesLoading ||
                          placesLoadingMore ||
                          !placesHasMore
                        }
                      >
                        {placesLoadingMore ? (
                          <Skeleton
                            className="feed-loadmore-skeleton__pill"
                            rounded
                          />
                        ) : placesHasMore ? (
                          "Charger plus de spots"
                        ) : (
                          "Tous les spots chargés"
                        )}
                      </button>
                      {placesLoading && (
                        <Skeleton className="profile-hint-skeleton" shimmer />
                      )}
                      {!placesLoading && !placesHasMore && (
                        <span>Tous les spots sont chargés.</span>
                      )}
                    </div>
                    {placesError && (
                      <div className="feed-error">{placesError}</div>
                    )}
                    <div className="ig-filters">
                      {FILTERS.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          className={`filter-pill ${filter === f.id ? "is-active" : ""}`}
                          onClick={() => setFilter(f.id)}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {postFlowStep === 4 && (
                <div className="flow-final">
                  <div
                    className={`flow-preview-frame ratio-${postFlowRatio}`}
                    style={{
                      transform: `scale(${postFlowZoom}) translate(${postFlowOffset.x}%, ${postFlowOffset.y}%)`,
                    }}
                  >
                    {postPreviewUrl ? (
                      activePostIsVideo ? (
                        <video src={postPreviewUrl} muted loop playsInline />
                      ) : (
                        <UQImage
                          src={postPreviewUrl}
                          alt="Final preview"
                          className="flow-preview-media"
                        />
                      )
                    ) : (
                      <div className="flow-preview-empty">Prévisualisation finale</div>
                    )}
                  </div>
                  <div className="flow-final-copy">
                    <p>Prête à publier ce moment-clé ?</p>
                    <p>Lieu : {locationLabel || "Non précisé"}</p>
                    <p>Filtre : {FILTERS.find((f) => f.id === filter)?.label || filter}</p>
                    <p>Caption : {caption || "Sans légende"}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flow-actions">
              {postFlowStep > 1 && (
                <button
                  type="button"
                  className="flow-back"
                  onClick={() => setPostFlowStep((step) => Math.max(1, step - 1))}
                >
                  Retour
                </button>
              )}
              {postFlowStep < 4 ? (
                <button
                  type="button"
                  className="flow-next"
                  onClick={() => setPostFlowStep((step) => Math.min(4, step + 1))}
                  disabled={postFlowStep === 1 && mediaFiles.length === 0}
                >
                  {postFlowStep === 1 ? "Continuer" : "Suivant"}
                </button>
              ) : (
                <button
                  type="button"
                  className="flow-submit"
                  onClick={publishPostFlow}
                  disabled={uploadingPost}
                >
                  {uploadingPost ? "Upload en cours…" : "Publier ce post"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {storyFlowOpen && (
        <div
          className="feed-flow-overlay"
          role="presentation"
          onClick={handleStoryFlowClose}
        >
          <div
            className="feed-flow-modal"
            role="dialog"
            aria-label="Créer une story"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="feed-flow-modal-header">
              <div>
                <p className="flow-eyebrow">Story Flow</p>
                <h3>Préparer ta story</h3>
              </div>
              <button
                type="button"
                className="flow-close"
                onClick={handleStoryFlowClose}
                aria-label="Fermer le flow story"
              >
                ✕
              </button>
            </header>
            <div className="flow-step-indicator">
              {STORY_FLOW_STEPS.map((step) => (
                <div
                  key={step.id}
                  className={`flow-step ${
                    storyFlowStep === step.id ? "is-active" : ""
                  } ${storyFlowStep > step.id ? "is-complete" : ""}`}
                >
                  {step.label}
                </div>
              ))}
            </div>
            <div className="flow-stage">
              {storyFlowStep === 1 && (
                <div className="flow-selection">
                  <div
                    className="flow-dropzone"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={handleStoryDrop}
                  >
                    <input
                      ref={storyFileInputRef}
                      type="file"
                      accept="image/*,video/*"
                      onChange={(event) => handleStoryFileSelect(event.target.files)}
                    />
                    <p>Story rapide</p>
                    <small>Photo ou court clip</small>
                    <button
                      type="button"
                      className="flow-upload-btn"
                      onClick={() => storyFileInputRef.current?.click()}
                    >
                      Ajouter un visuel
                    </button>
                  </div>
                  {storyFile && (
                    <div className="flow-file-list">
                      <span>
                        {storyFile.type.startsWith("video/") ? "🎥" : "🖼"} {storyFile.name}
                      </span>
                    </div>
                  )}
                </div>
              )}
              {storyFlowStep === 2 && (
                <div className="flow-editing">
                  <div
                    className={`flow-preview-frame ratio-${storyFlowRatio}`}
                    style={{
                      transform: `scale(${storyFlowZoom}) translate(${storyFlowOffset.x}%, ${storyFlowOffset.y}%)`,
                    }}
                  >
                    {storyPreviewUrl ? (
                      storyFile?.type.startsWith("video/") ? (
                        <video src={storyPreviewUrl} muted loop playsInline />
                      ) : (
                        <UQImage
                          src={storyPreviewUrl}
                          alt="Story preview"
                          className="flow-preview-media"
                        />
                      )
                    ) : (
                      <div className="flow-preview-empty">Sélectionne un visuel</div>
                    )}
                  </div>
                  <div className="flow-adjustments">
                    <div className="flow-ratio-pills">
                      {STORY_FLOW_RATIOS.map((ratio) => (
                        <button
                          key={ratio.id}
                          type="button"
                          className={`flow-ratio-pill ${
                            storyFlowRatio === ratio.id ? "is-active" : ""
                          }`}
                          onClick={() => setStoryFlowRatio(ratio.id)}
                        >
                          {ratio.label}
                        </button>
                      ))}
                    </div>
                    <label className="flow-slider">
                      Zoom {storyFlowZoom.toFixed(2)}x
                      <input
                        type="range"
                        min={1}
                        max={2}
                        step={0.01}
                        value={storyFlowZoom}
                        onChange={(event) => setStoryFlowZoom(Number(event.target.value))}
                      />
                    </label>
                    <div className="flow-position-controls">
                      <button type="button" onClick={() => adjustStoryOffset(0, -5)}>
                        ↑
                      </button>
                      <div className="flow-position-row">
                        <button type="button" onClick={() => adjustStoryOffset(-5, 0)}>
                          ←
                        </button>
                        <button type="button" onClick={() => adjustStoryOffset(5, 0)}>
                          →
                        </button>
                      </div>
                      <button type="button" onClick={() => adjustStoryOffset(0, 5)}>
                        ↓
                      </button>
                    </div>
                    {storyFile?.type.startsWith("video/") && (
                      <div className="flow-cover-selector">
                        <label>Frame {storyCoverFrame}%</label>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={storyCoverFrame}
                          onChange={(event) => setStoryCoverFrame(Number(event.target.value))}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
              {storyFlowStep === 3 && (
                <div className="flow-preview-info">
                  {storyError && <div className="feed-error">{storyError}</div>}
                  <div
                    className={`flow-preview-frame ratio-${storyFlowRatio}`}
                    style={{
                      transform: `scale(${storyFlowZoom}) translate(${storyFlowOffset.x}%, ${storyFlowOffset.y}%)`,
                    }}
                  >
                    {storyPreviewUrl ? (
                      storyFile?.type.startsWith("video/") ? (
                        <video src={storyPreviewUrl} muted loop playsInline />
                      ) : (
                        <UQImage
                          src={storyPreviewUrl}
                          alt="Story preview"
                          className="flow-preview-media"
                        />
                      )
                    ) : (
                      <div className="flow-preview-empty">Prévisualisation story</div>
                    )}
                  </div>
                  <div className="flow-preview-details">
                    <textarea
                      value={storyText}
                      onChange={(event) => setStoryText(event.target.value)}
                      placeholder="Texte optionnel"
                    />
                    <input
                      type="text"
                      value={storyMusic}
                      onChange={(event) => setStoryMusic(event.target.value)}
                      placeholder="Musique / URL"
                    />
                  </div>
                </div>
              )}
              {storyFlowStep === 4 && (
                <div className="flow-final">
                  <div
                    className={`flow-preview-frame ratio-${storyFlowRatio}`}
                    style={{
                      transform: `scale(${storyFlowZoom}) translate(${storyFlowOffset.x}%, ${storyFlowOffset.y}%)`,
                    }}
                  >
                    {storyPreviewUrl ? (
                      storyFile?.type.startsWith("video/") ? (
                        <video src={storyPreviewUrl} muted loop playsInline />
                      ) : (
                        <UQImage
                          src={storyPreviewUrl}
                          alt="Story preview"
                          className="flow-preview-media"
                        />
                      )
                    ) : (
                      <div className="flow-preview-empty">Rendu final</div>
                    )}
                  </div>
                  <div className="flow-final-copy">
                    <p>Story prête à disparaître après 24h ?</p>
                    <p>Texte : {storyText || "—"}</p>
                    <p>Musique : {storyMusic || "—"}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flow-actions">
              {storyFlowStep > 1 && (
                <button
                  type="button"
                  className="flow-back"
                  onClick={() => setStoryFlowStep((step) => Math.max(1, step - 1))}
                >
                  Retour
                </button>
              )}
              {storyFlowStep < 4 ? (
                <button
                  type="button"
                  className="flow-next"
                  onClick={() => setStoryFlowStep((step) => Math.min(4, step + 1))}
                  disabled={!storyFile && storyFlowStep === 1}
                >
                  {storyFlowStep === 1 ? "Ajouter un visuel" : "Suivant"}
                </button>
              ) : (
                <button
                  type="button"
                  className="flow-submit"
                  onClick={publishStoryFlow}
                  disabled={storyUploading}
                >
                  {storyUploading ? "Upload en cours…" : "Publier la story"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedPost && (
        <FeedPostModal
          post={selectedPost}
          currentUser={user}
          comments={commentsMap[selectedPost.id] || []}
          commentDraft={commentDrafts[selectedPost.id] || ""}
          onDraftChange={(value) =>
            setCommentDrafts((prev) => ({ ...prev, [selectedPost.id]: value }))
          }
          onSendComment={() => handleSendComment(selectedPost.id)}
          onReact={(emoji) => handleReactPost(selectedPost.id, emoji)}
          onClose={closePostModal}
          onShare={() => handleSharePost(selectedPost)}
          onNavigateProfile={(username, uid) => goToProfileHandle(username || "", uid)}
          profiles={profiles}
          isGuest={isGuest}
          onRequireAuth={handleFeedModalRequireAuth}
        />
      )}

      {storyViewerOpen && activeStory && (
        <div
          className={`story-viewer ${storyGlitch ? "is-glitch" : ""}`}
          onPointerDown={(e) => {
            storySwipeStart.current = { y: e.clientY, time: Date.now() };
          }}
          onPointerUp={(e) => {
            if (!storySwipeStart.current) return;
            const delta = e.clientY - storySwipeStart.current.y;
            if (delta > 60) closeStoryViewer();
            storySwipeStart.current = null;
          }}
        >
          <div className="story-viewer-backdrop" />
          <div className="story-viewer-media">
            <div className="story-progress">
              <div className="story-progress-bar" style={{ width: `${storyProgress}%` }} />
            </div>
            <div className="story-viewer-content">
              <div className="story-zone story-zone-left" onClick={prevStory} aria-label="Story précédente" />
              <div className="story-zone story-zone-right" onClick={nextStory} aria-label="Story suivante" />
              <div className="story-viewer-frame">
                {activeStoryIsVideo ? (
                  <video
                    src={activeStory.mediaUrl}
                    className="story-viewer-img"
                    autoPlay
                    muted
                    playsInline
                    loop
                  />
                ) : (
                  <UQImage
                    src={activeStory.mediaUrl}
                    alt={`${activeStory.authorName || "Story"} • story`}
                    className="story-viewer-img"
                  />
                )}
                <div className="story-viewer-noise" />
              </div>
              <button
                type="button"
                className="story-share-btn"
                onClick={() => handleShareStory(activeStory)}
              >
                🔗 Partager
              </button>
              <button type="button" className="story-close" onClick={closeStoryViewer}>
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
