import React, { useState, useEffect, useMemo } from 'react';
import {
  FiMonitor,
  FiRefreshCw,
  FiExternalLink,
  FiCopy,
  FiCheck,
  FiPlay,
  FiPause,
  FiRotateCcw,
  FiFastForward,
  FiXCircle,
  FiFolder,
  FiLayers,
  FiCpu,
  FiSliders,
  FiShield,
  FiCheckCircle,
  FiAlertCircle,
  FiGlobe,
  FiUserPlus,
  FiPlus,
  FiX,
  FiUploadCloud,
  FiImage,
} from 'react-icons/fi';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import {
  fetchBrowserProfiles,
  openBrowserProfile,
  openBrowserTab,
  fetchTabGroups,
  fetchProcessingLanes,
  fetchImageQueue,
  startImageQueue,
  pauseImageJob,
  resumeImageJob,
  retryImageJob,
  skipImageJob,
  cancelImageJob,
  processLocalImageJob,
  fetchPromptPreview,
  fetchDownloadWatcherStatus,
  syncBrowserProfiles,
  registerBrowserProfile,
  startAutomation,
  stopAutomation,
  getAutomationStatus,
  focusBrowserTabGroup,
  waitForBrowserTabsReady,
  createBatchImageQueue,
  type AutomationStatusResponse,
} from './browserAutomationService';
import {
  STANDARD_BROWSER_PROMPTS,
  resolvePromptForBrowserNode,
} from './browserPromptUtils';
import { loadAvailablePromptTemplates } from '../facebook-import/FacebookWorkflowCanvas';
import type {
  BrowserProfile,
  BrowserGroupItem,
  BrowserTabItem,
  ProcessingLane,
  ImageProcessingJob,
  BrowserProcessingMode,
  DownloadManagerStatus,
} from './types';

interface ExternalBrowserSidebarProps {
  isDark: boolean;
  boxConfig: any;
  onUpdateBoxConfig: (updated: any) => void;
  availablePrompts?: Array<{ id: string; name: string; templateText: string; category?: string }>;
  propertyContext?: {
    id?: string;
    title?: string;
    aboveBoxTitle?: string;
    price?: string;
    images?: Array<{ url: string; index?: number; filename?: string }>;
  };
}

export const ExternalBrowserSidebar: React.FC<ExternalBrowserSidebarProps> = ({
  isDark,
  boxConfig,
  onUpdateBoxConfig,
  availablePrompts = [],
  propertyContext,
}) => {
  const isChromeProfileNode = Boolean(
    boxConfig.processType === 'chrome_profile' ||
    Boolean(boxConfig.browserProfileKey) ||
    Boolean(boxConfig.browserProfileName) ||
    Boolean(boxConfig.browserProfileId) ||
    Boolean(boxConfig.id?.includes('ai-box-chrome-'))
  );

  const condoName = propertyContext?.title || boxConfig.browserCondoName || 'Featured Property Listing';
  const aboveBoxTitle = propertyContext?.aboveBoxTitle || 'Format: Enhance Image';

  const receivedImages = useMemo(() => {
    return (propertyContext?.images || []).filter((img) => Boolean(img.url));
  }, [propertyContext?.images]);

  // 1. Core Profile, Group, and Tab State
  const [profiles, setProfiles] = useState<BrowserProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<number>(() => boxConfig.browserProfileId || 11);
  const [tabGroups, setTabGroups] = useState<BrowserGroupItem[]>([]);
  const [selectedGroupName, setSelectedGroupName] = useState<string>(() => boxConfig.browserGroupName || 'Enhance IMG');
  const [stagingGroupName, setStagingGroupName] = useState<string>(() => boxConfig.stagingGroupName || 'FB Hero');
  const [enableEnhanceGroup, setEnableEnhanceGroup] = useState<boolean>(() => boxConfig.enableEnhanceGroup !== false);
  const [enableStagingGroup, setEnableStagingGroup] = useState<boolean>(() => boxConfig.enableStagingGroup !== false);
  const [selectedTabId, setSelectedTabId] = useState<string>(() => boxConfig.browserTabId || 'tab-enh-1');
  const [processingMode, setProcessingMode] = useState<BrowserProcessingMode>(
    () => boxConfig.browserProcessingMode || 'chrome_assisted'
  );

  // 2. Lanes and Download Manager State
  const [lanes, setLanes] = useState<ProcessingLane[]>([]);
  const [selectedLaneKey, setSelectedLaneKey] = useState<string>(() => boxConfig.browserLaneKey || 'lane-1');
  const [downloadWatcher, setDownloadWatcher] = useState<DownloadManagerStatus | null>(null);

  // 3. Queue State
  const [queueJobs, setQueueJobs] = useState<ImageProcessingJob[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);

  // 4. Prompt Template State
  const [selectedPromptKey, setSelectedPromptKey] = useState<string>(
    () => boxConfig.browserPromptTemplateKey || 'photo_retouch'
  );
  const [customPromptText, setCustomPromptText] = useState<string>(() => boxConfig.browserCustomPrompt || '');
  const [resolvedPromptPreview, setResolvedPromptPreview] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);

  // 5. Output Dimension State
  const [outputWidth, setOutputWidth] = useState<number>(() => boxConfig.outputWidth || 1080);
  const [outputHeight, setOutputHeight] = useState<number>(() => boxConfig.outputHeight || 1350);
  const [strictPreservation, setStrictPreservation] = useState<boolean>(
    () => boxConfig.strictPreservationActive !== false
  );
  const [isOpeningProfile, setIsOpeningProfile] = useState<boolean>(false);
  const [isOpeningTab, setIsOpeningTab] = useState<boolean>(false);

  // Profile creation / discovery state
  const [isAddProfileOpen, setIsAddProfileOpen] = useState(false);
  const [isSyncingProfiles, setIsSyncingProfiles] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [newProfileDisplayName, setNewProfileDisplayName] = useState('');
  const [newProfileKey, setNewProfileKey] = useState('');
  const [newProfileEmail, setNewProfileEmail] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [saveProfileError, setSaveProfileError] = useState<string | null>(null);

  // Multi-tab Automated Workflow State
  const [isAutomating, setIsAutomating] = useState<boolean>(false);
  const [automationStatus, setAutomationStatus] = useState<AutomationStatusResponse | null>(null);
  const [automationMessage, setAutomationMessage] = useState<string | null>(null);

  // 6. Two-Stage Tab Group Staging & Local Condo Building Image State
  const [referenceImage, setReferenceImage] = useState<string>(() => boxConfig.referenceImage || '');
  const [condoSearchQuery, setCondoSearchQuery] = useState<string>(
    () => boxConfig.browserCondoName || propertyContext?.title || 'Regent Home Bangna'
  );
  const [matchedCondoInfo, setMatchedCondoInfo] = useState<any>(null);
  const [isScanningCondo, setIsScanningCondo] = useState<boolean>(false);
  const [twoStageStatus, setTwoStageStatus] = useState<any>(null);
  const [isRunningTwoStage, setIsRunningTwoStage] = useState<boolean>(false);
  const [twoStageMessage, setTwoStageMessage] = useState<string | null>(null);

  // Scan condo directory from local Mac companion (Strictly Read-Only!)
  const handleScanCondo = async (queryToSearch?: string) => {
    const q = queryToSearch !== undefined ? queryToSearch : condoSearchQuery;
    if (!q) return;
    setIsScanningCondo(true);
    try {
      const resp = await fetch(`http://127.0.0.1:9224/condo-images?condo_name=${encodeURIComponent(q)}`);
      const data = await resp.json();
      if (data && data.status === 'success') {
        setMatchedCondoInfo(data);
        updateMultiConfig({
          browserCondoName: q,
          browserMatchedFolder: data.matched_folder,
          browserCondoImagesCount: data.images_found,
        });
      } else {
        setMatchedCondoInfo(null);
      }
    } catch (e) {
      console.warn('Error querying condo images from companion:', e);
      setMatchedCondoInfo(null);
    } finally {
      setIsScanningCondo(false);
    }
  };

  useEffect(() => {
    const q = boxConfig.browserCondoName || propertyContext?.title || 'Regent Home Bangna';
    if (q) {
      setCondoSearchQuery(q);
      handleScanCondo(q);
    }
  }, [propertyContext?.title]);

  const handleReferenceImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setReferenceImage(dataUrl);
      updateConfig('referenceImage', dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveReferenceImage = () => {
    setReferenceImage('');
    updateConfig('referenceImage', '');
  };

  const handleRunTwoStageTest = async () => {
    setIsRunningTwoStage(true);
    setTwoStageMessage('Initiating Two-Stage Staging via companion...');
    try {
      const activeProf = profiles.find((p) => p.id === selectedProfileId);
      const profKey = activeProf?.profile_key || boxConfig.browserProfileKey || 'Profile 14';

      const resp = await fetch('http://127.0.0.1:9224/start-two-stage-staging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_key: profKey,
          group_name: selectedGroupName || 'FB Hero',
          condo_name: condoSearchQuery,
          initial_prompt: resolvedPromptPreview || customPromptText || 'Analyze property details and formulate facebook ad prompt',
          reference_image: referenceImage || null,
        }),
      });
      const data = await resp.json();
      if (data.status === 'success') {
        setTwoStageMessage(`🚀 Two-Stage Staging started: Tab 1 generating prompt for "${data.matched_folder}"...`);

        let pollCount = 0;
        const interval = setInterval(async () => {
          pollCount++;
          if (pollCount > 100) {
            clearInterval(interval);
            setIsRunningTwoStage(false);
            setTwoStageMessage('Two-stage staging completed or timed out.');
            return;
          }
          try {
            const stResp = await fetch('http://127.0.0.1:9224/two-stage-status');
            const stData = await stResp.json();
            if (stData && stData.state) {
              setTwoStageStatus(stData.state);
              if (stData.state.step === 'stage1_running') {
                setTwoStageMessage('⏳ Tab 1: Pasted prompt, generating & extracting output...');
              } else if (stData.state.step === 'stage1_completed') {
                setTwoStageMessage('✓ Tab 1: Extracted prompt! Focusing Tab 2...');
              } else if (stData.state.step === 'stage2_running') {
                setTwoStageMessage('🖼️ Tab 2: Pasting reference image, condo images 1, 2, 3 & prompt...');
              } else if (stData.state.step === 'completed') {
                clearInterval(interval);
                setIsRunningTwoStage(false);
                setTwoStageMessage(`🎉 Complete! Tab 2 submitted with ${stData.state.images_attached || 4} images and extracted prompt.`);
              } else if (stData.state.step === 'error') {
                clearInterval(interval);
                setIsRunningTwoStage(false);
                setTwoStageMessage(`⚠️ Error: ${stData.state.error}`);
              }
            }
          } catch (e) {}
        }, 2000);
      } else {
        setIsRunningTwoStage(false);
        setTwoStageMessage(`Error starting: ${data.message || 'Unknown error'}`);
      }
    } catch (e: any) {
      setIsRunningTwoStage(false);
      setTwoStageMessage(`Connection error: ${e.message}`);
    }
  };

  // Sync state back to canvas box config
  const updateMultiConfig = (updates: Record<string, any>) => {
    onUpdateBoxConfig({
      ...boxConfig,
      ...updates,
    });
  };

  const updateConfig = (key: string, value: any) => {
    updateMultiConfig({ [key]: value });
  };

  // Load profiles and watcher status
  useEffect(() => {
    fetchBrowserProfiles().then((data) => {
      if (data && data.length > 0) {
        setProfiles(data);
        const matched =
          data.find((p) =>
            (boxConfig.browserProfileKey && p.profile_key === boxConfig.browserProfileKey) ||
            (boxConfig.browserProfileName && (p.display_name === boxConfig.browserProfileName || boxConfig.browserProfileName.includes(p.display_name))) ||
            (selectedProfileId && p.id === selectedProfileId)
          ) ||
          data.find((p) => p.profile_key === 'Profile 14' || p.display_name.toLowerCase().includes('hsu')) ||
          data[0];
        if (matched) {
          setSelectedProfileId(matched.id);
        }
      }
    });

    fetchProcessingLanes().then((laneData) => {
      if (laneData && laneData.length > 0) {
        setLanes(laneData);
      }
    });

    fetchDownloadWatcherStatus().then((s) => {
      if (s) setDownloadWatcher(s);
    });
  }, []);

  // Sync selectedProfileId when boxConfig profile changes
  useEffect(() => {
    if (boxConfig.browserProfileId) {
      setSelectedProfileId(boxConfig.browserProfileId);
    } else if (boxConfig.browserProfileKey && profiles.length > 0) {
      const match = profiles.find((p) => p.profile_key === boxConfig.browserProfileKey);
      if (match) setSelectedProfileId(match.id);
    } else if (boxConfig.browserProfileName && profiles.length > 0) {
      const match = profiles.find(
        (p) => p.display_name === boxConfig.browserProfileName || p.display_name.includes(boxConfig.browserProfileName)
      );
      if (match) setSelectedProfileId(match.id);
    }
  }, [boxConfig.browserProfileId, boxConfig.browserProfileKey, boxConfig.browserProfileName, profiles]);

  // When profile changes, automatically reload and bind tab groups & tabs
  useEffect(() => {
    if (selectedProfileId) {
      const currentProf = profiles.find((p) => p.id === selectedProfileId);
      const profKey = currentProf?.profile_key || boxConfig.browserProfileKey || 'Profile 14';
      const profName = currentProf?.display_name || boxConfig.browserProfileName || 'Hsu';

      fetchTabGroups(selectedProfileId, profKey, profName).then((groups) => {
        setTabGroups(groups);
        if (groups && groups.length > 0) {
          const targetGroup =
            (selectedGroupName && selectedGroupName.toLowerCase().includes('enhance')
              ? groups.find((g) => g.name === selectedGroupName)
              : null) ||
            groups.find((g) => g.name.toLowerCase().includes('enhance')) ||
            groups.find((g) => g.name.toLowerCase() === (selectedGroupName || boxConfig.browserGroupName || '').toLowerCase()) ||
            groups[0];
          setSelectedGroupName(targetGroup.name);

          const tabs = targetGroup.tabs || [];
          const firstTab = tabs[0];
          const firstId = firstTab ? firstTab.id : '';
          const firstTitle = firstTab ? firstTab.title : '';

          setSelectedTabId(firstId);

          updateMultiConfig({
            browserProfileId: selectedProfileId,
            browserProfileKey: currentProf?.profile_key || profKey,
            browserProfileName: currentProf?.display_name || profName,
            browserGroupName: targetGroup.name,
            browserTabId: firstId,
            browserTabTitle: firstTitle,
            browserGroupTabUrls: tabs.map((t) => t.url).filter(Boolean),
            _liveGroupTabs: tabs.map((t) => ({ id: t.id, title: t.title, url: t.url })),
          });
        } else {
          setSelectedGroupName('');
          setSelectedTabId('');
          updateMultiConfig({
            browserGroupName: '',
            browserTabId: '',
            browserTabTitle: '',
            _liveGroupTabs: [],
          });
        }
      });
    }
  }, [selectedProfileId, profiles]);

  // Load live image queue for current property only (never show historical runs)
  const loadQueue = () => {
    const currentPropId = propertyContext?.id;
    if (currentPropId) {
      setIsLoadingQueue(true);
      fetchImageQueue(currentPropId).then((jobs) => {
        const matching = (jobs || []).filter((j) => j.property_id === currentPropId);
        setQueueJobs(matching);
        setIsLoadingQueue(false);
      });
    } else {
      setQueueJobs([]);
      setIsLoadingQueue(false);
    }
  };

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 4000);
    return () => clearInterval(interval);
  }, [propertyContext?.id]);

  // Poll automation progress when automation is running
  useEffect(() => {
    let interval: any = null;
    if (isAutomating) {
      interval = setInterval(async () => {
        const status = await getAutomationStatus();
        if (status) {
          setAutomationStatus(status);
          loadQueue();
          if (!status.is_running && status.total && status.completed !== undefined) {
            setIsAutomating(false);
            setAutomationMessage(`✓ All tabs finished! ${status.completed}/${status.total} enhanced.`);
          }
        }
      }, 1500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAutomating]);

  // Handler: Start Multi-Tab Automated Queue across all tabs in selected group
  const handleStartGroupAutomation = async () => {
    const profId = activeProfile?.id || selectedProfileId;
    const profKey = activeProfile?.profile_key || 'Profile 14';
    const propId = propertyContext?.id || `PROP-${Date.now()}`;
    const targetUrls = groupTabs.map((t) => t.url).filter(Boolean);

    const hasImages = (propertyContext?.images && propertyContext.images.length > 0) || queueJobs.length > 0;
    if (!hasImages) {
      setAutomationMessage('⚠️ No images available from "Get Images" for this run. Please run the workflow or extract photos first.');
      return;
    }

    // Auto-create batch queue if empty but property images are available
    if (queueJobs.length === 0 && propertyContext?.images && propertyContext.images.length > 0) {
      const promptToUse = resolvePromptForBrowserNode(
        {
          ...boxConfig,
          browserPromptTemplateKey: selectedPromptKey,
          browserPromptText: resolvedPromptPreview || currentPromptText,
          resolvedPrompt: resolvedPromptPreview || currentPromptText,
        },
        {
          title: propertyContext.title,
          price: propertyContext.price,
          width: outputWidth,
          height: outputHeight,
        }
      );

      const imgs = propertyContext.images.map((img, i) => ({
        index: i + 1,
        source_url: img.url,
        stored_url: img.url,
        width: outputWidth,
        height: outputHeight,
        resolved_prompt: promptToUse,
      }));

      try {
        await createBatchImageQueue({
          property_id: propId,
          property_name: propertyContext.title || 'Featured Property Listing',
          prompt_template_text: promptToUse,
          images: imgs,
          processing_mode: processingMode,
          lane_id: selectedLaneKey,
          prompt_template_id: selectedPromptKey,
          output_width: outputWidth,
          output_height: outputHeight,
          strict_preservation_active: strictPreservation,
        });
        await startImageQueue(propId);
        await loadQueue();
      } catch (err) {
        console.warn('Queue init error:', err);
      }
    }

    // Auto-open and focus the selected browser profile & selected tab group with all worker tabs!
    try {
      await focusBrowserTabGroup({
        profileId: profId,
        profileKey: profKey,
        groupName: selectedGroupName,
        groupTabUrls: targetUrls,
        url: targetUrls[0],
        force: true,
      });

      setAutomationMessage(`Opening Chrome [${profKey}] & Tab Group [${selectedGroupName}]... Waiting for tabs to be ready...`);
      await waitForBrowserTabsReady({
        profileKey: profKey,
        groupName: selectedGroupName,
        expectedUrls: targetUrls,
        maxWaitMs: 15000,
        onProgress: (msg) => setAutomationMessage(msg),
      });
    } catch (e) {
      console.warn('Could not auto-open browser tab group:', e);
    }

    // Collect numeric tab IDs from groupTabs
    const tabIds: number[] = groupTabs
      .map((t) => {
        if (typeof t.id === 'number') return t.id;
        const parsed = parseInt(String(t.id).replace(/\D/g, ''), 10);
        return isNaN(parsed) ? 0 : parsed;
      })
      .filter((id) => id > 0);

    const finalTabIds = tabIds.length > 0 ? tabIds : [1, 2, 3, 4];

    setIsAutomating(true);
    setAutomationMessage(`Auto-opened Chrome [${profKey}] & Tab Group [${selectedGroupName}]. Processing across ${finalTabIds.length} tabs...`);

    const res = await startAutomation({
      property_id: propId,
      profile_key: profKey,
      tab_ids: finalTabIds,
    });

    if (!res.success) {
      setIsAutomating(false);
      setAutomationMessage(`Error: ${res.message}`);
      setTimeout(() => setAutomationMessage(null), 4500);
    } else {
      setAutomationMessage(`⚡ Processing images across ${finalTabIds.length} tabs...`);
      loadQueue();
    }
  };

  // Handler: Stop Multi-Tab Automation
  const handleStopGroupAutomation = async () => {
    await stopAutomation();
    setIsAutomating(false);
    setAutomationMessage('Automation stopped.');
    loadQueue();
    setTimeout(() => setAutomationMessage(null), 3000);
  };


  // Standard Image Prompt Templates + Custom Library Prompts
  const promptOptions = useMemo(() => {
    // Append prompts from user's saved prompt library
    const libraryPrompts = (availablePrompts && availablePrompts.length > 0 ? availablePrompts : loadAvailablePromptTemplates()).map((ap) => ({
      id: String(ap.id),
      name: ap.name,
      category: ap.category || 'LIBRARY',
      instructions: ap.templateText,
    }));

    return [
      ...STANDARD_BROWSER_PROMPTS,
      ...libraryPrompts,
      {
        id: 'custom_prompt',
        name: 'Custom Enhancement Prompt',
        category: 'CUSTOM',
        instructions: customPromptText || 'Enhance photo maintaining authentic structure.',
      },
    ];
  }, [customPromptText, availablePrompts]);

  // Current selected prompt instruction text
  const currentPromptText = useMemo(() => {
    if (selectedPromptKey === 'custom_prompt') {
      return customPromptText;
    }
    const targetKey = String(selectedPromptKey || '').trim().toLowerCase();
    const found = promptOptions.find(
      (p) => String(p.id).trim().toLowerCase() === targetKey || p.name.trim().toLowerCase() === targetKey
    );
    return found ? found.instructions : (promptOptions[0]?.instructions || '');
  }, [selectedPromptKey, customPromptText, promptOptions]);

  // Resolve live prompt preview
  useEffect(() => {
    fetchPromptPreview({
      template_text: currentPromptText,
      property_name: propertyContext?.title || 'Luxury Bangkok Residence',
      property_metadata: {
        price: propertyContext?.price || '฿45,000 / month',
        unit_details: '2 Bedroom · 65 Sqm · High Floor',
      },
      image_position: 1,
      total_images: propertyContext?.images?.length || 6,
      output_width: outputWidth,
      output_height: outputHeight,
    }).then((resolved) => {
      if (resolved) setResolvedPromptPreview(resolved);
    });
  }, [currentPromptText, propertyContext, outputWidth, outputHeight]);

  // Whenever selectedPromptKey, currentPromptText, or resolvedPromptPreview changes,
  // save full prompt text to canvas boxConfig so downstream workflow runners have it!
  useEffect(() => {
    const promptToStore = resolvedPromptPreview || currentPromptText;
    if (promptToStore) {
      updateMultiConfig({
        browserPromptTemplateKey: selectedPromptKey,
        browserPromptText: promptToStore,
        resolvedPrompt: promptToStore,
        templateText: currentPromptText,
        customPrompt: selectedPromptKey === 'custom_prompt' ? customPromptText : promptToStore,
      });
    }
  }, [selectedPromptKey, currentPromptText, resolvedPromptPreview]);

  // Active selected Chrome profile
  const activeProfile = useMemo(() => {
    if (boxConfig.browserProfileKey) {
      const match = profiles.find((p) => p.profile_key === boxConfig.browserProfileKey);
      if (match) return match;
    }
    if (boxConfig.browserProfileId) {
      const match = profiles.find((p) => p.id === boxConfig.browserProfileId);
      if (match) return match;
    }
    if (boxConfig.browserProfileName) {
      const match = profiles.find(
        (p) => p.display_name === boxConfig.browserProfileName || p.display_name.includes(boxConfig.browserProfileName)
      );
      if (match) return match;
    }
    return profiles.find((p) => p.id === selectedProfileId) || profiles[0];
  }, [profiles, selectedProfileId, boxConfig.browserProfileKey, boxConfig.browserProfileId, boxConfig.browserProfileName]);

  // Active selected Tab Group 1 (Enhance IMG)
  const activeGroup = useMemo(() => {
    return (
      tabGroups.find((g) => g.name === selectedGroupName) ||
      tabGroups.find((g) => g.name.toLowerCase().includes('enhance')) ||
      tabGroups[0]
    );
  }, [tabGroups, selectedGroupName]);

  // Active tabs inside Group 1 (Photo Enhancement)
  const groupTabs = useMemo(() => {
    return activeGroup?.tabs || [];
  }, [activeGroup]);

  // Active selected Tab Group 2 (FB Hero / Staging)
  const stagingGroup = useMemo(() => {
    return (
      tabGroups.find((g) => g.name === stagingGroupName) ||
      tabGroups.find((g) => g.name.toLowerCase().includes('fb')) ||
      tabGroups.find((g) => g.tabs_count === 2 && g.name !== activeGroup?.name)
    );
  }, [tabGroups, stagingGroupName, activeGroup]);

  // Active tabs inside Group 2 (Staging & Ad Creation)
  const stagingGroupTabs = useMemo(() => {
    return stagingGroup?.tabs || [];
  }, [stagingGroup]);

  // Copy prompt to clipboard
  const handleCopyPrompt = () => {
    if (resolvedPromptPreview) {
      navigator.clipboard.writeText(resolvedPromptPreview);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  // Launch / Focus Chrome Profile & Tab Group on Mac
  const handleOpenProfile = async () => {
    const profId = activeProfile?.id || selectedProfileId;
    const profKey = activeProfile?.profile_key || 'Profile 14';
    if (profId) {
      setIsOpeningProfile(true);
      try {
        const targetUrls = groupTabs.map((t) => t.url).filter(Boolean);
        const res = await focusBrowserTabGroup({
          profileId: profId,
          profileKey: profKey,
          groupName: selectedGroupName,
          groupTabUrls: targetUrls,
          url: targetUrls[0],
        });
        if (res.success) {
          setSyncMessage(`Chrome "${activeProfile?.display_name || profKey}" & "${selectedGroupName}" (${targetUrls.length || groupTabs.length} tabs) opened!`);
        } else {
          setSyncMessage(res.message || 'Could not open Chrome profile.');
        }
      } catch (err: any) {
        setSyncMessage(err?.message || 'Error opening Chrome profile.');
      } finally {
        setTimeout(() => setIsOpeningProfile(false), 800);
        setTimeout(() => setSyncMessage(null), 3500);
      }
    }
  };

  // Launch URL inside selected Chrome Profile on Mac
  const handleOpenTab = async () => {
    const profId = activeProfile?.id || selectedProfileId;
    const profKey = activeProfile?.profile_key;
    const active = groupTabs.find((t) => t.id === selectedTabId) || groupTabs[0];
    const targetUrl = active?.url || 'https://chatgpt.com/';
    if (profId) {
      try {
        const res = await openBrowserTab(profId, targetUrl, profKey);
        if (res.success) {
          setSyncMessage(`Tab "${active?.title || 'Selected'}" focused in Chrome!`);
        } else {
          setSyncMessage(res.message || 'Could not open tab.');
        }
      } catch (err: any) {
        setSyncMessage(err?.message || 'Error opening tab.');
      } finally {
        setTimeout(() => setSyncMessage(null), 3500);
      }
    }
  };

  // Sync discovered Chrome profiles from host Mac
  const handleSyncProfiles = async () => {
    setIsSyncingProfiles(true);
    setSyncMessage(null);
    try {
      const result = await syncBrowserProfiles();
      if (result.profiles && result.profiles.length > 0) {
        setProfiles(result.profiles);
        if (result.addedCount > 0) {
          setSyncMessage(`Synced! Added ${result.addedCount} new Chrome profile${result.addedCount > 1 ? 's' : ''} from your Mac.`);
        } else {
          setSyncMessage('All local Chrome profiles are already connected.');
        }
      }
    } catch {
      setSyncMessage('Failed to scan local Chrome profiles.');
    } finally {
      setIsSyncingProfiles(false);
      setTimeout(() => setSyncMessage(null), 4000);
    }
  };

  // Register a custom profile manually
  const handleRegisterProfile = async () => {
    if (!newProfileDisplayName.trim() || !newProfileKey.trim()) {
      setSaveProfileError('Display Name and Profile Directory are required.');
      return;
    }
    setIsSavingProfile(true);
    setSaveProfileError(null);
    try {
      const created = await registerBrowserProfile(
        newProfileKey.trim(),
        newProfileDisplayName.trim(),
        newProfileEmail.trim()
      );
      if (created) {
        const freshProfiles = await fetchBrowserProfiles();
        setProfiles(freshProfiles);
        setSelectedProfileId(created.id);
        updateMultiConfig({
          browserProfileId: created.id,
          browserProfileName: created.display_name,
        });
        setIsAddProfileOpen(false);
        setNewProfileDisplayName('');
        setNewProfileKey('');
        setNewProfileEmail('');
        setSyncMessage(`Profile "${created.display_name}" added and selected!`);
        setTimeout(() => setSyncMessage(null), 3000);
      } else {
        setSaveProfileError('Failed to register profile. Please check your inputs.');
      }
    } catch (e: any) {
      setSaveProfileError(e?.message || 'Failed to register profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2rem' }}>
      {/* Node Header Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.75rem 0.85rem',
          borderRadius: '8px',
          background: isDark ? 'rgba(6, 182, 212, 0.1)' : '#ECFEFF',
          border: '1px solid rgba(6, 182, 212, 0.3)',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            backgroundColor: '#06B6D4',
            color: '#0F172A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <FiMonitor size={17} />
        </div>
        <div>
          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#06B6D4' }}>
            External Browser Node
          </div>
          <div style={{ fontSize: '0.6875rem', color: isDark ? '#94A3B8' : '#64748B' }}>
            Chrome Profiles · ChatGPT Assist · Smart Queue
          </div>
        </div>
      </div>

      {/* SECTION A — PROCESSING ENGINE */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          Processing Mode
        </label>
        <Select
          options={[
            { value: 'chrome_assisted', label: '1. Chrome / ChatGPT Assisted (Default)' },
            { value: 'two_stage_staging', label: '2. Two-Stage Tab Group (Prompt Gen Tab 1 → Auto Condo Staging Tab 2)' },
            { value: 'local_enhance', label: '3. Local Image Enhancement (Unattended Native)' },
            { value: 'authorized_api', label: '4. Authorized Image API (Official API Limits)' },
          ]}
          value={processingMode}
          onChange={(val) => {
            setProcessingMode(val as BrowserProcessingMode);
            updateConfig('browserProcessingMode', val);
          }}
        />

        {/* Mode Explanatory Callout */}
        <div
          style={{
            padding: '0.5rem 0.65rem',
            borderRadius: '6px',
            background: isDark ? '#1E293B' : '#F8FAFC',
            border: '1px solid var(--border-color)',
            fontSize: '0.6875rem',
            color: isDark ? '#94A3B8' : '#64748B',
            lineHeight: 1.4,
          }}
        >
          {processingMode === 'chrome_assisted' && (
            <div>
              <strong style={{ color: '#06B6D4' }}>Chrome / ChatGPT Assisted:</strong> Prepares exact room-preserving prompts and files, focuses your selected Chrome profile & ChatGPT tab group, guides manual submission/download, and automatically collects completed files.
            </div>
          )}
          {processingMode === 'two_stage_staging' && (
            <div>
              <strong style={{ color: '#8B5CF6' }}>Two-Stage Staging:</strong> Multi-group workflow under the same profile. Tab 1 generates the prompt copy, then Tab 2 receives the reference image (pasted 1st), local condo images (1, 2, 3), and the extracted prompt!
            </div>
          )}
          {processingMode === 'local_enhance' && (
            <div>
              <strong style={{ color: '#10B981' }}>Local Image Enhancement:</strong> Runs completely unattended on your Mac. Applies deterministic dynamic range restoration, shadow lifting, white balance calibration, and 1080x1350 4:5 scaling without external API fees.
            </div>
          )}
          {processingMode === 'authorized_api' && (
            <div>
              <strong style={{ color: '#F59E0B' }}>Authorized Image API:</strong> Processes via official OpenAI/Runware endpoints with strict server-side authentication, concurrency limits, and configured spending caps.
            </div>
          )}
        </div>
      </div>

      {/* SECTION B — CHROME PROFILE MANAGER */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          padding: '0.75rem',
          borderRadius: '8px',
          background: isDark ? '#111827' : '#FFFFFF',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Chrome Profile
            </label>
            <span
              style={{
                fontSize: '0.625rem',
                color: '#10B981',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} />
              Connected
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsAddProfileOpen(!isAddProfileOpen)}
            style={{
              background: 'none',
              border: 'none',
              padding: '2px 4px',
              borderRadius: '4px',
              fontSize: '0.6875rem',
              fontWeight: 600,
              color: isAddProfileOpen ? '#EF4444' : '#06B6D4',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.75')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            {isAddProfileOpen ? <FiX size={12} /> : <FiPlus size={12} />}
            <span>{isAddProfileOpen ? 'Close' : '+ Add'}</span>
          </button>
        </div>

        {/* Chrome Profile Card Box Selection */}
        {isChromeProfileNode ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.65rem 0.75rem',
              borderRadius: '7px',
              border: '1.5px solid #06B6D4',
              backgroundColor: isDark ? 'rgba(6, 182, 212, 0.12)' : '#ECFEFF',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, flex: 1 }}>
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, #06B6D4, #0891B2)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <FiMonitor size={15} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: isDark ? '#38BDF8' : '#0284C7',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {activeProfile?.display_name || boxConfig.browserProfileName || 'Hsu'}
                  </span>
                  <span
                    style={{
                      fontSize: '0.5625rem',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      backgroundColor: isDark ? '#374151' : '#E2E8F0',
                      color: isDark ? '#9CA3AF' : '#64748B',
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {activeProfile?.profile_key || boxConfig.browserProfileKey || 'Profile 14'}
                  </span>
                </div>
                {activeProfile?.email && (
                  <div
                    style={{
                      fontSize: '0.625rem',
                      color: 'var(--text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginTop: '1px',
                    }}
                  >
                    {activeProfile.email}
                  </div>
                )}
              </div>
            </div>
            <span style={{ color: '#06B6D4', display: 'flex', alignItems: 'center' }}>
              <FiCheckCircle size={16} />
            </span>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.45rem',
              maxHeight: '240px',
              overflowY: 'auto',
              paddingRight: '2px',
            }}
          >
            {profiles.map((p) => {
              const isSelected = selectedProfileId === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    setSelectedProfileId(p.id);
                    updateMultiConfig({
                      browserProfileId: p.id,
                      browserProfileName: p.display_name,
                      browserProfileKey: p.profile_key,
                    });
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.55rem 0.65rem',
                    borderRadius: '7px',
                    border: isSelected
                      ? '1.5px solid #06B6D4'
                      : isDark ? '1px solid #374151' : '1px solid #E2E8F0',
                    backgroundColor: isSelected
                      ? (isDark ? 'rgba(6, 182, 212, 0.12)' : '#ECFEFF')
                      : (isDark ? '#1F2937' : '#F8FAFC'),
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 0 0 1px rgba(6, 182, 212, 0.35)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = isDark ? '#4B5563' : '#CBD5E1';
                      e.currentTarget.style.backgroundColor = isDark ? '#263342' : '#F1F5F9';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = isDark ? '#374151' : '#E2E8F0';
                      e.currentTarget.style.backgroundColor = isDark ? '#1F2937' : '#F8FAFC';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '6px',
                        background: isSelected
                          ? 'linear-gradient(135deg, #06B6D4, #0891B2)'
                          : (isDark ? '#374151' : '#E2E8F0'),
                        color: isSelected ? '#FFFFFF' : (isDark ? '#9CA3AF' : '#64748B'),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <FiMonitor size={15} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: isSelected ? (isDark ? '#38BDF8' : '#0284C7') : 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {p.display_name}
                        </span>
                        <span
                          style={{
                            fontSize: '0.5625rem',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            backgroundColor: isDark ? '#374151' : '#E2E8F0',
                            color: isDark ? '#9CA3AF' : '#64748B',
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                        >
                          {p.profile_key}
                        </span>
                      </div>
                      {p.email ? (
                        <div
                          style={{
                            fontSize: '0.625rem',
                            color: 'var(--text-muted)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            marginTop: '1px',
                          }}
                        >
                          {p.email}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                          {p.integration_id}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', marginLeft: '6px', flexShrink: 0 }}>
                    {isSelected ? (
                      <span style={{ color: '#06B6D4', display: 'flex', alignItems: 'center' }}>
                        <FiCheckCircle size={16} />
                      </span>
                    ) : (
                      <span
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          border: isDark ? '1.5px solid #4B5563' : '1.5px solid #CBD5E1',
                          display: 'block',
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
          {profiles.length === 0 && (
            <div
              style={{
                fontSize: '0.6875rem',
                color: 'var(--text-muted)',
                textAlign: 'center',
                padding: '0.75rem',
                border: '1px dashed var(--border-color)',
                borderRadius: '6px',
              }}
            >
              No Chrome profiles discovered. Click &ldquo;+ Add&rdquo; above to scan or register.
            </div>
          )}

        {/* Status / Feedback message */}
        {syncMessage && (
          <div
            style={{
              padding: '0.4rem 0.6rem',
              borderRadius: '5px',
              fontSize: '0.6875rem',
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
              color: isDark ? '#34D399' : '#059669',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <FiCheckCircle size={12} />
            <span>{syncMessage}</span>
          </div>
        )}

        {/* Expandable Add / Discover Profile Card */}
        {isAddProfileOpen && (
          <div
            style={{
              padding: '0.75rem',
              borderRadius: '6px',
              border: isDark ? '1px solid #374151' : '1px solid #CBD5E1',
              backgroundColor: isDark ? '#1F2937' : '#F8FAFC',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.625rem',
              marginTop: '0.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Add or Sync Chrome Profile
              </span>
              <button
                type="button"
                onClick={() => setIsAddProfileOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
              >
                <FiX size={13} />
              </button>
            </div>

            {/* Quick 1-Click Auto Sync from Mac Chrome */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
                padding: '0.55rem',
                borderRadius: '6px',
                backgroundColor: isDark ? '#111827' : '#FFFFFF',
                border: isDark ? '1px solid #374151' : '1px solid #E2E8F0',
              }}
            >
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#06B6D4' }}>
                Option 1: Auto-Detect from Mac Chrome
              </div>
              <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                Automatically scans Google Chrome on your Mac (Default, Profile 1, 2, etc.) and imports all discovered user profiles.
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={isSyncingProfiles}
                onClick={handleSyncProfiles}
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  marginTop: '2px',
                  backgroundColor: isDark ? 'rgba(6, 182, 212, 0.15)' : '#E0F2FE',
                  color: isDark ? '#38BDF8' : '#0284C7',
                  border: '1px solid rgba(6, 182, 212, 0.35)',
                }}
              >
                <FiRefreshCw size={11} className={isSyncingProfiles ? 'animate-spin' : ''} style={{ marginRight: '5px' }} />
                {isSyncingProfiles ? 'Scanning Chrome...' : 'Scan & Import All Mac Chrome Profiles'}
              </Button>
            </div>

            {/* Manual Registration Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Option 2: Add Profile Manually
              </div>
              <div>
                <label style={{ fontSize: '0.625rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                  Display Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Work, Listing Team, Zin Personal"
                  value={newProfileDisplayName}
                  onChange={(e) => setNewProfileDisplayName(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '5px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    border: isDark ? '1px solid #374151' : '1px solid #CBD5E1',
                    backgroundColor: isDark ? '#111827' : '#FFFFFF',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.625rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                  Profile Directory / Key * (e.g. Default, Profile 16, Profile 3)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Profile 16 or Default"
                  value={newProfileKey}
                  onChange={(e) => setNewProfileKey(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '5px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    border: isDark ? '1px solid #374151' : '1px solid #CBD5E1',
                    backgroundColor: isDark ? '#111827' : '#FFFFFF',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.625rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                  Account Email (optional)
                </label>
                <input
                  type="email"
                  placeholder="e.g. team@bolthavenproperty.com"
                  value={newProfileEmail}
                  onChange={(e) => setNewProfileEmail(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '5px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    border: isDark ? '1px solid #374151' : '1px solid #CBD5E1',
                    backgroundColor: isDark ? '#111827' : '#FFFFFF',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                />
              </div>

              {saveProfileError && (
                <div style={{ fontSize: '0.625rem', color: '#EF4444' }}>
                  {saveProfileError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.35rem', marginTop: '2px' }}>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleRegisterProfile}
                  disabled={isSavingProfile || !newProfileDisplayName.trim() || !newProfileKey.trim()}
                  style={{ flex: 1, fontSize: '0.6875rem' }}
                >
                  <FiCheck size={11} style={{ marginRight: '4px' }} />
                  {isSavingProfile ? 'Saving...' : 'Save & Select Profile'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setIsAddProfileOpen(false)}
                  style={{ fontSize: '0.6875rem' }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeProfile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.6875rem', color: '#94A3B8' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Integration ID:</span>
              <code style={{ color: isDark ? '#E2E8F0' : '#1E293B' }}>{activeProfile.integration_id}</code>
            </div>
            {activeProfile.email && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Account:</span>
                <span style={{ color: isDark ? '#CBD5E1' : '#334155' }}>{activeProfile.email}</span>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => fetchBrowserProfiles().then((p) => setProfiles(p))}
            style={{ flex: 1, fontSize: '0.6875rem' }}
          >
            <FiRefreshCw size={11} style={{ marginRight: '4px' }} /> Refresh
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={handleOpenProfile}
            disabled={isOpeningProfile}
            style={{ flex: 1, fontSize: '0.6875rem' }}
          >
            {isOpeningProfile ? (
              <>
                <FiRefreshCw size={11} className="animate-spin" style={{ marginRight: '4px' }} /> Opening...
              </>
            ) : (
              <>
                <FiExternalLink size={11} style={{ marginRight: '4px' }} /> Open Profile
              </>
            )}
          </Button>
        </div>
      </div>

      {/* SECTION: CONDO PROPERTY & GET IMAGES (from workflow) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem',
          padding: '0.75rem',
          borderRadius: '8px',
          background: isDark ? 'rgba(6, 182, 212, 0.05)' : '#F0FDFA',
          border: isDark ? '1px solid rgba(6, 182, 212, 0.25)' : '1px solid #CCFBF1',
        }}
      >
        {/* Condo / Property Name */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '0.625rem', fontWeight: 700, color: '#06B6D4', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <FiFolder size={11} /> Condo / Project Name
            </label>
            <span style={{ fontSize: '0.5625rem', color: 'var(--text-muted)' }}>
              From {aboveBoxTitle}
            </span>
          </div>
          <div
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              background: isDark ? '#1E293B' : '#FFFFFF',
              border: isDark ? '1px solid #334155' : '1px solid #E2E8F0',
              fontSize: '0.8125rem',
              fontWeight: 700,
              color: isDark ? '#F1F5F9' : '#0F172A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{condoName}</span>
            <span style={{ fontSize: '0.5625rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(6, 182, 212, 0.15)', color: '#06B6D4', fontWeight: 600 }}>
              Active Project
            </span>
          </div>
        </div>

        {/* Images received from Get Images */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '0.625rem', fontWeight: 700, color: isDark ? '#E2E8F0' : '#1E293B', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <FiImage size={11} style={{ color: '#10B981' }} /> Images from Get Images
            </label>
            <span style={{ fontSize: '0.5625rem', fontWeight: 600, color: '#10B981', background: 'rgba(16, 185, 129, 0.12)', padding: '1px 6px', borderRadius: '4px' }}>
              {receivedImages.length} images ready
            </span>
          </div>

          {receivedImages.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))',
                gap: '6px',
                maxHeight: '160px',
                overflowY: 'auto',
                padding: '4px',
                background: isDark ? '#0F172A' : '#F8FAFC',
                borderRadius: '6px',
                border: isDark ? '1px solid #1E293B' : '1px solid #E2E8F0',
              }}
            >
              {receivedImages.map((img, idx) => (
                <div
                  key={idx}
                  style={{
                    position: 'relative',
                    aspectRatio: '1',
                    borderRadius: '5px',
                    overflow: 'hidden',
                    border: isDark ? '1px solid #334155' : '1px solid #CBD5E1',
                    background: '#000',
                  }}
                >
                  <img
                    src={img.url}
                    alt={img.filename || `Photo #${img.index || idx + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '2px',
                      right: '2px',
                      background: 'rgba(0,0,0,0.75)',
                      color: '#fff',
                      fontSize: '0.5rem',
                      fontWeight: 700,
                      padding: '1px 3px',
                      borderRadius: '3px',
                    }}
                  >
                    #{img.index || idx + 1}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                padding: '8px 10px',
                borderRadius: '6px',
                background: isDark ? '#1E293B' : '#F8FAFC',
                border: '1px dashed var(--border-color)',
                fontSize: '0.625rem',
                color: 'var(--text-muted)',
                textAlign: 'center',
              }}
            >
              No images from Get Images yet. Connect to Get Images to stream photos.
            </div>
          )}
        </div>
      </div>

      {/* SECTION C — CHROME TAB GROUPS MULTI-PIPELINE (RELATIVE TO SELECTED PROFILE) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FiLayers style={{ color: '#06B6D4' }} /> Tab Groups & Pipelines ({activeProfile?.display_name || 'Chrome'})
          </label>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const profId = activeProfile?.id || selectedProfileId;
              const profKey = activeProfile?.profile_key || boxConfig.browserProfileKey || 'Profile 14';
              const profName = activeProfile?.display_name || boxConfig.browserProfileName || 'Hsu';
              if (profId) {
                fetchTabGroups(profId, profKey, profName).then((g) => setTabGroups(g));
              }
            }}
            style={{ fontSize: '0.625rem', padding: '2px 6px', height: 'auto' }}
          >
            <FiRefreshCw size={10} style={{ marginRight: '3px' }} /> Refresh Groups
          </Button>
        </div>

        {tabGroups.length === 0 ? (
          <div
            style={{
              padding: '0.85rem',
              borderRadius: '8px',
              border: isDark ? '1px dashed #374151' : '1px dashed #CBD5E1',
              textAlign: 'center',
              fontSize: '0.6875rem',
              color: 'var(--text-muted)',
            }}
          >
            No tab groups discovered for &ldquo;{activeProfile?.display_name || 'Selected Profile'}&rdquo;.
            <br />
            Create or focus tab groups in Chrome (e.g. &ldquo;Enhance IMG&rdquo;, &ldquo;FB Hero&rdquo;).
          </div>
        ) : (
          tabGroups.map((group, groupIdx) => {
            const isEnhance = group.name.toLowerCase().includes('enhance');
            const isHero = group.name.toLowerCase().includes('hero') || group.name.toLowerCase().includes('fb');
            const isTikTok = group.name.toLowerCase().includes('tiktok');
            const groupThemeColor = isEnhance ? '#3B82F6' : isHero ? '#8B5CF6' : isTikTok ? '#EC4899' : '#06B6D4';
            const groupBg = isDark
              ? `${groupThemeColor}14`
              : (isEnhance ? '#EFF6FF' : isHero ? '#FAF5FF' : isTikTok ? '#FDF2F8' : '#ECFEFF');
            const groupBorder = isDark ? `1px solid ${groupThemeColor}35` : `1px solid ${groupThemeColor}50`;
            const tabs = group.tabs || [];

            // Relative prompt formulation matching this group and condo name
            const relativePrompt = isEnhance
              ? `Enhance interior and exterior photos for "${condoName}". Maintain strict architectural realism, enhance natural ambient lighting, correct exposure balance, and produce high-resolution editorial quality.`
              : isHero
              ? `Create high-converting Facebook Real Estate hero advertisement copy and staging layout for "${condoName}". Highlight luxury living, key amenities, prime location, and a compelling call-to-action.`
              : `Produce engaging TikTok / Reels video caption and visual hook for property "${condoName}". Include energetic opener, 3 selling points, and urgent inquiry call-to-action.`;

            return (
              <div
                key={group.id || group.name || groupIdx}
                style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  background: groupBg,
                  border: groupBorder,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                {/* Group Title Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: groupThemeColor }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isDark ? '#F1F5F9' : '#0F172A' }}>
                      {group.name}
                    </span>
                    <span
                      style={{
                        fontSize: '0.5625rem',
                        padding: '1px 6px',
                        borderRadius: '10px',
                        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                        color: 'var(--text-secondary)',
                        fontWeight: 600,
                      }}
                    >
                      {tabs.length} {tabs.length === 1 ? 'Tab' : 'Tabs'}
                    </span>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (tabs.length > 0) {
                        try {
                          await focusBrowserTabGroup({
                            profileId: activeProfile?.id || selectedProfileId,
                            profileKey: activeProfile?.profile_key || 'Profile 14',
                            groupName: group.name,
                            tabId: tabs[0].id,
                            groupTabUrls: tabs.map((t) => t.url).filter(Boolean),
                            url: tabs[0].url,
                            force: true,
                          });
                        } catch (e) {}
                      }
                    }}
                    style={{ fontSize: '0.625rem', padding: '2px 7px', height: '22px' }}
                  >
                    <FiExternalLink size={10} style={{ marginRight: '3px' }} /> Focus Group
                  </Button>
                </div>

                {/* Worker Tabs in this Group */}
                {tabs.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '2px' }}>
                    <div style={{ fontSize: '0.5625rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Pipeline Workers ({tabs.length} live {tabs.length === 1 ? 'tab' : 'tabs'}):
                    </div>
                    {tabs.map((tab, idx) => (
                      <div
                        key={tab.id || idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          padding: '0.35rem 0.5rem',
                          borderRadius: '6px',
                          background: isDark ? 'rgba(0, 0, 0, 0.25)' : '#FFFFFF',
                          border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.08)',
                        }}
                      >
                        <div
                          style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            background: groupThemeColor,
                            color: '#fff',
                            fontSize: '0.5625rem',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {idx + 1}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                          <span
                            style={{
                              fontSize: '0.625rem',
                              fontWeight: 600,
                              color: isDark ? '#E2E8F0' : '#1E293B',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={tab.title}
                          >
                            {tab.title || `Worker Tab #${idx + 1}`}
                          </span>
                          <span
                            style={{
                              fontSize: '0.5rem',
                              color: 'var(--text-muted)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {tab.url || 'chrome-tab://active'}
                          </span>
                        </div>
                        <div
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: '#10B981',
                            boxShadow: '0 0 4px #10B981',
                            flexShrink: 0,
                          }}
                          title="Tab Active"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Relative Prompt Box */}
                <div
                  style={{
                    padding: '0.45rem 0.6rem',
                    borderRadius: '6px',
                    background: isDark ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.7)',
                    border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                    marginTop: '2px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.5625rem', fontWeight: 700, color: groupThemeColor, textTransform: 'uppercase' }}>
                      Relative Prompt ({condoName})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(relativePrompt);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        fontSize: '0.5625rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                      }}
                      title="Copy Prompt"
                    >
                      <FiCopy size={10} /> Copy
                    </button>
                  </div>
                  <div
                    style={{
                      fontSize: '0.625rem',
                      color: isDark ? '#CBD5E1' : '#334155',
                      lineHeight: 1.35,
                      fontFamily: 'monospace',
                    }}
                  >
                    {relativePrompt}
                  </div>
                </div>

                {/* Group Automation Process Action Button */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '2px' }}>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={isAutomating || isRunningTwoStage}
                    onClick={() => {
                      if (isHero) {
                        handleRunTwoStageTest();
                      } else {
                        setSelectedGroupName(group.name);
                        handleStartGroupAutomation();
                      }
                    }}
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      backgroundColor: groupThemeColor,
                      borderColor: groupThemeColor,
                      color: '#FFFFFF',
                      width: '100%',
                    }}
                  >
                    <FiPlay size={11} style={{ marginRight: '5px' }} />
                    Run {group.name} ({receivedImages.length} {receivedImages.length === 1 ? 'image' : 'images'} from Get Images)
                  </Button>
                </div>
              </div>
            );
          })
        )}

        {/* Global Automation Messages */}
        {(automationMessage || twoStageMessage) && (
          <div
            style={{
              padding: '0.45rem 0.6rem',
              borderRadius: '6px',
              fontSize: '0.625rem',
              background: isDark ? '#1E293B' : '#F1F5F9',
              border: '1px solid var(--border-color)',
              color: isDark ? '#E2E8F0' : '#1E293B',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <FiCheckCircle size={12} style={{ color: '#10B981', flexShrink: 0 }} />
            <span>{automationMessage || twoStageMessage}</span>
          </div>
        )}
      </div>

      {/* SECTION E — PROMPT TEMPLATE SELECTOR */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          Image Processing Prompt
        </label>
        <Select
          options={promptOptions.map((p) => ({
            value: p.id,
            label: p.name,
          }))}
          value={selectedPromptKey}
          onChange={(val) => {
            const strVal = String(val);
            setSelectedPromptKey(strVal);
            const found = promptOptions.find(
              (p) => String(p.id).trim().toLowerCase() === strVal.trim().toLowerCase() || p.name.trim().toLowerCase() === strVal.trim().toLowerCase()
            );
            const txt = found ? found.instructions : (strVal === 'custom_prompt' ? customPromptText : '');
            updateMultiConfig({
              browserPromptTemplateKey: strVal,
              browserPromptText: txt,
              resolvedPrompt: txt,
              templateText: txt,
              customPrompt: strVal === 'custom_prompt' ? customPromptText : txt,
            });
          }}
        />

        {selectedPromptKey === 'custom_prompt' && (
          <textarea
            rows={3}
            value={customPromptText}
            onChange={(e) => {
              setCustomPromptText(e.target.value);
              updateConfig('browserCustomPrompt', e.target.value);
            }}
            placeholder="Enter custom image enhancement prompt with {project_name}, {output_width}x{output_height}..."
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              background: isDark ? '#1E293B' : '#FFFFFF',
              color: 'var(--text-color)',
              fontSize: '0.75rem',
              fontFamily: 'inherit',
            }}
          />
        )}

        {/* Resolved Live Prompt Preview */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
            padding: '0.6rem',
            borderRadius: '6px',
            background: isDark ? '#1E293B' : '#F1F5F9',
            border: '1px solid var(--border-color)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Resolved Prompt Preview
            </span>
            <Button size="sm" variant="secondary" onClick={handleCopyPrompt} style={{ padding: '2px 8px', fontSize: '0.625rem' }}>
              {isCopied ? <FiCheck size={11} color="#10B981" /> : <FiCopy size={11} />}
              <span style={{ marginLeft: '4px' }}>{isCopied ? 'Copied' : 'Copy Prompt'}</span>
            </Button>
          </div>
          <div
            style={{
              fontSize: '0.6875rem',
              color: isDark ? '#CBD5E1' : '#334155',
              maxHeight: '100px',
              overflowY: 'auto',
              lineHeight: 1.4,
              whiteSpace: 'pre-wrap',
            }}
          >
            {resolvedPromptPreview || 'Loading prompt template preview...'}
          </div>
        </div>
      </div>

      {/* SECTION F — PHOTO ENHANCEMENT REQUIREMENTS */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          padding: '0.75rem',
          borderRadius: '8px',
          background: isDark ? 'rgba(16, 185, 129, 0.05)' : '#F0FDF4',
          border: '1px solid rgba(16, 185, 129, 0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10B981' }}>
          <FiShield size={14} />
          <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Strict Room Preservation</span>
        </div>
        <div style={{ fontSize: '0.65625rem', color: isDark ? '#94A3B8' : '#64748B', lineHeight: 1.4 }}>
          Mandatory real estate authenticity: exact room structure, walls, windows, doors, furniture, flooring, and camera angles are preserved 100%. No virtual staging or added elements.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
          <div>
            <label style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Target Width
            </label>
            <input
              type="number"
              value={outputWidth}
              onChange={(e) => {
                const w = Number(e.target.value);
                setOutputWidth(w);
                updateConfig('outputWidth', w);
              }}
              style={{
                width: '100%',
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: isDark ? '#1E293B' : '#FFFFFF',
                color: 'var(--text-color)',
                fontSize: '0.75rem',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Target Height (4:5)
            </label>
            <input
              type="number"
              value={outputHeight}
              onChange={(e) => {
                const h = Number(e.target.value);
                setOutputHeight(h);
                updateConfig('outputHeight', h);
              }}
              style={{
                width: '100%',
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: isDark ? '#1E293B' : '#FFFFFF',
                color: 'var(--text-color)',
                fontSize: '0.75rem',
              }}
            />
          </div>
        </div>
      </div>

      {/* SECTION G — SMART IMAGE QUEUE */}
      {(() => {
        // Strictly show jobs from current property run, or preview images from current "Get Images"
        const currentPropId = propertyContext?.id;
        const matchingQueueJobs = currentPropId
          ? queueJobs.filter((j) => j.property_id === currentPropId)
          : [];

        const displayQueueItems: any[] = matchingQueueJobs.length > 0
          ? matchingQueueJobs
          : (propertyContext?.images || []).map((img, i) => ({
              id: `preview-${i + 1}`,
              job_id: `get-images-photo-${i + 1}`,
              property_id: currentPropId || '',
              original_position: img.index || i + 1,
              status: 'READY_FOR_USER',
              source_file_url: img.url,
              output_file_url: '',
            }));

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                Smart Image Queue ({displayQueueItems.length} Images)
              </label>
              <Button
                size="sm"
                variant="secondary"
                onClick={loadQueue}
                style={{ padding: '2px 6px', fontSize: '0.625rem' }}
              >
                <FiRefreshCw size={10} />
              </Button>
            </div>

            {displayQueueItems.length === 0 ? (
              <div
                style={{
                  padding: '1.25rem 0.85rem',
                  borderRadius: '6px',
                  textAlign: 'center',
                  background: isDark ? '#1E293B' : '#F8FAFC',
                  border: '1px dashed var(--border-color)',
                  color: '#94A3B8',
                  fontSize: '0.6875rem',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 600, color: isDark ? '#CBD5E1' : '#475569', marginBottom: '4px' }}>
                  No Active Images In Queue
                </div>
                Photos from the current run will appear here automatically when "Get Images" executes. Historical runs from previous workflows are never displayed.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '220px', overflowY: 'auto' }}>
                {displayQueueItems.map((job) => {
                  const isCompleted = job.status === 'COMPLETED';
                  const isReady = job.status === 'READY_FOR_USER';
                  const isLocal = job.status === 'PROCESSING_LOCAL';
                  const isFailed = job.status === 'FAILED';

                  const badgeColor = isCompleted
                    ? '#10B981'
                    : isReady
                    ? '#06B6D4'
                    : isLocal
                    ? '#8B5CF6'
                    : isFailed
                    ? '#EF4444'
                    : '#6B7280';

                  return (
                    <div
                      key={job.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.5rem 0.65rem',
                        borderRadius: '6px',
                        background: isDark ? '#1E293B' : '#FFFFFF',
                        border: `1px solid ${isReady ? 'rgba(6, 182, 212, 0.4)' : 'var(--border-color)'}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '4px',
                            backgroundColor: isDark ? '#0F172A' : '#E2E8F0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.625rem',
                            fontWeight: 700,
                          }}
                        >
                          {job.original_position}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.6875rem', fontWeight: 600 }}>
                            Image {job.original_position} of {displayQueueItems.length}
                          </div>
                          <div style={{ fontSize: '0.5625rem', color: '#94A3B8' }}>
                            {String(job.job_id).slice(0, 18)}...
                          </div>
                        </div>
                      </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: '10px',
                        fontSize: '0.5625rem',
                        fontWeight: 600,
                        backgroundColor: `${badgeColor}22`,
                        color: badgeColor,
                        border: `1px solid ${badgeColor}44`,
                      }}
                    >
                      {job.status}
                    </span>

                    {/* Quick Action Buttons */}
                    {isReady && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => pauseImageJob(job.job_id).then(loadQueue)}
                        title="Pause Job"
                        style={{ padding: '2px 4px' }}
                      >
                        <FiPause size={10} />
                      </Button>
                    )}
                    {job.status === 'PENDING' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => resumeImageJob(job.job_id).then(loadQueue)}
                        title="Resume / Activate"
                        style={{ padding: '2px 4px' }}
                      >
                        <FiPlay size={10} />
                      </Button>
                    )}
                    {isFailed && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => retryImageJob(job.job_id).then(loadQueue)}
                        title="Retry Failed"
                        style={{ padding: '2px 4px' }}
                      >
                        <FiRotateCcw size={10} />
                      </Button>
                    )}
                    {job.output_file_url && (
                      <a
                        href={job.output_file_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#10B981', display: 'flex', alignItems: 'center' }}
                        title="View Enhanced Master"
                      >
                        <FiExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Automated Multi-Tab Group Workflow Controller */}
        <div
          style={{
            marginTop: '0.35rem',
            padding: '0.65rem 0.75rem',
            borderRadius: '8px',
            background: isDark ? 'rgba(59, 130, 246, 0.08)' : '#EFF6FF',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: isAutomating ? '#10B981' : '#3B82F6',
                  boxShadow: isAutomating ? '0 0 8px #10B981' : 'none',
                }}
              />
              <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: isDark ? '#93C5FD' : '#1D4ED8' }}>
                Multi-Tab Auto Batch ({groupTabs.length || 4} Tabs)
              </span>
            </div>
            <span style={{ fontSize: '0.59375rem', color: '#64748B', fontWeight: 600 }}>
              Group: {selectedGroupName}
            </span>
          </div>

          <div style={{ fontSize: '0.625rem', color: isDark ? '#94A3B8' : '#64748B', lineHeight: 1.35 }}>
            Automates the whole pipeline: opens {groupTabs.length || 4} tabs in parallel, pastes image + prompt, sends, monitors generation, downloads enhanced output, and auto-rotates remaining queue images.
          </div>

          {/* Progress Bar when running */}
          {isAutomating && automationStatus && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.59375rem', color: '#3B82F6', fontWeight: 600 }}>
                <span>Processing in tabs...</span>
                <span>
                  {automationStatus.completed || 0} / {automationStatus.total || queueJobs.length} Completed
                </span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: '6px',
                  borderRadius: '3px',
                  backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${
                      automationStatus.total && automationStatus.total > 0
                        ? Math.min(100, Math.round(((automationStatus.completed || 0) / automationStatus.total) * 100))
                        : 20
                    }%`,
                    backgroundColor: '#10B981',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>
          )}

          {/* Status Message Notification */}
          {automationMessage && (
            <div
              style={{
                fontSize: '0.625rem',
                color: isDark ? '#E2E8F0' : '#1E293B',
                background: isDark ? 'rgba(15, 23, 42, 0.6)' : '#FFFFFF',
                padding: '4px 8px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <FiCheckCircle size={11} color="#10B981" />
              <span>{automationMessage}</span>
            </div>
          )}

          {/* Automation Action Buttons */}
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.1rem' }}>
            {isAutomating ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleStopGroupAutomation}
                style={{
                  flex: 1,
                  fontSize: '0.6875rem',
                  borderColor: '#EF4444',
                  color: '#EF4444',
                }}
              >
                <FiPause size={11} style={{ marginRight: '4px' }} /> Stop Automation
              </Button>
            ) : (
              <Button
                size="sm"
                variant="primary"
                onClick={handleStartGroupAutomation}
                disabled={queueJobs.length === 0 && (!propertyContext?.images || propertyContext.images.length === 0)}
                style={{
                  flex: 1,
                  fontSize: '0.6875rem',
                  background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
                  border: 'none',
                }}
              >
                <FiPlay size={11} style={{ marginRight: '4px' }} /> Auto-Process {groupTabs.length || 4} Tabs
              </Button>
            )}

            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                if (propertyContext?.id) {
                  startImageQueue(propertyContext.id).then(loadQueue);
                }
              }}
              disabled={isAutomating}
              title="Step single image manually"
              style={{ fontSize: '0.6875rem', padding: '0 8px' }}
            >
              Manual Step
            </Button>
          </div>
        </div>
      </div>
    );
  })()}

      {/* SECTION H — DOWNLOAD WATCHER */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
          padding: '0.65rem 0.75rem',
          borderRadius: '8px',
          background: isDark ? '#1E293B' : '#F8FAFC',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            macOS Download Watcher
          </span>
          <span style={{ fontSize: '0.625rem', color: downloadWatcher?.is_active ? '#10B981' : '#64748B' }}>
            {downloadWatcher?.is_active ? '● Monitoring' : '○ Idle'}
          </span>
        </div>
        <div style={{ fontSize: '0.625rem', color: '#94A3B8', wordBreak: 'break-all' }}>
          {downloadWatcher?.watch_directory || '~/Pictures/BoltHavenProperty/Processing'}
        </div>
        {downloadWatcher?.last_detected_file && (
          <div style={{ fontSize: '0.625rem', color: '#10B981', marginTop: '2px' }}>
            ✓ Last collected: {downloadWatcher.last_detected_file}
          </div>
        )}
      </div>
    </div>
  );
};
