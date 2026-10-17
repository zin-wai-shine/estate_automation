import type { WatermarkConfig, WatermarkPosition } from './watermarkStorage';

export const loadImageElement = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      // If anonymous crossOrigin fails (e.g. data URL or strict CDN), retry without crossOrigin
      const fallbackImg = new Image();
      fallbackImg.onload = () => resolve(fallbackImg);
      fallbackImg.onerror = () => reject(new Error(`Failed to load image from ${src.slice(0, 50)}...`));
      fallbackImg.src = src;
    };
    img.src = src;
  });
};

interface RenderWatermarkOptions {
  sourceImageUrl: string;
  config: WatermarkConfig;
  dynamicTags?: Record<string, string>;
  format?: 'image/jpeg' | 'image/png' | 'image/webp';
  quality?: number;
}

export const calculateAnchorCoordinates = (
  canvasWidth: number,
  canvasHeight: number,
  itemWidth: number,
  itemHeight: number,
  position: WatermarkPosition,
  marginPercent: number
): { x: number; y: number } => {
  const marginPx = (marginPercent / 100) * Math.min(canvasWidth, canvasHeight);

  let x = 0;
  let y = 0;

  switch (position) {
    case 'top-left':
      x = marginPx;
      y = marginPx;
      break;
    case 'top-center':
      x = (canvasWidth - itemWidth) / 2;
      y = marginPx;
      break;
    case 'top-right':
      x = canvasWidth - itemWidth - marginPx;
      y = marginPx;
      break;
    case 'center-left':
      x = marginPx;
      y = (canvasHeight - itemHeight) / 2;
      break;
    case 'center':
      x = (canvasWidth - itemWidth) / 2;
      y = (canvasHeight - itemHeight) / 2;
      break;
    case 'center-right':
      x = canvasWidth - itemWidth - marginPx;
      y = (canvasHeight - itemHeight) / 2;
      break;
    case 'bottom-left':
      x = marginPx;
      y = canvasHeight - itemHeight - marginPx;
      break;
    case 'bottom-center':
      x = (canvasWidth - itemWidth) / 2;
      y = canvasHeight - itemHeight - marginPx;
      break;
    case 'bottom-right':
    default:
      x = canvasWidth - itemWidth - marginPx;
      y = canvasHeight - itemHeight - marginPx;
      break;
  }

  return { x: Math.round(x), y: Math.round(y) };
};

export const drawWatermarkOnContext = async (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: WatermarkConfig,
  dynamicTags: Record<string, string> = {}
): Promise<void> => {
  if (!config.enabled) return;

  const layoutMode = config.layoutMode || 'single';
  const rotation = config.rotation || 0;
  const opacity = Math.max(0.05, Math.min(1.0, (config.opacity ?? 80) / 100));

  // 1. Draw Image Frame / Border if enabled
  if (config.borderStyle && config.borderStyle !== 'none') {
    ctx.save();
    let borderW = Math.max(3, Math.round(width * 0.01));
    if (config.borderStyle === 'solid-thin-white') {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = Math.max(2, Math.round(width * 0.006));
      ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, width - ctx.lineWidth, height - ctx.lineWidth);
    } else if (config.borderStyle === 'solid-dark') {
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = Math.max(4, Math.round(width * 0.014));
      ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, width - ctx.lineWidth, height - ctx.lineWidth);
    } else if (config.borderStyle === 'luxury-gold') {
      ctx.strokeStyle = '#EAB308';
      ctx.lineWidth = Math.max(3, Math.round(width * 0.008));
      ctx.strokeRect(borderW, borderW, width - borderW * 2, height - borderW * 2);
      ctx.strokeStyle = 'rgba(234, 179, 8, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(borderW + 5, borderW + 5, width - (borderW + 5) * 2, height - (borderW + 5) * 2);
    } else if (config.borderStyle === 'modern-accent') {
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = Math.max(4, Math.round(width * 0.01));
      ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, width - ctx.lineWidth, height - ctx.lineWidth);
    }
    ctx.restore();
  }

  // 2. Prepare Watermark Item (Logo or Text)
  if (config.type === 'logo' && config.logoUrl) {
    try {
      const logoImg = await loadImageElement(config.logoUrl);
      const logoAspect = (logoImg.naturalHeight || logoImg.height) / (logoImg.naturalWidth || logoImg.width || 1);
      const targetWidth = Math.round(width * ((config.scale || 20) / 100));
      const targetHeight = Math.round(targetWidth * logoAspect);

      const drawMarkAt = (cx: number, cy: number) => {
        ctx.save();
        ctx.translate(cx, cy);
        if (rotation !== 0) {
          ctx.rotate((rotation * Math.PI) / 180);
        }
        ctx.globalAlpha = opacity;
        if (config.hasShadow) {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
          ctx.shadowBlur = Math.max(3, Math.round(width * 0.007));
          ctx.shadowOffsetX = Math.max(1, Math.round(width * 0.002));
          ctx.shadowOffsetY = Math.max(1, Math.round(width * 0.002));
        }
        ctx.drawImage(logoImg, -targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight);
        ctx.restore();
      };

      if (layoutMode === 'repeat-grid') {
        const rows = Math.max(1, Math.min(10, config.rows || 2));
        const cols = Math.max(1, Math.min(12, config.columns || 6));
        const gapPct = (config.gapSpacing ?? 8) / 100;
        const marginPx = Math.min(width, height) * gapPct;
        const usableW = width - 2 * marginPx;
        const usableH = height - 2 * marginPx;

        for (let r = 0; r < rows; r++) {
          const cy = rows === 1 ? height / 2 : marginPx + (r / (rows - 1)) * usableH;
          const rowOffset = (config.offsetAlternateRows && r % 2 === 1) ? (usableW / cols) * 0.5 : 0;
          for (let c = 0; c < cols; c++) {
            const cx = cols === 1 ? width / 2 : marginPx + (c / (cols - 1)) * usableW + rowOffset;
            drawMarkAt(cx, cy);
          }
        }
      } else if (layoutMode === 'top-bottom') {
        const cols = Math.max(1, Math.min(12, config.columns || 5));
        const marginPx = Math.min(width, height) * 0.07;
        const usableW = width - 2 * marginPx;
        const topY = marginPx + targetHeight / 2;
        const bottomY = height - marginPx - targetHeight / 2;

        [topY, bottomY].forEach((cy) => {
          for (let c = 0; c < cols; c++) {
            const cx = cols === 1 ? width / 2 : marginPx + (c / (cols - 1)) * usableW;
            drawMarkAt(cx, cy);
          }
        });
      } else {
        // Single Mark
        const { x, y } = calculateAnchorCoordinates(
          width,
          height,
          targetWidth,
          targetHeight,
          config.position,
          config.margin
        );
        drawMarkAt(x + targetWidth / 2, y + targetHeight / 2);
      }
    } catch (logoErr) {
      console.warn('Failed to draw logo watermark:', logoErr);
    }
  } else if (config.type === 'text' && config.text) {
    let resolvedText = config.text;
    Object.entries(dynamicTags).forEach(([key, val]) => {
      resolvedText = resolvedText.replace(new RegExp(`{${key}}`, 'gi'), val);
    });

    const scaledFontSize = Math.max(13, Math.round((width / 1000) * (config.fontSize || 24)));
    ctx.save();
    ctx.font = `${config.fontWeight || '600'} ${scaledFontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
    const metrics = ctx.measureText(resolvedText);
    const textWidth = Math.round(metrics.width);
    const textHeight = Math.round(scaledFontSize * 1.25);
    ctx.restore();

    const drawTextAt = (cx: number, cy: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      if (rotation !== 0) {
        ctx.rotate((rotation * Math.PI) / 180);
      }
      ctx.globalAlpha = opacity;
      ctx.font = `${config.fontWeight || '600'} ${scaledFontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (config.hasShadow) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
        ctx.shadowBlur = Math.max(3, Math.round(width * 0.006));
        ctx.shadowOffsetX = Math.max(1, Math.round(width * 0.002));
        ctx.shadowOffsetY = Math.max(1, Math.round(width * 0.002));
      }

      ctx.fillStyle = config.textColor || '#FFFFFF';
      ctx.fillText(resolvedText, 0, 0);
      ctx.restore();
    };

    if (layoutMode === 'repeat-grid') {
      const rows = Math.max(1, Math.min(10, config.rows || 2));
      const cols = Math.max(1, Math.min(12, config.columns || 6));
      const gapPct = (config.gapSpacing ?? 8) / 100;
      const marginPx = Math.min(width, height) * gapPct;
      const usableW = width - 2 * marginPx;
      const usableH = height - 2 * marginPx;

      for (let r = 0; r < rows; r++) {
        const cy = rows === 1 ? height / 2 : marginPx + (r / (rows - 1)) * usableH;
        const rowOffset = (config.offsetAlternateRows && r % 2 === 1) ? (usableW / cols) * 0.5 : 0;
        for (let c = 0; c < cols; c++) {
          const cx = cols === 1 ? width / 2 : marginPx + (c / (cols - 1)) * usableW + rowOffset;
          drawTextAt(cx, cy);
        }
      }
    } else if (layoutMode === 'top-bottom') {
      const cols = Math.max(1, Math.min(12, config.columns || 5));
      const marginPx = Math.min(width, height) * 0.07;
      const usableW = width - 2 * marginPx;
      const topY = marginPx + textHeight / 2;
      const bottomY = height - marginPx - textHeight / 2;

      [topY, bottomY].forEach((cy) => {
        for (let c = 0; c < cols; c++) {
          const cx = cols === 1 ? width / 2 : marginPx + (c / (cols - 1)) * usableW;
          drawTextAt(cx, cy);
        }
      });
    } else {
      // Single Mark
      const { x, y } = calculateAnchorCoordinates(
        width,
        height,
        textWidth,
        textHeight,
        config.position,
        config.margin
      );
      drawTextAt(x + textWidth / 2, y + textHeight / 2);
    }
  }
};

export const renderWatermarkedImage = async ({
  sourceImageUrl,
  config,
  dynamicTags = {},
  format = 'image/jpeg',
  quality = 0.95,
}: RenderWatermarkOptions): Promise<string> => {
  if (!config.enabled) {
    return sourceImageUrl;
  }

  const baseImg = await loadImageElement(sourceImageUrl);
  const canvas = document.createElement('canvas');
  canvas.width = baseImg.naturalWidth || baseImg.width || 1200;
  canvas.height = baseImg.naturalHeight || baseImg.height || 1200;

  const ctx = canvas.getContext('2d');
  if (!ctx) return sourceImageUrl;

  // 1. Draw base photo
  ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);

  // 2. Render Watermark
  await drawWatermarkOnContext(ctx, canvas.width, canvas.height, config, dynamicTags);

  return canvas.toDataURL(format, quality);
};
