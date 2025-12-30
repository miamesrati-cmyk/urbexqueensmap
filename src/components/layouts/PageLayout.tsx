import type { ReactNode } from "react";

type ContainerProps = {
  children: ReactNode;
  className?: string;
};

export function PageContainer({ children, className = "" }: ContainerProps) {
  return <div className={`page-container ${className}`}>{children}</div>;
}

type SectionCardProps = {
  children: ReactNode;
  className?: string;
};

export function SectionCard({ children, className = "" }: SectionCardProps) {
  return <section className={`section-card ${className}`}>{children}</section>;
}
