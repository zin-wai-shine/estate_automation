import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { 
  FiHome, 
  FiPlusSquare, 
  FiCheckCircle, 
  FiFolder, 
  FiSettings, 
  FiSliders,
  FiFileText,
  FiGitMerge,
  FiChevronRight,
  FiMenu,
  FiX,
  FiZap
} from 'react-icons/fi';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const activeTab = location.pathname.split('/')[1] || 'add-url';

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

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <FiHome /> },
    { id: 'add-url', label: 'Add URL', icon: <FiPlusSquare /> },
    { id: 'inbox', label: 'Property Inbox', icon: <FiPlusSquare /> },
    { id: 'review', label: 'Review Center', icon: <FiCheckCircle /> },
    { id: 'projects', label: 'Projects / Condos', icon: <FiFolder /> },
    { id: 'prompts', label: 'Prompt Templates', icon: <FiFileText /> },
    { id: 'workflow', label: 'Workflow Map', icon: <FiGitMerge /> },
    { id: 'automation', label: 'Automation & Sync', icon: <FiSliders /> },
    { id: 'testing', label: 'Testing', icon: <FiZap /> },
    { id: 'settings', label: 'Settings', icon: <FiSettings /> },
  ];

  const currentNav = navItems.find((item) => item.id === activeTab) || navItems[0];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>, id: string) => {
    if (e.metaKey || e.ctrlKey || e.button === 1) {
      // Command/Ctrl/Middle-click: Allow native browser behavior to open link in NEW TAB!
      return;
    }
    e.preventDefault();
    navigate(`/${id}`);
    setIsMobileOpen(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-main)' }}>
      {/* Full-Width Top Navigation Bar */}
      <header
        style={{
          height: '56px',
          width: '100%',
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          padding: isMobile ? '0 0.875rem' : 0,
        }}
      >
        {isMobile ? (
          /* Mobile Top Bar: Hamburger + Brand + Page Title + Settings */
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
                  borderRadius: '0.375rem',
                  backgroundColor: 'var(--bg-surface)',
                  flexShrink: 0,
                }}
                aria-label="Toggle Navigation Drawer"
              >
                {isMobileOpen ? <FiX /> : <FiMenu />}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', minWidth: 0, overflow: 'hidden' }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '0.375rem',
                    backgroundColor: 'var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '0.8125rem',
                    flexShrink: 0,
                  }}
                >
                  E
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                  <h1 style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {currentNav.label}
                  </h1>
                  <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>EstateAutomate</span>
                </div>
              </div>
            </div>

            <div id="header-action-portal" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }} />
          </div>
        ) : (
          /* Desktop Top Bar */
          <>
            {/* Top-Left: Sidebar Header (Brand Logo & Title) */}
            <div
              style={{
                width: '240px',
                minWidth: '240px',
                height: '100%',
                padding: '0 1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                borderRight: '1px solid var(--border-color)',
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '0.375rem',
                  backgroundColor: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '1rem',
                  flexShrink: 0,
                }}
              >
                E
              </div>
              <div>
                <h1 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2, margin: 0 }}>
                  EstateAutomate
                </h1>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                  Real Estate Platform
                </span>
              </div>
            </div>

            {/* Top-Right Header Content: Active Page Title & Action Portal */}
            <div
              style={{
                flex: 1,
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 1.25rem',
                gap: '1rem',
              }}
            >
              <div id="header-title-portal" style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                {activeTab !== 'testing' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1rem', color: 'var(--accent-primary)', display: 'inline-flex' }}>
                      {currentNav.icon}
                    </span>
                    <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                      {currentNav.label}
                    </h2>
                  </div>
                )}
              </div>
              <div id="header-center-portal" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }} />

              <div id="header-action-portal" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }} />
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

      {/* Sidebar Navigation (Positioned Below Top Nav Bar) */}
      <aside
        style={{
          width: '240px',
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
          transform: isMobile ? (isMobileOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: isMobile && isMobileOpen ? '4px 0 20px rgba(0, 0, 0, 0.5)' : 'none',
        }}
      >
        <div>
          {/* Vertical Menu Links */}
          <nav style={{ padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', padding: '0.25rem 0.5rem', marginBottom: '0.25rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Main Navigation
            </span>
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <a
                  key={item.id}
                  href={`/${item.id}`}
                  onClick={(e) => handleNavClick(e, item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '0.625rem 0.75rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.84375rem',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                    backgroundColor: isActive ? 'var(--accent-primary)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textDecoration: 'none',
                    boxSizing: 'border-box',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.05rem', display: 'inline-flex', opacity: isActive ? 1 : 0.85 }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {isActive && <FiChevronRight style={{ fontSize: '0.875rem' }} />}
                </a>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer - Settings Trigger */}
        <div style={{ padding: '0.75rem 0.625rem', borderTop: '1px solid var(--border-color)' }}>
          <a
            href="/settings"
            onClick={(e) => handleNavClick(e, 'settings')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.5rem 0.625rem',
              borderRadius: '0.375rem',
              backgroundColor: activeTab === 'settings' ? 'var(--accent-primary)' : 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              color: activeTab === 'settings' ? '#FFFFFF' : 'var(--text-primary)',
              cursor: 'pointer',
              transition: 'all 0.12s ease',
              textDecoration: 'none',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  backgroundColor: activeTab === 'settings' ? '#FFFFFF' : 'var(--accent-primary)',
                  color: activeTab === 'settings' ? 'var(--accent-primary)' : '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                {user?.name?.[0] || 'U'}
              </div>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: activeTab === 'settings' ? '#FFFFFF' : 'var(--text-primary)', lineHeight: 1.1, margin: 0 }}>
                  {user?.name}
                </p>
                <span style={{ fontSize: '0.625rem', color: activeTab === 'settings' ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)' }}>Settings</span>
              </div>
            </div>
            <FiSettings style={{ color: activeTab === 'settings' ? '#FFFFFF' : 'var(--text-muted)', fontSize: '0.875rem' }} />
          </a>
        </div>
      </aside>

      {/* Main Right Content Area */}
      <div style={{ flex: 1, marginLeft: isMobile ? 0 : '240px', marginTop: '56px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Page Content View */}
        <main style={{ flex: 1, padding: isMobile ? '0.875rem 0.75rem' : '1.25rem', maxWidth: '1400px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          {children}
        </main>
      </div>
    </div>
  );
};
