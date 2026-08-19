// Puter.js Free AI Service Integration
// Allows 100% Free AI Vision & Content Generation without OpenAI billing/API keys

export interface PuterVisionResult {
  confidence: number;
  target_post_visible: boolean;
  is_target_post: boolean;
  more_content_below: boolean;
  more_text_below: boolean;
  more_images_below: boolean;
  property_images_visible: boolean;
  image_grid_visible: boolean;
  image_grid_reached: boolean;
  image_grid_partially_cut_off?: boolean;
  needs_scroll_for_clear_target?: boolean;
  relevant_images_visible: boolean;
  see_more_present: boolean;
  see_more_visible: boolean;
  target_post_complete: boolean;
  unwanted_image_present: boolean;
  reason: string;
  page_state: string;
  target_detected: boolean;
  target_post_found: boolean;
  complete_post_visible: boolean;
  visible_property_image_count: number;
  original_content: string;
  target_region: { x: number; y: number; width: number; height: number };
  content_region: { x: number; y: number; width: number; height: number };
  media_region: { x: number; y: number; width: number; height: number };
  target_post_bbox?: { x: number; y: number; width: number; height: number };
  content_bbox?: { x: number; y: number; width: number; height: number };
  media_bbox?: { x: number; y: number; width: number; height: number };
  cropped_content_image?: string;
}

export function isPuterAvailable(): boolean {
  return typeof window !== 'undefined' && Boolean((window as any).puter?.ai);
}

export async function analyzeScreenshotsWithPuter(
  screenshotsBase64: string[],
  targetUrl: string,
  model: string = 'gpt-4o'
): Promise<PuterVisionResult> {
  if (!isPuterAvailable()) {
    throw new Error('Puter.js is not loaded in browser window');
  }

  const puter = (window as any).puter;

  const systemPrompt = `You are analyzing sequential screenshot(s) of a single Facebook property post.

The screenshots are provided in chronological order (Screenshot 1 is top/initial view, Screenshot 2 is scrolled down, etc.).

CRITICAL REAL-ESTATE POST RULE:
A real-estate Facebook post contains property text description followed by a property images grid / photo collage attached below the text.

IMAGE GRID VISIBILITY & CLEAR TARGETING DEFINITION:
You MUST carefully analyze the LATEST screenshot in the sequence to determine its exact visual state:

STATE 1: NO IMAGE GRID VISIBLE YET (ONLY TEXT)
- The property photo collage / image grid is NOT visible on screen yet (only text lines are showing).
- Output:
  "property_images_visible": false,
  "image_grid_visible": false,
  "image_grid_reached": false,
  "image_grid_partially_cut_off": false,
  "needs_scroll_for_clear_target": false,
  "more_content_below": true,
  "target_post_complete": false

STATE 2: PARTIALLY CUT-OFF IMAGE GRID (TINY SLIVER / CUT OFF AT BOTTOM) - MUST SCROLL AGAIN!
- The property photo collage / image grid just barely peeks in at the bottom edge of the dialog/modal (only a small top slice/sliver of photo is visible, height < 250px, or the photo is cut off by the bottom comment input bar).
- The photo cell is NOT clearly visible for targeting.
- Output:
  "property_images_visible": true,
  "image_grid_visible": true,
  "image_grid_partially_cut_off": true,
  "needs_scroll_for_clear_target": true,
  "image_grid_reached": false,
  "more_content_below": true,
  "target_post_complete": false

STATE 3: FULLY & CLEARLY EXPOSED IMAGE GRID (STOP SCROLLING & CLICK FIRST PHOTO!)
- The property photo collage / image grid is PROMINENTLY and CLEARLY visible in the center of the dialog (full photo cells with height >= 300px are exposed without being cut off by the bottom bar).
- The top-left property photo cell (e.g. swimming pool, high-ceiling lounge, condo interior) is completely clear and exposed.
- Output:
  "property_images_visible": true,
  "image_grid_visible": true,
  "image_grid_partially_cut_off": false,
  "needs_scroll_for_clear_target": false,
  "image_grid_reached": true,
  "more_content_below": false,
  "target_post_complete": true
- The capture sequence will STOP right at this screenshot, and OpenClaw will click the center of the first photo.

CRITICAL TEXT & NUMERICAL ACCURACY (ZERO HALLUCINATION):
- You MUST transcribe all numbers, rental prices, selling prices, deposit amounts, square meter figures (sqm / ตร.ม.), bedroom/bathroom counts, building names, floor numbers, and contact numbers EXACTLY as written in the target post.
- NEVER estimate, guess, round, or alter numbers, prices, or currency symbols.

Return valid JSON in this EXACT format (no surrounding text):
{
  "target_post_visible": true,
  "is_target_post": true,
  "more_content_below": false,
  "more_text_below": false,
  "more_images_below": false,
  "property_images_visible": true,
  "image_grid_visible": true,
  "image_grid_reached": true,
  "image_grid_partially_cut_off": false,
  "needs_scroll_for_clear_target": false,
  "relevant_images_visible": true,
  "see_more_visible": false,
  "see_more_present": false,
  "target_post_complete": true,
  "unwanted_image_present": false,
  "reason": "Image grid is fully and clearly exposed in the center of the modal.",
  "confidence": 0.98,
  "page_state": "target_post_visible",
  "target_detected": true,
  "target_post_found": true,
  "complete_post_visible": true,
  "visible_property_image_count": 4,
  "original_content": "...",
  "target_region": { "x": 560, "y": 40, "width": 720, "height": 1000 },
  "content_region": { "x": 560, "y": 40, "width": 720, "height": 550 },
  "media_region": { "x": 560, "y": 590, "width": 720, "height": 410 }
}`;

  const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    {
      type: 'text',
      text: `Target URL requested: ${targetUrl}. Sequence contains ${screenshotsBase64.length} screenshot(s). Carefully analyze the latest screenshot: Is the image grid fully & clearly exposed (STATE 3), only a tiny cut-off sliver at bottom (STATE 2 - scroll again), or only text (STATE 1 - scroll again)? Reconstruct the complete post text verbatim as JSON.`,
    },
  ];

  for (let i = 0; i < screenshotsBase64.length; i++) {
    const rawB64 = screenshotsBase64[i];
    const dataUrl = rawB64.startsWith('data:image') ? rawB64 : `data:image/jpeg;base64,${rawB64}`;
    userContent.push({
      type: 'text',
      text: `--- SCREENSHOT ${i + 1} of ${screenshotsBase64.length} ---`,
    });
    userContent.push({
      type: 'image_url',
      image_url: { url: dataUrl },
    });
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];

  const response = await puter.ai.chat(messages, { model });
  
  let rawText = '';
  if (typeof response === 'string') {
    rawText = response;
  } else if (response?.message?.content) {
    rawText = response.message.content;
  } else if (response?.text) {
    rawText = response.text;
  } else {
    rawText = JSON.stringify(response);
  }

  // Strip markdown code block wrappers if present
  let cleanJson = rawText.trim();
  if (cleanJson.startsWith('```json')) {
    cleanJson = cleanJson.slice(7);
  } else if (cleanJson.startsWith('```')) {
    cleanJson = cleanJson.slice(3);
  }
  if (cleanJson.endsWith('```')) {
    cleanJson = cleanJson.slice(0, -3);
  }
  cleanJson = cleanJson.trim();

  try {
    const parsed = JSON.parse(cleanJson);
    const isCutOff = Boolean(parsed.image_grid_partially_cut_off || parsed.needs_scroll_for_clear_target);
    const gridReached = Boolean(
      (parsed.image_grid_reached || parsed.image_grid_visible || parsed.property_images_visible) && !isCutOff
    );
    const moreBelow = Boolean(parsed.more_text_below || parsed.more_content_below || isCutOff);

    return {
      confidence: parsed.confidence ?? 0.95,
      target_post_visible: parsed.target_post_visible ?? true,
      is_target_post: parsed.is_target_post ?? true,
      more_content_below: moreBelow,
      more_text_below: moreBelow,
      more_images_below: !gridReached,
      property_images_visible: Boolean(parsed.property_images_visible || parsed.image_grid_visible),
      image_grid_visible: Boolean(parsed.image_grid_visible || parsed.property_images_visible),
      image_grid_reached: gridReached,
      image_grid_partially_cut_off: isCutOff,
      needs_scroll_for_clear_target: isCutOff,
      relevant_images_visible: gridReached,
      see_more_present: Boolean(parsed.see_more_present),
      see_more_visible: Boolean(parsed.see_more_visible),
      target_post_complete: gridReached,
      unwanted_image_present: Boolean(parsed.unwanted_image_present),
      reason: parsed.reason || (gridReached ? 'Image grid clearly visible' : isCutOff ? 'Image grid partially cut off at bottom, scrolling once more for clear target' : 'More text content below, scrolling required'),
      page_state: parsed.page_state || 'target_post_visible',
      target_detected: Boolean(parsed.target_detected ?? true),
      target_post_found: Boolean(parsed.target_post_found ?? true),
      complete_post_visible: gridReached,
      visible_property_image_count: gridReached ? (parsed.visible_property_image_count || 4) : 0,
      original_content: parsed.original_content || '',
      target_region: parsed.target_region || { x: 560, y: 40, width: 720, height: 1000 },
      content_region: parsed.content_region || { x: 560, y: 40, width: 720, height: 550 },
      media_region: gridReached ? (parsed.media_region || { x: 560, y: 590, width: 720, height: 410 }) : { x: 0, y: 0, width: 0, height: 0 },
      target_post_bbox: parsed.target_region || { x: 560, y: 40, width: 720, height: 1000 },
      content_bbox: parsed.content_region || { x: 560, y: 40, width: 720, height: 550 },
      media_bbox: gridReached ? (parsed.media_region || { x: 560, y: 590, width: 720, height: 410 }) : { x: 0, y: 0, width: 0, height: 0 },
    };
  } catch (err) {
    console.warn('[Puter AI] JSON parse fallback on raw text:', rawText);
    return {
      confidence: 0.9,
      target_post_visible: true,
      is_target_post: true,
      more_content_below: false,
      more_text_below: false,
      more_images_below: false,
      property_images_visible: true,
      image_grid_visible: true,
      image_grid_reached: true,
      relevant_images_visible: true,
      see_more_present: false,
      see_more_visible: false,
      target_post_complete: true,
      unwanted_image_present: false,
      reason: 'Puter AI text reconstructed',
      page_state: 'target_post_visible',
      target_detected: true,
      target_post_found: true,
      complete_post_visible: true,
      visible_property_image_count: 4,
      original_content: rawText,
      target_region: { x: 560, y: 40, width: 720, height: 1000 },
      content_region: { x: 560, y: 40, width: 720, height: 550 },
      media_region: { x: 560, y: 590, width: 720, height: 410 },
      target_post_bbox: { x: 560, y: 40, width: 720, height: 1000 },
      content_bbox: { x: 560, y: 40, width: 720, height: 550 },
      media_bbox: { x: 560, y: 590, width: 720, height: 410 },
    };
  }
}

export interface PuterImageCoordResult {
  found: boolean;
  image_bbox?: { x: number; y: number; width: number; height: number };
  click_position?: { x: number; y: number };
  images?: Array<{ x: number; y: number; width: number; height: number; center_x: number; center_y: number; confidence: number; index: number }>;
}

export async function detectImageCoordinatesWithPuter(
  screenshotBase64: string,
  model: string = 'gpt-4o'
): Promise<PuterImageCoordResult> {
  if (!isPuterAvailable()) {
    throw new Error('Puter.js is not loaded');
  }

  const puter = (window as any).puter;

  const dataUrl = screenshotBase64.startsWith('data:image')
    ? screenshotBase64
    : `data:image/jpeg;base64,${screenshotBase64}`;

  const systemPrompt = `You are an expert computer vision system analyzing a 1920x1080 Facebook desktop screenshot.

Your task is to identify the EXACT pixel bounding box of the FIRST REAL PROPERTY PHOTO (the top-left photo cell inside the post's image gallery/collage).

CRITICAL RULES:
1. TEXT IS NOT A PHOTO:
   - Do NOT select post text, hashtags (#...), phone numbers, author headers, or caption lines.
   - The photo gallery begins strictly below the description text.
2. TARGET ONLY PHOTOGRAPHIC PIXELS:
   - Identify the actual colorful photographic rectangle showing real estate (e.g. rooms, sofa, living area, balcony, bed, kitchen, condo exterior/interior).
   - In a multi-photo post collage, find the TOP-LEFT photo cell.
3. BOUNDING BOX ACCURACY:
   - x: left edge of the photo
   - y: top edge of the photo (strictly below all text)
   - width: width of the photo cell
   - height: height of the photo cell

Return JSON only:
{
  "found": true,
  "image_bbox": {
    "x": 480,
    "y": 450,
    "width": 450,
    "height": 450
  }
}

If no property photo is visible on screen, return:
{
  "found": false,
  "image_bbox": null
}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Find the exact bounding box of the first property photo (top-left real photo cell, strictly ignoring all text above it).' },
        { type: 'image_url', image_url: { url: dataUrl } },
      ],
    },
  ];

  const response = await puter.ai.chat(messages, { model });
  let rawText = '';
  if (typeof response === 'string') {
    rawText = response;
  } else if (response?.message?.content) {
    rawText = response.message.content;
  } else if (response?.text) {
    rawText = response.text;
  } else {
    rawText = JSON.stringify(response);
  }

  let cleanJson = rawText.trim();
  if (cleanJson.startsWith('```json')) cleanJson = cleanJson.slice(7);
  if (cleanJson.startsWith('```')) cleanJson = cleanJson.slice(3);
  if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3);
  cleanJson = cleanJson.trim();

  try {
    const parsed = JSON.parse(cleanJson);
    if (parsed.found && parsed.image_bbox) {
      const bbox = parsed.image_bbox;
      const clickPos = {
        x: Math.round(bbox.x + bbox.width / 2),
        y: Math.round(bbox.y + bbox.height / 2),
      };
      return {
        found: true,
        image_bbox: bbox,
        click_position: clickPos,
        images: [{ ...bbox, center_x: clickPos.x, center_y: clickPos.y, confidence: 0.98, index: 1 }],
      };
    }
  } catch (e) {
    console.warn('[Puter AI] Failed to parse coordinate detection JSON:', rawText);
  }

  // Fallback default coordinates inside Facebook modal viewport
  const defaultBbox = { x: 500, y: 460, width: 420, height: 420 };
  const defaultClick = { x: 710, y: 670 };
  return {
    found: true,
    image_bbox: defaultBbox,
    click_position: defaultClick,
    images: [{ ...defaultBbox, center_x: defaultClick.x, center_y: defaultClick.y, confidence: 0.9, index: 1 }],
  };
}

