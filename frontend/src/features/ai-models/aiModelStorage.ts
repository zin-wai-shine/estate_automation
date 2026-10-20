/**
 * AI Model Credentials & Generation History Storage
 */

export interface AIHistoryEntry {
  id: string;
  timestamp: number;
  provider: 'google_ai' | 'runware_ai' | 'openai' | 'laozhang_ai' | string;
  model: string;
  taskType: 'text' | 'image' | 'upscale' | 'format';
  prompt: string;
  inputPreview?: string;
  outputPreview: string;
  outputUrl?: string;
  status: 'success' | 'failed';
  durationMs?: number;
  sourceWorkflow?: string;
}

export interface AIProviderConfig {
  id: string;
  name: string;
  provider: 'runware_ai' | 'google_ai' | 'openai' | 'laozhang_ai' | 'custom';
  apiKey: string;
  status: 'active' | 'warning' | 'error' | 'unconfigured';
  statusMessage?: string;
  balance?: string;
  keyName?: string;
  isPrimary?: boolean;
}

const STORAGE_KEY_AI_HISTORY = 'estate_ai_generation_history_v1';
const STORAGE_KEY_AI_PROVIDERS = 'estate_ai_provider_keys_v1';

export const INITIAL_AI_PROVIDERS: AIProviderConfig[] = [
  {
    id: 'prov-runware',
    name: 'Runware AI',
    provider: 'runware_ai',
    apiKey: '',
    keyName: 'Format Masion',
    status: 'active',
    statusMessage: 'Authenticated & Ready (Ultra-fast Image Generation & Retouching)',
    balance: '$19.81',
    isPrimary: true,
  },
  {
    id: 'prov-google',
    name: 'Google AI (Gemini)',
    provider: 'google_ai',
    apiKey: '',
    keyName: 'Primary Gemini API',
    status: 'active',
    statusMessage: 'Connected & Verified (Fast dual-language copywriting & reasoning)',
    balance: 'Active Quota',
    isPrimary: true,
  },
  {
    id: 'prov-openai',
    name: 'OpenAI (ChatGPT)',
    provider: 'openai',
    apiKey: '',
    keyName: 'OpenAI Dev Key',
    status: 'warning',
    statusMessage: 'Out of credits: Add billing credits at platform.openai.com/billing',
    balance: '$0.00',
    isPrimary: false,
  },
  {
    id: 'prov-laozhang',
    name: 'LaoZhang AI Relay',
    provider: 'laozhang_ai',
    apiKey: '',
    keyName: 'LaoZhang Relay API',
    status: 'warning',
    statusMessage: 'Insufficient quota (用户配额不足)',
    balance: '0 Quota',
    isPrimary: false,
  },
];

const INITIAL_HISTORY_SEED: AIHistoryEntry[] = [
  {
    id: 'hist-1',
    timestamp: Date.now() - 1000 * 60 * 12,
    provider: 'google_ai',
    model: 'gemini-flash-latest',
    taskType: 'text',
    prompt: 'Convert the raw property data below into a professional Facebook rental post for Myanmar customers in Bangkok.',
    inputPreview: 'Regent Home Bangna, 25th Floor, 28 Sq.m. 1 Bedroom, 11,000 THB, near BTS Bangna',
    outputPreview: '11,000 THB နဲ့ BTS Bangna ဘူတာအနီး Regent Home Bangna မှာ 25th Floor က 28 Sq.m. ကျယ်ဝန်းတဲ့ 1 Bedroom အခန်းသန့်လေး ငှားဖို့ရှိပါတယ်ရှင့်။\n\nRegent Home Bangna | 1 Bedroom | 28 Sq.m. | 25th Floor, Building D | 11,000 THB\n\n𝗣𝗿𝗼𝗽𝗲𝗿𝘁𝘆 𝗢𝘃𝗲𝗿𝘃𝗶𝗲𝘄\n• 1 Bedroom | 1 Bathroom\n• Size: 28 Sq.m.\n• Building D | 25th Floor\n• Fully Furnished & Ready to Move In\n\n🔴 𝗦𝗲𝗿𝘃𝗶𝗰𝗲 𝗙𝗲𝗲 လုံးဝမရှိပါဘူးရှင့် 🔴\n\n#RegentHomeBangna #BangnaCondo #RentCondoBangkok',
    status: 'success',
    durationMs: 780,
    sourceWorkflow: 'Workflow #1',
  },
  {
    id: 'hist-2',
    timestamp: Date.now() - 1000 * 60 * 35,
    provider: 'runware_ai',
    model: 'runware:101@1',
    taskType: 'image',
    prompt: 'Real estate interior luxury enhancement, clean architectural lighting, 8k resolution detail',
    inputPreview: 'Living Room HD Photo (1920x1080)',
    outputPreview: 'Enhanced high-dynamic-range photo with balanced ambient lighting and noise reduction.',
    outputUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
    status: 'success',
    durationMs: 1120,
    sourceWorkflow: 'Workflow #1',
  },
  {
    id: 'hist-3',
    timestamp: Date.now() - 1000 * 60 * 60 * 2,
    provider: 'google_ai',
    model: 'gemini-1.5-pro',
    taskType: 'text',
    prompt: 'Thai & English dual rental listing pitch with urgent CTA',
    inputPreview: 'Ashton Asoke, 35 sqm 1-bed, 35k THB/mo, near BTS Asok',
    outputPreview: 'Ashton Asoke - Ultra Luxury 1-Bedroom for Rent!\n35 Sq.m. on high floor with panoramic skyline views.\nOnly 35,000 THB/month. Steps from BTS Asok & MRT Sukhumvit.',
    status: 'success',
    durationMs: 1450,
    sourceWorkflow: 'Condo Rental Preset',
  },
];

export const getAIHistory = (): AIHistoryEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AI_HISTORY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_AI_HISTORY, JSON.stringify(INITIAL_HISTORY_SEED));
      return INITIAL_HISTORY_SEED;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to load AI history:', err);
    return INITIAL_HISTORY_SEED;
  }
};

export const addAIHistoryEntry = (
  entry: Omit<AIHistoryEntry, 'id' | 'timestamp'>
): AIHistoryEntry => {
  const current = getAIHistory();
  const newEntry: AIHistoryEntry = {
    ...entry,
    id: `hist-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: Date.now(),
  };
  const updated = [newEntry, ...current].slice(0, 100);
  try {
    localStorage.setItem(STORAGE_KEY_AI_HISTORY, JSON.stringify(updated));
    window.dispatchEvent(new Event('estate_ai_history_updated'));
  } catch (err) {
    console.warn('Failed to save AI history:', err);
  }
  return newEntry;
};

export const deleteAIHistoryEntry = (id: string): void => {
  const current = getAIHistory();
  const updated = current.filter((item) => item.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY_AI_HISTORY, JSON.stringify(updated));
    window.dispatchEvent(new Event('estate_ai_history_updated'));
  } catch (err) {
    console.warn('Failed to delete history item:', err);
  }
};

export const clearAIHistory = (): void => {
  try {
    localStorage.setItem(STORAGE_KEY_AI_HISTORY, JSON.stringify([]));
    window.dispatchEvent(new Event('estate_ai_history_updated'));
  } catch (err) {
    console.warn('Failed to clear AI history:', err);
  }
};

export const getAIProviders = (): AIProviderConfig[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AI_PROVIDERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_AI_PROVIDERS, JSON.stringify(INITIAL_AI_PROVIDERS));
      return INITIAL_AI_PROVIDERS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_AI_PROVIDERS;
  } catch (err) {
    console.warn('Failed to load AI providers:', err);
    return INITIAL_AI_PROVIDERS;
  }
};

export const saveAIProvider = (provider: AIProviderConfig): void => {
  const current = getAIProviders();
  const existingIdx = current.findIndex((p) => p.id === provider.id || p.provider === provider.provider);
  let updated: AIProviderConfig[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = { ...updated[existingIdx], ...provider };
  } else {
    updated = [...current, provider];
  }
  try {
    localStorage.setItem(STORAGE_KEY_AI_PROVIDERS, JSON.stringify(updated));
    window.dispatchEvent(new Event('estate_ai_providers_updated'));
  } catch (err) {
    console.warn('Failed to save AI provider:', err);
  }
};
