import type { SVGProps } from "react";

export function LogoutIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M14 4h-4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
      <path d="M10 12h10" />
      <path d="m16 8 4 4-4 4" />
    </svg>
  );
}
