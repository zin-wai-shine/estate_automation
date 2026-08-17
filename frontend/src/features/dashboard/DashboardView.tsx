import React from 'react';
import type { Property } from '../../types';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { FiPlus, FiClock, FiCheckCircle, FiSend, FiArrowRight } from 'react-icons/fi';

interface DashboardViewProps {
  properties: Property[];
  onNavigateTab: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  properties,
  onNavigateTab,
}) => {
  const newCount = properties.filter((p) => p.status === 'NEW').length;
  const processingCount = properties.filter((p) => p.status === 'PROCESSING' || p.status === 'IMPORTING').length;
  const reviewCount = properties.filter((p) => p.status === 'READY_FOR_REVIEW').length;
  const publishedCount = properties.filter((p) => p.status === 'PUBLISHED').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Operational Dashboard Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
        <div
          onClick={() => onNavigateTab('add-url')}
          style={{
            padding: '1rem',
            borderRadius: '0.5rem',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>New Properties</span>
            <FiPlus style={{ color: 'var(--accent-primary)' }} />
          </div>
          <h3 style={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.375rem' }}>
            {newCount}
          </h3>
        </div>

        <div
          onClick={() => onNavigateTab('inbox')}
          style={{
            padding: '1rem',
            borderRadius: '0.5rem',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Processing</span>
            <FiClock style={{ color: 'var(--status-info)' }} />
          </div>
          <h3 style={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--status-info)', marginTop: '0.375rem' }}>
            {processingCount}
          </h3>
        </div>

        <div
          onClick={() => onNavigateTab('review')}
          style={{
            padding: '1rem',
            borderRadius: '0.5rem',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Ready for Review</span>
            <FiCheckCircle style={{ color: 'var(--status-warning)' }} />
          </div>
          <h3 style={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--status-warning)', marginTop: '0.375rem' }}>
            {reviewCount}
          </h3>
        </div>

        <div
          style={{
            padding: '1rem',
            borderRadius: '0.5rem',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Published</span>
            <FiSend style={{ color: 'var(--status-success)' }} />
          </div>
          <h3 style={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--status-success)', marginTop: '0.375rem' }}>
            {publishedCount}
          </h3>
        </div>
      </div>

      {/* Recent Properties Overview Table */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: '0.5rem',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '0.875rem 1.25rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Recent Properties Activity
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Latest collected property posts and their pipeline progress</p>
          </div>
          <Button variant="ghost" size="sm" rightIcon={<FiArrowRight />} onClick={() => onNavigateTab('inbox')}>
            View All Inbox
          </Button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontWeight: 600 }}>
                <th style={{ padding: '0.625rem 1rem' }}>Code</th>
                <th style={{ padding: '0.625rem 1rem' }}>Title / Project</th>
                <th style={{ padding: '0.625rem 1rem' }}>Price</th>
                <th style={{ padding: '0.625rem 1rem' }}>Type</th>
                <th style={{ padding: '0.625rem 1rem' }}>Status</th>
                <th style={{ padding: '0.625rem 1rem', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {properties.slice(0, 5).map((property) => (
                <tr key={property.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                    {property.code}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)' }}>
                    <div>
                      <p style={{ fontWeight: 500 }}>{property.title || 'Untitled Listing'}</p>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                        {property.projectName || 'Unassigned Project'}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)' }}>
                    {property.rentPrice ? `฿${property.rentPrice.toLocaleString()} / mo` : 'N/A'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                    {property.propertyType ? property.propertyType.charAt(0).toUpperCase() + property.propertyType.slice(1).toLowerCase() : 'Condo'}{' '}
                    ({property.listingType ? property.listingType.charAt(0).toUpperCase() + property.listingType.slice(1).toLowerCase() : 'Rent'})
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <Badge variant={property.status === 'NEW' ? 'info' : property.status === 'READY_FOR_REVIEW' ? 'warning' : property.status === 'PUBLISHED' ? 'success' : 'outline'}>
                      {property.status}
                    </Badge>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    {property.status === 'READY_FOR_REVIEW' ? (
                      <Button variant="primary" size="sm" onClick={() => onNavigateTab('review')}>
                        Review & Approve
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => onNavigateTab('inbox')}>
                        View Details
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
