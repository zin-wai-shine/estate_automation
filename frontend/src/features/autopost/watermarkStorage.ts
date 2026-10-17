export type WatermarkPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type WatermarkType = 'logo' | 'text';
export type WatermarkScope = 'all' | 'body-only' | 'body-and-footer';

export interface WatermarkConfig {
  enabled: boolean;
  type: WatermarkType;
  logoUrl: string;
  logoName: string;
  text: string;
  textColor: string;
  fontSize: number; // 16 to 48
  fontWeight: string; // '500' | '600' | '700'
  opacity: number; // 10 to 100
  scale: number; // 10 to 45 (% of image width)
  position: WatermarkPosition;
  margin: number; // 2 to 12 (% padding from edge)
  hasShadow: boolean;
  smartScope: WatermarkScope;
}

export interface WatermarkPreset {
  id: string;
  name: string;
  isDefault?: boolean;
  config: WatermarkConfig;
}

// Built-in Luxury Real Estate SVG Badges (crisp vector data URLs)
export const SAMPLE_BADGES = {
  goldShield: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120" width="320" height="120">
      <defs>
        <linearGradient id="gGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FDE047" />
          <stop offset="50%" stop-color="#EAB308" />
          <stop offset="100%" stop-color="#CA8A04" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="312" height="112" rx="16" fill="rgba(15, 23, 42, 0.85)" stroke="url(#gGold)" stroke-width="2.5" />
      <path d="M 38 68 L 56 46 L 74 68 Z M 48 68 L 48 76 L 64 76 L 64 68 Z" fill="url(#gGold)" />
      <circle cx="56" cy="40" r="3.5" fill="url(#gGold)" />
      <text x="88" y="55" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="19" font-weight="800" letter-spacing="1.5" fill="#FFFFFF">ESTATE BANGKOK</text>
      <text x="88" y="76" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600" letter-spacing="2" fill="url(#gGold)">VERIFIED REAL ESTATE</text>
    </svg>
  `)}`,
  modernMinimal: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 90" width="300" height="90">
      <rect x="3" y="3" width="294" height="84" rx="12" fill="rgba(10, 15, 29, 0.82)" stroke="rgba(255, 255, 255, 0.2)" stroke-width="1.5" />
      <rect x="22" y="24" width="42" height="42" rx="8" fill="#3B82F6" />
      <path d="M 31 52 L 43 36 L 55 52 Z" fill="#FFFFFF" />
      <text x="76" y="44" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="700" letter-spacing="1" fill="#FFFFFF">PRIME PROPERTIES</text>
      <text x="76" y="62" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10.5" font-weight="500" letter-spacing="1.5" fill="#93C5FD">BANGKOK CONDO EXPERTS</text>
    </svg>
  `)}`,
  luxurySignature: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 80" width="280" height="80">
      <rect x="2" y="2" width="276" height="76" rx="10" fill="rgba(0, 0, 0, 0.85)" stroke="#10B981" stroke-width="2" />
      <circle cx="36" cy="40" r="16" fill="rgba(16, 185, 129, 0.15)" stroke="#10B981" stroke-width="2" />
      <text x="36" y="46" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="16" font-weight="900" fill="#10B981" text-anchor="middle">EA</text>
      <text x="66" y="38" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="14.5" font-weight="700" letter-spacing="1" fill="#FFFFFF">EXCLUSIVE LIVING</text>
      <text x="66" y="55" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="10" font-weight="500" letter-spacing="1.5" fill="#A7F3D0">CONTACT: 081-234-5678</text>
    </svg>
  `)}`,
};

export const DEFAULT_WATERMARK_CONFIG: WatermarkConfig = {
  enabled: true,
  type: 'logo',
  logoUrl: SAMPLE_BADGES.goldShield,
  logoName: 'Gold Estate Shield Badge',
  text: '{project} · Tel: 081-234-5678',
  textColor: '#FFFFFF',
  fontSize: 26,
  fontWeight: '600',
  opacity: 85,
  scale: 24,
  position: 'bottom-right',
  margin: 4,
  hasShadow: true,
  smartScope: 'body-only',
};

export const DEFAULT_PRESETS: WatermarkPreset[] = [
  {
    id: 'preset-gold-shield',
    name: 'Gold Estate Badge (Bottom Right)',
    isDefault: true,
    config: {
      ...DEFAULT_WATERMARK_CONFIG,
      logoUrl: SAMPLE_BADGES.goldShield,
      logoName: 'Gold Estate Shield',
      position: 'bottom-right',
      scale: 24,
      opacity: 88,
      smartScope: 'body-only',
    },
  },
  {
    id: 'preset-prime-blue',
    name: 'Prime Blue Badge (Bottom Left)',
    isDefault: false,
    config: {
      ...DEFAULT_WATERMARK_CONFIG,
      logoUrl: SAMPLE_BADGES.modernMinimal,
      logoName: 'Prime Modern Badge',
      position: 'bottom-left',
      scale: 22,
      opacity: 85,
      smartScope: 'body-only',
    },
  },
  {
    id: 'preset-contact-text',
    name: 'Dynamic Text Stamp (Bottom Center)',
    isDefault: false,
    config: {
      ...DEFAULT_WATERMARK_CONFIG,
      type: 'text',
      text: '{project} · Line ID: @estatebangkok',
      textColor: '#FFFFFF',
      fontSize: 24,
      fontWeight: '700',
      position: 'bottom-center',
      opacity: 90,
      margin: 4,
      hasShadow: true,
      smartScope: 'all',
    },
  },
  {
    id: 'preset-center-subtle',
    name: 'Subtle Center Protection',
    isDefault: false,
    config: {
      ...DEFAULT_WATERMARK_CONFIG,
      type: 'logo',
      logoUrl: SAMPLE_BADGES.luxurySignature,
      logoName: 'Exclusive Living Badge',
      position: 'center',
      scale: 32,
      opacity: 35,
      smartScope: 'body-only',
    },
  },
];

const STORAGE_KEY_PRESETS = 'ea_watermark_presets_v2';
const STORAGE_KEY_ACTIVE_PRESET_ID = 'ea_watermark_active_preset_id_v2';
const STORAGE_KEY_CURRENT_CONFIG = 'ea_watermark_current_config_v2';

export const loadWatermarkPresets = (): WatermarkPreset[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRESETS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to load watermark presets from localStorage:', err);
  }
  return DEFAULT_PRESETS;
};

export const saveWatermarkPresets = (presets: WatermarkPreset[]) => {
  try {
    localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(presets));
  } catch (err) {
    console.warn('Failed to save watermark presets to localStorage:', err);
  }
};

export const loadActiveWatermarkConfig = (): { config: WatermarkConfig; activePresetId: string } => {
  const presets = loadWatermarkPresets();
  let activePresetId = DEFAULT_PRESETS[0].id;
  try {
    const savedId = localStorage.getItem(STORAGE_KEY_ACTIVE_PRESET_ID);
    if (savedId && presets.some((p) => p.id === savedId)) {
      activePresetId = savedId;
    }
    const rawConfig = localStorage.getItem(STORAGE_KEY_CURRENT_CONFIG);
    if (rawConfig) {
      const parsedConfig = JSON.parse(rawConfig);
      return { config: { ...DEFAULT_WATERMARK_CONFIG, ...parsedConfig }, activePresetId };
    }
  } catch (err) {
    console.warn('Failed to load active watermark config:', err);
  }

  const preset = presets.find((p) => p.id === activePresetId) || presets[0] || DEFAULT_PRESETS[0];
  return { config: preset.config, activePresetId: preset.id };
};

export const saveActiveWatermarkConfig = (config: WatermarkConfig, activePresetId?: string) => {
  try {
    localStorage.setItem(STORAGE_KEY_CURRENT_CONFIG, JSON.stringify(config));
    if (activePresetId) {
      localStorage.setItem(STORAGE_KEY_ACTIVE_PRESET_ID, activePresetId);
    }
  } catch (err) {
    console.warn('Failed to save active watermark config:', err);
  }
};
