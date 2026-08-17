import React, { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardView } from './features/dashboard/DashboardView';
import { AddUrlView } from './features/addurl/AddUrlView';
import { PropertyInboxView } from './features/inbox/PropertyInboxView';
import { ReviewCenterView } from './features/review/ReviewCenterView';
import { ProjectsView } from './features/projects/ProjectsView';
import { PromptTemplatesView } from './features/prompts/PromptTemplatesView';
import { WorkflowMapView } from './features/workflow/WorkflowMapView';
import { AutomationSettingsView } from './features/automation/AutomationSettingsView';
import { TestingView } from './features/testing/TestingView';
import { SettingsView } from './features/settings/SettingsView';
import { FacebookLoginView } from './features/auth/FacebookLoginView';
import type { Property } from './types';

const initialProperties: Property[] = [
  {
    id: 1,
    code: 'BH260816-0001',
    projectName: 'Ashton Asoke',
    propertyType: 'CONDO',
    listingType: 'RENT',
    title: 'Luxury 1-Bed Condo at Ashton Asoke for Rent',
    description: 'Fully furnished 35 sqm 1-bedroom condo on 28th floor with city views.',
    rentPrice: 35000,
    bedrooms: 1,
    bathrooms: 1,
    sizeSqm: 35,
    status: 'NEW',
    sourceUrl: 'https://facebook.com/groups/realestate/posts/101',
    originalImages: ['img1.jpg', 'img2.jpg'],
    enhancedImages: ['enh1.jpg', 'enh2.jpg'],
    finalImages: ['final1.jpg', 'final2.jpg'],
    createdAt: 'Just now',
  },
  {
    id: 2,
    code: 'BH260816-0002',
    projectName: 'Ideo Sukhumvit 93',
    propertyType: 'CONDO',
    listingType: 'RENT',
    title: 'Modern High-Floor Studio at Ideo Sukhumvit 93',
    description: 'Beautiful 28 sqm studio next to BTS Bang Chak.',
    rentPrice: 18000,
    bedrooms: 1,
    bathrooms: 1,
    sizeSqm: 28,
    status: 'READY_FOR_REVIEW',
    sourceUrl: 'https://facebook.com/groups/realestate/posts/102',
    originalImages: ['img3.jpg'],
    enhancedImages: ['enh3.jpg'],
    finalImages: ['final3.jpg'],
    fbContent: {
      title: 'Modern High-Floor Studio at Ideo Sukhumvit 93',
      description: 'Beautiful 28 sqm studio next to BTS Bang Chak. Fully furnished with appliances.',
      price: '฿18,000 / month',
      cta: 'Contact Line ID: @estatebangkok',
      hashtags: '#IdeoSukhumvit93 #CondoForRent #BTSBangChak',
    },
    tikTokContent: {
      hook: 'Is this the best condo value under 20k in Sukhumvit? 😱',
      highlights: '1. Next to BTS Bang Chak 2. 28 sqm fully furnished 3. Only 18,000 THB/mo',
      price: '฿18,000 / mo',
      cta: 'DM us or Line ID @estatebangkok',
      hashtags: '#BangkokCondo #TikTokRealEstate #CondoHunter',
    },
    validationResult: {
      status: 'PASS',
      messages: ['All checks passed'],
    },
    createdAt: '2 hours ago',
  },
  {
    id: 3,
    code: 'BH260816-0003',
    projectName: 'Rhythm Ekamai',
    propertyType: 'CONDO',
    listingType: 'SALE',
    title: 'Spacious 2-Bed Unit for Sale at Rhythm Ekamai',
    description: '65 sqm 2-bedroom luxury condo in the heart of Ekamai.',
    salePrice: 12500000,
    bedrooms: 2,
    bathrooms: 2,
    sizeSqm: 65,
    status: 'PUBLISHED',
    sourceUrl: 'https://facebook.com/groups/realestate/posts/103',
    originalImages: [],
    enhancedImages: [],
    finalImages: [],
    createdAt: '1 day ago',
  },
];

const MainApp: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('add-url');
  const [properties, setProperties] = useState<Property[]>(initialProperties);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const handleAddProperty = (sourceUrl: string, extractedData?: Partial<Property>) => {
    const todayStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const newCode = extractedData?.code || `BH${todayStr}-${randomNum}`;

    const defaultImages = [
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80',
    ];

    const newProp: Property = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      code: newCode,
      projectName: extractedData?.projectName || 'Ideo Sukhumvit 93',
      propertyType: extractedData?.propertyType || 'CONDO',
      listingType: extractedData?.listingType || 'RENT',
      title: extractedData?.title || `Extracted Listing (${newCode})`,
      description:
        extractedData?.description ||
        'ให้เช่า Ideo Sukhumvit 93 ขนาด 28 ตร.ม. ชั้น 28 แต่งครบ เฟอร์ครบ พร้อมเครื่องใช้ไฟฟ้า หิ้วกระเป๋าเข้าอยู่ได้เลย! ราคา 18,000 บาท/เดือน ติด BTS บางจาก เพียง 15 เมตร ติดต่อ Line ID: @estatebangkok โทร 081-234-5678',
      rentPrice: extractedData?.rentPrice || 18000,
      salePrice: extractedData?.salePrice,
      bedrooms: extractedData?.bedrooms || 1,
      bathrooms: extractedData?.bathrooms || 1,
      sizeSqm: extractedData?.sizeSqm || 28,
      floor: extractedData?.floor || '28th Floor',
      btsMrt: extractedData?.btsMrt || 'BTS Bang Chak (15m)',
      ownerType: extractedData?.ownerType || 'AGENT',
      contactInfo: extractedData?.contactInfo || 'Line: @estatebangkok | Tel: 081-234-5678',
      status: 'NEW',
      sourceUrl,
      sourceAuthor: extractedData?.sourceAuthor || 'FB Group: Bangkok Real Estate Marketplace',
      originalImages: extractedData?.originalImages?.length ? extractedData.originalImages : defaultImages,
      enhancedImages: extractedData?.enhancedImages?.length ? extractedData.enhancedImages : defaultImages,
      finalImages: extractedData?.finalImages?.length ? extractedData.finalImages : defaultImages,
      createdAt: 'Just now',
    };

    setProperties((prev) => [newProp, ...prev]);
  };

  const handleProcessBatch = (ids: number[]) => {
    setProperties((prev) =>
      prev.map((p) =>
        ids.includes(p.id)
          ? {
              ...p,
              status: 'READY_FOR_REVIEW',
              fbContent: {
                title: p.title,
                description: p.description,
                price: p.rentPrice ? `฿${p.rentPrice.toLocaleString()} / mo` : 'N/A',
                cta: 'Line ID: @estatebangkok',
                hashtags: '#BangkokRealEstate #CondoForRent',
              },
              tikTokContent: {
                hook: `Check out this unit at ${p.projectName || 'Bangkok'}!`,
                highlights: '1. Fully Furnished 2. Great Location',
                price: p.rentPrice ? `฿${p.rentPrice.toLocaleString()}` : 'N/A',
                cta: 'DM for viewing appointment',
                hashtags: '#BangkokLiving #PropertySearch',
              },
            }
          : p
      )
    );
  };

  const handleApproveProperty = (id: number) => {
    setProperties((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              status: 'PUBLISHED',
              originalImages: [],
              enhancedImages: [],
              finalImages: [],
            }
          : p
      )
    );
  };

  const handleRejectProperty = (id: number) => {
    setProperties((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'REJECTED' } : p))
    );
  };

  return (
    <AppLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'dashboard' && (
        <DashboardView
          properties={properties}
          onNavigateTab={setActiveTab}
        />
      )}

      {activeTab === 'add-url' && (
        <AddUrlView
          properties={properties}
          onAddProperty={handleAddProperty}
          onProcessBatch={handleProcessBatch}
        />
      )}

      {activeTab === 'inbox' && (
        <PropertyInboxView
          properties={properties}
          onProcessProperty={(id) => handleProcessBatch([id])}
          onNavigateTab={setActiveTab}
        />
      )}

      {activeTab === 'review' && (
        <ReviewCenterView
          properties={properties}
          onApproveProperty={handleApproveProperty}
          onRejectProperty={handleRejectProperty}
        />
      )}

      {activeTab === 'projects' && <ProjectsView />}

      {activeTab === 'prompts' && <PromptTemplatesView />}

      {activeTab === 'workflow' && (
        <WorkflowMapView onNavigateToFacebookLogin={() => setActiveTab('facebook-login')} />
      )}

      {activeTab === 'automation' && <AutomationSettingsView />}

      {activeTab === 'testing' && <TestingView />}

      {activeTab === 'settings' && (
        <SettingsView onNavigateToFacebookLogin={() => setActiveTab('facebook-login')} />
      )}

      {activeTab === 'facebook-login' && (
        <FacebookLoginView
          onBack={() => setActiveTab('settings')}
          onSuccess={() => setActiveTab('dashboard')}
        />
      )}
    </AppLayout>
  );
};

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
