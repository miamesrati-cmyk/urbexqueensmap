import Skeleton from "../Skeleton";

export function SpotPopupSkeleton() {
  return (
    <div className="uq-spot-popup-skeleton">
      <Skeleton className="uq-spot-popup-skeleton__media" rounded />
      <div className="uq-spot-popup-skeleton__body">
        <Skeleton className="uq-spot-popup-skeleton__tier" rounded />
        <div className="uq-spot-popup-skeleton__title-row">
          <Skeleton className="uq-spot-popup-skeleton__title" />
          <Skeleton className="uq-spot-popup-skeleton__icon" rounded />
        </div>
        <Skeleton className="uq-spot-popup-skeleton__subtitle" />
        <div className="uq-spot-popup-skeleton__meta-grid">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="uq-spot-popup-skeleton__meta">
              <Skeleton className="uq-spot-popup-skeleton__meta-label" />
              <Skeleton className="uq-spot-popup-skeleton__meta-value" />
            </div>
          ))}
        </div>
        <div className="uq-spot-popup-skeleton__actions">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Skeleton
              key={idx}
              className="uq-spot-popup-skeleton__action"
              rounded
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function FeedCardSkeleton() {
  return (
    <div className="feed-card-skeleton uq-fade-card">
      <div className="feed-card-skeleton__header">
        <Skeleton className="feed-card-skeleton__avatar" rounded />
        <div className="feed-card-skeleton__header-lines">
          <Skeleton className="feed-card-skeleton__line short" />
          <Skeleton className="feed-card-skeleton__line medium" />
          <Skeleton className="feed-card-skeleton__line long" />
        </div>
      </div>
      <Skeleton className="feed-card-skeleton__media" />
      <div className="feed-card-skeleton__actions">
        {Array.from({ length: 3 }).map((_, idx) => (
          <Skeleton key={idx} className="feed-card-skeleton__pill" rounded />
        ))}
      </div>
      <div className="feed-card-skeleton__caption">
        <Skeleton className="feed-card-skeleton__line long" />
        <Skeleton className="feed-card-skeleton__line medium" />
      </div>
      <div className="feed-card-skeleton__comments">
        {Array.from({ length: 2 }).map((_, idx) => (
          <Skeleton key={idx} className="feed-card-skeleton__line" />
        ))}
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="profile-skeleton">
      <div className="profile-skeleton__banner">
        <Skeleton className="profile-skeleton__banner-img" rounded />
      </div>
      <div className="profile-skeleton__header">
        <Skeleton className="profile-skeleton__avatar" rounded />
        <div className="profile-skeleton__header-lines">
          <Skeleton className="profile-skeleton__line large" />
          <Skeleton className="profile-skeleton__line medium" />
        </div>
        <Skeleton className="profile-skeleton__button" rounded />
      </div>
      <div className="profile-skeleton__stats">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="profile-skeleton__stat">
            <Skeleton className="profile-skeleton__line short" />
            <Skeleton className="profile-skeleton__line xshort" />
          </div>
        ))}
      </div>
      <div className="profile-skeleton__grid">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="profile-skeleton__card">
            <Skeleton className="profile-skeleton__line long" />
            <Skeleton className="profile-skeleton__line medium" />
            <Skeleton className="profile-skeleton__card-media" rounded />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AddSpotSkeleton() {
  return (
    <div className="add-spot-skeleton">
      <div className="add-spot-skeleton__header">
        <div className="add-spot-skeleton__stepper">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Skeleton key={idx} className="add-spot-skeleton__step" rounded />
          ))}
        </div>
        <Skeleton className="add-spot-skeleton__title" />
        <Skeleton className="add-spot-skeleton__subtitle" />
        <Skeleton className="add-spot-skeleton__autosave" />
      </div>
      <div className="add-spot-skeleton__rows">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="add-spot-skeleton__row">
            <Skeleton className="add-spot-skeleton__label" />
            <Skeleton className="add-spot-skeleton__input" />
            <Skeleton className="add-spot-skeleton__input short" />
          </div>
        ))}
      </div>
      <div className="add-spot-skeleton__media">
        {Array.from({ length: 2 }).map((_, idx) => (
          <Skeleton
            key={idx}
            className="add-spot-skeleton__media-thumb"
            rounded
          />
        ))}
      </div>
      <div className="add-spot-skeleton__cta">
        <Skeleton className="add-spot-skeleton__pill" rounded />
        <Skeleton className="add-spot-skeleton__pill" rounded />
      </div>
    </div>
  );
}

export function ProStatusSkeleton() {
  return <Skeleton className="pro-status-skeleton" rounded />;
}
