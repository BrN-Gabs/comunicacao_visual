"use client";

import Link, { type LinkProps } from "next/link";
import { usePathname } from "next/navigation";
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { useRouteTransition } from "./route-transition-provider";

type TransitionLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    children: ReactNode;
    loadingLabel?: string;
    minDuration?: number;
  };

function isModifiedEvent(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  );
}

function normalizePath(path: string) {
  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }

  return path;
}

export function TransitionLink({
  children,
  loadingLabel,
  minDuration,
  onClick,
  href,
  ...props
}: TransitionLinkProps) {
  const pathname = usePathname();
  const { startRouteTransition } = useRouteTransition();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);

    if (event.defaultPrevented || isModifiedEvent(event)) {
      return;
    }

    if (props.target && props.target !== "_self") {
      return;
    }

    if (typeof href !== "string" || !href.startsWith("/")) {
      return;
    }

    if (normalizePath(pathname) === normalizePath(href)) {
      return;
    }

    startRouteTransition({
      label: loadingLabel,
      minDuration,
    });
  }

  return (
    <Link href={href} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}
