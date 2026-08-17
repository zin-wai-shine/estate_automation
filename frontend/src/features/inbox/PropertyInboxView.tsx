import React, { useState } from 'react';
import type { Property } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { FiSearch, FiPlay, FiCheckCircle, FiExternalLink, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

interface PropertyInboxViewProps {
  properties: Property[];
  onProcessProperty: (id: number) => void;
  onNavigateTab: (tab: string) => void;
}

export const PropertyInboxView: React.FC<PropertyInboxViewProps> = ({
  properties,
  onProcessProperty,
  onNavigateTab,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const statusOptions = [
    { value: 'ALL', label: 'All Statuses' },
    { value: 'NEW', label: 'New' },
    { value: 'PROCESSING', label: 'Processing' },
    { value: 'READY_FOR_REVIEW', label: 'Ready for Review' },
    { value: 'PUBLISHED', label: 'Published' },
  ];

  const typeOptions = [
    { value: 'ALL', label: 'All Listing Types' },
    { value: 'RENT', label: 'Rent' },
    { value: 'SALE', label: 'Sale' },
  ];

  const filtered = properties.filter((p) => {
    const matchesSearch =
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.projectName && p.projectName.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    const matchesType = typeFilter === 'ALL' || p.listingType === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Clean Filter Bar (No container background or border, compact search width, React Select dropdowns) */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.625rem',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.25rem 0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
          {/* Reduced Width Search Input */}
          <div style={{ width: '260px' }}>
            <Input
              placeholder="Search by code, title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<FiSearch />}
            />
          </div>

          {/* Custom React Select Box - Statuses */}
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={setStatusFilter}
            width="170px"
          />

          {/* Custom React Select Box - Listing Types */}
          <Select
            options={typeOptions}
            value={typeFilter}
            onChange={setTypeFilter}
            width="160px"
          />
        </div>

        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Showing <strong>{filtered.length}</strong> items
        </span>
      </div>

      {/* Main Inbox Data Table */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: '0.5rem',
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontWeight: 600 }}>
                <th style={{ padding: '0.75rem 1rem' }}>Code</th>
                <th style={{ padding: '0.75rem 1rem' }}>Condo / Title</th>
                <th style={{ padding: '0.75rem 1rem' }}>Price</th>
                <th style={{ padding: '0.75rem 1rem' }}>Listing Type</th>
                <th style={{ padding: '0.75rem 1rem' }}>Status Workflow</th>
                <th style={{ padding: '0.75rem 1rem' }}>Created</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No properties match your filter criteria.
                  </td>
                </tr>
              ) : (
                paginated.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                      {p.code}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)' }}>
                      <div>
                        <p style={{ fontWeight: 500 }}>{p.title}</p>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                          {p.projectName || 'No Project Assigned'}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {p.rentPrice ? `฿${p.rentPrice.toLocaleString()} / mo` : p.salePrice ? `฿${p.salePrice.toLocaleString()}` : 'N/A'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                      {p.propertyType ? p.propertyType.charAt(0).toUpperCase() + p.propertyType.slice(1).toLowerCase() : 'Condo'}{' '}
                      ({p.listingType ? p.listingType.charAt(0).toUpperCase() + p.listingType.slice(1).toLowerCase() : 'Rent'})
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <Badge
                        variant={
                          p.status === 'NEW'
                            ? 'info'
                            : p.status === 'READY_FOR_REVIEW'
                            ? 'warning'
                            : p.status === 'PUBLISHED'
                            ? 'success'
                            : 'outline'
                        }
                      >
                        {p.status}
                      </Badge>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      {p.createdAt}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
                        {p.status === 'NEW' && (
                          <Button
                            variant="primary"
                            size="sm"
                            leftIcon={<FiPlay />}
                            onClick={() => onProcessProperty(p.id)}
                          >
                            Process
                          </Button>
                        )}
                        {p.status === 'READY_FOR_REVIEW' && (
                          <Button
                            variant="primary"
                            size="sm"
                            leftIcon={<FiCheckCircle />}
                            onClick={() => onNavigateTab('review')}
                          >
                            Review
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(p.sourceUrl, '_blank')}
                          title="Open original Facebook URL"
                        >
                          <FiExternalLink />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Server-Side Pagination Bar */}
        <div
          style={{
            padding: '0.75rem 1.25rem',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({filtered.length} total properties)
          </span>

          <div style={{ display: 'flex', gap: '0.375rem' }}>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              leftIcon={<FiChevronLeft />}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              rightIcon={<FiChevronRight />}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
