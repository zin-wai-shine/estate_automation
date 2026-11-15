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
  FiEdit2,
  FiTrash2,
  FiAlertTriangle,
  FiSave,
  FiClock,
} from 'react-icons/fi';
import { SiGooglesheets } from 'react-icons/si';
import { type DynamicAIBoxConfig } from './FacebookWorkflowCanvas';
import { apiUrl } from '../../services/apiClient';

export interface SheetRowItem {
  originalIndex: number;
  sheetRowNum: number;
  values: string[];
}

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

  // Manage actions state (Edit / Delete)
  const [rowToDelete, setRowToDelete] = useState<{ item: SheetRowItem; displayNum: number } | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [rowToEdit, setRowToEdit] = useState<{ item: SheetRowItem; displayNum: number; draftValues: string[] } | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Global search & per-column search filters
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [columnFilters, setColumnFilters] = useState<{ [colIdx: number]: string }>({});
  const [showColumnFilterRow, setShowColumnFilterRow] = useState<boolean>(true);

  // Sorting & Row Ordering
  const [sortColIdx, setSortColIdx] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [defaultOrder, setDefaultOrder] = useState<'latestFirst' | 'oldestFirst'>('latestFirst');

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
      const res = await fetch(apiUrl('/api/google-sheets/fetch-rows'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheet_url: boxConfig.googleSpreadsheetUrl || '',
          sheet_name: boxConfig.googleSheetName || '',
          credentials_json: boxConfig.googleServiceAccountJson || '',
          limit: 0, // 0 = all rows
        }),
      });

      let data: any = null;
      const rawText = await res.text();
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(`Server returned status ${res.status} (${res.statusText || 'Error'}). Please check backend connection.`);
      }
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

  // Delete a row from Google Sheet
  const handleDeleteRow = async (item: SheetRowItem) => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(apiUrl('/api/google-sheets/delete-row'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheet_url: boxConfig.googleSpreadsheetUrl || '',
          sheet_name: sheetName || boxConfig.googleSheetName || '',
          row_index: item.originalIndex + 1,
          listing_code: item.values[0] || '',
          credentials_json: boxConfig.googleServiceAccountJson || '',
        }),
      });
      let data: any = null;
      const rawText = await res.text();
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(`Server returned status ${res.status} (${res.statusText || 'Error'}).`);
      }
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete row from Google Sheet');
      }
      setRows((prev) => prev.filter((_, idx) => idx !== item.originalIndex));
      setRowToDelete(null);
      setActionSuccessMessage(`✓ Row #${item.sheetRowNum - 1} (${item.values[0] || 'Property'}) successfully removed from Google Sheet!`);
      setTimeout(() => setActionSuccessMessage(null), 4000);
      fetchSheetData();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete row');
    } finally {
      setIsDeleting(false);
    }
  };

  // Save changes to an edited row in Google Sheet
  const handleSaveEditRow = async () => {
    if (!rowToEdit) return;
    setIsSavingEdit(true);
    setEditError(null);
    try {
      const res = await fetch(apiUrl('/api/google-sheets/update-row'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheet_url: boxConfig.googleSpreadsheetUrl || '',
          sheet_name: sheetName || boxConfig.googleSheetName || '',
          row_index: rowToEdit.item.originalIndex + 1,
          values: rowToEdit.draftValues,
          credentials_json: boxConfig.googleServiceAccountJson || '',
        }),
      });
      let data: any = null;
      const rawText = await res.text();
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(`Server returned status ${res.status} (${res.statusText || 'Error'}).`);
      }
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update row in Google Sheet');
      }
      setRows((prev) => {
        const next = [...prev];
        if (next[rowToEdit.item.originalIndex]) {
          next[rowToEdit.item.originalIndex] = [...rowToEdit.draftValues];
        }
        return next;
      });
      setActionSuccessMessage(`✓ Row #${rowToEdit.item.sheetRowNum - 1} successfully updated in Google Sheet!`);
      setTimeout(() => setActionSuccessMessage(null), 4000);
      setRowToEdit(null);
      fetchSheetData();
    } catch (err: any) {
      setEditError(err.message || 'Failed to save changes');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Filtering & Sorting with true original sheet row indices
  const filteredRowItems = useMemo<SheetRowItem[]>(() => {
    let result: SheetRowItem[] = rows.map((r, idx) => ({
      originalIndex: idx,
      sheetRowNum: idx + 2,
      values: r,
    }));

    // 1. Global Search
    if (globalSearch.trim()) {
      const q = globalSearch.trim().toLowerCase();
      result = result.filter((item) =>
        item.values.some((cell) => cell.toLowerCase().includes(q))
      );
    }

    // 2. Per-Column Filters
    for (const [colIdxStr, filterVal] of Object.entries(columnFilters)) {
      const colIdx = Number(colIdxStr);
      const val = filterVal.trim().toLowerCase();
      if (val) {
        result = result.filter((item) => {
          const cell = (item.values[colIdx] || '').toLowerCase();
          return cell.includes(val);
        });
      }
    }

    // 3. Sorting & Default Row Ordering
    if (sortColIdx !== null) {
      result.sort((itemA, itemB) => {
        const valA = itemA.values[sortColIdx] || '';
        const valB = itemB.values[sortColIdx] || '';

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
    } else if (defaultOrder === 'latestFirst') {
      // Default: Last First (Show newest appended rows first at the top)
      result.reverse();
    }

    return result;
  }, [rows, globalSearch, columnFilters, sortColIdx, sortDirection, defaultOrder]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredRowItems.length / pageSize));
  const paginatedRowItems = useMemo(() => {
    if (pageSize === 0) return filteredRowItems;
    const start = (currentPage - 1) * pageSize;
    return filteredRowItems.slice(start, start + pageSize);
  }, [filteredRowItems, currentPage, pageSize]);

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
    const rowLines = filteredRowItems.map((r) => r.values.map(escapeCsv).join(','));
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
        left: 0,
        right: isExpanded ? 0 : isSidebarOpen ? '380px' : 0,
        width: isExpanded ? '100vw' : isSidebarOpen ? 'calc(100vw - 380px)' : '100vw',
        maxWidth: 'none',
        backgroundColor: isDark ? 'var(--bg-main)' : '#FFFFFF',
        borderLeft: 'none',
        borderRight: isExpanded ? 'none' : isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
        boxShadow: 'none',
        zIndex: isExpanded ? 220 : 168,
        display: 'flex',
        flexDirection: 'column',
        animation: isExpanded ? 'none' : 'sidebarSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
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

      {/* ── Action Success Message Banner ────────────────────────────────────── */}
      {actionSuccessMessage && (
        <div
          style={{
            padding: '0.5rem 1.25rem',
            backgroundColor: 'rgba(15, 157, 88, 0.15)',
            borderBottom: '1px solid rgba(15, 157, 88, 0.35)',
            color: '#10B981',
            fontSize: '0.75rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 15,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiCheck size={14} />
            <span>{actionSuccessMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccessMessage(null)}
            style={{ background: 'none', border: 'none', color: '#10B981', cursor: 'pointer', padding: 0 }}
          >
            <FiX size={13} />
          </button>
        </div>
      )}

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
          {/* Order Toggle: Last First (Default) vs First First */}
          <button
            type="button"
            onClick={() => {
              setDefaultOrder((prev) => (prev === 'latestFirst' ? 'oldestFirst' : 'latestFirst'));
              setSortColIdx(null);
            }}
            title={`Toggle row order: currently showing ${defaultOrder === 'latestFirst' ? 'Last First (newest appended rows first)' : 'First First (oldest rows first)'}. Click to switch.`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 8px',
              borderRadius: '5px',
              fontSize: '0.6875rem',
              fontWeight: 500,
              backgroundColor: defaultOrder === 'latestFirst' ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
              border: defaultOrder === 'latestFirst' ? '1px solid rgba(59, 130, 246, 0.4)' : isDark ? '1px solid #30363D' : '1px solid #D0D7DE',
              color: defaultOrder === 'latestFirst' ? '#3B82F6' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <FiClock size={11} />
            <span>{defaultOrder === 'latestFirst' ? 'Last First (Newest)' : 'First First (Oldest)'}</span>
          </button>

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
            Showing <strong style={{ color: 'var(--text-primary)' }}>{filteredRowItems.length.toLocaleString()}</strong> of {rows.length.toLocaleString()} rows
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
                {/* Row # Header (Click to toggle Last First / First First) */}
                <th
                  onClick={() => {
                    setDefaultOrder((prev) => (prev === 'latestFirst' ? 'oldestFirst' : 'latestFirst'));
                    setSortColIdx(null);
                  }}
                  title={`Click to toggle order: currently showing ${defaultOrder === 'latestFirst' ? 'Last First (newest first)' : 'First First (oldest first)'}`}
                  style={{
                    padding: '8px 10px',
                    width: '56px',
                    minWidth: '56px',
                    fontWeight: 600,
                    color: sortColIdx === null ? '#3B82F6' : 'var(--text-muted)',
                    borderRight: isDark ? '1px solid #21262D' : '1px solid #E2E8F0',
                    textAlign: 'center',
                    position: 'sticky',
                    left: 0,
                    backgroundColor: isDark ? '#161B22' : '#F6F8FA',
                    zIndex: 25,
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <span>#</span>
                    {sortColIdx === null && (
                      <span style={{ fontSize: '0.6875rem', color: '#3B82F6', fontWeight: 700 }}>
                        {defaultOrder === 'latestFirst' ? '↓' : '↑'}
                      </span>
                    )}
                  </div>
                </th>

                {/* Manage Header */}
                <th
                  style={{
                    padding: '8px 10px',
                    width: '76px',
                    minWidth: '76px',
                    fontWeight: 600,
                    fontSize: '0.6875rem',
                    color: 'var(--text-muted)',
                    borderRight: isDark ? '1px solid #21262D' : '1px solid #E2E8F0',
                    textAlign: 'center',
                    position: 'sticky',
                    left: '52px',
                    backgroundColor: isDark ? '#161B22' : '#F6F8FA',
                    zIndex: 25,
                    userSelect: 'none',
                  }}
                >
                  Manage
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

                  {/* Actions Column Filter Header Placeholder */}
                  <th
                    style={{
                      padding: '4px 6px',
                      borderRight: isDark ? '1px solid #21262D' : '1px solid #E2E8F0',
                      textAlign: 'center',
                      position: 'sticky',
                      left: '52px',
                      backgroundColor: isDark ? '#0D1117' : '#FFFFFF',
                      zIndex: 24,
                      width: '76px',
                      minWidth: '76px',
                    }}
                  >
                    <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>Action</span>
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
              {paginatedRowItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={headers.length + 2}
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
                paginatedRowItems.map((item, rowIdx) => {
                  const actualRowNumber = item.originalIndex + 1;
                  const isEven = rowIdx % 2 === 0;
                  const row = item.values;

                  return (
                    <tr
                      key={`row-${item.sheetRowNum}-${item.originalIndex}`}
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
                          fontWeight: 600,
                          borderRight: isDark ? '1px solid #21262D' : '1px solid #E5E7EB',
                          position: 'sticky',
                          left: 0,
                          backgroundColor: isDark ? '#161B22' : '#F6F8FA',
                          zIndex: 10,
                          userSelect: 'none',
                        }}
                        title={`Data Row #${actualRowNumber} (Sheet Row #${item.sheetRowNum})`}
                      >
                        {actualRowNumber}
                      </td>

                      {/* Manage Actions Column */}
                      <td
                        style={{
                          padding: '6px 8px',
                          textAlign: 'center',
                          borderRight: isDark ? '1px solid #21262D' : '1px solid #E5E7EB',
                          position: 'sticky',
                          left: '52px',
                          backgroundColor: isDark ? '#161B22' : '#F6F8FA',
                          zIndex: 10,
                          userSelect: 'none',
                          width: '76px',
                          minWidth: '76px',
                        }}
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRowToEdit({
                                item,
                                displayNum: actualRowNumber,
                                draftValues: headers.map((_, cIdx) => item.values[cIdx] || ''),
                              });
                            }}
                            title={`Edit Row #${actualRowNumber} in Google Sheet`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '24px',
                              height: '24px',
                              borderRadius: '4px',
                              border: isDark ? '1px solid #30363D' : '1px solid #D0D7DE',
                              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.08)',
                              color: '#3B82F6',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.25)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.08)';
                            }}
                          >
                            <FiEdit2 size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRowToDelete({
                                item,
                                displayNum: actualRowNumber,
                              });
                            }}
                            title={`Delete Row #${actualRowNumber} from Google Sheet`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '24px',
                              height: '24px',
                              borderRadius: '4px',
                              border: isDark ? '1px solid #30363D' : '1px solid #D0D7DE',
                              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.08)',
                              color: '#EF4444',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.25)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.08)';
                            }}
                          >
                            <FiTrash2 size={12} />
                          </button>
                        </div>
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

      {/* ── DELETE ROW CONFIRMATION MODAL ── */}
      {rowToDelete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 350,
            padding: '1rem',
          }}
          onClick={() => !isDeleting && setRowToDelete(null)}
        >
          <div
            style={{
              width: '460px',
              maxWidth: '100%',
              backgroundColor: isDark ? '#161B22' : '#FFFFFF',
              border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
              borderRadius: '10px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#EF4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <FiTrash2 size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Delete Row from Google Sheet
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Row #{rowToDelete.displayNum} (Sheet Row #{rowToDelete.item.sheetRowNum})
                </p>
              </div>
            </div>

            <div
              style={{
                padding: '0.75rem',
                borderRadius: '6px',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F6F8FA',
                border: isDark ? '1px solid #21262D' : '1px solid #E2E8F0',
                fontSize: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div><strong>Code:</strong> {rowToDelete.item.values[0] || 'N/A'}</div>
              <div><strong>Project:</strong> {rowToDelete.item.values[1] || 'N/A'}</div>
              {rowToDelete.item.values[5] && <div><strong>Price:</strong> {rowToDelete.item.values[5]}</div>}
            </div>

            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Are you sure you want to delete this row? This action will permanently remove it from the live spreadsheet <strong>{spreadsheetTitle || sheetName}</strong>.
            </p>

            {deleteError && (
              <div style={{ fontSize: '0.75rem', color: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: '4px' }}>
                {deleteError}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setRowToDelete(null)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  border: isDark ? '1px solid #30363D' : '1px solid #D0D7DE',
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => handleDeleteRow(rowToDelete.item)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: '1px solid #EF4444',
                  backgroundColor: '#EF4444',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                }}
              >
                {isDeleting ? <FiRefreshCw size={12} className="animate-spin" /> : <FiTrash2 size={12} />}
                <span>{isDeleting ? 'Deleting...' : 'Delete Row'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT ROW MODAL ── */}
      {rowToEdit && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 350,
            padding: '1rem',
          }}
          onClick={() => !isSavingEdit && setRowToEdit(null)}
        >
          <div
            style={{
              width: '640px',
              maxWidth: '100%',
              maxHeight: '85vh',
              backgroundColor: isDark ? '#161B22' : '#FFFFFF',
              border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
              borderRadius: '10px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.25rem',
                borderBottom: isDark ? '1px solid #21262D' : '1px solid #E2E8F0',
                backgroundColor: isDark ? '#0D1117' : '#F6F8FA',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(15, 157, 88, 0.12)',
                    border: '1px solid rgba(15, 157, 88, 0.3)',
                    color: '#0F9D58',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FiEdit2 size={14} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Edit Row #{rowToEdit.displayNum}
                  </h3>
                  <p style={{ margin: '1px 0 0 0', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                    Google Sheet line #{rowToEdit.item.sheetRowNum} · {sheetName || boxConfig.googleSheetName || 'Sheet'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isSavingEdit && setRowToEdit(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <FiX size={16} />
              </button>
            </div>

            {/* Modal Body - Scrollable Form */}
            <div
              style={{
                padding: '1.25rem',
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
              }}
            >
              {headers.map((h, colIdx) => {
                const isLongField = (
                  h.toLowerCase().includes('link') ||
                  h.toLowerCase().includes('contact') ||
                  h.toLowerCase().includes('description') ||
                  (rowToEdit.draftValues[colIdx] || '').length > 60
                );
                return (
                  <div
                    key={`edit-col-${colIdx}`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      gridColumn: isLongField ? 'span 2' : 'span 1',
                    }}
                  >
                    <label
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.5625rem',
                          padding: '1px 3px',
                          borderRadius: '2px',
                          backgroundColor: isDark ? '#21262D' : '#E2E8F0',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {getColumnLetter(colIdx)}
                      </span>
                      <span>{h || `Column ${colIdx + 1}`}</span>
                    </label>
                    {isLongField ? (
                      <textarea
                        rows={2}
                        value={rowToEdit.draftValues[colIdx] || ''}
                        onChange={(e) => {
                          const next = [...rowToEdit.draftValues];
                          next[colIdx] = e.target.value;
                          setRowToEdit({ ...rowToEdit, draftValues: next });
                        }}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          backgroundColor: isDark ? '#0D1117' : '#F6F8FA',
                          border: isDark ? '1px solid #30363D' : '1px solid #D0D7DE',
                          color: 'var(--text-primary)',
                          outline: 'none',
                          boxSizing: 'border-box',
                          fontFamily: 'inherit',
                          resize: 'vertical',
                        }}
                      />
                    ) : (
                      <input
                        type="text"
                        value={rowToEdit.draftValues[colIdx] || ''}
                        onChange={(e) => {
                          const next = [...rowToEdit.draftValues];
                          next[colIdx] = e.target.value;
                          setRowToEdit({ ...rowToEdit, draftValues: next });
                        }}
                        style={{
                          width: '100%',
                          height: '30px',
                          padding: '0 8px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          backgroundColor: isDark ? '#0D1117' : '#F6F8FA',
                          border: isDark ? '1px solid #30363D' : '1px solid #D0D7DE',
                          color: 'var(--text-primary)',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {editError && (
              <div
                style={{
                  margin: '0 1.25rem 0.5rem 1.25rem',
                  fontSize: '0.75rem',
                  color: '#EF4444',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  padding: '8px',
                  borderRadius: '4px',
                }}
              >
                {editError}
              </div>
            )}

            {/* Modal Footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '8px',
                padding: '0.875rem 1.25rem',
                borderTop: isDark ? '1px solid #21262D' : '1px solid #E2E8F0',
                backgroundColor: isDark ? '#0D1117' : '#F6F8FA',
              }}
            >
              <button
                type="button"
                disabled={isSavingEdit}
                onClick={() => setRowToEdit(null)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  border: isDark ? '1px solid #30363D' : '1px solid #D0D7DE',
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  cursor: isSavingEdit ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingEdit}
                onClick={handleSaveEditRow}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: '1px solid #0F9D58',
                  backgroundColor: '#0F9D58',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: isSavingEdit ? 'not-allowed' : 'pointer',
                }}
              >
                {isSavingEdit ? <FiRefreshCw size={12} className="animate-spin" /> : <FiCheck size={12} />}
                <span>{isSavingEdit ? 'Saving Changes...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
