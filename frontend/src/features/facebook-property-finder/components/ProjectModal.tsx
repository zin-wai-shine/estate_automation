import React, { useState, useEffect } from 'react';
import { FiX, FiCheck, FiLayers } from 'react-icons/fi';
import type { FinderProject } from '../types';

interface ProjectModalProps {
  isOpen: boolean;
  project: FinderProject | null;
  onClose: () => void;
  onSave: (proj: Partial<FinderProject>) => Promise<void>;
  isDark?: boolean;
}

const PRESETS: Record<string, Partial<FinderProject>> = {
  'regent-bangna': {
    project_name: 'Regent Home Bangna',
    thai_name: 'รีเจ้นท์ โฮม บางนา',
    english_name: 'Regent Home Bangna',
    alternative_spellings: 'Regent Bangna, รีเจ้นท์ บางนา, Regent Home บางนา',
    keywords_thai: 'รีเจ้นท์ โฮม บางนา, รีเจ้นท์บางนา, คอนโดบางนา, สรรพาวุธ',
    keywords_english: 'Regent Home Bangna, Regent Bangna, Sanphawut',
    property_type: 'CONDO',
    listing_type: 'ANY',
    target_min_price: 6000,
    target_max_price: 15000,
    target_min_size_sqm: 28,
    target_max_size_sqm: 35,
    owner_keywords: 'เจ้าของปล่อยเช่าเอง, เจ้าของขายเอง, ปล่อยเช่าเอง, ขายเอง, ห้องตัวเอง, ไม่ผ่านนายหน้า, ติดต่อเจ้าของโดยตรง',
    agent_exclusion_keywords: 'รับฝากขาย, รับฝากเช่า, นายหน้า, รับหาห้อง, มีห้องในมือ, บริษัทอสังหา, co-agent, ยินดีรับโค',
    image_analysis_enabled: true,
  },
  'aspire-erawan': {
    project_name: 'Aspire Erawan Prime',
    thai_name: 'แอสปาย เอราวัณ ไพร์ม',
    english_name: 'Aspire Erawan Prime',
    alternative_spellings: 'Aspire Erawan, แอสปาย เอราวัณ',
    keywords_thai: 'แอสปาย เอราวัณ ไพร์ม, แอสปาย เอราวัณ, BTS ช้างเอราวัณ',
    keywords_english: 'Aspire Erawan Prime, Aspire Erawan, BTS Chang Erawan',
    property_type: 'CONDO',
    listing_type: 'ANY',
    target_min_price: 7000,
    target_max_price: 18000,
    target_min_size_sqm: 27,
    target_max_size_sqm: 40,
    owner_keywords: 'เจ้าของปล่อยเช่าเอง, เจ้าของขายเอง, ปล่อยเช่าเอง, ขายเอง, ห้องตัวเอง, ไม่ผ่านนายหน้า',
    agent_exclusion_keywords: 'รับฝากขาย, รับฝากเช่า, นายหน้า, รับหาห้อง, มีห้องในมือ, บริษัทอสังหา, co-agent',
    image_analysis_enabled: true,
  },
  'metropolis-samrong': {
    project_name: 'The Metropolis Samrong',
    thai_name: 'เดอะ เมโทรโพลิส สำโรง',
    english_name: 'The Metropolis Samrong',
    alternative_spellings: 'Metropolis Samrong, เมโทรโพลิส สำโรง',
    keywords_thai: 'เดอะ เมโทรโพลิส สำโรง, เมโทรโพลิส สำโรง, BTS สำโรง',
    keywords_english: 'The Metropolis Samrong, Metropolis Samrong, BTS Samrong',
    property_type: 'CONDO',
    listing_type: 'ANY',
    target_min_price: 8000,
    target_max_price: 22000,
    target_min_size_sqm: 28,
    target_max_size_sqm: 55,
    owner_keywords: 'เจ้าของปล่อยเช่าเอง, เจ้าของขายเอง, ปล่อยเช่าเอง, ขายเอง, ห้องตัวเอง, ไม่ผ่านนายหน้า',
    agent_exclusion_keywords: 'รับฝากขาย, รับฝากเช่า, นายหน้า, บริษัทอสังหา',
    image_analysis_enabled: true,
  },
  'ideo-o2': {
    project_name: 'Ideo O2 Bangna',
    thai_name: 'ไอดีโอ โอทู บางนา',
    english_name: 'Ideo O2 Bangna',
    alternative_spellings: 'Ideo O2, ไอดีโอ โอทู',
    keywords_thai: 'ไอดีโอ โอทู บางนา, ไอดีโอ โอทู, BTS บางนา, สรรพาวุธ',
    keywords_english: 'Ideo O2 Bangna, Ideo O2, BTS Bangna',
    property_type: 'CONDO',
    listing_type: 'ANY',
    target_min_price: 9000,
    target_max_price: 25000,
    target_min_size_sqm: 26,
    target_max_size_sqm: 53,
    owner_keywords: 'เจ้าของปล่อยเช่าเอง, เจ้าของขายเอง, ปล่อยเช่าเอง, ขายเอง, ห้องตัวเอง, ไม่ผ่านนายหน้า',
    agent_exclusion_keywords: 'รับฝากขาย, รับฝากเช่า, นายหน้า, บริษัทอสังหา, co-agent',
    image_analysis_enabled: true,
  },
  'regent-wutthakat': {
    project_name: 'Regent Home Wutthakat',
    thai_name: 'รีเจ้นท์ โฮม วุฒากาศ',
    english_name: 'Regent Home Wutthakat',
    alternative_spellings: 'Regent Wutthakat, รีเจ้นท์ วุฒากาศ',
    keywords_thai: 'รีเจ้นท์ โฮม วุฒากาศ, รีเจ้นท์ วุฒากาศ, BTS วุฒากาศ',
    keywords_english: 'Regent Home Wutthakat, Regent Wutthakat, BTS Wutthakat',
    property_type: 'CONDO',
    listing_type: 'ANY',
    target_min_price: 6500,
    target_max_price: 14000,
    target_min_size_sqm: 28,
    target_max_size_sqm: 35,
    owner_keywords: 'เจ้าของปล่อยเช่าเอง, เจ้าของขายเอง, ปล่อยเช่าเอง, ขายเอง, ห้องตัวเอง, ไม่ผ่านนายหน้า',
    agent_exclusion_keywords: 'รับฝากขาย, รับฝากเช่า, นายหน้า, บริษัทอสังหา, co-agent',
    image_analysis_enabled: true,
  },
  'the-room': {
    project_name: 'The Room Ratchada–Lat Phrao',
    thai_name: 'เดอะ รูม รัชดา-ลาดพร้าว',
    english_name: 'The Room Ratchada-Lat Phrao',
    alternative_spellings: 'The Room Ratchada, เดอะ รูม รัชดา',
    keywords_thai: 'เดอะ รูม รัชดา-ลาดพร้าว, เดอะ รูม รัชดา, MRT ลาดพร้าว',
    keywords_english: 'The Room Ratchada-Lat Phrao, The Room Ratchada, MRT Lat Phrao',
    property_type: 'CONDO',
    listing_type: 'ANY',
    target_min_price: 12000,
    target_max_price: 35000,
    target_min_size_sqm: 35,
    target_max_size_sqm: 65,
    owner_keywords: 'เจ้าของปล่อยเช่าเอง, เจ้าของขายเอง, ปล่อยเช่าเอง, ขายเอง, ห้องตัวเอง, ไม่ผ่านนายหน้า',
    agent_exclusion_keywords: 'รับฝากขาย, รับฝากเช่า, นายหน้า, บริษัทอสังหา, co-agent',
    image_analysis_enabled: true,
  },
};

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  project,
  onClose,
  onSave,
  isDark = true,
}) => {
  const [formData, setFormData] = useState<Partial<FinderProject>>({
    project_name: '',
    thai_name: '',
    english_name: '',
    alternative_spellings: '',
    keywords_thai: '',
    keywords_english: '',
    property_type: 'CONDO',
    listing_type: 'ANY',
    target_min_price: 0,
    target_max_price: 0,
    target_min_size_sqm: 0,
    target_max_size_sqm: 0,
    owner_keywords: 'เจ้าของปล่อยเช่าเอง, เจ้าของขายเอง, ปล่อยเช่าเอง, ขายเอง, ห้องตัวเอง, ไม่ผ่านนายหน้า',
    agent_exclusion_keywords: 'รับฝากขาย, รับฝากเช่า, นายหน้า, รับหาห้อง, มีห้องในมือ, บริษัทอสังหา, co-agent',
    image_analysis_enabled: true,
    enabled: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (project) {
      setFormData(project);
    } else {
      setFormData({
        project_name: '',
        thai_name: '',
        english_name: '',
        alternative_spellings: '',
        keywords_thai: '',
        keywords_english: '',
        property_type: 'CONDO',
        listing_type: 'ANY',
        target_min_price: 0,
        target_max_price: 0,
        target_min_size_sqm: 0,
        target_max_size_sqm: 0,
        owner_keywords: 'เจ้าของปล่อยเช่าเอง, เจ้าของขายเอง, ปล่อยเช่าเอง, ขายเอง, ห้องตัวเอง, ไม่ผ่านนายหน้า',
        agent_exclusion_keywords: 'รับฝากขาย, รับฝากเช่า, นายหน้า, รับหาห้อง, มีห้องในมือ, บริษัทอสังหา, co-agent',
        image_analysis_enabled: true,
        enabled: true,
      });
    }
    setErrorMsg(null);
  }, [project, isOpen]);

  if (!isOpen) return null;

  const handleApplyPreset = (key: string) => {
    const preset = PRESETS[key];
    if (preset) {
      setFormData((prev) => ({ ...prev, ...preset }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.project_name?.trim()) {
      setErrorMsg('Project Name is required');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onSave(formData);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '700px',
          maxHeight: '90vh',
          backgroundColor: isDark ? '#161B22' : '#FFFFFF',
          borderRadius: '12px',
          border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 0.15s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: isDark ? '#0D1117' : '#F8FAFC',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiLayers size={18} style={{ color: 'var(--accent-primary)' }} />
            <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              {project ? 'Edit Condo Project Configuration' : 'Add Monitored Condo Project'}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <FiX size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {errorMsg && (
            <div style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', fontSize: '0.8125rem' }}>
              {errorMsg}
            </div>
          )}

          {/* Quick Presets Picker */}
          {!project && (
            <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: isDark ? '#0D1117' : '#F8FAFC', border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                ⚡ Quick Pre-Fill From Example Condos
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <button type="button" onClick={() => handleApplyPreset('regent-bangna')} style={presetBtnStyle(isDark)}>Regent Home Bangna</button>
                <button type="button" onClick={() => handleApplyPreset('aspire-erawan')} style={presetBtnStyle(isDark)}>Aspire Erawan Prime</button>
                <button type="button" onClick={() => handleApplyPreset('metropolis-samrong')} style={presetBtnStyle(isDark)}>The Metropolis Samrong</button>
                <button type="button" onClick={() => handleApplyPreset('ideo-o2')} style={presetBtnStyle(isDark)}>Ideo O2 Bangna</button>
                <button type="button" onClick={() => handleApplyPreset('regent-wutthakat')} style={presetBtnStyle(isDark)}>Regent Home Wutthakat</button>
                <button type="button" onClick={() => handleApplyPreset('the-room')} style={presetBtnStyle(isDark)}>The Room Ratchada–Lat Phrao</button>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Project Name (English/Display) *</label>
              <input
                type="text"
                value={formData.project_name || ''}
                onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                placeholder="e.g. Regent Home Bangna"
                style={inputStyle(isDark)}
                required
              />
            </div>

            <div>
              <label style={labelStyle}>Thai Name (ชื่อไทย)</label>
              <input
                type="text"
                value={formData.thai_name || ''}
                onChange={(e) => setFormData({ ...formData, thai_name: e.target.value })}
                placeholder="e.g. รีเจ้นท์ โฮม บางนา"
                style={inputStyle(isDark)}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Alternative Spellings & Abbreviations (Comma-separated)</label>
            <input
              type="text"
              value={formData.alternative_spellings || ''}
              onChange={(e) => setFormData({ ...formData, alternative_spellings: e.target.value })}
              placeholder="e.g. Regent Bangna, รีเจ้นท์ บางนา, Regent Home บางนา"
              style={inputStyle(isDark)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Thai Search Keywords</label>
              <textarea
                rows={2}
                value={formData.keywords_thai || ''}
                onChange={(e) => setFormData({ ...formData, keywords_thai: e.target.value })}
                placeholder="e.g. รีเจ้นท์ โฮม บางนา, รีเจ้นท์บางนา, สรรพาวุธ"
                style={textareaStyle(isDark)}
              />
            </div>

            <div>
              <label style={labelStyle}>English Search Keywords</label>
              <textarea
                rows={2}
                value={formData.keywords_english || ''}
                onChange={(e) => setFormData({ ...formData, keywords_english: e.target.value })}
                placeholder="e.g. Regent Home Bangna, Regent Bangna, Sanphawut"
                style={textareaStyle(isDark)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Listing Type Preference</label>
              <select
                value={formData.listing_type || 'ANY'}
                onChange={(e) => setFormData({ ...formData, listing_type: e.target.value })}
                style={inputStyle(isDark)}
              >
                <option value="ANY">Any (Rent or Sale)</option>
                <option value="RENT">Rental Only (ให้เช่า)</option>
                <option value="SALE">Sale Only (ขาย)</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Target Price Min - Max (THB)</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <input
                  type="number"
                  value={formData.target_min_price || ''}
                  onChange={(e) => setFormData({ ...formData, target_min_price: Number(e.target.value) })}
                  placeholder="Min"
                  style={inputStyle(isDark)}
                />
                <input
                  type="number"
                  value={formData.target_max_price || ''}
                  onChange={(e) => setFormData({ ...formData, target_max_price: Number(e.target.value) })}
                  placeholder="Max"
                  style={inputStyle(isDark)}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Target Size Min - Max (sq.m)</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <input
                  type="number"
                  value={formData.target_min_size_sqm || ''}
                  onChange={(e) => setFormData({ ...formData, target_min_size_sqm: Number(e.target.value) })}
                  placeholder="Min"
                  style={inputStyle(isDark)}
                />
                <input
                  type="number"
                  value={formData.target_max_size_sqm || ''}
                  onChange={(e) => setFormData({ ...formData, target_max_size_sqm: Number(e.target.value) })}
                  placeholder="Max"
                  style={inputStyle(isDark)}
                />
              </div>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Owner-Identification Keywords</label>
            <textarea
              rows={2}
              value={formData.owner_keywords || ''}
              onChange={(e) => setFormData({ ...formData, owner_keywords: e.target.value })}
              placeholder="เจ้าของปล่อยเช่าเอง, เจ้าของขายเอง, ปล่อยเช่าเอง, ห้องตัวเอง, ไม่ผ่านนายหน้า"
              style={textareaStyle(isDark)}
            />
          </div>

          <div>
            <label style={labelStyle}>Agent-Exclusion Keywords</label>
            <textarea
              rows={2}
              value={formData.agent_exclusion_keywords || ''}
              onChange={(e) => setFormData({ ...formData, agent_exclusion_keywords: e.target.value })}
              placeholder="รับฝากขาย, รับฝากเช่า, นายหน้า, รับหาห้อง, มีห้องในมือ, บริษัทอสังหา, co-agent"
              style={textareaStyle(isDark)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', paddingTop: '4px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.image_analysis_enabled !== false}
                onChange={(e) => setFormData({ ...formData, image_analysis_enabled: e.target.checked })}
              />
              <span>Enable Conditional Poster OCR & Image Analysis</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.enabled !== false}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              />
              <span>Active Monitoring</span>
            </label>
          </div>
        </form>

        {/* Footer */}
        <div
          style={{
            padding: '0.875rem 1.25rem',
            borderTop: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '8px',
            backgroundColor: isDark ? '#0D1117' : '#F8FAFC',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 500,
              backgroundColor: isDark ? '#21262D' : '#E2E8F0',
              color: 'var(--text-primary)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 16px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              backgroundColor: 'var(--accent-primary)',
              color: '#FFFFFF',
              border: 'none',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
            }}
          >
            <FiCheck size={14} />
            <span>{isSubmitting ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  display: 'block',
  marginBottom: '4px',
};

const inputStyle = (isDark: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '6px 10px',
  borderRadius: '6px',
  border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
  backgroundColor: isDark ? '#0D1117' : '#FFFFFF',
  color: 'var(--text-primary)',
  fontSize: '0.8125rem',
  boxSizing: 'border-box',
});

const textareaStyle = (isDark: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '6px 10px',
  borderRadius: '6px',
  border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
  backgroundColor: isDark ? '#0D1117' : '#FFFFFF',
  color: 'var(--text-primary)',
  fontSize: '0.8125rem',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  resize: 'vertical',
});

const presetBtnStyle = (isDark: boolean): React.CSSProperties => ({
  padding: '4px 8px',
  borderRadius: '4px',
  border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
  backgroundColor: isDark ? '#21262D' : '#FFFFFF',
  color: 'var(--text-primary)',
  fontSize: '0.6875rem',
  cursor: 'pointer',
});

