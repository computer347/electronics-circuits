/**
 * The old-CRT power-on: a bright dot in the middle, stretched into a line, then opened into
 * the full picture while a phosphor flash fades out.
 *
 * It animates clip-path, not transform, on purpose: the 3D bench and the scope's WebGL
 * screen measure their own size when they mount, and a scaled parent would make them
 * measure a 1-pixel box. Clipping leaves layout alone, so what's inside mounts at full size.
 */
import type { ReactNode } from 'react';

export function CrtPowerOn({ children, variant = 'full', className = '' }: {
  children: ReactNode;
  /** 'full' is the cold start on the title screen; 'quick' is for switching modes. */
  variant?: 'full' | 'quick';
  className?: string;
}) {
  return (
    <div className={`crt crt-${variant} ${className}`}>
      {children}
      <div className="crt-flash" aria-hidden />
    </div>
  );
}
