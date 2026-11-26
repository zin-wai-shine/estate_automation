import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { showMacNotification } from '../../components/ui/MacNotification';
import {
  FiSearch,
  FiPlus,
  FiFilter,
  FiUserCheck,
  FiCheckCircle,
  FiAlertTriangle,
  FiExternalLink,
  FiLayers,
  FiSettings,
  FiSliders,
  FiZap,
  FiCompass,
  FiEye,
  FiTrash2,
  FiCopy,
  FiX,
  FiHome,
  FiSend,
  FiList,
  FiGrid,
  FiChevronLeft,
  FiChevronRight,
} from 'react-icons/fi';
import { FaFacebook } from 'react-icons/fa';
import { useTheme } from '../../context/ThemeContext';
import { Select } from '../../components/ui/Select';
import type {
  FinderProject,
  FinderSource,
  FinderPost,
  FinderOverviewStats,
} from './types';
import {
  fetchFinderOverview,
  fetchFinderProjects,
  createFinderProject,
  updateFinderProject,
  deleteFinderProject,
  toggleFinderProject,
  fetchFinderSources,
  fetchFinderPosts,
  deleteFinderPost,
  fetchFinderSettings,
  updateFinderSettings,
  loadSampleFinderPosts,
  testTelegramNotification,
} from './propertyFinderService';
import { PostDetailModal } from './components/PostDetailModal';
import { ProjectModal } from './components/ProjectModal';
import { ManualImportModal } from './components/ManualImportModal';

export interface FacebookPropertyFinderViewProps {
  initialTab?: 'leads' | 'projects' | 'sources' | 'settings';
}

export const FacebookPropertyFinderView: React.FC<FacebookPropertyFinderViewProps> = ({ initialTab }) => {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';

  const location = useLocation();
  const navigate = useNavigate();

  // Resolve active tab from initialTab, URL path, or query parameter
  const resolveTab = (): 'leads' | 'projects' | 'sources' | 'settings' => {
    if (initialTab) return initialTab;
    const pathname = location.pathname.replace(/^\//, '');
    if (pathname === 'monitored-condos') return 'projects';
    if (pathname === 'collection-sources') return 'sources';
    if (pathname === 'scan-settings') return 'settings';
    if (pathname === 'property-leads') return 'leads';
    const sp = new URLSearchParams(location.search);
    const t = sp.get('tab');
    if (t === 'projects' || t === 'sources' || t === 'settings' || t === 'leads') {
      return t;
    }
    return 'leads';
  };

  const [activeTab, setActiveTab] = useState<'leads' | 'projects' | 'sources' | 'settings'>(resolveTab);

  useEffect(() => {
    const current = resolveTab();
    if (current !== activeTab) {
      setActiveTab(current);
    }
  }, [location.pathname, location.search, initialTab]);

  const handleTabChange = (tab: 'leads' | 'projects' | 'sources' | 'settings') => {
    setActiveTab(tab);
    const routeMap = {
      leads: '/property-leads',
      projects: '/monitored-condos',
      sources: '/collection-sources',
      settings: '/scan-settings',
    };
    navigate(routeMap[tab]);
  };

  // State
  const [stats, setStats] = useState<FinderOverviewStats | null>(null);
  const [projects, setProjects] = useState<FinderProject[]>([]);
  const [sources, setSources] = useState<FinderSource[]>([]);
  const [posts, setPosts] = useState<FinderPost[]>([]);
  const [totalPosts, setTotalPosts] = useState<number>(0);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters, Search & Pagination
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterClassification, setFilterClassification] = useState<string>('all');
  const [filterListingType, setFilterListingType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Debounce search input to keep search responsive without lag
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Modals
  const [selectedPost, setSelectedPost] = useState<FinderPost | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<FinderProject | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Telegram test state
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);

  const showToast = (msg: string) => {
    const lower = msg.toLowerCase();
    const isErr = lower.includes('fail') || lower.includes('error') || msg.includes('⚠️') || msg.includes('❌');
    showMacNotification({
      title: isErr ? 'Action Failed' : 'Notification',
      message: msg,
      type: isErr ? 'danger' : 'success',
    });
  };

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [st, pr, src, setts] = await Promise.all([
        fetchFinderOverview().catch(() => null),
        fetchFinderProjects().catch(() => []),
        fetchFinderSources().catch(() => []),
        fetchFinderSettings().catch(() => ({})),
      ]);
      if (st) setStats(st);
      setProjects(pr);
      setSources(src);
      setSettings(setts);
      await loadFilteredPosts();
    } catch (err: any) {
      showToast(err.message || 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadFilteredPosts = async () => {
    try {
      const res = await fetchFinderPosts({
        project_id: filterProject,
        classification: filterClassification,
        listing_type: filterListingType,
        search: debouncedSearch,
        sort_by: sortBy,
        page: currentPage,
        limit: pageSize,
      });
      setPosts(res.posts);
      setTotalPosts(res.total);
    } catch (_) {}
  };

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    loadFilteredPosts();
  }, [filterProject, filterClassification, filterListingType, debouncedSearch, sortBy, currentPage, pageSize]);

  // Dropdown options for Select component
  const projectSelectOptions = [
    { value: 'all', label: 'All Condominium Projects' },
    ...projects.map((p) => ({ value: String(p.id), label: p.project_name })),
  ];

  const classificationSelectOptions = [
    { value: 'all', label: 'All Classifications' },
    { value: 'OWNER_CLAIMED', label: 'Direct Owner Claimed (เจ้าของขาย/เช่าเอง)' },
    { value: 'LIKELY_OWNER', label: 'Likely Direct Owner' },
    { value: 'AGENT', label: 'Real Estate Agent (นายหน้า)' },
    { value: 'PROPERTY_AGENCY', label: 'Property Agency' },
    { value: 'UNCLEAR', label: 'Unclear Classification' },
  ];

  const listingTypeSelectOptions = [
    { value: 'all', label: 'Rent or Sale (All)' },
    { value: 'RENT', label: 'Rent Only' },
    { value: 'SALE', label: 'Sale Only' },
  ];

  const sortSelectOptions = [
    { value: 'newest', label: 'Sort: Newest First' },
    { value: 'oldest', label: 'Sort: Oldest First' },
    { value: 'highest_confidence', label: 'Sort: Highest AI Confidence' },
    { value: 'lowest_price', label: 'Sort: Lowest Price' },
    { value: 'highest_price', label: 'Sort: Highest Price' },
    { value: 'largest_room', label: 'Sort: Largest Size' },
  ];

  const totalPages = Math.max(1, Math.ceil(totalPosts / pageSize));

  const handleToggleProject = async (id: number) => {
    try {
      await toggleFinderProject(id);
      const updated = await fetchFinderProjects();
      setProjects(updated);
      showToast('Project status updated');
    } catch (err: any) {
      showToast(err.message || 'Failed to toggle project');
    }
  };

  const handleDeleteProject = async (id: number) => {
    if (!window.confirm('Delete this condominium project configuration?')) return;
    try {
      await deleteFinderProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      showToast('Project deleted');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete');
    }
  };

  const handleDeletePost = async (id: number) => {
    try {
      await deleteFinderPost(id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
      const st = await fetchFinderOverview().catch(() => null);
      if (st) setStats(st);
      showToast('Post removed');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete post');
    }
  };

  const handleLoadSamples = async () => {
    setIsLoading(true);
    try {
      await loadSampleFinderPosts();
      await loadAllData();
      showToast('Loaded authentic Thai Facebook condo posts for testing!');
    } catch (err: any) {
      showToast(err.message || 'Failed to seed sample posts');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestTelegram = async () => {
    setIsTestingTelegram(true);
    try {
      const msg = await testTelegramNotification(settings['telegram_bot_token'], settings['telegram_chat_id']);
      showToast(msg || 'Telegram notification sent!');
    } catch (err: any) {
      showToast(err.message || 'Telegram test failed');
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateFinderSettings(settings);
      showToast('Settings saved successfully');
    } catch (err: any) {
      showToast(err.message || 'Failed to save settings');
    }
  };

  const handleCopyPostText = (text: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      showToast('Post text copied to clipboard!');
    }
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1440px', margin: '0 auto', color: 'var(--text-primary)' }}>
      {/* Toast Alert */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: isDark ? '#1C2128' : '#1E293B',
            color: '#FFFFFF',
            padding: '10px 18px',
            borderRadius: '8px',
            fontSize: '0.8125rem',
            boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            border: isDark ? '1px solid #30363D' : '1px solid #334155',
          }}
        >
          <FiCheckCircle size={15} style={{ color: '#10B981' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar matching Site Theme */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FaFacebook size={22} style={{ color: '#1877F2' }} />
            <h1 style={{ fontSize: '1.375rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              Facebook Property Scan
            </h1>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(37, 99, 235, 0.1)',
                color: 'var(--accent-primary)',
              }}
            >
              Local AI Engine
            </span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
            Identify direct-owner condominium advertisements and property leads from authorized Facebook content
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={handleLoadSamples}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              height: '34px',
              padding: '0 12px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Load realistic Thai sample posts"
          >
            <FiZap size={13} style={{ color: '#F59E0B' }} />
            <span>Load Demo Samples</span>
          </button>

          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              height: '34px',
              padding: '0 14px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              backgroundColor: 'var(--accent-primary)',
              color: '#FFFFFF',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <FiPlus size={14} />
            <span>Import Facebook Post</span>
          </button>
        </div>
      </div>

      {/* Overview Stats Cards matching Image 3 Theme */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '12px',
          marginBottom: '1.5rem',
        }}
      >
        <div style={cardBoxStyle(isDark)}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Total Collected
          </div>
          <div style={{ fontSize: '1.375rem', fontWeight: 700, marginTop: '4px', color: 'var(--text-primary)' }}>
            {stats?.total_collected || 0}
          </div>
        </div>

        <div style={cardBoxStyle(isDark)}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Relevant Leads
          </div>
          <div style={{ fontSize: '1.375rem', fontWeight: 700, marginTop: '4px', color: 'var(--accent-primary)' }}>
            {stats?.relevant_posts || 0}
          </div>
        </div>

        <div style={cardBoxStyle(isDark)}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Direct Owner Claims
          </div>
          <div style={{ fontSize: '1.375rem', fontWeight: 700, marginTop: '4px', color: '#10B981' }}>
            {stats?.owner_claimed || 0}
          </div>
        </div>

        <div style={cardBoxStyle(isDark)}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Likely Owners
          </div>
          <div style={{ fontSize: '1.375rem', fontWeight: 700, marginTop: '4px', color: '#06B6D4' }}>
            {stats?.likely_owner || 0}
          </div>
        </div>

        <div style={cardBoxStyle(isDark)}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Agents / Agencies
          </div>
          <div style={{ fontSize: '1.375rem', fontWeight: 700, marginTop: '4px', color: '#F59E0B' }}>
            {(stats?.likely_agent || 0) + (stats?.property_agency || 0)}
          </div>
        </div>

        <div style={cardBoxStyle(isDark)}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Duplicates Filtered
          </div>
          <div style={{ fontSize: '1.375rem', fontWeight: 700, marginTop: '4px', color: 'var(--text-muted)' }}>
            {stats?.duplicate_posts || 0}
          </div>
        </div>
      </div>

      {/* Category Filter Pills (Sub-nav Tabs matching Image 3 Theme) */}
      <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
          }}
        >
          <button
            type="button"
            onClick={() => handleTabChange('leads')}
            style={pillTabStyle(activeTab === 'leads')}
          >
            <FiSearch size={12} />
            <span>Property Leads ({totalPosts})</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('projects')}
            style={pillTabStyle(activeTab === 'projects')}
          >
            <FiLayers size={12} />
            <span>Monitored Condos ({projects.length})</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('sources')}
            style={pillTabStyle(activeTab === 'sources')}
          >
            <FiCompass size={12} />
            <span>Collection & Sources ({sources.length})</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('settings')}
            style={pillTabStyle(activeTab === 'settings')}
          >
            <FiSliders size={12} />
            <span>AI & Alerts Settings</span>
          </button>
        </div>
      </div>

      {/* TAB 1: PROPERTY LEADS */}
      {activeTab === 'leads' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Search & Custom Select Dropdowns Bar */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', flex: 1 }}>
              {/* Search Box with clear button */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  height: '38px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  flex: '1 1 240px',
                  maxWidth: '360px',
                  boxSizing: 'border-box',
                }}
              >
                <FiSearch size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search Thai/English text, project, author..."
                  style={{
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '0.8125rem',
                    width: '100%',
                  }}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setDebouncedSearch('');
                      setCurrentPage(1);
                    }}
                    style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                  >
                    <FiX size={13} />
                  </button>
                )}
              </div>

              {/* Custom React Select - Projects */}
              <Select
                options={projectSelectOptions}
                value={filterProject}
                onChange={(val) => {
                  setFilterProject(val);
                  setCurrentPage(1);
                }}
                placeholder="All Projects"
                width="210px"
                height="38px"
                isSearchable={true}
              />

              {/* Custom React Select - Classifications */}
              <Select
                options={classificationSelectOptions}
                value={filterClassification}
                onChange={(val) => {
                  setFilterClassification(val);
                  setCurrentPage(1);
                }}
                placeholder="All Classifications"
                width="210px"
                height="38px"
              />

              {/* Custom React Select - Listing Types */}
              <Select
                options={listingTypeSelectOptions}
                value={filterListingType}
                onChange={(val) => {
                  setFilterListingType(val);
                  setCurrentPage(1);
                }}
                placeholder="Rent or Sale"
                width="150px"
                height="38px"
              />

              {/* Custom React Select - Sorting */}
              <Select
                options={sortSelectOptions}
                value={sortBy}
                onChange={(val) => {
                  setSortBy(val);
                  setCurrentPage(1);
                }}
                placeholder="Sort By"
                width="190px"
                height="38px"
              />

              {/* Reset Filters */}
              <button
                type="button"
                onClick={() => {
                  setFilterProject('all');
                  setFilterClassification('all');
                  setFilterListingType('all');
                  setSearchTerm('');
                  setDebouncedSearch('');
                  setSortBy('newest');
                  setCurrentPage(1);
                }}
                style={{
                  height: '38px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                Reset Filters
              </button>
            </div>

            {/* View Switcher: Table vs Cards */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  display: 'inline-flex',
                  padding: '2px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  gap: '2px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: viewMode === 'table' ? 'var(--accent-primary)' : 'transparent',
                    color: viewMode === 'table' ? '#FFFFFF' : 'var(--text-secondary)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  title="DataTable View"
                >
                  <FiList size={13} />
                  <span>Table</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: viewMode === 'cards' ? 'var(--accent-primary)' : 'transparent',
                    color: viewMode === 'cards' ? '#FFFFFF' : 'var(--text-secondary)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  title="Card Grid View"
                >
                  <FiGrid size={13} />
                  <span>Cards</span>
                </button>
              </div>
            </div>
          </div>

          {/* Posts View: DataTable or Cards */}
          {posts.length === 0 ? (
            <div
              style={{
                padding: '3rem 1.5rem',
                textAlign: 'center',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
              }}
            >
              <FiSearch size={36} style={{ color: 'var(--text-muted)', marginBottom: '12px', opacity: 0.5 }} />
              <h3 style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                No Property Leads Found
              </h3>
              <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: 'var(--text-secondary)', maxWidth: '420px', marginInline: 'auto' }}>
                {searchTerm || filterProject !== 'all' || filterClassification !== 'all' || filterListingType !== 'all'
                  ? 'No posts matched the active filter combination. Click Reset Filters to view all leads.'
                  : 'Import Facebook post content directly or click "Load Demo Samples" above to inspect the pipeline.'}
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                {(searchTerm || filterProject !== 'all' || filterClassification !== 'all' || filterListingType !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterProject('all');
                      setFilterClassification('all');
                      setFilterListingType('all');
                      setSearchTerm('');
                      setDebouncedSearch('');
                      setSortBy('newest');
                      setCurrentPage(1);
                    }}
                    style={secondaryButtonStyle(isDark)}
                  >
                    Reset Filters
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(true)}
                  style={primaryButtonStyle}
                >
                  <FiPlus size={14} />
                  <span>Import Facebook Post</span>
                </button>
              </div>
            </div>
          ) : viewMode === 'table' ? (
            /* ==================================================== */
            /* 1. DATA TABLE VIEW                                    */
            /* ==================================================== */
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr
                      style={{
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
                        borderBottom: '1px solid var(--border-color)',
                        color: 'var(--text-muted)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      <th style={{ padding: '0.875rem 1rem' }}>Condo Project & Specs</th>
                      <th style={{ padding: '0.875rem 1rem' }}>AI Classification & Evidence</th>
                      <th style={{ padding: '0.875rem 1rem' }}>Listing & Price</th>
                      <th style={{ padding: '0.875rem 1rem' }}>Post Snippet</th>
                      <th style={{ padding: '0.875rem 1rem', width: '105px' }}>Date</th>
                      <th style={{ padding: '0.875rem 1rem', textAlign: 'right', width: '145px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {posts.map((post) => {
                      const analysis = post.analysis;
                      const cls = analysis?.owner_classification || 'UNCLEAR';
                      const isOwner = cls === 'OWNER_CLAIMED' || cls === 'LIKELY_OWNER';

                      let badgeVariant: 'green' | 'blue' | 'amber' | 'neutral' = 'neutral';
                      let badgeLabel = 'Unclear';
                      if (cls === 'OWNER_CLAIMED') {
                        badgeVariant = 'green';
                        badgeLabel = 'Direct Owner Claimed';
                      } else if (cls === 'LIKELY_OWNER') {
                        badgeVariant = 'blue';
                        badgeLabel = 'Likely Owner';
                      } else if (cls === 'AGENT') {
                        badgeVariant = 'amber';
                        badgeLabel = 'Agent';
                      } else if (cls === 'PROPERTY_AGENCY') {
                        badgeVariant = 'amber';
                        badgeLabel = 'Agency';
                      }

                      const formattedPrice = analysis?.rental_price
                        ? `฿${analysis.rental_price.toLocaleString()} / mo`
                        : analysis?.sale_price
                        ? `฿${analysis.sale_price.toLocaleString()}`
                        : null;

                      return (
                        <tr
                          key={post.id}
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            transition: 'background-color 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = isDark
                              ? 'rgba(255, 255, 255, 0.02)'
                              : 'rgba(0, 0, 0, 0.015)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          {/* 1. Condo Project & Specs */}
                          <td style={{ padding: '0.875rem 1rem', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={cardIconBoxStyle(isDark, isOwner)}>
                                {isOwner ? <FiUserCheck size={16} /> : <FiHome size={16} />}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                                  {post.project?.project_name || analysis?.project_name || 'Unspecified Project'}
                                </div>
                                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  {[
                                    analysis?.building ? `Bldg ${analysis.building}` : null,
                                    analysis?.floor ? `Fl ${analysis.floor}` : null,
                                    analysis?.size_sqm ? `${analysis.size_sqm} sq.m` : null,
                                    analysis?.bedrooms ? `${analysis.bedrooms} Bed` : null,
                                  ].filter(Boolean).join(' · ') || (post.project?.thai_name || 'Condo')}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 2. AI Classification & Evidence */}
                          <td style={{ padding: '0.875rem 1rem', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                              <span style={badgePillStyle(isDark, badgeVariant)}>
                                {badgeLabel}
                                {analysis?.confidence !== undefined ? ` · ${(analysis.confidence * 100).toFixed(0)}%` : ''}
                              </span>
                              {analysis?.evidence ? (
                                <span
                                  style={{
                                    fontSize: '0.6875rem',
                                    color: isOwner ? '#10B981' : 'var(--text-muted)',
                                    fontStyle: 'italic',
                                    maxWidth: '240px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    display: 'block',
                                  }}
                                  title={analysis.evidence}
                                >
                                  "{analysis.evidence}"
                                </span>
                              ) : null}
                            </div>
                          </td>

                          {/* 3. Listing & Price */}
                          <td style={{ padding: '0.875rem 1rem', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              {analysis?.listing_type && analysis.listing_type !== 'UNCLEAR' && (
                                <span style={{ ...badgePillStyle(isDark, 'blue'), alignSelf: 'flex-start' }}>
                                  {analysis.listing_type}
                                </span>
                              )}
                              <span style={{ fontWeight: 700, color: '#10B981', fontSize: '0.875rem' }}>
                                {formattedPrice || 'Price Unspecified'}
                              </span>
                            </div>
                          </td>

                          {/* 4. Content Snippet */}
                          <td style={{ padding: '0.875rem 1rem', verticalAlign: 'middle', maxWidth: '320px' }}>
                            <div>
                              <p
                                style={{
                                  margin: 0,
                                  color: 'var(--text-secondary)',
                                  fontSize: '0.78125rem',
                                  lineHeight: 1.4,
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                }}
                                title={post.post_text}
                              >
                                {post.post_text}
                              </p>
                              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '3px', display: 'block' }}>
                                {post.author_display_name || 'Facebook User'}
                                {post.source_group ? ` · ${post.source_group}` : ''}
                              </span>
                            </div>
                          </td>

                          {/* 5. Date */}
                          <td style={{ padding: '0.875rem 1rem', verticalAlign: 'middle', color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                            {new Date(post.created_at).toLocaleDateString()}
                          </td>

                          {/* 6. Actions */}
                          <td style={{ padding: '0.875rem 1rem', verticalAlign: 'middle', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedPost(post);
                                  setIsDetailModalOpen(true);
                                }}
                                style={{
                                  ...primaryButtonStyle,
                                  height: '30px',
                                  padding: '0 10px',
                                  fontSize: '0.6875rem',
                                }}
                                title="Inspect AI extraction & evidence"
                              >
                                <FiEye size={12} />
                                <span>Inspect</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopyPostText(post.post_text)}
                                style={{
                                  ...iconSquareButtonStyle(isDark),
                                  width: '30px',
                                  height: '30px',
                                }}
                                title="Copy raw text"
                              >
                                <FiCopy size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePost(post.id)}
                                style={{
                                  ...iconSquareButtonStyle(isDark, true),
                                  width: '30px',
                                  height: '30px',
                                }}
                                title="Delete lead"
                              >
                                <FiTrash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Pagination Bar */}
              <div
                style={{
                  padding: '0.75rem 1.25rem',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.015)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Showing <strong>{posts.length}</strong> of <strong>{totalPosts}</strong> property leads
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Rows:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF',
                        color: 'var(--text-primary)',
                        fontSize: '0.6875rem',
                        outline: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      style={{
                        ...iconSquareButtonStyle(isDark),
                        width: '28px',
                        height: '28px',
                        opacity: currentPage <= 1 ? 0.4 : 1,
                        cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                      }}
                      title="Previous Page"
                    >
                      <FiChevronLeft size={13} />
                    </button>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      style={{
                        ...iconSquareButtonStyle(isDark),
                        width: '28px',
                        height: '28px',
                        opacity: currentPage >= totalPages ? 0.4 : 1,
                        cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                      }}
                      title="Next Page"
                    >
                      <FiChevronRight size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ==================================================== */
            /* 2. CARD GRID VIEW (ALTERNATIVE VIEW)                 */
            /* ==================================================== */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                {posts.map((post) => {
                  const analysis = post.analysis;
                  const cls = analysis?.owner_classification || 'UNCLEAR';
                  const isOwner = cls === 'OWNER_CLAIMED' || cls === 'LIKELY_OWNER';

                  let badgeVariant: 'green' | 'blue' | 'amber' | 'neutral' = 'neutral';
                  let badgeLabel = 'Unclear';
                  if (cls === 'OWNER_CLAIMED') {
                    badgeVariant = 'green';
                    badgeLabel = 'Direct Owner Claimed';
                  } else if (cls === 'LIKELY_OWNER') {
                    badgeVariant = 'blue';
                    badgeLabel = 'Likely Owner';
                  } else if (cls === 'AGENT') {
                    badgeVariant = 'amber';
                    badgeLabel = 'Agent';
                  } else if (cls === 'PROPERTY_AGENCY') {
                    badgeVariant = 'amber';
                    badgeLabel = 'Agency';
                  }

                  return (
                    <div
                      key={post.id}
                      style={{
                        borderRadius: '12px',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        padding: '1.25rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.875rem',
                        boxShadow: 'var(--shadow-sm)',
                        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-color-hover)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                      }}
                    >
                      {/* Top: Icon + Title & Specs + Right Badges & Price */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                          <div style={cardIconBoxStyle(isDark, isOwner)}>
                            {isOwner ? <FiUserCheck /> : <FiHome />}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <h3
                                style={{
                                  margin: 0,
                                  fontSize: '0.9375rem',
                                  fontWeight: 600,
                                  color: 'var(--text-primary)',
                                }}
                              >
                                {post.project?.project_name || analysis?.project_name || 'Unspecified Project'}
                              </h3>
                              <span style={badgePillStyle(isDark, badgeVariant)}>
                                {badgeLabel}
                                {analysis?.confidence !== undefined ? ` · ${(analysis.confidence * 100).toFixed(0)}%` : ''}
                              </span>
                              {analysis?.listing_type && analysis.listing_type !== 'UNCLEAR' && (
                                <span style={badgePillStyle(isDark, 'blue')}>
                                  {analysis.listing_type}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                              {[
                                analysis?.building ? `Building ${analysis.building}` : null,
                                analysis?.floor ? `Floor ${analysis.floor}` : null,
                                analysis?.size_sqm ? `${analysis.size_sqm} sq.m` : null,
                                post.source_group || 'Facebook Post',
                              ].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                        </div>

                        {/* Price on right */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#10B981' }}>
                            {analysis?.rental_price ? `฿${analysis.rental_price.toLocaleString()} / mo` : analysis?.sale_price ? `฿${analysis.sale_price.toLocaleString()}` : ''}
                          </div>
                        </div>
                      </div>

                      {/* Snippet */}
                      <p
                        style={{
                          fontSize: '0.8125rem',
                          color: 'var(--text-secondary)',
                          margin: 0,
                          lineHeight: '1.5',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {post.post_text}
                      </p>

                      {/* Evidence quote if owner */}
                      {analysis?.evidence && isOwner && (
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: '#10B981',
                            backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.06)',
                            border: isDark ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(16, 185, 129, 0.25)',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            fontStyle: 'italic',
                          }}
                        >
                          AI Direct Evidence: "{analysis.evidence}"
                        </div>
                      )}

                      {/* Card Actions Footer matching Image 3 Theme */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                          paddingTop: '0.75rem',
                          borderTop: '1px solid var(--border-color)',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                          {post.author_display_name || 'Author'} · {new Date(post.collected_at).toLocaleDateString()}
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
                                fontSize: '0.75rem',
                                color: 'var(--text-muted)',
                                textDecoration: 'none',
                                marginRight: '4px',
                              }}
                            >
                              <span>Link</span>
                              <FiExternalLink size={11} />
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => handleCopyPostText(post.post_text)}
                            style={iconSquareButtonStyle(isDark)}
                            title="Copy raw post content"
                          >
                            <FiCopy size={13} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeletePost(post.id)}
                            style={iconSquareButtonStyle(isDark, true)}
                            title="Delete lead record"
                          >
                            <FiTrash2 size={13} />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPost(post);
                              setIsDetailModalOpen(true);
                            }}
                            style={primaryButtonStyle}
                          >
                            <FiEye size={13} />
                            <span>Inspect AI Details</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Cards Pagination Bar */}
              <div
                style={{
                  padding: '0.75rem 1.25rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px',
                  backgroundColor: 'var(--bg-secondary)',
                }}
              >
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Showing <strong>{posts.length}</strong> of <strong>{totalPosts}</strong> property leads
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      style={{
                        ...iconSquareButtonStyle(isDark),
                        width: '28px',
                        height: '28px',
                        opacity: currentPage <= 1 ? 0.4 : 1,
                        cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <FiChevronLeft size={13} />
                    </button>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      style={{
                        ...iconSquareButtonStyle(isDark),
                        width: '28px',
                        height: '28px',
                        opacity: currentPage >= totalPages ? 0.4 : 1,
                        cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <FiChevronRight size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MONITORED CONDO PROJECTS matching Image 3 Card Grid Theme */}
      {activeTab === 'projects' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Condominium Search Projects</h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', margin: 0 }}>
                Configure Thai and English keywords, price targets, and owner/agent identification rules per condominium.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingProject(null);
                setIsProjectModalOpen(true);
              }}
              style={primaryButtonStyle}
            >
              <FiPlus size={14} />
              <span>Add New Condo</span>
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '14px',
            }}
          >
            {projects.map((proj) => (
              <div
                key={proj.id}
                style={{
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
              >
                {/* Top: Icon + Name + Monitoring Pill */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                    <div style={cardIconBoxStyle(isDark, proj.enabled)}>
                      <FiLayers />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {proj.project_name}
                      </h3>
                      {proj.thai_name && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {proj.thai_name}
                        </div>
                      )}
                    </div>
                  </div>

                  <span style={badgePillStyle(isDark, proj.enabled ? 'green' : 'neutral')}>
                    {proj.enabled ? 'Monitoring Active' : 'Paused'}
                  </span>
                </div>

                {/* Specs Box */}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div><strong>Keywords:</strong> {proj.keywords_thai || proj.keywords_english || 'None'}</div>
                  {proj.target_min_price > 0 && (
                    <div>
                      <strong>Target Price:</strong> ฿{proj.target_min_price.toLocaleString()} - ฿{proj.target_max_price.toLocaleString()}
                    </div>
                  )}
                  {proj.target_min_size_sqm > 0 && (
                    <div>
                      <strong>Target Size:</strong> {proj.target_min_size_sqm} - {proj.target_max_size_sqm} sq.m
                    </div>
                  )}
                </div>

                {/* Actions Footer matching Image 3 Theme */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--border-color)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProject(proj);
                      setIsProjectModalOpen(true);
                    }}
                    style={{ ...primaryButtonStyle, flex: 1 }}
                  >
                    <span>Edit Configuration</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleProject(proj.id)}
                    style={secondaryButtonStyle(isDark)}
                  >
                    <span>{proj.enabled ? 'Pause' : 'Activate'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteProject(proj.id)}
                    style={iconSquareButtonStyle(isDark, true)}
                    title="Delete project"
                  >
                    <FiTrash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: COLLECTION & SOURCES matching Image 3 Theme */}
      {activeTab === 'sources' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Collection Adapters & Data Sources</h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', margin: 0 }}>
              The system cleanly separates Facebook content collection from AI processing. We respect platform policies and provide clear authorization statuses.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
            {sources.map((src) => (
              <div
                key={src.id}
                style={{
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={cardIconBoxStyle(isDark, src.authorization_status === 'authorized')}>
                      <FiCompass />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>{src.source_name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Type: {src.source_type}</div>
                    </div>
                  </div>
                  <span style={badgePillStyle(isDark, src.authorization_status === 'authorized' ? 'green' : 'amber')}>
                    {src.authorization_status.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  {src.source_type === 'local_browser'
                    ? 'Local browser profile connected via Playwright companion (port 9224). User maintains session control.'
                    : 'Permitted content manually imported by user (post text, image uploads, public post URLs).'}
                </div>
              </div>
            ))}
          </div>

          {/* Architecture notice */}
          <div
            style={{
              padding: '1.25rem',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              fontSize: '0.8125rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.6',
            }}
          >
            <strong style={{ color: 'var(--text-primary)' }}>Note on Facebook Groups API:</strong> Meta discontinued its Facebook Groups API in 2024. This application avoids unauthorized scraping of private groups and relies strictly on user-authorized content feeds, manual post imports, and user-initiated local browser sessions.
          </div>
        </div>
      )}

      {/* TAB 4: SETTINGS matching Image 3 Theme */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} style={{ maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>AI Engine & Notification Settings</h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', margin: 0 }}>
              Configure AI providers, conditional image poster OCR, and optional Telegram alerts.
            </p>
          </div>

          <div
            style={{
              padding: '1.25rem',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>AI Processing Provider</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={labelStyle}>Provider</label>
                <select
                  value={settings['ai_provider'] || 'openai'}
                  onChange={(e) => setSettings({ ...settings, ai_provider: e.target.value })}
                  style={filterInputStyle(isDark)}
                >
                  <option value="openai">OpenAI (Official API)</option>
                  <option value="gemini">Google Gemini AI</option>
                  <option value="local">Local Rule Engine (Offline)</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>AI Model</label>
                <input
                  type="text"
                  value={settings['ai_model'] || 'gpt-4o'}
                  onChange={(e) => setSettings({ ...settings, ai_model: e.target.value })}
                  style={filterInputStyle(isDark)}
                />
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', color: 'var(--text-primary)', cursor: 'pointer', marginTop: '4px' }}>
              <input
                type="checkbox"
                checked={settings['enable_image_analysis'] !== 'false'}
                onChange={(e) => setSettings({ ...settings, enable_image_analysis: e.target.checked ? 'true' : 'false' })}
              />
              <span>Enable Conditional Image Poster OCR & Analysis</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings['auto_deduplicate'] !== 'false'}
                onChange={(e) => setSettings({ ...settings, auto_deduplicate: e.target.checked ? 'true' : 'false' })}
              />
              <span>Automatic SHA256 Post Deduplication</span>
            </label>
          </div>

          {/* Telegram Settings */}
          <div
            style={{
              padding: '1.25rem',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Optional Telegram Bot Alerts</h3>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings['telegram_enabled'] === 'true'}
                onChange={(e) => setSettings({ ...settings, telegram_enabled: e.target.checked ? 'true' : 'false' })}
              />
              <span>Enable Telegram Bot Notifications</span>
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={labelStyle}>Telegram Bot Token</label>
                <input
                  type="password"
                  value={settings['telegram_bot_token'] || ''}
                  onChange={(e) => setSettings({ ...settings, telegram_bot_token: e.target.value })}
                  placeholder="123456789:ABC..."
                  style={filterInputStyle(isDark)}
                />
              </div>

              <div>
                <label style={labelStyle}>Telegram Chat ID</label>
                <input
                  type="text"
                  value={settings['telegram_chat_id'] || ''}
                  onChange={(e) => setSettings({ ...settings, telegram_chat_id: e.target.value })}
                  placeholder="-100123456789"
                  style={filterInputStyle(isDark)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '10px' }}>
              <button
                type="button"
                onClick={handleTestTelegram}
                disabled={isTestingTelegram || !settings['telegram_bot_token']}
                style={{
                  ...secondaryButtonStyle(isDark),
                  cursor: isTestingTelegram ? 'not-allowed' : 'pointer',
                }}
              >
                <FiSend size={12} />
                <span>{isTestingTelegram ? 'Sending Test...' : 'Send Test Notification'}</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            style={{
              ...primaryButtonStyle,
              height: '38px',
              padding: '0 20px',
              alignSelf: 'flex-start',
            }}
          >
            Save Settings
          </button>
        </form>
      )}

      {/* Modals */}
      <PostDetailModal
        post={selectedPost}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedPost(null);
        }}
        onPostUpdated={loadFilteredPosts}
        onDeletePost={handleDeletePost}
        isDark={isDark}
      />

      <ProjectModal
        isOpen={isProjectModalOpen}
        project={editingProject}
        onClose={() => {
          setIsProjectModalOpen(false);
          setEditingProject(null);
        }}
        onSave={async (proj) => {
          if (editingProject) {
            await updateFinderProject(editingProject.id, proj);
          } else {
            await createFinderProject(proj);
          }
          const updated = await fetchFinderProjects();
          setProjects(updated);
          showToast('Project saved successfully');
        }}
        isDark={isDark}
      />

      <ManualImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={async (post) => {
          await loadAllData();
          showToast(`Imported post #${post.id} successfully!`);
        }}
        isDark={isDark}
      />
    </div>
  );
};

// Helper style generators matching Image 3 Theme
const cardBoxStyle = (_isDark: boolean): React.CSSProperties => ({
  borderRadius: '12px',
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
  padding: '1.125rem 1.25rem',
  boxShadow: 'var(--shadow-sm)',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
});

const pillTabStyle = (isActive: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 14px',
  borderRadius: '6px',
  border: 'none',
  backgroundColor: isActive ? 'var(--accent-primary)' : 'transparent',
  color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
  fontSize: '0.75rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
});

const primaryButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  height: '34px',
  padding: '0 14px',
  fontSize: '0.75rem',
  fontWeight: 600,
  borderRadius: '6px',
  border: 'none',
  backgroundColor: 'var(--accent-primary)',
  color: '#FFFFFF',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};

const secondaryButtonStyle = (isDark: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  height: '34px',
  padding: '0 12px',
  fontSize: '0.75rem',
  fontWeight: 600,
  borderRadius: '6px',
  border: '1px solid var(--border-color)',
  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
});

const iconSquareButtonStyle = (isDark: boolean, isDanger?: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '34px',
  height: '34px',
  borderRadius: '6px',
  border: isDanger ? (isDark ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(239, 68, 68, 0.25)') : '1px solid var(--border-color)',
  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF',
  color: isDanger ? '#EF4444' : 'var(--text-secondary)',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  flexShrink: 0,
});

const cardIconBoxStyle = (isDark: boolean, isAccent?: boolean): React.CSSProperties => ({
  width: '36px',
  height: '36px',
  borderRadius: '8px',
  backgroundColor: isAccent
    ? (isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(37, 99, 235, 0.08)')
    : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'),
  color: isAccent ? 'var(--accent-primary)' : 'var(--text-secondary)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '1.05rem',
  flexShrink: 0,
});

const badgePillStyle = (isDark: boolean, variant: 'blue' | 'green' | 'amber' | 'neutral' = 'neutral'): React.CSSProperties => {
  let bg = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
  let color = 'var(--text-secondary)';
  if (variant === 'blue') {
    bg = isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(37, 99, 235, 0.1)';
    color = 'var(--accent-primary)';
  } else if (variant === 'green') {
    bg = isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)';
    color = '#10B981';
  } else if (variant === 'amber') {
    bg = isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.1)';
    color = '#F59E0B';
  }
  return {
    fontSize: '0.6875rem',
    fontWeight: 600,
    padding: '3px 8px',
    borderRadius: '6px',
    backgroundColor: bg,
    color: color,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  display: 'block',
  marginBottom: '4px',
};

const filterInputStyle = (isDark: boolean): React.CSSProperties => ({
  height: '38px',
  padding: '0 10px',
  borderRadius: '8px',
  border: '1px solid var(--border-color)',
  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF',
  color: 'var(--text-primary)',
  fontSize: '0.8125rem',
  boxSizing: 'border-box',
  outline: 'none',
});
