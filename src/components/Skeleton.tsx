import type { CSSProperties, HTMLAttributes } from "react";

const BASE_CLASSES = ["uq-skel", "uq-skeleton"];

const join = (...values: Array<string | undefined | null | false>): string =>
  values.filter(Boolean).join(" ");

type SkeletonProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  className?: string;
  rounded?: boolean;
  shimmer?: boolean;
};

export default function Skeleton({
  className,
  rounded = false,
  shimmer = true,
  ...rest
}: SkeletonProps) {
  const classes = join(
    ...BASE_CLASSES,
    className,
    rounded ? "uq-skel--rounded uq-skeleton--rounded" : "",
    shimmer ? "" : "uq-skel--static uq-skeleton--static"
  );

  return <div aria-hidden="true" className={classes} {...rest} />;
}

type SkeletonTextProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  className?: string;
  lineClassName?: string;
  lines?: number;
  shimmer?: boolean;
};

export function SkeletonText({
  className,
  lineClassName,
  lines = 1,
  shimmer = true,
  ...rest
}: SkeletonTextProps) {
  const safeLines = Math.max(1, Math.floor(lines));
  return (
    <div className={join("uq-skeleton-text", className)} {...rest}>
      {Array.from({ length: safeLines }).map((_, index) => (
        <Skeleton
          key={index}
          shimmer={shimmer}
          className={join("uq-skeleton-text-line", lineClassName)}
        />
      ))}
    </div>
  );
}

type SkeletonCircleProps = Omit<SkeletonProps, "rounded"> & {
  size?: number | string;
};

export function SkeletonCircle({
  size = 48,
  style,
  className,
  ...rest
}: SkeletonCircleProps) {
  const dimension = typeof size === "number" ? `${size}px` : size;
  return (
    <Skeleton
      className={join("uq-skeleton-circle", className)}
      style={{ width: dimension, height: dimension, ...style }}
      {...rest}
    />
  );
}

type SkeletonMediaProps = Omit<SkeletonProps, "style"> & {
  aspect?: string;
  style?: CSSProperties;
};

function parseAspectRatio(value: string | undefined) {
  if (!value) return null;
  const [widthText, heightText] = value.split("/").map((item) => item.trim());
  const width = Number(widthText);
  const height = Number(heightText);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width === 0) {
    return null;
  }
  return height / width;
}

export function SkeletonMedia({
  aspect = "16/9",
  style,
  className,
  ...rest
}: SkeletonMediaProps) {
  const ratio = parseAspectRatio(aspect);
  const paddingTop = ratio ? `${ratio * 100}%` : "56.25%";
  return (
    <div
      className={join("uq-skeleton-media", className)}
      style={{ paddingTop, ...style }}
    >
      <Skeleton
        className="uq-skeleton-media__content"
        {...rest}
      />
    </div>
  );
}
