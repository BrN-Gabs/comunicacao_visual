import type { SVGProps } from "react";

export function StatusToggleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 3v9" />
      <path d="M7.05 5.05a8 8 0 1 0 9.9 0" />
    </svg>
  );
}
