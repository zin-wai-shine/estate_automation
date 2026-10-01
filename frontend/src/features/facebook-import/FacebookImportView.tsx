import React, { useState, useEffect, useRef } from 'react';
import type { Property } from '../../types';
import { Button } from '../../components/ui/Button';
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

  // Google AI Assistant & Prompt Templates
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>(DEFAULT_PROMPT_TEMPLATES);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('1');
  const [customPromptTweak, setCustomPromptTweak] = useState<string>('');
  const [showPromptTweak, setShowPromptTweak] = useState<boolean>(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [aiGeneratedCopy, setAiGeneratedCopy] = useState<string>('');
  const [captionTab, setCaptionTab] = useState<'raw' | 'ai'>('raw');
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
    addLog(`Calling Google AI (Gemini) with template "${template?.name || 'Selected'}"...`, 'info');

    try {
      const resp = await fetch('http://localhost:8085/api/facebook-import/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: template ? String(template.id) : '',
          template_name: template?.name || 'Facebook Template',
          template_text: template?.templateText || '',
          raw_content: caption,
          custom_prompt: customPromptTweak,
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate listing copy with Google AI');
      }

      setAiGeneratedCopy(data.generated_content);
      setCaptionTab('ai');
      addLog('✨ Google AI generated listing copy successfully!', 'success');
    } catch (err: any) {
      const msg = err.message || 'Error communicating with Google AI';
      setAiError(msg);
      addLog(`Google AI generation failed: ${msg}`, 'error');
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

    const finalDescription = (captionTab === 'ai' && aiGeneratedCopy) ? aiGeneratedCopy : (aiGeneratedCopy || caption);

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
      {/* Page Title & Interactive Info Icon */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <FaFacebook style={{ color: '#1877F2', fontSize: '1.5rem' }} />
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

        {showInfo && (
          <div
            style={{
              marginTop: '0.5rem',
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
      </div>

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
        }}
      >
        {/* Header: Label & Secondary Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
            Facebook Post URL
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            {/* Auto Import Toggle (Clean switch, no redundant text badge) */}
            <label
              style={{
                display: 'flex',
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
                  width: '36px',
                  height: '20px',
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
                    width: '16px',
                    height: '16px',
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
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: 'transparent',
                border: 'none',
                color: showAdvanced ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.8125rem',
                padding: '2px 4px',
                transition: 'color 0.15s ease',
              }}
            >
              <FiSliders style={{ fontSize: '13px' }} />
              <span>Advanced</span>
              {showAdvanced ? <FiChevronUp style={{ fontSize: '12px' }} /> : <FiChevronDown style={{ fontSize: '12px' }} />}
            </button>
          </div>
        </div>

        {/* Unified Input Bar & Action Buttons */}
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
            style={{
              height: '42px',
              paddingLeft: '1.25rem',
              paddingRight: '1.25rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              whiteSpace: 'nowrap',
              backgroundColor: '#1877F2',
              borderColor: '#1877F2',
            }}
          >
            {isProcessing ? (
              <>
                <FiRefreshCw className="spin" style={{ animation: 'spin 1s linear infinite', fontSize: '14px' }} />
                <span>Importing...</span>
              </>
            ) : (
              <span>Import Post</span>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              try {
                window.open('http://localhost:6080/vnc.html?autoconnect=true&resize=scale', 'OpenClawLiveBrowser', 'width=1200,height=850,left=150,top=100');
              } catch (e) {}
              setShowLiveBrowserModal(true);
            }}
            title="Open live browser automation stream"
            style={{
              height: '42px',
              paddingLeft: '1rem',
              paddingRight: '1rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              whiteSpace: 'nowrap',
            }}
          >
            <FiMonitor style={{ fontSize: '14px' }} />
            <span>Live Browser</span>
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
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Extraction Method:</span>
                <select
                  value={preferredMethod}
                  onChange={(e: any) => setPreferredMethod(e.target.value)}
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '0.375rem',
                    padding: '0.375rem 0.625rem',
                    fontSize: '0.8125rem',
                  }}
                >
                  <option value="auto">Auto (Meta API → OpenClaw)</option>
                  <option value="openclaw_browser">OpenClaw Browser Only</option>
                  <option value="meta_graph_api">Meta Graph API Only</option>
                </select>
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

      {/* RESULTS AREA (Divided into Left: Post Content Panel & Right: Photos Panel) */}
      {(caption || images.length > 0 || source) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
          {/* LEFT: POST CONTENT PANEL */}
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

            {/* Google AI Studio Prompt Assistant */}
            <div
              style={{
                backgroundColor: 'rgba(78, 136, 255, 0.05)',
                border: '1px solid rgba(78, 136, 255, 0.22)',
                borderRadius: '0.625rem',
                padding: '0.875rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.625rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <SiGooglegemini style={{ color: '#4E88FF', fontSize: '1.125rem' }} />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Google AI Studio
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Connected (gemini-flash-latest)</span>
                </div>
              </div>

              {/* Template Selection & Generate Action */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem', display: 'block' }}>
                    Prompt Template
                  </label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.375rem',
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    {promptTemplates.map((t) => (
                      <option key={t.id} value={String(t.id)}>
                        {t.name} ({t.category})
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleGenerateAICopy}
                  disabled={isGeneratingAI || !caption.trim()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
                    border: 'none',
                    boxShadow: '0 2px 8px rgba(78, 136, 255, 0.3)',
                    padding: '0.55rem 0.875rem',
                    fontSize: '0.8125rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isGeneratingAI ? (
                    <>
                      <FiRefreshCw className="spin" style={{ display: 'inline-block' }} />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <FiZap style={{ fontSize: '0.9375rem' }} />
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
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  <FiSliders style={{ fontSize: '0.6875rem' }} />
                  <span>{showPromptTweak ? 'Hide prompt tweak' : 'Customize prompt instructions'}</span>
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
                        padding: '0.45rem 0.625rem',
                        borderRadius: '0.375rem',
                        backgroundColor: 'var(--bg-main)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        fontSize: '0.75rem',
                        outline: 'none',
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
            </div>

            {/* Caption Display (Dual View: Raw Facebook Caption vs AI Polished Copy) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {/* Tab Switcher */}
                <div
                  style={{
                    display: 'flex',
                    gap: '0.25rem',
                    background: 'var(--bg-main)',
                    padding: '0.1875rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setCaptionTab('raw')}
                    style={{
                      padding: '0.25rem 0.625rem',
                      borderRadius: '0.25rem',
                      border: 'none',
                      fontSize: '0.75rem',
                      fontWeight: captionTab === 'raw' ? 600 : 400,
                      backgroundColor: captionTab === 'raw' ? 'var(--bg-secondary)' : 'transparent',
                      color: captionTab === 'raw' ? 'var(--text-primary)' : 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    Raw Facebook Caption
                  </button>
                  <button
                    type="button"
                    onClick={() => setCaptionTab('ai')}
                    style={{
                      padding: '0.25rem 0.625rem',
                      borderRadius: '0.25rem',
                      border: 'none',
                      fontSize: '0.75rem',
                      fontWeight: captionTab === 'ai' ? 600 : 400,
                      backgroundColor: captionTab === 'ai' ? 'var(--bg-secondary)' : 'transparent',
                      color: captionTab === 'ai' ? '#60A5FA' : 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                    }}
                  >
                    <span>AI Listing Copy</span>
                    {aiGeneratedCopy && (
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: '#3B82F6',
                          display: 'inline-block',
                        }}
                      />
                    )}
                  </button>
                </div>

                {/* Tab specific action buttons */}
                {captionTab === 'raw' ? (
                  <button
                    type="button"
                    onClick={handleCopyCaption}
                    style={{
                      display: 'flex',
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
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {aiGeneratedCopy && (
                      <button
                        type="button"
                        onClick={() => setIsEditingAiCopy(!isEditingAiCopy)}
                        style={{
                          display: 'flex',
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
                        display: 'flex',
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
                )}
              </div>

              {/* Content Container */}
              {captionTab === 'raw' ? (
                <div
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '0.5rem',
                    padding: '0.75rem',
                    fontSize: '0.8125rem',
                    color: 'var(--text-primary)',
                    whiteSpace: 'pre-wrap',
                    maxHeight: '260px',
                    overflowY: 'auto',
                    lineHeight: 1.6,
                  }}
                >
                  {caption || <span style={{ color: 'var(--text-muted)' }}>No caption extracted</span>}
                </div>
              ) : (
                <div
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid rgba(78, 136, 255, 0.3)',
                    borderRadius: '0.5rem',
                    padding: '0.75rem',
                    minHeight: '140px',
                    maxHeight: '260px',
                    overflowY: 'auto',
                    position: 'relative',
                  }}
                >
                  {aiGeneratedCopy ? (
                    isEditingAiCopy ? (
                      <textarea
                        value={aiGeneratedCopy}
                        onChange={(e) => setAiGeneratedCopy(e.target.value)}
                        style={{
                          width: '100%',
                          minHeight: '200px',
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
                        height: '140px',
                        textAlign: 'center',
                        gap: '0.625rem',
                        color: 'var(--text-muted)',
                        fontSize: '0.8125rem',
                      }}
                    >
                      <SiGooglegemini style={{ fontSize: '1.75rem', color: '#4E88FF', opacity: 0.8 }} />
                      <div>
                        Select a prompt template above and click{' '}
                        <strong style={{ color: 'var(--text-primary)' }}>Generate with AI</strong> to transform this raw post
                        into formatted real estate copy.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
              <Button variant="outline" size="sm" onClick={() => setShowRawJsonModal(true)}>
                <FiCode style={{ marginRight: '0.25rem' }} /> View Raw Data
              </Button>
              <Button variant="ghost" size="sm" onClick={handleRerunExtraction}>
                <FiRefreshCw style={{ marginRight: '0.25rem' }} /> Re-run Extraction
              </Button>
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
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="danger" size="sm" onClick={handleDeleteImport}>
              <FiTrash2 style={{ marginRight: '0.25rem' }} /> Delete Import
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(source?.canonical_url || url, '_blank')}
            >
              <FiExternalLink style={{ marginRight: '0.25rem' }} /> Open Original Post
            </Button>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="outline" size="sm" onClick={handleRerunExtraction}>
              <FiRefreshCw style={{ marginRight: '0.25rem' }} /> Re-Extract
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSaveToInbox}
              style={{ fontWeight: 600, paddingLeft: '1.25rem', paddingRight: '1.25rem' }}
            >
              <FiSave style={{ marginRight: '0.375rem' }} /> Save to Property Inbox
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
