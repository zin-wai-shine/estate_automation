import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FiX,
  FiSearch,
  FiRefreshCw,
  FiDownload,
  FiExternalLink,
  FiCopy,
  FiCheck,
  FiFilter,
  FiArrowUp,
  FiArrowDown,
  FiMaximize2,
  FiMinimize2,
  FiChevronLeft,
  FiChevronRight,
  FiChevronsLeft,
  FiChevronsRight,
  FiFileText,
} from 'react-icons/fi';
import { SiGooglesheets } from 'react-icons/si';
import { type DynamicAIBoxConfig } from './FacebookWorkflowCanvas';

interface GoogleSheetDataViewerSideboxProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  boxConfig: DynamicAIBoxConfig;
  isSidebarOpen?: boolean;
}

export const GoogleSheetDataViewerSidebox: React.FC<GoogleSheetDataViewerSideboxProps> = ({
  isOpen,
  onClose,
  isDark,
  boxConfig,
  isSidebarOpen = true,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [spreadsheetTitle, setSpreadsheetTitle] = useState<string>('');
  const [sheetName, setSheetName] = useState<string>('');
  const [spreadsheetId, setSpreadsheetId] = useState<string>('');

  // Global search & per-column search filters
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [columnFilters, setColumnFilters] = useState<{ [colIdx: number]: string }>({});
  const [showColumnFilterRow, setShowColumnFilterRow] = useState<boolean>(true);

  // Sorting
  const [sortColIdx, setSortColIdx] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Fullscreen expansion
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Copied cell tooltip
  const [copiedCellKey, setCopiedCellKey] = useState<string | null>(null);

  // Fetch sheet data from API
  const fetchSheetData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:8085/api/google-sheets/fetch-rows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheet_url: boxConfig.googleSpreadsheetUrl || '',
          sheet_name: boxConfig.googleSheetName || '',
          credentials_json: boxConfig.googleServiceAccountJson || '',
          limit: 0, // 0 = all rows
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load Google Sheet rows');
      }

      setHeaders(data.headers || []);
      setRows(data.rows || []);
      setSpreadsheetTitle(data.spreadsheet_title || '');
      setSheetName(data.sheet_name || boxConfig.googleSheetName || 'Sheet');
      setSpreadsheetId(data.spreadsheet_id || '');
    } catch (err: any) {
      console.error('Error fetching sheet rows:', err);
      setError(err.message || 'Failed to load Google Sheet data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSheetData();
      setCurrentPage(1);
    }
  }, [isOpen, boxConfig.googleSpreadsheetUrl, boxConfig.googleSheetName, boxConfig.googleServiceAccountJson]);

  // Filtering & Sorting
  const filteredRows = useMemo(() => {
    let result = [...rows];

    // 1. Global Search
    if (globalSearch.trim()) {
      const q = globalSearch.trim().toLowerCase();
      result = result.filter((row) =>
        row.some((cell) => cell.toLowerCase().includes(q))
      );
    }

    // 2. Per-Column Filters
    for (const [colIdxStr, filterVal] of Object.entries(columnFilters)) {
      const colIdx = Number(colIdxStr);
      const val = filterVal.trim().toLowerCase();
      if (val) {
        result = result.filter((row) => {
          const cell = (row[colIdx] || '').toLowerCase();
          return cell.includes(val);
        });
      }
    }

    // 3. Sorting
    if (sortColIdx !== null) {
      result.sort((a, b) => {
        const valA = a[sortColIdx] || '';
        const valB = b[sortColIdx] || '';

        // Check if numeric
        const numA = Number(valA.replace(/[^\d.-]/g, ''));
        const numB = Number(valB.replace(/[^\d.-]/g, ''));
        if (!isNaN(numA) && !isNaN(numB) && valA !== '' && valB !== '') {
          return sortDirection === 'asc' ? numA - numB : numB - numA;
        }

        return sortDirection === 'asc'
          ? valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' })
          : valB.localeCompare(valA, undefined, { numeric: true, sensitivity: 'base' });
      });
    }

    return result;
  }, [rows, globalSearch, columnFilters, sortColIdx, sortDirection]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    if (pageSize === 0) return filteredRows;
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const handleSort = (colIdx: number) => {
    if (sortColIdx === colIdx) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColIdx(null);
        setSortDirection('asc');
      }
    } else {
      setSortColIdx(colIdx);
      setSortDirection('asc');
    }
  };

  const handleColumnFilterChange = (colIdx: number, value: string) => {
    setColumnFilters((prev) => {
      const updated = { ...prev };
      if (!value.trim()) {
        delete updated[colIdx];
      } else {
        updated[colIdx] = value;
      }
      return updated;
    });
    setCurrentPage(1);
  };

  const handleClearAllFilters = () => {
    setGlobalSearch('');
    setColumnFilters({});
    setSortColIdx(null);
    setCurrentPage(1);
  };

  const handleCopyCell = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCellKey(key);
    setTimeout(() => {
      setCopiedCellKey(null);
    }, 1500);
  };

  const handleExportCSV = () => {
    if (headers.length === 0 && rows.length === 0) return;
    const escapeCsv = (str: string) => `"${(str || '').replace(/"/g, '""')}"`;
    const headerLine = headers.map(escapeCsv).join(',');
    const rowLines = filteredRows.map((r) => r.map(escapeCsv).join(','));
    const csvContent = [headerLine, ...rowLines].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(spreadsheetTitle || sheetName || 'GoogleSheet').replace(/[\/\\?%*:|"<>]/g, '_')}_data.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 20000);
  };

  if (!isOpen) return null;

  const hasActiveFilters = globalSearch.trim().length > 0 || Object.keys(columnFilters).length > 0 || sortColIdx !== null;
  const sheetUrl = boxConfig.googleSpreadsheetUrl || (spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}` : '');

  // Helper to get column letter (0 -> A, 1 -> B, 26 -> AA, etc.)
  const getColumnLetter = (colIdx: number): string => {
    let letter = '';
    let temp = colIdx;
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  };

  return (
    <div
      className="workflow-sidebar"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: 0,
        bottom: 0,
        right: isExpanded ? 0 : isSidebarOpen ? '380px' : 0,
        left: isExpanded ? 0 : 'auto',
        width: isExpanded ? '100vw' : 'calc(100vw - 420px)',
        maxWidth: isExpanded ? '100vw' : '1440px',
        minWidth: isExpanded ? '100vw' : '720px',
        backgroundColor: isDark ? 'var(--bg-main)' : '#FFFFFF',
        borderLeft: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
        borderRight: isExpanded ? 'none' : isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
        boxShadow: isDark
          ? '-16px 0 35px rgba(0, 0, 0, 0.85)'
          : '-8px 0 24px rgba(0, 0, 0, 0.1)',
        zIndex: 168,
        display: 'flex',
        flexDirection: 'column',
        animation: 'sidebarSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        userSelect: 'text',
      }}
    >
      {/* ── Top Header ────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '0.875rem 1.25rem',
          height: '62px',
          boxSizing: 'border-box',
          borderBottom: isDark ? '1px solid #21262D' : '1px solid #E2E8F0',
          backgroundColor: isDark ? '#161B22' : '#F6F8FA',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '7px',
              backgroundColor: 'rgba(15, 157, 88, 0.12)',
              border: '1px solid rgba(15, 157, 88, 0.35)',
              color: '#0F9D58',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <SiGooglesheets size={17} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <span
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {spreadsheetTitle || 'Google Sheet'}
              </span>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  padding: '1px 7px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(15, 157, 88, 0.15)',
                  color: '#0F9D58',
                  border: '1px solid rgba(15, 157, 88, 0.3)',
                  flexShrink: 0,
                }}
              >
                {sheetName || boxConfig.googleSheetName || 'Sheet'}
              </span>
            </div>
            <div
              style={{
                fontSize: '0.6875rem',
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {rows.length.toLocaleString()} total rows · {headers.length} columns · {boxConfig.googleServiceAccountEmail || 'Default Service Account'}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchSheetData}
            disabled={loading}
            title="Refresh rows from Google Sheets"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 9px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 500,
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF',
              border: isDark ? '1px solid #30363D' : '1px solid #D0D7DE',
              color: 'var(--text-primary)',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <FiRefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            <span>Refresh</span>
          </button>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={rows.length === 0}
            title="Export filtered data as CSV file"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 9px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 500,
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF',
              border: isDark ? '1px solid #30363D' : '1px solid #D0D7DE',
              color: 'var(--text-primary)',
              cursor: rows.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <FiDownload size={12} />
            <span>Export CSV</span>
          </button>

          {/* Open External Sheet */}
          {sheetUrl && (
            <a
              href={sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open Google Sheet in new browser tab"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 9px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 500,
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF',
                border: isDark ? '1px solid #30363D' : '1px solid #D0D7DE',
                color: 'var(--text-primary)',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <FiExternalLink size={12} />
              <span>Open Sheet</span>
            </a>
          )}

          {/* Expand / Minimize Width */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Restore width' : 'Expand full width'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF',
              border: isDark ? '1px solid #30363D' : '1px solid #D0D7DE',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {isExpanded ? <FiMinimize2 size={13} /> : <FiMaximize2 size={13} />}
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            title="Close Data Viewer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF',
              border: isDark ? '1px solid #30363D' : '1px solid #D0D7DE',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <FiX size={15} />
          </button>
        </div>
      </div>

      {/* ── Search & Filter Controls Toolbar ─────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '0.625rem 1.25rem',
          borderBottom: isDark ? '1px solid #21262D' : '1px solid #E2E8F0',
          backgroundColor: isDark ? '#0D1117' : '#FFFFFF',
        }}
      >
        {/* Global Search Bar */}
        <div style={{ position: 'relative', width: '380px', maxWidth: '50%' }}>
          <FiSearch
            size={13}
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            placeholder="Search across all columns (Code, Project, Price, Contact...)..."
            value={globalSearch}
            onChange={(e) => {
              setGlobalSearch(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              height: '32px',
              paddingLeft: '30px',
              paddingRight: globalSearch ? '28px' : '10px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              backgroundColor: isDark ? '#161B22' : '#F6F8FA',
              border: isDark ? '1px solid #30363D' : '1px solid #D0D7DE',
              color: 'var(--text-primary)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {globalSearch && (
            <button
              type="button"
              onClick={() => {
                setGlobalSearch('');
                setCurrentPage(1);
              }}
              style={{
                position: 'absolute',
                right: '6px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '2px',
              }}
            >
              <FiX size={12} />
            </button>
          )}
        </div>

        {/* Filter Indicators & Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Toggle Column Filter Inputs */}
          <button
            type="button"
            onClick={() => setShowColumnFilterRow(!showColumnFilterRow)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 8px',
              borderRadius: '5px',
              fontSize: '0.6875rem',
              fontWeight: 500,
              backgroundColor: showColumnFilterRow ? 'rgba(15, 157, 88, 0.1)' : 'transparent',
              border: showColumnFilterRow ? '1px solid rgba(15, 157, 88, 0.4)' : isDark ? '1px solid #30363D' : '1px solid #D0D7DE',
              color: showColumnFilterRow ? '#0F9D58' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <FiFilter size={11} />
            <span>Column Search</span>
          </button>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearAllFilters}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '5px',
                fontSize: '0.6875rem',
                fontWeight: 600,
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#EF4444',
                cursor: 'pointer',
              }}
            >
              <FiX size={11} />
              <span>Clear Filters</span>
            </button>
          )}

          {/* Rows count badge */}
          <span
            style={{
              fontSize: '0.6875rem',
              color: 'var(--text-muted)',
              padding: '3px 8px',
              borderRadius: '5px',
              backgroundColor: isDark ? '#161B22' : '#F6F8FA',
              border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
            }}
          >
            Showing <strong style={{ color: 'var(--text-primary)' }}>{filteredRows.length.toLocaleString()}</strong> of {rows.length.toLocaleString()} rows
          </span>
        </div>
      </div>

      {/* ── Table Container ─────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          backgroundColor: isDark ? '#0D1117' : '#FFFFFF',
          position: 'relative',
        }}
      >
        {loading && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '300px',
              gap: '12px',
              color: 'var(--text-secondary)',
            }}
          >
            <FiRefreshCw size={24} style={{ animation: 'spin 1s linear infinite', color: '#0F9D58' }} />
            <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>Fetching live data from Google Sheets API...</span>
          </div>
        )}

        {error && !loading && (
          <div
            style={{
              margin: '2rem',
              padding: '1.25rem',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#EF4444',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>Failed to Load Google Sheet Rows</div>
            <div style={{ fontSize: '0.75rem', lineHeight: '1.4' }}>{error}</div>
            <button
              type="button"
              onClick={fetchSheetData}
              style={{
                alignSelf: 'flex-start',
                marginTop: '6px',
                padding: '5px 12px',
                borderRadius: '5px',
                backgroundColor: '#EF4444',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '300px',
              gap: '8px',
              color: 'var(--text-muted)',
            }}
          >
            <FiFileText size={32} />
            <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>No rows found in this sheet</span>
            <span style={{ fontSize: '0.6875rem' }}>Sheet "{sheetName}" appears to be empty</span>
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.75rem',
              textAlign: 'left',
              tableLayout: 'auto',
            }}
          >
            {/* Table Header */}
            <thead>
              {/* Row 1: Column Names & Sorting */}
              <tr
                style={{
                  position: 'sticky',
                  top: 0,
                  backgroundColor: isDark ? '#161B22' : '#F6F8FA',
                  borderBottom: isDark ? '1px solid #30363D' : '1px solid #D0D7DE',
                  zIndex: 20,
                }}
              >
                {/* Row # Header */}
                <th
                  style={{
                    padding: '8px 10px',
                    width: '52px',
                    minWidth: '52px',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    borderRight: isDark ? '1px solid #21262D' : '1px solid #E2E8F0',
                    textAlign: 'center',
                    position: 'sticky',
                    left: 0,
                    backgroundColor: isDark ? '#161B22' : '#F6F8FA',
                    zIndex: 25,
                  }}
                >
                  #
                </th>

                {headers.map((h, colIdx) => {
                  const isSorted = sortColIdx === colIdx;
                  return (
                    <th
                      key={`th-${colIdx}`}
                      onClick={() => handleSort(colIdx)}
                      title={`Click to sort by ${h} (${isSorted ? (sortDirection === 'asc' ? 'Descending' : 'Clear sort') : 'Ascending'})`}
                      style={{
                        padding: '8px 12px',
                        fontWeight: 600,
                        color: isSorted ? '#0F9D58' : 'var(--text-primary)',
                        borderRight: isDark ? '1px solid #21262D' : '1px solid #E2E8F0',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        userSelect: 'none',
                        minWidth: '120px',
                        maxWidth: '280px',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = isDark ? '#21262D' : '#EAEFF5';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = isDark ? '#161B22' : '#F6F8FA';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                          <span
                            style={{
                              fontSize: '0.625rem',
                              fontWeight: 700,
                              color: 'var(--text-muted)',
                              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0,0,0,0.05)',
                              padding: '1px 4px',
                              borderRadius: '3px',
                            }}
                          >
                            {getColumnLetter(colIdx)}
                          </span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{h || `Column ${colIdx + 1}`}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                          {isSorted ? (
                            sortDirection === 'asc' ? (
                              <FiArrowUp size={12} color="#0F9D58" />
                            ) : (
                              <FiArrowDown size={12} color="#0F9D58" />
                            )
                          ) : (
                            <span style={{ opacity: 0.25, fontSize: '0.65rem' }}>⇅</span>
                          )}
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>

              {/* Row 2: Per-Column Filter Inputs (Sticky directly under header row) */}
              {showColumnFilterRow && (
                <tr
                  style={{
                    position: 'sticky',
                    top: '37px',
                    backgroundColor: isDark ? '#0D1117' : '#FFFFFF',
                    borderBottom: isDark ? '1px solid #30363D' : '1px solid #D0D7DE',
                    zIndex: 19,
                  }}
                >
                  <th
                    style={{
                      padding: '4px 6px',
                      borderRight: isDark ? '1px solid #21262D' : '1px solid #E2E8F0',
                      textAlign: 'center',
                      position: 'sticky',
                      left: 0,
                      backgroundColor: isDark ? '#0D1117' : '#FFFFFF',
                      zIndex: 24,
                    }}
                  >
                    <FiFilter size={10} color="var(--text-muted)" />
                  </th>

                  {headers.map((h, colIdx) => (
                    <th
                      key={`filter-${colIdx}`}
                      style={{
                        padding: '4px 6px',
                        borderRight: isDark ? '1px solid #21262D' : '1px solid #E2E8F0',
                      }}
                    >
                      <input
                        type="text"
                        placeholder={`Filter ${h}...`}
                        value={columnFilters[colIdx] || ''}
                        onChange={(e) => handleColumnFilterChange(colIdx, e.target.value)}
                        style={{
                          width: '100%',
                          height: '24px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.6875rem',
                          backgroundColor: isDark ? '#161B22' : '#F6F8FA',
                          border: columnFilters[colIdx]
                            ? '1px solid #0F9D58'
                            : isDark ? '1px solid #30363D' : '1px solid #D0D7DE',
                          color: 'var(--text-primary)',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </th>
                  ))}
                </tr>
              )}
            </thead>

            {/* Table Body */}
            <tbody>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={headers.length + 1}
                    style={{
                      padding: '3rem 1rem',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <FiSearch size={22} />
                      <span style={{ fontSize: '0.8125rem' }}>No rows match your current search and filters</span>
                      <button
                        type="button"
                        onClick={handleClearAllFilters}
                        style={{
                          marginTop: '4px',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          backgroundColor: isDark ? '#21262D' : '#EAEFF5',
                          border: isDark ? '1px solid #30363D' : '1px solid #D0D7DE',
                          color: 'var(--text-primary)',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        Reset All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, rowIdx) => {
                  const actualRowNumber = pageSize === 0 ? rowIdx + 1 : (currentPage - 1) * pageSize + rowIdx + 1;
                  const isEven = rowIdx % 2 === 0;

                  return (
                    <tr
                      key={`row-${actualRowNumber}`}
                      style={{
                        backgroundColor: isEven
                          ? (isDark ? 'transparent' : '#FFFFFF')
                          : (isDark ? 'rgba(255, 255, 255, 0.015)' : '#F9FAFB'),
                        borderBottom: isDark ? '1px solid #21262D' : '1px solid #E5E7EB',
                        transition: 'background-color 0.1s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.04)' : '#F3F4F6';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = isEven
                          ? (isDark ? 'transparent' : '#FFFFFF')
                          : (isDark ? 'rgba(255, 255, 255, 0.015)' : '#F9FAFB');
                      }}
                    >
                      {/* Row # */}
                      <td
                        style={{
                          padding: '6px 8px',
                          textAlign: 'center',
                          color: 'var(--text-muted)',
                          fontSize: '0.6875rem',
                          fontWeight: 500,
                          borderRight: isDark ? '1px solid #21262D' : '1px solid #E5E7EB',
                          position: 'sticky',
                          left: 0,
                          backgroundColor: isDark ? '#161B22' : '#F6F8FA',
                          zIndex: 10,
                          userSelect: 'none',
                        }}
                      >
                        {actualRowNumber}
                      </td>

                      {/* Cell Data */}
                      {headers.map((_, colIdx) => {
                        const cellValue = row[colIdx] || '';
                        const cellKey = `${actualRowNumber}-${colIdx}`;
                        const isCopied = copiedCellKey === cellKey;
                        const isUrl = cellValue.startsWith('http://') || cellValue.startsWith('https://');

                        return (
                          <td
                            key={cellKey}
                            onClick={() => handleCopyCell(cellValue, cellKey)}
                            title={`Click to copy: "${cellValue}"`}
                            style={{
                              padding: '6px 12px',
                              borderRight: isDark ? '1px solid #21262D' : '1px solid #E5E7EB',
                              maxWidth: '320px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              color: cellValue ? 'var(--text-primary)' : 'var(--text-muted)',
                              cursor: 'pointer',
                              position: 'relative',
                            }}
                          >
                            {isCopied && (
                              <span
                                style={{
                                  position: 'absolute',
                                  right: '6px',
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  backgroundColor: '#10B981',
                                  color: '#FFFFFF',
                                  fontSize: '0.5625rem',
                                  fontWeight: 700,
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                  zIndex: 5,
                                }}
                              >
                                Copied!
                              </span>
                            )}

                            {isUrl ? (
                              <a
                                href={cellValue}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  color: '#3B82F6',
                                  textDecoration: 'underline',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  maxWidth: '100%',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                <span>{cellValue}</span>
                                <FiExternalLink size={10} style={{ flexShrink: 0 }} />
                              </a>
                            ) : (
                              <span>{cellValue || '-'}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Table Footer & Pagination ───────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '0.5rem 1.25rem',
          height: '46px',
          boxSizing: 'border-box',
          borderTop: isDark ? '1px solid #21262D' : '1px solid #E2E8F0',
          backgroundColor: isDark ? '#161B22' : '#F6F8FA',
          fontSize: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-muted)' }}>
          <span>
            Page <strong style={{ color: 'var(--text-primary)' }}>{currentPage}</strong> of {totalPages}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{
                height: '26px',
                padding: '0 6px',
                borderRadius: '4px',
                backgroundColor: isDark ? '#0D1117' : '#FFFFFF',
                border: isDark ? '1px solid #30363D' : '1px solid #D0D7DE',
                color: 'var(--text-primary)',
                fontSize: '0.75rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={0}>All</option>
            </select>
          </div>
        </div>

        {/* Pagination Buttons */}
        {pageSize > 0 && totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              title="First Page"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '26px',
                height: '26px',
                borderRadius: '4px',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF',
                border: isDark ? '1px solid #30363D' : '1px solid #D0D7DE',
                color: 'var(--text-primary)',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage === 1 ? 0.4 : 1,
              }}
            >
              <FiChevronsLeft size={13} />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              title="Previous Page"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '26px',
                height: '26px',
                borderRadius: '4px',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF',
                border: isDark ? '1px solid #30363D' : '1px solid #D0D7DE',
                color: 'var(--text-primary)',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage === 1 ? 0.4 : 1,
              }}
            >
              <FiChevronLeft size={13} />
            </button>

            <span style={{ padding: '0 8px', color: 'var(--text-primary)', fontWeight: 600 }}>
              {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              title="Next Page"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '26px',
                height: '26px',
                borderRadius: '4px',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF',
                border: isDark ? '1px solid #30363D' : '1px solid #D0D7DE',
                color: 'var(--text-primary)',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                opacity: currentPage === totalPages ? 0.4 : 1,
              }}
            >
              <FiChevronRight size={13} />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              title="Last Page"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '26px',
                height: '26px',
                borderRadius: '4px',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF',
                border: isDark ? '1px solid #30363D' : '1px solid #D0D7DE',
                color: 'var(--text-primary)',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                opacity: currentPage === totalPages ? 0.4 : 1,
              }}
            >
              <FiChevronsRight size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
