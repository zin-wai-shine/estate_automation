import React, { useMemo } from 'react';
import { FiX, FiDownload, FiImage } from 'react-icons/fi';

export interface CombineMediaAssetItem {
  id: string;
  url: string;
  label: string;
  formatTitle: string;
  photoIndex: number;
  tileIndex: number;
  totalTiles: number;
  isEnhanced: boolean;
  formatId: string;
}

export interface ConnectedImageFormatNode {
  id: string;
  title: string;
  count: number;
}

interface CombineMediaSideboxProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  combineMediaAssets: CombineMediaAssetItem[];
  connectedImageNodes: ConnectedImageFormatNode[];
  activeFilter: string; // 'all' or formatId
  onFilterChange?: (formatId: string) => void;
  onOpenLightbox: (url: string) => void;
  onDownloadImage: (url: string, index: number, e?: React.MouseEvent) => void;
  onDownloadAllImages: (assets: CombineMediaAssetItem[]) => void;
}

export const CombineMediaSidebox: React.FC<CombineMediaSideboxProps> = ({
  isOpen,
  onClose,
  isDark,
  combineMediaAssets,
  connectedImageNodes,
  activeFilter,
  onOpenLightbox,
  onDownloadImage,
  onDownloadAllImages,
}) => {
  const filteredAssets = useMemo(() => {
    if (activeFilter === 'all') return combineMediaAssets;
    return combineMediaAssets.filter((a) => a.formatId === activeFilter);
  }, [activeFilter, combineMediaAssets]);

  const currentFormatNode = useMemo(() => {
    return connectedImageNodes.find((n) => n.id === activeFilter);
  }, [activeFilter, connectedImageNodes]);

  const activeTitle = currentFormatNode
    ? currentFormatNode.title
    : (filteredAssets[0]?.formatTitle || 'Processed Media Assets');

  if (!isOpen) return null;

  return (
    <div
      className="workflow-sidebar"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: 0,
        bottom: 0,
        right: '380px', // sits cleanly alongside the 380px main sidebar
        width: '520px',
        maxWidth: 'calc(100vw - 420px)',
        backgroundColor: isDark ? 'var(--bg-main)' : '#FFFFFF',
        borderLeft: '1px solid var(--border-color)',
        borderRight: '1px solid var(--border-color)',
        boxShadow: isDark ? '-12px 0 35px rgba(0, 0, 0, 0.75)' : '-6px 0 24px rgba(0, 0, 0, 0.08)',
        zIndex: 169,
        display: 'flex',
        flexDirection: 'column',
        animation: 'sidebarSlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* ── Top Header ────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '0.875rem 1.125rem',
          height: '62px',
          boxSizing: 'border-box',
          borderBottom: isDark ? '1px solid #21262D' : '1px solid #E2E8F0',
          backgroundColor: isDark ? 'var(--bg-main)' : '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
              border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <FiImage size={16} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <span
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {activeTitle}
              </span>
              <span
                style={{
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                  border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {filteredAssets.length} photos ready
              </span>
            </div>
            <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Formatted & Watermarked Output
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {filteredAssets.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDownloadAllImages(filteredAssets);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                height: '28px',
                padding: '0 10px',
                fontSize: '0.6875rem',
                fontWeight: 600,
                borderRadius: '6px',
                border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(0, 0, 0, 0.08)';
                e.currentTarget.style.borderColor = isDark ? '#484F58' : '#CBD5E1';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
                e.currentTarget.style.borderColor = isDark ? '#30363D' : '#E2E8F0';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <FiDownload size={12} />
              <span>Download All</span>
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(0, 0, 0, 0.08)';
              e.currentTarget.style.borderColor = isDark ? '#484F58' : '#CBD5E1';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
              e.currentTarget.style.borderColor = isDark ? '#30363D' : '#E2E8F0';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <FiX size={14} style={{ pointerEvents: 'none' }} />
          </button>
        </div>
      </div>



      {/* ── Scrollable Photo Grid ────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1rem',
        }}
      >
        {filteredAssets.length === 0 ? (
          <div
            style={{
              padding: '3rem 1rem',
              textAlign: 'center',
              color: 'var(--text-muted)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <FiImage size={36} style={{ opacity: 0.35 }} />
            <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>No Photos Processed Yet</div>
            <div style={{ fontSize: '0.6875rem', maxWidth: '280px' }}>
              Run the workflow to generate formatted and watermarked media assets for this combine box.
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
            }}
          >
            {filteredAssets.map((asset, idx) => (
              <div
                key={asset.id}
                onClick={() => onOpenLightbox(asset.url)}
                style={{
                  position: 'relative',
                  width: '100%',
                  paddingTop: '125%', // 4:5 portrait ratio standard for property listings
                  borderRadius: '8px',
                  overflow: 'hidden',
                  backgroundColor: isDark ? '#0D1117' : '#F1F5F9',
                  border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                  cursor: 'pointer',
                  transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.25)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                }}
              >
                <div style={{ position: 'absolute', inset: 0 }}>
                  <img
                    src={asset.url}
                    alt={asset.label}
                    loading="lazy"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />

                  {/* Top Overlay Gradient for readability */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '32px',
                      background: 'linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)',
                      pointerEvents: 'none',
                    }}
                  />

                  {/* 1-Click Download Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownloadImage(asset.url, idx, e);
                    }}
                    title={`Download ${asset.label}`}
                    aria-label={`Download ${asset.label}`}
                    style={{
                      position: 'absolute',
                      top: '4px',
                      left: '4px',
                      width: '22px',
                      height: '22px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(0, 0, 0, 0.65)',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      zIndex: 3,
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#3B82F6';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.65)';
                    }}
                  >
                    <FiDownload size={11} />
                  </button>

                  {/* Enhanced badge */}
                  {asset.isEnhanced && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        fontSize: '0.45rem',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '3px',
                        backgroundColor: '#10B981',
                        color: '#FFFFFF',
                        letterSpacing: '0.04em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                        zIndex: 2,
                      }}
                    >
                      <span>✦ ENH</span>
                    </div>
                  )}

                  {/* Bottom Gradient Overlay */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '28px',
                      background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Photo Label Badge */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '4px',
                      left: '4px',
                      fontSize: '0.5rem',
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: '3px',
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      color: '#FFFFFF',
                      backdropFilter: 'blur(3px)',
                    }}
                  >
                    {asset.label}
                  </div>

                  {/* Tile badge if multi-tile cut */}
                  {asset.totalTiles > 1 && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '4px',
                        right: '4px',
                        fontSize: '0.45rem',
                        fontWeight: 700,
                        padding: '1px 4px',
                        borderRadius: '2px',
                        backgroundColor: 'rgba(59, 130, 246, 0.85)',
                        color: '#FFFFFF',
                      }}
                    >
                      {asset.tileIndex}/{asset.totalTiles}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Bottom Summary Footer ────────────────────────────────────────────── */}
      <div
        style={{
          padding: '0.75rem 1.125rem',
          borderTop: isDark ? '1px solid #21262D' : '1px solid #E2E8F0',
          backgroundColor: isDark ? 'var(--bg-main)' : '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
          {filteredAssets.length} photos ready
        </span>

        <button
          type="button"
          onClick={() => {
            if (filteredAssets.length > 0) {
              onOpenLightbox(filteredAssets[0].url);
            }
          }}
          disabled={filteredAssets.length === 0}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            height: '28px',
            padding: '0 12px',
            fontSize: '0.6875rem',
            fontWeight: 600,
            borderRadius: '6px',
            border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
            color: 'var(--text-primary)',
            cursor: filteredAssets.length === 0 ? 'not-allowed' : 'pointer',
            opacity: filteredAssets.length === 0 ? 0.5 : 1,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (filteredAssets.length > 0) {
              e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(0, 0, 0, 0.08)';
              e.currentTarget.style.borderColor = isDark ? '#484F58' : '#CBD5E1';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
            e.currentTarget.style.borderColor = isDark ? '#30363D' : '#E2E8F0';
          }}
        >
          <span>Open Fullscreen Gallery</span>
        </button>
      </div>
    </div>
  );
};
