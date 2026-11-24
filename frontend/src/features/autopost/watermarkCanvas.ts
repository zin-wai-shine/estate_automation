import type { WatermarkConfig, WatermarkPosition } from './watermarkStorage';

export const loadImageElement = async (src: string): Promise<HTMLImageElement> => {
  if (!src) throw new Error('Empty image source');

  // Direct load for data / blob URLs
  if (src.startsWith('data:') || src.startsWith('blob:')) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load inline image'));
      img.src = src;
    });
  }

  // Normalize URLs: prefer direct companion download endpoint on port 9224 for enhanced photos
  let cleanSrc = src;
  if (typeof window !== 'undefined') {
    if (cleanSrc.includes('/storage/uploads/facebook-import/enhanced/')) {
      const fname = cleanSrc.split('/').pop();
      if (fname) cleanSrc = `http://127.0.0.1:9224/downloaded-image?file=${encodeURIComponent(fname)}`;
    } else if (cleanSrc.includes('localhost:8085/storage')) {
      cleanSrc = cleanSrc.replace(/^https?:\/\/localhost:8085/, '');
    } else if (cleanSrc.startsWith('/downloaded-image')) {
      cleanSrc = `http://127.0.0.1:9224${cleanSrc}`;
    }
  }

  // Attempt 1: Fetch as Blob and create a local blob: URL.
  // This guarantees the image is same-origin so drawing onto a canvas NEVER taints it!
  try {
    const res = await fetch(cleanSrc);
    if (res.ok) {
      const blob = await res.blob();
      if (blob.type && !blob.type.startsWith('image/')) {
        throw new Error(`Fetched resource is not an image (got ${blob.type})`);
      }
      const objectUrl = URL.createObjectURL(blob);
      return await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          setTimeout(() => {
            try { URL.revokeObjectURL(objectUrl); } catch (_) {}
          }, 60000);
          resolve(img);
        };
        img.onerror = () => {
          try { URL.revokeObjectURL(objectUrl); } catch (_) {}
          reject(new Error(`Failed to load blob image for ${cleanSrc}`));
        };
        img.src = objectUrl;
      });
    }
  } catch (_) {
    // If relative /storage failed, try companion if it's an enhanced image filename
    let filename = '';
    if (cleanSrc.includes('/enhanced/')) {
      const parts = cleanSrc.split('/');
      filename = parts[parts.length - 1];
    } else if (src.includes('/downloaded-image?file=')) {
      try {
        filename = new URL(src, window.location.origin).searchParams.get('file') || '';
      } catch (_) {}
    }
    if (filename) {
      try {
        const compUrl = `http://127.0.0.1:9224/downloaded-image?file=${encodeURIComponent(filename)}`;
        const compRes = await fetch(compUrl);
        if (compRes.ok) {
          const blob = await compRes.blob();
          if (blob.type && !blob.type.startsWith('image/')) {
            throw new Error(`Companion resource is not an image (got ${blob.type})`);
          }
          const objectUrl = URL.createObjectURL(blob);
          return await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              setTimeout(() => {
                try { URL.revokeObjectURL(objectUrl); } catch (_) {}
              }, 60000);
              resolve(img);
            };
            img.onerror = () => {
              try { URL.revokeObjectURL(objectUrl); } catch (_) {}
              reject(new Error(`Failed to load companion blob image`));
            };
            img.src = objectUrl;
          });
        }
      } catch (_) {}
    }
  }

  // Attempt 2: HTML Image element with crossOrigin
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      // If anonymous crossOrigin fails (e.g. strict CDN), retry without crossOrigin
      const fallbackImg = new Image();
      fallbackImg.onload = () => resolve(fallbackImg);
      fallbackImg.onerror = () => reject(new Error(`Failed to load image from ${src.slice(0, 50)}...`));
      fallbackImg.src = cleanSrc;
    };
    img.src = cleanSrc;
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

    if (config.textTransform === 'uppercase') {
      resolvedText = resolvedText.toUpperCase();
    }

    const stylePrefix = config.fontStyle && config.fontStyle !== 'normal' ? `${config.fontStyle} ` : '';
    const weightVal = config.fontWeight || '600';
    const familyVal = config.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';

    // Calculate font size using config.scale (% of image width) so text size matches Watermark Studio preview
    let scaledFontSize: number;
    const effectiveScale = typeof config.scale === 'number' && config.scale > 0 ? config.scale : undefined;

    if (effectiveScale) {
      // 1. Measure text width at a reference font size (100px)
      const refSize = 100;
      ctx.save();
      ctx.font = `${stylePrefix}${weightVal} ${refSize}px ${familyVal}`;
      const refMetrics = ctx.measureText(resolvedText);
      const refWidth = Math.max(1, refMetrics.width);
      ctx.restore();

      // 2. Determine target width for text based on scale (% of width)
      let targetTextW: number;
      if (layoutMode === 'repeat-grid' || layoutMode === 'top-bottom') {
        const cols = Math.max(1, Math.min(12, config.columns || 6));
        const usableW = width * 0.85;
        targetTextW = (usableW / cols) * (effectiveScale / 35);
      } else {
        // Single mark: width is directly proportional to scale%
        targetTextW = width * (effectiveScale / 100);
      }

      // 3. Compute font size needed to achieve targetTextW
      const calculatedFontSize = Math.round((targetTextW / refWidth) * refSize);

      // 4. Bound font size: max 14% of image height, min 14px
      const maxFontSize = Math.round(height * 0.14);
      const minFontSize = Math.max(14, Math.round(width * 0.018));
      scaledFontSize = Math.max(minFontSize, Math.min(maxFontSize, calculatedFontSize));
    } else {
      scaledFontSize = Math.max(14, Math.round((width / 1000) * (config.fontSize || 26)));
    }

    const fontString = `${stylePrefix}${weightVal} ${scaledFontSize}px ${familyVal}`;

    ctx.save();
    ctx.font = fontString;
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
      ctx.font = fontString;
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
