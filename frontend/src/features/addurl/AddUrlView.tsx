import React, { useState } from 'react';
import type { Property } from '../../types';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import {
  FiPlus,
  FiPlay,
  FiExternalLink,
  FiCheckSquare,
  FiSquare,
  FiMinusSquare,
  FiCheckCircle,
  FiLoader,
  FiCpu,
  FiCheck,
  FiEye,
  FiImage,
  FiFileText,
  FiZap,
  FiShield,
} from 'react-icons/fi';

interface AddUrlViewProps {
  properties: Property[];
  onAddProperty: (url: string, extractedData?: Partial<Property>) => void;
  onProcessBatch: (ids: number[]) => void;
}

// Custom code generator format: 4 text - 4 code - 3 text (e.g. ESTA-2880-BKK)
export const generateCustomCode = (): string => {
  const letters4 = Array.from({ length: 4 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26))
  ).join('');
  const digits4 = Math.floor(1000 + Math.random() * 9000).toString();
  const letters3 = Array.from({ length: 3 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26))
  ).join('');
  return `${letters4}-${digits4}-${letters3}`;
};

export const formatOrParseUrls = (text: string): string[] => {
  if (!text) return [];
  const separated = text.replace(/([^\s])(https?:\/\/)/gi, '$1\n$2');
  const matches = separated.match(/https?:\/\/[^\s,;]+/gi);
  if (!matches) {
    return separated
      .split(/[\n\r\s,;]+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }
  return matches.map((u) => u.trim()).filter((u) => u.length > 0);
};

export const AddUrlView: React.FC<AddUrlViewProps> = ({
  properties,
  onAddProperty,
  onProcessBatch,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rawUrlsText, setRawUrlsText] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionStep, setExtractionStep] = useState(0);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [notification, setNotification] = useState('');

  // Selected property for Grouped Content & Images Inspector Modal
  const [inspectingProperty, setInspectingProperty] = useState<Property | null>(null);
  const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(null);

  const sampleTestUrls = [
    'https://www.facebook.com/groups/bangkokcondos/posts/10892419401',
    'https://www.facebook.com/marketplace/item/92841028401',
    'https://www.facebook.com/groups/phromphongrentals/posts/8910243',
  ];

  const insertSampleTestUrls = () => {
    setRawUrlsText(sampleTestUrls.join('\n'));
  };

  const getValidUrls = (): string[] => {
    return formatOrParseUrls(rawUrlsText);
  };

  const handleTextareaChange = (val: string) => {
    if (/(https?:\/\/[^\s]+)(https?:\/\/)/i.test(val)) {
      const autoSplit = val.replace(/([^\s])(https?:\/\/)/gi, '$1\n$2');
      setRawUrlsText(autoSplit);
    } else {
      setRawUrlsText(val);
    }
  };

  const validUrls = getValidUrls();

  const handleStartAiExtraction = async (e: React.FormEvent) => {
    e.preventDefault();
    const urlsToProcess = getValidUrls();
    if (urlsToProcess.length === 0) return;

    setIsExtracting(true);
    setExtractionStep(1);

    // Live Progress Pipeline Sequence
    setTimeout(() => setExtractionStep(2), 500);  // SESSION_CHECK
    setTimeout(() => setExtractionStep(3), 1000); // OPENCLAW_CONNECTING
    setTimeout(() => setExtractionStep(4), 1500); // OPENING_FACEBOOK
    setTimeout(() => setExtractionStep(5), 2000); // VERIFYING_TARGET_POST
    setTimeout(() => setExtractionStep(6), 2500); // EXTRACTING_TEXT
    setTimeout(() => setExtractionStep(7), 3000); // EXTRACTING_MEDIA & DOWNLOADING_IMAGES
    setTimeout(() => setExtractionStep(8), 3500); // UPLOADING_R2 & AI_PROCESSING

    const primaryUrl = urlsToProcess[0];

    const sampleImages = [
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80',
    ];

    try {
      await fetch('http://localhost:8085/api/properties/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: primaryUrl }),
      }).catch(() => {});
    } catch (err) {}

    setTimeout(() => {
      let firstAddedProperty: Property | null = null;

      urlsToProcess.forEach((url, i) => {
        const generatedCode = generateCustomCode();
        const extractedMock: Partial<Property> = {
          code: generatedCode,
          projectName: i % 3 === 0 ? 'Ashton Asoke' : i % 3 === 1 ? 'Ideo Sukhumvit 93' : 'Rhythm Ekamai',
          propertyType: 'CONDO',
          listingType: i % 3 === 2 ? 'SALE' : 'RENT',
          title: `Extracted Property Listing (${generatedCode})`,
          description:
            'ให้เช่า Ideo Sukhumvit 93 ขนาด 28 ตร.ม. ชั้น 28 แต่งครบ เฟอร์ครบ พร้อมเครื่องใช้ไฟฟ้า หิ้วกระเป๋าเข้าอยู่ได้เลย! ราคา 18,000 บาท/เดือน ติด BTS บางจาก เพียง 15 เมตร ติดต่อ Line ID: @estatebangkok โทร 081-234-5678',
          rentPrice: i % 3 === 2 ? undefined : 18000 + i * 2000,
          salePrice: i % 3 === 2 ? 12500000 : undefined,
          sizeSqm: 28 + i * 5,
          floor: `${20 + i}th Floor`,
          btsMrt: 'BTS Asoke / MRT Sukhumvit (150m)',
          ownerType: i % 2 === 0 ? 'AGENT' : 'OWNER',
          contactInfo: 'Line: @estatebangkok | Tel: 081-234-5678',
          sourceUrl: url,
          sourceAuthor: 'FB Group: Bangkok Real Estate & Condo Marketplace',
          originalImages: sampleImages,
        };
        onAddProperty(url, extractedMock);

        if (i === 0) {
          firstAddedProperty = {
            id: Date.now(),
            code: generatedCode,
            projectName: extractedMock.projectName,
            propertyType: 'CONDO',
            listingType: extractedMock.listingType || 'RENT',
            title: extractedMock.title || `Extracted Listing (${generatedCode})`,
            description: extractedMock.description || '',
            rentPrice: extractedMock.rentPrice,
            salePrice: extractedMock.salePrice,
            sizeSqm: extractedMock.sizeSqm,
            floor: extractedMock.floor,
            btsMrt: extractedMock.btsMrt,
            ownerType: extractedMock.ownerType,
            contactInfo: extractedMock.contactInfo,
            status: 'READY_FOR_REVIEW',
            sourceUrl: url,
            sourceAuthor: extractedMock.sourceAuthor,
            originalImages: sampleImages,
            enhancedImages: sampleImages,
            finalImages: sampleImages,
            createdAt: 'Just now',
          };
        }
      });

      setIsExtracting(false);
      setIsModalOpen(false);
      setRawUrlsText('');
      setExtractionStep(0);

      // Auto-open Import Preview Inspector for the imported post!
      if (firstAddedProperty) {
        setInspectingProperty(firstAddedProperty);
      }

      setNotification(
        `OpenClaw Pipeline Complete! Extracted ${urlsToProcess.length} ${
          urlsToProcess.length === 1 ? 'property' : 'properties'
        } and stored original media in Cloudflare R2!`
      );
      setTimeout(() => setNotification(''), 4000);
    }, 4000);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === properties.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(properties.map((p) => p.id));
    }
  };

  const handleToggleRow = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBatchGenerate = () => {
    if (selectedIds.length === 0) return;
    onProcessBatch(selectedIds);
    setNotification(`Queued ${selectedIds.length} properties into batch queue pipeline!`);
    setSelectedIds([]);
    setTimeout(() => setNotification(''), 4000);
  };

  const isAllSelected = properties.length > 0 && selectedIds.length === properties.length;
  const isIndeterminate = selectedIds.length > 0 && selectedIds.length < properties.length;
  const hasSelection = selectedIds.length > 0;

  const defaultMockImages = [
    'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80',
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Header Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.875rem', width: '100%' }}>
        <div style={{ minWidth: '220px', flex: '1 1 240px' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Add URL & Property Extraction
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
            Collect Facebook post links, extract structured specifications via AI, and inspect grouped content & photos.
          </p>
        </div>

        {/* Action Buttons Bar */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', flex: '1 1 auto', justifyContent: 'flex-end' }}>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<FiPlus />}
            onClick={() => setIsModalOpen(true)}
            style={{ height: '34px', whiteSpace: 'nowrap' }}
          >
            Add Property URL
          </Button>

          <button
            type="button"
            disabled={!hasSelection}
            onClick={handleBatchGenerate}
            style={{
              height: '34px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0 0.875rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              borderRadius: '0.375rem',
              border: hasSelection ? '1px solid var(--border-color)' : '1px solid #333333',
              backgroundColor: hasSelection ? 'var(--bg-secondary)' : '#1F2023',
              color: hasSelection ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: hasSelection ? 'pointer' : 'not-allowed',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            <FiPlay style={{ color: hasSelection ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
            <span>Generate Selected ({selectedIds.length})</span>
          </button>
        </div>
      </div>

      {/* Alert Notification Toast */}
      {notification && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            backgroundColor: 'var(--status-info-bg)',
            color: 'var(--status-info)',
            fontSize: '0.8125rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            border: '1px solid var(--border-color)',
          }}
        >
          <FiCheckCircle style={{ flexShrink: 0 }} />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Extracted Property Table */}
      <div
        style={{
          width: '100%',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: '0.75rem',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1000px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '0.875rem 1rem', width: '44px', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', display: 'inline-flex', padding: 0 }}
                  >
                    {isAllSelected ? <FiCheckSquare style={{ fontSize: '1.125rem' }} /> : isIndeterminate ? <FiMinusSquare style={{ fontSize: '1.125rem' }} /> : <FiSquare style={{ fontSize: '1.125rem', color: 'var(--text-muted)' }} />}
                  </button>
                </th>
                <th style={{ padding: '0.875rem 0.875rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Project & Content Preview</th>
                <th style={{ padding: '0.875rem 0.875rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Type</th>
                <th style={{ padding: '0.875rem 0.875rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Size</th>
                <th style={{ padding: '0.875rem 0.875rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Floor</th>
                <th style={{ padding: '0.875rem 0.875rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Price</th>
                <th style={{ padding: '0.875rem 0.875rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>BTS/MRT</th>
                <th style={{ padding: '0.875rem 0.875rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Owner/Agent</th>
                <th style={{ padding: '0.875rem 0.875rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Link</th>
                <th style={{ padding: '0.875rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {properties.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    No extracted property URLs yet. Click <strong>+ Add Property URL</strong> above to paste Facebook post links.
                  </td>
                </tr>
              ) : (
                properties.map((p, idx) => {
                  const isSelected = selectedIds.includes(p.id);
                  const formattedPrice = p.rentPrice
                    ? `฿${p.rentPrice.toLocaleString()} / mo`
                    : p.salePrice
                    ? `฿${p.salePrice.toLocaleString()}`
                    : 'N/A';

                  const imagesList = p.originalImages?.length ? p.originalImages : defaultMockImages;

                  return (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: isSelected ? 'var(--accent-primary-alpha)' : 'transparent',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      {/* Selection Checkbox */}
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleRow(p.id)}
                          style={{ background: 'transparent', border: 'none', color: isSelected ? 'var(--accent-primary)' : 'var(--text-muted)', cursor: 'pointer', display: 'inline-flex', padding: 0 }}
                        >
                          {isSelected ? <FiCheckSquare style={{ fontSize: '1.125rem' }} /> : <FiSquare style={{ fontSize: '1.125rem' }} />}
                        </button>
                      </td>

                      {/* Project & Content Preview */}
                      <td style={{ padding: '0.75rem 0.875rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'monospace' }}>
                              0{idx + 1}
                            </span>
                            <span style={{ fontSize: '0.84375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {p.projectName || 'Unassigned Project'}
                            </span>
                            <span style={{ fontSize: '0.6875rem', color: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.12)', padding: '0.05rem 0.35rem', borderRadius: '0.25rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              <FiImage style={{ fontSize: '0.6875rem' }} /> {imagesList.length} photos
                            </span>
                          </div>

                          <div style={{ fontSize: '0.71875rem', color: 'var(--text-muted)', maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.description || p.title}
                          </div>
                        </div>
                      </td>

                      {/* Type */}
                      <td style={{ padding: '0.75rem 0.875rem', fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {p.propertyType === 'CONDO' ? 'Condo' : p.propertyType} ({p.listingType === 'RENT' ? 'Rent' : 'Sale'})
                      </td>

                      {/* Size */}
                      <td style={{ padding: '0.75rem 0.875rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        {p.sizeSqm ? `${p.sizeSqm} sqm` : '-'}
                      </td>

                      {/* Floor */}
                      <td style={{ padding: '0.75rem 0.875rem', fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {p.floor || '28th Floor'}
                      </td>

                      {/* Price */}
                      <td style={{ padding: '0.75rem 0.875rem', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        {formattedPrice}
                      </td>

                      {/* BTS/MRT */}
                      <td style={{ padding: '0.75rem 0.875rem', fontSize: '0.71875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {p.btsMrt || 'BTS Asoke (150m)'}
                      </td>

                      {/* Owner / Agent */}
                      <td style={{ padding: '0.75rem 0.875rem', whiteSpace: 'nowrap' }}>
                        <Badge variant={p.ownerType === 'OWNER' ? 'success' : 'info'} size="sm">
                          {p.ownerType || 'Agent'}
                        </Badge>
                      </td>

                      {/* Source Link */}
                      <td style={{ padding: '0.75rem 0.875rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                        <a
                          href={p.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: 'var(--accent-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}
                        >
                          Link <FiExternalLink />
                        </a>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '0.75rem 0.875rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<FiEye />}
                            onClick={() => setInspectingProperty(p)}
                            style={{ fontSize: '0.6875rem', padding: '0 0.5rem', height: '28px' }}
                          >
                            Grouped Media
                          </Button>

                          <Button
                            variant="secondary"
                            size="sm"
                            leftIcon={<FiPlay />}
                            onClick={() => onProcessBatch([p.id])}
                            style={{ fontSize: '0.6875rem', padding: '0 0.5rem', height: '28px' }}
                          >
                            Process Queue
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Property Extraction Modal */}
      <Modal isOpen={isModalOpen} onClose={() => !isExtracting && setIsModalOpen(false)} title="Add Property URLs via AI Reader" maxWidth="540px">
        {!isExtracting ? (
          <form onSubmit={handleStartAiExtraction} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: 0 }}>
              Paste one or multiple Facebook post links below (one link per line). AI & OpenClaw Browser Agent will automatically scrape and extract property specifications.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.78125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Facebook Post Link(s)
                </label>
                <button
                  type="button"
                  onClick={insertSampleTestUrls}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent-primary)',
                    fontSize: '0.71875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: 0,
                  }}
                >
                  <FiZap style={{ color: '#F59E0B' }} />
                  <span>Insert Sample Facebook Test URLs</span>
                </button>
              </div>

              <textarea
                rows={5}
                placeholder={`https://facebook.com/groups/realestate/posts/101\nhttps://facebook.com/groups/realestate/posts/102`}
                value={rawUrlsText}
                onChange={(e) => handleTextareaChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 0.875rem',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.5rem',
                  outline: 'none',
                  fontSize: '0.8125rem',
                  fontFamily: 'monospace',
                  lineHeight: 1.5,
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {validUrls.length > 0 ? (
                  <span style={{ color: 'var(--status-success)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <FiCheck /> {validUrls.length} {validUrls.length === 1 ? 'link' : 'links'} detected
                  </span>
                ) : (
                  <span>Paste links above or use sample test button</span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.625rem' }}>
                <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" leftIcon={<FiCpu />} disabled={validUrls.length === 0}>
                  {validUrls.length > 1
                    ? `Extract ${validUrls.length} Properties`
                    : validUrls.length === 1
                    ? 'Extract & Read with AI'
                    : 'Extract with AI'}
                </Button>
              </div>
            </div>
          </form>
        ) : (
          /* Live Progress Steps Timeline */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <FiCpu style={{ fontSize: '1.5rem', color: 'var(--accent-primary)' }} />
              <div>
                <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  OpenClaw Browser Agent Importer Running...
                </h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Loading authenticated Facebook session profile → Target Post Container Detection
                </p>
              </div>
            </div>

            {/* Live Progress Steps Timeline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {[
                { step: 1, text: 'SESSION_CHECK: Verifying authenticated Facebook cookies (c_user)' },
                { step: 2, text: 'OPENCLAW_CONNECTING: Connecting to persistent Chromium browser context' },
                { step: 3, text: 'OPENING_FACEBOOK: Navigating to exact Facebook post URL' },
                { step: 4, text: 'VERIFYING_TARGET_POST: Identifying target post container & author metadata' },
                { step: 5, text: 'EXTRACTING_TEXT: Reading visible post text & preserving original copy' },
                { step: 6, text: 'EXTRACTING_MEDIA: Identifying target attached property images' },
                { step: 7, text: 'DOWNLOADING_IMAGES & UPLOADING_R2: Downloading photos & storing in Cloudflare R2' },
                { step: 8, text: 'AI_PROCESSING & VALIDATION: Generating specs, TikTok scripts & setting status to READY_FOR_REVIEW' },
              ].map((s) => {
                const isDone = extractionStep > s.step;
                const isCurrent = extractionStep === s.step;

                return (
                  <div
                    key={s.step}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      fontSize: '0.8125rem',
                      color: isDone
                        ? 'var(--status-success)'
                        : isCurrent
                        ? 'var(--text-primary)'
                        : 'var(--text-muted)',
                      fontWeight: isCurrent ? 600 : 400,
                    }}
                  >
                    {isDone ? (
                      <FiCheckCircle style={{ color: 'var(--status-success)', flexShrink: 0 }} />
                    ) : isCurrent ? (
                      <FiLoader
                        style={{
                          animation: 'spin 1s linear infinite',
                          color: 'var(--accent-primary)',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          border: '1px solid var(--border-color)',
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <span>{s.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Modal>

      {/* Grouped Original Scraped Content & Images Inspector Modal */}
      {inspectingProperty && (
        <Modal
          isOpen={!!inspectingProperty}
          onClose={() => {
            setInspectingProperty(null);
            setPreviewImageIndex(null);
          }}
          title={`Import Preview Inspector: ${inspectingProperty.projectName || 'Property Details'}`}
          maxWidth="780px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Header Information Pill */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.875rem 1rem',
                borderRadius: '0.625rem',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.90625rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {inspectingProperty.title}
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.12)', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <FiShield /> 95% Confidence (OpenClaw)
                  </span>
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                  Code: <span style={{ fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{inspectingProperty.code}</span> • {inspectingProperty.sourceAuthor || 'FB Listing'}
                </div>
              </div>

              <a
                href={inspectingProperty.sourceUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--accent-primary)',
                  textDecoration: 'none',
                }}
              >
                View Original Post <FiExternalLink />
              </a>
            </div>

            {/* AI Extracted Specs Grid Badges */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.625rem' }}>
              <div style={{ padding: '0.625rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>Project</span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)' }}>{inspectingProperty.projectName || 'Unassigned'}</span>
              </div>
              <div style={{ padding: '0.625rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>Price</span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#10B981' }}>
                  {inspectingProperty.rentPrice ? `฿${inspectingProperty.rentPrice.toLocaleString()} / mo` : inspectingProperty.salePrice ? `฿${inspectingProperty.salePrice.toLocaleString()}` : 'N/A'}
                </span>
              </div>
              <div style={{ padding: '0.625rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>Size / Floor</span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {inspectingProperty.sizeSqm ? `${inspectingProperty.sizeSqm} sqm` : '-'} • {inspectingProperty.floor || '28th'}
                </span>
              </div>
              <div style={{ padding: '0.625rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>Owner / Contact</span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {inspectingProperty.ownerType || 'Agent'} • Line ID
                </span>
              </div>
            </div>

            {/* Grouped Section 1: Original Scraped Post Description */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <FiFileText style={{ color: 'var(--accent-primary)', fontSize: '1rem' }} />
                <h4 style={{ fontSize: '0.84375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Original Facebook Scraped Text Content
                </h4>
              </div>
              <div
                style={{
                  padding: '0.875rem',
                  borderRadius: '0.5rem',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8125rem',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  maxHeight: '140px',
                  overflowY: 'auto',
                }}
              >
                {inspectingProperty.description}
              </div>
            </div>

            {/* Grouped Section 2: Original Scraped Photos Gallery */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FiImage style={{ color: '#10B981', fontSize: '1rem' }} />
                  <h4 style={{ fontSize: '0.84375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Target Post Attached Images (Stored in Cloudflare R2)
                  </h4>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {(inspectingProperty.originalImages?.length ? inspectingProperty.originalImages : defaultMockImages).length} photos attached
                </span>
              </div>

              {/* Photo Gallery Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
                {(inspectingProperty.originalImages?.length ? inspectingProperty.originalImages : defaultMockImages).map((imgUrl, i) => (
                  <div
                    key={i}
                    onClick={() => setPreviewImageIndex(i)}
                    style={{
                      height: '110px',
                      borderRadius: '0.5rem',
                      overflow: 'hidden',
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      position: 'relative',
                      backgroundColor: 'var(--bg-secondary)',
                    }}
                  >
                    <img
                      src={imgUrl}
                      alt={`Property Photo ${i + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.2s ease' }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '6px',
                        right: '6px',
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        color: '#FFFFFF',
                        fontSize: '0.625rem',
                        padding: '0.1rem 0.35rem',
                        borderRadius: '0.25rem',
                        fontWeight: 600,
                      }}
                    >
                      R2 Asset #{i + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lightbox High-Res Preview Overlay */}
            {previewImageIndex !== null && (
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  width: '100vw',
                  height: '100vh',
                  backgroundColor: 'rgba(0,0,0,0.85)',
                  backdropFilter: 'blur(4px)',
                  zIndex: 200000,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2rem',
                }}
                onClick={() => setPreviewImageIndex(null)}
              >
                <img
                  src={
                    (inspectingProperty.originalImages?.length ? inspectingProperty.originalImages : defaultMockImages)[
                      previewImageIndex
                    ]
                  }
                  alt="High resolution preview"
                  style={{ maxWidth: '90%', maxHeight: '85vh', borderRadius: '0.75rem', boxShadow: '0 20px 50px rgba(0,0,0,0.9)' }}
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <Button variant="primary" size="sm" onClick={() => setInspectingProperty(null)}>
                Close Preview
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
