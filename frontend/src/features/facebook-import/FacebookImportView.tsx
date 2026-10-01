import React, { useState, useEffect, useRef } from 'react';
import type { Property } from '../../types';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import {
  FiDownload,
  FiExternalLink,
  FiCopy,
  FiCheck,
  FiAlertCircle,
  FiRefreshCw,
  FiMonitor,
  FiChevronDown,
  FiChevronUp,
  FiTrash2,
  FiSave,
  FiUploadCloud,
  FiImage,
  FiSliders,
  FiCode,
  FiEye,
  FiInfo,
  FiX,
  FiZap,
  FiEdit3,
} from 'react-icons/fi';
import { FaFacebook } from 'react-icons/fa';
import { SiGooglegemini } from 'react-icons/si';
import type { PromptTemplate } from '../../types';
import { CustomDropdown } from '../../components/ui/CustomDropdown';

const DEFAULT_PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 1,
    name: 'Facebook Rental Listing Copy (Thai/English)',
    category: 'FACEBOOK_RENT',
    version: 'V1.2',
    active: true,
    templateText:
      'Generate an attractive Facebook real estate rental post for a condo in Bangkok.\nTitle: {title}\nPrice: {price}\nLocation: {location}\nInclude high-converting CTA and relevant hashtags.',
  },
  {
    id: 2,
    name: 'TikTok Short Video Script & Hook Generator',
    category: 'TIKTOK',
    version: 'V1.0',
    active: true,
    templateText:
      'Create a viral 15-second TikTok video script for property listing {title}.\nStart with a high-curiosity hook, list 3 key highlights, and end with Line ID CTA.',
  },
  {
    id: 3,
    name: 'Facebook Property Sale Copy Template',
    category: 'FACEBOOK_SALE',
    version: 'V1.0',
    active: true,
    templateText:
      'Write a professional sales copy for property sale: {title}.\nHighlight investment yield, BTS access, and price {price}.',
  },
];

const OpenAIIcon: React.FC<{ size?: number; color?: string }> = ({ size = 15, color = '#10A37F' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ color, flexShrink: 0 }}>
    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.259 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7466-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.5045 4.5045 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.8956zm16.0993 3.8558L12.5973 8.3829l2.02-1.1638a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.402-.686zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.407 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813v6.7227zm1.1408-2.8252l2.5526-1.4727 2.5526 1.4727v2.9454l-2.5526 1.4727-2.5526-1.4727z" />
  </svg>
);

interface FacebookImportViewProps {
  onSaveToInbox?: (property: Partial<Property>) => void;
  onNavigateTab?: (tab: string) => void;
}

interface ExtractedImage {
  index: number;
  facebook_photo_id?: string;
  source_url: string;
  stored_url: string;
  width: number;
  height: number;
  status: string;
}

interface SourceDetails {
  platform: string;
  original_url: string;
  canonical_url: string;
  source_type: string;
  source_name: string;
  post_id: string;
  created_time: string;
  extraction_method: string;
}

interface PropertyData {
  project_name: string;
  listing_type: string;
  price: string;
  currency: string;
  bedrooms: string;
  bathrooms: string;
  size_sqm: string;
  floor: string;
  building: string;
  unit_number: string;
  furnished: string;
  nearest_transit: string;
  location: string;
  move_in_status: string;
  contact_name: string;
  contact_phone: string;
  contact_line: string;
}

interface ActivityLog {
  timestamp: string;
  message: string;
  level: 'info' | 'warn' | 'error' | 'success';
}

const PIPELINE_STEPS = [
  { id: 'url_received', label: 'URL Received' },
  { id: 'resolving', label: 'Resolving' },
  { id: 'opening_browser', label: 'Opening Facebook' },
  { id: 'target_found', label: 'Target Post Found' },
  { id: 'caption_extracted', label: 'Caption Extracted' },
  { id: 'photos_detected', label: 'Photos Detected' },
  { id: 'verifying_photos', label: 'Verifying Photos' },
  { id: 'downloading_media', label: 'Downloading Media' },
  { id: 'ai_analysis', label: 'AI Analysis' },
  { id: 'complete', label: 'Complete' },
];

export const FacebookImportView: React.FC<FacebookImportViewProps> = ({
  onSaveToInbox,
  onNavigateTab,
}) => {
  // Input & Modes
  const [url, setUrl] = useState('');
  const [autoImport, setAutoImport] = useState(true);
  const [preferredMethod, setPreferredMethod] = useState<'auto' | 'meta_graph_api' | 'openclaw_browser'>('auto');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showRawJsonModal, setShowRawJsonModal] = useState(false);
  const [showLiveBrowserModal, setShowLiveBrowserModal] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Status & Pipeline
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [pipelineErrorCode, setPipelineErrorCode] = useState<string | null>(null);
  const [browserState, setBrowserState] = useState<string>('Browser Ready');
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  // Extraction Result State
  const [source, setSource] = useState<SourceDetails | null>(null);
  const [caption, setCaption] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [images, setImages] = useState<ExtractedImage[]>([]);
  const [propertyData, setPropertyData] = useState<PropertyData>({
    project_name: '',
    listing_type: 'RENT',
    price: '',
    currency: 'THB',
    bedrooms: '',
    bathrooms: '',
    size_sqm: '',
    floor: '',
    building: '',
    unit_number: '',
    furnished: '',
    nearest_transit: '',
    location: '',
    move_in_status: '',
    contact_name: '',
    contact_phone: '',
    contact_line: '',
  });

  // UI helpers
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedImageIndex, setCopiedImageIndex] = useState<number | null>(null);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Assistant & Prompt Templates (Google AI Studio & OpenAI)
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>(DEFAULT_PROMPT_TEMPLATES);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('1');
  const [aiProvider, setAiProvider] = useState<'google_ai' | 'openai'>('google_ai');
  const [generatedProvider, setGeneratedProvider] = useState<'google_ai' | 'openai' | null>(null);
  const [customPromptTweak, setCustomPromptTweak] = useState<string>('');
  const [showPromptTweak, setShowPromptTweak] = useState<boolean>(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [aiGeneratedCopy, setAiGeneratedCopy] = useState<string>('');
  const [copiedAiCopy, setCopiedAiCopy] = useState<boolean>(false);
  const [isEditingAiCopy, setIsEditingAiCopy] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Load saved prompt templates from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('estate_prompt_templates');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPromptTemplates(parsed);
          const firstActive = parsed.find((p: any) => p.active) || parsed[0];
          if (firstActive) setSelectedTemplateId(String(firstActive.id));
          return;
        }
      }
    } catch {}
    setPromptTemplates(DEFAULT_PROMPT_TEMPLATES);
    setSelectedTemplateId(String(DEFAULT_PROMPT_TEMPLATES[0].id));
  }, []);

  const handleGenerateAICopy = async () => {
    if (!caption.trim()) {
      addLog('Cannot generate AI copy: caption is empty', 'warn');
      return;
    }

    const template = promptTemplates.find((t) => String(t.id) === String(selectedTemplateId));
    setIsGeneratingAI(true);
    setAiError(null);
    const providerName = aiProvider === 'openai' ? 'OpenAI (GPT-4o)' : 'Google AI (Gemini)';
    addLog(`Calling ${providerName} with template "${template?.name || 'Selected'}"...`, 'info');

    try {
      const resp = await fetch('http://localhost:8085/api/facebook-import/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: aiProvider,
          template_id: template ? String(template.id) : '',
          template_name: template?.name || 'Facebook Template',
          template_text: template?.templateText || '',
          raw_content: caption,
          custom_prompt: customPromptTweak,
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || `Failed to generate listing copy with ${providerName}`);
      }

      setAiGeneratedCopy(data.generated_content);
      setGeneratedProvider(aiProvider);
      addLog(`✨ ${providerName} generated listing copy successfully!`, 'success');
    } catch (err: any) {
      const msg = err.message || `Error communicating with ${providerName}`;
      setAiError(msg);
      addLog(`AI generation failed: ${msg}`, 'error');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleCopyAiCopy = () => {
    if (!aiGeneratedCopy) return;
    navigator.clipboard.writeText(aiGeneratedCopy);
    setCopiedAiCopy(true);
    setTimeout(() => setCopiedAiCopy(false), 2000);
  };

  // Live Browser Preview
  const [liveScreenshot, setLiveScreenshot] = useState<string | null>(null);
  const livePreviewInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const startLivePreview = () => {
    setLiveScreenshot(null);
    if (livePreviewInterval.current) clearInterval(livePreviewInterval.current);
    livePreviewInterval.current = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:9223/live-screenshot');
        if (res.ok) {
          const data = await res.json();
          if (data.screenshot) setLiveScreenshot(data.screenshot);
        }
      } catch { /* browser worker may not be ready yet */ }
    }, 1500);
  };

  const stopLivePreview = () => {
    if (livePreviewInterval.current) {
      clearInterval(livePreviewInterval.current);
      livePreviewInterval.current = null;
    }
  };

  useEffect(() => () => stopLivePreview(), []);

  // Check initial browser status
  useEffect(() => {
    checkBrowserStatus();
    const interval = setInterval(checkBrowserStatus, 6000);
    return () => clearInterval(interval);
  }, []);

  const checkBrowserStatus = async () => {
    try {
      const resp = await fetch('http://localhost:8085/api/facebook-import/browser/status');
      if (resp.ok) {
        const data = await resp.json();
        if (data.session_state === 'LOGIN_REQUIRED') {
          setBrowserState('Facebook Login Required');
        } else if (data.session_state === 'CONNECTED') {
          setBrowserState('Logged In');
        } else if (data.worker_running) {
          setBrowserState('Browser Ready');
        } else {
          setBrowserState('Disconnected');
        }
      }
    } catch {
      setBrowserState('Disconnected');
    }
  };

  const addLog = (message: string, level: 'info' | 'warn' | 'error' | 'success' = 'info') => {
    const timeStr = new Date().toLocaleTimeString('en-GB');
    setLogs((prev) => [...prev, { timestamp: timeStr, message, level }]);
  };

  const handleStartImport = async () => {
    if (!url.trim()) return;

    setIsProcessing(true);
    setPipelineError(null);
    startLivePreview();
    setPipelineErrorCode(null);
    setManualMode(false);
    setSavedSuccessMsg(false);
    setLogs([]);
    setCurrentStepIndex(0);
    addLog(`URL received: ${url.trim()}`);

    try {
      // Step 1: URL Normalization & Resolution
      setCurrentStepIndex(1);
      addLog('Resolving Facebook share URL...');
      const resResp = await fetch('http://localhost:8085/api/facebook-import/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!resResp.ok) {
        const resErr = await resResp.json();
        throw new Error(resErr.error_message || 'Invalid Facebook URL');
      }

      const resData = await resResp.json();
      addLog(`Facebook URL resolved to: ${resData.canonical_url}`, 'success');
      addLog(`Source detected: ${resData.source_name || resData.source_type}`);

      // Step 2 & 3: Opening Facebook Browser / Calling Meta Graph API
      setCurrentStepIndex(2);
      addLog('Connecting extraction pipeline...');

      const extractResp = await fetch('http://localhost:8085/api/facebook-import/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          preferred_method: preferredMethod,
          max_images: 50,
        }),
      });

      const extractData = await extractResp.json();

      if (!extractResp.ok || !extractData.success) {
        const job = extractData.job;
        const errCode = job?.error_code || 'EXTRACTION_FAILED';
        const errMsg = job?.error_message || extractData.error || 'Failed to extract Facebook post';

        setPipelineErrorCode(errCode);
        setPipelineError(errMsg);
        addLog(`Extraction interrupted: [${errCode}] ${errMsg}`, 'error');

        if (errCode === 'LOGIN_REQUIRED') {
          setBrowserState('Facebook Login Required');
        } else if (errCode === 'ACCESS_RESTRICTED') {
          setBrowserState('Access Restricted');
        }

        setIsProcessing(false);
        return;
      }

      // Step 4: Post Found
      setCurrentStepIndex(3);
      addLog('Target post container isolated & confirmed', 'success');

      const result = extractData.result;
      setSource(result.source);

      // Step 5: Caption Extracted
      setCurrentStepIndex(4);
      setCaption(result.caption.original || '');
      setLanguages(result.caption.language_detected || []);
      addLog(`Post caption extracted (${result.caption.original?.length || 0} characters)`, 'success');

      // Step 6: Photos Detected
      setCurrentStepIndex(5);
      const photoList: ExtractedImage[] = result.images || [];
      addLog(`${photoList.length} photos detected in post container`);

      // Step 7: Verifying Photos
      setCurrentStepIndex(6);
      const verifiedCount = photoList.filter((img) => img.status !== 'rejected').length;
      addLog(`Verifying ${photoList.length} photos against target post context...`);

      // Step 8: Downloading Media
      setCurrentStepIndex(7);
      setImages(photoList);
      const downloadedCount = photoList.filter((img) => img.status === 'downloaded').length;
      addLog(`${verifiedCount} target-verified photos downloaded & stored locally`, 'success');

      // Step 9: AI Analysis
      setCurrentStepIndex(8);
      addLog('AI analyzing property attributes & Thai/Myanmar/English context...');

      if (result.property) {
        setPropertyData({
          project_name: result.property.project_name || '',
          listing_type: result.property.listing_type || 'RENT',
          price: result.property.price ? String(result.property.price) : '',
          currency: result.property.currency || 'THB',
          bedrooms: result.property.bedrooms !== null && result.property.bedrooms !== undefined ? String(result.property.bedrooms) : '',
          bathrooms: result.property.bathrooms !== null && result.property.bathrooms !== undefined ? String(result.property.bathrooms) : '',
          size_sqm: result.property.size_sqm ? String(result.property.size_sqm) : '',
          floor: result.property.floor || '',
          building: result.property.building || '',
          unit_number: result.property.unit_number || '',
          furnished: result.property.furnished || '',
          nearest_transit: result.property.nearest_transit || '',
          location: result.property.location || '',
          move_in_status: result.property.move_in_status || '',
          contact_name: result.contact?.name || '',
          contact_phone: result.contact?.phone || '',
          contact_line: result.contact?.line || '',
        });
      }

      // Step 10: Complete
      setCurrentStepIndex(9);
      addLog('AI analysis complete. Import ready for review!', 'success');
      setBrowserState('Complete');
    } catch (err: any) {
      setPipelineError(err.message || 'An error occurred during extraction');
      addLog(`Failed: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
      stopLivePreview();
    }
  };

  const handleCopyCaption = () => {
    if (!caption) return;
    navigator.clipboard.writeText(caption);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  };

  const handleCopyImage = async (
    target: { index: number; url: string },
    e?: React.MouseEvent
  ) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    const { index, url } = target;

    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
      addLog('Clipboard image copying is not supported on this browser or connection.', 'error');
      return;
    }

    // Function to produce a true image/png Blob
    const producePngBlob = async (): Promise<Blob> => {
      // 1. Try instant extraction from loaded DOM image
      const domImg = document.getElementById(`imported-fb-photo-${index}`) as HTMLImageElement | null;
      if (domImg && domImg.complete && domImg.naturalWidth > 0) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = domImg.naturalWidth;
          canvas.height = domImg.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(domImg, 0, 0);
            const directPng = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
            if (directPng && directPng.size > 0) {
              return directPng;
            }
          }
        } catch (taintErr) {
          console.warn('DOM canvas tainted or blocked, falling back to direct fetch:', taintErr);
        }
      }

      // 2. Fetch via local storage or backend CORS proxy
      let fetchUrl = url;
      if (url.startsWith('/storage') || url.startsWith('/')) {
        fetchUrl = `http://localhost:8085${url}`;
      } else if (!url.startsWith('http://localhost:8085')) {
        fetchUrl = `http://localhost:8085/api/facebook-import/proxy-image?url=${encodeURIComponent(url)}`;
      }

      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rawBlob = await res.blob();

      // If already image/png, return directly
      if (rawBlob.type === 'image/png') {
        return rawBlob;
      }

      // 3. Convert to image/png via createImageBitmap or Image element
      if (typeof createImageBitmap === 'function') {
        try {
          const bmp = await createImageBitmap(rawBlob);
          const canvas = document.createElement('canvas');
          canvas.width = bmp.width;
          canvas.height = bmp.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(bmp, 0, 0);
            const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
            if (png) return png;
          }
        } catch (bmpErr) {
          console.warn('createImageBitmap failed, using HTMLImageElement:', bmpErr);
        }
      }

      // Fallback conversion using HTMLImageElement
      return new Promise<Blob>((resolve, reject) => {
        const objUrl = URL.createObjectURL(rawBlob);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(objUrl);
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas 2D context not available'));
            return;
          }
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((png) => {
            if (png) resolve(png);
            else reject(new Error('Failed to convert image to PNG'));
          }, 'image/png');
        };
        img.onerror = () => {
          URL.revokeObjectURL(objUrl);
          reject(new Error('Failed to decode image'));
        };
        img.src = objUrl;
      });
    };

    const pngPromise = producePngBlob();

    try {
      // Primary: synchronous invocation with Promise<Blob> inside user gesture window (Safari & Chrome 97+)
      const item = new ClipboardItem({
        'image/png': pngPromise as any,
      });

      await navigator.clipboard.write([item]);
      setCopiedImageIndex(index);
      setTimeout(() => setCopiedImageIndex(null), 2000);
      addLog(`Image #${String(index).padStart(2, '0')} copied to clipboard! (Ready to paste image)`, 'success');
    } catch (primaryErr: any) {
      console.warn('Primary Promise<ClipboardItem> failed, trying resolved blob fallback:', primaryErr);
      try {
        const resolvedBlob = await pngPromise;
        const item = new ClipboardItem({
          'image/png': resolvedBlob,
        });
        await navigator.clipboard.write([item]);
        setCopiedImageIndex(index);
        setTimeout(() => setCopiedImageIndex(null), 2000);
        addLog(`Image #${String(index).padStart(2, '0')} copied to clipboard! (Ready to paste image)`, 'success');
      } catch (fallbackErr: any) {
        console.error('Failed to copy image to clipboard:', fallbackErr);
        addLog(`Failed to copy image #${index}: ${fallbackErr.message || 'Clipboard permission error'}`, 'error');
      }
    }
  };

  const handleSaveToInbox = async () => {
    const rentNum = propertyData.listing_type === 'RENT' && propertyData.price ? parseFloat(propertyData.price) : undefined;
    const saleNum = propertyData.listing_type === 'SALE' && propertyData.price ? parseFloat(propertyData.price) : undefined;

    const originalImgUrls = images.map((img) => img.stored_url || img.source_url);

    const finalDescription = aiGeneratedCopy || caption;

    const payload: Partial<Property> = {
      projectName: propertyData.project_name || 'Bangkok Property',
      listingType: (propertyData.listing_type as any) || 'RENT',
      propertyType: 'CONDO',
      title: `${propertyData.project_name || 'Listing'} - ${propertyData.listing_type} (${propertyData.bedrooms ? propertyData.bedrooms + ' Bed' : 'Condo'})`,
      description: finalDescription,
      rentPrice: rentNum,
      salePrice: saleNum,
      bedrooms: propertyData.bedrooms ? parseInt(propertyData.bedrooms, 10) : undefined,
      bathrooms: propertyData.bathrooms ? parseInt(propertyData.bathrooms, 10) : undefined,
      sizeSqm: propertyData.size_sqm ? parseFloat(propertyData.size_sqm) : undefined,
      floor: propertyData.floor ? `${propertyData.floor}` : undefined,
      btsMrt: propertyData.nearest_transit,
      status: 'NEW',
      sourceUrl: source?.canonical_url || url,
      sourceAuthor: source?.source_name || 'Facebook Import',
      originalImages: originalImgUrls,
      enhancedImages: originalImgUrls,
      finalImages: originalImgUrls,
      contactInfo: [
        propertyData.contact_phone ? `Tel: ${propertyData.contact_phone}` : '',
        propertyData.contact_line ? `Line: ${propertyData.contact_line}` : '',
      ]
        .filter(Boolean)
        .join(' | '),
    };

    try {
      // Call backend save
      await fetch('http://localhost:8085/api/facebook-import/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          result: {
            source,
            property: {
              ...propertyData,
              price: propertyData.price ? parseFloat(propertyData.price) : null,
              bedrooms: propertyData.bedrooms ? parseInt(propertyData.bedrooms, 10) : null,
              bathrooms: propertyData.bathrooms ? parseInt(propertyData.bathrooms, 10) : null,
              size_sqm: propertyData.size_sqm ? parseFloat(propertyData.size_sqm) : null,
            },
            caption: { original: caption, ai_copy: aiGeneratedCopy, language_detected: languages },
            images,
          },
        }),
      });

      if (onSaveToInbox) {
        onSaveToInbox(payload);
      }

      setSavedSuccessMsg(true);
      setTimeout(() => {
        if (onNavigateTab) {
          onNavigateTab('inbox');
        }
      }, 1200);
    } catch {
      if (onSaveToInbox) {
        onSaveToInbox(payload);
      }
      setSavedSuccessMsg(true);
    }
  };

  const handleManualPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < e.target.files.length; i++) {
      formData.append('photos', e.target.files[i]);
    }

    try {
      addLog('Uploading photos manually...', 'info');
      const resp = await fetch('http://localhost:8085/api/facebook-import/upload-photos', {
        method: 'POST',
        body: formData,
      });
      if (resp.ok) {
        const data = await resp.json();
        const uploadedImgs: ExtractedImage[] = data.images || [];
        setImages((prev) => [...prev, ...uploadedImgs]);
        addLog(`Uploaded ${uploadedImgs.length} photos successfully`, 'success');
      }
    } catch {
      addLog('Failed to upload photos', 'error');
    }
  };

  const handleRerunExtraction = () => {
    handleStartImport();
  };

  const handleDeleteImport = () => {
    setUrl('');
    setSource(null);
    setCaption('');
    setImages([]);
    setCurrentStepIndex(-1);
    setPipelineError(null);
    setPipelineErrorCode(null);
    setLogs([]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '3rem' }}>
      {/* Page Title & Nav Actions Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <FaFacebook style={{ color: '#1877F2', fontSize: '1.5rem', flexShrink: 0 }} />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Facebook Post Import
          </h1>
          <button
            type="button"
            onClick={() => setShowInfo(!showInfo)}
            title={showInfo ? 'Hide description' : 'Show description'}
            aria-label="Toggle description"
            style={{
              background: showInfo ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.06)',
              border: `1px solid ${showInfo ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.15)'}`,
              borderRadius: '50%',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: showInfo ? 'var(--accent-primary)' : 'var(--text-muted)',
              transition: 'all 0.15s ease',
              padding: 0,
            }}
          >
            <FiInfo style={{ fontSize: '13px' }} />
          </button>
        </div>

        {/* Top Header Actions: Auto Import + Advanced Toggle + Compact Live Browser */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap' }}>
          {/* Auto Import Toggle */}
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.8125rem',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <span>Auto Import</span>
            <button
              type="button"
              role="switch"
              aria-checked={autoImport}
              onClick={() => setAutoImport(!autoImport)}
              title={autoImport ? 'Auto import is enabled' : 'Auto import is disabled'}
              style={{
                width: '34px',
                height: '18px',
                backgroundColor: autoImport ? '#1877F2' : 'rgba(255, 255, 255, 0.15)',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                transition: 'background-color 0.2s ease',
                padding: 0,
                outline: 'none',
              }}
            >
              <div
                style={{
                  width: '14px',
                  height: '14px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '50%',
                  position: 'absolute',
                  top: '2px',
                  left: autoImport ? '18px' : '2px',
                  transition: 'left 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }}
              />
            </button>
          </label>

          {/* Advanced Settings Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: showAdvanced ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
              border: '1px solid',
              borderColor: showAdvanced ? 'var(--border-color)' : 'transparent',
              borderRadius: '0.375rem',
              color: showAdvanced ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              padding: '0.25rem 0.5rem',
              transition: 'all 0.15s ease',
            }}
          >
            <FiSliders style={{ fontSize: '13px' }} />
            <span>Advanced</span>
            {showAdvanced ? <FiChevronUp style={{ fontSize: '12px' }} /> : <FiChevronDown style={{ fontSize: '12px' }} />}
          </button>

          {/* Adjusted Compact Live Browser Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              try {
                window.open('http://localhost:6080/vnc.html?autoconnect=true&resize=scale', 'OpenClawLiveBrowser', 'width=1200,height=850,left=150,top=100');
              } catch (e) {}
              setShowLiveBrowserModal(true);
            }}
            title="Open live browser automation stream"
            leftIcon={<FiMonitor style={{ fontSize: '14px' }} />}
            style={{
              height: '34px',
              padding: '0 0.875rem',
              fontWeight: 500,
              fontSize: '0.8125rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.375rem',
              whiteSpace: 'nowrap',
              borderRadius: '0.375rem',
            }}
          >
            Live Browser
          </Button>
        </div>
      </div>

      {showInfo && (
        <div
          style={{
            marginTop: '-0.5rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.4rem 0.75rem',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '0.5rem',
            fontSize: '0.8125rem',
            color: 'var(--text-secondary)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <FiInfo style={{ color: 'var(--accent-primary)', flexShrink: 0, fontSize: '13px' }} />
          <span>Import property content, photos, and structured listing data from any Facebook post, group, or page.</span>
        </div>
      )}

      {/* TOP IMPORT CARD */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '0.75rem',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.875rem',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
          Facebook Post URL
        </div>

        {/* Unified Input Bar & Import Button */}
        <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <Input
              placeholder="Paste Facebook post link (e.g. https://www.facebook.com/share/p/...)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && url.trim() && !isProcessing) {
                  handleStartImport();
                }
              }}
              disabled={isProcessing}
              leftIcon={<FaFacebook style={{ color: '#1877F2', fontSize: '1.125rem' }} />}
              rightIcon={
                url && !isProcessing ? (
                  <button
                    type="button"
                    onClick={() => setUrl('')}
                    title="Clear input"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <FiX style={{ fontSize: '14px' }} />
                  </button>
                ) : undefined
              }
              style={{ height: '42px', fontSize: '0.875rem' }}
            />
          </div>

          <Button
            variant="primary"
            onClick={handleStartImport}
            disabled={!url.trim() || isProcessing}
            leftIcon={
              isProcessing ? (
                <FiRefreshCw className="spin" style={{ animation: 'spin 1s linear infinite', fontSize: '15px' }} />
              ) : (
                <FiDownload style={{ fontSize: '15px' }} />
              )
            }
            style={{
              height: '42px',
              paddingLeft: '1.25rem',
              paddingRight: '1.25rem',
              fontWeight: 500,
              fontSize: '0.875rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              whiteSpace: 'nowrap',
              backgroundColor: '#1877F2',
              borderColor: '#1877F2',
              borderRadius: '0.5rem',
            }}
          >
            {isProcessing ? 'Importing...' : 'Import Post'}
          </Button>
        </div>

        {/* Advanced Controls Dropdown Panel */}
        {showAdvanced && (
          <div
            style={{
              padding: '0.875rem',
              backgroundColor: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              borderRadius: '0.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Extraction Method:</span>
                <Select
                  value={preferredMethod}
                  onChange={(val) => setPreferredMethod(val as any)}
                  width="230px"
                  height="34px"
                  options={[
                    { value: 'auto', label: 'Auto (Meta API → OpenClaw)' },
                    { value: 'openclaw_browser', label: 'OpenClaw Browser Only' },
                    { value: 'meta_graph_api', label: 'Meta Graph API Only' },
                  ]}
                />
              </div>

              <Button variant="ghost" size="sm" onClick={() => handleStartImport()}>
                Re-resolve URL
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowLiveBrowserModal(true)}>
                Re-open Browser
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowRawJsonModal(true)}>
                <FiCode style={{ marginRight: '0.25rem' }} /> View Raw JSON
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ERROR / LOGIN REQUIRED BANNER */}
      {pipelineError && (
        <div
          style={{
            backgroundColor: pipelineErrorCode === 'LOGIN_REQUIRED' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            border: `1px solid ${pipelineErrorCode === 'LOGIN_REQUIRED' ? 'var(--status-warning)' : 'var(--status-danger)'}`,
            borderRadius: '0.75rem',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <FiAlertCircle
              style={{
                fontSize: '1.25rem',
                color: pipelineErrorCode === 'LOGIN_REQUIRED' ? 'var(--status-warning)' : 'var(--status-danger)',
              }}
            />
            <div style={{ flex: 1 }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                {pipelineErrorCode === 'LOGIN_REQUIRED'
                  ? 'Facebook Login Required'
                  : pipelineErrorCode === 'ACCESS_RESTRICTED'
                  ? 'Facebook Access Restricted'
                  : 'Extraction Failed'}
              </h4>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
                {pipelineError}
              </p>
            </div>
            {pipelineErrorCode === 'LOGIN_REQUIRED' && (
              <Button variant="primary" size="sm" onClick={() => setShowLiveBrowserModal(true)}>
                Open Facebook Login
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setManualMode(true)}>
              Manual Fallback
            </Button>
          </div>
        </div>
      )}

      {/* SAVED TO INBOX NOTIFICATION */}
      {savedSuccessMsg && (
        <div
          style={{
            backgroundColor: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid var(--status-success)',
            borderRadius: '0.75rem',
            padding: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <FiCheck style={{ color: 'var(--status-success)', fontSize: '1.25rem' }} />
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
            Property successfully saved to Property Inbox! Redirecting...
          </span>
        </div>
      )}

      {/* MANUAL FALLBACK MODE */}
      {manualMode && (
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px dashed var(--border-color)',
            borderRadius: '0.75rem',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Manual Fallback Import
            </h4>
            <Button variant="ghost" size="sm" onClick={() => setManualMode(false)}>
              Exit Manual Mode
            </Button>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
            Automatic extraction couldn't access this post. You can paste the visible caption and upload photos directly.
          </p>
          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Paste Caption Manually:
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={5}
              placeholder="Paste caption here..."
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '0.375rem',
                padding: '0.625rem',
                fontSize: '0.8125rem',
                marginTop: '0.375rem',
                fontFamily: 'inherit',
              }}
            />
          </div>
          <div>
            <input
              type="file"
              multiple
              accept="image/*"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleManualPhotoUpload}
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <FiUploadCloud style={{ marginRight: '0.375rem' }} /> Upload Photos Directly
            </Button>
          </div>
        </div>
      )}

      {/* 2-COLUMN EXTRACTION MONITOR: PIPELINE STATUS (LEFT) & LIVE ACTIVITY LOG (RIGHT) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1rem',
          alignItems: 'stretch',
        }}
      >
        {/* LEFT COLUMN: VERTICAL PIPELINE STATUS (COLUMN DESIGN, NO GLOW, NOT BOLD) */}
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '0.75rem',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                Pipeline Status
              </span>
              {currentStepIndex >= 0 && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 400,
                    color: isProcessing ? 'var(--accent-primary)' : 'var(--status-success)',
                  }}
                >
                  ({currentStepIndex + 1}/{PIPELINE_STEPS.length}: {PIPELINE_STEPS[currentStepIndex]?.label})
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>Browser:</span>
              <Badge
                variant={
                  browserState === 'Logged In' || browserState === 'Complete'
                    ? 'success'
                    : browserState === 'Facebook Login Required' || browserState === 'Access Restricted'
                    ? 'warning'
                    : 'default'
                }
                size="sm"
              >
                {browserState}
              </Badge>
            </div>
          </div>

          {/* Vertical Stepper Column */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              paddingLeft: '0.25rem',
              paddingTop: '0.25rem',
            }}
          >
            {PIPELINE_STEPS.map((step, idx) => {
              const isCompleted = currentStepIndex > idx;
              const isCurrent = currentStepIndex === idx && isProcessing;
              const isFailed = currentStepIndex === idx && pipelineError !== null;

              return (
                <div
                  key={step.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    position: 'relative',
                  }}
                >
                  {/* Vertical connecting line */}
                  {idx < PIPELINE_STEPS.length - 1 && (
                    <div
                      style={{
                        position: 'absolute',
                        left: '11px',
                        top: '22px',
                        bottom: '-12px',
                        width: '2px',
                        backgroundColor: isCompleted ? '#22C55E' : 'rgba(255, 255, 255, 0.1)',
                        zIndex: 0,
                      }}
                    />
                  )}

                  {/* Step Node Circle (no glow, flat clean) */}
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isCompleted
                        ? '#22C55E'
                        : isCurrent
                        ? '#3B82F6'
                        : isFailed
                        ? '#EF4444'
                        : 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${
                        isCompleted
                          ? '#22C55E'
                          : isCurrent
                          ? '#3B82F6'
                          : isFailed
                          ? '#EF4444'
                          : 'rgba(255, 255, 255, 0.12)'
                      }`,
                      color: isCompleted || isCurrent || isFailed ? '#FFFFFF' : 'var(--text-muted)',
                      fontSize: '0.6875rem',
                      fontWeight: 400,
                      zIndex: 1,
                      flexShrink: 0,
                    }}
                  >
                    {isCompleted ? (
                      <FiCheck style={{ fontSize: '12px', strokeWidth: 2.5 }} />
                    ) : isCurrent ? (
                      <FiRefreshCw className="spin" style={{ fontSize: '11px', display: 'inline-block' }} />
                    ) : isFailed ? (
                      <FiAlertCircle style={{ fontSize: '11px' }} />
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>

                  {/* Step Label (regular weight, no bold) */}
                  <span
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: 400,
                      color: isCompleted
                        ? 'var(--text-primary)'
                        : isCurrent
                        ? '#60A5FA'
                        : isFailed
                        ? '#F87171'
                        : 'var(--text-muted)',
                    }}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: LIVE ACTIVITY LOG CONSOLE */}
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '0.75rem',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
              Activity Log
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
              {logs.length} events
            </span>
          </div>

          <div
            style={{
              backgroundColor: '#0D0D0D',
              border: '1px solid var(--border-color)',
              borderRadius: '0.5rem',
              padding: '0.875rem 1rem',
              flex: 1,
              minHeight: '260px',
              maxHeight: '440px',
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.375rem',
            }}
          >
            {logs.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '1rem 0', fontWeight: 400 }}>
                Waiting for Facebook import to start...
              </div>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '0.5rem', lineHeight: '1.4' }}>
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0, fontWeight: 400 }}>{log.timestamp}</span>
                  <span
                    style={{
                      color:
                        log.level === 'success'
                          ? 'var(--status-success)'
                          : log.level === 'error'
                          ? 'var(--status-danger)'
                          : log.level === 'warn'
                          ? 'var(--status-warning)'
                          : 'var(--text-secondary)',
                      fontWeight: 400,
                    }}
                  >
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* LIVE BROWSER PREVIEW PANEL */}
      {isProcessing && liveScreenshot && (
        <div
          style={{
            backgroundColor: '#0A0A0A',
            border: '1px solid var(--accent-primary)',
            borderRadius: '0.75rem',
            overflow: 'hidden',
            boxShadow: '0 0 24px rgba(59,130,246,0.15)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.5rem 0.875rem',
              backgroundColor: 'rgba(59,130,246,0.1)',
              borderBottom: '1px solid rgba(59,130,246,0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#22C55E',
                  display: 'inline-block',
                  boxShadow: '0 0 6px #22C55E',
                  animation: 'pulse 1.5s infinite',
                }}
              />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                🔴 Live Browser Preview
              </span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                — OpenClaw automation running
              </span>
            </div>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>updates every 1.5s</span>
          </div>
          <div style={{ position: 'relative', lineHeight: 0 }}>
            <img
              src={liveScreenshot}
              alt="Live browser preview"
              style={{
                width: '100%',
                display: 'block',
                maxHeight: '420px',
                objectFit: 'contain',
                backgroundColor: '#000',
              }}
            />
            {/* Step overlay badge */}
            <div
              style={{
                position: 'absolute',
                bottom: '0.5rem',
                left: '0.5rem',
                backgroundColor: 'rgba(0,0,0,0.75)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(59,130,246,0.4)',
                borderRadius: '0.375rem',
                padding: '0.25rem 0.625rem',
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: 'var(--accent-primary)',
              }}
            >
              {currentStepIndex >= 0 && currentStepIndex < PIPELINE_STEPS.length
                ? `Step ${currentStepIndex + 1}/${PIPELINE_STEPS.length}: ${PIPELINE_STEPS[currentStepIndex].label}`
                : 'Initializing'}
            </div>
          </div>
        </div>
      )}

      {/* RESULTS AREA (Divided into Left: Content & AI Panels & Right: Photos Panel) */}
      {(caption || images.length > 0 || source) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem', alignItems: 'start' }}>
          {/* LEFT: POST CONTENT & AI GENERATOR (SEPARATE MOTHER BOXES) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* MOTHER BOX 1: POST CONTENT PANEL */}
            <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '0.75rem',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Post Content
              </h3>
              <Badge variant="info" size="sm">
                {source?.extraction_method || 'OpenClaw Browser'}
              </Badge>
            </div>

            {/* Source Meta Metadata */}
            <div
              style={{
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: '0.5rem',
                padding: '0.75rem',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.5rem',
                fontSize: '0.75rem',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Source:</span>{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{source?.source_type || 'Facebook Post'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Author:</span>{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{source?.source_name || 'N/A'}</strong>
              </div>
              <div style={{ gridColumn: 'span 2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ color: 'var(--text-muted)' }}>Canonical:</span>{' '}
                <a
                  href={source?.canonical_url || url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}
                >
                  {source?.canonical_url || url} <FiExternalLink style={{ fontSize: '0.6875rem' }} />
                </a>
              </div>
              {languages.length > 0 && (
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Languages:</span>{' '}
                  <span style={{ color: 'var(--text-secondary)' }}>{languages.join(', ')}</span>
                </div>
              )}
            </div>

            {/* Original Raw Facebook Caption Box (Untouched) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Visible Caption (Raw Extracted Data)
                </label>
                <button
                  type="button"
                  onClick={handleCopyCaption}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    background: 'transparent',
                    border: 'none',
                    color: copiedCaption ? 'var(--status-success)' : 'var(--accent-primary)',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  {copiedCaption ? <FiCheck /> : <FiCopy />}
                  <span>{copiedCaption ? 'Copied!' : 'Copy Caption'}</span>
                </button>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.5rem',
                  padding: '0.75rem',
                  fontSize: '0.8125rem',
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  lineHeight: 1.6,
                }}
              >
                {caption || <span style={{ color: 'var(--text-muted)' }}>No caption extracted</span>}
              </div>
            </div>

            {/* Action Buttons for Raw Data */}
            <div style={{ display: 'flex', gap: '0.625rem', paddingTop: '0.25rem', alignItems: 'center' }}>
              <Button
                variant="outline"
                size="md"
                onClick={() => setShowRawJsonModal(true)}
                leftIcon={<FiCode style={{ fontSize: '15px' }} />}
                style={{
                  height: '38px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  whiteSpace: 'nowrap',
                  padding: '0 1.125rem',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  borderRadius: '0.375rem',
                }}
              >
                View Raw Data
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={handleRerunExtraction}
                leftIcon={<FiRefreshCw style={{ fontSize: '15px' }} />}
                style={{
                  height: '38px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  whiteSpace: 'nowrap',
                  padding: '0 1.125rem',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  borderRadius: '0.375rem',
                }}
              >
                Re-run Extraction
              </Button>
            </div>
          </div>

          {/* MOTHER BOX 2: AI PROMPT & COPY GENERATOR PANEL (SEPARATE STANDALONE BOX) */}
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '0.75rem',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {/* Header: Title + Provider Switcher (Google AI vs OpenAI) + Status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  AI Prompt & Copy Generator
                </h3>

                  {/* Dual AI Provider Switcher */}
                  <div
                    style={{
                      display: 'inline-flex',
                      backgroundColor: 'var(--bg-main)',
                      padding: '2px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setAiProvider('google_ai')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: 'none',
                        fontSize: '0.75rem',
                        fontWeight: aiProvider === 'google_ai' ? 600 : 400,
                        backgroundColor: aiProvider === 'google_ai' ? 'rgba(78, 136, 255, 0.2)' : 'transparent',
                        color: aiProvider === 'google_ai' ? '#60A5FA' : 'var(--text-muted)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <SiGooglegemini style={{ fontSize: '13px', color: '#4E88FF', flexShrink: 0 }} />
                      <span>Google AI Studio</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAiProvider('openai')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: 'none',
                        fontSize: '0.75rem',
                        fontWeight: aiProvider === 'openai' ? 600 : 400,
                        backgroundColor: aiProvider === 'openai' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                        color: aiProvider === 'openai' ? '#34D399' : 'var(--text-muted)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <OpenAIIcon size={13} color="#10B981" />
                      <span>OpenAI</span>
                    </button>
                  </div>
                </div>

                {/* Connection Status */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                  <span>{aiProvider === 'google_ai' ? 'Connected (gemini-flash-latest)' : 'Connected (gpt-4o)'}</span>
                </div>
              </div>

              {/* Template Selection & Main Generate Button Row */}
              <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 240px', minWidth: '200px' }}>
                  <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.375rem', display: 'block' }}>
                    Select Prompt Template
                  </label>
                  <Select
                    value={selectedTemplateId}
                    onChange={(val) => setSelectedTemplateId(val)}
                    height="40px"
                    placeholder="Select prompt template..."
                    options={promptTemplates.map((t) => ({
                      value: String(t.id),
                      label: `${t.name} (${t.category})`,
                    }))}
                  />
                </div>

                <Button
                  variant="primary"
                  size="md"
                  onClick={handleGenerateAICopy}
                  disabled={isGeneratingAI || !caption.trim()}
                  style={{
                    height: '40px',
                    minWidth: '160px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '0 1.25rem',
                    borderRadius: '0.5rem',
                    background: aiProvider === 'openai'
                      ? 'linear-gradient(135deg, #059669 0%, #10B981 100%)'
                      : 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
                    border: 'none',
                    boxShadow: aiProvider === 'openai'
                      ? '0 2px 10px rgba(16, 185, 129, 0.25)'
                      : '0 2px 10px rgba(78, 136, 255, 0.3)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    boxSizing: 'border-box',
                  }}
                >
                  {isGeneratingAI ? (
                    <>
                      <FiRefreshCw className="spin" style={{ animation: 'spin 1s linear infinite', fontSize: '15px', flexShrink: 0 }} />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <FiZap style={{ fontSize: '15px', flexShrink: 0 }} />
                      <span>Generate with AI</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Optional Prompt Customization */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowPromptTweak(!showPromptTweak)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent-primary)',
                    fontSize: '0.6875rem',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  <FiSliders style={{ fontSize: '0.6875rem' }} />
                  <span>{showPromptTweak ? 'Hide prompt instructions tweak' : 'Customize prompt instructions'}</span>
                </button>
                {showPromptTweak && (
                  <div style={{ marginTop: '0.375rem' }}>
                    <input
                      type="text"
                      value={customPromptTweak}
                      onChange={(e) => setCustomPromptTweak(e.target.value)}
                      placeholder="e.g. Translate to English, highlight BTS station, add urgent CTA..."
                      style={{
                        width: '100%',
                        height: '34px',
                        padding: '0 0.625rem',
                        borderRadius: '0.375rem',
                        backgroundColor: 'var(--bg-main)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        fontSize: '0.75rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                )}
              </div>

              {aiError && (
                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid var(--status-error)',
                    borderRadius: '0.375rem',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.75rem',
                    color: '#F87171',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{aiError}</span>
                  <button
                    type="button"
                    onClick={() => setAiError(null)}
                    style={{ background: 'transparent', border: 'none', color: '#F87171', cursor: 'pointer' }}
                  >
                    <FiX />
                  </button>
                </div>
              )}

              {/* AI Generated Output Display Box */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      AI Generated Listing Copy
                    </label>
                    {generatedProvider && (
                      <Badge variant={generatedProvider === 'openai' ? 'success' : 'info'} size="sm">
                        {generatedProvider === 'openai' ? 'OpenAI GPT-4o' : 'Google Gemini'}
                      </Badge>
                    )}
                  </div>

                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    {aiGeneratedCopy && (
                      <button
                        type="button"
                        onClick={() => setIsEditingAiCopy(!isEditingAiCopy)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          background: 'transparent',
                          border: 'none',
                          color: isEditingAiCopy ? 'var(--accent-primary)' : 'var(--text-muted)',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        <FiEdit3 />
                        <span>{isEditingAiCopy ? 'Done' : 'Edit'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleCopyAiCopy}
                      disabled={!aiGeneratedCopy}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        background: 'transparent',
                        border: 'none',
                        color: !aiGeneratedCopy ? 'var(--text-muted)' : copiedAiCopy ? 'var(--status-success)' : 'var(--accent-primary)',
                        fontSize: '0.75rem',
                        cursor: aiGeneratedCopy ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {copiedAiCopy ? <FiCheck /> : <FiCopy />}
                      <span>{copiedAiCopy ? 'Copied!' : 'Copy AI Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* Content Box */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    border: aiGeneratedCopy ? '1px solid rgba(78, 136, 255, 0.35)' : '1px solid var(--border-color)',
                    borderRadius: '0.5rem',
                    padding: '0.75rem',
                    minHeight: '120px',
                    maxHeight: '260px',
                    overflowY: 'auto',
                  }}
                >
                  {aiGeneratedCopy ? (
                    isEditingAiCopy ? (
                      <textarea
                        value={aiGeneratedCopy}
                        onChange={(e) => setAiGeneratedCopy(e.target.value)}
                        style={{
                          width: '100%',
                          minHeight: '180px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          outline: 'none',
                          color: 'var(--text-primary)',
                          fontSize: '0.8125rem',
                          lineHeight: 1.6,
                          resize: 'none',
                          fontFamily: 'inherit',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          fontSize: '0.8125rem',
                          color: 'var(--text-primary)',
                          whiteSpace: 'pre-wrap',
                          lineHeight: 1.6,
                        }}
                      >
                        {aiGeneratedCopy}
                      </div>
                    )
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '110px',
                        textAlign: 'center',
                        gap: '0.5rem',
                        color: 'var(--text-muted)',
                        fontSize: '0.8125rem',
                      }}
                    >
                      <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                        <SiGooglegemini style={{ fontSize: '1.25rem', color: '#4E88FF', opacity: 0.8 }} />
                        <OpenAIIcon size={18} color="#10B981" />
                      </div>
                      <div>
                        Select your template and AI provider above, then click <strong style={{ color: 'var(--text-primary)' }}>Generate with AI</strong> to transform the raw caption into structured real estate copy.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: IMPORTED PHOTOS PANEL */}
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '0.75rem',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Imported Photos ({images.length})
              </h3>
              <Badge variant={images.length > 0 ? 'success' : 'default'} size="sm">
                Preserved Order
              </Badge>
            </div>

            {images.length === 0 ? (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2rem',
                  color: 'var(--text-muted)',
                  border: '1px dashed var(--border-color)',
                  borderRadius: '0.5rem',
                }}
              >
                <FiImage style={{ fontSize: '2rem', marginBottom: '0.5rem', opacity: 0.5 }} />
                <span>No photos imported</span>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: '0.75rem',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  paddingRight: '0.25rem',
                }}
              >
                {images.map((img) => (
                  <div
                    key={img.index}
                    onClick={() => setPreviewImage(img.stored_url || img.source_url)}
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '0.5rem',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div style={{ position: 'relative', height: '110px', backgroundColor: '#000' }}>
                      <img
                        id={`imported-fb-photo-${img.index}`}
                        crossOrigin="anonymous"
                        src={img.stored_url ? `http://localhost:8085${img.stored_url}` : img.source_url}
                        alt={`Photo ${img.index}`}
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          top: '6px',
                          left: '6px',
                          backgroundColor: 'rgba(0,0,0,0.75)',
                          color: '#fff',
                          fontSize: '0.6875rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 600,
                          backdropFilter: 'blur(4px)',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                          zIndex: 2,
                        }}
                      >
                        #{String(img.index).padStart(2, '0')}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          const fullUrl = img.stored_url
                            ? (img.stored_url.startsWith('http') ? img.stored_url : `http://localhost:8085${img.stored_url}`)
                            : img.source_url;
                          handleCopyImage({ index: img.index, url: fullUrl }, e);
                        }}
                        title={copiedImageIndex === img.index ? 'Copied image to clipboard!' : 'Copy image to clipboard'}
                        aria-label="Copy image"
                        style={{
                          position: 'absolute',
                          top: '6px',
                          right: '6px',
                          width: '32px',
                          height: '32px',
                          backgroundColor: copiedImageIndex === img.index ? '#10B981' : 'rgba(15, 23, 42, 0.85)',
                          color: '#fff',
                          border: copiedImageIndex === img.index ? '1px solid #059669' : '1px solid rgba(255, 255, 255, 0.35)',
                          borderRadius: '6px',
                          padding: 0,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backdropFilter: 'blur(4px)',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.45)',
                          transition: 'all 0.15s ease',
                          zIndex: 2,
                        }}
                        onMouseEnter={(e) => {
                          if (copiedImageIndex !== img.index) {
                            e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.95)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.6)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (copiedImageIndex !== img.index) {
                            e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.85)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.35)';
                          }
                        }}
                      >
                        {copiedImageIndex === img.index ? (
                          <FiCheck style={{ fontSize: '18px', strokeWidth: 3 }} />
                        ) : (
                          <FiCopy style={{ fontSize: '18px' }} />
                        )}
                      </button>
                    </div>
                    <div style={{ padding: '0.375rem 0.5rem', fontSize: '0.6875rem' }}>
                      <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                        {img.width > 0 && img.height > 0 ? `${img.width} × ${img.height}` : 'Imported'}
                      </div>
                      <div style={{ color: 'var(--status-success)', fontSize: '0.625rem' }}>
                        {img.status === 'downloaded' ? 'Stored Locally' : 'Ready'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* IMPORT ACTION BAR */}
      {(source || caption || images.length > 0 || manualMode) && (
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '0.75rem',
            padding: '1rem 1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="danger"
              size="md"
              onClick={handleDeleteImport}
              style={{
                height: '38px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                whiteSpace: 'nowrap',
                padding: '0 1.125rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                borderRadius: '0.375rem',
              }}
            >
              <FiTrash2 style={{ fontSize: '15px', flexShrink: 0 }} />
              <span>Delete Import</span>
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => window.open(source?.canonical_url || url, '_blank')}
              style={{
                height: '38px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                whiteSpace: 'nowrap',
                padding: '0 1.125rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                borderRadius: '0.375rem',
              }}
            >
              <FiExternalLink style={{ fontSize: '15px', flexShrink: 0 }} />
              <span>Open Original Post</span>
            </Button>
          </div>

          <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="outline"
              size="md"
              onClick={handleRerunExtraction}
              style={{
                height: '38px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                whiteSpace: 'nowrap',
                padding: '0 1.125rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                borderRadius: '0.375rem',
              }}
            >
              <FiRefreshCw style={{ fontSize: '15px', flexShrink: 0 }} />
              <span>Re-Extract</span>
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSaveToInbox}
              style={{
                height: '38px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                fontWeight: 600,
                padding: '0 1.25rem',
                whiteSpace: 'nowrap',
                fontSize: '0.8125rem',
                borderRadius: '0.375rem',
              }}
            >
              <FiSave style={{ fontSize: '15px', flexShrink: 0 }} />
              <span>Save to Property Inbox</span>
            </Button>
          </div>
        </div>
      )}

      {/* RAW JSON MODAL */}
      <Modal isOpen={showRawJsonModal} onClose={() => setShowRawJsonModal(false)} title="Raw Extraction JSON Data">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <pre
            style={{
              backgroundColor: '#0D0D0D',
              border: '1px solid var(--border-color)',
              borderRadius: '0.5rem',
              padding: '0.75rem',
              fontSize: '0.75rem',
              color: '#A3E635',
              overflowX: 'auto',
              maxHeight: '450px',
            }}
          >
            {JSON.stringify(
              {
                source,
                property: propertyData,
                caption: { original: caption, languages },
                images,
              },
              null,
              2
            )}
          </pre>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="outline" size="sm" onClick={() => setShowRawJsonModal(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* PHOTO PREVIEW MODAL */}
      {previewImage && (
        <Modal isOpen={Boolean(previewImage)} onClose={() => setPreviewImage(null)} title="Photo Preview" maxWidth="800px">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <img
              src={previewImage.startsWith('/storage') ? `http://localhost:8085${previewImage}` : previewImage}
              alt="Preview"
              style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: '0.375rem', objectFit: 'contain' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', width: '100%', justifyContent: 'center' }}>
              <Button
                variant="primary"
                size="sm"
                onClick={(e) => {
                  const url = previewImage.startsWith('/storage') ? `http://localhost:8085${previewImage}` : previewImage;
                  handleCopyImage({ index: 9999, url }, e);
                }}
              >
                {copiedImageIndex === 9999 ? <FiCheck /> : <FiCopy />}
                <span>{copiedImageIndex === 9999 ? 'Copied Image!' : 'Copy Image'}</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPreviewImage(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* LIVE BROWSER STREAM / VNC MODAL */}
      <Modal
        isOpen={showLiveBrowserModal}
        onClose={() => setShowLiveBrowserModal(false)}
        title="OpenClaw Live Facebook Browser"
        maxWidth="960px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.5rem 0.75rem',
              backgroundColor: 'var(--bg-main)',
              borderRadius: '0.375rem',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Status:</span>
              <Badge
                variant={browserState === 'Logged In' ? 'success' : 'warning'}
                size="sm"
              >
                {browserState}
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('http://localhost:6080/vnc.html?autoconnect=true&resize=scale', '_blank')}
            >
              <FiExternalLink style={{ marginRight: '0.25rem' }} /> Open in New Tab
            </Button>
          </div>

          <div
            style={{
              height: '520px',
              backgroundColor: '#000',
              borderRadius: '0.5rem',
              overflow: 'hidden',
              border: '1px solid var(--border-color)',
            }}
          >
            <iframe
              src="http://localhost:6080/vnc.html?autoconnect=true&resize=scale"
              title="OpenClaw VNC Live Browser"
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Authenticate directly in the window above. EstateAutomate never sees or stores your password.
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setShowLiveBrowserModal(false);
                  checkBrowserStatus();
                  if (url) handleStartImport();
                }}
              >
                Continue Extraction
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowLiveBrowserModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
