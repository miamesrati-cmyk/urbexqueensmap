import { useEffect, useRef, useState } from 'react';

/**
 * 🎮 GAMING-URBEX VISUAL EFFECTS
 * Adds cyberpunk particle system, scanlines, and film grain overlay
 */
export function GamingEffects() {
  return (
    <>
      <Scanlines />
      <FilmGrain />
      <ParticlesBackground />
    </>
  );
}

/**
 * CRT Scanlines Effect
 */
function Scanlines() {
  return <div className="scanlines" />;
}

/**
 * Film Grain Texture
 */
function FilmGrain() {
  return <div className="film-grain" />;
}

/**
 * Floating Particle System
 */
function ParticlesBackground() {
  return (
    <div className="particles-bg">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="particle"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 10}s`,
            animationDuration: `${10 + Math.random() * 10}s`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * 🎯 Glitch Title Component
 */
export function GlitchTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="glitch-title">{children}</h1>;
}

/**
 * 💾 HUD Stats Display
 */
interface HudStatProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}

export function HudStat({ label, value, icon }: HudStatProps) {
  return (
    <div className="hud-stat">
      {icon}
      <span>{label}:</span>
      <span className="hud-stat-value">{value}</span>
    </div>
  );
}

/**
 * 🎴 Gaming Card Component
 */
interface GamingCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function GamingCard({ children, className = '', onClick }: GamingCardProps) {
  return (
    <div className={`gaming-card ${className}`} onClick={onClick}>
      {children}
    </div>
  );
}

/**
 * 🔘 Neon Button
 */
interface NeonButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'pink' | 'cyan' | 'purple' | 'green';
  disabled?: boolean;
  className?: string;
}

export function NeonButton({
  children,
  onClick,
  variant = 'pink',
  disabled = false,
  className = '',
}: NeonButtonProps) {
  const style = {
    '--btn-color': `var(--neon-${variant})`,
  } as React.CSSProperties;

  return (
    <button
      className={`neon-button ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      {children}
    </button>
  );
}

/**
 * 📊 Gaming Progress Bar
 */
interface GamingProgressProps {
  value: number; // 0-100
  className?: string;
}

export function GamingProgress({ value, className = '' }: GamingProgressProps) {
  return (
    <div className={`gaming-progress ${className}`}>
      <div
        className="gaming-progress-fill"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

/**
 * 🏷️ Cyber Badge
 */
interface CyberBadgeProps {
  children: React.ReactNode;
  variant?: 'purple' | 'pink' | 'cyan' | 'green';
}

export function CyberBadge({ children, variant = 'purple' }: CyberBadgeProps) {
  return <span className={`cyber-badge cyber-badge-${variant}`}>{children}</span>;
}

/**
 * ⚠️ Risk Level Indicator
 */
interface RiskIndicatorProps {
  level: 'low' | 'medium' | 'high' | 'extreme';
  label?: string;
}

export function RiskIndicator({ level, label }: RiskIndicatorProps) {
  const labels = {
    low: 'FAIBLE RISQUE',
    medium: 'RISQUE MODÉRÉ',
    high: 'HAUT RISQUE',
    extreme: 'RISQUE EXTRÊME',
  };

  return (
    <div className={`risk-indicator risk-${level}`}>
      <span className="risk-icon">⚠</span>
      <span>{label || labels[level]}</span>
    </div>
  );
}

/**
 * 🎯 HUD Container
 */
interface GamingHudProps {
  children: React.ReactNode;
  className?: string;
}

export function GamingHud({ children, className = '' }: GamingHudProps) {
  return <div className={`gaming-hud ${className}`}>{children}</div>;
}

/**
 * 🖥️ Terminal Output Component
 */
interface TerminalOutputProps {
  lines: string[];
  className?: string;
}

export function TerminalOutput({ lines, className = '' }: TerminalOutputProps) {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div ref={terminalRef} className={`terminal-output ${className}`}>
      {lines.map((line, i) => (
        <div
          key={i}
          className="terminal-line"
          style={{ animationDelay: `${i * 0.1}s` }}
        >
          {line}
        </div>
      ))}
    </div>
  );
}

/**
 * ⌨️ Typing Text Effect
 */
interface TypingTextProps {
  text: string;
  speed?: number; // ms per character
  onComplete?: () => void;
}

export function TypingText({ text, speed = 50, onComplete }: TypingTextProps) {
  const [displayText, setDisplayText] = useState('');

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayText(text.substring(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
        onComplete?.();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, onComplete]);

  return <span className="typing-text">{displayText}</span>;
}

/**
 * 🎨 Data Grid Container
 */
interface DataGridProps {
  children: React.ReactNode;
  columns?: number;
  className?: string;
}

export function DataGrid({ children, columns = 3, className = '' }: DataGridProps) {
  const style = {
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
  } as React.CSSProperties;

  return (
    <div className={`data-grid ${className}`} style={style}>
      {children}
    </div>
  );
}

/**
 * 🎭 Gaming Modal
 */
interface GamingModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export function GamingModal({ isOpen, onClose, children, title }: GamingModalProps) {
  if (!isOpen) return null;

  return (
    <>
      <div
        className="modal-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(4px)',
          zIndex: 9998,
        }}
      />
      <div className="gaming-modal">
        {title && <GlitchTitle>{title}</GlitchTitle>}
        <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'transparent',
            border: '2px solid var(--neon-pink)',
            color: 'var(--neon-pink)',
            width: '40px',
            height: '40px',
            fontSize: '1.5rem',
            cursor: 'pointer',
            zIndex: 2,
          }}
        >
          ×
        </button>
      </div>
    </>
  );
}
