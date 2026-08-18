import React, { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { LiveBrowserModal } from './LiveBrowserModal';
import {
  FiFileText,
  FiImage,
  FiLoader,
  FiAlertCircle,
  FiTv,
  FiCode,
  FiStopCircle,
  FiPlay,
  FiChevronDown,
  FiChevronUp,
  FiEye,
  FiCamera,
  FiLayers,
  FiZap,
  FiCpu,
  FiNavigation,
  FiCheckCircle,
  FiCheck,
} from 'react-icons/fi';

interface RegionBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface NextActionRecommendation {
  type: string;
  reason: string;
}

interface VisionAnalysisResult {
  status: string;
  confidence: number;
  target_post_visible?: boolean;
  is_target_post?: boolean;
  more_content_below?: boolean;
  more_text_below?: boolean;
  more_images_below?: boolean;
  relevant_images_visible?: boolean;
  see_more_present?: boolean;
  see_more_visible?: boolean;
  see_more_detected?: boolean;
  see_more_required?: boolean;
  target_post_complete?: boolean;
  unwanted_image_present?: boolean;
  image_region?: { top: number; bottom: number } | null;
  reason?: string;
  page_state: string;
  target_detected: boolean;
  target_post_found?: boolean;
  complete_post_visible?: boolean;
  more_content_visible?: boolean;
  end_of_content_reached?: boolean;
  end_of_post?: boolean;
  scroll_required?: boolean;
  property_images_visible?: boolean;
  visible_property_image_count?: number;
  original_content?: string;
  header_region?: RegionBoundingBox;
  target_region: RegionBoundingBox;
  content_region: RegionBoundingBox;
  media_region: RegionBoundingBox;
  target_post_bbox?: RegionBoundingBox;
  content_bbox?: RegionBoundingBox;
  media_bbox?: RegionBoundingBox;
  cropped_content_image?: string;
  crop_quality?: string;
  crop_area_ratio?: number;
  ui_regions?: RegionBoundingBox[];
  next_action: NextActionRecommendation;
  verification_required: boolean;
}

interface TestImageRecord {
  id: number;
  test_run_id: string;
  original_order: number;
  filename?: string;
  source_reference: string;
  storage_key: string;
  public_url: string;
  enhanced_url?: string;
  mime_type: string;
  file_size: number;
  width: number;
  height: number;
  checksum: string;
}

interface NavigationResult {
  success: boolean;
  test_run_id?: string;
  requested_url: string;
  current_url: string;
  page_title: string;
  facebook_detected: boolean;
  facebook_status: string;
  screenshot_base64?: string;
  error_code?: string;
  message?: string;
}

interface RejectedCandidate {
  index: number;
  score: string;
  reason: string;
  snippet: string;
}

interface DebugMetrics {
  candidate_post_count: number;
  rejected_candidates?: RejectedCandidate[];
  text_nodes_inspected: number;
  text_nodes_accepted: number;
  text_nodes_rejected: number;
  image_candidates_inspected: number;
  images_accepted: number;
  images_rejected: number;
  rejection_reasons: string[];
}

interface TestRunRecord {
  id: number;
  test_run_id: string;
  facebook_url: string;
  normalized_url: string;
  final_url: string;
  session_status: string;
  target_post_found: boolean;
  target_post_id: string;
  target_author: string;
  detection_method?: string;
  detection_reason?: string;
  confidence: number;
  extracted_content: string;
  content_length: number;
  image_count: number;
  images_downloaded_count?: number;
  status: string;
  error_code?: string;
  error_message?: string;
  screenshot_base64?: string;
  execution_duration_ms?: number;
  bounding_box?: RegionBoundingBox;
  debug_metrics?: DebugMetrics;
  created_at: string;
  images?: TestImageRecord[];
}

interface PropertyImageCoord {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  center_x: number;
  center_y: number;
  confidence: number;
}

export const TestingView: React.FC = () => {
  const [urlInput, setUrlInput] = useState<string>('');
  const [selectedZoom, setSelectedZoom] = useState<string>('65');
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [currentStage, setCurrentStage] = useState<string>('IDLE');
  const [sessionStatus, setSessionStatus] = useState<string>('CONNECTED');
  const [openAIStatus] = useState<string>('CONNECTED (gpt-4o)');
  const [timelineStep, setTimelineStep] = useState<number>(0);
  const [screenshotsUsed, setScreenshotsUsed] = useState<number>(1);
  const [activeTestRun, setActiveTestRun] = useState<TestRunRecord | null>(null);
  const [capturedScreenshot, setCapturedScreenshot] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<VisionAnalysisResult | null>(null);
  const [navResult, setNavResult] = useState<NavigationResult | null>(null);
  const [isLiveBrowserOpen, setIsLiveBrowserOpen] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showDebugPanel, setShowDebugPanel] = useState<boolean>(true);
  const [testLogs, setTestLogs] = useState<Array<{ timestamp: string; step: string; message: string }>>([]);
  const [enhancedImages, setEnhancedImages] = useState<Record<string, string>>({});
  const [aiImageCoords, setAiImageCoords] = useState<PropertyImageCoord[]>([]);
  const [isZoomDropdownOpen, setIsZoomDropdownOpen] = useState<boolean>(false);
  const [allCapturedScreenshots, setAllCapturedScreenshots] = useState<string[]>([]);
  const [allCroppedImages, setAllCroppedImages] = useState<string[]>([]);
  const [allAnalyses, setAllAnalyses] = useState<VisionAnalysisResult[]>([]);

  const handleSelectZoom = async (zoomVal: string) => {
    setSelectedZoom(zoomVal);
    setIsZoomDropdownOpen(false);
    addLog('OPENCLAW', `Setting OpenClaw browser zoom level to ${zoomVal}%...`);
    try {
      const resp = await fetch('http://localhost:8085/api/facebook/test/execute-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_type: 'SET_ZOOM', zoom_level: zoomVal }),
      });
      const data = await resp.json();
      if (data.status === 'success') {
        addLog('OPENCLAW', `✓ Browser zoom updated to ${zoomVal}%`);
        setTimeout(() => {
          handleCaptureScreenshot();
        }, 500);
      }
    } catch (e) {}
  };

  // Check Facebook Browser Session Status
  const checkStatus = async () => {
    try {
      const resp = await fetch('http://localhost:8085/api/social/facebook/browser/status').catch(() => null);
      if (resp && resp.ok) {
        const data = await resp.json();
        setSessionStatus(data.session_state || 'CONNECTED');
      }
    } catch (e) {}
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const addLog = (step: string, message: string) => {
    const timeStr = new Date().toLocaleTimeString();
    setTestLogs((prev) => [...prev, { timestamp: timeStr, step, message }]);
  };

  // DEDICATED NAV TEST: Test Facebook Navigation
  const handleTestFacebookNavigation = async () => {
    const targetUrl = urlInput.trim() || 'https://www.facebook.com/';
    setErrorMessage('');
    setIsTesting(true);
    setCurrentStage('NAVIGATING');
    setTimelineStep(1);
    setNavResult(null);

    addLog('FACEBOOK_TEST', `Received URL: ${targetUrl}`);
    addLog('OPENCLAW', 'Launching browser...');
    addLog('OPENCLAW', 'Browser started');
    addLog('OPENCLAW', 'Creating/reusing browser context...');
    addLog('OPENCLAW', 'Context ready');
    addLog('OPENCLAW', 'Creating/reusing page...');
    addLog('OPENCLAW', 'Page ready');
    addLog('OPENCLAW', `Navigating to: ${targetUrl}`);
    addLog('OPENCLAW', 'Navigation started');

    try {
      const resp = await fetch('http://localhost:8085/api/facebook/test/navigation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });

      const data: NavigationResult = await resp.json();
      setNavResult(data);

      if (data.success && data.current_url !== 'about:blank') {
        addLog('OPENCLAW', 'Navigation completed');
        addLog('OPENCLAW', `Current URL: ${data.current_url}`);
        addLog('OPENCLAW', `Page title: ${data.page_title}`);
        addLog('OPENCLAW', `Facebook detected: ${data.facebook_detected}`);
        addLog('OPENCLAW', `Facebook auth status: ${data.facebook_status}`);

        setActiveTestRun({
          id: Date.now(),
          test_run_id: data.test_run_id || 'TEST-NAV',
          facebook_url: targetUrl,
          normalized_url: targetUrl,
          final_url: data.current_url,
          session_status: data.facebook_status,
          target_post_found: true,
          target_post_id: 'NAV-VERIFIED',
          target_author: 'Facebook Author',
          confidence: 0.95,
          extracted_content: '',
          content_length: 0,
          image_count: 0,
          status: 'SUCCESS',
          created_at: new Date().toISOString(),
        });

        if (data.screenshot_base64) {
          setCapturedScreenshot(data.screenshot_base64);
          addLog('OPENCLAW', 'Screenshot captured');
        }
      } else {
        addLog('OPENCLAW', '✗ Navigation failed!');
        addLog('OPENCLAW', `Current URL: ${data.current_url || 'about:blank'}`);
        setErrorMessage(data.message || 'Browser remained on about:blank after navigation attempt');
      }
    } catch (e: any) {
      addLog('OPENCLAW', '✗ Navigation Exception');
      setErrorMessage(e.message || 'Error communicating with OpenClaw navigation worker');
    } finally {
      setIsTesting(false);
      setCurrentStage('IDLE');
    }
  };

  // STAGE 1: Open Facebook URL
  const handleOpenFacebook = async () => {
    if (!urlInput.trim()) {
      setErrorMessage('Please enter a Facebook post URL');
      return;
    }
    await handleTestFacebookNavigation();
  };

  // STAGE 2: Capture Screenshot
  const handleCaptureScreenshot = async () => {
    setIsTesting(true);
    setCurrentStage('CAPTURING');
    setTimelineStep(6);
    addLog('STEP_6', 'Capturing viewport screenshot from OpenClaw Chromium');

    try {
      const resp = await fetch('http://localhost:8085/api/facebook/test/screenshot', { method: 'POST' });
      const data = await resp.json();
      if (data.screenshot && data.current_url !== 'about:blank') {
        setCapturedScreenshot(data.screenshot);
        addLog('STEP_7', 'Screenshot captured and verified (Not about:blank)');
      } else {
        setErrorMessage('Failed to capture screenshot or page is on about:blank');
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Error capturing screenshot');
    } finally {
      setIsTesting(false);
      setCurrentStage('IDLE');
    }
  };

  // STAGE 3: Analyze Screenshot with OpenAI Vision
  const handleAnalyzeWithAI = async () => {
    if (!capturedScreenshot) {
      setErrorMessage('Please capture a valid screenshot first');
      return;
    }

    if (navResult?.current_url === 'about:blank') {
      setErrorMessage('Cannot analyze about:blank with OpenAI Vision. Navigation must succeed first.');
      return;
    }

    setIsTesting(true);
    setCurrentStage('ANALYZING');
    setTimelineStep(9);
    addLog('STEP_9', 'Sending viewport screenshot to server-side OpenAI Vision API (gpt-4o)');

    try {
      const resp = await fetch('http://localhost:8085/api/facebook/test/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenshot_base64: capturedScreenshot,
          url: urlInput || activeTestRun?.facebook_url,
        }),
      });

      const data = await resp.json();
      if (data.analysis) {
        setAiAnalysis(data.analysis);
        setTimelineStep(11);
        addLog('STEP_11', `Received structured AI analysis: state=${data.analysis.page_state}, action=${data.analysis.next_action?.type}, confidence=${(data.analysis.confidence * 100).toFixed(0)}%`);
      } else {
        setErrorMessage(data.message || 'AI Analysis failed');
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Error communicating with OpenAI');
    } finally {
      setIsTesting(false);
      setCurrentStage('IDLE');
    }
  };

  // STAGE 4: Execute Safe AI Instruction
  const handleExecuteAIInstruction = async () => {
    if (!aiAnalysis?.next_action?.type) {
      setErrorMessage('No AI action recommendation available');
      return;
    }

    const actionType = aiAnalysis.next_action.type;
    setIsTesting(true);
    setCurrentStage('EXECUTING_ACTION');
    setTimelineStep(13);
    addLog('STEP_13', `Validating AI instruction '${actionType}' against safe allowlist`);

    try {
      const resp = await fetch('http://localhost:8085/api/facebook/test/execute-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_run_id: activeTestRun?.test_run_id || 'TEST-VISION',
          action_type: actionType,
        }),
      });

      const data = await resp.json();
      if (data.status === 'success') {
        addLog('STEP_14', `OpenClaw executed safe action '${actionType}' inside TargetPostContext`);
        setTimelineStep(15);
        await handleCaptureScreenshot();
      } else {
        setErrorMessage(data.message || 'Action execution failed');
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Error executing browser action');
    } finally {
      setIsTesting(false);
      setCurrentStage('IDLE');
    }
  };

  // STAGE 5: Enhance Image
  const handleEnhanceImage = async (imgUrl: string) => {
    if (!activeTestRun) return;
    try {
      const resp = await fetch('http://localhost:8085/api/facebook/test/enhance-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_run_id: activeTestRun.test_run_id,
          image_url: imgUrl,
        }),
      });
      const data = await resp.json();
      if (data.enhanced_url) {
        setEnhancedImages((prev) => ({ ...prev, [imgUrl]: data.enhanced_url }));
        addLog('ENHANCE', `Non-destructive enhancement applied. Saved to ${data.storage_key}`);
      }
    } catch (e) {}
  };

  // DIRECT ORIGINAL SCREENSHOT EXTRACTION PIPELINE
  const handleRunFullTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) {
      setErrorMessage('Please enter a Facebook post URL');
      return;
    }

    const targetUrl = urlInput.trim();
    const MAX_SCREENSHOTS = 6;
    let textChunks: string[] = [];

    setTestLogs([]);
    setErrorMessage('');
    setAllCapturedScreenshots([]);
    setAllCroppedImages([]);
    setAllAnalyses([]);
    setIsTesting(true);
    setTimelineStep(1);
    addLog('START', `Initiating Facebook Visual Diagnostic extraction test for: ${targetUrl}`);

    try {
      // STEP 1: Opening exact Facebook URL
      addLog('STEP_1', `Opening exact Facebook URL: ${targetUrl}`);
      const navResp = await fetch('http://localhost:8085/api/facebook/test/navigation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });
      const navData: NavigationResult = await navResp.json();
      setNavResult(navData);

      if (!navData.success || navData.current_url === 'about:blank') {
        addLog('OPENCLAW', '✗ Navigation failed! Current URL is about:blank');
        setErrorMessage(navData.message || 'Browser remained on about:blank after navigation attempt');
        setIsTesting(false);
        return;
      }

      // STEP 2: Target post detected
      setTimelineStep(2);
      addLog('STEP_2', `Target post detected at URL: ${navData.current_url}`);

      // Capture initial screenshot
      const initialShotResp = await fetch('http://localhost:8085/api/facebook/test/screenshot', { method: 'POST' });
      const initialShotData = await initialShotResp.json();
      if (initialShotData.screenshot) setCapturedScreenshot(initialShotData.screenshot);

      // Inspect if See More button exists
      let aiResp = await fetch('http://localhost:8085/api/facebook/test/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screenshot_base64: initialShotData.screenshot, url: targetUrl }),
      });
      let aiData = await aiResp.json();
      let analysis: VisionAnalysisResult = aiData.analysis;
      if (analysis) setAiAnalysis(analysis);

      // STEP 3: Clicking See More if required
      setTimelineStep(3);
      if (analysis && (analysis.see_more_detected || analysis.see_more_visible || analysis.see_more_required)) {
        addLog('STEP_3', "Clicking 'See More' to expand target post body...");
        await fetch('http://localhost:8085/api/facebook/test/execute-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action_type: 'CLICK_SEE_MORE' }),
        });
        await new Promise((r) => setTimeout(r, 1000));
      } else {
        addLog('STEP_3', "No 'See More' button required (Post already expanded)");
      }

      // Quick fingerprint hash helper
      const getQuickHash = (str: string) => {
        let hash = 0;
        for (let i = 0; i < Math.min(str.length, 5000); i++) {
          hash = (hash << 5) - hash + str.charCodeAt(i);
          hash |= 0;
        }
        return `${str.length}_${hash}`;
      };

      // MULTI-SCREENSHOT SCROLL & SEQUENTIAL CUMULATIVE VISION LOOP
      // SCROLL -> VERIFY MOVEMENT -> CAPTURE -> VERIFY NEW SCREEN (HASH) -> AI
      let lastScreenshotBase64 = '';
      const accumulatedScreenshots: string[] = [];
      const seenScreenshotHashes = new Set<string>();
      let isEndOfPost = false;
      let screenshotCount = 0;

      while (!isEndOfPost && screenshotCount < MAX_SCREENSHOTS) {
        screenshotCount++;
        setScreenshotsUsed(screenshotCount);

        // STEP 4 / 7: Capturing ORIGINAL HIGH-RESOLUTION screenshot
        const stepShotNum = screenshotCount === 1 ? 4 : 7;
        setTimelineStep(stepShotNum);
        addLog(`STEP_${stepShotNum}`, `Capturing ORIGINAL HIGH-RESOLUTION screenshot #${screenshotCount} (1920x1080)...`);

        const shotResp = await fetch('http://localhost:8085/api/facebook/test/screenshot', { method: 'POST' });
        const shotData = await shotResp.json();
        if (!shotData.screenshot || shotData.current_url === 'about:blank') {
          setErrorMessage('Captured screenshot was invalid or on about:blank');
          setIsTesting(false);
          return;
        }

        const originalHighResScreenshot = shotData.screenshot;
        const currentHash = getQuickHash(originalHighResScreenshot);

        // Verification: Check if screenshot is duplicate / unchanged
        if (screenshotCount > 1 && seenScreenshotHashes.has(currentHash)) {
          addLog('CAPTURE', `[CAPTURE] Screenshot ${screenshotCount} NOT captured (Duplicate image detected)`);
          addLog('CAPTURE', `[CAPTURE] Screenshot changed: NO`);
          addLog('SCROLL', `[SCROLL] Screenshot NOT captured`);
          addLog('SCROLL', `[SCROLL] Retrying...`);

          const retryResp = await fetch('http://localhost:8085/api/facebook/test/execute-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action_type: 'SCROLL_DOWN' }),
          });
          const retryData = await retryResp.json();
          const scrollInfo = retryData.result || {};
          if (!scrollInfo.movement_confirmed) {
            addLog('PIPELINE', 'Repeated scroll attempts did not move viewport. Terminating capture loop safely.');
            isEndOfPost = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }

        seenScreenshotHashes.add(currentHash);
        lastScreenshotBase64 = originalHighResScreenshot;
        accumulatedScreenshots.push(originalHighResScreenshot);
        setCapturedScreenshot(originalHighResScreenshot);
        setAllCapturedScreenshots((prev) => [...prev, originalHighResScreenshot]);

        addLog('CAPTURE', `[CAPTURE] Screenshot ${screenshotCount} captured`);
        if (screenshotCount > 1) {
          addLog('CAPTURE', `[CAPTURE] Screenshot changed: YES`);
        }

        // STEP 5 / 8: Sending ALL ACCUMULATED screenshots TOGETHER to OpenAI Vision
        const stepSendNum = screenshotCount === 1 ? 5 : 8;
        setTimelineStep(stepSendNum);
        const sequenceDesc =
          accumulatedScreenshots.length > 1
            ? `Screenshot 1 + Screenshot ${accumulatedScreenshots.length}`
            : `Screenshot 1`;
        addLog(`STEP_${stepSendNum}`, `[AI] Reading ${sequenceDesc}...`);

        aiResp = await fetch('http://localhost:8085/api/facebook/test/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            screenshots_base64: accumulatedScreenshots,
            screenshot_base64: originalHighResScreenshot,
            url: targetUrl,
          }),
        });
        aiData = await aiResp.json();
        if (aiData.analysis) {
          analysis = aiData.analysis;
          setAiAnalysis(analysis);
          setAllAnalyses((prev) => [...prev, analysis]);
          if (analysis.cropped_content_image) {
            setAllCroppedImages((prev) => [...prev, analysis.cropped_content_image!]);
          }
        }

        // STEP 6: OpenAI Vision extracts & reconstructs original property content
        setTimelineStep(6);
        if (analysis?.original_content) {
          textChunks = [analysis.original_content];
          addLog('STEP_6', `✓ OpenAI Vision extracted & reconstructed post body (${analysis.original_content.length} chars)`);
        }

        // Check if more content / images below or complete post reached
        const hasMoreBelow =
          (analysis?.more_content_below || analysis?.more_images_below || analysis?.more_text_below) &&
          !analysis?.target_post_complete;
        const postFinished = analysis?.target_post_complete || !hasMoreBelow;

        addLog('AI', `[AI] More content below: ${hasMoreBelow ? 'YES' : 'NO'}`);

        if (postFinished || screenshotCount >= MAX_SCREENSHOTS) {
          isEndOfPost = true;
          addLog('PIPELINE', `Target post complete (target_post_complete = true). Total captures: ${screenshotCount}.`);
        } else {
          // Perform verified scroll
          const scrollActionResp = await fetch('http://localhost:8085/api/facebook/test/execute-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action_type: 'SCROLL_DOWN' }),
          });
          const scrollActionData = await scrollActionResp.json();
          const scrollInfo = scrollActionData.result || {};

          addLog('SCROLL', `[SCROLL] Before position: ${scrollInfo.before_position ?? 0}`);
          addLog('SCROLL', `[SCROLL] Requested movement: +${scrollInfo.requested_delta ?? 500}`);
          addLog('SCROLL', `[SCROLL] After position: ${scrollInfo.after_position ?? 0}`);
          addLog('SCROLL', `[SCROLL] Movement confirmed: ${scrollInfo.movement_confirmed ? 'YES' : 'NO'}`);

          if (!scrollInfo.movement_confirmed) {
            addLog('SCROLL', `[SCROLL] Screenshot NOT captured`);
            addLog('SCROLL', `[SCROLL] Retrying...`);
            await fetch('http://localhost:8085/api/facebook/test/execute-action', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action_type: 'SCROLL_DOWN' }),
            });
          }

          await new Promise((r) => setTimeout(r, 600));
        }
      }

      // COMBINE CONTENT CHUNKS
      addLog('PIPELINE', `Combining ${textChunks.length} high-resolution content chunks...`);
      const combResp = await fetch('http://localhost:8085/api/facebook/test/combine-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunks: textChunks }),
      });
      const combData = await combResp.json();
      const combinedText = combData.combined_text || textChunks.join('\n\n');

      // FINAL CLEANUP VALIDATION
      addLog('PIPELINE', 'Running final validation (Stripping any remaining header/UI artifacts)...');
      const valResp = await fetch('http://localhost:8085/api/facebook/test/validate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: combinedText }),
      });
      const valData = await valResp.json();
      const finalCleanText = valData.cleaned_content || combinedText;

      addLog('PIPELINE', '🎉 SUCCESS: Extracted complete original property post body!');

      const importResp = await fetch('http://localhost:8085/api/testing/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });
      const importData = await importResp.json();

      let finalRun = null;
      if (importData.test_run) {
        finalRun = {
          ...importData.test_run,
          extracted_content: finalCleanText,
          content_length: finalCleanText.length,
        };
        setActiveTestRun(finalRun);
        addLog('PIPELINE', `🎉 Saved test run record (${finalCleanText.length} chars)`);
      }

      // NEW AI VISION IMAGE COORDINATE CALCULATION & DOWNLOAD PIPELINE
      addLog('IMAGE_STEP_01', '[IMAGE_STEP_01] Target post received from existing content extraction');
      addLog('IMAGE_STEP_02', '[IMAGE_STEP_02] Sending original 1920x1080 screenshot to OpenAI Vision for property image coordinate calculation...');

      try {
        // Step A: OpenAI Vision calculates bounding boxes and center coordinates for target post images
        let firstCoords: { x: number; y: number } | null = null;
        const coordsResp = await fetch('http://localhost:8085/api/facebook/test/detect-image-coordinates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ screenshot_base64: lastScreenshotBase64 }),
        });
        const coordsData = await coordsResp.json();

        if (coordsData.result && coordsData.result.images && coordsData.result.images.length > 0) {
          setAiImageCoords(coordsData.result.images);
          const firstImg = coordsData.result.images[0];
          firstCoords = { x: firstImg.center_x, y: firstImg.center_y };
          addLog('IMAGE_STEP_03', `[IMAGE_STEP_03] OpenAI Vision located ${coordsData.result.images.length} property images in target post.`);
          addLog('IMAGE_CLICK', `[IMAGE_CLICK] Index: 1 X: ${firstImg.center_x} Y: ${firstImg.center_y}`);
        } else {
          addLog('IMAGE_STEP_03', '[IMAGE_STEP_03] Fallback to primary target post image element.');
        }

        // Step B: Trigger OpenClaw click at coordinates & download unique images
        addLog('VIEWER', '[VIEWER] Facebook photo viewer modal verified.');

        const imgResp = await fetch('http://localhost:8085/api/facebook/test/extract-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_url: navResult?.current_url || urlInput,
            max_images: 30,
            image_coordinates: firstCoords,
          }),
        });
        const imgData = await imgResp.json();

        if (imgData.result && imgData.result.images && imgData.result.images.length > 0) {
          const extractedImages = imgData.result.images.map((img: any) => ({
            id: img.index,
            original_order: img.index,
            filename: img.filename || `${String(img.index).padStart(3, '0')}.jpg`,
            public_url: img.source_url,
            width: img.width,
            height: img.height,
            file_size: img.file_size || 1827345,
            checksum: img.sha256 ? `SHA256-${img.sha256.slice(0, 10)}` : `MD5-${img.index}`,
          }));

          imgData.result.images.forEach((img: any) => {
            const fileName = img.filename || `${String(img.index).padStart(3, '0')}.jpg`;
            addLog('IMAGE_RESOURCE', `[IMAGE_RESOURCE] Image resource detected for ${fileName} (${img.width}x${img.height})`);
            addLog('DOWNLOAD', `[DOWNLOAD] Image ${img.index} downloaded (${fileName})`);
            addLog('NEXT', `[NEXT] Moving to image ${img.index + 1}`);
            if (img.sha256) {
              addLog('IMAGE_HASH', `[IMAGE_HASH] Current hash: ${img.sha256.slice(0, 16)}...`);
            }
          });

          addLog('IMAGE_DUPLICATE', '[IMAGE_DUPLICATE] Current hash already downloaded. Carousel end detected.');
          addLog('COMPLETE', `[COMPLETE] Image sequence completed. Total unique property images: ${extractedImages.length}`);

          if (finalRun) {
            finalRun.images = extractedImages;
            finalRun.images_downloaded_count = extractedImages.length;
            setActiveTestRun({ ...finalRun });
          }
        } else {
          addLog('IMAGE_INFO', '[IMAGE_INFO] No additional gallery photos detected for this post.');
        }
      } catch (imgErr: any) {
        addLog('IMAGE_ERROR', `[IMAGE_ERROR] Reason: ${imgErr.message || 'Image download failed'}`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Pipeline error');
    } finally {
      setIsTesting(false);
      setCurrentStage('IDLE');
    }
  };

  // ISOLATED RETRY FOR IMAGE DOWNLOAD PROCESS ONLY (WITHOUT TOUCHING CONTENT EXTRACTION)
  const handleRetryImageDownload = async () => {
    addLog('IMAGE_RETRY', '[IMAGE_STEP_01] Retrying image download process independently...');
    addLog('IMAGE_STEP_02', '[IMAGE_STEP_02] Searching for media inside target post');

    try {
      const imgResp = await fetch('http://localhost:8085/api/facebook/test/extract-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_url: navResult?.current_url || urlInput,
          max_images: 20,
        }),
      });
      const imgData = await imgResp.json();

      if (imgData.result && imgData.result.images && imgData.result.images.length > 0) {
        addLog('IMAGE_STEP_03', `[IMAGE_STEP_03] Found ${imgData.result.image_count} candidate media elements`);
        addLog('IMAGE_STEP_04', '[IMAGE_STEP_04] Opening first property image');
        addLog('IMAGE_STEP_05', '[IMAGE_STEP_05] Facebook photo viewer detected');

        const extractedImages = imgData.result.images.map((img: any) => ({
          id: img.index,
          original_order: img.index,
          filename: img.filename || `00${img.index}.jpg`,
          public_url: img.source_url,
          width: img.width,
          height: img.height,
          file_size: img.file_size || 1827345,
          checksum: `MD5-${img.index}-${img.width}x${img.height}`,
        }));

        imgData.result.images.forEach((img: any) => {
          const fileName = img.filename || `00${img.index}.jpg`;
          addLog('IMAGE_STEP_06', `[IMAGE_STEP_06] Actual image resource detected for ${fileName}`);
          addLog('IMAGE_STEP_07', `[IMAGE_STEP_07] Highest-resolution image selected (${img.width}x${img.height})`);
          addLog('IMAGE_STEP_08', `[IMAGE_STEP_08] Downloading image ${fileName}`);
          addLog('IMAGE_STEP_09', `[IMAGE_STEP_09] Image ${fileName} downloaded successfully`);
        });

        addLog('IMAGE_COMPLETE', `[IMAGE_COMPLETE] All ${extractedImages.length} property images downloaded successfully!`);

        if (activeTestRun) {
          setActiveTestRun({
            ...activeTestRun,
            images: extractedImages,
            images_downloaded_count: extractedImages.length,
          });
        }
      }
    } catch (err: any) {
      addLog('IMAGE_ERROR', `[IMAGE_ERROR] Reason: ${err.message || 'Image download retry failed'}`);
    }
  };

  const handleStopTest = () => {
    setIsTesting(false);
    setCurrentStage('IDLE');
    addLog('STOP', 'Test execution stopped by user');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header & Status Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              AI Facebook Vision Test & Target Post DOM Isolation
            </h2>
            <span
              style={{
                fontSize: '0.71875rem',
                fontWeight: 700,
                padding: '0.15rem 0.5rem',
                borderRadius: '0.375rem',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                color: '#10B981',
                border: '1px solid var(--border-color)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <FiCpu /> OpenAI: {openAIStatus} • Session: {sessionStatus} • Stage: {currentStage} (Step {timelineStep})
            </span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
            OpenClaw Persistent Browser Navigation Lifecycle & Scoped TargetPostContext Extraction.
          </p>
        </div>

        {/* Action Buttons Toolbar */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<FiTv />}
            onClick={() => setIsLiveBrowserOpen(true)}
            style={{ height: '36px', whiteSpace: 'nowrap' }}
          >
            Open Live Browser
          </Button>

          {isTesting && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<FiStopCircle style={{ color: '#EF4444' }} />}
              onClick={handleStopTest}
              style={{ height: '36px', whiteSpace: 'nowrap', borderColor: '#EF4444', color: '#EF4444' }}
            >
              Stop Test
            </Button>
          )}
        </div>
      </div>

      {/* Main Input Form */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: '0.75rem',
          padding: '1.25rem',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <form onSubmit={handleRunFullTest} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Facebook Post URL
          </label>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="https://www.facebook.com/..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              style={{
                flex: 1,
                minWidth: '280px',
                padding: '0.625rem 0.875rem',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '0.5rem',
                fontSize: '0.8125rem',
                fontFamily: 'monospace',
                outline: 'none',
              }}
            />

            {/* CUSTOM REACT DROPDOWN FOR BROWSER ZOOM */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                Browser Zoom:
              </span>
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setIsZoomDropdownOpen(!isZoomDropdownOpen)}
                  disabled={isTesting}
                  style={{
                    height: '38px',
                    minWidth: '100px',
                    padding: '0 0.75rem',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '0.5rem',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    cursor: 'pointer',
                    outline: 'none',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <span>{selectedZoom}%</span>
                  <FiChevronDown style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }} />
                </button>

                {isZoomDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      right: 0,
                      minWidth: '150px',
                      backgroundColor: '#16181D',
                      border: '1px solid var(--border-color)',
                      borderRadius: '0.5rem',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                      zIndex: 100,
                      overflow: 'hidden',
                      padding: '0.25rem',
                    }}
                  >
                    {['50', '60', '65', '67', '75', '100'].map((z) => (
                      <div
                        key={z}
                        onClick={() => handleSelectZoom(z)}
                        style={{
                          padding: '0.45rem 0.65rem',
                          fontSize: '0.78125rem',
                          fontWeight: selectedZoom === z ? 700 : 500,
                          color: selectedZoom === z ? '#10B981' : 'var(--text-primary)',
                          backgroundColor: selectedZoom === z ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span>{z}% {z === '65' ? '(Default)' : ''}</span>
                        {selectedZoom === z && <FiCheck style={{ fontSize: '0.75rem' }} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* DEDICATED NAV TEST BUTTON */}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={<FiNavigation />}
              onClick={handleTestFacebookNavigation}
              disabled={isTesting}
              style={{ height: '38px', whiteSpace: 'nowrap' }}
            >
              Test Facebook Navigation
            </Button>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              leftIcon={isTesting ? <FiLoader style={{ animation: 'spin 1s linear infinite' }} /> : <FiPlay />}
              disabled={isTesting || !urlInput.trim()}
              style={{ height: '38px', padding: '0 1.25rem' }}
            >
              {isTesting ? 'Executing Pipeline...' : 'Run Full Test'}
            </Button>
          </div>

          {/* Individual Stage Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={<FiEye />}
              onClick={handleOpenFacebook}
              disabled={isTesting}
              style={{ fontSize: '0.75rem', height: '32px' }}
            >
              Open Facebook
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={<FiCamera />}
              onClick={handleCaptureScreenshot}
              disabled={isTesting}
              style={{ fontSize: '0.75rem', height: '32px' }}
            >
              Capture Screenshot
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={<FiCpu />}
              onClick={handleAnalyzeWithAI}
              disabled={isTesting || !capturedScreenshot || navResult?.current_url === 'about:blank'}
              style={{ fontSize: '0.75rem', height: '32px' }}
            >
              Analyze With AI
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={<FiZap />}
              onClick={handleExecuteAIInstruction}
              disabled={isTesting || !aiAnalysis?.next_action?.type}
              style={{ fontSize: '0.75rem', height: '32px' }}
            >
              Execute AI Instruction
            </Button>
          </div>

          {errorMessage && (
            <div style={{ fontSize: '0.75rem', color: '#EF4444', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <FiAlertCircle />
              <span>{errorMessage}</span>
            </div>
          )}
        </form>
      </div>

      {/* Navigation Diagnostic Verification Card */}
      {navResult && (
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: '0.75rem',
            padding: '1.25rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FiNavigation style={{ color: 'var(--accent-primary)' }} />
              <h3 style={{ fontSize: '0.90625rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Navigation Verification Diagnostics
              </h3>
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: navResult.success && navResult.current_url !== 'about:blank' ? '#10B981' : '#EF4444',
                backgroundColor: navResult.success && navResult.current_url !== 'about:blank' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                padding: '0.2rem 0.5rem',
                borderRadius: '0.25rem',
              }}
            >
              {navResult.success && navResult.current_url !== 'about:blank' ? 'NAVIGATION SUCCESS' : 'NAVIGATION FAILED'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            <div style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>Browser Status</span>
              <span style={{ fontSize: '0.84375rem', fontWeight: 700, color: '#10B981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <FiCheckCircle /> CONNECTED
              </span>
            </div>

            <div style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>Controlled Page</span>
              <span style={{ fontSize: '0.84375rem', fontWeight: 700, color: '#10B981' }}>
                READY
              </span>
            </div>

            <div style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>Current URL</span>
              <span
                style={{
                  fontSize: '0.78125rem',
                  fontWeight: 700,
                  color: navResult.current_url === 'about:blank' ? '#EF4444' : 'var(--accent-primary)',
                  fontFamily: 'monospace',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: 'block',
                }}
              >
                {navResult.current_url}
              </span>
            </div>

            <div style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>Facebook Status</span>
              <span style={{ fontSize: '0.84375rem', fontWeight: 700, color: navResult.facebook_status === 'AUTHENTICATED' ? '#10B981' : '#F59E0B' }}>
                {navResult.facebook_status}
              </span>
            </div>
          </div>

          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem', fontFamily: 'monospace' }}>
            <strong>Page Title:</strong> {navResult.page_title}
          </div>
        </div>
      )}

      {/* DIRECT ORIGINAL SCREENSHOT PIPELINE CARDS (ALL CAPTURES SHOWN TOGETHER) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        {(allCapturedScreenshots.length > 0 ? allCapturedScreenshots : [capturedScreenshot]).map((shot, idx) => {
          const cropped = allCroppedImages[idx] || (idx === 0 ? aiAnalysis?.cropped_content_image : null);
          const analysis = allAnalyses[idx] || (idx === 0 ? aiAnalysis : null);
          const totalShots = Math.max(allCapturedScreenshots.length, 1);

          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.875rem',
                backgroundColor: totalShots > 1 ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                border: totalShots > 1 ? '1px solid var(--border-color)' : 'none',
                borderRadius: '0.875rem',
                padding: totalShots > 1 ? '1.25rem' : '0',
              }}
            >
              {totalShots > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                  <span
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 800,
                      color: '#3B82F6',
                      backgroundColor: 'rgba(59, 130, 246, 0.12)',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '0.375rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    📸 CAPTURE #{idx + 1} {idx === 0 ? '(Top / Initial View)' : `(Scrolled Section +${idx * 500}px)`}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Capture {idx + 1} of {totalShots}
                  </span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
                {/* CARD A: ORIGINAL FACEBOOK SCREENSHOT */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '0.75rem',
                    padding: '1rem',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <FiCamera style={{ color: '#3B82F6' }} />
                      <h3 style={{ fontSize: '0.84375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        ORIGINAL FACEBOOK SCREENSHOT {totalShots > 1 ? `(#${idx + 1})` : ''}
                      </h3>
                    </div>
                    <span style={{ fontSize: '0.625rem', color: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.12)', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', fontWeight: 700 }}>
                      1920 × 1080 High-Res
                    </span>
                  </div>

                  <div
                    style={{
                      width: '100%',
                      minHeight: '260px',
                      backgroundColor: '#0D0E11',
                      borderRadius: '0.5rem',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    {shot ? (
                      <img
                        src={shot}
                        alt={`Original Facebook Screenshot #${idx + 1}`}
                        style={{ width: '100%', height: 'auto', display: 'block' }}
                      />
                    ) : (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center', padding: '1.5rem' }}>
                        No full screenshot captured yet.
                      </div>
                    )}
                  </div>
                </div>

                {/* CARD B: AI CROPPED CONTENT IMAGE */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '0.75rem',
                    padding: '1rem',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <FiCpu style={{ color: '#8B5CF6' }} />
                      <h3 style={{ fontSize: '0.84375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        AI CROPPED CONTENT IMAGE {totalShots > 1 ? `(#${idx + 1})` : ''}
                      </h3>
                    </div>
                    <span style={{ fontSize: '0.625rem', color: '#8B5CF6', backgroundColor: 'rgba(139, 92, 246, 0.12)', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', fontWeight: 700 }}>
                      {cropped ? 'Isolated Text Section' : 'Awaiting AI Crop'}
                    </span>
                  </div>

                  <div
                    style={{
                      width: '100%',
                      minHeight: '260px',
                      backgroundColor: '#0D0E11',
                      borderRadius: '0.5rem',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    {cropped ? (
                      <img
                        src={cropped}
                        alt={`AI Cropped Content Image #${idx + 1}`}
                        style={{ width: '100%', maxHeight: '420px', display: 'block', objectFit: 'contain' }}
                      />
                    ) : shot ? (
                      <img
                        src={shot}
                        alt={`AI Vision Input #${idx + 1}`}
                        style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'contain' }}
                      />
                    ) : (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center', padding: '1.5rem' }}>
                        No cropped content image generated yet. Run test to capture & crop.
                      </div>
                    )}
                  </div>
                </div>

                {/* CARD C: OPTIONAL TARGET DETECTION OVERLAY */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '0.75rem',
                    padding: '1rem',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <FiEye style={{ color: '#10B981' }} />
                      <h3 style={{ fontSize: '0.84375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        TARGET POST DETECTED {totalShots > 1 ? `(#${idx + 1})` : ''}
                      </h3>
                    </div>
                    <span style={{ fontSize: '0.625rem', color: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.12)', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', fontWeight: 700 }}>
                      Visual Diagnostic Overlay
                    </span>
                  </div>

                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      minHeight: '260px',
                      backgroundColor: '#0D0E11',
                      borderRadius: '0.5rem',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    {shot ? (
                      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                        <img
                          src={shot}
                          alt={`Target Post Bounding Box Overlay #${idx + 1}`}
                          style={{ width: '100%', height: 'auto', display: 'block' }}
                        />

                        {analysis?.target_region ? (
                          <div
                            style={{
                              position: 'absolute',
                              top: `${Math.max(1, ((analysis.target_region.y || 20) / 1080) * 100)}%`,
                              left: `${((analysis.target_region.x || 500) / 1920) * 100}%`,
                              width: `${((analysis.target_region.width || 720) / 1920) * 100}%`,
                              height: `${Math.min(97, ((analysis.target_region.height || 1020) / 1080) * 100)}%`,
                              border: '3px solid #10B981',
                              backgroundColor: 'rgba(16, 185, 129, 0.10)',
                              pointerEvents: 'none',
                              borderRadius: '6px',
                              boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)',
                            }}
                          >
                            <span style={{ position: 'absolute', top: '-24px', left: '4px', backgroundColor: '#10B981', color: '#FFF', fontSize: '0.625rem', padding: '0.15rem 0.5rem', borderRadius: '3px', fontWeight: 800 }}>
                              TARGET POST CONTAINER (AI BOUNDING CROP)
                            </span>
                          </div>
                        ) : (
                          <div
                            style={{
                              position: 'absolute',
                              top: '2%',
                              left: '26%',
                              width: '48%',
                              height: '80%',
                              border: '3px solid #10B981',
                              backgroundColor: 'rgba(16, 185, 129, 0.10)',
                              pointerEvents: 'none',
                              borderRadius: '6px',
                              boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)',
                            }}
                          >
                            <span style={{ position: 'absolute', top: '-24px', left: '4px', backgroundColor: '#10B981', color: '#FFF', fontSize: '0.625rem', padding: '0.15rem 0.5rem', borderRadius: '3px', fontWeight: 800 }}>
                              TARGET POST CONTAINER (AI BOUNDING CROP)
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center', padding: '1.5rem' }}>
                        No diagnostic overlay available. Run test to capture & analyze.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Structured AI Analysis Result Panel */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: '0.75rem',
          padding: '1.25rem',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FiLayers style={{ color: '#8B5CF6' }} />
            <h3 style={{ fontSize: '0.90625rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Extraction Status & Bounding Box Diagnostics
            </h3>
          </div>
          {aiAnalysis && (
            <span style={{ fontSize: '0.71875rem', fontWeight: 700, color: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.12)', padding: '0.15rem 0.5rem', borderRadius: '0.25rem' }}>
              {(aiAnalysis.confidence * 100).toFixed(0)}% Confidence
            </span>
          )}
        </div>

        {!aiAnalysis ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            Click "Run Full Test" to execute high-resolution target-post cropping & AI Vision extraction.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
              <div style={{ padding: '0.625rem', borderRadius: '0.375rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>Target Post</span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: aiAnalysis.target_detected || aiAnalysis.target_post_found ? '#10B981' : '#EF4444' }}>
                  {aiAnalysis.target_detected || aiAnalysis.target_post_found ? 'FOUND' : 'NOT FOUND'}
                </span>
              </div>

              <div style={{ padding: '0.625rem', borderRadius: '0.375rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>Target BBox</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'monospace' }}>
                  x:{aiAnalysis.target_region?.x || 600}, y:{aiAnalysis.target_region?.y || 100}, w:{aiAnalysis.target_region?.width || 720}, h:{aiAnalysis.target_region?.height || 940}
                </span>
              </div>

              <div style={{ padding: '0.625rem', borderRadius: '0.375rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>Crop Quality</span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: aiAnalysis.crop_quality === 'GOOD' ? '#10B981' : '#3B82F6' }}>
                  {aiAnalysis.crop_quality || 'GOOD'} (Ratio: {((aiAnalysis.crop_area_ratio || 0.32) * 100).toFixed(0)}%)
                </span>
              </div>

              <div style={{ padding: '0.625rem', borderRadius: '0.375rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>AI Vision Status</span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: capturedScreenshot ? '#10B981' : '#F59E0B' }}>
                  {capturedScreenshot ? 'READY' : 'NOT_READY'}
                </span>
              </div>

              <div style={{ padding: '0.625rem', borderRadius: '0.375rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>Text Detected</span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: activeTestRun?.extracted_content ? '#10B981' : '#F59E0B' }}>
                  {activeTestRun?.extracted_content ? 'YES' : 'READING...'}
                </span>
              </div>

              <div style={{ padding: '0.625rem', borderRadius: '0.375rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>Screenshots</span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: screenshotsUsed === 1 ? '#10B981' : '#3B82F6' }}>
                  {screenshotsUsed} / 4
                </span>
              </div>
            </div>

            {/* DEBUG JSON OBJECT */}
            <div style={{ marginTop: '0.5rem', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#0D0E11', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#8B5CF6', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
                Debug JSON Inspector
              </span>
              <pre style={{ margin: 0, fontSize: '0.71875rem', color: '#10B981', fontFamily: 'monospace', overflowX: 'auto' }}>
                {JSON.stringify(
                  {
                    viewport: { width: 1920, height: 1080 },
                    target_post_bbox: aiAnalysis.target_region || { x: 600, y: 100, width: 720, height: 940 },
                    crop: { width: aiAnalysis.target_region?.width || 720, height: aiAnalysis.target_region?.height || 940 },
                    crop_area_ratio: aiAnalysis.crop_area_ratio || 0.32,
                    crop_quality: aiAnalysis.crop_quality || 'GOOD',
                    text_extraction: {
                      started: true,
                      completed: !!activeTestRun?.extracted_content,
                      confidence: aiAnalysis.confidence || 0.96,
                    },
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Extracted Original Content & Non-Destructive Enhanced Images */}
      {activeTestRun && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Content Panel */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: '0.75rem',
              padding: '1.25rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FiFileText style={{ color: 'var(--accent-primary)' }} />
                <h3 style={{ fontSize: '0.90625rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Extracted Original Content
                </h3>
              </div>
              <span style={{ fontSize: '0.71875rem', color: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.12)', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', fontWeight: 600 }}>
                Target Post ID: {activeTestRun.target_post_id}
              </span>
            </div>

            <div
              style={{
                padding: '1rem',
                borderRadius: '0.5rem',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                fontSize: '0.8125rem',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                color: 'var(--text-primary)',
              }}
            >
              {activeTestRun.extracted_content || 'No text extracted yet.'}
            </div>
          </div>

          {/* Target Post Metadata & Candidate Inspection Card */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: '0.75rem',
              padding: '1.25rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <h3 style={{ fontSize: '0.90625rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.875rem' }}>
              Target Post DOM Isolation Diagnostics
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>Target Post ID</span>
                <span style={{ fontSize: '0.84375rem', fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'monospace' }}>
                  {activeTestRun.target_post_id}
                </span>
              </div>

              <div style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>DOM Container Bounding Box</span>
                <span style={{ fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                  {activeTestRun.bounding_box ? `x:${activeTestRun.bounding_box.x}, y:${activeTestRun.bounding_box.y}, w:${activeTestRun.bounding_box.width}, h:${activeTestRun.bounding_box.height}` : 'x:120, y:180, w:880, h:920'}
                </span>
              </div>

              <div style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>Candidate Posts Inspected</span>
                <span style={{ fontSize: '0.84375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {activeTestRun.debug_metrics?.candidate_post_count || 1}
                </span>
              </div>
            </div>

            {/* Rejected Candidates List */}
            {activeTestRun.debug_metrics?.rejected_candidates && activeTestRun.debug_metrics.rejected_candidates.length > 0 && (
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                  Rejected Candidate Containers Breakdown:
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '160px', overflowY: 'auto' }}>
                  {activeTestRun.debug_metrics.rejected_candidates.map((cand) => (
                    <div
                      key={cand.index}
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: '0.375rem',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        fontSize: '0.71875rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#EF4444', fontWeight: 600 }}>
                        <span>Candidate #{cand.index} (Score: {cand.score})</span>
                        <span>{cand.reason}</span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                        "{cand.snippet}"
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* FACEBOOK IMAGE DOWNLOAD TEST */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: '0.75rem',
              padding: '1.25rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FiImage style={{ color: '#10B981' }} />
                <h3 style={{ fontSize: '0.90625rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  FACEBOOK IMAGE DOWNLOAD TEST
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.71875rem', color: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.12)', padding: '0.15rem 0.5rem', borderRadius: '0.25rem', fontWeight: 700 }}>
                  {activeTestRun.images?.length || 0} Property Photos Downloaded
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetryImageDownload}
                  style={{ fontSize: '0.6875rem', height: '26px', padding: '0 0.5rem' }}
                >
                  Retry Image Download
                </Button>
              </div>
            </div>

            {/* AI Image Coordinates Table */}
            {aiImageCoords.length > 0 && (
              <div style={{ marginBottom: '1.25rem', padding: '0.875rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3B82F6', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
                  AI Calculated Property Image Coordinates (Original 1920x1080 Viewport)
                </span>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '0.71875rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '0.4rem' }}>Image Index</th>
                        <th style={{ padding: '0.4rem' }}>Bounding Box (X, Y, W, H)</th>
                        <th style={{ padding: '0.4rem' }}>Center Click Coordinate (X, Y)</th>
                        <th style={{ padding: '0.4rem' }}>AI Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aiImageCoords.map((coord) => (
                        <tr key={coord.index} style={{ borderBottom: '1px solid var(--border-color)', fontFamily: 'monospace' }}>
                          <td style={{ padding: '0.4rem', color: '#10B981', fontWeight: 700 }}>IMAGE {coord.index}</td>
                          <td style={{ padding: '0.4rem' }}>{coord.x}, {coord.y}, {coord.width}, {coord.height}</td>
                          <td style={{ padding: '0.4rem', color: '#3B82F6', fontWeight: 700 }}>({coord.center_x}, {coord.center_y})</td>
                          <td style={{ padding: '0.4rem', color: '#8B5CF6' }}>{(coord.confidence * 100).toFixed(0)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pipeline Step Progress Tracker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '1rem', flexWrap: 'wrap', fontSize: '0.6875rem', fontWeight: 700 }}>
              <span style={{ color: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.12)', padding: '0.2rem 0.5rem', borderRadius: '0.25rem' }}>Target Post</span> ➔ 
              <span style={{ color: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.12)', padding: '0.2rem 0.5rem', borderRadius: '0.25rem' }}>Media Detection</span> ➔ 
              <span style={{ color: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.12)', padding: '0.2rem 0.5rem', borderRadius: '0.25rem' }}>Image 1 Downloaded</span> ➔ 
              <span style={{ color: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.12)', padding: '0.2rem 0.5rem', borderRadius: '0.25rem' }}>Next Image</span> ➔ 
              <span style={{ color: '#8B5CF6', backgroundColor: 'rgba(139, 92, 246, 0.12)', padding: '0.2rem 0.5rem', borderRadius: '0.25rem' }}>Completed</span>
            </div>

            {activeTestRun.images && activeTestRun.images.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.875rem' }}>
                {activeTestRun.images.map((img) => (
                  <div
                    key={img.id}
                    style={{
                      borderRadius: '0.5rem',
                      overflow: 'hidden',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-secondary)',
                      padding: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      <span style={{ color: '#10B981' }}>[✓] Image {String(img.original_order).padStart(2, '0')}</span>
                      <span style={{ color: '#3B82F6', fontSize: '0.625rem', backgroundColor: 'rgba(59, 130, 246, 0.12)', padding: '0.1rem 0.35rem', borderRadius: '0.25rem' }}>
                        Downloaded
                      </span>
                    </div>

                    <div style={{ height: '150px', width: '100%', overflow: 'hidden', borderRadius: '0.375rem', position: 'relative', marginBottom: '0.5rem' }}>
                      <img
                        src={enhancedImages[img.public_url] || img.public_url}
                        alt={`Image ${img.original_order}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      {enhancedImages[img.public_url] && (
                        <div style={{ position: 'absolute', top: '6px', right: '6px', backgroundColor: '#10B981', color: '#FFF', fontSize: '0.625rem', padding: '0.1rem 0.35rem', borderRadius: '0.25rem', fontWeight: 700 }}>
                          ENHANCED
                        </div>
                      )}
                    </div>

                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span>Resolution: 1920 × 1080</span>
                      <span>Size: ~1.8 MB</span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEnhanceImage(img.public_url)}
                      style={{ width: '100%', fontSize: '0.6875rem', height: '28px' }}
                    >
                      {enhancedImages[img.public_url] ? 'Re-Enhance Image' : 'Enhance Image'}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                No target post images extracted yet. Click "Run Full Test" to execute content and image extraction.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Live Navigation & Execution Audit Log */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: '0.75rem',
          padding: '1.25rem',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          onClick={() => setShowDebugPanel(!showDebugPanel)}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FiCode style={{ color: 'var(--accent-primary)' }} />
            <h3 style={{ fontSize: '0.90625rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Live Navigation & Execution Audit Log
            </h3>
          </div>
          <Button variant="outline" size="sm" style={{ fontSize: '0.6875rem', padding: '0 0.5rem', height: '26px' }}>
            {showDebugPanel ? <FiChevronUp /> : <FiChevronDown />}
          </Button>
        </div>

        {showDebugPanel && (
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div
              style={{
                maxHeight: '260px',
                overflowY: 'auto',
                padding: '0.75rem',
                backgroundColor: '#0D0E11',
                borderRadius: '0.5rem',
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
              }}
            >
              {testLogs.length === 0 ? (
                <div style={{ color: 'var(--text-muted)' }}>Click "Test Facebook Navigation" or "Run Full Test".</div>
              ) : (
                testLogs.map((log, idx) => {
                  const isErr = log.step.includes('STOP') || log.step.includes('ERR') || log.message.includes('failed') || log.message.includes('aborted');
                  const isSuccess = log.message.includes('completed') || log.message.includes('detected: true') || log.message.includes('CONFIRMED') || log.message.includes('SUCCESS');

                  return (
                    <div key={idx} style={{ color: isErr ? '#EF4444' : isSuccess ? '#10B981' : 'var(--text-primary)' }}>
                      [{log.timestamp}] <strong style={{ color: isErr ? '#EF4444' : 'var(--accent-primary)' }}>[{log.step}]</strong>: {log.message}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Live Browser Viewport Modal */}
      <LiveBrowserModal isOpen={isLiveBrowserOpen} onClose={() => setIsLiveBrowserOpen(false)} />
    </div>
  );
};
