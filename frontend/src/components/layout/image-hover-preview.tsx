/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState } from "react";
import type { CSSProperties } from "react";

type PreviewPosition = {
  top: number;
  left: number;
};

type ImageHoverPreviewProps = {
  src: string;
  alt: string;
  imageClassName: string;
};

const previewWidth = 320;
const previewHeight = 260;
const previewGap = 14;
const viewportPadding = 16;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function calculatePreviewPosition(rect: DOMRect): PreviewPosition {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const rightSideLeft = rect.right + previewGap;
  const leftSideLeft = rect.left - previewWidth - previewGap;
  const hasRightSideSpace =
    rightSideLeft + previewWidth <= viewportWidth - viewportPadding;
  const left = hasRightSideSpace
    ? rightSideLeft
    : Math.max(viewportPadding, leftSideLeft);
  const maxTop = Math.max(
    viewportPadding,
    viewportHeight - previewHeight - viewportPadding,
  );

  return {
    top: clamp(
      rect.top + rect.height / 2 - previewHeight / 2,
      viewportPadding,
      maxTop,
    ),
    left,
  };
}

export function ImageHoverPreview({
  src,
  alt,
  imageClassName,
}: ImageHoverPreviewProps) {
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const [position, setPosition] = useState<PreviewPosition | null>(null);

  function showPreview() {
    if (!triggerRef.current) {
      return;
    }

    setPosition(
      calculatePreviewPosition(triggerRef.current.getBoundingClientRect()),
    );
  }

  function hidePreview() {
    setPosition(null);
  }

  const previewStyle = position
    ? ({
        "--image-hover-preview-left": `${position.left}px`,
        "--image-hover-preview-top": `${position.top}px`,
      } as CSSProperties)
    : undefined;

  return (
    <span
      ref={triggerRef}
      className="image-hover-preview-trigger"
      onMouseEnter={showPreview}
      onMouseLeave={hidePreview}
    >
      <img src={src} alt={alt} className={imageClassName} />

      {position ? (
        <span
          className="image-hover-preview-popover"
          style={previewStyle}
          aria-hidden="true"
        >
          <img src={src} alt="" />
        </span>
      ) : null}
    </span>
  );
}
