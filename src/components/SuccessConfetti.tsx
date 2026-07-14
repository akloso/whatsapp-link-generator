import { type CSSProperties } from 'react';

export function SuccessConfetti({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <div className="zapora-confetti" aria-hidden="true">
      {Array.from({ length: 14 }).map((_, index) => (
        <span key={index} style={{ '--i': index } as CSSProperties} />
      ))}
    </div>
  );
}
