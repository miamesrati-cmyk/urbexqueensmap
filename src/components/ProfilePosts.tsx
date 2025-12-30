import { useMemo, useRef, useState } from "react";
import { v4 as uuid } from "uuid";
import {
  createProfilePost,
  type Post,
} from "../services/social";
import { uploadUrbexMedia } from "../services/storage";
import { describeStorageError } from "../utils/uploadErrors";

export function ProfilePostsGrid({
  posts,
  onSelect,
  loading = false,
  emptyMessage = "Pas encore de posts sur ce profil.",
}: {
  posts: Post[];
  onSelect: (post: Post) => void;
  loading?: boolean;
  emptyMessage?: string;
}) {
  return (
    <div className="profile-posts-grid">
      {loading && posts.length === 0 && (
        <div className="profile-post-skeletons">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="profile-post-skeleton" />
          ))}
        </div>
      )}

      {!loading && posts.length === 0 && (
        <div className="profile-posts-empty">{emptyMessage}</div>
      )}

      {posts.map((post) => {
        const cover = post.mediaUrls[0];
        const likeCount = Object.values(post.reactions || {}).reduce(
          (acc, v) => acc + (v || 0),
          0
        );
        return (
          <button
            key={post.id}
            type="button"
            className="profile-post-card"
            onClick={() => onSelect(post)}
          >
            <div className="profile-post-thumb">
              {cover ? (
                <img src={cover} alt={post.caption || "Post urbex"} loading="lazy" />
              ) : (
                <div className="profile-post-placeholder">📸</div>
              )}
            </div>
            <div className="profile-post-overlay">
              <span>❤️ {likeCount}</span>
              <span>{new Date(post.createdAt).toLocaleDateString()}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function ProfilePostModal({
  post,
  onClose,
}: {
  post: Post;
  onClose: () => void;
}) {
  const likeCount = useMemo(
    () =>
      Object.values(post.reactions || {}).reduce((acc, v) => acc + (v || 0), 0),
    [post.reactions]
  );
  const cover = post.mediaUrls[0];

  return (
    <div className="profile-post-modal" role="dialog" aria-modal="true">
      <div className="profile-post-modal-inner">
        <button className="profile-post-modal-close" onClick={onClose} aria-label="Fermer">
          ✕
        </button>
        {cover && <img src={cover} alt={post.caption || "Post"} />}
        <div className="profile-post-modal-body">
          <div className="profile-post-meta">
            <span>❤️ {likeCount}</span>
            <span>
              {new Date(post.createdAt).toLocaleDateString(undefined, {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
          {post.caption && <p className="profile-post-caption">{post.caption}</p>}
        </div>
      </div>
    </div>
  );
}

export function ProfilePostForm({
  userId,
  authorName,
  authorAvatar,
  authorIsPro = false,
  onCreated,
}: {
  userId: string;
  authorName: string | null;
  authorAvatar: string | null;
  authorIsPro?: boolean;
  onCreated?: () => void;
}) {
  const [caption, setCaption] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function handleFiles(selected: FileList | null) {
    if (!selected) {
      setFiles([]);
      return;
    }
    setFiles(Array.from(selected));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!files.length) {
      setError("Ajoute au moins une image");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const postId = uuid();
      const urls = [] as string[];
      for (const file of files) {
        const url = await uploadUrbexMedia(userId, file, { postId });
        urls.push(url);
      }
      await createProfilePost({
        userId,
        caption,
        mediaUrls: urls,
        authorName,
        authorAvatar,
        authorIsPro,
        postId,
      });
      setCaption("");
      setFiles([]);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      onCreated?.();
    } catch (err: unknown) {
      const target = err as { code?: string; message?: string };
      console.error("[ProfilePostUpload] failure", {
        code: target?.code,
        message: target?.message,
        err,
      });
      setError(
        describeStorageError(err, "Impossible de publier ce post pour le moment.")
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="profile-post-form" onSubmit={handleSubmit}>
      <div className="profile-post-form-header">
        <div className="profile-post-form-avatar">
          {authorAvatar ? (
            <img src={authorAvatar} alt={authorName || "Avatar"} />
          ) : (
            <span>{(authorName || "U").charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div>
          <div className="profile-post-form-title">+ Nouveau post</div>
          <div className="profile-post-form-sub">Image + légende rapide</div>
        </div>
      </div>

      <div className="profile-post-file-shell">
        <label className="profile-post-file">
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            disabled={submitting}
          />
          <div className="profile-post-file-content">
            <span className="profile-post-file-focus">Focus sur l’image</span>
            <span className="profile-post-file-info">
              {files.length ? `${files.length} média(s) prêts` : "Glisse tes photos urbex"}
            </span>
          </div>
        </label>

        {files.length > 0 && (
          <div className="profile-post-file-preview">
            {files.map((file, idx) => (
              <span
                key={`${file.name}-${idx}`}
                className="profile-post-file-chip"
                title={file.name}
              >
                {file.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Légende : ressenti, lieu, mood…"
        rows={3}
        disabled={submitting}
      />

      {error && <div className="profile-post-error">{error}</div>}

      <button type="submit" className="profile-post-submit" disabled={submitting}>
        {submitting ? "Publication…" : "Publier"}
      </button>
    </form>
  );
}
