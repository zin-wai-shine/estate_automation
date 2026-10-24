import { loadAvailablePromptTemplates } from '../facebook-import/FacebookWorkflowCanvas';

export interface BrowserPromptOption {
  id: string;
  name: string;
  category: string;
  instructions: string;
}

export const STANDARD_BROWSER_PROMPTS: BrowserPromptOption[] = [
  {
    id: 'photo_retouch',
    name: 'Photo Enhancement (Strict Room Preservation)',
    category: 'IMAGE_ENHANCE',
    instructions:
      'Professionally retouch this property photograph: enhance sharpness, clarity, dynamic range, window sky dehazing, and authentic true-daylight color accuracy. Preserve exactly the original room layout, furniture, walls, floor, and architecture without alteration.',
  },
  {
    id: 'perspective_correction',
    name: 'Perspective & Architectural Geometry Alignment',
    category: 'IMAGE_ENHANCE',
    instructions:
      'Correct wide-angle optical vertical convergence: align vertical door and window lines to 90 degrees straight, neutralize barrel distortion, and preserve 100% of authentic furnishings and room dimensions.',
  },
  {
    id: 'facebook_hero',
    name: 'Facebook Hero Master (High Dynamic Range 4:5)',
    category: 'IMAGE_ENHANCE',
    instructions:
      'Calibrate dynamic exposure for Facebook mobile feed: lift deep shadow details across living area, protect exterior view highlights, and boost interior warmth while preserving original staging.',
  },
  {
    id: 'marketplace_hero',
    name: 'Marketplace Hero (High Click-Through Clarity)',
    category: 'IMAGE_ENHANCE',
    instructions:
      'Optimize property photo for high marketplace visibility: maximize clarity on master bedroom and living room finishes, sharpen architectural edges, and output crisp 1080x1350 resolution.',
  },
  {
    id: 'tiktok_hero',
    name: 'TikTok Vertical Hero (Ultra Crisp 9:16 / 4:5)',
    category: 'IMAGE_ENHANCE',
    instructions:
      'High-contrast luxury real estate presentation for vertical mobile viewing: enhance ambient lighting glow, polish reflective stone and glass surfaces, and maintain strict authentic property structure.',
  },
];

const DUMMY_PLACEHOLDER = 'Enhance real estate photo via ChatGPT browser multi-worker pipeline';

/**
 * Resolves the full image enhancement prompt text for an External Browser node.
 * Strictly guarantees that any user-selected template (e.g. from the dropdown or prompt library)
 * is retrieved in full rather than falling back to dummy or truncated text.
 */
export const resolvePromptForBrowserNode = (
  box: any,
  propContext?: { title?: string; price?: string; width?: number; height?: number }
): string => {
  if (!box) return STANDARD_BROWSER_PROMPTS[0].instructions;

  let rawPrompt = '';
  const templateKey = String(box.browserPromptTemplateKey || box.templateId || '').trim();

  // 1. If explicit custom prompt is selected
  if (templateKey === 'custom_prompt' && (box.browserCustomPrompt || box.customPrompt)) {
    rawPrompt = box.browserCustomPrompt || box.customPrompt;
  }

  // 2. Look up the chosen template key in the user's prompt library (localStorage)
  if (!rawPrompt && templateKey) {
    try {
      const libraryTemplates = loadAvailablePromptTemplates();
      const matched = libraryTemplates.find(
        (t) =>
          String(t.id).trim() === templateKey ||
          t.name.trim().toLowerCase() === templateKey.toLowerCase()
      );
      if (matched && matched.templateText && matched.templateText.trim() !== '') {
        rawPrompt = matched.templateText;
      }
    } catch (e) {
      console.warn('Error reading available prompt templates:', e);
    }
  }

  // 3. Look up in built-in standard prompts
  if (!rawPrompt && templateKey) {
    const std = STANDARD_BROWSER_PROMPTS.find(
      (p) =>
        String(p.id).trim() === templateKey ||
        p.name.trim().toLowerCase() === templateKey.toLowerCase()
    );
    if (std && std.instructions) {
      rawPrompt = std.instructions;
    }
  }

  // 4. Check explicit stored text fields if not equal to the default dummy placeholder
  if (!rawPrompt) {
    if (box.resolvedPrompt && box.resolvedPrompt.trim() !== '' && box.resolvedPrompt !== DUMMY_PLACEHOLDER) {
      rawPrompt = box.resolvedPrompt;
    } else if (box.browserPromptText && box.browserPromptText.trim() !== '' && box.browserPromptText !== DUMMY_PLACEHOLDER) {
      rawPrompt = box.browserPromptText;
    } else if (box.templateText && box.templateText.trim() !== '' && box.templateText !== DUMMY_PLACEHOLDER) {
      rawPrompt = box.templateText;
    } else if (box.customPrompt && box.customPrompt.trim() !== '') {
      rawPrompt = box.customPrompt;
    }
  }

  // 5. Ultimate fallback
  if (!rawPrompt || rawPrompt.trim() === '') {
    rawPrompt = STANDARD_BROWSER_PROMPTS[0].instructions;
  }

  // Context variable replacements
  const title = propContext?.title || 'Luxury Modern Property';
  const price = propContext?.price || 'Price on Request';
  const w = propContext?.width || box.outputWidth || box.targetWidth || 1080;
  const h = propContext?.height || box.outputHeight || box.targetHeight || 1350;

  return rawPrompt
    .replace(/\{title\}/g, title)
    .replace(/\{project_name\}/g, title)
    .replace(/\{price\}/g, price)
    .replace(/\{output_width\}/g, String(w))
    .replace(/\{output_height\}/g, String(h))
    .trim();
};
