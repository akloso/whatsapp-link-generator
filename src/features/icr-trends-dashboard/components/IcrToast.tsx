type Props = { message: string; tone?: 'info' | 'error' };

export function IcrToast({ message, tone = 'info' }: Props) {
  if (!message) return null;
  return <div className={`icr-toast ${tone === 'error' ? 'is-error' : ''}`} role="status" aria-live="polite">{message}</div>;
}
