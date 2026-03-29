import { communicationFrameTemplate } from "./communication-frame-template";

type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  bleedX: number;
  bleedY: number;
};

type CommunicationExportPreviewProps = {
  cityImageSrc?: string;
  gazinImageSrc?: string;
  cityCaption: string;
  gazinCaption: string;
  cityFallback: string;
  gazinFallback: string;
  aspectRatio?: number;
  cityTransform?: {
    zoom: number;
    offsetX: number;
    offsetY: number;
  };
  gazinTransform?: {
    zoom: number;
    offsetX: number;
    offsetY: number;
  };
};

function truncateText(value: string, maxChars: number) {
  const normalized = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(maxChars - 1, 1)).trimEnd()}…`;
}

function calculateScaledAngle(
  line: { x1: number; y1: number; x2: number; y2: number },
  scaleX: number,
  scaleY: number,
) {
  return (Math.atan2((line.y2 - line.y1) * scaleY, (line.x2 - line.x1) * scaleX) * 180) / Math.PI;
}

function estimateLabelTextWidth(text: string, fontSize: number) {
  return text.length * fontSize * 0.66;
}

function buildReversedLabelLayout(
  label: {
    x: number;
    y: number;
    width: number;
    height: number;
    paddingX: number;
    fontSize: number;
    angle: number;
  },
  text: string,
) {
  const contentWidth =
    estimateLabelTextWidth(text, label.fontSize) + label.paddingX * 2 + label.fontSize * 0.18;
  const width = Math.max(contentWidth, label.height * 2.35);
  const radians = (label.angle * Math.PI) / 180;

  return {
    ...label,
    x: label.x + Math.cos(radians) * width - Math.sin(radians) * label.height,
    y: label.y + Math.sin(radians) * width + Math.cos(radians) * label.height,
    width,
    angle: label.angle - 180,
  };
}

function buildImagePlacement(
  bounds: Bounds,
  transform?: {
    zoom: number;
    offsetX: number;
    offsetY: number;
  },
) {
  const zoom = Math.min(Math.max(Number(transform?.zoom) || 1, 1), 3);
  const offsetX = Math.min(Math.max(Number(transform?.offsetX) || 0, -100), 100);
  const offsetY = Math.min(Math.max(Number(transform?.offsetY) || 0, -100), 100);
  const baseWidth = bounds.width + bounds.bleedX * 2;
  const baseHeight = bounds.height + bounds.bleedY * 2;
  const width = baseWidth * zoom;
  const height = baseHeight * zoom;
  const availableShiftX = Math.max((width - bounds.width) / 2, 0);
  const availableShiftY = Math.max((height - bounds.height) / 2, 0);
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  return {
    x: centerX - width / 2 + availableShiftX * (offsetX / 100),
    y: centerY - height / 2 + availableShiftY * (offsetY / 100),
    width,
    height,
  };
}

function FallbackLabel({
  bounds,
  label,
}: {
  bounds: Bounds;
  label: string;
}) {
  return (
    <text
      x={bounds.x + bounds.width / 2}
      y={bounds.y + bounds.height / 2}
      fill="rgba(255,255,255,0.82)"
      fontSize="124"
      fontWeight="700"
      fontFamily="Arial, sans-serif"
      textAnchor="middle"
      dominantBaseline="middle"
    >
      {label}
    </text>
  );
}

export function CommunicationExportPreview({
  cityImageSrc,
  gazinImageSrc,
  cityCaption,
  gazinCaption,
  cityFallback,
  gazinFallback,
  aspectRatio,
  cityTransform,
  gazinTransform,
}: CommunicationExportPreviewProps) {
  const {
    viewBox,
    backgroundColor,
    placeholderColor,
    labelColor,
    labelFontFamily,
    labelFontWeight,
    cityPath,
    gazinPath,
    borderPath,
    cityBounds,
    gazinBounds,
    cityLabel,
    gazinLabel,
  } = communicationFrameTemplate;

  const templateRatio = viewBox.width / viewBox.height;
  const safeAspectRatio =
    aspectRatio && Number.isFinite(aspectRatio) ? aspectRatio : templateRatio;
  const renderHeight = viewBox.height;
  const renderWidth = renderHeight * safeAspectRatio;
  const scaleX = renderWidth / viewBox.width;
  const scaleY = renderHeight / viewBox.height;
  const scaledCityBounds: Bounds = {
    x: cityBounds.x * scaleX,
    y: cityBounds.y * scaleY,
    width: cityBounds.width * scaleX,
    height: cityBounds.height * scaleY,
    bleedX: cityBounds.bleedX * scaleX,
    bleedY: cityBounds.bleedY * scaleY,
  };
  const scaledGazinBounds: Bounds = {
    x: gazinBounds.x * scaleX,
    y: gazinBounds.y * scaleY,
    width: gazinBounds.width * scaleX,
    height: gazinBounds.height * scaleY,
    bleedX: gazinBounds.bleedX * scaleX,
    bleedY: gazinBounds.bleedY * scaleY,
  };
  const scaledCityLabel = {
    x: cityLabel.x * scaleX,
    y: cityLabel.y * scaleY,
    width: cityLabel.width * scaleX,
    height: cityLabel.height * scaleY,
    paddingX: cityLabel.paddingX * scaleX,
    fontSize: cityLabel.fontSize * scaleY,
    angle: calculateScaledAngle(cityLabel.line, scaleX, scaleY),
  };
  const scaledGazinLabel = {
    x: gazinLabel.x * scaleX,
    y: gazinLabel.y * scaleY,
    width: gazinLabel.width * scaleX,
    height: gazinLabel.height * scaleY,
    paddingX: gazinLabel.paddingX * scaleX,
    fontSize: gazinLabel.fontSize * scaleY,
    angle: calculateScaledAngle(gazinLabel.line, scaleX, scaleY),
  };
  const cityLabelLayout = buildReversedLabelLayout(
    scaledCityLabel,
    truncateText(cityCaption, 84),
  );
  const gazinLabelLayout = buildReversedLabelLayout(
    scaledGazinLabel,
    truncateText(gazinCaption, 84),
  );
  const cityImagePlacement = buildImagePlacement(scaledCityBounds, cityTransform);
  const gazinImagePlacement = buildImagePlacement(scaledGazinBounds, gazinTransform);

  return (
    <div
      className="communication-export-preview-shell"
      style={{ aspectRatio: String(safeAspectRatio) }}
    >
      <svg
        className="communication-export-preview-svg"
        viewBox={`0 0 ${renderWidth} ${renderHeight}`}
        role="img"
        aria-label="Prévia da composição final do quadro"
      >
        <defs>
          <filter id="preview-panel-shadow" x="-8%" y="-10%" width="116%" height="124%">
            <feDropShadow
              dx="0"
              dy="56"
              stdDeviation="48"
              floodColor="#15435b"
              floodOpacity="0.18"
            />
          </filter>

          <clipPath id="preview-city-image-clip" clipPathUnits="userSpaceOnUse">
            <path d={cityPath} transform={`scale(${scaleX} ${scaleY})`} />
          </clipPath>

          <clipPath id="preview-gazin-image-clip" clipPathUnits="userSpaceOnUse">
            <path d={gazinPath} transform={`scale(${scaleX} ${scaleY})`} />
          </clipPath>
        </defs>

        <rect width={renderWidth} height={renderHeight} fill={backgroundColor} />

        <g clipPath="url(#preview-city-image-clip)">
          <rect
            x={scaledCityBounds.x}
            y={scaledCityBounds.y}
            width={scaledCityBounds.width}
            height={scaledCityBounds.height}
            fill={placeholderColor}
          />
          {cityImageSrc ? (
            <image
              href={cityImageSrc}
              x={cityImagePlacement.x}
              y={cityImagePlacement.y}
              width={cityImagePlacement.width}
              height={cityImagePlacement.height}
              preserveAspectRatio="xMidYMid slice"
            />
          ) : (
            <FallbackLabel bounds={scaledCityBounds} label={cityFallback} />
          )}
        </g>

        <g clipPath="url(#preview-gazin-image-clip)">
          <rect
            x={scaledGazinBounds.x}
            y={scaledGazinBounds.y}
            width={scaledGazinBounds.width}
            height={scaledGazinBounds.height}
            fill={placeholderColor}
          />
          {gazinImageSrc ? (
            <image
              href={gazinImageSrc}
              x={gazinImagePlacement.x}
              y={gazinImagePlacement.y}
              width={gazinImagePlacement.width}
              height={gazinImagePlacement.height}
              preserveAspectRatio="xMidYMid slice"
            />
          ) : (
            <FallbackLabel bounds={scaledGazinBounds} label={gazinFallback} />
          )}
        </g>

        <g filter="url(#preview-panel-shadow)">
          <path
            d={borderPath}
            transform={`scale(${scaleX} ${scaleY})`}
            fill="#ffffff"
            stroke="#ffffff"
            strokeWidth={Math.max(6 * Math.min(scaleX, scaleY), 3)}
            strokeLinejoin="round"
          />
        </g>

        <g transform={`translate(${cityLabelLayout.x} ${cityLabelLayout.y}) rotate(${cityLabelLayout.angle})`}>
          <rect
            x="0"
            y="0"
            width={cityLabelLayout.width}
            height={cityLabelLayout.height}
            fill={labelColor}
          />
          <text
            x={cityLabelLayout.width / 2}
            y={cityLabelLayout.height / 2 + cityLabelLayout.fontSize / 3}
            fontSize={cityLabelLayout.fontSize}
            fontFamily={labelFontFamily}
            fontWeight={labelFontWeight}
            fill="#ffffff"
            textAnchor="middle"
          >
            {truncateText(cityCaption, 84)}
          </text>
        </g>

        <g transform={`translate(${gazinLabelLayout.x} ${gazinLabelLayout.y}) rotate(${gazinLabelLayout.angle})`}>
          <rect
            x="0"
            y="0"
            width={gazinLabelLayout.width}
            height={gazinLabelLayout.height}
            fill={labelColor}
          />
          <text
            x={gazinLabelLayout.width / 2}
            y={gazinLabelLayout.height / 2 + gazinLabelLayout.fontSize / 3}
            fontSize={gazinLabelLayout.fontSize}
            fontFamily={labelFontFamily}
            fontWeight={labelFontWeight}
            fill="#ffffff"
            textAnchor="middle"
          >
            {truncateText(gazinCaption, 84)}
          </text>
        </g>
      </svg>
    </div>
  );
}
