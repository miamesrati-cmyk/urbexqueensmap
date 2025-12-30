import type {
  ButtonHTMLAttributes,
  DetailedHTMLProps,
  ElementType,
  ReactNode,
} from "react";
import { PageContainer, SectionCard } from "../layouts/PageLayout";

type NeonTitleProps = {
  label?: string;
  title: string;
  as?: ElementType;
  className?: string;
};

export function NeonTitle({
  label,
  title,
  as: Tag = "h1",
  className = "",
}: NeonTitleProps) {
  return (
    <div className={`neon-title ${className}`}>
      {label && <span className="neon-title-label">{label}</span>}
      <Tag>{title}</Tag>
    </div>
  );
}

type UrbexButtonProps = DetailedHTMLProps<
  ButtonHTMLAttributes<HTMLButtonElement>,
  HTMLButtonElement
> & {
  variant?: "primary" | "secondary" | "danger";
  icon?: ReactNode;
};

export function UrbexButton({
  variant = "primary",
  icon,
  className = "",
  children,
  ...buttonProps
}: UrbexButtonProps) {
  return (
    <button
      type="button"
      {...buttonProps}
      className={`urbex-btn urbex-btn-${variant} ${className}`}
    >
      {icon && <span className="urbex-btn-icon">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}

export { PageContainer, SectionCard };
