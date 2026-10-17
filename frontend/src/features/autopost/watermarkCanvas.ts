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
  if (config.type === 'logo' && config.logoUrl) {
    try {
      const logoImg = await loadImageElement(config.logoUrl);
      const logoAspect = (logoImg.naturalHeight || logoImg.height) / (logoImg.naturalWidth || logoImg.width || 1);
      const targetWidth = Math.round(canvas.width * (config.scale / 100));
      const targetHeight = Math.round(targetWidth * logoAspect);

      const { x, y } = calculateAnchorCoordinates(
        canvas.width,
        canvas.height,
        targetWidth,
        targetHeight,
        config.position,
        config.margin
      );

      ctx.save();
      ctx.globalAlpha = Math.max(0.1, Math.min(1.0, config.opacity / 100));

      if (config.hasShadow) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
        ctx.shadowBlur = Math.max(4, Math.round(canvas.width * 0.008));
        ctx.shadowOffsetX = Math.max(2, Math.round(canvas.width * 0.003));
        ctx.shadowOffsetY = Math.max(2, Math.round(canvas.width * 0.003));
      }

      ctx.drawImage(logoImg, x, y, targetWidth, targetHeight);
      ctx.restore();
    } catch (logoErr) {
      console.warn('Failed to draw logo watermark:', logoErr);
    }
  } else if (config.type === 'text' && config.text) {
    // Interpolate dynamic tags
    let resolvedText = config.text;
    Object.entries(dynamicTags).forEach(([key, val]) => {
      resolvedText = resolvedText.replace(new RegExp(`{${key}}`, 'gi'), val);
    });

    const scaledFontSize = Math.max(14, Math.round((canvas.width / 1000) * config.fontSize));
    ctx.save();
    ctx.font = `${config.fontWeight || '600'} ${scaledFontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
    ctx.textBaseline = 'top';

    const metrics = ctx.measureText(resolvedText);
    const textWidth = Math.round(metrics.width);
    const textHeight = Math.round(scaledFontSize * 1.25);

    const { x, y } = calculateAnchorCoordinates(
      canvas.width,
      canvas.height,
      textWidth,
      textHeight,
      config.position,
      config.margin
    );

    ctx.globalAlpha = Math.max(0.1, Math.min(1.0, config.opacity / 100));

    if (config.hasShadow) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
      ctx.shadowBlur = Math.max(4, Math.round(canvas.width * 0.006));
      ctx.shadowOffsetX = Math.max(1, Math.round(canvas.width * 0.002));
      ctx.shadowOffsetY = Math.max(1, Math.round(canvas.width * 0.002));
    }

    ctx.fillStyle = config.textColor || '#FFFFFF';
    ctx.fillText(resolvedText, x, y);
    ctx.restore();
  }

  return canvas.toDataURL(format, quality);
};
