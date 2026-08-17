import React, { useState } from 'react';
import type { Property } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { FiCheckCircle, FiXCircle, FiRefreshCw, FiCheck, FiFacebook, FiVideo, FiImage } from 'react-icons/fi';

interface ReviewCenterViewProps {
  properties: Property[];
  onApproveProperty: (id: number) => void;
  onRejectProperty: (id: number) => void;
}

export const ReviewCenterView: React.FC<ReviewCenterViewProps> = ({
  properties,
  onApproveProperty,
  onRejectProperty,
}) => {
  const readyProperty = properties.find((p) => p.status === 'READY_FOR_REVIEW') || properties[0];

  const [activeTab, setActiveTab] = useState<'facebook' | 'tiktok'>('facebook');
  const [fbTitle, setFbTitle] = useState(readyProperty?.fbContent?.title || 'Luxury 1-Bed Condo at Ashton Asoke for Rent');
  const [fbPrice, setFbPrice] = useState(readyProperty?.fbContent?.price || '฿35,000 / month');
  const [fbDescription, setFbDescription] = useState(
    readyProperty?.fbContent?.description ||
      'Beautiful fully furnished 1-bedroom condo on 28th floor with spectacular city view. 35 sqm, fully equipped kitchen, high-speed WiFi, close to BTS Asoke & MRT Sukhumvit.'
  );
  const [tikTokHook, setTikTokHook] = useState(readyProperty?.tikTokContent?.hook || 'Looking for your dream condo in Asoke? Check this out! 🔥');
  const [isApproved, setIsApproved] = useState(readyProperty?.status === 'APPROVED');
  const [showNotification, setShowNotification] = useState('');

  if (!readyProperty) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <p>No properties currently waiting for human approval.</p>
      </div>
    );
  }

  const handleApprove = () => {
    onApproveProperty(readyProperty.id);
    setIsApproved(true);
    setShowNotification('Property Approved! Queued for Facebook & TikTok publishing.');
    setTimeout(() => setShowNotification(''), 4000);
  };

  const handleRegenerate = () => {
    setFbTitle('Prime Ashton Asoke Condo - 1BR Modern High-Floor Unit');
    setTikTokHook('Living in Asoke has never looked this good! 🏙️✨');
    setShowNotification('Regenerated AI Facebook & TikTok copy successfully!');
    setTimeout(() => setShowNotification(''), 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Clean Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {readyProperty.code} — {readyProperty.projectName || readyProperty.title}
            </h3>
            <Badge variant="warning">{readyProperty.status}</Badge>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Human Approval Gate — Review metadata, AI copy, and image sequence before publishing
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button variant="outline" size="sm" leftIcon={<FiRefreshCw />} onClick={handleRegenerate}>
            Regenerate AI
          </Button>
          <Button variant="outline" size="sm" leftIcon={<FiXCircle />} onClick={() => onRejectProperty(readyProperty.id)}>
            Reject
          </Button>
          <Button variant="primary" size="sm" leftIcon={<FiCheckCircle />} onClick={handleApprove} disabled={isApproved}>
            {isApproved ? 'Approved & Queued' : 'Approve & Publish'}
          </Button>
        </div>
      </div>

      {showNotification && (
        <div
          style={{
            padding: '0.625rem 0.875rem',
            borderRadius: '0.375rem',
            backgroundColor: 'var(--status-success-bg)',
            color: 'var(--status-success)',
            fontSize: '0.8125rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
          }}
        >
          <FiCheck /> {showNotification}
        </div>
      )}

      {/* Clean Inline Validation Strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1.25rem',
          flexWrap: 'wrap',
          padding: '0.625rem 1rem',
          borderRadius: '0.375rem',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          fontSize: '0.75rem',
        }}
      >
        <span style={{ fontWeight: 600, color: 'var(--status-success)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <FiCheck /> Automated Validation: Pass
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>• Project Assets Linked (2 images)</span>
        <span style={{ color: 'var(--text-secondary)' }}>• Min 3 Listing Images</span>
        <span style={{ color: 'var(--text-secondary)' }}>• Watermark Applied</span>
        <span style={{ color: 'var(--text-secondary)' }}>• Rent/Sale Price Validated</span>
      </div>

      {/* 2-Column Uncluttered Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
        {/* Left Column: AI Content Copy Editor with Tabs */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: '0.5rem',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {/* Segmented Tab Switcher */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', gap: '0.5rem' }}>
            <button
              onClick={() => setActiveTab('facebook')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.375rem 0.75rem',
                borderRadius: '0.25rem',
                fontSize: '0.8125rem',
                fontWeight: activeTab === 'facebook' ? 600 : 500,
                color: activeTab === 'facebook' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                backgroundColor: activeTab === 'facebook' ? 'var(--bg-surface-hover)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <FiFacebook /> Facebook Post Copy
            </button>
            <button
              onClick={() => setActiveTab('tiktok')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.375rem 0.75rem',
                borderRadius: '0.25rem',
                fontSize: '0.8125rem',
                fontWeight: activeTab === 'tiktok' ? 600 : 500,
                color: activeTab === 'tiktok' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                backgroundColor: activeTab === 'tiktok' ? 'var(--bg-surface-hover)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <FiVideo /> TikTok Script & Caption
            </button>
          </div>

          {activeTab === 'facebook' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <Input label="Post Title" value={fbTitle} onChange={(e) => setFbTitle(e.target.value)} />
              <Input label="Listing Price" value={fbPrice} onChange={(e) => setFbPrice(e.target.value)} />
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Post Description
                </label>
                <textarea
                  rows={4}
                  value={fbDescription}
                  onChange={(e) => setFbDescription(e.target.value)}
                  style={{
                    width: '100%',
                    marginTop: '0.25rem',
                    padding: '0.5rem 0.75rem',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '0.375rem',
                    outline: 'none',
                    fontSize: '0.8125rem',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <Input label="Video Hook" value={tikTokHook} onChange={(e) => setTikTokHook(e.target.value)} />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Hashtags: #AshtonAsoke #BangkokCondo #CondoForRent #BangkokProperty
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Clean Image Order Preview */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: '0.5rem',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Final Image Order (5 Images)
            </h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Project images placed first</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.625rem' }}>
            {[1, 2, 3, 4, 5].map((idx) => (
              <div
                key={idx}
                style={{
                  height: '96px',
                  borderRadius: '0.375rem',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                }}
              >
                <FiImage style={{ fontSize: '1.125rem', color: 'var(--accent-primary)', marginBottom: '0.25rem' }} />
                <span>{idx <= 2 ? `Project Image ${idx}` : `Property Image ${idx - 2}`}</span>
                <span style={{ fontSize: '0.625rem', color: 'var(--status-success)', marginTop: '0.125rem', display: 'inline-flex', alignItems: 'center', gap: '0.125rem' }}>
                  <FiCheck style={{ fontSize: '0.625rem' }} /> Watermarked
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
