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
} from 'react-icons/fi';
import { FaFacebook } from 'react-icons/fa';

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
  { id: 'url_received', label: 'URL RECEIVED' },
  { id: 'resolving', label: 'RESOLVING' },
  { id: 'opening_browser', label: 'OPENING FACEBOOK' },
  { id: 'target_found', label: 'TARGET POST FOUND' },
  { id: 'caption_extracted', label: 'CAPTION EXTRACTED' },
  { id: 'photos_detected', label: 'PHOTOS DETECTED' },
  { id: 'verifying_photos', label: 'VERIFYING PHOTOS' },
  { id: 'downloading_media', label: 'DOWNLOADING MEDIA' },
  { id: 'ai_analysis', label: 'AI ANALYSIS' },
  { id: 'complete', label: 'COMPLETE' },
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

  const handleCopyImage = async (rawUrl: string, index: number) => {
    try {
      // 1. Determine optimal CORS-safe fetch URL
      let fetchUrl = rawUrl;
      if (rawUrl.startsWith('/storage')) {
        fetchUrl = `http://localhost:8085${rawUrl}`;
      } else if (rawUrl.includes('facebook.com') || rawUrl.includes('fbcdn.net')) {
        fetchUrl = `http://localhost:8085/api/facebook-import/proxy-image?url=${encodeURIComponent(rawUrl)}`;
      }

      // 2. Fetch the image blob
      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();

      // 3. Convert blob to a true PNG blob using canvas
      // Chromium & Safari ClipboardItem strictly mandate a Blob whose blob.type is 'image/png'.
      let pngBlob: Blob | null = null;

      if (typeof createImageBitmap === 'function') {
        try {
          const bmp = await createImageBitmap(blob);
          const canvas = document.createElement('canvas');
          canvas.width = bmp.width;
          canvas.height = bmp.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(bmp, 0, 0);
            pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
          }
        } catch (bmpErr) {
          console.warn('createImageBitmap failed, trying object URL fallback', bmpErr);
        }
      }

      if (!pngBlob) {
        // Fallback: use HTMLImageElement with blob object URL (NO crossOrigin needed for blob:)
        const objectUrl = URL.createObjectURL(blob);
        try {
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Image failed to decode from blob'));
            img.src = objectUrl;
          });
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('No canvas 2D context');
          ctx.drawImage(img, 0, 0);
          pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      }

      if (!pngBlob) {
        throw new Error('Could not convert image to PNG format');
      }

      // 4. Write image/png directly into system clipboard (pasting will paste the actual image, NOT text)
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': pngBlob,
        }),
      ]);

      setCopiedImageIndex(index);
      setTimeout(() => setCopiedImageIndex(null), 2000);
      addLog(`Image #${String(index).padStart(2, '0')} copied! (Ready to paste image)`, 'success');
    } catch (err: any) {
      console.error('Failed to copy image to clipboard:', err);
      addLog(`Failed to copy image #${index}: ${err.message || 'Clipboard permission error'}`, 'error');
    }
  };

  const handleSaveToInbox = async () => {
    const rentNum = propertyData.listing_type === 'RENT' && propertyData.price ? parseFloat(propertyData.price) : undefined;
    const saleNum = propertyData.listing_type === 'SALE' && propertyData.price ? parseFloat(propertyData.price) : undefined;

    const originalImgUrls = images.map((img) => img.stored_url || img.source_url);

    const payload: Partial<Property> = {
      projectName: propertyData.project_name || 'Bangkok Property',
      listingType: (propertyData.listing_type as any) || 'RENT',
      propertyType: 'CONDO',
      title: `${propertyData.project_name || 'Listing'} - ${propertyData.listing_type} (${propertyData.bedrooms ? propertyData.bedrooms + ' Bed' : 'Condo'})`,
      description: caption,
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
            caption: { original: caption, language_detected: languages },
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
      {/* Page Title & Subtitle */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <FaFacebook style={{ color: '#1877F2', fontSize: '1.5rem' }} />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Facebook Post Import
          </h1>
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem', margin: 0 }}>
          Import property content, photos, and structured listing data from any Facebook post, group, or page.
        </p>
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
          gap: '1rem',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Facebook Post URL
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Auto Import Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              <span>Auto Import</span>
              <button
                type="button"
                onClick={() => setAutoImport(!autoImport)}
                style={{
                  width: '38px',
                  height: '20px',
                  backgroundColor: autoImport ? 'var(--accent-primary)' : 'var(--border-color)',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background-color 0.2s',
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
                    left: autoImport ? '20px' : '2px',
                    transition: 'left 0.2s',
                  }}
                />
              </button>
              <Badge variant={autoImport ? 'info' : 'default'} size="sm">
                {autoImport ? 'ON' : 'OFF'}
              </Badge>
            </div>

            {/* Advanced Toggle */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.8125rem',
              }}
            >
              <FiSliders />
              <span>Advanced</span>
              {showAdvanced ? <FiChevronUp /> : <FiChevronDown />}
            </button>
          </div>
        </div>

        {/* Input Bar & Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <Input
              placeholder="Paste Facebook Post URL (e.g. https://www.facebook.com/share/p/...)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isProcessing}
              leftIcon={<FaFacebook style={{ color: '#1877F2' }} />}
            />
          </div>
          <Button
            variant="primary"
            onClick={handleStartImport}
            disabled={!url.trim() || isProcessing}
            style={{ minWidth: '140px', fontWeight: 600 }}
          >
            {isProcessing ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FiRefreshCw className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                IMPORTING...
              </span>
            ) : (
              'IMPORT POST'
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
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <FiMonitor />
            OPEN LIVE BROWSER
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

      {/* PIPELINE STATUS BAR */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '0.75rem',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Pipeline Status
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>OpenClaw Browser:</span>
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

        {/* Horizontal Pipeline Steps */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            overflowX: 'auto',
            paddingBottom: '0.25rem',
            gap: '0.25rem',
          }}
        >
          {PIPELINE_STEPS.map((step, idx) => {
            const isCompleted = currentStepIndex > idx;
            const isCurrent = currentStepIndex === idx && isProcessing;
            const isFailed = currentStepIndex === idx && pipelineError !== null;

            return (
              <React.Fragment key={step.id}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '0.375rem 0.625rem',
                    borderRadius: '0.375rem',
                    backgroundColor: isCompleted
                      ? 'rgba(34, 197, 94, 0.12)'
                      : isCurrent
                      ? 'rgba(59, 130, 246, 0.15)'
                      : isFailed
                      ? 'rgba(239, 68, 68, 0.15)'
                      : 'transparent',
                    border: `1px solid ${
                      isCompleted
                        ? 'rgba(34, 197, 94, 0.3)'
                        : isCurrent
                        ? 'var(--accent-primary)'
                        : isFailed
                        ? 'var(--status-danger)'
                        : 'var(--border-color)'
                    }`,
                    whiteSpace: 'nowrap',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    color: isCompleted
                      ? 'var(--status-success)'
                      : isCurrent
                      ? 'var(--accent-primary)'
                      : isFailed
                      ? 'var(--status-danger)'
                      : 'var(--text-muted)',
                  }}
                >
                  {isCompleted ? (
                    <FiCheck style={{ fontSize: '0.8125rem' }} />
                  ) : isCurrent ? (
                    <FiRefreshCw style={{ animation: 'spin 1s linear infinite' }} />
                  ) : isFailed ? (
                    <FiAlertCircle />
                  ) : (
                    <span style={{ opacity: 0.6 }}>{idx + 1}</span>
                  )}
                  <span>{step.label}</span>
                </div>
                {idx < PIPELINE_STEPS.length - 1 && (
                  <span style={{ color: 'var(--border-color)', fontSize: '0.75rem', padding: '0 0.125rem' }}>→</span>
                )}
              </React.Fragment>
            );
          })}
        </div>
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
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
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

      {/* LIVE ACTIVITY LOG */}
      {logs.length > 0 && (
        <div
          style={{
            backgroundColor: '#0D0D0D',
            border: '1px solid var(--border-color)',
            borderRadius: '0.5rem',
            padding: '0.75rem 1rem',
            maxHeight: '120px',
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
          }}
        >
          {logs.map((log, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{log.timestamp}</span>
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
                }}
              >
                {log.message}
              </span>
            </div>
          ))}
        </div>
      )}

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
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', letterSpacing: '0.04em' }}>
                🔴 LIVE BROWSER PREVIEW
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
                fontWeight: 700,
                color: 'var(--accent-primary)',
                letterSpacing: '0.04em',
              }}
            >
              {currentStepIndex >= 0 && currentStepIndex < PIPELINE_STEPS.length
                ? `STEP ${currentStepIndex + 1}/${PIPELINE_STEPS.length}: ${PIPELINE_STEPS[currentStepIndex].label}`
                : 'INITIALIZING'}
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

            {/* Caption Display (Preserving Unicode) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Visible Caption
                </label>
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
                  maxHeight: '260px',
                  overflowY: 'auto',
                  lineHeight: 1.6,
                }}
              >
                {caption || <span style={{ color: 'var(--text-muted)' }}>No caption extracted</span>}
              </div>
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
                        src={img.stored_url ? `http://localhost:8085${img.stored_url}` : img.source_url}
                        alt={`Photo ${img.index}`}
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          top: '4px',
                          left: '4px',
                          backgroundColor: 'rgba(0,0,0,0.7)',
                          color: '#fff',
                          fontSize: '0.625rem',
                          padding: '2px 5px',
                          borderRadius: '4px',
                          fontWeight: 600,
                        }}
                      >
                        #{String(img.index).padStart(2, '0')}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const fullUrl = img.stored_url
                            ? (img.stored_url.startsWith('http') ? img.stored_url : `http://localhost:8085${img.stored_url}`)
                            : img.source_url;
                          handleCopyImage(fullUrl, img.index);
                        }}
                        title="Copy image to clipboard"
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          backgroundColor: copiedImageIndex === img.index ? '#10B981' : 'rgba(0, 0, 0, 0.75)',
                          color: '#fff',
                          border: '1px solid rgba(255, 255, 255, 0.3)',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          fontSize: '0.625rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          backdropFilter: 'blur(4px)',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
                          transition: 'all 0.15s ease',
                          zIndex: 2,
                        }}
                      >
                        {copiedImageIndex === img.index ? (
                          <>
                            <FiCheck style={{ fontSize: '0.6875rem' }} />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <FiCopy style={{ fontSize: '0.6875rem' }} />
                            <span>Copy</span>
                          </>
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

      {/* REVIEW & EDITABLE PROPERTY DETAILS SCREEN */}
      {(source || caption || propertyData.project_name || propertyData.price || manualMode) && (
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '0.75rem',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <Badge variant="success" size="md">
                IMPORT COMPLETE
              </Badge>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Review Extracted Property Fields
              </h3>
            </div>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Verify and adjust extracted values before saving to your Property Inbox
            </span>
          </div>

          {/* Editable Property Fields Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
            }}
          >
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Project Name</label>
              <Input
                value={propertyData.project_name}
                onChange={(e) => setPropertyData({ ...propertyData, project_name: e.target.value })}
                placeholder="e.g. Supalai Veranda Sukhumvit 117"
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Listing Type</label>
              <select
                value={propertyData.listing_type}
                onChange={(e) => setPropertyData({ ...propertyData, listing_type: e.target.value })}
                style={{
                  width: '100%',
                  height: '38px',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.375rem',
                  padding: '0 0.75rem',
                  fontSize: '0.875rem',
                }}
              >
                <option value="RENT">Rent</option>
                <option value="SALE">Sale</option>
                <option value="RENT_AND_SALE">Rent & Sale</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Price (THB/mo or Total)</label>
              <Input
                value={propertyData.price}
                onChange={(e) => setPropertyData({ ...propertyData, price: e.target.value })}
                placeholder="e.g. 9500"
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Bedrooms</label>
              <Input
                value={propertyData.bedrooms}
                onChange={(e) => setPropertyData({ ...propertyData, bedrooms: e.target.value })}
                placeholder="e.g. 1 (or 0 for Studio)"
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Bathrooms</label>
              <Input
                value={propertyData.bathrooms}
                onChange={(e) => setPropertyData({ ...propertyData, bathrooms: e.target.value })}
                placeholder="e.g. 1"
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Size (sqm)</label>
              <Input
                value={propertyData.size_sqm}
                onChange={(e) => setPropertyData({ ...propertyData, size_sqm: e.target.value })}
                placeholder="e.g. 28"
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Floor</label>
              <Input
                value={propertyData.floor}
                onChange={(e) => setPropertyData({ ...propertyData, floor: e.target.value })}
                placeholder="e.g. 15"
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Nearest Transit (BTS/MRT)</label>
              <Input
                value={propertyData.nearest_transit}
                onChange={(e) => setPropertyData({ ...propertyData, nearest_transit: e.target.value })}
                placeholder="e.g. BTS Pu Chao"
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Furnishing</label>
              <Input
                value={propertyData.furnished}
                onChange={(e) => setPropertyData({ ...propertyData, furnished: e.target.value })}
                placeholder="e.g. Fully furnished"
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Contact Phone</label>
              <Input
                value={propertyData.contact_phone}
                onChange={(e) => setPropertyData({ ...propertyData, contact_phone: e.target.value })}
                placeholder="e.g. 081-234-5678"
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Contact Line ID</label>
              <Input
                value={propertyData.contact_line}
                onChange={(e) => setPropertyData({ ...propertyData, contact_line: e.target.value })}
                placeholder="e.g. @estateagent"
              />
            </div>
          </div>

          {/* Action Button Row */}
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'flex-end',
              flexWrap: 'wrap',
              borderTop: '1px solid var(--border-color)',
              paddingTop: '1rem',
            }}
          >
            <Button variant="danger" size="sm" onClick={handleDeleteImport}>
              <FiTrash2 style={{ marginRight: '0.25rem' }} /> DELETE IMPORT
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(source?.canonical_url || url, '_blank')}
            >
              <FiExternalLink style={{ marginRight: '0.25rem' }} /> OPEN ORIGINAL POST
            </Button>
            <Button variant="outline" size="sm" onClick={handleRerunExtraction}>
              <FiRefreshCw style={{ marginRight: '0.25rem' }} /> RE-EXTRACT
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSaveToInbox}
              style={{ fontWeight: 700, paddingLeft: '1.5rem', paddingRight: '1.5rem' }}
            >
              <FiSave style={{ marginRight: '0.375rem' }} /> SAVE TO PROPERTY INBOX
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
                onClick={() => {
                  const url = previewImage.startsWith('/storage') ? `http://localhost:8085${previewImage}` : previewImage;
                  handleCopyImage(url, 9999);
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
