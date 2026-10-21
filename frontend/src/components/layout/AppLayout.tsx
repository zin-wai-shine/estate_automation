import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { 
  FiHome, 
  FiPlusSquare, 
  FiSettings, 
  FiFileText, 
  FiChevronRight, 
  FiMenu, 
  FiX, 
  FiZap, 
  FiGitBranch, 
  FiInbox, 
  FiSidebar, 
  FiLayers,
  FiShare2,
  FiClock,
  FiKey,
  FiShield,
  FiScissors,
  FiCpu,
} from 'react-icons/fi';
import { FaFacebook } from 'react-icons/fa';
import { getRemainingPostsCount, subscribeRemainingPosts } from '../../features/remaining-posts/remainingPostsStorage';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number | string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user } = useAuth();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';

  const location = useLocation();
  const navigate = useNavigate();

  const rawTab = location.pathname.split('/')[1] || 'add-url';
  const activeTab = rawTab === 'facebook-tokens' ? 'auth-manager' : rawTab;

  // Desktop sidebar collapse state
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ea_sidebar_collapsed') === 'true';
    }
    return false;
  });

  // Canvas mode (toggle sidebar into collapsed mode without hiding it)
  const [isCanvasMode, setIsCanvasMode] = useState<boolean>(false);
  const previousCollapsedRef = useRef<boolean | null>(null);

  useEffect(() => {
    const handleSetCanvasMode = (e: Event) => {
      const customEvent = e as CustomEvent<{ active: boolean }>;
      const active = Boolean(customEvent.detail?.active);
      setIsCanvasMode(active);
      if (active) {
        // Toggle to collapsed icon-only sidebar and remember previous state
        previousCollapsedRef.current = isCollapsed;
        setIsCollapsed(true);
      } else {
        // Restore collapse state
        if (previousCollapsedRef.current !== null) {
          setIsCollapsed(previousCollapsedRef.current);
          previousCollapsedRef.current = null;
        }
      }
    };
    window.addEventListener('ea_set_canvas_mode', handleSetCanvasMode);
    return () => {
      window.removeEventListener('ea_set_canvas_mode', handleSetCanvasMode);
    };
  }, [isCollapsed]);

  useEffect(() => {
    setIsCanvasMode(false);
  }, [location.pathname]);

  // Mobile drawer state & screen size detection
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setIsMobileOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('ea_sidebar_collapsed', String(next));
      return next;
    });
  };

  const [remainingPostsCount, setRemainingPostsCount] = useState<number>(() => getRemainingPostsCount());

  useEffect(() => {
    const unsubscribe = subscribeRemainingPosts(() => {
      setRemainingPostsCount(getRemainingPostsCount());
    });
    return unsubscribe;
  }, []);

  // Structured sidebar navigation matching modern clean UI
  const navSections: NavSection[] = [
    {
      title: 'Workspace',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: <FiHome /> },
        { id: 'inbox', label: 'Property Inbox', icon: <FiInbox /> },
      ],
    },
    {
      title: 'Automation & AI',
      items: [
        { id: 'facebook-import', label: 'Facebook Import', icon: <FaFacebook /> },
        {
          id: 'remaining-posts',
          label: 'Remaining Posts',
          icon: <FiLayers />,
          badge: remainingPostsCount > 0 ? remainingPostsCount : undefined,
        },
        { id: 'create-workflow', label: 'Create Workflow', icon: <FiGitBranch /> },
        { id: 'ai-models', label: 'AI Models & History', icon: <FiCpu /> },
        { id: 'add-url', label: 'Add URL', icon: <FiPlusSquare /> },
        { id: 'prompts', label: 'Prompt Templates', icon: <FiFileText /> },
      ],
    },
    {
      title: 'Auto Post',
      items: [
        { id: 'auto-post', label: 'Auto Post', icon: <FiShare2 /> },
        { id: 'post-history', label: 'Post History', icon: <FiClock /> },
        { id: 'auth-manager', label: 'Auth Manager', icon: <FiKey /> },
      ],
    },
    {
      title: 'System & Tools',
      items: [
        { id: 'watermark', label: 'Crop & Cut Studio', icon: <FiScissors /> },
        { id: 'testing', label: 'Testing Lab', icon: <FiZap /> },
        { id: 'settings', label: 'Settings', icon: <FiSettings /> },
      ],
    },
  ];

  const allNavItems = navSections.flatMap((section) => section.items);
  const currentNav = allNavItems.find((item) => item.id === activeTab) || allNavItems[0];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>, id: string) => {
    if (e.metaKey || e.ctrlKey || e.button === 1) {
      return;
    }
    e.preventDefault();

    // If an in-flight workflow is actively processing, request permission before navigating away
    if (typeof (window as any).__workflowConfirmLeave === 'function') {
      (window as any).__workflowConfirmLeave(() => {
        navigate(`/${id}`);
        setIsMobileOpen(false);
      });
      return;
    }

    navigate(`/${id}`);
    setIsMobileOpen(false);
  };

  const currentSidebarWidth = isMobile ? '250px' : (isCollapsed ? '56px' : '250px');

  // Custom tooltip shown to the right of collapsed sidebar icons
  const [navTip, setNavTip] = useState<{ label: string; top: number; left: number } | null>(null);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-main)' }}>
      {navTip && isCollapsed && !isMobile && (
        <div
          role="tooltip"
          style={{
            position: 'fixed',
            top: navTip.top,
            left: navTip.left,
            transform: 'translateY(-50%)',
            zIndex: 1000,
            padding: '0.35rem 0.65rem',
            borderRadius: '8px',
            fontSize: '0.75rem',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            color: isDark ? '#F0F6FC' : '#0F172A',
            backgroundColor: isDark ? '#1C2128' : '#FFFFFF',
            border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
            boxShadow: isDark ? '0 6px 18px rgba(0,0,0,0.5)' : '0 6px 18px rgba(0,0,0,0.12)',
          }}
        >
          {navTip.label}
        </div>
      )}
      {/* Top Navigation Bar */}
      <header
        style={{
          height: '56px',
          width: '100%',
          backgroundColor: isCanvasMode ? 'transparent' : 'var(--bg-secondary)',
          borderBottom: isCanvasMode ? 'none' : (isMobile ? '1px solid var(--border-color)' : 'none'),
          display: 'flex',
          alignItems: 'center',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          padding: isMobile ? '0 0.875rem' : 0,
          pointerEvents: isCanvasMode ? 'none' : 'auto',
          boxShadow: isCanvasMode ? 'none' : undefined,
        }}
      >
        {isMobile ? (
          /* Mobile Top Bar */
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.375rem', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setIsMobileOpen(!isMobileOpen)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '1.125rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.375rem',
                  borderRadius: '0.5rem',
                  backgroundColor: 'var(--bg-surface)',
                  flexShrink: 0,
                }}
                aria-label="Toggle Navigation Drawer"
              >
                {isMobileOpen ? <FiX /> : <FiMenu />}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                  <h1 style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {currentNav.label}
                  </h1>
                  <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>BoltHavenProperty</span>
                </div>
              </div>
            </div>

            <div id="header-action-portal" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }} />
          </div>
        ) : (
          /* Desktop Top Bar */
          <>
            {/* Top-Left Brand Logo (Corner cell with border removed when collapsed) */}
            <div
              style={{
                width: currentSidebarWidth,
                minWidth: currentSidebarWidth,
                height: '100%',
                padding: isCollapsed ? '0 0.5rem' : '0 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                borderRight: '1px solid var(--border-color)',
                borderBottom: 'none',
                backgroundColor: isCanvasMode ? 'var(--bg-secondary)' : undefined,
                pointerEvents: isCanvasMode ? 'auto' : undefined,
                boxSizing: 'border-box',
                overflow: 'hidden',
                transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              {!isCollapsed ? (
                <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', textAlign: 'left' }}>
                  <h1 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2, margin: 0, letterSpacing: '-0.01em', textAlign: 'left' }}>
                    BoltHavenProperty
                  </h1>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textAlign: 'left', display: 'block' }}>
                    AI Automation Studio
                  </span>
                </div>
              ) : (
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                  BHP
                </span>
              )}
            </div>

            {/* Top-Right Header Content */}
            <div
              style={{
                flex: 1,
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 1.25rem',
                gap: '1rem',
                position: 'relative',
                borderBottom: isCanvasMode ? 'none' : '1px solid var(--border-color)',
                boxSizing: 'border-box',
                pointerEvents: 'none',
              }}
            >
              <div id="header-title-portal" style={{ display: 'flex', alignItems: 'center', minWidth: 0, zIndex: 5, pointerEvents: 'auto' }}>
                {!isCanvasMode && activeTab !== 'testing' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                        {currentNav.label}
                      </h2>
                    </div>
                    {activeTab !== 'watermark' && (
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                        Workflow Engine · Real Estate SaaS
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div
                id="header-center-portal"
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'auto',
                  zIndex: 10,
                }}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0, zIndex: 5, pointerEvents: 'auto' }}>
                <div id="header-action-portal" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, pointerEvents: 'auto' }} />
              </div>
            </div>
          </>
        )}
      </header>

      {/* Mobile Backdrop Overlay */}
      {isMobile && isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          style={{
            position: 'fixed',
            top: '56px',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(2px)',
            zIndex: 29,
          }}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        style={{
          width: currentSidebarWidth,
          backgroundColor: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'fixed',
          top: '56px',
          bottom: 0,
          left: 0,
          zIndex: 30,
          transform: isMobile
            ? (isMobileOpen ? 'translateX(0)' : 'translateX(-100%)')
            : 'none',
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
        }}
      >
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {/* Menu Sections */}
          <nav style={{ padding: isCollapsed ? '0.625rem 0.25rem' : '0.875rem 0.625rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {navSections.map((section, sIdx) => (
              <div key={section.title} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {/* Section Title */}
                {!isCollapsed ? (
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      padding: '0.5rem 0.625rem 0.25rem',
                    }}
                  >
                    {section.title}
                  </span>
                ) : (
                  sIdx > 0 && (
                    <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '0.375rem 0.5rem' }} />
                  )
                )}

                {/* Section Items */}
                {section.items.map((item) => {
                  const isActive = activeTab === item.id;

                  // Colors cleanly adapted for both light and dark mode with ZERO glow
                  const activeBg = isDark
                    ? 'rgba(59, 130, 246, 0.14)'
                    : 'rgba(37, 99, 235, 0.08)';
                  const activeBorder = isDark
                    ? '1px solid rgba(59, 130, 246, 0.28)'
                    : '1px solid rgba(37, 99, 235, 0.22)';
                  const activeTextColor = isDark
                    ? '#FFFFFF'
                    : '#1D4ED8';

                  const iconColor = isActive
                    ? (isDark ? '#60A5FA' : '#1D4ED8')
                    : 'var(--text-secondary)';

                  return (
                    <a
                      key={item.id}
                      href={`/${item.id}`}
                      onClick={(e) => handleNavClick(e, item.id)}
                      aria-label={isCollapsed ? item.label : undefined}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isCollapsed ? 'center' : 'space-between',
                        width: '100%',
                        padding: isCollapsed ? '0.5rem 0' : '0.5rem 0.625rem',
                        borderRadius: '0.625rem',
                        fontSize: '0.8125rem',
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? activeTextColor : 'var(--text-secondary)',
                        backgroundColor: isActive ? activeBg : 'transparent',
                        border: isActive ? activeBorder : '1px solid transparent',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
                        textDecoration: 'none',
                        boxSizing: 'border-box',
                        position: 'relative',
                      }}
                      onMouseEnter={(e) => {
                        if (isCollapsed) {
                          const r = e.currentTarget.getBoundingClientRect();
                          setNavTip({ label: item.label, top: r.top + r.height / 2, left: r.right + 10 });
                        }
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)';
                          e.currentTarget.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.07)';
                          e.currentTarget.style.color = 'var(--text-primary)';
                          const iconSpan = e.currentTarget.querySelector('.nav-item-icon') as HTMLElement | null;
                          if (iconSpan) iconSpan.style.color = 'var(--text-primary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        setNavTip(null);
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.borderColor = 'transparent';
                          e.currentTarget.style.color = 'var(--text-secondary)';
                          const iconSpan = e.currentTarget.querySelector('.nav-item-icon') as HTMLElement | null;
                          if (iconSpan) iconSpan.style.color = 'var(--text-secondary)';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
                        <span
                          className="nav-item-icon"
                          style={{
                            width: '20px',
                            height: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.125rem',
                            flexShrink: 0,
                            color: iconColor,
                            transition: 'color 0.15s ease',
                          }}
                        >
                          {item.icon}
                        </span>

                        {!isCollapsed && (
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.label}
                          </span>
                        )}
                      </div>

                      {/* Right Elements (Badge & Chevron) */}
                      {!isCollapsed && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          {item.badge !== undefined && (
                            <span
                              style={{
                                padding: '1px 6px',
                                borderRadius: '999px',
                                fontSize: '0.6875rem',
                                fontWeight: 700,
                                backgroundColor: isActive
                                  ? (isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(37, 99, 235, 0.15)')
                                  : (isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'),
                                color: isActive
                                  ? (isDark ? '#93C5FD' : '#1D4ED8')
                                  : 'var(--text-secondary)',
                              }}
                            >
                              {item.badge}
                            </span>
                          )}
                          {isActive && (
                            <FiChevronRight
                              style={{
                                fontSize: '0.75rem',
                                color: isDark ? '#60A5FA' : '#2563EB',
                              }}
                            />
                          )}
                        </div>
                      )}
                    </a>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Sidebar Footer Section */}
        <div style={{ borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
          {/* User Settings Row */}
          <div style={{ padding: isCollapsed ? '0.5rem 0.375rem' : '0.5rem 0.625rem' }}>
            <a
              href="/settings"
              onClick={(e) => handleNavClick(e, 'settings')}
              title={isCollapsed ? (user?.name || 'Settings') : undefined}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: isCollapsed ? 'center' : 'space-between',
                padding: isCollapsed ? '0.45rem 0' : '0.5rem 0.625rem',
                borderRadius: '0.5rem',
                backgroundColor: activeTab === 'settings' 
                  ? (isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(37, 99, 235, 0.08)')
                  : 'var(--bg-surface)',
                border: activeTab === 'settings'
                  ? `1px solid ${isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(37, 99, 235, 0.22)'}`
                  : '1px solid var(--border-color)',
                color: activeTab === 'settings' 
                  ? (isDark ? '#FFFFFF' : '#1D4ED8') 
                  : 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'all 0.12s ease',
                textDecoration: 'none',
                boxSizing: 'border-box',
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'settings') {
                  e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'settings') {
                  e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: isDark ? 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)' : 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {user?.name?.[0] || 'U'}
                </div>
                {!isCollapsed && (
                  <div style={{ textAlign: 'left', overflow: 'hidden' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.1, margin: 0, whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {user?.name || 'Administrator'}
                    </p>
                    <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>Settings</span>
                  </div>
                )}
              </div>
              {!isCollapsed && (
                <FiSettings style={{ color: activeTab === 'settings' ? (isDark ? '#60A5FA' : '#2563EB') : 'var(--text-muted)', fontSize: '0.875rem' }} />
              )}
            </a>
          </div>

          {/* Collapse Sidebar Button */}
          {!isMobile && (
            <div style={{ padding: '0.25rem 0.625rem 0.625rem', borderTop: '1px solid var(--border-color)' }}>
              <button
                type="button"
                onClick={toggleCollapse}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  gap: '0.5rem',
                  padding: '0.5rem 0.625rem',
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  borderRadius: '0.375rem',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--text-primary)';
                  e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-muted)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <FiSidebar style={{ fontSize: '0.9375rem', flexShrink: 0 }} />
                {!isCollapsed && <span>Collapse sidebar</span>}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Right Content Area */}
      <div
        style={{
          flex: 1,
          marginLeft: isMobile ? 0 : currentSidebarWidth,
          marginTop: isCanvasMode ? 0 : '56px',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          transition: 'margin-left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <main
          style={{
            flex: 1,
            padding: isCanvasMode ? 0 : (isMobile ? '0.875rem 0.75rem' : '1.25rem'),
            maxWidth: isCanvasMode ? '100%' : '1400px',
            width: '100%',
            margin: '0 auto',
            boxSizing: 'border-box',
            height: isCanvasMode ? '100vh' : 'auto',
            display: isCanvasMode ? 'flex' : 'block',
            flexDirection: isCanvasMode ? 'column' : 'initial',
            overflow: isCanvasMode ? 'hidden' : 'visible',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
};
