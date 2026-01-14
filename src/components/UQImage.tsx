import { useCallback, useEffect, useState } from "react";
import type {
  CSSProperties,
  ImgHTMLAttributes,
  SyntheticEvent,
} from "react";

const BASE_FIT: UQImageFit = "cover";

type UQImageFit = "cover" | "contain" | "fill" | "none" | "scale-down";

export type UQImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src" | "alt" | "className" | "style" | "loading" | "decoding"
> & {
  src?: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  fit?: UQImageFit;
  priority?: boolean;
};

const mergeClasses = (...classes: Array<string | undefined>): string =>
  classes.filter(Boolean).join(" ");

export default function UQImage({
  src,
  alt = "",
  className,
  style,
  fit = BASE_FIT,
  priority = false,
  onLoad,
  ...rest
}: UQImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(false);
  }, [src]);

  const handleLoad = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      setIsLoaded(true);
      if (onLoad) {
        onLoad(event);
      }
    },
    [onLoad]
  );

  return (
    <div className="uq-img-shell" style={style}>
      <div
        className={mergeClasses(
          "uq-img-placeholder",
          isLoaded ? "is-loaded" : undefined
        )}
        aria-hidden="true"
      />
      {src ? (
        <img
          {...rest}
          src={src}
          alt={alt}
          className={mergeClasses(
            "uq-img",
            className,
            isLoaded ? "is-loaded" : undefined
          )}
          style={{ objectFit: fit }}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onLoad={handleLoad}
        />
      ) : null}
    </div>
  );
}
