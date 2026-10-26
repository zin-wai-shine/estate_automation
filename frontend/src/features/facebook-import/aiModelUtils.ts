/**
 * Utility helper to get clean display names for AI providers and models.
 */
export const getAIModelDisplayName = (provider?: string, model?: string): string => {
  if (provider === 'watermark' || model === 'watermark') {
    return 'Watermark Stamp';
  }
  if (
    provider === 'runware_ai' ||
    model?.startsWith('runware:') ||
    model?.startsWith('civitai:') ||
    model?.startsWith('google:nano-banana') ||
    model?.includes('nano-banana') ||
    model?.includes('nanobanana')
  ) {
    if (model === 'runware:upscale') return 'Runware Upscale & Restore';
    if (model === 'google:nano-banana@2.1' || model === 'runware:nano-banana' || model === 'nano-banana') return 'Nano Banana 2.1';
    if (model === 'google:nano-banana@2-lite') return 'Nano Banana 2 Lite';
    if (model === 'google:nano-banana@2') return 'Nano Banana 2';
    if (model === 'runware:101@1') return 'FLUX.1 Schnell';
    if (model === 'runware:100@1') return 'SDXL Realism';
    if (model === 'civitai:133005@782002') return 'Juggernaut XL';
    if (model === 'runware:102@1') return 'FLUX.1 Dev';
    return model
      ? model.replace('runware:', '').replace('civitai:', '').replace('google:', '')
      : 'Runware AI';
  }
  if (provider === 'laozhang_ai') {
    if (model?.includes('claude-3-7-sonnet') || model?.includes('claude-3.7-sonnet')) return 'Claude 3.7 Sonnet';
    if (model?.includes('claude-3-5-sonnet') || model?.includes('claude-3.5-sonnet')) return 'Claude 3.5 Sonnet';
    if (model?.includes('claude-3-5-haiku') || model?.includes('claude-3.5-haiku')) return 'Claude 3.5 Haiku';
    if (model === 'deepseek-v3') return 'DeepSeek V3';
    if (model === 'deepseek-r1') return 'DeepSeek R1';
    if (model === 'gpt-4.1') return 'GPT-4.1';
    if (model === 'gpt-4o-mini') return 'GPT-4o-mini';
    if (model === 'gpt-4o') return 'GPT-4o';
    return model || 'LaoZhang AI';
  }
  if (provider === 'google_ai' || model?.includes('gemini')) {
    if (model?.includes('2.5')) return 'Gemini 2.5 Flash';
    if (model?.includes('2.0') || model?.includes('2-flash')) return 'Gemini 2.0 Flash';
    if (model?.includes('flash')) return 'Gemini Flash';
    if (model?.includes('pro')) return 'Gemini 1.5 Pro';
    return 'Gemini';
  }
  if (model === 'gpt-4o') return 'GPT-4o';
  if (model === 'gpt-4o-mini') return 'GPT-4o-mini';
  if (model === 'gpt-4.1') return 'GPT-4.1';
  if (model === 'gpt-4-turbo') return 'GPT-4 Turbo';
  if (model === 'o3-mini') return 'o3-mini';
  if (model === 'o1') return 'o1';
  if (model === 'deepseek-v3') return 'DeepSeek V3';
  if (model === 'deepseek-r1') return 'DeepSeek R1';
  if (model === 'gpt-image-2.5-sunburst') return 'Image 2.5 Sunburst';
  if (model === 'gpt-image-2.5-flare') return 'Image 2.5 Flare';
  return model || 'GPT-4o';
};

/**
 * Checks if a given model or provider is an Image model (for photo editing & enhancement).
 */
export const isImageModel = (model?: string, provider?: string): boolean => {
  if (!model && !provider) return false;
  if (provider === 'watermark' || model === 'watermark') return true;
  if (provider === 'runware_ai' || provider === 'runware') return true;
  if (
    model?.startsWith('runware:') ||
    model?.startsWith('civitai:') ||
    model?.startsWith('google:nano-banana') ||
    model?.includes('banana')
  ) {
    return true;
  }
  if (model?.includes('image-2.5') || model?.includes('flux') || model?.includes('sdxl') || model?.includes('juggernaut')) return true;
  return false;
};

/**
 * Determines whether an AI Box is specifically a Watermark node.
 */
/**
 * Determines whether a box is an n8n Automation Engine integration node.
 */
export const isN8NAIBox = (
  box?: { id?: string; provider?: string; processType?: string; title?: string }
): boolean => {
  if (!box) return false;
  return (
    box.provider === 'n8n' ||
    box.processType === 'n8n_automation' ||
    Boolean(box.id?.includes('n8n'))
  );
};

/**
 * Determines whether a workflow box is an External Browser image processing node.
 */
export const isChromeTabGroupAIBox = (
  box?: { id?: string; processType?: string }
): boolean => {
  if (!box) return false;
  return (
    box.processType === 'chrome_tab_group' ||
    Boolean(box.id?.includes('tabgroup')) ||
    Boolean(box.id?.includes('tab-group'))
  );
};

export const isChromeProfileAIBox = (
  box?: { id?: string; processType?: string }
): boolean => {
  if (!box) return false;
  if (isChromeTabGroupAIBox(box)) return false;
  return (
    box.processType === 'chrome_profile' ||
    Boolean(box.id?.includes('chrome-')) ||
    Boolean(box.id?.includes('profile'))
  );
};

export const isExternalBrowserAIBox = (
  box?: { id?: string; provider?: string; processType?: string; title?: string }
): boolean => {
  if (!box) return false;
  if (isChromeProfileAIBox(box) || isChromeTabGroupAIBox(box)) return false;
  if (box.processType === 'chrome_profile' || box.processType === 'chrome_tab_group') return false;
  return (
    box.processType === 'external_browser' ||
    Boolean(box.id?.includes('external-browser')) ||
    Boolean(box.title?.toLowerCase().includes('external browser')) ||
    (box.provider === 'external_browser' && !box.id?.includes('chrome') && !box.id?.includes('tabgroup'))
  );
};

export const isWatermarkAIBox = (
  box?: { id?: string; provider?: string; model?: string; processType?: string; title?: string; cropFormatId?: string; watermarkPresetId?: string; subtitle?: string }
): boolean => {
  if (!box) return false;
  if (isChromeProfileAIBox(box) || isChromeTabGroupAIBox(box)) return false;
  if (isN8NAIBox(box) || isExternalBrowserAIBox(box)) return false;
  if (box.processType === 'text_format' || box.processType === 'text_ai') return false;
  return (
    box.processType === 'watermark' ||
    box.provider === 'watermark' ||
    Boolean(box.id?.includes('watermark')) ||
    Boolean(box.cropFormatId) ||
    Boolean(box.watermarkPresetId) ||
    Boolean(box.subtitle?.includes('×'))
  );
};

/**
 * Determines whether an AI Box is specifically a Text Format Preset node (holding prompt template).
 */
export const isTextFormatAIBox = (
  box?: { id?: string; provider?: string; model?: string; processType?: string; title?: string; cropFormatId?: string; watermarkPresetId?: string; subtitle?: string; templateId?: string; templateText?: string }
): boolean => {
  if (!box) return false;
  if (isChromeProfileAIBox(box) || isChromeTabGroupAIBox(box)) return false;
  if (isN8NAIBox(box) || isExternalBrowserAIBox(box)) return false;
  if (isWatermarkAIBox(box)) return false;
  if (box.processType === 'image_enhance' || box.provider === 'runware_ai' || box.processType === 'text_ai') return false;
  return (
    box.processType === 'text_format' ||
    Boolean(box.title?.toLowerCase().startsWith('format:'))
  );
};

/**
 * Determines whether an AI Box is a Text AI Model Selector node.
 */
export const isTextAIBox = (
  box?: { id?: string; provider?: string; model?: string; processType?: string; title?: string; cropFormatId?: string; watermarkPresetId?: string; subtitle?: string; templateId?: string; templateText?: string },
  connections: { fromNodeId: string; toNodeId: string }[] = []
): boolean => {
  if (!box) return false;
  if (isChromeProfileAIBox(box) || isChromeTabGroupAIBox(box)) return false;
  if (isN8NAIBox(box) || isExternalBrowserAIBox(box)) return false;
  if (isWatermarkAIBox(box)) return false;
  if (isTextFormatAIBox(box)) return false;
  if (isImageAIBox(box, connections)) return false;
  return true;
};

/**
 * Determines whether a workflow AI Box is designated for Image Enhancement & Editing
 * rather than Text/Copy generation (includes both enhance & watermark in the image branch).
 */
export const isImageAIBox = (
  box: { id?: string; provider?: string; model?: string; processType?: string },
  connections: { fromNodeId: string; toNodeId: string }[] = []
): boolean => {
  if (!box) return false;
  if (isChromeProfileAIBox(box) || isChromeTabGroupAIBox(box)) return false;
  if (isN8NAIBox(box)) return false;
  if (isExternalBrowserAIBox(box)) return true;
  if (isWatermarkAIBox(box)) return true;
  // If connected from 'get-content', it is guaranteed to be a Content / Copywriting node
  if (box.id && connections.some((c) => c.fromNodeId === 'get-content' && c.toNodeId === box.id)) {
    return false;
  }
  // If connected from 'get-images'
  if (box.id && connections.some((c) => c.fromNodeId === 'get-images' && c.toNodeId === box.id)) {
    return true;
  }
  // If process type is explicitly image
  if (box.processType === 'image_enhance' || box.processType === 'image_edit' || box.processType === 'watermark') {
    return true;
  }
  // If the model itself is an image model
  if (isImageModel(box.model, box.provider)) {
    return true;
  }
  return false;
};

/**
 * Specifically checks if an AI box is an Image Enhancer (not a watermark node).
 */
export const isEnhanceAIBox = (
  box: { id?: string; provider?: string; model?: string; processType?: string },
  connections: { fromNodeId: string; toNodeId: string }[] = []
): boolean => {
  if (!box || isChromeProfileAIBox(box) || isChromeTabGroupAIBox(box) || isWatermarkAIBox(box)) return false;
  return isImageAIBox(box, connections);
};

/**
 * Checks if an AI box is connected to the workflow graph.
 * If connections exist in the workflow, an AI box is only connected if it has
 * at least one wire attached (incoming or outgoing).
 */
export const isAIBoxConnected = (
  box: { id?: string },
  connections?: { fromNodeId: string; toNodeId: string }[]
): boolean => {
  if (!box || !box.id) return false;
  if (!connections || connections.length === 0) return true;
  return connections.some((c) => c.fromNodeId === box.id || c.toNodeId === box.id);
};

/**
 * Checks whether an AI Box is an active connected Content / Copywriting node.
 * Unconnected nodes and image/watermark nodes are excluded.
 */
export const isContentConnectedAIBox = (
  box: { id?: string; provider?: string; model?: string; processType?: string },
  connections: { fromNodeId: string; toNodeId: string }[] = []
): boolean => {
  if (!box || !box.id) return false;
  if (isWatermarkAIBox(box)) return false;
  if (isImageAIBox(box, connections)) return false;
  return isAIBoxConnected(box, connections);
};


/**
 * Checks whether an AI Box is an active connected Image Enhancement node.
 * Unconnected nodes are excluded.
 */
export const isImageConnectedAIBox = (
  box: { id?: string; provider?: string; model?: string; processType?: string },
  connections: { fromNodeId: string; toNodeId: string }[] = []
): boolean => {
  if (!box || !box.id) return false;
  if (connections.length > 0 && !connections.some((c) => c.fromNodeId === box.id || c.toNodeId === box.id)) {
    return false;
  }
  return isImageAIBox(box, connections);
};

/**
 * Determines whether a prompt template is designed for Image Enhancement & Vision
 * rather than Text/Copy generation.
 */
export const isImagePrompt = (p: { category?: string; name?: string; templateText?: string }): boolean => {
  if (!p) return false;
  const cat = (p.category || '').toLowerCase();
  const name = (p.name || '').toLowerCase();
  if (cat.includes('image') || cat.includes('enhance') || cat.includes('photo') || cat.includes('vision') || cat.includes('staging')) return true;
  if (name.includes('image') || name.includes('enhance') || name.includes('photo') || name.includes('staging')) return true;
  return false;
};
