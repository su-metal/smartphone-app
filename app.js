// THE TOLL - スクワット検出アプリ (Reduced Duplication & Fixed Session Reset)
// MediaPipe Poseを使用してスクワットをカウント

(function() {
  'use strict';

  // ============================================
  // 設定
  // ============================================
  const APP_VERSION = 'v2.17 (Rescue Update)';
  const SUPABASE_URL = 'https://qcnzleiyekbgsiyomwin.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjbnpsZWl5ZWtiZ3NpeW9td2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0Mjk2NzMsImV4cCI6MjA4NDAwNTY3M30.NlGUfxDPzMgtu_J0vX7FMe-ikxafboGh5GMr-tsaLfI';
  const APP_LANG = new URLSearchParams(window.location.search).get('lang') === 'ja' ? 'ja' : 'en';
  const I18N = {
    en: {
      logged_in_as: 'Logged in:',
      membership_checking: 'Checking membership...',
      membership_check_failed: 'Membership check failed',
      membership_active: 'MEMBERSHIP: ACTIVE',
      membership_trial: 'MEMBERSHIP: TRIAL',
      membership_free: 'MEMBERSHIP: FREE',
      go_to_session: 'Go to PC Session',
      go_to_session_free: 'Go to PC Session (Free)',
      upgrade_to_pro: 'UPGRADE TO PRO',
      subscription_required: 'Paid plan required',
      manage_subscription: 'Manage Subscription',
      trial_days_left: 'TRIAL: {days} day(s) left',
      open_customer_portal_failed: 'Failed to open customer portal.',
      checkout_success_message: 'Payment completed. Membership will be reflected shortly.',
      checkout_cancel_message: 'Checkout was canceled.',
      google_login_failed: 'Google login failed: ',
      google_login_network_error: 'Google login failed due to network error.',
      checkout_url_failed: 'Failed to get checkout URL.',
      checkout_prepare_failed: 'Failed to prepare checkout.',
      enter_session_id: 'Please enter a session ID.',
      scanner_init_failed: 'Scanner init failed.',
      camera_start_failed: 'Camera start failed.',
      sending: 'Sending...',
      session_expired: 'Session expired. Please log in again.',
      send_failed: 'Send failed',
      unlock_success: 'Unlocked successfully!',
      session_not_found: 'Session not found',
      ai_loading: 'Loading AI...',
      confirm_cancel_training: 'Stop this training session?'
    },
    ja: {
      logged_in_as: 'ログイン中:',
      membership_checking: '会員確認中...',
      membership_check_failed: '会員確認に失敗しました',
      membership_active: '会員ステータス: 有効',
      membership_trial: '会員ステータス: トライアル',
      membership_free: '会員ステータス: 無料',
      go_to_session: 'PC連携へ進む',
      go_to_session_free: 'PC連携へ進む（無料）',
      upgrade_to_pro: 'PROへアップグレード',
      subscription_required: 'サブスク登録が必要です',
      manage_subscription: 'サブスク管理',
      trial_days_left: 'トライアル残り {days} 日',
      open_customer_portal_failed: 'サブスク管理ページを開けませんでした。',
      checkout_success_message: '決済が完了しました。会員状態の反映まで少し待ってください。',
      checkout_cancel_message: '決済はキャンセルされました。',
      google_login_failed: 'Googleログイン失敗: ',
      google_login_network_error: 'Googleログインに失敗しました。ネットワークを確認してください。',
      checkout_url_failed: '決済URLの取得に失敗しました。',
      checkout_prepare_failed: '決済の準備に失敗しました。',
      enter_session_id: 'セッションIDを入力してください',
      scanner_init_failed: 'スキャナー初期化失敗',
      camera_start_failed: 'カメラ起動失敗',
      sending: '送信中...',
      session_expired: 'ログインセッションが切れています',
      send_failed: '送信失敗',
      unlock_success: 'アンロック成功！',
      session_not_found: 'セッションなし',
      ai_loading: 'AI読み込み中...',
      confirm_cancel_training: 'トレーニングを中断しますか？'
    }
  };
  const t = (key, vars = {}) => {
    const base = (I18N[APP_LANG] && I18N[APP_LANG][key]) || I18N.en[key] || key;
    return Object.keys(vars).reduce(
      (acc, k) => acc.replaceAll(`{${k}}`, String(vars[k])),
      base
    );
  };

  // ============================================
  // 状態管理
  // ============================================
  const state = {
    supabase: null,
    user: null,
    subscriptionStatus: 'inactive',
    planTier: 'free',
    trialEndsAt: null,
    trialDaysLeft: 0,
    isPro: false,
    linkedDeviceId: null,
    sessionId: null,
    squatCount: 0,
    targetCount: 20, // デフォルト
    pendingTargetCount: null,
    exerciseType: 'SQUAT', // SQUAT, PUSHUP, SITUP
    cycleIndex: 0,
    selectedExerciseIndex: 0,
    sessionTargetById: {},
    isSquatting: false,
    startTime: null,
    audioContext: null,
    html5QrCode: null,
    poseCamera: null,
    deferredPrompt: null,
    pushupBaseline: null,
    situpBaseline: null,
    calibrationBuffer: [], // NEW: 安定判定用のバッファ
    _lastPersonTs: null,
    _lastPushLog: null,
    _lastCalibSpeak: 0,
    _lastGuideSpeak: 0,
    _squatReadySpoken: false,
    _membershipCheckInFlight: false
  };
 
  const EXERCISES = [
    { type: 'SQUAT', label: 'SQUAT', defaultCount: 20 },
    { type: 'PUSHUP', label: 'PUSH-UP', defaultCount: 20 },
    { type: 'SITUP', label: 'SIT-UP', defaultCount: 20 }
  ];
  const STORAGE_SELECTED_EXERCISE = 'the_toll_selected_exercise';

  // ============================================
  // DOM要素
  // ============================================
  const elements = {
    authScreen: document.getElementById('auth-screen'),
    authForm: document.getElementById('auth-form'),
    userInfo: document.getElementById('user-info'),
    googleLoginBtn: document.getElementById('google-login-btn'),
    userDisplayEmail: document.getElementById('user-display-email'),
    subscriptionStatusBadge: document.getElementById('subscription-status-badge'),
    trialBadge: document.getElementById('trial-badge'),
    installBtn: document.getElementById('install-btn'),
    subscribeBtn: document.getElementById('subscribe-btn'),
    manageSubscriptionBtn: document.getElementById('manage-subscription-btn'),
    toSessionBtn: document.getElementById('to-session-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    sessionLogoutBtn: document.getElementById('session-logout-btn'),

    sessionScreen: document.getElementById('session-screen'),
    sessionInput: document.getElementById('session-input'),
    startBtn: document.getElementById('start-btn'),
    scanQrBtn: document.getElementById('scan-qr-btn'),
    nextExerciseDisplay: document.getElementById('next-exercise-display'),
    proExerciseSelector: document.getElementById('pro-exercise-selector'),
    exerciseSelect: document.getElementById('exercise-select'),
    resetCycleBtn: document.getElementById('reset-cycle-btn'),
    cycleDebugInfo: document.getElementById('cycle-debug-info'), // NEW
    qrReaderContainer: document.getElementById('qr-reader-container'),
    closeScanBtn: document.getElementById('close-scan-btn'),
    
    squatScreen: document.getElementById('squat-screen'),
    camera: document.getElementById('camera'),
    canvas: document.getElementById('pose-canvas'),
    squatCountLabel: document.getElementById('squat-count'),
    statusLabel: document.getElementById('status'),
    guide: document.getElementById('guide'),
    currentSessionLabel: document.getElementById('current-session'),
    exerciseLabel: document.getElementById('exercise-label'), // NEW
    
    completeScreen: document.getElementById('complete-screen'),
    sessionTimeLabel: document.getElementById('session-time'),
    targetCountDisplay: document.getElementById('target-count-display'),
    completeRepsDisplay: document.getElementById('complete-reps-display'),
    unlockBtn: document.getElementById('unlock-btn'),
    unlockStatus: document.getElementById('unlock-status'),
    backToSessionBtn: document.getElementById('back-to-session-btn'),
    recalibrateBtn: document.getElementById('recalibrate-btn'),
    hint: document.getElementById('squat-hint'),
    overlayUi: document.querySelector('.overlay-ui'),
    fullscreenBtn: document.getElementById('fullscreen-btn')
  };

  // ============================================
  // ユーティリティ
  // ============================================
  function debugLog(msg) {
    // console.log(msg); // 完全に停止
  }


  function updateStatus(text) { elements.statusLabel.textContent = text; }
  function setManageSubscriptionVisible(visible) {
    if (!elements.manageSubscriptionBtn) return;
    elements.manageSubscriptionBtn.classList.toggle('hidden', !visible);
  }
  function setTrialBadge(text) {
    if (!elements.trialBadge) return;
    if (!text) {
      elements.trialBadge.classList.add('hidden');
      elements.trialBadge.textContent = '';
      return;
    }
    elements.trialBadge.textContent = text;
    elements.trialBadge.classList.remove('hidden');
  }

  function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
  }
  function normalizeDeviceId(raw) {
    const v = String(raw || '').trim();
    if (!v) return null;
    if (!/^[a-zA-Z0-9_-]{6,80}$/.test(v)) return null;
    return v;
  }

  function getStoredExerciseIndex() {
    const raw = localStorage.getItem(STORAGE_SELECTED_EXERCISE);
    const idx = parseInt(raw, 10);
    if (!Number.isInteger(idx)) return 0;
    return Math.max(0, Math.min(EXERCISES.length - 1, idx));
  }

  function updateExerciseControls() {
    // 8文字以上で有効化 (以前の4文字から変更)
    const sessionReady = !!((elements.sessionInput?.value || '').trim().length >= 8);
    if (elements.startBtn) {
      elements.startBtn.disabled = !sessionReady;
    }
    if (elements.nextExerciseDisplay) {
      elements.nextExerciseDisplay.classList.toggle('hidden', !!state.isPro || !sessionReady);
    }
    if (elements.proExerciseSelector) {
      elements.proExerciseSelector.classList.toggle('hidden', !(state.isPro && sessionReady));
    }
    if (elements.exerciseSelect) {
      elements.exerciseSelect.disabled = !state.isPro;
      elements.exerciseSelect.value = String(state.selectedExerciseIndex || 0);
    }
    if (elements.resetCycleBtn) {
      elements.resetCycleBtn.classList.add('hidden');
    }
    if (elements.cycleDebugInfo) {
      elements.cycleDebugInfo.classList.add('hidden');
    }
  }

  function applyExerciseIndex(idx) {
    const safeIdx = Math.max(0, Math.min(EXERCISES.length - 1, idx));
    const selected = EXERCISES[safeIdx];
    state.cycleIndex = safeIdx;
    state.selectedExerciseIndex = safeIdx;
    state.exerciseType = selected.type;

    if (elements.exerciseSelect) elements.exerciseSelect.value = String(safeIdx);
    if (elements.exerciseLabel) elements.exerciseLabel.textContent = selected.label;
    if (elements.nextExerciseDisplay) {
      elements.nextExerciseDisplay.textContent = `EXERCISE: ${selected.label}`;
    }
    if (elements.cycleDebugInfo) elements.cycleDebugInfo.textContent = `ID: ${safeIdx}`;

    if (elements.hint) {
      if (selected.type === 'SQUAT') elements.hint.textContent = 'SQUAT DEEP';
      else if (selected.type === 'PUSHUP') elements.hint.textContent = 'LOWER YOUR BODY';
      else if (selected.type === 'SITUP') elements.hint.textContent = 'USE SIDE VIEW';
    }

    if (elements.overlayUi) {
      if (selected.type === 'SITUP') elements.overlayUi.classList.add('landscape-mode');
      else elements.overlayUi.classList.remove('landscape-mode');
    }

    state.targetCount = state.isPro ? selected.defaultCount : 10;
    if (elements.targetCountDisplay) elements.targetCountDisplay.textContent = state.targetCount;
  }
  async function syncDeviceLink() {
    if (!state.user || !state.linkedDeviceId) return;
    try {
      const statusForDevice = state.isPro ? 'active' : 'inactive';
      const tierForDevice = state.isPro ? 'pro' : 'free';
      await state.supabase
        .from('device_links')
        .upsert({
          device_id: state.linkedDeviceId,
          user_id: state.user.id,
          subscription_status: statusForDevice,
          plan_tier: tierForDevice,
          trial_ends_at: state.trialEndsAt,
          updated_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString()
        }, { onConflict: 'device_id' });
    } catch (e) {
      debugLog('Device link sync failed: ' + (e?.message || e));
    }
  }

  async function refreshPlanByDevice() {
    if (!state.linkedDeviceId) {
      state.subscriptionStatus = 'inactive';
      state.planTier = 'free';
      state.trialEndsAt = null;
      state.trialDaysLeft = 0;
      state.isPro = false;
      updateExerciseControls();
      loadNextExercise();
      return;
    }

    try {
      const url = `${SUPABASE_URL}/rest/v1/device_links?device_id=eq.${encodeURIComponent(state.linkedDeviceId)}&select=subscription_status,plan_tier,trial_ends_at`;
      const res = await fetch(url, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        cache: 'no-store',
      });
      const rows = res.ok ? await res.json() : [];
      const row = rows && rows[0] ? rows[0] : null;
      const sub = String(row?.subscription_status || 'inactive').toLowerCase();
      const tier = String(row?.plan_tier || 'free').toLowerCase();
      const trialEnds = row?.trial_ends_at ? new Date(row.trial_ends_at).getTime() : 0;
      const trialActive = Number.isFinite(trialEnds) && trialEnds > Date.now();

      state.subscriptionStatus = sub;
      state.planTier = tier;
      state.trialEndsAt = row?.trial_ends_at || null;
      state.trialDaysLeft = trialActive ? Math.max(1, Math.ceil((trialEnds - Date.now()) / (24 * 60 * 60 * 1000))) : 0;
      // Device-based flow: treat either active status OR pro tier OR active trial as Pro.
      state.isPro = sub === 'active' || tier === 'pro' || trialActive;
    } catch (e) {
      debugLog('Device plan fetch failed: ' + (e?.message || e));
      state.subscriptionStatus = 'inactive';
      state.planTier = 'free';
      state.trialEndsAt = null;
      state.trialDaysLeft = 0;
      state.isPro = false;
    }

    updateExerciseControls();
    loadNextExercise();
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        debugLog(`Error Fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  }

  // ============================================
  // 認証・サブスク
  // ============================================
  async function updateUserInfo(user) {
    debugLog(`Updating info for: ${user.email}`);
    elements.userDisplayEmail.textContent = `${t('logged_in_as')} ${user.email}`;
    elements.authForm.classList.add('hidden');
    elements.userInfo.classList.remove('hidden');

    if (state._membershipCheckInFlight) return;
    state._membershipCheckInFlight = true;

    // Strict gate: lock session entry until membership is confirmed.
    elements.toSessionBtn.disabled = true;
    elements.toSessionBtn.textContent = t('membership_checking');
    elements.subscribeBtn.classList.add('hidden');
    setManageSubscriptionVisible(false);
    elements.subscriptionStatusBadge.textContent = 'MEMBERSHIP: CHECKING';
    elements.subscriptionStatusBadge.className = 'status-inactive';

    try {
      await state.supabase.auth.getSession();

      let profile = null;
      let lastError = null;
      for (let i = 0; i < 8; i++) {
        const { data, error } = await state.supabase
          .from('profiles')
          .select('subscription_status, plan_tier, trial_ends_at, trial_used')
          .eq('id', user.id)
          .single();
        profile = data || null;
        lastError = error || null;
        if (profile) break;
        await new Promise(r => setTimeout(r, 400));
      }

      if (!profile) {
        debugLog('Profile missing or unreadable: ' + (lastError?.message || 'no row'));
        elements.subscriptionStatusBadge.textContent = 'MEMBERSHIP: VERIFY FAILED';
        elements.subscriptionStatusBadge.className = 'status-inactive';
        setTrialBadge('');
        elements.toSessionBtn.disabled = true;
        elements.toSessionBtn.textContent = t('membership_check_failed');
        elements.subscribeBtn.classList.remove('hidden');
        setManageSubscriptionVisible(false);
        return;
      }

      // Initialize one-time 14-day trial for new free users.
      if (!profile.trial_ends_at && !profile.trial_used && profile.subscription_status !== 'active') {
        const trialEnds = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
        const { error: trialInitError } = await state.supabase
          .from('profiles')
          .update({ trial_ends_at: trialEnds, trial_used: true, plan_tier: 'free' })
          .eq('id', user.id);
        if (!trialInitError) {
          profile.trial_ends_at = trialEnds;
          profile.trial_used = true;
          if (!profile.plan_tier) profile.plan_tier = 'free';
        } else {
          debugLog('Trial init skipped: ' + trialInitError.message);
        }
      }

      const rawStatus = (profile.subscription_status || 'inactive').toString();
      const normalizedStatus = rawStatus.trim().toLowerCase();
      const planTier = (profile.plan_tier || 'free').toString().trim().toLowerCase();
      const trialEndsAt = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
      const now = new Date();
      const isTrialActive = !!(trialEndsAt && trialEndsAt.getTime() > now.getTime());
      const isActive = normalizedStatus === 'active';
      const isPro = isActive || isTrialActive;
      const trialDaysLeft = isTrialActive
        ? Math.max(1, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
        : 0;

      state.subscriptionStatus = normalizedStatus;
      state.planTier = planTier;
      state.trialEndsAt = profile.trial_ends_at || null;
      state.trialDaysLeft = trialDaysLeft;
      state.isPro = isPro;
      updateExerciseControls();
      loadNextExercise();
      await syncDeviceLink();

      if (isActive) {
        elements.subscriptionStatusBadge.textContent = t('membership_active');
        elements.subscriptionStatusBadge.className = 'status-active';
        setTrialBadge('');
      } else if (isTrialActive) {
        elements.subscriptionStatusBadge.textContent = t('membership_trial');
        elements.subscriptionStatusBadge.className = 'status-active';
        setTrialBadge(t('trial_days_left', { days: trialDaysLeft }));
      } else {
        elements.subscriptionStatusBadge.textContent = t('membership_free');
        elements.subscriptionStatusBadge.className = 'status-inactive';
        setTrialBadge('');
      }

      if (isActive) {
        elements.subscribeBtn.classList.add('hidden');
        setManageSubscriptionVisible(true);
        if (elements.manageSubscriptionBtn) {
          elements.manageSubscriptionBtn.textContent = t('manage_subscription');
        }
        elements.toSessionBtn.disabled = false;
        elements.toSessionBtn.textContent = t('go_to_session');
      } else if (isTrialActive) {
        elements.subscribeBtn.classList.remove('hidden');
        elements.subscribeBtn.textContent = t('upgrade_to_pro');
        setManageSubscriptionVisible(false);
        elements.toSessionBtn.disabled = false;
        elements.toSessionBtn.textContent = t('go_to_session');
      } else {
        elements.subscribeBtn.classList.remove('hidden');
        elements.subscribeBtn.textContent = t('upgrade_to_pro');
        setManageSubscriptionVisible(false);
        elements.toSessionBtn.disabled = false;
        elements.toSessionBtn.textContent = t('go_to_session_free');
      }
    } catch (e) {
      const msg = (e && e.message) ? e.message : String(e);
      debugLog('Profile logic crash: ' + msg);
      elements.subscriptionStatusBadge.textContent = `MEMBERSHIP: ERROR (${msg.slice(0, 18)})`;
      elements.subscriptionStatusBadge.className = 'status-inactive';
      setTrialBadge('');
      elements.toSessionBtn.disabled = true;
      elements.toSessionBtn.textContent = t('membership_check_failed');
      elements.subscribeBtn.classList.remove('hidden');
      setManageSubscriptionVisible(false);
    } finally {
      state._membershipCheckInFlight = false;
    }
  }

  async function handleGoogleLogin() {
    try {
      const redirectTo = `${window.location.origin}${window.location.pathname}${window.location.search}`;
      const { error } = await state.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo }
      });
      if (error) alert(t('google_login_failed') + error.message);
    } catch (e) {
      alert(t('google_login_network_error'));
      debugLog('Google login network error: ' + (e?.message || e));
    }
  }

  async function handleLogout() { await state.supabase.auth.signOut(); }

  function getPricingUrl() {
    const qs = new URLSearchParams();
    qs.set('lang', APP_LANG);
    if (state.linkedDeviceId) qs.set('device', state.linkedDeviceId);
    qs.set('source', 'app');
    return `${window.location.origin}/pricing.html?${qs.toString()}`;
  }

  async function handleSubscribe() {
    window.location.href = getPricingUrl();
  }

  async function handleManageSubscription() {
    try {
      const { data: sessionData } = await state.supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        alert('Please log in again before opening subscription settings.');
        return;
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-customer-portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey': SUPABASE_ANON_KEY
        }
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = payload?.error || `HTTP ${res.status}`;
        alert(`${t('open_customer_portal_failed')} ${detail}`);
        return;
      }

      if (payload?.url) window.location.href = payload.url;
      else alert(t('open_customer_portal_failed'));
    } catch (e) {
      alert(t('open_customer_portal_failed'));
    }
  }

  // ============================================
  // セッション・QR
  // ============================================
  async function startSession(sid, targetFromUrl) {
    const sessionId = (sid || elements.sessionInput.value).trim().toUpperCase();
    if (!sessionId || sessionId.length < 4) return alert(t('enter_session_id'));
    
    // UIフィードバック: ロード中状態
    const originalBtnText = elements.startBtn.innerHTML;
    elements.startBtn.disabled = true;
    elements.startBtn.textContent = 'CHECKING...';

    // バリデーション (SET-/CFG- 以外)
    if (!sessionId.startsWith('SET-') && !sessionId.startsWith('CFG-')) {
      try {
        const { data, error } = await state.supabase
          .from('squat_sessions')
          .select('id')
          .eq('id', sessionId)
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          alert(t('session_not_found'));
          elements.startBtn.disabled = false;
          elements.startBtn.innerHTML = originalBtnText;
          return;
        }
      } catch (e) {
        debugLog('Session validation error: ' + e.message);
        alert('VALIDATION ERROR. PLEASE TRY AGAIN.');
        elements.startBtn.disabled = false;
        elements.startBtn.innerHTML = originalBtnText;
        return;
      }
    }

    // 成功時: 通常の初期化へ戻す
    elements.startBtn.disabled = false;
    elements.startBtn.innerHTML = originalBtnText;

    state.sessionId = sessionId;
    state.squatCount = 0;
    state.startTime = Date.now();
    elements.currentSessionLabel.textContent = sessionId;
    elements.squatCountLabel.textContent = '0';

    // サイクル反映
    loadNextExercise();
    debugLog(`Session Start: ${state.exerciseType}, Index: ${state.cycleIndex}`);

    const cachedTarget = state.sessionTargetById[sessionId];
    const effectiveTargetRaw = targetFromUrl || state.pendingTargetCount || cachedTarget;
    const effectiveTarget = parseInt(effectiveTargetRaw, 10);

    // Settings Guard用の特別ID判定
    if (sessionId.startsWith('SET-') || sessionId.startsWith('CFG-')) {
      state.targetCount = 15;
      state.sessionTargetById[sessionId] = 15;
      debugLog('SETTINGS LOCK MISSION: 15 REPS');
    } else if (!isNaN(effectiveTarget) && effectiveTarget > 0) {
      state.targetCount = effectiveTarget;
      state.sessionTargetById[sessionId] = effectiveTarget;
      debugLog('Target from QR/URL: ' + state.targetCount);
    } else if (!state.isPro) {
      state.exerciseType = 'SQUAT';
      state.targetCount = 10;
    }
    
    // UI反映
    if (elements.targetCountDisplay) elements.targetCountDisplay.textContent = state.targetCount;
    if (elements.completeRepsDisplay) elements.completeRepsDisplay.textContent = state.targetCount;
    state.pendingTargetCount = null;
    
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        debugLog(`Auto-fullscreen failed: ${err.message}`);
      });
    }
    
    showScreen('squat-screen');
    initMediaPipe().catch(err => debugLog('Camera error: ' + err.message));
  }

  async function startQRScan() {
    if (!state.html5QrCode) return alert(t('scanner_init_failed'));
    elements.qrReaderContainer.classList.remove('hidden');
    try {
      await state.html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          let sid = decodedText;
          let target = null;
          let device = null;
          
          // URLからsessionとtargetを抽出
          // URLからsessionとtargetを抽出
          if (decodedText.startsWith('http')) {
            try {
              const url = new URL(decodedText);
              const sidFromUrl = url.searchParams.get('session');
              sid = sidFromUrl || sid;
              target = url.searchParams.get('target');
              device = normalizeDeviceId(url.searchParams.get('device'));
              if (!sidFromUrl && decodedText.includes('session=')) {
                const fallback = new URLSearchParams(decodedText.split('?')[1] || '');
                sid = fallback.get('session') || sid;
                target = target || fallback.get('target');
                device = device || normalizeDeviceId(fallback.get('device'));
              }
            } catch (e) {
              debugLog('URL parse error: ' + e.message);
            }
          } else if (decodedText.includes('session=')) {
             // フォールバック: 単純な文字列解析
             const parts = decodedText.split('?');
             const params = new URLSearchParams(parts[1] || parts[0]);
             sid = params.get('session') || sid;
             target = params.get('target');
             device = normalizeDeviceId(params.get('device'));
          }
          state.pendingTargetCount = target;
          
          if (device) {
            state.linkedDeviceId = device;
            localStorage.setItem('the_toll_device_id', device);
            await refreshPlanByDevice();
          }
          elements.sessionInput.value = sid;
          stopQRScan();
          loadNextExercise();
          updateExerciseControls();
        }, () => {}
      );
    } catch (err) { alert(t('camera_start_failed')); elements.qrReaderContainer.classList.add('hidden'); }
  }

  async function stopQRScan() {
    if (state.html5QrCode) { 
      try { 
        if (state.html5QrCode.isScanning) {
          await state.html5QrCode.stop(); 
        }
      } catch (e) {
        debugLog('QR Stop error: ' + e.message);
      } 
    }
    elements.qrReaderContainer.classList.add('hidden');
  }

  async function sendUnlockSignal() {
    elements.unlockBtn.disabled = true;
    elements.unlockStatus.textContent = t('sending');
    try {
      const sid = (state.sessionId || '').trim().toUpperCase();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/unlock-session-public`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ session_id: sid }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = payload?.error || `HTTP ${res.status}`;
        elements.unlockStatus.textContent = `❌ ${t('send_failed')}: ${detail}`;
        elements.unlockBtn.disabled = false;
        return;
      }
      if (payload && payload.success) {
        elements.unlockStatus.textContent = `✅ ${t('unlock_success')}`;
        elements.unlockBtn.innerHTML = '<span>SUCCESS</span>';
      } else {
        elements.unlockStatus.textContent = `⚠️ ${t('session_not_found')} (${sid})`;
        elements.unlockBtn.disabled = false;
      }
    } catch (e) {
      elements.unlockStatus.textContent = `❌ ${t('send_failed')}`;
      elements.unlockBtn.disabled = false;
    }
  }

  // ============================================
  // スクワット検出 (MediaPipe)
  // ============================================
  async function initMediaPipe() {
    updateStatus(t('ai_loading'));
    const pose = new Pose({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}` });
    pose.setOptions({ modelComplexity: 0, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
    pose.onResults(onPoseResults);

    const camera = new Camera(elements.camera, {
      onFrame: async () => { await pose.send({ image: elements.camera }); },
      facingMode: 'user'
    });
    state.poseCamera = camera;
    await camera.start();
    
    await new Promise(r => {
      const check = () => elements.camera.videoWidth ? r() : requestAnimationFrame(check);
      check();
    });
    elements.canvas.width = elements.camera.videoWidth;
    elements.canvas.height = elements.camera.videoHeight;
    updateStatus('READY');
  }

  function onPoseResults(results) {
    const ctx = elements.canvas.getContext('2d');
    ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
    if (!results.poseLandmarks) { 
      updateStatus('NO PERSON'); 
      elements.guide.classList.remove('hidden'); 
      
      // 音声ガイダンス (10秒おき) - 低優先度
      if (Date.now() - state._lastGuideSpeak > 10000) {
        speakText("Stand back. Show us your body.", false);
        state._lastGuideSpeak = Date.now();
      }

      // 2秒以上人がいなければ基準をリセット
      if (state._lastPersonTs && Date.now() - state._lastPersonTs > 2000) {
        if (state.pushupBaseline !== null || state.situpBaseline !== null) {
          state.pushupBaseline = null;
          state.situpBaseline = null;
          state.calibrationBuffer = [];
          debugLog('Baselines Reset (No person)');
        }
      }
      return; 
    }
 
    const lm = results.poseLandmarks;
    state._lastPersonTs = Date.now();
    
    // 種目に応じた検知要件の定義
    let requiredLandmarks = [];
    let visibilityMsg = 'SHOW FULL BODY';
    
    if (state.exerciseType === 'SQUAT') {
      requiredLandmarks = [11, 12, 23, 24, 25, 26, 27, 28]; // 全身
      visibilityMsg = 'SHOW FULL BODY';
    } else if (state.exerciseType === 'PUSHUP') {
      requiredLandmarks = [11, 12, 23, 24]; // 肩と腰
      visibilityMsg = 'SHOW TORSO';
    } else if (state.exerciseType === 'SITUP') {
      requiredLandmarks = [0, 11, 12]; // 頭と肩
      visibilityMsg = 'SHOW UPPER BODY';
    }
    
    const isVisible = requiredLandmarks.every(idx => lm[idx] && lm[idx].visibility > 0.5);
    
    // ガイドオーバーレイのテキストを更新
    if (elements.guide) {
        elements.guide.textContent = visibilityMsg;
    }
    
    if (!isVisible) {
      updateStatus(visibilityMsg);
      elements.guide.classList.remove('hidden');
      
      // 音声ガイダンス (10秒おき) Visibilityが低い場合 - 低優先度
      if (Date.now() - state._lastGuideSpeak > 10000) {
        speakText("Stand back. Show us your body.", false);
        state._lastGuideSpeak = Date.now();
      }

      return;
    }
    
    elements.guide.classList.add('hidden');
    drawPose(ctx, lm, elements.canvas.width, elements.canvas.height);
  
    if (state.exerciseType === 'SQUAT') {
      handleSquatDetection(lm);
    } else if (state.exerciseType === 'PUSHUP') {
      handlePushupDetection(lm);
    } else if (state.exerciseType === 'SITUP') {
      handleSitupDetection(lm);
    }
  }

  // エクササイズ画面にEXITボタンを追加
  function addExitButton() {
     const container = document.getElementById('camera-overlay-ui'); // カメラUIオーバーレイが存在すると仮定
     if (!container) return;

     // 既にあれば削除
     const existingBtn = document.getElementById('exercise-exit-btn');
     if (existingBtn) existingBtn.remove();
     
     const exitBtn = document.createElement('button');
     exitBtn.id = 'exercise-exit-btn';
     exitBtn.className = 'absolute top-4 right-4 bg-red-600 text-white px-4 py-2 rounded font-bold z-50';
     exitBtn.textContent = 'EXIT';
     exitBtn.onclick = cancelSession;
     
     container.appendChild(exitBtn);
  }
 
  function handleSquatDetection(lm) {
    const leftAngle = calculateAngle(lm[23], lm[25], lm[27]);
    const rightAngle = calculateAngle(lm[24], lm[26], lm[28]);
    
    // SQUATにもキャリブレーション（準備完了通知）を追加
    if (state.startTime && (Date.now() - state.startTime < 2000)) {
        updateStatus('STAND READY...');
        return;
    }
    
    if (!state._squatReadySpoken) {
        playSoundCount();
        speakText("Ready. Start!");
        state._squatReadySpoken = true;
    }

    if (!state.isSquatting && leftAngle < 105 && rightAngle < 105) {
      state.isSquatting = true;
      playSoundSquatDown();
      updateStatus('DOWN');
    } else if (state.isSquatting && leftAngle > 165 && rightAngle > 165) {
      countRep();
    }
  }
 
  function handlePushupDetection(lm) {
    if (lm[11].visibility < 0.6 || lm[12].visibility < 0.6) {
      updateStatus('SHOW SHOULDERS');
      state.calibrationBuffer = []; // 隠れたらバッファもリセット
      return;
    }

    const shoulderY = (lm[11].y + lm[12].y) / 2;
    
    // 基準が設定されていない場合、安定するまで待つ (キャリブレーション)
    if (state.pushupBaseline === null) {
      updateStatus('CALIBRATING...');
      
      // 音声ガイダンス (最初だけ)
      if (!state._lastCalibSpeak || Date.now() - state._lastCalibSpeak > 5000) {
        speakText("Please stay still.");
        state._lastCalibSpeak = Date.now();
      }

      state.calibrationBuffer.push(shoulderY);
      
      if (state.calibrationBuffer.length > 30) { // 30フレーム(約1秒)安定を待つ
        const avg = state.calibrationBuffer.reduce((a, b) => a + b) / state.calibrationBuffer.length;
        const variance = state.calibrationBuffer.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / state.calibrationBuffer.length;
        
        if (variance < 0.0001) { // ほとんど動いていない
          state.pushupBaseline = avg;
          state.calibrationBuffer = [];
          debugLog(`Baseline SET: ${avg.toFixed(3)} (Stable)`);
          playSoundCount();
          speakText("Ready. Start!"); // 開始の合図
        } else {
          state.calibrationBuffer.shift(); // 安定しないので古いデータを捨てる
        }
      }
      return;
    }

    // 安定判定
    const thresholdDown = 0.12; 
    const thresholdUp = 0.05;
    const diff = Math.abs(shoulderY - state.pushupBaseline);
    
    if (!state._lastPushLog || Date.now() - state._lastPushLog > 1000) {
      debugLog(`Diff: ${diff.toFixed(3)} (Base: ${state.pushupBaseline.toFixed(2)})`);
      state._lastPushLog = Date.now();
    }

    if (!state.isSquatting && diff > thresholdDown) {
      state.isSquatting = true;
      playSoundSquatDown();
      updateStatus('DOWN');
    } else if (state.isSquatting && diff < thresholdUp) {
      countRep();
    }
  }
 
  function handleSitupDetection(lm) {
    // 鼻か肩、見えている部位の平均Y座標を使う (より柔軟に)
    const pts = [lm[0], lm[11], lm[12]].filter(p => p.visibility > 0.5);
    if (pts.length === 0) {
      updateStatus('SHOW UPPER BODY');
      state.calibrationBuffer = [];
      return;
    }

    // 画面が縦向き（Portrait）なのにアプリが横向き（forced rotation）の場合、
    // ユーザーの上下動はカメラのX軸になるため、判定軸を切り替える
    const isPortrait = window.innerHeight > window.innerWidth;
    const currentY = pts.reduce((sum, p) => sum + (isPortrait ? p.x : p.y), 0) / pts.length;
    
    // 基準が設定されていない場合、安定するまで待つ
    if (state.situpBaseline === null) {
      updateStatus('CALIBRATING...');

      if (!state._lastCalibSpeak || Date.now() - state._lastCalibSpeak > 8000) {
        speakText("Sit up and stay still. Side view recommended.");
        state._lastCalibSpeak = Date.now();
      }

      state.calibrationBuffer.push(currentY);
      
      if (state.calibrationBuffer.length > 30) {
        const avg = state.calibrationBuffer.reduce((a, b) => a + b) / state.calibrationBuffer.length;
        const variance = state.calibrationBuffer.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / state.calibrationBuffer.length;
        
        if (variance < 0.0001) {
          state.situpBaseline = avg;
          state.calibrationBuffer = [];
          debugLog(`Situp Baseline SET: ${avg.toFixed(3)}`);
          playSoundCount();
          speakText("Ready. Start!");
        } else {
          state.calibrationBuffer.shift();
        }
      }
      return;
    }

    const thresholdDown = 0.18; // 動作を少し検出しやすく調整
    const thresholdUp = 0.07;
    const diff = Math.abs(currentY - state.situpBaseline);

    if (!state._lastPushLog || Date.now() - state._lastPushLog > 1000) {
      debugLog(`Situp Diff: ${diff.toFixed(3)} (Base: ${state.situpBaseline.toFixed(2)})`);
      state._lastPushLog = Date.now();
    }

    if (!state.isSquatting && diff > thresholdDown) {
      state.isSquatting = true;
      playSoundSquatDown();
      updateStatus('GO DOWN');
    } else if (state.isSquatting && diff < thresholdUp) {
      countRep();
    }
  }
 
  function countRep() {
    state.isSquatting = false;
    state.squatCount++;
    elements.squatCountLabel.textContent = state.squatCount;
    speakText(state.squatCount.toString());
    
    if (state.squatCount >= state.targetCount) {
      playSoundComplete();
      saveCycleProgress(); // 次へ
      onSquatComplete();
    } else {
      playSoundCount();
      updateStatus(`${state.squatCount} REPS`);
    }
  }
 
  function cycleExercise() {
    // Free only: cycle helper keeps simple "next" behavior.
    if (state.isPro) return;
    const nextIdx = (state.cycleIndex + 1) % EXERCISES.length;
    localStorage.setItem(STORAGE_SELECTED_EXERCISE, String(nextIdx));
    loadNextExercise();
  }

  function loadNextExercise() {
    try {
      let idx = getStoredExerciseIndex();
      if (!state.isPro) {
        idx = 0; // Free is always SQUAT.
      }
      applyExerciseIndex(idx);
      updateExerciseControls();
    } catch (e) {
      debugLog('Error loading exercise cycle: ' + e.message);
    }
  }
 
  function saveCycleProgress() {
    // Keep current exercise selection stable across sessions.
    localStorage.setItem(STORAGE_SELECTED_EXERCISE, String(state.selectedExerciseIndex || 0));
    loadNextExercise();
  }
 
  function calculateAngle(a, b, c) {
    const r = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let deg = Math.abs(r * 180 / Math.PI);
    return deg > 180 ? 360 - deg : deg;
  }

  function drawPose(ctx, lm, w, h) {
    ctx.strokeStyle = '#CCFF00'; ctx.lineWidth = 4;
    [[11,13],[13,15],[12,14],[14,16],[11,12],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]].forEach(([a, b]) => {
      ctx.beginPath(); ctx.moveTo(lm[a].x * w, lm[a].y * h); ctx.lineTo(lm[b].x * w, lm[b].y * h); ctx.stroke();
    });
  }

  async function onSquatComplete() {
    const now = Date.now();
    const time = state.startTime ? Math.round((now - state.startTime) / 1000) : '--';
    elements.sessionTimeLabel.textContent = time;
    if (elements.completeRepsDisplay) elements.completeRepsDisplay.textContent = state.squatCount;
    
    speakText("Mission Complete!");
    
    // カメラを停止
    if (state.poseCamera) {
      try {
        await state.poseCamera.stop();
        state.poseCamera = null;
        debugLog('Pose camera stopped.');
      } catch (e) {
        debugLog('Pose camera stop error: ' + e.message);
      }
    }
    
    showScreen('complete-screen');
  }

  // ============================================
  // 音声 & 初期化
  // ============================================
  function playTone(f, d, t = 'sine', v = 0.3) {
    if (!state.audioContext) return;
    const osc = state.audioContext.createOscillator();
    const g = state.audioContext.createGain();
    osc.connect(g); g.connect(state.audioContext.destination);
    osc.type = t; osc.frequency.value = f; g.gain.value = v;
    g.gain.exponentialRampToValueAtTime(0.01, state.audioContext.currentTime + d);
    osc.start(); osc.stop(state.audioContext.currentTime + d);
  }

  function speakText(text, cancelExisting = true) {
    if (!window.speechSynthesis) return;
    
    // Mission Completeなどの重要音声が流れている間に低優先度音声でキャンセルされないように
    if (window.speechSynthesis.speaking && !cancelExisting) return;

    if (cancelExisting) {
      window.speechSynthesis.cancel();
    }
    
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-US'; utter.rate = 1.1;
    window.speechSynthesis.speak(utter);
  }

  const playSoundCount = () => playTone(440 + (state.squatCount * 50), 0.15);
  const playSoundComplete = () => [523, 659, 783, 1046].forEach((f, i) => setTimeout(() => playTone(f, 0.3), i * 100));
  const playSoundSquatDown = () => playTone(600, 0.08);

  function clearSession() {
    debugLog('Clearing session data...');
    state.sessionId = null;
    state.squatCount = 0;
    state.startTime = null;
    state.isSquatting = false;
    state.pushupBaseline = null;
    state.situpBaseline = null;
    state._squatReadySpoken = false;

    // UIリセット
    elements.sessionInput.value = '';
    elements.currentSessionLabel.textContent = '-';
    elements.squatCountLabel.textContent = '0';
    elements.sessionTimeLabel.textContent = '--';
    elements.unlockStatus.textContent = '';
    elements.unlockBtn.disabled = false;
    elements.unlockBtn.innerHTML = '<span>UNLOCK PC</span>';
    updateStatus('READY');
    updateExerciseControls();

    // カメラを完全に停止
    if (state.poseCamera) {
      state.poseCamera.stop().catch(() => {});
      state.poseCamera = null;
      debugLog('Pose camera stopped in clearSession.');
    }
  }

  function cancelSession() {
    debugLog('Session Cancelled by User');
    
    // カメラ停止
    if (state.poseCamera) {
      state.poseCamera.stop().catch(() => {});
      state.poseCamera = null;
    }
    
    state.isSquatting = false;
    state.squatCount = 0;
    state.pushupBaseline = null;
    state.situpBaseline = null;
    state._squatReadySpoken = false;
    
    // フルスクリーン解除 (任意: ユーザー体験的に戻した方がいい場合が多い)
    if (document.fullscreenElement) {
       document.exitFullscreen().catch(()=>{});
    }

    const exitBtn = document.getElementById('exercise-exit-btn');
    if (exitBtn) exitBtn.remove();

    showScreen('session-screen');
    updateStatus('READY');
  }

  async function init() {
    debugLog(`[THE TOLL] 初期化 ${APP_VERSION}`);
    
    state.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    state.user = null;

    try { state.html5QrCode = new Html5Qrcode("qr-reader"); } catch(e) {}

    // イベントリスナー
    if (elements.googleLoginBtn) elements.googleLoginBtn.onclick = handleGoogleLogin;
    if (elements.logoutBtn) elements.logoutBtn.onclick = handleLogout;
    if (elements.subscribeBtn) elements.subscribeBtn.onclick = handleSubscribe;
    if (elements.manageSubscriptionBtn) {
      elements.manageSubscriptionBtn.onclick = handleManageSubscription;
    }
    if (elements.toSessionBtn) elements.toSessionBtn.onclick = () => showScreen('session-screen');
    elements.startBtn.onclick = () => startSession();
    if (elements.sessionInput) {
      elements.sessionInput.oninput = () => {
        updateExerciseControls();
      };
    }
    elements.scanQrBtn.onclick = () => startQRScan();
    elements.closeScanBtn.onclick = () => stopQRScan();
    elements.resetCycleBtn.onclick = (e) => {
      e.preventDefault();
      cycleExercise();
    };
    if (elements.exerciseSelect) {
      elements.exerciseSelect.onchange = (e) => {
        if (!state.isPro) return;
        const idx = parseInt(e.target.value, 10);
        if (!Number.isInteger(idx)) return;
        localStorage.setItem(STORAGE_SELECTED_EXERCISE, String(idx));
        loadNextExercise();
      };
    }
    elements.unlockBtn.onclick = sendUnlockSignal;
    elements.backToSessionBtn.onclick = (e) => {
      e.preventDefault();
      clearSession();
      loadNextExercise();
      showScreen('session-screen');
    };

    // URLパラメータ
    const urlParams = new URLSearchParams(window.location.search);
    const sid = urlParams.get('session');
    const target = urlParams.get('target');
    const checkout = urlParams.get('checkout');
    const portal = urlParams.get('portal');
    const deviceParam = normalizeDeviceId(urlParams.get('device'));

    const storedDeviceId = normalizeDeviceId(localStorage.getItem('the_toll_device_id'));
    if (deviceParam) {
      state.linkedDeviceId = deviceParam;
      localStorage.setItem('the_toll_device_id', deviceParam);
    } else if (storedDeviceId) {
      state.linkedDeviceId = storedDeviceId;
    }
    await refreshPlanByDevice();

    if (checkout === 'success') {
      alert(t('checkout_success_message'));
      await refreshPlanByDevice();
    } else if (checkout === 'cancel') {
      alert(t('checkout_cancel_message'));
    }
    if (portal === 'return') {
      await refreshPlanByDevice();
    }
    
    if (target) {
      const parsed = parseInt(target);
      if (!isNaN(parsed) && parsed > 0) {
        state.pendingTargetCount = parsed;
        state.targetCount = parsed;
        debugLog('Target count from URL: ' + state.targetCount);
      }
    }

    if (sid) {
      elements.sessionInput.value = sid;
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (checkout || portal) {
      const params = new URLSearchParams(window.location.search);
      params.delete('checkout');
      params.delete('portal');
      params.delete('device');
      const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
      window.history.replaceState({}, document.title, next);
    } else if (deviceParam) {
      const params = new URLSearchParams(window.location.search);
      params.delete('device');
      const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
      window.history.replaceState({}, document.title, next);
    }

    document.addEventListener('click', () => {
      if (!state.audioContext) state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }, { once: true });

    if (elements.recalibrateBtn) {
      elements.recalibrateBtn.onclick = () => {
        state.pushupBaseline = null;
        state.situpBaseline = null;
        state.calibrationBuffer = [];
        debugLog('Recalibration requested');
        updateStatus('RE-CALIBRATING');
      };
    }
    
    // EXITボタン (New)
    const exitBtn = document.getElementById('exit-btn');
    if (exitBtn) {
      exitBtn.onclick = () => {
        if(!confirm(t('confirm_cancel_training'))) return;
        cancelSession();
      };
    }

    if (elements.fullscreenBtn) {
      elements.fullscreenBtn.onclick = toggleFullscreen;
    }

    showScreen('session-screen');
    loadNextExercise();
    updateExerciseControls();
    window.addEventListener('focus', refreshPlanByDevice);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refreshPlanByDevice();
    });
  }

  init();
})();
