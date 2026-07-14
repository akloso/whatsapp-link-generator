import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success';
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; icon?: ReactNode };

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-green-600 text-white shadow-[0_10px_24px_-14px_rgba(22,163,74,0.9)] hover:bg-green-700 focus-visible:ring-green-500/30 disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none',
  secondary:
    'border border-gray-200 bg-white text-gray-900 shadow-sm hover:border-green-300 hover:bg-green-50/60 focus-visible:ring-green-500/20 disabled:bg-gray-50 disabled:text-gray-400',
  ghost:
    'text-gray-700 hover:bg-gray-100 hover:text-gray-950 focus-visible:ring-gray-400/20 disabled:text-gray-400',
  success:
    'border border-green-200 bg-green-50 text-green-800 hover:border-green-300 hover:bg-green-100 focus-visible:ring-green-500/20 disabled:bg-gray-50 disabled:text-gray-400',
};

export function Button({ variant = 'secondary', icon, className = '', children, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed ${buttonVariants[variant]} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

export function FieldLabel({ htmlFor, children, optional = false }: { htmlFor: string; children: ReactNode; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-semibold leading-5 text-gray-900">
      {children} {optional ? <span className="font-medium text-gray-400">(Optional)</span> : <span className="font-medium text-gray-400">(Required)</span>}
    </label>
  );
}

export function TextInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition duration-150 placeholder:text-gray-400 hover:border-gray-400 focus-visible:border-green-500 focus-visible:ring-4 focus-visible:ring-green-500/15 disabled:bg-gray-50 ${className}`}
      {...props}
    />
  );
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full resize-none rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm leading-6 text-gray-900 outline-none transition duration-150 placeholder:text-gray-400 hover:border-gray-400 focus-visible:border-green-500 focus-visible:ring-4 focus-visible:ring-green-500/15 ${className}`}
      {...props}
    />
  );
}

export function Surface({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-gray-200 bg-white shadow-[0_16px_48px_-32px_rgba(15,23,42,0.35)] ${className}`}>{children}</div>;
}
