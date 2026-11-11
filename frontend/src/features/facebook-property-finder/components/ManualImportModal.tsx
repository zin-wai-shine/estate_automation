import React, { useState, useEffect } from 'react';
import {
  FiX,
  FiZap,
  FiCheck,
  FiLoader,
  FiAlertTriangle,
  FiLayers,
  FiUserCheck,
  FiShield,
  FiRefreshCw,
} from 'react-icons/fi';
import type { RawPostAnalysisResult, FinderPost } from '../types';
import { analyzeRawPostContent } from '../propertyFinderService';

interface ManualImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (post?: FinderPost | any) => void;
  isDark?: boolean;
}

const SAMPLE_SINGLE_POST = `ห้องของตัวเองค่ะ ปล่อยเช่าด่วน Regent Home Bangna ตึก C ชั้น 18 ห้องขนาด 28.5 ตรม. แต่งสวยสไตล์มินิมอล เตียง 5 ฟุต โซฟา โต๊ะทำงาน ปล่อยเช่า 7,500 บาท/เดือน รวมค่าส่วนกลางแล้ว จอดรถได้ 1 คัน ติดต่อ Line: boom_home`;

const SAMPLE_MULTI_POST = `POST 1:
ห้องของตัวเองค่ะ ปล่อยเช่าด่วน Regent Home Bangna ตึก C ชั้น 18 ห้องขนาด 28.5 ตรม. แต่งสวยสไตล์มินิมอล ปล่อยเช่า 7,500 บาท/เดือน รวมค่าส่วนกลางแล้ว จอดรถได้ 1 คัน ติดต่อ Line: boom_home

POST 2:
[AGENT] ให้เช่าคอนโด Aspire Erawan Prime (แอสปาย เอราวัณ ไพร์ม) ติด BTS ช้างเอราวัณ ห้อง Studio 27 ตร.ม. ชั้น 22 เครื่องใช้ไฟฟ้าครบ ค่าเช่า 9,500 บ/ด มีห้องในมือหลายตึก รับฝากขาย-เช่า ยินดีรับ Co-agent ติดต่อ Line: @bkkestate โทร 081-999-8888

POST 3:
The Metropolis Samrong (เดอะ เมโทรโพลิส สำโรง) เจ้าของขายเองค่ะ ห้องสวย 35 ตร.ม. 1 ห้องนอน ชั้น 15 ราคาขาย 2,490,000 บาท ไม่ผ่านนายหน้า นัดดูห้องได้ทุกวัน โทร 089-111-2222`;

const ANALYSIS_STEPS = [
  '1. Reading raw content...',
  '2. Identifying condominium projects...',
  '3. Extracting property information...',
  '4. Classifying owner or agent...',
  '5. Checking monitored projects...',
  '6. Saving property leads...',
];

export const ManualImportModal: React.FC<ManualImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  isDark = true,
}) => {
  const [rawContent, setRawContent] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [results, setResults] = useState<RawPostAnalysisResult[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
    }
  }, [isOpen]);

  // Stepped animation while analyzing
  useEffect(() => {
    if (!isAnalyzing) return;
    setActiveStepIndex(0);
    const interval = setInterval(() => {
      setActiveStepIndex((prev) => {
        if (prev < ANALYSIS_STEPS.length - 1) return prev + 1;
        return prev;
      });
    }, 450);
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  if (!isOpen) return null;

  const handleLoadSample = (sampleText: string) => {
    setRawContent(sampleText);
    setErrorMsg(null);
  };

  const handleAnalyze = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = rawContent.trim();
    if (!trimmed) {
      setErrorMsg('Please paste Facebook post content before analyzing');
      return;
    }

    setIsAnalyzing(true);
    setErrorMsg(null);
    setResults(null);

    try {
      const resp = await analyzeRawPostContent(trimmed);
      if (resp && resp.results && resp.results.length > 0) {
        setResults(resp.results);
      } else {
        setErrorMsg('No property information could be identified from the text.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to analyze post content');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFinishAndClose = () => {
    onImportSuccess();
    setResults(null);
    setRawContent('');
    onClose();
  };

  const handleResetForAnother = () => {
    setResults(null);
    setRawContent('');
    setErrorMsg(null);
    onImportSuccess();
  };

  // Estimate multi-post count
  const detectedPostCount = (() => {
    if (!rawContent.trim()) return 0;
    const postMatches = rawContent.match(/(?:^|\n)\s*(?:POST|Post|โพสต์|ข้อความที่)\s*\d+[:.\s-]+/gi);
    if (postMatches && postMatches.length >= 2) return postMatches.length;
    const dividerMatches = rawContent.match(/^\s*[-=_*~]{3,}\s*$/gm);
    if (dividerMatches && dividerMatches.length >= 1) return dividerMatches.length + 1;
    return 1;
  })();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(5px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: results ? '760px' : '620px',
          maxHeight: '90vh',
          backgroundColor: isDark ? '#161B22' : '#FFFFFF',
          borderRadius: '14px',
          border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.65)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'max-width 0.2s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: isDark ? '#0D1117' : '#F8FAFC',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                color: '#3B82F6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FiZap size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>
                Import Facebook Property Content
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                Paste one or multiple Facebook property posts. AI will automatically extract property details and match your monitored condominiums.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {errorMsg && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#EF4444',
                fontSize: '0.8125rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <FiAlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* VIEW 1: Analysis In Progress Indicator */}
          {isAnalyzing && (
            <div
              style={{
                padding: '2.5rem 1.5rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1.25rem',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#3B82F6',
                  animation: 'pulse 1.5s infinite',
                }}
              >
                <FiLoader size={26} style={{ animation: 'spin 1.2s linear infinite' }} />
              </div>

              <div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Analyzing Property Content...
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Extracting condo specs, owner/agent classification, and matching monitored targets
                </div>
              </div>

              {/* Steps Progress Box */}
              <div
                style={{
                  width: '100%',
                  maxWidth: '380px',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  backgroundColor: isDark ? '#0D1117' : '#F1F5F9',
                  border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  textAlign: 'left',
                }}
              >
                {ANALYSIS_STEPS.map((step, idx) => {
                  const isDone = idx < activeStepIndex;
                  const isCurrent = idx === activeStepIndex;
                  return (
                    <div
                      key={step}
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: isCurrent ? 600 : 400,
                        color: isDone ? '#10B981' : isCurrent ? '#3B82F6' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {isDone ? (
                        <FiCheck size={13} style={{ color: '#10B981', flexShrink: 0 }} />
                      ) : isCurrent ? (
                        <FiLoader size={13} style={{ color: '#3B82F6', flexShrink: 0, animation: 'spin 1.2s linear infinite' }} />
                      ) : (
                        <span style={{ width: '13px', height: '13px', display: 'inline-block' }} />
                      )}
                      <span>{step}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW 2: Extracted Property Results (Instant feedback) */}
          {!isAnalyzing && results && results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#10B981',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiCheck size={18} />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                    Successfully analyzed & saved {results.length} {results.length === 1 ? 'property lead' : 'property leads'}!
                  </span>
                </div>
                <span style={{ fontSize: '0.6875rem', color: '#10B981', fontWeight: 600 }}>
                  Stored in Property Leads Database
                </span>
              </div>

              {/* Cards for each extracted property */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {results.map((res, idx) => (
                  <div
                    key={res.post_id || idx}
                    style={{
                      borderRadius: '10px',
                      border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                      backgroundColor: isDark ? '#0D1117' : '#F8FAFC',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    {/* Top Row: Project Name & Badges */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {res.project_name || 'Unspecified Condo'}
                          </span>

                          {/* Match status badge */}
                          <span
                            style={{
                              fontSize: '0.625rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor:
                                res.project_match_status === 'MATCHED'
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : res.project_match_status === 'POSSIBLE_MATCH'
                                  ? 'rgba(245, 158, 11, 0.15)'
                                  : 'rgba(100, 116, 139, 0.15)',
                              color:
                                res.project_match_status === 'MATCHED'
                                  ? '#10B981'
                                  : res.project_match_status === 'POSSIBLE_MATCH'
                                  ? '#F59E0B'
                                  : 'var(--text-secondary)',
                              border:
                                res.project_match_status === 'MATCHED'
                                  ? '1px solid rgba(16, 185, 129, 0.3)'
                                  : '1px solid transparent',
                            }}
                          >
                            {res.project_match_status === 'MATCHED'
                              ? '✓ MONITORED CONDO'
                              : res.project_match_status === 'POSSIBLE_MATCH'
                              ? 'POSSIBLE MATCH'
                              : 'UNMATCHED TARGET'}
                          </span>

                          {res.is_duplicate && (
                            <span
                              style={{
                                fontSize: '0.625rem',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                color: '#F59E0B',
                              }}
                            >
                              EXISTING DUPLICATE
                            </span>
                          )}
                        </div>

                        {res.matched_project && (
                          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Matched Target: {res.matched_project.project_name} ({res.matched_project.thai_name || res.matched_project.english_name})
                          </div>
                        )}
                      </div>

                      {/* Owner / Agent Badge */}
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor:
                            res.owner_classification === 'OWNER_CLAIMED'
                              ? 'rgba(16, 185, 129, 0.15)'
                              : res.owner_classification === 'LIKELY_OWNER'
                              ? 'rgba(20, 184, 166, 0.15)'
                              : res.owner_classification === 'AGENT'
                              ? 'rgba(245, 158, 11, 0.15)'
                              : res.owner_classification === 'PROPERTY_AGENCY'
                              ? 'rgba(139, 92, 246, 0.15)'
                              : 'rgba(107, 114, 128, 0.15)',
                          color:
                            res.owner_classification === 'OWNER_CLAIMED'
                              ? '#10B981'
                              : res.owner_classification === 'LIKELY_OWNER'
                              ? '#14B8A6'
                              : res.owner_classification === 'AGENT'
                              ? '#F59E0B'
                              : res.owner_classification === 'PROPERTY_AGENCY'
                              ? '#8B5CF6'
                              : '#9CA3AF',
                          border:
                            res.owner_classification === 'OWNER_CLAIMED'
                              ? '1px solid rgba(16, 185, 129, 0.3)'
                              : '1px solid transparent',
                        }}
                      >
                        {res.owner_classification === 'OWNER_CLAIMED' && <FiUserCheck size={14} />}
                        <span>{res.owner_classification.replace('_', ' ')}</span>
                        <span style={{ fontSize: '0.6875rem', opacity: 0.8 }}>
                          ({Math.round(res.confidence * 100)}%)
                        </span>
                      </div>
                    </div>

                    {/* Specs Grid */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                        gap: '8px',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        backgroundColor: isDark ? '#161B22' : '#FFFFFF',
                        border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>Type & Listing</div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {res.listing_type}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>Price</div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#10B981' }}>
                          {res.rental_price ? `฿${res.rental_price.toLocaleString()} / mo` : res.sale_price ? `฿${res.sale_price.toLocaleString()}` : 'Not provided'}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>Building & Floor</div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {res.building ? `Tower ${res.building}` : ''} {res.floor ? `· Fl. ${res.floor}` : (!res.building ? 'Not specified' : '')}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>Room Size</div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {res.size_sqm ? `${res.size_sqm} sqm` : 'Not stated'}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>Bed / Bath</div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {res.bedrooms !== null && res.bedrooms !== undefined ? (res.bedrooms === 0 ? 'Studio' : `${res.bedrooms} Bed`) : 'Not stated'}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>Parking</div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {res.parking || 'Not specified'}
                        </div>
                      </div>
                    </div>

                    {/* Additional Details */}
                    {(res.furniture || res.contact_info) && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.75rem' }}>
                        {res.furniture && (
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Furniture: </span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{res.furniture}</span>
                          </div>
                        )}
                        {res.contact_info && (
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Contact: </span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{res.contact_info}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* AI Evidence Quote */}
                    {res.evidence && (
                      <div
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          backgroundColor: isDark ? 'rgba(59, 130, 246, 0.08)' : '#EFF6FF',
                          borderLeft: '3px solid #3B82F6',
                          fontSize: '0.75rem',
                        }}
                      >
                        <span style={{ fontWeight: 600, color: '#3B82F6' }}>AI Evidence: </span>
                        <span style={{ color: 'var(--text-primary)', fontStyle: 'italic' }}>"{res.evidence}"</span>
                        {res.reasons && (
                          <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {res.reasons}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Missing Info if any */}
                    {res.missing_info && (
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                        Notice: {res.missing_info}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW 3: Standard Input Form (ONE Large Textarea) */}
          {!isAnalyzing && !results && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Header with Quick Sample Buttons */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Paste Facebook Post Content
                </label>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => handleLoadSample(SAMPLE_SINGLE_POST)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF',
                      color: '#3B82F6',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      cursor: 'pointer',
                    }}
                    title="Load sample single direct owner post"
                  >
                    <FiZap size={11} />
                    <span>Load Sample</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLoadSample(SAMPLE_MULTI_POST)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
                      color: '#10B981',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      cursor: 'pointer',
                    }}
                    title="Load 3 sample posts to test multi-post segmentation"
                  >
                    <FiLayers size={11} />
                    <span>Load Multi-Post Sample</span>
                  </button>
                </div>
              </div>

              {/* The One Main Textarea */}
              <div style={{ position: 'relative' }}>
                <textarea
                  rows={9}
                  value={rawContent}
                  onChange={(e) => setRawContent(e.target.value)}
                  placeholder="Paste your Facebook post here... You can paste Thai or English text, advertisements, property descriptions, prices, contact details, or multiple posts."
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                    backgroundColor: isDark ? '#0D1117' : '#FFFFFF',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    lineHeight: '1.6',
                    outline: 'none',
                    minHeight: '200px',
                  }}
                  autoFocus
                />

                {/* Counter & Detection Badge */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '6px',
                    fontSize: '0.6875rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <span>
                    {rawContent.length} characters · {rawContent.trim() ? rawContent.trim().split(/\s+/).length : 0} words
                  </span>
                  {detectedPostCount > 1 && (
                    <span style={{ color: '#10B981', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <FiLayers size={11} />
                      <span>{detectedPostCount} separate posts detected</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Helper notice */}
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: isDark ? '#0D1117' : '#F8FAFC',
                  border: isDark ? '1px solid #21262D' : '1px solid #E2E8F0',
                  fontSize: '0.6875rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <FiShield size={12} style={{ color: '#3B82F6', flexShrink: 0 }} />
                <span>
                  No login required. AI reads Thai and English, extracts prices and room specs, classifies owner vs agent, and checks monitored condominiums.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '0.875rem 1.25rem',
            borderTop: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            backgroundColor: isDark ? '#0D1117' : '#F8FAFC',
          }}
        >
          {results ? (
            <>
              <button
                type="button"
                onClick={handleResetForAnother}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '6px',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  backgroundColor: isDark ? '#21262D' : '#E2E8F0',
                  color: 'var(--text-primary)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <FiRefreshCw size={13} />
                <span>Analyze Another Post</span>
              </button>

              <button
                type="button"
                onClick={handleFinishAndClose}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 18px',
                  borderRadius: '6px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  backgroundColor: 'var(--accent-primary, #3B82F6)',
                  color: '#FFFFFF',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <FiCheck size={14} />
                <span>Done / View in Property Leads</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '7px 16px',
                  borderRadius: '6px',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  backgroundColor: isDark ? '#21262D' : '#E2E8F0',
                  color: 'var(--text-primary)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleAnalyze()}
                disabled={isAnalyzing || !rawContent.trim()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 20px',
                  borderRadius: '6px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  backgroundColor: isAnalyzing || !rawContent.trim() ? '#4B5563' : 'var(--accent-primary, #3B82F6)',
                  color: '#FFFFFF',
                  border: 'none',
                  cursor: isAnalyzing || !rawContent.trim() ? 'not-allowed' : 'pointer',
                  boxShadow: !isAnalyzing && rawContent.trim() ? '0 2px 8px rgba(59, 130, 246, 0.4)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {isAnalyzing ? (
                  <>
                    <FiLoader size={15} style={{ animation: 'spin 1.2s linear infinite' }} />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <FiZap size={15} />
                    <span>Analyze & Find Properties</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
