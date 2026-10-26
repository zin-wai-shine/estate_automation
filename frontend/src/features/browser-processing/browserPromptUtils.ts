import { loadAvailablePromptTemplates } from '../facebook-import/FacebookWorkflowCanvas';

export interface BrowserPromptOption {
  id: string;
  name: string;
  category: string;
  instructions: string;
}

export const STANDARD_BROWSER_PROMPTS: BrowserPromptOption[] = [
  {
    id: 'fb_hero_master',
    name: '✨ FB Hero Prompt Template',
    category: 'GENERATE_IMAGE',
    instructions:
      'Generate a hero real estate listing image based on condo unit context and reference styling. Maintain realistic architectural aesthetics, high dynamic range, and authentic materials.',
  },
  {
    id: 'photo_retouch',
    name: '✨ Enhance Image (Default Retouch)',
    category: 'IMAGE_ENHANCE',
    instructions:
      'Professionally retouch this property photograph: enhance sharpness, clarity, dynamic range, window sky dehazing, and authentic true-daylight color accuracy. Preserve exactly the original room layout, furniture, walls, floor, and architecture without alteration.',
  },
  {
    id: 'architectural_lighting',
    name: '💎 Luxury Architectural Lighting',
    category: 'IMAGE_ENHANCE',
    instructions:
      'Enhance interior ambient warm glow, balance window exterior highlights, and bring out premium texture detail across stone, hardwood, and cabinetry.',
  },
  {
    id: 'sky_sunlight_hdr',
    name: '🌤️ Natural Sky & Sunlight HDR',
    category: 'IMAGE_ENHANCE',
    instructions:
      'Dehaze windows, introduce clear natural daylight sky and sunlight warmth, and balance interior shadows with high dynamic range.',
  },
  {
    id: 'perspective_correction',
    name: '📐 Perspective & Geometry Alignment',
    category: 'IMAGE_ENHANCE',
    instructions:
      'Correct wide-angle optical vertical convergence: align vertical door and window lines to 90 degrees straight, neutralize barrel distortion, and preserve 100% of authentic furnishings and room dimensions.',
  },
  {
    id: 'facebook_hero',
    name: 'Facebook Hero Master (High Dynamic Range 4:5)',
    category: 'GENERATE_IMAGE',
    instructions:
      'Calibrate dynamic exposure for Facebook mobile feed: lift deep shadow details across living area, protect exterior view highlights, and boost interior warmth while preserving original staging.',
  },
  {
    id: 'marketplace_hero',
    name: 'Marketplace Hero (High Click-Through Clarity)',
    category: 'GENERATE_IMAGE',
    instructions:
      'Optimize property photo for high marketplace visibility: maximize clarity on master bedroom and living room finishes, sharpen architectural edges, and output crisp 1080x1350 resolution.',
  },
  {
    id: 'tiktok_hero',
    name: 'TikTok Vertical Hero (Ultra Crisp 9:16 / 4:5)',
    category: 'GENERATE_IMAGE',
    instructions:
      'High-contrast luxury real estate presentation for vertical mobile viewing: enhance ambient lighting glow, polish reflective stone and glass surfaces, and maintain strict authentic property structure.',
  },
];

export const isGenerateCategory = (category?: string, name?: string): boolean => {
  const cat = (category || '').toUpperCase().trim();
  const n = (name || '').toLowerCase().trim();
  if (cat === 'GENERATE_IMAGE' || cat === 'IMAGE_GENERATE') return true;
  if (n.includes('hero') || n.includes('fb hero') || n.includes('generate')) {
    return true;
  }
  return false;
};

export const isEnhanceCategory = (category?: string, name?: string): boolean => {
  const cat = (category || '').toUpperCase().trim();
  const n = (name || '').toLowerCase().trim();
  if (isGenerateCategory(category, name)) return false;
  if (cat === 'IMAGE_ENHANCE' || cat === 'ENHANCE_IMAGE') return true;
  return n.includes('enhance') || n.includes('retouch') || n.includes('lighting') || n.includes('sky') || n.includes('perspective');
};

const DUMMY_PLACEHOLDER = 'Enhance real estate photo via ChatGPT browser multi-worker pipeline';

export const PERSISTENT_PROMPT_KEY_STORAGE = 'bolthaven_persistent_enhance_prompt_key';
export const PERSISTENT_PROMPT_TEXT_STORAGE = 'bolthaven_persistent_enhance_prompt_text';
export const PERSISTENT_CUSTOM_PROMPT_STORAGE = 'bolthaven_persistent_enhance_custom_prompt';

export const getPersistedPromptKey = (): string => {
  try {
    const saved = localStorage.getItem(PERSISTENT_PROMPT_KEY_STORAGE);
    if (saved && saved.trim() !== '') return saved.trim();
  } catch (e) {}
  return '';
};

export const getPersistedPromptText = (): string => {
  try {
    const saved = localStorage.getItem(PERSISTENT_PROMPT_TEXT_STORAGE);
    if (saved && saved.trim() !== '') return saved;
  } catch (e) {}
  return '';
};

export const getPersistedCustomPrompt = (): string => {
  try {
    const saved = localStorage.getItem(PERSISTENT_CUSTOM_PROMPT_STORAGE);
    if (saved && saved.trim() !== '') return saved;
  } catch (e) {}
  return '';
};

export const setPersistedPromptSelection = (key: string, text?: string, customText?: string) => {
  try {
    if (key) {
      localStorage.setItem(PERSISTENT_PROMPT_KEY_STORAGE, key.trim());
    }
    if (text) {
      localStorage.setItem(PERSISTENT_PROMPT_TEXT_STORAGE, text);
    }
    if (customText !== undefined) {
      localStorage.setItem(PERSISTENT_CUSTOM_PROMPT_STORAGE, customText);
    }
  } catch (e) {}
};

/**
 * Resolves the full image enhancement prompt text for an External Browser node.
 * Strictly guarantees that any user-selected template (e.g. from the dropdown or prompt library)
 * is retrieved in full, persisted across page reloads, and used consistently every time.
 */
export const resolvePromptForBrowserNode = (
  box: any,
  propContext?: { title?: string; price?: string; width?: number; height?: number }
): string => {
  let rawPrompt = '';
  const savedKey = getPersistedPromptKey();
  const savedText = getPersistedPromptText();

  // Template key: prioritize explicit key on box, but fallback to saved persistent key
  let templateKey = String(box?.browserPromptTemplateKey || box?.templateId || '').trim();
  if ((!templateKey || templateKey === 'photo_retouch') && savedKey) {
    templateKey = savedKey;
  }

  // 1. If explicit custom prompt is selected
  if (templateKey === 'custom_prompt') {
    rawPrompt = box?.browserCustomPrompt || box?.customPrompt || getPersistedCustomPrompt();
  }

  // 2. Look up the chosen template key in the user's prompt library (localStorage)
  if (!rawPrompt && templateKey) {
    try {
      const libraryTemplates = loadAvailablePromptTemplates();
      const matched = libraryTemplates.find(
        (t) =>
          String(t.id).trim().toLowerCase() === templateKey.toLowerCase() ||
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
        String(p.id).trim().toLowerCase() === templateKey.toLowerCase() ||
        p.name.trim().toLowerCase() === templateKey.toLowerCase()
    );
    if (std && std.instructions) {
      rawPrompt = std.instructions;
    }
  }

  // 4. If template matches persisted key, check persisted text
  if (!rawPrompt && savedText && (templateKey === savedKey || !templateKey)) {
    rawPrompt = savedText;
  }

  // 5. Check explicit stored text fields if not equal to the default dummy placeholder
  if (!rawPrompt && box) {
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

  // 6. If still no prompt, use persisted text if available
  if (!rawPrompt && savedText) {
    rawPrompt = savedText;
  }

  // 7. Ultimate fallback
  if (!rawPrompt || rawPrompt.trim() === '') {
    rawPrompt = STANDARD_BROWSER_PROMPTS[0].instructions;
  }

  // Context variable replacements
  const title = propContext?.title || 'Luxury Modern Property';
  const price = propContext?.price || 'Price on Request';
  const w = propContext?.width || box?.outputWidth || box?.targetWidth || 1080;
  const h = propContext?.height || box?.outputHeight || box?.targetHeight || 1350;

  return rawPrompt
    .replace(/\{title\}/g, title)
    .replace(/\{project_name\}/g, title)
    .replace(/\{price\}/g, price)
    .replace(/\{output_width\}/g, String(w))
    .replace(/\{output_height\}/g, String(h))
    .trim();
};
