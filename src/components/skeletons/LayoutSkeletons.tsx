import Skeleton, {
  SkeletonCircle,
  SkeletonMedia,
  SkeletonText,
} from "../Skeleton";

export function ShopProductCardSkeleton() {
  return (
    <article className="product-card product-card--skeleton" aria-hidden="true">
      <div className="product-card-media product-card-media--skeleton">
        <SkeletonMedia
          aspect="4/5"
          className="product-card-media__skeleton"
        />
        <div className="product-card-badges product-card-badges--skeleton">
          {Array.from({ length: 2 }).map((_, idx) => (
            <Skeleton
              key={idx}
              className="product-card-badge product-card-badge--skeleton"
            />
          ))}
        </div>
      </div>
      <div className="product-card-body product-card-body--skeleton">
        <SkeletonText
          lines={2}
          className="product-card-title-skeleton"
        />
        <SkeletonText
          lines={2}
          className="product-card-description-skeleton"
        />
        <div className="product-card-footer">
          <div className="product-card-price">
            <Skeleton className="product-card-price-line product-card-price-line--short" />
            <Skeleton className="product-card-price-line product-card-price-line--long" />
          </div>
          <div className="product-card-actions product-card-actions--skeleton">
            <Skeleton
              className="product-card-cta product-card-cta--skeleton"
              rounded
            />
            <Skeleton
              className="product-card-cta product-card-cta--ghost product-card-cta--skeleton"
              rounded
            />
          </div>
        </div>
      </div>
    </article>
  );
}

export function SettingsProfileSkeleton() {
  return (
    <div
      className="settings-row user-summary settings-profile-skeleton"
      aria-hidden="true"
    >
      <div className="settings-profile-skeleton__avatar">
        <SkeletonCircle size={64} />
      </div>
      <div className="settings-profile-skeleton__details">
        <SkeletonText lines={2} className="settings-profile-skeleton__title" />
        <div className="settings-profile-skeleton__stats">
          <Skeleton className="settings-profile-skeleton__stat" />
          <Skeleton className="settings-profile-skeleton__stat" />
        </div>
      </div>
      <Skeleton
        className="uq-secondary-btn settings-profile-skeleton__cta"
        rounded
      />
    </div>
  );
}

export function FeedPostCardSkeleton() {
  return (
    <article className="feed-post-card feed-post-card--skeleton" aria-hidden="true">
      <header className="feed-post-card-header">
        <SkeletonCircle size={44} />
        <div className="feed-post-card-header-skeleton">
          <Skeleton className="feed-card-name-line" />
          <Skeleton className="feed-card-sub-line" />
        </div>
      </header>
      <div className="feed-post-media feed-post-media--skeleton">
        <SkeletonMedia
          aspect="16/9"
          className="feed-post-media__skeleton"
        />
      </div>
      <div className="feed-post-actions feed-post-actions--skeleton">
        {Array.from({ length: 3 }).map((_, idx) => (
          <Skeleton key={idx} className="feed-post-action-pill" rounded />
        ))}
      </div>
      <div className="feed-caption-block feed-caption-block--skeleton">
        <SkeletonText
          lines={2}
          className="feed-caption-skeleton"
        />
      </div>
      <div className="feed-comment-section feed-comment-section--skeleton">
        {Array.from({ length: 2 }).map((_, idx) => (
          <Skeleton key={idx} className="feed-comment-line-skeleton" />
        ))}
      </div>
    </article>
  );
}

export function MapSpotListItemSkeleton() {
  return (
    <div className="map-spot-list-item-skeleton" aria-hidden="true">
      <div className="map-spot-list-item-skeleton__thumb">
        <SkeletonMedia aspect="4/3" className="map-spot-list-item-skeleton__media" />
      </div>
      <div className="map-spot-list-item-skeleton__content">
        <Skeleton className="map-spot-list-item-skeleton__title" />
        <div className="map-spot-list-item-skeleton__pills">
          <Skeleton className="map-spot-list-item-skeleton__pill" />
          <Skeleton className="map-spot-list-item-skeleton__pill" />
        </div>
        <Skeleton className="map-spot-list-item-skeleton__distance" />
        <div className="map-spot-list-item-skeleton__actions">
          <SkeletonCircle size={30} />
          <SkeletonCircle size={30} />
        </div>
      </div>
    </div>
  );
}
