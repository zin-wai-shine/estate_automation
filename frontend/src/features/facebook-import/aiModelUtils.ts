/**
 * Utility helper to get clean display names for AI providers and models.
 */
export const getAIModelDisplayName = (provider?: string, model?: string): string => {
  if (provider === 'runware_ai' || model?.startsWith('runware:')) {
    if (model === 'runware:101@1') return 'FLUX.1 Schnell';
    if (model === 'runware:100@1') return 'SDXL Realism';
    return model ? model.replace('runware:', '') : 'Runware AI';
  }
  if (provider === 'laozhang_ai') {
    if (model === 'deepseek-v3') return 'DeepSeek V3';
    if (model === 'deepseek-r1') return 'DeepSeek R1';
    if (model === 'gpt-4.1') return 'GPT-4.1';
    if (model === 'gpt-4o-mini') return 'GPT-4o-mini';
    if (model === 'gpt-4o') return 'GPT-4o';
    return model || 'LaoZhang AI';
  }
  if (provider === 'google_ai' || model?.includes('gemini')) {
    if (model?.includes('flash')) return 'Gemini Flash';
    if (model?.includes('pro')) return 'Gemini 1.5 Pro';
    return 'Gemini';
  }
  if (model === 'gpt-4o') return 'GPT-4o';
  if (model === 'gpt-4o-mini') return 'GPT-4o-mini';
  if (model === 'gpt-image-2.5-sunburst') return 'Image 2.5 Sunburst';
  if (model === 'gpt-image-2.5-flare') return 'Image 2.5 Flare';
  if (model === 'gpt-4.1') return 'GPT-4.1';
  if (model === 'deepseek-v3') return 'DeepSeek V3';
  return model || 'GPT-4o';
};

/**
 * Checks if a given model or provider is an Image model (for photo editing & enhancement).
 */
export const isImageModel = (model?: string, provider?: string): boolean => {
  if (!model && !provider) return false;
  if (provider === 'runware_ai' || provider === 'runware') return true;
  if (model?.startsWith('runware:')) return true;
  if (model?.includes('image-2.5') || model?.includes('flux') || model?.includes('sdxl')) return true;
  return false;
};

/**
 * Determines whether a workflow AI Box is designated for Image Enhancement & Editing
 * rather than Text/Copy generation.
 */
export const isImageAIBox = (
  box: { id?: string; provider?: string; model?: string; processType?: string },
  connections: { fromNodeId: string; toNodeId: string }[] = []
): boolean => {
  if (!box) return false;
  // If connected from 'get-content', it is guaranteed to be a Content / Copywriting node
  if (box.id && connections.some((c) => c.fromNodeId === 'get-content' && c.toNodeId === box.id)) {
    return false;
  }
  // If connected from 'get-images'
  if (box.id && connections.some((c) => c.fromNodeId === 'get-images' && c.toNodeId === box.id)) {
    return true;
  }
  // If process type is explicitly image
  if (box.processType === 'image_enhance' || box.processType === 'image_edit') {
    return true;
  }
  // If the model itself is an image model
  if (isImageModel(box.model, box.provider)) {
    return true;
  }
  return false;
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
 * Unconnected nodes are excluded.
 */
export const isContentConnectedAIBox = (
  box: { id?: string; provider?: string; model?: string; processType?: string },
  connections: { fromNodeId: string; toNodeId: string }[] = []
): boolean => {
  if (!box || !box.id) return false;
  if (connections.length > 0 && !connections.some((c) => c.fromNodeId === box.id || c.toNodeId === box.id)) {
    return false;
  }
  return !isImageAIBox(box, connections);
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
