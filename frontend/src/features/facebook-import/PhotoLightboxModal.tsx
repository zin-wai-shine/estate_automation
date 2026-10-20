import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  FiX,
  FiChevronLeft,
  FiChevronRight,
  FiZoomIn,
  FiZoomOut,
  FiRotateCw,
  FiDownload,
  FiMaximize2,
  FiImage,
} from 'react-icons/fi';

export interface PhotoLightboxItem {
  index: number;
  url: string;
  name?: string;
  width?: number;
  height?: number;
}

export interface PhotoLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  photos: PhotoLightboxItem[];
  initialIndex?: number;
  title?: string;
  formatSubtitle?: string;
}

export const PhotoLightboxModal: React.FC<PhotoLightboxModalProps> = ({
  isOpen,
  onClose,
  photos,
  initialIndex = 0,
  title = 'Photo Preview',
  formatSubtitle,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setZoom(1);
      setRotation(0);
    }
  }, [isOpen, initialIndex]);

  const currentPhoto = photos[currentIndex] || photos[0];
  const total = photos.length;

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : total - 1));
    setZoom(1);
    setRotation(0);
  }, [total]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < total - 1 ? prev + 1 : 0));
    setZoom(1);
    setRotation(0);
  }, [total]);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  const handleDownload = () => {
    if (!currentPhoto?.url) return;
    const a = document.createElement('a');
    a.href = currentPhoto.url;
    a.download = `photo-${currentIndex + 1}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handlePrev, handleNext, onClose]);

  if (!isOpen || !currentPhoto) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(5, 8, 15, 0.94)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        animation: 'fadeIn 0.18s ease',
      }}
      onClick={onClose}
    >
      {/* Top Header Bar */}
      <div
        style={{
          height: '60px',
          padding: '0 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(13, 17, 23, 0.8)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          zIndex: 10,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
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
              flexShrink: 0,
            }}
          >
            <FiImage size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#FFFFFF' }}>
                {title}
              </span>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#10B981',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}
              >
                Photo {currentIndex + 1} of {total}
              </span>
            </div>
            {formatSubtitle && (
              <div style={{ fontSize: '0.6875rem', color: '#94A3B8', marginTop: '2px' }}>
                {formatSubtitle}
              </div>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom Out"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FiZoomOut size={16} />
          </button>
          <span
            style={{
              fontSize: '0.75rem',
              color: '#CBD5E1',
              fontFamily: 'monospace',
              minWidth: '45px',
              textAlign: 'center',
            }}
          >
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom In"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FiZoomIn size={16} />
          </button>

          <button
            type="button"
            onClick={handleRotate}
            title="Rotate 90°"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '4px',
            }}
          >
            <FiRotateCw size={15} />
          </button>

          <button
            type="button"
            onClick={handleDownload}
            title="Download Full Image"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FiDownload size={15} />
          </button>

          <div style={{ width: '1px', height: '22px', backgroundColor: 'rgba(255, 255, 255, 0.15)', margin: '0 6px' }} />

          <button
            type="button"
            onClick={onClose}
            title="Close Lightbox (Esc)"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '6px',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#EF4444',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FiX size={18} />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          padding: '1.5rem',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Previous Button */}
        {total > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            title="Previous Photo (Left Arrow)"
            style={{
              position: 'absolute',
              left: '20px',
              zIndex: 20,
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              backgroundColor: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(8px)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.8)';
              e.currentTarget.style.transform = 'scale(1.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.75)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <FiChevronLeft size={24} />
          </button>
        )}

        {/* Display Image */}
        <div
          style={{
            position: 'relative',
            maxHeight: '74vh',
            maxWidth: '85vw',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
            transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={currentPhoto.url}
            alt={`Photo #${currentIndex + 1}`}
            style={{
              maxHeight: '74vh',
              maxWidth: '85vw',
              objectFit: 'contain',
              borderRadius: '8px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1)',
              display: 'block',
            }}
          />
        </div>

        {/* Next Button */}
        {total > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            title="Next Photo (Right Arrow)"
            style={{
              position: 'absolute',
              right: '20px',
              zIndex: 20,
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              backgroundColor: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(8px)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.8)';
              e.currentTarget.style.transform = 'scale(1.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.75)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <FiChevronRight size={24} />
          </button>
        )}
      </div>

      {/* Bottom Thumbnails Strip */}
      {total > 1 && (
        <div
          style={{
            height: '84px',
            padding: '10px 1.5rem',
            backgroundColor: 'rgba(13, 17, 23, 0.85)',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            overflowX: 'auto',
            zIndex: 10,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {photos.map((p, idx) => {
            const isActive = idx === currentIndex;
            return (
              <div
                key={`thumb-${p.index}-${idx}`}
                onClick={() => {
                  setCurrentIndex(idx);
                  setZoom(1);
                  setRotation(0);
                }}
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  flexShrink: 0,
                  border: isActive ? '2px solid #3B82F6' : '1px solid rgba(255, 255, 255, 0.15)',
                  opacity: isActive ? 1 : 0.6,
                  transform: isActive ? 'scale(1.06)' : 'scale(1)',
                  boxShadow: isActive ? '0 0 12px rgba(59, 130, 246, 0.5)' : 'none',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                  backgroundColor: '#000000',
                }}
              >
                <img
                  src={p.url}
                  alt={`Thumb #${idx + 1}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: '1px',
                    left: '1px',
                    fontSize: '0.5rem',
                    fontWeight: 700,
                    padding: '1px 3px',
                    borderRadius: '2px',
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    color: '#FFFFFF',
                  }}
                >
                  #{idx + 1}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>,
    document.body
  );
};
