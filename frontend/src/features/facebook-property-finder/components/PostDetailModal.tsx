import React, { useState } from 'react';
import {
  FiX,
  FiExternalLink,
  FiCheckCircle,
  FiAlertTriangle,
  FiUserCheck,
  FiUserX,
  FiHelpCircle,
  FiRefreshCw,
  FiTrash2,
  FiHome,
  FiDollarSign,
  FiMaximize2,
  FiPhone,
  FiInfo,
} from 'react-icons/fi';
import type { FinderPost } from '../types';
import { analyzeFinderPost } from '../propertyFinderService';

interface PostDetailModalProps {
  post: FinderPost | null;
  isOpen: boolean;
  onClose: () => void;
  onPostUpdated: () => void;
  onDeletePost: (id: number) => void;
  isDark?: boolean;
}

export const PostDetailModal: React.FC<PostDetailModalProps> = ({
  post,
  isOpen,
  onClose,
  onPostUpdated,
  onDeletePost,
  isDark = true,
}) => {
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !post) return null;

  const analysis = post.analysis;

  const handleReanalyze = async () => {
    setIsReanalyzing(true);
    setErrorMsg(null);
    try {
      await analyzeFinderPost(post.id);
      onPostUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Analysis failed');
    } finally {
      setIsReanalyzing(false);
    }
  };

  let imageUrls: string[] = [];
  try {
    if (post.images) {
      imageUrls = JSON.parse(post.images);
    }
  } catch (_) {}

  // Classification styling
  const getClassificationBadge = (cls?: string) => {
    switch (cls) {
      case 'OWNER_CLAIMED':
        return {
          label: 'Direct Owner Claimed',
          color: '#10B981',
          bg: 'rgba(16, 185, 129, 0.12)',
          border: 'rgba(16, 185, 129, 0.3)',
          icon: <FiUserCheck size={16} />,
          desc: 'Post explicitly states direct owner without agent representation.',
        };
      case 'LIKELY_OWNER':
        return {
          label: 'Likely Direct Owner',
          color: '#3B82F6',
          bg: 'rgba(59, 130, 246, 0.12)',
          border: 'rgba(59, 130, 246, 0.3)',
          icon: <FiCheckCircle size={16} />,
          desc: 'High probability of individual unit owner based on language and single unit context.',
        };
      case 'AGENT':
        return {
          label: 'Real Estate Agent',
          color: '#F59E0B',
          bg: 'rgba(245, 158, 11, 0.12)',
          border: 'rgba(245, 158, 11, 0.3)',
          icon: <FiUserX size={16} />,
          desc: 'Agent wording detected (รับฝากขาย/เช่า, co-agent welcome, multiple units).',
        };
      case 'PROPERTY_AGENCY':
        return {
          label: 'Property Agency / Broker',
          color: '#EF4444',
          bg: 'rgba(239, 68, 68, 0.12)',
          border: 'rgba(239, 68, 68, 0.3)',
          icon: <FiAlertTriangle size={16} />,
          desc: 'Commercial corporate brokerage or property agency catalog posting.',
        };
      default:
        return {
          label: 'Unclear Classification',
          color: '#94A3B8',
          bg: 'rgba(148, 163, 184, 0.12)',
          border: 'rgba(148, 163, 184, 0.3)',
          icon: <FiHelpCircle size={16} />,
          desc: 'Insufficient contextual wording to determine owner vs agent status conclusively.',
        };
    }
  };

  const badgeInfo = getClassificationBadge(analysis?.owner_classification);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
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
          maxWidth: '850px',
          maxHeight: '90vh',
          backgroundColor: isDark ? '#161B22' : '#FFFFFF',
          borderRadius: '12px',
          border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 0.15s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
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
          <div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              {post.project?.project_name || analysis?.project_name || 'Property Lead Details'}
            </h2>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Source: {post.source_group || 'Facebook Group'} · Author: {post.author_display_name || 'Anonymous'} · Collected {new Date(post.collected_at).toLocaleString()}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {post.post_url && (
              <a
                href={post.post_url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  borderRadius: '6px',
                  backgroundColor: 'var(--accent-primary-alpha)',
                  color: 'var(--accent-primary)',
                  textDecoration: 'none',
                  border: '1px solid var(--accent-primary)',
                }}
              >
                <span>Original Post</span>
                <FiExternalLink size={12} />
              </a>
            )}
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <FiX size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {errorMsg && (
            <div style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', fontSize: '0.8125rem' }}>
              {errorMsg}
            </div>
          )}

          {/* Classification Banner */}
          <div
            style={{
              padding: '1rem',
              borderRadius: '8px',
              backgroundColor: badgeInfo.bg,
              border: `1px solid ${badgeInfo.border}`,
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{ color: badgeInfo.color, marginTop: '2px' }}>{badgeInfo.icon}</div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: badgeInfo.color }}>
                    {badgeInfo.label}
                  </span>
                  {analysis?.confidence !== undefined && (
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: '10px',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.8)',
                        color: badgeInfo.color,
                      }}
                    >
                      {(analysis.confidence * 100).toFixed(0)}% Confidence
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
                  {badgeInfo.desc}
                </p>
                {analysis?.reasons && (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', marginTop: '6px', margin: 0 }}>
                    <strong>AI Reason:</strong> {analysis.reasons}
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={handleReanalyze}
              disabled={isReanalyzing}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 500,
                backgroundColor: isDark ? '#21262D' : '#F1F5F9',
                color: 'var(--text-primary)',
                border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                cursor: isReanalyzing ? 'not-allowed' : 'pointer',
                flexShrink: 0,
              }}
            >
              <FiRefreshCw size={12} className={isReanalyzing ? 'animate-spin' : ''} />
              <span>{isReanalyzing ? 'Analyzing...' : 'Re-Analyze AI'}</span>
            </button>
          </div>

          {/* Evidence Highlight */}
          {analysis?.evidence && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '6px',
                backgroundColor: isDark ? '#0D1117' : '#F8FAFC',
                borderLeft: '4px solid #3B82F6',
              }}
            >
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', color: '#3B82F6', letterSpacing: '0.05em' }}>
                Classification Evidence From Original Post
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', marginTop: '4px', fontStyle: 'italic' }}>
                "{analysis.evidence}"
              </div>
            </div>
          )}

          {/* Property Specifications Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '10px',
            }}
          >
            <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: isDark ? '#21262D' : '#F8FAFC', border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Listing Type</div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                {analysis?.listing_type || 'Unclear'}
              </div>
            </div>

            <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: isDark ? '#21262D' : '#F8FAFC', border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Price</div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#10B981', marginTop: '2px' }}>
                {analysis?.rental_price ? `฿${analysis.rental_price.toLocaleString()} / mo` : analysis?.sale_price ? `฿${analysis.sale_price.toLocaleString()}` : 'N/A'}
              </div>
            </div>

            <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: isDark ? '#21262D' : '#F8FAFC', border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Room Size</div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                {analysis?.size_sqm ? `${analysis.size_sqm} sq.m` : 'N/A'}
              </div>
            </div>

            <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: isDark ? '#21262D' : '#F8FAFC', border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Bedrooms / Floor</div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                {analysis?.bedrooms !== null && analysis?.bedrooms !== undefined ? (analysis.bedrooms === 0 ? 'Studio' : `${analysis.bedrooms} Bed`) : 'N/A'}
                {analysis?.floor ? ` · ${analysis.floor}` : ''}
              </div>
            </div>

            <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: isDark ? '#21262D' : '#F8FAFC', border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0', gridColumn: 'span 2' }}>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Contact Information</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', marginTop: '2px' }}>
                {analysis?.contact_info || 'Not explicitly provided'}
              </div>
            </div>
          </div>

          {/* Full Original Post Text */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Full Original Post Content
            </label>
            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: isDark ? '#0D1117' : '#F8FAFC',
                border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                fontSize: '0.8125rem',
                lineHeight: '1.6',
                color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap',
                maxHeight: '220px',
                overflowY: 'auto',
              }}
            >
              {post.post_text || 'No text content'}
            </div>
          </div>

          {/* Attached Images */}
          {imageUrls.length > 0 && (
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Attached Advertising Media ({imageUrls.length} Photos)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
                {imageUrls.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      position: 'relative',
                      aspectRatio: '4/3',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                      display: 'block',
                    }}
                  >
                    <img src={url} alt={`Photo #${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* OCR Result if available */}
          {analysis?.ocr_text && (
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Extracted Poster Text (OCR)
              </label>
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: isDark ? '#0D1117' : '#F1F5F9',
                  border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {analysis.ocr_text}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '0.875rem 1.25rem',
            borderTop: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: isDark ? '#0D1117' : '#F8FAFC',
          }}
        >
          <button
            onClick={() => {
              if (window.confirm('Delete this post and its analysis?')) {
                onDeletePost(post.id);
                onClose();
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 500,
              backgroundColor: 'transparent',
              color: '#EF4444',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              cursor: 'pointer',
            }}
          >
            <FiTrash2 size={13} />
            <span>Delete Lead</span>
          </button>

          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 500,
              backgroundColor: isDark ? '#21262D' : '#E2E8F0',
              color: 'var(--text-primary)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

