import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

type TemplateBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  bleedX: number;
  bleedY: number;
};

type TemplateLabel = {
  x: number;
  y: number;
  width: number;
  height: number;
  paddingX: number;
  fontSize: number;
  line: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
};

type CommunicationFrameTemplate = {
  viewBox: {
    width: number;
    height: number;
  };
  backgroundColor: string;
  placeholderColor: string;
  labelColor: string;
  labelFontFamily: string;
  labelFontWeight: string;
  borderPath: string;
  cityPath: string;
  gazinPath: string;
  cityBounds: TemplateBounds;
  gazinBounds: TemplateBounds;
  cityLabel: TemplateLabel;
  gazinLabel: TemplateLabel;
};

function resolveTemplateFilePath() {
  const candidates = [
    join(process.cwd(), 'assets', 'communication-frame-base.svg'),
    join(process.cwd(), 'backend', 'assets', 'communication-frame-base.svg'),
    join(__dirname, '..', '..', 'assets', 'communication-frame-base.svg'),
    join(__dirname, '..', '..', '..', 'assets', 'communication-frame-base.svg'),
  ];

  const templatePath = candidates.find((candidate) => existsSync(candidate));

  if (!templatePath) {
    throw new Error(
      'Arquivo da moldura base nao encontrado em backend/assets/communication-frame-base.svg',
    );
  }

  return templatePath;
}

function extractAttribute(source: string, pattern: RegExp, label: string) {
  const match = source.match(pattern);

  if (!match?.[1]) {
    throw new Error(`Nao foi possivel localizar ${label} na moldura base`);
  }

  return match[1];
}

function loadTemplate(): CommunicationFrameTemplate {
  const templateSource = readFileSync(resolveTemplateFilePath(), 'utf8');
  const viewBoxMatch = templateSource.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/i);

  if (!viewBoxMatch?.[1] || !viewBoxMatch?.[2]) {
    throw new Error('Nao foi possivel ler o viewBox da moldura base');
  }

  const borderPath = extractAttribute(
    templateSource,
    /<path[^>]*id="Borda"[^>]*d="([^"]+)"/i,
    'o path da borda',
  );
  const cityPath = extractAttribute(
    templateSource,
    /<path[^>]*id="Imagem_Cidade"[^>]*d="([^"]+)"/i,
    'o path da imagem da cidade',
  );
  const gazinPath = extractAttribute(
    templateSource,
    /<path[^>]*id="Imagem_Gazin"[^>]*d="([^"]+)"/i,
    'o path da imagem da Gazin',
  );

  return {
    viewBox: {
      width: Number(viewBoxMatch[1]),
      height: Number(viewBoxMatch[2]),
    },
    backgroundColor: '#97D1F3',
    placeholderColor: '#1D1D1B',
    labelColor: '#6098BE',
    labelFontFamily: "'Montserrat Black', 'Montserrat', Arial, sans-serif",
    labelFontWeight: '900',
    borderPath,
    cityPath,
    gazinPath,
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
  };
}

let cachedTemplate: CommunicationFrameTemplate | null = null;

export function getCommunicationFrameTemplate() {
  if (!cachedTemplate) {
    cachedTemplate = loadTemplate();
  }

  return cachedTemplate;
}
