export const communicationFrameTemplate = {
  viewBox: {
    width: 12926,
    height: 2834.6,
  },
  backgroundColor: "#97D1F3",
  placeholderColor: "#1D1D1B",
  labelColor: "#6098BE",
  labelFontFamily: "'Montserrat Black', 'Montserrat', Arial, sans-serif",
  labelFontWeight: "900",
  cityPath:
    "M1609.7,0L510.6,2086.7c-127.9,242.8,48.2,534.6,322.6,534.6h4893.7L7096.9,0H1609.7Z",
  gazinPath:
    "M7096.9,0l-1370,2621.3h5281.7c131.5,0,252.7-70.8,317.4-185.2L12703.3,0h-5606.4Z",
  borderPath:
    "M12682.6,0l-1372.2,2427.2c-61.4,108.6-177,176.1-301.8,176.1h-5252l718.7-1375.1L7117.2,0h-40.6l-1360.6,2603.3H833.2c-122.5,0-233.5-62.6-296.8-167.5-63.3-104.9-67-232.3-9.9-340.7L1630,0h-40.7L494.7,2078.3c-63,119.7-58.9,260.3,11,376.1,69.9,115.8,192.4,184.9,327.6,184.9h10175.4c137.7,0,265.3-74.5,333.1-194.3L12724,0h-41.4Z",
  cityBounds: {
    x: 510.6,
    y: 0,
    width: 6586.3,
    height: 2621.3,
    bleedX: 180,
    bleedY: 120,
  },
  gazinBounds: {
    x: 5726.9,
    y: 0,
    width: 6976.4,
    height: 2621.3,
    bleedX: 180,
    bleedY: 120,
  },
  cityLabel: {
    x: 1840,
    y: 340,
    width: 1160,
    height: 86,
    paddingX: 56,
    fontSize: 40,
    line: {
      x1: 1609.7,
      y1: 0,
      x2: 510.6,
      y2: 2086.7,
    },
  },
  gazinLabel: {
    x: 7310,
    y: 336,
    width: 1420,
    height: 86,
    paddingX: 56,
    fontSize: 40,
    line: {
      x1: 7096.9,
      y1: 0,
      x2: 5726.9,
      y2: 2621.3,
    },
  },
} as const;
