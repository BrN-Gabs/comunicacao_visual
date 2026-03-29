"use client";

type PasswordVisibilityButtonProps = {
  visible: boolean;
  onClick: () => void;
  className?: string;
};

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 6.2A11 11 0 0 1 12 6c6.5 0 10 6 10 6a18.6 18.6 0 0 1-3.1 3.8" />
      <path d="M6.7 6.7A17.4 17.4 0 0 0 2 12s3.5 6 10 6a10.7 10.7 0 0 0 4.3-.9" />
      <path d="M9.9 9.9A3 3 0 0 0 9 12a3 3 0 0 0 4.7 2.5" />
    </svg>
  );
}

export function PasswordVisibilityButton({
  visible,
  onClick,
  className,
}: PasswordVisibilityButtonProps) {
  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
      title={visible ? "Ocultar senha" : "Mostrar senha"}
    >
      {visible ? <EyeOffIcon /> : <EyeIcon />}
    </button>
  );
}
