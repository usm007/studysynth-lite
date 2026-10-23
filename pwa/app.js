/**
 * StudySynth — Client Application Controller
 * Adaptive, offline-first workspace for phones, tablets, and desktops.
 */

(function () {
  'use strict';

  const MODE_LABELS = {
    practice: 'Practice Mode',
    test: 'Exam Test (Timed)',
    revision: 'Adaptive Revision',
    generator: 'Generator',
    library: 'Offline Library'
  };

  const MARKS_CORRECT = 2;
  const MARKS_WRONG = 0.66;

  const State = {
    activeMode: 'library',
    currentModule: null,
    currentIndex: 0,
    practiceAnswers: {},
    practiceRevealed: false,
    testAnswers: {},
    testStarted: false,
    testSubmitted: false,
    testStartedAt: 0,
    timerSeconds: 0,
    testQuestions: [],
    testDurationSeconds: 0,
    testRemainingSeconds: 0,
    testEndsAt: 0,
    testQuestionLimit: 10,
    testSecondsPerQuestion: 60,
    timerInterval: null,
    deferredInstallPrompt: null,
    lastResult: null,
    revision: {
      items: null,
      itemsFor: null,
      progress: {},
      session: null,
      resumeCandidate: null,
      revealed: false,
      viewingPrev: false,
      expandedEvidence: false,
      saving: false
    },
    storagePersistent: false,
    isNative: false,
    swControllerReloaded: false,
    navOpen: false,
    sourceMeta: null
  };

  const DOM = {};

  function initDOM() {
    DOM.appShell = document.getElementById('appShell');
    DOM.installBadge = document.getElementById('installBadge');
    DOM.appRail = document.getElementById('appRail');
    DOM.navToggle = document.getElementById('navToggle');
    DOM.navClose = document.getElementById('navClose');
    DOM.navBackdrop = document.getElementById('navBackdrop');

    DOM.brandLogo = document.getElementById('brandLogo');
    DOM.setTitle = document.getElementById('setTitle');
    DOM.setTopic = document.getElementById('setTopic');
    DOM.progNum = document.getElementById('progNum');
    DOM.progBar = document.getElementById('progBar');
    DOM.progPct = document.getElementById('progPct');
    DOM.themeToggle = document.getElementById('themeToggle');
    DOM.printBtn = document.getElementById('printBtn');

    DOM.modeItems = document.querySelectorAll('.mode-item');
    DOM.railAcc = document.getElementById('railAcc');
    DOM.railAccLabel = document.getElementById('railAccLabel');
    DOM.railBar = document.getElementById('railBar');
    DOM.railSub = document.getElementById('railSub');
    DOM.netStatus = document.getElementById('netStatus');
    DOM.cacheStatus = document.getElementById('cacheStatus');

    DOM.quizView = document.getElementById('quizView');
    DOM.generatorView = document.getElementById('generatorView');
    DOM.revisionView = document.getElementById('revisionView');
    DOM.libraryView = document.getElementById('libraryView');

    DOM.sheetNum = document.getElementById('sheetNum');
    DOM.sheetModeLabel = document.getElementById('sheetModeLabel');
    DOM.sheetContext = document.getElementById('sheetContext');
    DOM.markBtn = document.getElementById('markBtn');
    DOM.examTimer = document.getElementById('examTimer');
    DOM.examAnswered = document.getElementById('examAnswered');
    DOM.examSubmitBtn = document.getElementById('examSubmitBtn');
    DOM.testSetup = document.getElementById('testSetup');
    DOM.testSetupModule = document.getElementById('testSetupModule');
    DOM.testQuestionCount = document.getElementById('testQuestionCount');
    DOM.testSecondsPerQuestion = document.getElementById('testSecondsPerQuestion');
    DOM.testTotalTime = document.getElementById('testTotalTime');
    DOM.testStartBtn = document.getElementById('testStartBtn');
    DOM.qContainer = document.getElementById('questionContainer');
    DOM.answerPanel = document.getElementById('answerPanel');
    DOM.sheetBody = document.querySelector('.sheet-body');
    DOM.workspace = document.querySelector('.workspace');
    DOM.prevBtn = document.getElementById('prevBtn');
    DOM.nextBtn = document.getElementById('nextBtn');
    DOM.submitBtn = document.getElementById('submitBtn');

    DOM.liveAccNum = document.getElementById('liveAccNum');
    DOM.statCorrect = document.getElementById('statCorrect');
    DOM.statWrong = document.getElementById('statWrong');
    DOM.livePalette = document.getElementById('livePalette');

    DOM.dropZone = document.getElementById('dropZone');
    DOM.fileInput = document.getElementById('fileInput');
    DOM.fileStatus = document.getElementById('fileStatus');
    DOM.docTitle = document.getElementById('docTitle');
    DOM.docText = document.getElementById('docText');
    DOM.chipDemoSpm = document.getElementById('chipDemoSpm');
    DOM.chipDemoScience = document.getElementById('chipDemoScience');
    DOM.generateBtn = document.getElementById('generateBtn');

    DOM.revisionUnavailable = document.getElementById('revisionUnavailable');
    DOM.revisionDashboard = document.getElementById('revisionDashboard');
    DOM.revisionSession = document.getElementById('revisionSession');
    DOM.revisionSummary = document.getElementById('revisionSummary');
    DOM.revDashTitle = document.getElementById('revDashTitle');
    DOM.revDashTopic = document.getElementById('revDashTopic');
    DOM.revResetBtn = document.getElementById('revResetBtn');
    DOM.revStatDue = document.getElementById('revStatDue');
    DOM.revStatNew = document.getElementById('revStatNew');
    DOM.revStatLearning = document.getElementById('revStatLearning');
    DOM.revStatConsistent = document.getElementById('revStatConsistent');
    DOM.revStatTotal = document.getElementById('revStatTotal');
    DOM.revDashNote = document.getElementById('revDashNote');
    DOM.revStartBtn = document.getElementById('revStartBtn');
    DOM.revResumeBtn = document.getElementById('revResumeBtn');
    DOM.revPos = document.getElementById('revPos');
    DOM.revPauseBtn = document.getElementById('revPauseBtn');
    DOM.revProgress = document.getElementById('revProgress');
    DOM.revProgressBar = document.getElementById('revProgressBar');
    DOM.revForm = document.getElementById('revForm');
    DOM.revPrompt = document.getElementById('revPrompt');
    DOM.revAnswer = document.getElementById('revAnswer');
    DOM.revAnswerText = document.getElementById('revAnswerText');
    DOM.revSourceRef = document.getElementById('revSourceRef');
    DOM.revEvidenceShort = document.getElementById('revEvidenceShort');
    DOM.revEvidenceFull = document.getElementById('revEvidenceFull');
    DOM.revEvidenceToggle = document.getElementById('revEvidenceToggle');
    DOM.revRecallHint = document.getElementById('revRecallHint');
    DOM.revRevealBtn = document.getElementById('revRevealBtn');
    DOM.revBackBtn = document.getElementById('revBackBtn');
    DOM.revPrevBtn = document.getElementById('revPrevBtn');
    DOM.revRatings = document.getElementById('revRatings');
    DOM.revSumReviewed = document.getElementById('revSumReviewed');
    DOM.revSumAgain = document.getElementById('revSumAgain');
    DOM.revSumHard = document.getElementById('revSumHard');
    DOM.revSumGood = document.getElementById('revSumGood');
    DOM.revSumEasy = document.getElementById('revSumEasy');
    DOM.revSumRemaining = document.getElementById('revSumRemaining');
    DOM.revSumNext = document.getElementById('revSumNext');
    DOM.revSummaryDoneBtn = document.getElementById('revSummaryDoneBtn');

    DOM.libraryContainer = document.getElementById('libraryContainer');
    DOM.libraryGenerateBtn = document.getElementById('libraryGenerateBtn');
    DOM.toast = document.getElementById('toast');

    DOM.scoreModal = document.getElementById('scoreModal');
    DOM.scoreTitle = document.getElementById('scoreTitle');
    DOM.scoreMax = document.getElementById('scoreMax');
    DOM.scoreBand = document.getElementById('scoreBand');
    DOM.scoreCorrect = document.getElementById('scoreCorrect');
    DOM.scoreWrong = document.getElementById('scoreWrong');
    DOM.scoreSkipped = document.getElementById('scoreSkipped');
    DOM.scoreTime = document.getElementById('scoreTime');
    DOM.scoreNote = document.getElementById('scoreNote');
    DOM.scoreReviewBtn = document.getElementById('scoreReviewBtn');
    DOM.scoreRetakeBtn = document.getElementById('scoreRetakeBtn');
    DOM.scoreCloseBtn = document.getElementById('scoreCloseBtn');

    DOM.processModal = document.getElementById('processModal');
    DOM.processTitle = document.getElementById('processTitle');
    DOM.processMessage = document.getElementById('processMessage');
    DOM.processNotice = document.getElementById('processNotice');
    DOM.processTrack = document.getElementById('processTrack');
    DOM.processBar = document.getElementById('processBar');
    DOM.processCount = document.getElementById('processCount');
    DOM.processPct = document.getElementById('processPct');
    DOM.processStages = document.getElementById('processStages');
    DOM.processStorage = document.getElementById('processStorage');
    DOM.processMinimizeBtn = document.getElementById('processMinimizeBtn');
    DOM.processCancelBtn = document.getElementById('processCancelBtn');
    DOM.processResumeBtn = document.getElementById('processResumeBtn');
    DOM.processRetryBtn = document.getElementById('processRetryBtn');
    DOM.processOpenBtn = document.getElementById('processOpenBtn');
    DOM.processDiscardBtn = document.getElementById('processDiscardBtn');
    DOM.processCloseBtn = document.getElementById('processCloseBtn');
    DOM.processLive = document.getElementById('processLive');
    DOM.processChip = document.getElementById('processChip');
    DOM.processChipStage = document.getElementById('processChipStage');
    DOM.processChipMeta = document.getElementById('processChipMeta');
    DOM.processChipPct = document.getElementById('processChipPct');
  }

  // ==========================================================================
  // SMALL HELPERS
  // ==========================================================================
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function icon(name, extraClass) {
    return `<span class="ms-icon${extraClass ? ' ' + extraClass : ''}" aria-hidden="true">${name}</span>`;
  }

  function formatTime(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  function showToast(msg) {
    if (!DOM.toast) return;
    DOM.toast.textContent = msg;
    DOM.toast.classList.add('show');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => DOM.toast.classList.remove('show'), 3000);
  }

  function setFileStatus(message, type) {
    if (!DOM.fileStatus) return;
    DOM.fileStatus.textContent = message || '';
    DOM.fileStatus.className = 'file-status' + (type ? ' ' + type : '');
  }

  function setCacheStatus(message) {
    if (DOM.cacheStatus) DOM.cacheStatus.textContent = message;
  }

  function isNativeApp() {
    try {
      return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
    } catch (e) {
      return false;
    }
  }

  function activeAnswers() {
    return State.activeMode === 'test' ? State.testAnswers : State.practiceAnswers;
  }

  function activeQuestionList() {
    if (State.activeMode === 'test') return State.testQuestions;
    return State.currentModule && Array.isArray(State.currentModule.questions)
      ? State.currentModule.questions
      : [];
  }

  function answeredCount(answers) {
    return activeQuestionList().reduce(
      (count, q) => count + (answers && answers[q.id] ? 1 : 0),
      0
    );
  }

  // ==========================================================================
  // SIDEBAR / DRAWER NAVIGATION
  // ==========================================================================
  const NAV_MEDIA_QUERY = '(max-width: 860px)';
  let navMediaQuery = null;

  function isCompactNav() {
    return navMediaQuery ? navMediaQuery.matches : window.innerWidth <= 860;
  }

  function setRailAvailability(compact, open) {
    if (!DOM.appRail) return;
    if (compact && !open) {
      DOM.appRail.setAttribute('aria-hidden', 'true');
      try { DOM.appRail.inert = true; } catch (e) { /* older WebView */ }
    } else {
      DOM.appRail.removeAttribute('aria-hidden');
      try { DOM.appRail.inert = false; } catch (e) { /* older WebView */ }
    }
  }

  function setNavOpen(open, options) {
    const opts = options || {};
    const compact = isCompactNav();
    const next = compact ? !!open : false;
    State.navOpen = next;
    document.body.classList.toggle('nav-open', next);

    if (DOM.navBackdrop) DOM.navBackdrop.hidden = !next;
    if (DOM.navToggle) DOM.navToggle.setAttribute('aria-expanded', next ? 'true' : 'false');
    setRailAvailability(compact, next);

    if (next && opts.focus !== false && DOM.navClose) {
      setTimeout(() => DOM.navClose.focus(), 30);
    }
    if (!next && opts.returnFocus && DOM.navToggle) {
      DOM.navToggle.focus();
    }
  }

  function initNavigation() {
    navMediaQuery = window.matchMedia ? window.matchMedia(NAV_MEDIA_QUERY) : null;

    if (DOM.navToggle) {
      DOM.navToggle.addEventListener('click', () => setNavOpen(!State.navOpen));
    }
    if (DOM.navClose) {
      DOM.navClose.addEventListener('click', () => setNavOpen(false, { returnFocus: true }));
    }
    if (DOM.navBackdrop) {
      DOM.navBackdrop.addEventListener('click', () => setNavOpen(false, { returnFocus: true }));
    }

    const viewportChanged = () => setNavOpen(false);
    if (navMediaQuery) {
      if (typeof navMediaQuery.addEventListener === 'function') navMediaQuery.addEventListener('change', viewportChanged);
      else if (typeof navMediaQuery.addListener === 'function') navMediaQuery.addListener(viewportChanged);
    }
    window.addEventListener('resize', () => {
      if (!isCompactNav() && State.navOpen) setNavOpen(false);
    });

    setRailAvailability(isCompactNav(), false);
  }

  // ==========================================================================
  // INSTALLATION BADGE & PWA LIFECYCLE
  // ==========================================================================
  function isStandalone() {
    if (State.isNative) return true;
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'standalone' || params.get('standalone') === '1') return true;
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
    if (window.matchMedia('(display-mode: minimal-ui)').matches) return true;
    if (window.navigator.standalone === true) return true;
    if (document.referrer.indexOf('android-app://') === 0) return true;
    return false;
  }

  function markInstalled(label) {
    if (!DOM.installBadge) return;
    DOM.installBadge.innerHTML = icon('check_circle') + '<span class="install-text">' + escapeHtml(label || 'Installed') + '</span>';
    DOM.installBadge.classList.add('installed');
    DOM.installBadge.setAttribute('aria-label', 'StudySynth is installed');
  }

  function initInstallHandlers() {
    State.isNative = isNativeApp();

    if (State.isNative) {
      // The Android shell is already installed; never show an install sticker.
      if (DOM.installBadge) {
        DOM.installBadge.hidden = true;
        DOM.installBadge.remove();
        DOM.installBadge = null;
      }
      // window.print() is a no-op inside an Android WebView.
      if (DOM.printBtn) DOM.printBtn.hidden = true;
      return;
    }

    if (DOM.installBadge && isStandalone()) markInstalled('Installed');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      State.deferredInstallPrompt = e;
    });

    window.addEventListener('appinstalled', () => {
      State.deferredInstallPrompt = null;
      markInstalled('Installed');
      showToast('StudySynth installed. You can open it offline from your home screen.');
    });

    if (DOM.installBadge) {
      DOM.installBadge.addEventListener('click', async () => {
        if (isStandalone()) {
          showToast('StudySynth is already installed and runs fully offline.');
          return;
        }

        if (State.deferredInstallPrompt) {
          State.deferredInstallPrompt.prompt();
          try {
            const choice = await State.deferredInstallPrompt.userChoice;
            if (choice && choice.outcome === 'accepted') {
              State.deferredInstallPrompt = null;
              markInstalled('Installed');
              showToast('StudySynth installed successfully.');
            }
          } catch (e) {
            showToast('Install was not completed. You can retry from the browser menu.');
          }
        } else {
          showToast('To install: open the browser menu and choose “Install app” or “Add to Home screen”.');
        }
      });
    }
  }

  // ==========================================================================
  // SERVICE WORKER & STORAGE PERSISTENCE
  // ==========================================================================
  function registerServiceWorker() {
    // The Android build ships its assets inside the APK, so a service worker
    // would only add a stale-cache layer. Keep updates deterministic.
    if (State.isNative) {
      setCacheStatus('Bundled app · fully offline');
      return;
    }
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') {
      setCacheStatus('Local app · no server needed');
      return;
    }

    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('./sw.js');
        setCacheStatus('Offline cache ready');

        if (registration.waiting && navigator.serviceWorker.controller) {
          showToast('A new StudySynth version is ready. Reopen the app to update.');
        }

        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              showToast('A new StudySynth version is ready. Reopen the app to update.');
            }
          });
        });

        // Look for updates when the app is opened, but never block startup.
        setTimeout(() => registration.update().catch(() => {}), 2500);

        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!State.swControllerReloaded && navigator.serviceWorker.controller) {
            State.swControllerReloaded = true;
            setCacheStatus('Offline cache updated');
          }
        });
      } catch (err) {
        setCacheStatus('Offline cache unavailable');
        console.warn('StudySynth service worker registration failed:', err);
      }
    });
  }

  async function requestPersistentStorage() {
    if (State.isNative) {
      setCacheStatus('Bundled app · fully offline');
      return;
    }
    if (!navigator.storage || typeof navigator.storage.persist !== 'function') return;
    try {
      const already = typeof navigator.storage.persisted === 'function'
        ? await navigator.storage.persisted()
        : false;
      const granted = already || await navigator.storage.persist();
      State.storagePersistent = !!granted;
      if (granted) setCacheStatus('Offline cache ready · protected');
    } catch (e) {
      // Storage persistence is best-effort, not required for the app to work.
    }
  }

  function updateNetworkStatus() {
    const online = navigator.onLine !== false;
    document.body.classList.toggle('is-online', online);
    if (DOM.netStatus) {
      DOM.netStatus.textContent = online ? 'Online · local engine' : 'Offline · 100% local';
    }
  }

  function initNetworkStatus() {
    updateNetworkStatus();
    window.addEventListener('online', () => {
      updateNetworkStatus();
      showToast('Connection restored. StudySynth still runs locally.');
    });
    window.addEventListener('offline', () => {
      updateNetworkStatus();
      showToast('You are offline. Everything keeps working.');
    });
  }

  // ==========================================================================
  // THEME
  // ==========================================================================
  function syncSystemBarIcons(theme) {
    if (!State.isNative) return;
    try {
      const bars = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SystemBars;
      if (bars) bars.setStyle({ style: theme === 'dark' ? 'DARK' : 'LIGHT' }).catch(() => {});
    } catch (e) { /* older WebView or plugin unavailable */ }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    syncSystemBarIcons(theme);
    localStorage.setItem('studysynth_theme', theme);
    if (DOM.themeToggle) {
      DOM.themeToggle.innerHTML = icon(theme === 'dark' ? 'light_mode' : 'dark_mode');
      DOM.themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#101011' : '#3943d3');
  }

  function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem('studysynth_theme'); } catch (e) { /* private mode */ }
    if (saved !== 'dark' && saved !== 'light') {
      saved = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    applyTheme(saved);

    if (DOM.themeToggle) {
      DOM.themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        applyTheme(current === 'dark' ? 'light' : 'dark');
      });
    }
  }

  // ==========================================================================
  // MODE SWITCHING
  // ==========================================================================
  function switchMode(mode) {
    if (!MODE_LABELS[mode]) mode = 'library';
    if ((mode === 'practice' || mode === 'revision' || mode === 'test') && !State.currentModule) {
      showToast('Choose a saved set from the Library to start studying.');
      mode = 'library';
    }
    const activeQuestionCount = State.currentModule && Array.isArray(State.currentModule.questions)
      ? State.currentModule.questions.length
      : 0;
    if ((mode === 'practice' || mode === 'test') && activeQuestionCount === 0) {
      mode = 'revision';
      showToast('This set is revision-only because no MCQs passed source verification.');
    }
    const previousMode = State.activeMode;
    const wasNavOpen = State.navOpen;
    State.activeMode = mode;
    document.body.setAttribute('data-mode', mode);

    DOM.modeItems.forEach((btn) => {
      const active = btn.getAttribute('data-mode') === mode;
      btn.classList.toggle('active', active);
      if (active) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });

    const isQuiz = mode === 'practice' || mode === 'test';
    DOM.quizView.style.display = isQuiz ? 'flex' : 'none';
    DOM.generatorView.style.display = mode === 'generator' ? 'block' : 'none';
    DOM.revisionView.style.display = mode === 'revision' ? 'flex' : 'none';
    DOM.libraryView.style.display = mode === 'library' ? 'block' : 'none';
    if (DOM.workspace) DOM.workspace.scrollTop = 0;

    if (DOM.sheetModeLabel) DOM.sheetModeLabel.textContent = MODE_LABELS[mode];

    if (mode === 'test' && !State.testSubmitted) {
      if (!State.testStarted) {
        if (previousMode !== 'test') {
          State.testAnswers = {};
          State.currentIndex = 0;
        }
      } else {
        startTimer(false);
      }
    }
    // An active exam keeps its timer and answers if the learner checks notes
    // or revision. Submitting remains the only way to end the timed session.
    const testSetup = mode === 'test' && !State.testStarted && !State.testSubmitted;
    updateTestScreen();

    if (mode === 'revision') {
      openRevision();
    } else if (mode === 'library') {
      renderLibrary();
    } else if (isQuiz && !testSetup) {
      renderQuestion();
      renderPalette();
      updateStats();
    }

    setNavOpen(false, { returnFocus: wasNavOpen });

    if (mode === 'library' || mode === 'generator') {
      if (DOM.setTitle) DOM.setTitle.textContent = 'OFFLINE LIBRARY';
      if (DOM.setTopic) DOM.setTopic.textContent = 'Choose a PDF or saved set';
    } else if (State.currentModule) {
      const activeCount = Array.isArray(State.currentModule.questions) ? State.currentModule.questions.length : 0;
      if (DOM.setTitle) DOM.setTitle.textContent = activeCount ? `${activeCount} VERIFIED QUESTIONS` : 'REVISION ONLY';
      if (DOM.setTopic) DOM.setTopic.textContent = State.currentModule.title;
    }
  }

  // ==========================================================================
  // EXAM TIMER & TEST SETUP
  // ==========================================================================
  function renderTestSetup() {
    const mod = State.currentModule;
    if (!DOM.testSetup || !mod) return;
    const available = Array.isArray(mod.questions) ? mod.questions.length : 0;
    if (DOM.testSetupModule) {
      DOM.testSetupModule.textContent = `${mod.title || 'Untitled set'} · ${available} verified question${available === 1 ? '' : 's'} available`;
    }
    if (DOM.testQuestionCount) {
      const counts = [5, 10, 15, 20, 30, 50].filter((n) => n < available);
      counts.push(available);
      const previous = Number(DOM.testQuestionCount.value) || State.testQuestionLimit;
      const selected = counts.indexOf(previous) >= 0 ? previous : Math.min(10, available);
      DOM.testQuestionCount.innerHTML = counts.map((n) =>
        `<option value="${n}"${n === selected ? ' selected' : ''}>${n} question${n === 1 ? '' : 's'}${n === available ? ' (all)' : ''}</option>`
      ).join('');
      State.testQuestionLimit = selected;
    }
    if (DOM.testSecondsPerQuestion) {
      const previous = Number(DOM.testSecondsPerQuestion.value);
      if (previous) State.testSecondsPerQuestion = previous;
      DOM.testSecondsPerQuestion.value = String(State.testSecondsPerQuestion);
    }
    updateTestTotalTime();
  }

  function updateTestTotalTime() {
    const count = Number(DOM.testQuestionCount && DOM.testQuestionCount.value) || 0;
    const seconds = Number(DOM.testSecondsPerQuestion && DOM.testSecondsPerQuestion.value) || 60;
    if (DOM.testTotalTime) DOM.testTotalTime.textContent = formatTime(count * seconds);
  }

  function updateTestScreen() {
    const showSetup = State.activeMode === 'test' && !State.testStarted && !State.testSubmitted;
    document.body.setAttribute('data-test-setup', showSetup ? 'true' : 'false');
    if (DOM.quizView) DOM.quizView.classList.toggle('is-test-setup', showSetup);
    if (DOM.testSetup) DOM.testSetup.hidden = !showSetup;
    if (showSetup) renderTestSetup();
  }

  function startTest() {
    const mod = State.currentModule;
    if (!mod || !Array.isArray(mod.questions) || !mod.questions.length) return;
    const count = Math.min(
      Math.max(1, Number(DOM.testQuestionCount && DOM.testQuestionCount.value) || 1),
      mod.questions.length
    );
    const seconds = Math.max(10, Number(DOM.testSecondsPerQuestion && DOM.testSecondsPerQuestion.value) || 60);

    State.testQuestionLimit = count;
    State.testSecondsPerQuestion = seconds;
    State.testQuestions = mod.questions.slice(0, count);
    State.testAnswers = {};
    State.testSubmitted = false;
    State.currentIndex = 0;
    State.testDurationSeconds = count * seconds;
    State.testRemainingSeconds = State.testDurationSeconds;
    State.testStarted = true;
    State.testStartedAt = Date.now();
    State.testEndsAt = State.testStartedAt + State.testDurationSeconds * 1000;
    State.timerSeconds = 0;

    updateTestScreen();
    startTimer(true);
    renderQuestion();
    renderPalette();
    updateStats();
    const firstOption = DOM.qContainer && DOM.qContainer.querySelector('.opt');
    if (firstOption) setTimeout(() => firstOption.focus(), 30);
    showToast(`Test started: ${count} question${count === 1 ? '' : 's'} · ${formatTime(seconds)} per question.`);
  }

  function startTimer(reset) {
    const duration = Math.max(0, Number(State.testDurationSeconds) || 0);
    if (reset) {
      State.timerSeconds = 0;
      State.testStartedAt = Date.now();
      State.testRemainingSeconds = duration;
      State.testEndsAt = State.testStartedAt + duration * 1000;
    }
    if (!State.testStartedAt) State.testStartedAt = Date.now();
    if (!State.testEndsAt) State.testEndsAt = State.testStartedAt + duration * 1000;
    State.testStarted = true;
    tickTimer(false);

    if (!State.timerInterval) {
      State.timerInterval = setInterval(tickTimer, 1000);
    }
  }

  function tickTimer(autoSubmit) {
    const duration = Math.max(0, Number(State.testDurationSeconds) || 0);
    const endsAt = Number(State.testEndsAt) || 0;
    const remaining = endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : duration;
    State.testRemainingSeconds = remaining;
    State.timerSeconds = Math.max(0, duration - remaining);
    updateTimerDisplay();

    if (remaining <= 0 && autoSubmit !== false) {
      stopTimer();
      if (State.testStarted && !State.testSubmitted) {
        showToast('Time is up. Your test was submitted automatically.');
        completeTest();
      }
    }
  }

  function stopTimer() {
    if (State.timerInterval) {
      clearInterval(State.timerInterval);
      State.timerInterval = null;
    }
  }

  function updateTimerDisplay() {
    if (!DOM.examTimer) return;
    const showRemaining = State.testStarted && !State.testSubmitted;
    const seconds = showRemaining ? State.testRemainingSeconds : State.timerSeconds;
    DOM.examTimer.textContent = formatTime(seconds);
    const clock = DOM.examTimer.closest('.exam-clock');
    if (clock) clock.classList.toggle('is-low', showRemaining && seconds <= 60);
  }

  function resetExamState() {
    stopTimer();
    State.testStarted = false;
    State.testSubmitted = false;
    State.testStartedAt = 0;
    State.timerSeconds = 0;
    State.testAnswers = {};
    State.testQuestions = [];
    State.testDurationSeconds = 0;
    State.testRemainingSeconds = 0;
    State.testEndsAt = 0;
    updateTimerDisplay();
  }

  // ==========================================================================
  // MODULE LOADING
  // ==========================================================================
  function setModule(mod) {
    State.currentModule = mod;
    resetExamState();
    State.currentIndex = 0;
    State.practiceAnswers = {};
    State.practiceRevealed = false;
    State.revision.items = null;
    State.revision.itemsFor = null;
    State.revision.progress = {};
    State.revision.session = null;
    State.revision.resumeCandidate = null;
    State.revision.revealed = false;
    State.revision.viewingPrev = false;
    State.revision.expandedEvidence = false;
    State.lastResult = null;

    const questionCount = Array.isArray(mod.questions) ? mod.questions.length : 0;
    if (DOM.setTitle) DOM.setTitle.textContent = questionCount ? `${questionCount} VERIFIED QUESTIONS` : 'REVISION ONLY';
    if (DOM.setTopic) DOM.setTopic.textContent = mod.title;

    updateStats();
    if (!questionCount) {
      if (DOM.qContainer) {
        DOM.qContainer.innerHTML = '<div class="empty-state"><strong>This set is revision-only.</strong><br>No question passed every source-verification check. Open Revision to study the preserved knowledge units, or add clearer source text and generate again.</div>';
      }
      if (DOM.answerPanel) DOM.answerPanel.innerHTML = '';
      if (DOM.progNum) DOM.progNum.textContent = '0/0';
      if (DOM.progBar) DOM.progBar.style.width = '0%';
      if (DOM.progPct) DOM.progPct.textContent = '0%';
      renderPalette();
      return;
    }
    renderQuestion();
    renderPalette();
  }

  // ==========================================================================
  // QUESTION RENDERING
  // ==========================================================================
  function renderQuestion(preservePageScroll) {
    const qList = activeQuestionList();
    const q = qList[State.currentIndex];
    if (!q) return;

    if (DOM.sheetNum) DOM.sheetNum.textContent = `Q ${String(State.currentIndex + 1).padStart(2, '0')}`;
    if (DOM.sheetContext) DOM.sheetContext.textContent = q.source_title || 'General Studies';

    const progressCurrent = State.currentIndex + 1;
    const pct = Math.round((progressCurrent / qList.length) * 100);
    if (DOM.progNum) DOM.progNum.textContent = `${progressCurrent}/${qList.length}`;
    if (DOM.progBar) DOM.progBar.style.width = `${pct}%`;
    if (DOM.progPct) DOM.progPct.textContent = `${pct}%`;

    const isBookmarked = !!window.OfflineStorage.getBookmarks()[q.id];
    if (DOM.markBtn) {
      DOM.markBtn.innerHTML = icon('star') + `<span class="bookmark-text">${isBookmarked ? 'Bookmarked' : 'Bookmark'}</span>`;
      DOM.markBtn.setAttribute('aria-pressed', isBookmarked ? 'true' : 'false');
    }

    const options = Array.isArray(q.options) ? q.options : [];
    const answers = activeAnswers();
    const selectedKey = answers[q.id];
    const isPractice = State.activeMode === 'practice';
    const isTest = State.activeMode === 'test';
    const showFeedback = isPractice
      ? (!!selectedKey || State.practiceRevealed)
      : (isTest && State.testSubmitted);
    const pageScroll = DOM.workspace ? DOM.workspace.scrollTop : 0;

    let html = `
      <div class="q-context">${escapeHtml(q.cognitive_level || 'recall')}<span class="sep">/</span>${escapeHtml(q.source_title || 'source')}</div>
      <h2 class="q-stem">${escapeHtml(q.stem || 'Question unavailable')}</h2>
    `;

    if (q.type === 'multi_statement' && Array.isArray(q.statements) && q.statements.length) {
      html += `
        <div class="stmt-block">
          <div class="stmt-kicker">Statements for evaluation</div>
          <ul class="stmt-list">
            ${q.statements.map((s) => `<li><span class="stmt-n">${escapeHtml(s.number)}</span><span>${escapeHtml(s.text)}</span></li>`).join('')}
          </ul>
          <div class="stmt-closer">${escapeHtml(q.prompt_suffix || 'Which of the statements given above is/are correct?')}</div>
        </div>
      `;
    }

    html += '<div class="opts" role="group" aria-label="Answer options">';
    for (const opt of options) {
      let optClass = 'opt';
      let verdictBadge = '';
      if (selectedKey === opt.key) optClass += ' selected';

      if (showFeedback) {
        if (opt.key === q.answer_key) {
          optClass += ' correct';
          verdictBadge = '<span class="verdict">Correct key</span>';
        } else if (selectedKey === opt.key) {
          optClass += ' incorrect';
          verdictBadge = '<span class="verdict">Your answer</span>';
        }
      }

      html += `
        <button class="${optClass}" type="button" data-key="${escapeHtml(opt.key)}" aria-pressed="${selectedKey === opt.key ? 'true' : 'false'}"${showFeedback ? ' aria-disabled="true"' : ''}>
          <span class="k" aria-hidden="true">${escapeHtml(opt.key)}</span>
          <span class="t">${escapeHtml(opt.text)}</span>
          ${verdictBadge}
        </button>
      `;
    }
    html += '</div>';

    let noteHtml = '';
    if (showFeedback) {
      const answered = !!selectedKey;
      const isCorrect = answered && selectedKey === q.answer_key;
      const heading = isCorrect
        ? icon('check_circle') + '<span>Correctly answered</span>'
        : (answered ? icon('close') + '<span>Incorrect selection</span>' : '<span>Not answered</span>');
      noteHtml = `
        <div class="study-note ${isCorrect ? 'is-ok' : (answered ? 'is-bad' : '')}">
          <div class="sn-head">
            <span class="sn-verdict">${heading}</span>
            <span class="sn-key">Verified key: option ${escapeHtml(q.answer_key)}</span>
          </div>
          <div class="sn-body"><p>${escapeHtml(q.explanation || 'Verified from the source notes.')}</p></div>
        </div>
      `;
    }

    DOM.qContainer.className = 'question-content' + (q.type === 'multi_statement' ? ' is-multi' : '');
    DOM.qContainer.innerHTML = html;
    if (DOM.answerPanel) {
      DOM.answerPanel.innerHTML = noteHtml;
      DOM.answerPanel.hidden = !noteHtml;
    }

    DOM.qContainer.querySelectorAll('.opt').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (isTest && State.testSubmitted) return;
        if (isPractice && State.practiceRevealed) return;
        const key = btn.getAttribute('data-key');
        activeAnswers()[q.id] = key;
        updateStats();
        renderQuestion(true);
        renderPalette();
      });
    });

    if (DOM.workspace) {
      DOM.workspace.scrollTop = preservePageScroll ? pageScroll : 0;
    }

    if (DOM.prevBtn) DOM.prevBtn.disabled = State.currentIndex === 0;

    const isLast = State.currentIndex === qList.length - 1;
    if (DOM.nextBtn) {
      DOM.nextBtn.style.display = 'inline-flex';
      DOM.nextBtn.disabled = isLast;
    }

    if (DOM.submitBtn) {
      if (isTest) {
        DOM.submitBtn.style.display = 'inline-flex';
        DOM.submitBtn.disabled = State.testSubmitted;
        DOM.submitBtn.innerHTML = icon('check_circle') + `<span>${State.testSubmitted ? 'Submitted' : 'Submit Test'}</span>`;
      } else {
        DOM.submitBtn.style.display = isLast ? 'inline-flex' : 'none';
        DOM.submitBtn.disabled = State.practiceRevealed;
        DOM.submitBtn.innerHTML = icon(State.practiceRevealed ? 'check_circle' : 'check') + `<span>${State.practiceRevealed ? 'Practice Complete' : 'Finish Practice'}</span>`;
      }
    }

    if (DOM.examSubmitBtn) {
      DOM.examSubmitBtn.disabled = State.testSubmitted;
      DOM.examSubmitBtn.textContent = State.testSubmitted ? 'Submitted' : 'Submit Test';
    }

    updateExamAnswered();
  }

  // ==========================================================================
  // STATS & PALETTE
  // ==========================================================================
  function computeScore(answers, list) {
    const qList = list || activeQuestionList();
    const map = answers || State.testAnswers;
    let correct = 0;
    let wrong = 0;
    let skipped = 0;

    qList.forEach((q) => {
      const answer = map[q.id];
      if (!answer) skipped++;
      else if (answer === q.answer_key) correct++;
      else wrong++;
    });

    const score = correct * MARKS_CORRECT - wrong * MARKS_WRONG;
    const max = qList.length * MARKS_CORRECT;
    return { total: qList.length, correct, wrong, skipped, score, max };
  }

  function updateExamAnswered() {
    if (!DOM.examAnswered || !State.currentModule) return;
    const total = activeQuestionList().length;
    DOM.examAnswered.textContent = `${answeredCount(State.testAnswers)}/${total} answered`;
  }

  function updateStats() {
    if (!State.currentModule) return;
    if (State.activeMode === 'revision') {
      const engine = revisionEngine();
      const items = currentRevisionItems();
      const stats = engine && items.length
        ? engine.getModuleRevisionStats(items, State.revision.progress, Date.now())
        : null;
      const reviewed = stats ? Math.max(0, stats.total - stats.newItems) : 0;
      if (DOM.liveAccNum) DOM.liveAccNum.textContent = stats ? String(stats.due) : '—';
      if (DOM.statCorrect) DOM.statCorrect.textContent = stats ? String(stats.newItems) : '–';
      if (DOM.statWrong) DOM.statWrong.textContent = stats ? String(stats.learning) : '–';
      if (DOM.railAccLabel) DOM.railAccLabel.textContent = 'Revision Queue';
      if (DOM.railAcc) DOM.railAcc.textContent = stats ? `${stats.due}` : '—';
      if (DOM.railBar) DOM.railBar.style.width = stats && stats.total ? `${Math.round((reviewed / stats.total) * 100)}%` : '0%';
      if (DOM.railSub) {
        DOM.railSub.textContent = stats
          ? `${stats.due} due now · ${stats.newItems} new · ${stats.total} items`
          : 'No revision items';
      }
      return;
    }
    if (DOM.railAccLabel) DOM.railAccLabel.textContent = 'Session Score';
    const resultsHidden = State.activeMode === 'test' && !State.testSubmitted;
    const total = activeQuestionList().length;

    if (resultsHidden) {
      const answered = answeredCount(State.testAnswers);
      if (DOM.liveAccNum) DOM.liveAccNum.textContent = '—';
      if (DOM.statCorrect) DOM.statCorrect.textContent = '–';
      if (DOM.statWrong) DOM.statWrong.textContent = '–';
      if (DOM.railAcc) DOM.railAcc.textContent = '—';
      if (DOM.railBar) DOM.railBar.style.width = `${total ? Math.round((answered / total) * 100) : 0}%`;
      if (DOM.railSub) DOM.railSub.textContent = `${answered} answered · results hidden`;
      return;
    }

    const answers = State.activeMode === 'test' ? State.testAnswers : State.practiceAnswers;
    const result = computeScore(answers);
    const attempted = result.correct + result.wrong;
    const acc = attempted > 0 ? Math.round((result.correct / attempted) * 100) : 0;

    if (DOM.liveAccNum) DOM.liveAccNum.textContent = `${acc}%`;
    if (DOM.statCorrect) DOM.statCorrect.textContent = result.correct;
    if (DOM.statWrong) DOM.statWrong.textContent = result.wrong;
    if (DOM.railAcc) DOM.railAcc.textContent = `${acc}%`;
    if (DOM.railBar) DOM.railBar.style.width = `${result.total ? Math.round((attempted / result.total) * 100) : 0}%`;
    if (DOM.railSub) DOM.railSub.textContent = `${attempted} answered of ${result.total}`;
  }

  function renderPalette() {
    if (!DOM.livePalette || !State.currentModule) return;
    const qList = activeQuestionList();
    const answers = activeAnswers();
    const showVerdicts = State.activeMode === 'test' && State.testSubmitted;
    DOM.livePalette.innerHTML = '';

    qList.forEach((q, idx) => {
      const answer = answers[q.id];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'palette-btn';
      if (idx === State.currentIndex) btn.classList.add('current');

      if (answer) {
        if (showVerdicts) {
          btn.classList.add(answer === q.answer_key ? 'correct' : 'wrong');
        } else {
          btn.classList.add('answered');
        }
      }

      btn.textContent = idx + 1;
      const stateLabel = !answer ? 'not answered' : (showVerdicts ? (answer === q.answer_key ? 'correct' : 'wrong') : 'answered');
      btn.setAttribute('aria-label', `Question ${idx + 1}, ${stateLabel}`);
      btn.addEventListener('click', () => {
        State.currentIndex = idx;
        renderQuestion();
        renderPalette();
      });
      DOM.livePalette.appendChild(btn);
    });
  }

  // ==========================================================================
  // SUBMIT & SCORECARD
  // ==========================================================================
  function completeTest() {
    if (!State.testStarted || State.testSubmitted) return;

    State.testSubmitted = true;
    stopTimer();
    if (State.testEndsAt) {
      const remaining = Math.max(0, Math.ceil((State.testEndsAt - Date.now()) / 1000));
      State.testRemainingSeconds = remaining;
      State.timerSeconds = Math.max(0, State.testDurationSeconds - remaining);
    } else {
      State.timerSeconds = State.testStartedAt ? Math.floor((Date.now() - State.testStartedAt) / 1000) : 0;
    }
    updateTimerDisplay();
    updateTestScreen();

    if (State.activeMode === 'test') {
      renderQuestion();
      renderPalette();
      updateStats();
    }

    const result = computeScore(State.testAnswers, State.testQuestions);
    State.lastResult = result;
    saveAttempt(result);

    openScorecard(result);
  }

  function submitTest() {
    if (!State.currentModule) return;

    if (State.activeMode !== 'test') {
      if (State.practiceRevealed) return;
      // Practice "Finish" reveals explanations without a scorecard.
      State.practiceRevealed = true;
      renderQuestion(true);
      renderPalette();
      showToast('Practice set complete. Answer keys and explanations are now visible.');
      return;
    }

    completeTest();
  }

  async function saveAttempt(result) {
    if (!State.currentModule || !window.OfflineStorage) return;
    const attempt = {
      id: 'attempt_' + Date.now(),
      moduleId: State.currentModule.id,
      moduleTitle: State.currentModule.title,
      createdAt: new Date().toISOString(),
      total: result.total,
      correct: result.correct,
      wrong: result.wrong,
      skipped: result.skipped,
      score: Number(result.score.toFixed(2)),
      max: result.max,
      timeSeconds: State.timerSeconds,
      answers: Object.assign({}, State.testAnswers)
    };
    try {
      await window.OfflineStorage.saveAttempt(attempt);
    } catch (e) {
      console.warn('Could not save exam attempt:', e);
    }
  }

  function openScorecard(result) {
    if (!DOM.scoreModal) return;

    if (DOM.scoreTitle) DOM.scoreTitle.textContent = result.score.toFixed(2);
    if (DOM.scoreMax) DOM.scoreMax.textContent = `out of ${result.max.toFixed(2)}`;
    if (DOM.scoreCorrect) DOM.scoreCorrect.textContent = result.correct;
    if (DOM.scoreWrong) DOM.scoreWrong.textContent = result.wrong;
    if (DOM.scoreSkipped) DOM.scoreSkipped.textContent = result.skipped;
    if (DOM.scoreTime) DOM.scoreTime.textContent = formatTime(State.timerSeconds);

    const pct = result.max > 0 ? (result.score / result.max) * 100 : 0;
    let band = 'Needs another pass';
    let bandClass = 'low';
    if (pct >= 80) { band = 'Excellent'; bandClass = 'high'; }
    else if (pct >= 60) { band = 'Strong result'; bandClass = 'high'; }
    else if (pct >= 35) { band = 'Good progress'; bandClass = 'mid'; }
    if (DOM.scoreBand) {
      DOM.scoreBand.textContent = band;
      DOM.scoreBand.className = 'score-band ' + bandClass;
    }
    if (DOM.scoreNote) {
      DOM.scoreNote.textContent = `Marking: +${MARKS_CORRECT.toFixed(2)} for a correct answer, −${MARKS_WRONG.toFixed(2)} for a wrong answer. Unanswered questions score 0.`;
    }

    DOM.scoreModal.classList.add('open');
    if (DOM.scoreReviewBtn) {
      setTimeout(() => DOM.scoreReviewBtn.focus(), 30);
    }
  }

  function closeScorecard() {
    if (!DOM.scoreModal) return;
    DOM.scoreModal.classList.remove('open');
    if (DOM.submitBtn) DOM.submitBtn.focus();
  }

  // Android hardware/gesture back: close overlays, step back to the Library,
  // and only exit the app from the Library itself. Returns true when handled.
  function handleAndroidBack() {
    if (DOM.processModal && DOM.processModal.classList.contains('open')) {
      closeProcessingDialog();
      return true;
    }
    if (DOM.scoreModal && DOM.scoreModal.classList.contains('open')) {
      closeScorecard();
      return true;
    }
    if (State.navOpen) {
      setNavOpen(false, { returnFocus: true });
      return true;
    }
    if (State.activeMode !== 'library') {
      switchMode('library');
      return true;
    }
    return false;
  }
  window.__studysynthBack = handleAndroidBack;

  function reviewAnswers() {
    if (!State.currentModule) return;
    closeScorecard();
    const qList = State.testQuestions.length ? State.testQuestions : State.currentModule.questions;
    let target = qList.findIndex((q) => {
      const answer = State.testAnswers[q.id];
      return !answer || answer !== q.answer_key;
    });
    if (target < 0) target = 0;
    State.currentIndex = target;
    switchMode('test');
    showToast('Use the previous and next controls to review every answer.');
  }

  function retakeTest() {
    if (!State.currentModule) return;
    closeScorecard();
    resetExamState();
    switchMode('test');
    if (DOM.testStartBtn) setTimeout(() => DOM.testStartBtn.focus(), 30);
    showToast('Choose your question count and time, then start a fresh test.');
  }

  // ==========================================================================
  // PROCESSING JOBS (background-capable)
  // ==========================================================================
  let Processing = null;
  let processExpanded = true;
  let processReturnFocus = null;
  let processLastAnnouncement = '';
  let processHideTimer = null;
  let recoveryJob = null;
  let recoveryQueue = [];
  let completedModule = null;

  function createGenerationWorker() {
    try {
      return new Worker(new URL('./engine/worker.js', document.baseURI), { name: 'studysynth-generator' });
    } catch (err) {
      console.warn('Background worker unavailable; using the on-device fallback.', err);
      return null;
    }
  }

  function initProcessing() {
    if (!window.StudySynthJobs) {
      console.warn('Processing jobs module is unavailable.');
      return;
    }
    Processing = window.StudySynthJobs.createJobManager({
      storage: window.OfflineStorage,
      saveModule: (module) => window.OfflineStorage.saveModule(module),
      workers: { create: createGenerationWorker },
      analyze: (payload, hooks) => window.StudySynthAnalysis.analyzeSource(
        payload.text,
        payload.title,
        payload.sourceMeta,
        payload.targetCount,
        hooks
      ),
      readFile: (file, onProgress, options) => window.OfflineDocParser.readFileContentDetailed(file, onProgress, options),
      onUpdate: renderProcessing,
      onSettled: handleProcessingSettled
    });
    bindProcessingEvents();
    checkInterruptedJobs();
  }

  function bindProcessingEvents() {
    if (DOM.processMinimizeBtn) DOM.processMinimizeBtn.addEventListener('click', minimizeProcessing);
    if (DOM.processCancelBtn) {
      DOM.processCancelBtn.addEventListener('click', () => {
        if (!Processing) return;
        if (!Processing.cancel()) showToast('The study module is finishing its save.');
      });
    }
    if (DOM.processResumeBtn) DOM.processResumeBtn.addEventListener('click', resumeRecovery);
    if (DOM.processRetryBtn) {
      DOM.processRetryBtn.addEventListener('click', () => {
        if (!Processing || !Processing.retry()) showToast('This job cannot be retried.');
      });
    }
    if (DOM.processOpenBtn) DOM.processOpenBtn.addEventListener('click', openCompletedModule);
    if (DOM.processDiscardBtn) DOM.processDiscardBtn.addEventListener('click', discardRecovery);
    if (DOM.processCloseBtn) DOM.processCloseBtn.addEventListener('click', closeProcessingDialog);
    if (DOM.processChip) DOM.processChip.addEventListener('click', openProcessingDialog);
    if (DOM.processModal) DOM.processModal.addEventListener('keydown', handleProcessKeydown);

    document.addEventListener('visibilitychange', () => {
      if (!Processing || document.hidden) return;
      // A hidden tab is best-effort only. Never cancel just because the page
      // was hidden; reconcile the dialog with the live job when it returns.
      Processing.refresh();
      if (recoveryJob) paintProcessing(recoveryJob);
    });
  }

  async function checkInterruptedJobs() {
    if (!Processing) return;
    try {
      recoveryQueue = await Processing.listInterrupted();
    } catch (err) {
      recoveryQueue = [];
    }
    if (!recoveryQueue.length) return;
    recoveryJob = recoveryQueue.shift();
    processExpanded = true;
    paintProcessing(recoveryJob);
  }

  function setAppInert(inert) {
    if (!DOM.appShell) return;
    try { DOM.appShell.inert = inert; } catch (err) { /* older WebView */ }
    if (inert) DOM.appShell.setAttribute('aria-hidden', 'true');
    else DOM.appShell.removeAttribute('aria-hidden');
  }

  function clearProcessingHide() {
    if (processHideTimer) {
      clearTimeout(processHideTimer);
      processHideTimer = null;
    }
  }

  function focusProcessingDialog() {
    if (!DOM.processModal) return;
    const preferred = [DOM.processCancelBtn, DOM.processResumeBtn, DOM.processRetryBtn, DOM.processOpenBtn, DOM.processCloseBtn, DOM.processDiscardBtn];
    const target = preferred.find((btn) => btn && !btn.hidden && !btn.disabled);
    if (target) {
      setTimeout(() => target.focus(), 30);
    } else {
      const card = DOM.processModal.querySelector('.process-card');
      if (card) setTimeout(() => card.focus(), 30);
    }
  }

  function openProcessingDialog() {
    const job = recoveryJob || (Processing && Processing.getCurrent());
    if (!job) return;
    clearProcessingHide();
    processExpanded = true;
    paintProcessing(job);
  }

  function minimizeProcessing() {
    const job = recoveryJob || (Processing && Processing.getCurrent());
    if (!job) return;
    if (job.status !== 'running' && !recoveryJob) {
      closeProcessingDialog();
      return;
    }
    processExpanded = false;
    paintProcessing(job);
    if (job.status === 'completed') scheduleProcessingHide();
  }

  function closeProcessingDialog() {
    if (recoveryJob) {
      processExpanded = false;
      paintProcessing(recoveryJob);
      return;
    }
    const job = Processing && Processing.getCurrent();
    if (job && job.status !== 'running') {
      Processing.dismiss();
      processExpanded = false;
      paintProcessing(null);
      return;
    }
    if (job) {
      minimizeProcessing();
      return;
    }
    processExpanded = false;
    paintProcessing(null);
  }

  function handleProcessKeydown(event) {
    if (!DOM.processModal) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeProcessingDialog();
      return;
    }
    if (event.key !== 'Tab') return;
    const card = DOM.processModal.querySelector('.process-card');
    if (!card) return;
    const items = Array.prototype.slice.call(
      card.querySelectorAll('button:not([hidden]):not([disabled])')
    ).filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function processCountText(job) {
    const p = job.progress || {};
    if (p.total && p.completed != null) return `${p.completed} of ${p.total} pages`;
    if (job.status === 'completed') return 'Completed';
    if (job.status === 'interrupted') return 'Paused';
    if (!p.indeterminate && p.percent != null) return job.stage === 'ocr' ? 'Recognising text' : 'Working on this device';
    return 'Working on this device';
  }

  function renderProcessStages(job) {
    if (!DOM.processStages) return;
    const stages = Array.isArray(job.stages) ? job.stages : [];
    DOM.processStages.innerHTML = stages.map((stage) => {
      const iconName = stage.state === 'done' ? 'check_circle'
        : stage.state === 'active' ? 'progress_activity'
          : stage.state === 'error' ? 'error' : 'radio_button_unchecked';
      const stateText = stage.state === 'done' ? 'Completed'
        : stage.state === 'active' ? 'In progress'
          : stage.state === 'error' ? 'Stopped' : 'Pending';
      return `<li class="process-stage is-${escapeHtml(stage.state)}">`
        + `<span class="ms-icon" aria-hidden="true">${iconName}</span>`
        + `<span>${escapeHtml(stage.label)}</span>`
        + `<span class="process-stage-state">${stateText}</span>`
        + '</li>';
    }).join('');
  }

  function paintProcessing(job) {
    const modalWasOpen = !!(DOM.processModal && DOM.processModal.classList.contains('open'));
    const modalOpen = !!job && processExpanded && job.status !== 'cancelled';
    const justOpened = modalOpen && !modalWasOpen;
    if (DOM.processModal) DOM.processModal.classList.toggle('open', modalOpen);

    if (justOpened) processReturnFocus = document.activeElement;
    if (!modalOpen && modalWasOpen) {
      const target = processReturnFocus;
      setTimeout(() => {
        if (!target || typeof target.focus !== 'function' || !document.contains(target)) return;
        if (target.disabled || target.hidden || target.getClientRects().length === 0) return;
        target.focus();
      }, 30);
    }
    setAppInert(modalOpen);

    if (!job) {
      if (DOM.processChip) DOM.processChip.hidden = true;
      setGenerateBusy(false);
      return;
    }

    const progress = job.progress || {};
    const determinate = !progress.indeterminate && progress.percent != null;
    const isImport = job.type === 'import';
    const isRecovery = job.status === 'interrupted';
    const isDone = job.status === 'completed';
    const isError = job.status === 'failed';
    const countText = processCountText(job);

    const title = isDone
      ? (isImport ? 'Your document is ready' : 'Your study module is ready')
      : isError ? 'Processing stopped'
        : isRecovery ? 'Processing was interrupted'
          : isImport ? 'Preparing your document' : 'Preparing your study module';
    if (DOM.processTitle) DOM.processTitle.textContent = title;
    if (DOM.processMessage) DOM.processMessage.textContent = job.message || 'Working on this device…';

    if (DOM.processNotice) {
      let notice = '';
      if (job.resumed) notice = 'Resumed from the last saved step after an interruption.';
      else if (isRecovery && job.canResume) notice = 'Resume to continue from the last saved step.';
      else if (isRecovery && job.reason) notice = job.reason;
      DOM.processNotice.textContent = notice;
      DOM.processNotice.hidden = !notice;
    }

    if (DOM.processTrack) {
      DOM.processTrack.classList.toggle('is-indeterminate', !determinate && job.status === 'running');
      if (determinate) DOM.processTrack.setAttribute('aria-valuenow', String(progress.percent));
      else DOM.processTrack.removeAttribute('aria-valuenow');
      DOM.processTrack.setAttribute('aria-valuetext', determinate ? `${countText}, ${progress.percent}%` : countText);
    }
    if (DOM.processBar) DOM.processBar.style.width = determinate ? `${progress.percent}%` : '';
    if (DOM.processCount) DOM.processCount.textContent = countText;
    if (DOM.processPct) {
      DOM.processPct.hidden = !determinate;
      DOM.processPct.textContent = determinate ? `${progress.percent}%` : '';
    }
    renderProcessStages(job);

    if (DOM.processStorage) {
      const warning = job.storageWarning || '';
      DOM.processStorage.textContent = warning;
      DOM.processStorage.hidden = !warning;
    }

    const running = job.status === 'running';
    if (DOM.processMinimizeBtn) DOM.processMinimizeBtn.hidden = !running;
    if (DOM.processCancelBtn) {
      DOM.processCancelBtn.hidden = !running;
      DOM.processCancelBtn.disabled = !job.canCancel;
    }
    if (DOM.processResumeBtn) {
      DOM.processResumeBtn.hidden = !(isRecovery && job.canResume);
      DOM.processResumeBtn.disabled = false;
    }
    if (DOM.processRetryBtn) DOM.processRetryBtn.hidden = !(isError && job.canRetry);
    if (DOM.processOpenBtn) DOM.processOpenBtn.hidden = !(isDone && !isImport && !!completedModule);
    if (DOM.processDiscardBtn) DOM.processDiscardBtn.hidden = !isRecovery;
    if (DOM.processCloseBtn) DOM.processCloseBtn.hidden = !(isDone || isError || isRecovery);

    const announceKey = `${job.id}|${job.status}|${job.stage}`;
    if (announceKey !== processLastAnnouncement) {
      processLastAnnouncement = announceKey;
      if (DOM.processLive) {
        const normalize = (value) => String(value || '').replace(/[.\s]+$/g, '').trim();
        const detail = normalize(job.message) === normalize(title) ? '' : (job.message || '');
        DOM.processLive.textContent = `${title}. ${detail}`.trim();
      }
    }

    const showChip = !processExpanded && job.status !== 'cancelled';
    if (DOM.processChip) {
      DOM.processChip.hidden = !showChip;
      DOM.processChip.classList.toggle('is-done', isDone);
      DOM.processChip.classList.toggle('is-error', isError);
      if (showChip) {
        const chipStage = isDone
          ? (isImport ? 'Document ready' : 'Study module ready')
          : isError ? 'Processing stopped'
            : isRecovery ? 'Processing was interrupted'
              : (job.stageLabel || 'Working');
        const chipMeta = isRecovery ? (job.canResume ? 'Tap to resume' : 'Cannot resume')
          : isError ? 'Tap to review'
            : determinate ? (progress.total ? countText : `${progress.percent}% complete`)
              : 'Working on this device';
        if (DOM.processChipStage) DOM.processChipStage.textContent = chipStage;
        if (DOM.processChipMeta) DOM.processChipMeta.textContent = chipMeta;
        if (DOM.processChipPct) {
          DOM.processChipPct.hidden = !determinate || isDone || isError;
          DOM.processChipPct.textContent = determinate ? `${progress.percent}%` : '';
        }
        DOM.processChip.setAttribute('aria-label', `Open processing details. ${chipStage}. ${chipMeta}.`);
      }
    }

    setGenerateBusy(running, job.type);
    if (justOpened) focusProcessingDialog();
  }

  function renderProcessing(job) {
    if (!job) {
      if (recoveryJob) {
        paintProcessing(recoveryJob);
        return;
      }
      paintProcessing(null);
      return;
    }
    recoveryJob = null;
    paintProcessing(job);
    if (job.status === 'completed' && !processExpanded) scheduleProcessingHide();
  }

  function scheduleProcessingHide() {
    clearProcessingHide();
    processHideTimer = setTimeout(() => {
      const job = Processing && Processing.getCurrent();
      if (job && job.status === 'completed' && !processExpanded) {
        Processing.dismiss();
        paintProcessing(null);
      }
    }, 8000);
  }

  function setGenerateBusy(busy, type) {
    if (!DOM.generateBtn) return;
    DOM.generateBtn.disabled = busy;
    const label = DOM.generateBtn.querySelector('.generate-label');
    const text = busy
      ? (type === 'import' ? 'Processing your document…' : 'Preparing your study module…')
      : 'Generate Offline Quiz & Study Package';
    if (label) label.textContent = text;
    else DOM.generateBtn.textContent = text;
  }

  function applyImportedDocument(result) {
    completedModule = null;
    const detailed = result.detailed || {};
    const text = result.text || '';
    const fileName = (result.job && result.job.title) || 'Document';
    const title = fileName.replace(/\.[^/.]+$/, '');
    DOM.docText.value = text;
    DOM.docTitle.value = title;

    const lowConfidence = detailed.origin === 'ocr'
      && (!Number.isFinite(detailed.confidence) || detailed.confidence < 90);
    State.sourceMeta = {
      origin: detailed.origin || 'text',
      confidence: detailed.confidence,
      lowConfidence: lowConfidence,
      confirmed: !lowConfidence,
      edited: false,
      originalText: text
    };

    if (lowConfidence) {
      setFileStatus(`Loaded ${fileName} · OCR confidence ${Math.round(detailed.confidence)}%. Review and correct the text before generating.`, 'error');
      showToast('Review the extracted OCR text before generating.');
    } else {
      setFileStatus(`Loaded ${fileName} · ${text.length.toLocaleString()} characters extracted locally.`, 'ok');
      showToast(`Loaded ${fileName}. Review the text, then generate.`);
    }
  }

  function handleGeneratedModule(result) {
    const module = result.module;
    if (!module) return;
    completedModule = module;
    const questionCount = Array.isArray(module.questions) ? module.questions.length : 0;
    const unitCount = Array.isArray(module.inventory) ? module.inventory.length : 0;
    const validation = module.validation || {};
    const rejected = validation.rejected || 0;
    const rejectionSummary = Object.keys(validation.rejectionCounts || {})
      .filter((key) => Number(validation.rejectionCounts[key]) > 0)
      .map((key) => `${key.replace(/_/g, ' ')} (${validation.rejectionCounts[key]})`)
      .slice(0, 4)
      .join(', ');

    if (module.revisionOnly) {
      setFileStatus('Revision only · no MCQ passed source verification. The knowledge units were saved for revision.', 'error');
      showToast('Saved for revision only. No verified MCQs were published.');
    } else {
      const skipNote = rejected > 0 ? ` ${rejected} candidate${rejected === 1 ? '' : 's'} skipped.` : '';
      const reasonNote = rejectionSummary ? ` Reasons: ${rejectionSummary}.` : '';
      setFileStatus(`Ready · ${questionCount} verified question${questionCount === 1 ? '' : 's'} from ${unitCount} knowledge unit${unitCount === 1 ? '' : 's'} in ${module.durationMs} ms.${skipNote}${reasonNote}`, 'ok');
      showToast(`Saved “${module.title}”. ${questionCount} verified question${questionCount === 1 ? '' : 's'} available.`);
    }

    if (State.activeMode === 'generator') {
      setModule(module);
      switchMode('library');
      renderLibrary();
    } else if (State.activeMode === 'library') {
      renderLibrary();
    }
  }

  function handleProcessingSettled(result) {
    if (!result) return;
    if (result.status === 'cancelled') {
      processExpanded = false;
      if (Processing) Processing.dismiss();
      paintProcessing(null);
      showToast('Processing cancelled. Your notes are still here.');
      return;
    }
    if (result.status === 'failed') {
      const message = (result.error && result.error.message) || 'Processing stopped.';
      setFileStatus(message, 'error');
      showToast(message);
      return;
    }
    if (result.status === 'completed') {
      if (result.type === 'import') applyImportedDocument(result);
      else handleGeneratedModule(result);
      // The completed view is painted before onSettled runs, so repaint now
      // that the generated module is available to the dialog's open action.
      const current = Processing && Processing.getCurrent();
      if (current) paintProcessing(current);
      if (!processExpanded) scheduleProcessingHide();
    }
  }

  function openCompletedModule() {
    if (!completedModule) {
      closeProcessingDialog();
      return;
    }
    const module = completedModule;
    closeProcessingDialog();
    startLibraryMode(module, module.questions && module.questions.length ? 'practice' : 'revision');
    renderLibrary();
  }

  async function resumeRecovery() {
    if (!recoveryJob || !Processing) return;
    const id = recoveryJob.id;
    clearProcessingHide();
    processExpanded = true;
    if (DOM.processResumeBtn) DOM.processResumeBtn.disabled = true;
    const result = await Processing.resume(id);
    recoveryJob = null;
    const current = Processing.getCurrent();
    if (current) {
      paintProcessing(current);
    } else if (result.job) {
      paintProcessing(result.job);
    } else {
      paintProcessing(null);
    }
    if (!result.accepted) {
      if (result.reason === 'missing') {
        showToast('That saved job is no longer available.');
        showNextRecovery();
      } else {
        showToast('This job could not be resumed. Add the document again to continue.');
      }
    }
  }

  function showNextRecovery() {
    recoveryJob = recoveryQueue.length ? recoveryQueue.shift() : null;
    if (recoveryJob) {
      processExpanded = true;
      paintProcessing(recoveryJob);
    } else {
      processExpanded = false;
      paintProcessing(null);
    }
  }

  async function discardRecovery() {
    if (!recoveryJob || !Processing) return;
    const id = recoveryJob.id;
    await Processing.discard(id);
    recoveryJob = null;
    showNextRecovery();
    showToast('The interrupted job was removed.');
  }

  // ==========================================================================
  // GENERATOR
  // ==========================================================================
  async function handleGenerate() {
    const text = (DOM.docText.value || '').trim();
    if (!text) {
      setFileStatus('Add notes, a document, or a sample first.', 'error');
      showToast('Please provide notes, text, or a document first.');
      return;
    }
    if (text.length < 40) {
      setFileStatus('The text is too short to build a reliable quiz. Add at least a paragraph.', 'error');
      showToast('Add a little more source text to generate a quiz.');
      return;
    }

    const title = (DOM.docTitle.value || '').trim() || 'Custom Study Quiz';
    const sourceMeta = State.sourceMeta;
    if (sourceMeta && sourceMeta.origin === 'ocr' && sourceMeta.lowConfidence) {
      if (sourceMeta.originalText && text !== String(sourceMeta.originalText).trim()) {
        sourceMeta.confirmed = true;
        sourceMeta.edited = true;
      }
      if (!sourceMeta.confirmed) {
        const confirmNow = window.confirm(
          `On-device OCR confidence is ${Math.round(sourceMeta.confidence || 0)}%. ` +
          'Have you reviewed the extracted text? Choose OK to use it as-is, or Cancel to keep editing first.'
        );
        if (!confirmNow) {
          setFileStatus(`On-device OCR confidence is ${Math.round(sourceMeta.confidence || 0)}%. Review and correct the extracted text, or confirm it explicitly, before generating.`, 'error');
          showToast('Low-confidence OCR needs your review before questions can be created.');
          return;
        }
        sourceMeta.confirmed = true;
      }
    }

    if (!Processing) {
      setFileStatus('Processing is unavailable. Reload the app and try again.', 'error');
      showToast('Processing is unavailable in this session.');
      return;
    }
    if (Processing.isBusy()) {
      processExpanded = true;
      openProcessingDialog();
      showToast('A study module is already being prepared.');
      return;
    }

    setFileStatus('Extracting source facts and verifying candidates…', '');
    processExpanded = true;
    completedModule = null;
    const started = Processing.startGeneration({
      title: title,
      text: text,
      sourceMeta: sourceMeta,
      targetCount: 15
    });
    if (!started.accepted) {
      processExpanded = true;
      paintProcessing(started.job || Processing.getCurrent());
      showToast('A study module is already being prepared.');
    }
  }

  // ==========================================================================
  // REVISION — adaptive, evidence-backed recall
  // ==========================================================================
  function revisionEngine() {
    return typeof window !== 'undefined' ? window.StudySynthRevision || null : null;
  }

  // Cards are derived from the saved module content and rebuilt only when the
  // active module changes, so switching modules never reuses another queue.
  function currentRevisionItems() {
    if (!State.currentModule) return [];
    const moduleId = State.currentModule.id;
    if (State.revision.itemsFor !== moduleId || !Array.isArray(State.revision.items)) {
      const engine = revisionEngine();
      State.revision.items = engine ? engine.buildRevisionItems(State.currentModule) : [];
      State.revision.itemsFor = moduleId;
      State.revision.session = null;
      State.revision.resumeCandidate = null;
      State.revision.progress = {};
      State.revision.revealed = false;
      State.revision.viewingPrev = false;
      State.revision.expandedEvidence = false;
    }
    return State.revision.items;
  }

  function revisionItemById(id) {
    return currentRevisionItems().find((item) => item && item.id === id) || null;
  }

  function showRevisionPanel(panel) {
    if (DOM.revisionDashboard) DOM.revisionDashboard.hidden = panel !== 'dashboard';
    if (DOM.revisionSession) DOM.revisionSession.hidden = panel !== 'session';
    if (DOM.revisionSummary) DOM.revisionSummary.hidden = panel !== 'summary';
    if (DOM.revisionUnavailable) DOM.revisionUnavailable.hidden = panel !== 'unavailable';
  }

  function showRevisionUnavailable(message) {
    if (DOM.revisionUnavailable) DOM.revisionUnavailable.textContent = message;
    showRevisionPanel('unavailable');
  }

  function formatRevisionWhen(timestamp, now) {
    if (!timestamp) return '';
    const diff = timestamp - now;
    if (diff <= 0) return 'now';
    const minutes = Math.round(diff / 60000);
    if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? '' : 's'}`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `in ${hours} hour${hours === 1 ? '' : 's'}`;
    const days = Math.round(hours / 24);
    if (days < 30) return `in ${days} day${days === 1 ? '' : 's'}`;
    const months = Math.round(days / 30);
    return `in about ${months} month${months === 1 ? '' : 's'}`;
  }

  async function readRevisionSession(moduleId) {
    try {
      if (window.OfflineStorage && window.OfflineStorage.getRevisionSession) {
        return await window.OfflineStorage.getRevisionSession(moduleId);
      }
    } catch (e) { /* storage unavailable */ }
    return null;
  }

  function isResumableSession(session) {
    return !!(session && Array.isArray(session.itemIds) && session.itemIds.length && !session.completed);
  }

  // Due status is always recomputed from persisted timestamps on open.
  async function openRevision() {
    const engine = revisionEngine();
    if (!DOM.revisionDashboard) return;

    State.revision.revealed = false;
    State.revision.viewingPrev = false;
    State.revision.expandedEvidence = false;

    if (!State.currentModule) {
      showRevisionUnavailable('Choose a saved set from the Library before revising.');
      return;
    }
    if (!engine) {
      showRevisionUnavailable('The revision engine could not be loaded. Reload the app and try again.');
      return;
    }

    const items = currentRevisionItems();
    if (!items.length) {
      showRevisionUnavailable('This set has no source text that can be revised safely. Add clearer notes or a selectable PDF and try again.');
      return;
    }

    try {
      if (window.OfflineStorage && window.OfflineStorage.getRevisionProgress) {
        State.revision.progress = (await window.OfflineStorage.getRevisionProgress(State.currentModule.id)) || {};
      }
    } catch (e) {
      State.revision.progress = {};
      showToast('Revision progress could not be read on this device.');
    }

    const saved = await readRevisionSession(State.currentModule.id);
    State.revision.resumeCandidate = isResumableSession(saved) ? saved : null;
    State.revision.session = null;

    renderRevisionDashboard();
    showRevisionPanel('dashboard');
    updateStats();
  }

  function renderRevisionDashboard() {
    const engine = revisionEngine();
    const mod = State.currentModule;
    if (!DOM.revisionDashboard || !engine || !mod) return;

    const items = currentRevisionItems();
    const now = Date.now();
    const stats = engine.getModuleRevisionStats(items, State.revision.progress, now);

    if (DOM.revDashTitle) DOM.revDashTitle.textContent = mod.title || 'Revision';
    if (DOM.revDashTopic) DOM.revDashTopic.textContent = 'Evidence-backed recall, scheduled on this device.';
    if (DOM.revStatDue) DOM.revStatDue.textContent = String(stats.due);
    if (DOM.revStatNew) DOM.revStatNew.textContent = String(stats.newItems);
    if (DOM.revStatLearning) DOM.revStatLearning.textContent = String(stats.learning);
    if (DOM.revStatConsistent) DOM.revStatConsistent.textContent = String(stats.consistent);
    if (DOM.revStatTotal) DOM.revStatTotal.textContent = String(stats.total);

    const startable = stats.due + stats.newItems;
    if (DOM.revStartBtn) {
      DOM.revStartBtn.disabled = startable === 0;
      DOM.revStartBtn.textContent = stats.total <= engine.DEFAULT_SESSION_SIZE
        ? `Start revision (${startable} item${startable === 1 ? '' : 's'})`
        : 'Start revision';
    }

    const resumable = isResumableSession(State.revision.resumeCandidate);
    if (DOM.revResumeBtn) {
      DOM.revResumeBtn.hidden = !resumable;
      if (resumable) {
        const position = Math.min(State.revision.resumeCandidate.cursor + 1, State.revision.resumeCandidate.itemIds.length);
        DOM.revResumeBtn.textContent = `Resume session (item ${position} of ${State.revision.resumeCandidate.itemIds.length})`;
      }
    }

    let note;
    if (startable === 0) {
      note = 'Nothing is due right now. Every item you have reviewed is scheduled ahead; new items will appear here once you add content.';
      if (stats.nextDueAt) {
        note = `Nothing is due right now. The next item returns ${formatRevisionWhen(stats.nextDueAt, now)}.`;
      }
      if (stats.newItems === 0 && stats.consistent > 0 && !stats.nextDueAt) {
        note = 'Nothing is due right now. You have recalled every item in this set consistently.';
      }
    } else {
      const parts = [];
      if (stats.due) parts.push(`${stats.due} due`);
      if (stats.newItems) parts.push(`${stats.newItems} new`);
      note = `A session draws up to ${engine.DEFAULT_SESSION_SIZE} items, taking ${parts.join(' and ')} first, then long-interval items that are becoming stale.`;
      if (stats.due === 0) note = `No item is due yet. A session will start with the ${stats.newItems} new item${stats.newItems === 1 ? '' : 's'}; already-reviewed items return when scheduled.`;
    }
    if (DOM.revDashNote) DOM.revDashNote.textContent = note;

    if (DOM.setTitle) DOM.setTitle.textContent = `${stats.total} REVISION ITEM${stats.total === 1 ? '' : 'S'}`;
    if (DOM.setTopic) DOM.setTopic.textContent = mod.title || 'Revision';
  }

  async function revisionAttempts(moduleId) {
    try {
      if (window.OfflineStorage && window.OfflineStorage.getAttempts) {
        const list = await window.OfflineStorage.getAttempts(moduleId);
        return Array.isArray(list) ? list : [];
      }
    } catch (e) { /* storage unavailable */ }
    return [];
  }

  async function persistRevisionSession() {
    const session = State.revision.session;
    if (!session || !window.OfflineStorage) return;
    try {
      if (session.completed) await window.OfflineStorage.deleteRevisionSession(session.moduleId);
      else await window.OfflineStorage.saveRevisionSession(session);
    } catch (e) {
      showToast('This session could not be saved on this device.');
    }
  }

  async function startRevisionSession() {
    const engine = revisionEngine();
    const mod = State.currentModule;
    if (!engine || !mod) return;
    const items = currentRevisionItems();
    const attempts = await revisionAttempts(mod.id);
    const session = engine.buildSession(items, State.revision.progress, attempts, {
      now: Date.now(),
      size: engine.DEFAULT_SESSION_SIZE,
      moduleId: mod.id,
      questions: Array.isArray(mod.questions) ? mod.questions : []
    });

    if (!session.itemIds.length) {
      State.revision.session = null;
      State.revision.resumeCandidate = null;
      renderRevisionDashboard();
      showRevisionPanel('dashboard');
      showToast('Nothing is due right now. Your next item returns when its interval ends.');
      return;
    }

    State.revision.session = session;
    State.revision.resumeCandidate = null;
    State.revision.revealed = false;
    State.revision.viewingPrev = false;
    State.revision.expandedEvidence = false;
    await persistRevisionSession();
    renderRevisionSession();
    showRevisionPanel('session');
    updateStats();
  }

  function resumeRevisionSession() {
    const engine = revisionEngine();
    if (!engine) return;
    const restored = engine.resumeSession(State.revision.resumeCandidate, currentRevisionItems());
    if (!restored || !restored.itemIds.length) {
      State.revision.resumeCandidate = null;
      showToast('The saved session no longer matches this set. Starting fresh.');
      renderRevisionDashboard();
      showRevisionPanel('dashboard');
      return;
    }
    State.revision.session = restored;
    State.revision.revealed = false;
    State.revision.viewingPrev = false;
    State.revision.expandedEvidence = false;
    renderRevisionSession();
    showRevisionPanel('session');
    updateStats();
  }

  function renderRevisionSession() {
    const session = State.revision.session;
    if (!session || !DOM.revisionSession) return;
    const total = session.itemIds.length;
    if (session.cursor >= total) {
      finishRevisionSession();
      return;
    }

    const viewingPrev = State.revision.viewingPrev && session.cursor > 0;
    const index = viewingPrev ? session.cursor - 1 : session.cursor;
    const card = revisionItemById(session.itemIds[index]);
    if (!card) {
      // The saved session referenced an item that no longer exists.
      session.cursor = Math.min(Math.max(index + 1, session.cursor), total);
      if (session.cursor >= total) { finishRevisionSession(); return; }
      State.revision.viewingPrev = false;
      renderRevisionSession();
      return;
    }

    if (DOM.revPos) DOM.revPos.textContent = `Item ${session.cursor + 1} of ${total}`;
    const pct = total ? Math.round((session.cursor / total) * 100) : 0;
    if (DOM.revProgressBar) DOM.revProgressBar.style.width = `${pct}%`;
    if (DOM.revProgress) DOM.revProgress.setAttribute('aria-valuenow', String(pct));

    if (DOM.revForm) DOM.revForm.textContent = card.formLabel || 'Recall';
    if (DOM.revPrompt) DOM.revPrompt.textContent = card.prompt || '';

    const revealed = viewingPrev || State.revision.revealed;
    if (DOM.revAnswer) DOM.revAnswer.hidden = !revealed;
    if (revealed) {
      if (DOM.revAnswerText) DOM.revAnswerText.textContent = card.answer || '';
      renderRevisionEvidence(card);
    }

    const canRate = revealed && !viewingPrev && !session.completed;
    if (DOM.revRatings) DOM.revRatings.hidden = !canRate;
    if (DOM.revRevealBtn) DOM.revRevealBtn.hidden = revealed;
    if (DOM.revBackBtn) DOM.revBackBtn.hidden = !viewingPrev;
    if (DOM.revRecallHint) DOM.revRecallHint.hidden = revealed;
    if (DOM.revPrevBtn) DOM.revPrevBtn.hidden = viewingPrev || session.cursor === 0;
  }

  function renderRevisionEvidence(card) {
    const section = card.sectionTitle || 'Source';
    const page = Number.isFinite(card.sourcePage) ? card.sourcePage : null;
    const refParts = [section];
    if (page) refParts.push(`page ${page}`);
    if (DOM.revSourceRef) DOM.revSourceRef.textContent = `Evidence · ${refParts.join(' · ')}`;

    const excerpt = card.excerpt || card.statement || '';
    const answer = card.answer || '';
    const trimmedExcerpt = excerpt.length > 160 ? `${excerpt.slice(0, 157).trimEnd()}…` : excerpt;
    const hasMore = excerpt.length > trimmedExcerpt.length;

    if (DOM.revEvidenceShort) DOM.revEvidenceShort.textContent = hasMore ? trimmedExcerpt : excerpt;
    if (DOM.revEvidenceShort) DOM.revEvidenceShort.hidden = false;
    if (DOM.revEvidenceFull) {
      DOM.revEvidenceFull.textContent = excerpt;
      DOM.revEvidenceFull.hidden = true;
    }
    if (DOM.revEvidenceToggle) {
      DOM.revEvidenceToggle.hidden = !hasMore;
      DOM.revEvidenceToggle.textContent = 'Show full excerpt';
    }
    State.revision.expandedEvidence = false;
    if (!excerpt && DOM.revSourceRef) DOM.revSourceRef.textContent = `Evidence · ${refParts.join(' · ')} (excerpt unavailable)`;
    if (!answer && DOM.revAnswerText) DOM.revAnswerText.textContent = card.statement || '';
  }

  function revealRevisionAnswer() {
    if (State.revision.viewingPrev) return;
    State.revision.revealed = true;
    renderRevisionSession();
  }

  function toggleRevisionEvidence() {
    const full = State.revision.expandedEvidence;
    State.revision.expandedEvidence = !full;
    if (DOM.revEvidenceShort) DOM.revEvidenceShort.hidden = !full;
    if (DOM.revEvidenceFull) DOM.revEvidenceFull.hidden = full;
    if (DOM.revEvidenceToggle) DOM.revEvidenceToggle.textContent = full ? 'Show full excerpt' : 'Show less';
  }

  function viewPreviousRevisionCard() {
    const session = State.revision.session;
    if (!session || session.cursor === 0) return;
    State.revision.viewingPrev = true;
    State.revision.expandedEvidence = false;
    renderRevisionSession();
  }

  function returnToCurrentRevisionCard() {
    State.revision.viewingPrev = false;
    State.revision.expandedEvidence = false;
    renderRevisionSession();
  }

  // A rating is written to storage before the queue advances, so a reload can
  // never lose a review the learner already submitted.
  async function rateRevision(rating) {
    const engine = revisionEngine();
    const session = State.revision.session;
    if (!engine || !session || State.revision.saving || session.completed) return;
    if (State.revision.viewingPrev) return;

    const itemId = session.itemIds[session.cursor];
    if (!itemId) return;

    const now = Date.now();
    const result = engine.rateSessionItem(session, itemId, rating, State.revision.progress, now);
    if (result.ignored) return;

    State.revision.saving = true;
    State.revision.session = result.session;
    State.revision.progress = result.progress;
    State.revision.revealed = false;
    State.revision.viewingPrev = false;
    State.revision.expandedEvidence = false;

    try {
      if (window.OfflineStorage && window.OfflineStorage.saveRevisionProgress) {
        const record = engine.getItemProgress(itemId, result.progress, now);
        await window.OfflineStorage.saveRevisionProgress(record);
      }
      await persistRevisionSession();
    } catch (e) {
      showToast('This rating could not be saved on this device.');
    } finally {
      State.revision.saving = false;
    }

    if (State.revision.session.completed) {
      finishRevisionSession();
      return;
    }
    renderRevisionSession();
    updateStats();
  }

  async function pauseRevisionSession() {
    if (!State.revision.session) {
      showRevisionPanel('dashboard');
      renderRevisionDashboard();
      return;
    }
    await persistRevisionSession();
    State.revision.resumeCandidate = State.revision.session;
    State.revision.revealed = false;
    State.revision.viewingPrev = false;
    renderRevisionDashboard();
    showRevisionPanel('dashboard');
    updateStats();
    showToast('Session paused. Resume it any time from this set.');
  }

  async function finishRevisionSession() {
    const engine = revisionEngine();
    const session = State.revision.session;
    if (!engine || !session) { showRevisionPanel('dashboard'); return; }

    await persistRevisionSession();
    State.revision.resumeCandidate = null;

    const now = Date.now();
    const summary = engine.getSessionSummary(session, State.revision.progress, now);
    if (DOM.revSumReviewed) DOM.revSumReviewed.textContent = String(summary.reviewed);
    if (DOM.revSumAgain) DOM.revSumAgain.textContent = String(summary.counts.again);
    if (DOM.revSumHard) DOM.revSumHard.textContent = String(summary.counts.hard);
    if (DOM.revSumGood) DOM.revSumGood.textContent = String(summary.counts.good);
    if (DOM.revSumEasy) DOM.revSumEasy.textContent = String(summary.counts.easy);

    if (DOM.revSumRemaining) {
      DOM.revSumRemaining.textContent = summary.remainingDue > 0
        ? `${summary.remainingDue} item${summary.remainingDue === 1 ? '' : 's'} from this session are due again now.`
        : 'Nothing from this session is due again right now.';
    }
    if (DOM.revSumNext) {
      let nextMessage = '';
      if (summary.nextDueAt) nextMessage = `Next item returns ${formatRevisionWhen(summary.nextDueAt, now)}.`;
      const dashStats = engine.getModuleRevisionStats(currentRevisionItems(), State.revision.progress, now);
      if (dashStats.due > 0) {
        nextMessage = `${dashStats.due} item${dashStats.due === 1 ? '' : 's'} in this set are still due now.`;
      }
      DOM.revSumNext.textContent = nextMessage;
    }

    showRevisionPanel('summary');
    updateStats();
  }

  async function resetRevisionProgress() {
    const mod = State.currentModule;
    if (!mod) return;
    const title = mod.title || 'this set';
    if (!window.confirm(`Reset all revision progress for “${title}”? Ratings and scheduling for this set will be cleared. This cannot be undone.`)) {
      return;
    }
    try {
      if (window.OfflineStorage && window.OfflineStorage.resetRevisionProgress) {
        await window.OfflineStorage.resetRevisionProgress(mod.id);
      }
      if (window.OfflineStorage && window.OfflineStorage.deleteRevisionSession) {
        await window.OfflineStorage.deleteRevisionSession(mod.id);
      }
    } catch (e) {
      showToast('Revision progress could not be cleared on this device.');
    }
    State.revision.progress = {};
    State.revision.session = null;
    State.revision.resumeCandidate = null;
    State.revision.revealed = false;
    State.revision.viewingPrev = false;
    showToast('Revision progress reset for this set.');
    renderRevisionDashboard();
    showRevisionPanel('dashboard');
    updateStats();
  }

  // ==========================================================================
  // LIBRARY
  // ==========================================================================
  function startLibraryMode(mod, mode) {
    if (!mod) return;
    const questionCount = Array.isArray(mod.questions) ? mod.questions.length : 0;
    if (!questionCount && (mode === 'practice' || mode === 'test')) {
      setModule(mod);
      switchMode('revision');
      showToast('This set is revision-only because no question passed source verification.');
      return;
    }
    setModule(mod);
    switchMode(mode);
  }

  async function renderLibrary() {
    if (!DOM.libraryContainer) return;
    DOM.libraryContainer.innerHTML = '<p class="empty-state">Loading saved sets…</p>';

    let list = [];
    let attempts = [];
    let storageWarning = '';
    try {
      list = await window.OfflineStorage.getModules();
      if (window.OfflineStorage.getAttempts) attempts = await window.OfflineStorage.getAttempts();
    } catch (err) {
      storageWarning = 'Local storage is unavailable in this browser, so saved sets cannot be listed.';
    }

    list = Array.isArray(list) ? list : [];
    attempts = Array.isArray(attempts) ? attempts : [];
    list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const latestByModule = {};
    const countByModule = {};
    attempts.forEach((attempt) => {
      if (!attempt || !attempt.moduleId) return;
      countByModule[attempt.moduleId] = (countByModule[attempt.moduleId] || 0) + 1;
      if (!latestByModule[attempt.moduleId] || new Date(attempt.createdAt) > new Date(latestByModule[attempt.moduleId].createdAt)) {
        latestByModule[attempt.moduleId] = attempt;
      }
    });

    const displayList = list.slice();

    if (!displayList.length) {
      DOM.libraryContainer.innerHTML = '<div class="empty-state"><strong>No study sets yet.</strong><br>Add a PDF, note photo, or pasted notes to build your first offline set.</div>';
      return;
    }

    let html = '';
    if (storageWarning) {
      html += `<p class="library-warning" role="status">${escapeHtml(storageWarning)}</p>`;
    }

    displayList.forEach((mod) => {
      const last = latestByModule[mod.id];
      const attemptCount = countByModule[mod.id] || 0;
      const questionCount = Array.isArray(mod.questions) ? mod.questions.length : 0;
      const revisionOnly = questionCount === 0;
      const date = mod.createdAt ? new Date(mod.createdAt).toLocaleDateString() : '';
      const safeTitle = escapeHtml(mod.title || 'Untitled set');
      const scoreline = last
        ? `Last score ${Number(last.score).toFixed(2)}/${Number(last.max).toFixed(2)} · ${attemptCount} attempt${attemptCount === 1 ? '' : 's'}`
        : (revisionOnly ? 'Revision-only set · no verified MCQs' : 'Not attempted yet');

      html += `
        <article class="library-card${revisionOnly ? ' is-revision-only' : ''}">
          <div class="library-card-head">
            <div class="library-file-icon">${icon('picture_as_pdf')}</div>
            <div class="library-copy">
              <div class="library-title-row">
                <h3>${safeTitle}</h3>
                ${revisionOnly ? '<span class="library-badge">Revision only</span>' : ''}
              </div>
              <div class="library-meta">
                <span>${revisionOnly ? 'No verified MCQs' : `${questionCount} verified question${questionCount === 1 ? '' : 's'}`}</span>
                ${date ? `<span>${escapeHtml(date)}</span>` : ''}
              </div>
              <div class="library-history">${icon('history')}<span>${escapeHtml(scoreline)}</span></div>
            </div>
            <button class="lib-del" type="button" data-id="${escapeHtml(mod.id)}" aria-label="Delete ${safeTitle}">${icon('delete')}</button>
          </div>
          <div class="library-modes" role="group" aria-label="Study modes for ${safeTitle}">
            <button class="lib-mode lib-mode-practice" type="button" data-id="${escapeHtml(mod.id)}" data-action="practice" aria-label="Practice ${safeTitle}"${revisionOnly ? ' disabled aria-disabled="true"' : ''}>
              ${icon('lightbulb')}
              <span class="lib-mode-copy"><b>Practice</b><small>${revisionOnly ? 'No MCQs' : 'Feedback'}</small></span>
            </button>
            <button class="lib-mode lib-mode-revision" type="button" data-id="${escapeHtml(mod.id)}" data-action="revision" aria-label="Revise ${safeTitle}">
              ${icon('style')}
              <span class="lib-mode-copy"><b>Revision</b><small>Adaptive recall</small></span>
            </button>
            <button class="lib-mode lib-mode-test" type="button" data-id="${escapeHtml(mod.id)}" data-action="test" aria-label="Take an exam test on ${safeTitle}"${revisionOnly ? ' disabled aria-disabled="true"' : ''}>
              ${icon('timer')}
              <span class="lib-mode-copy"><b>Exam Test</b><small>${revisionOnly ? 'No MCQs' : 'Timed'}</small></span>
            </button>
          </div>
        </article>
      `;
    });

    DOM.libraryContainer.innerHTML = html;

    DOM.libraryContainer.querySelectorAll('.lib-mode').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');
        const target = displayList.find((m) => m.id === id);
        startLibraryMode(target, action);
      });
    });

    DOM.libraryContainer.querySelectorAll('.lib-del').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const target = displayList.find((m) => m.id === id);
        const title = target ? target.title : 'this set';
        if (!window.confirm(`Delete “${title}” from this device?`)) return;
        try {
          await window.OfflineStorage.deleteModule(id);
          if (State.currentModule && State.currentModule.id === id) {
            State.currentModule = null;
            State.revision.items = null;
            State.revision.itemsFor = null;
            State.revision.progress = {};
            State.revision.session = null;
            State.revision.resumeCandidate = null;
            State.revision.revealed = false;
            State.revision.viewingPrev = false;
          }
          renderLibrary();
          showToast('Study set deleted from local storage.');
        } catch (e) {
          showToast('The study set could not be deleted.');
        }
      });
    });
  }

  // ==========================================================================
  // FILE INGESTION
  // ==========================================================================
  async function processFile(file) {
    if (!file) return;
    const maxBytes = 60 * 1024 * 1024;
    if (file.size > maxBytes) {
      setFileStatus('This file is too large. Choose a file smaller than 60 MB.', 'error');
      showToast('File is too large to process safely.');
      return;
    }
    if (!Processing) {
      setFileStatus('Processing is unavailable. Reload the app and try again.', 'error');
      showToast('Processing is unavailable in this session.');
      return;
    }
    if (Processing.isBusy()) {
      processExpanded = true;
      openProcessingDialog();
      showToast('Another document is still being processed.');
      return;
    }

    setFileStatus(`Reading ${file.name} on this device…`, '');
    showToast('Processing file offline…');
    processExpanded = true;
    completedModule = null;
    const started = Processing.startImport({
      file: file,
      title: file.name.replace(/\.[^/.]+$/, ''),
      readFile: (source, onProgress, options) => window.OfflineDocParser.readFileContentDetailed(source, onProgress, options)
    });
    if (!started.accepted) {
      processExpanded = true;
      paintProcessing(started.job || Processing.getCurrent());
      showToast('Another document is still being processed.');
    }
  }

  // ==========================================================================
  // EVENTS
  // ==========================================================================
  function initEvents() {
    DOM.modeItems.forEach((btn) => {
      btn.addEventListener('click', () => switchMode(btn.getAttribute('data-mode')));
    });

    if (DOM.prevBtn) {
      DOM.prevBtn.addEventListener('click', () => {
        if (State.currentIndex > 0) {
          State.currentIndex--;
          renderQuestion();
          renderPalette();
        }
      });
    }

    if (DOM.nextBtn) {
      DOM.nextBtn.addEventListener('click', () => {
        const qList = activeQuestionList();
        if (State.currentIndex < qList.length - 1) {
          State.currentIndex++;
          renderQuestion();
          renderPalette();
        }
      });
    }

    if (DOM.submitBtn) DOM.submitBtn.addEventListener('click', submitTest);
    if (DOM.examSubmitBtn) DOM.examSubmitBtn.addEventListener('click', submitTest);

    if (DOM.testQuestionCount) {
      DOM.testQuestionCount.addEventListener('change', () => {
        State.testQuestionLimit = Number(DOM.testQuestionCount.value) || State.testQuestionLimit;
        updateTestTotalTime();
      });
    }
    if (DOM.testSecondsPerQuestion) {
      DOM.testSecondsPerQuestion.addEventListener('change', () => {
        State.testSecondsPerQuestion = Number(DOM.testSecondsPerQuestion.value) || State.testSecondsPerQuestion;
        updateTestTotalTime();
      });
    }
    if (DOM.testStartBtn) DOM.testStartBtn.addEventListener('click', startTest);

    if (DOM.markBtn) {
      DOM.markBtn.addEventListener('click', () => {
        if (!State.currentModule) return;
        const q = activeQuestionList()[State.currentIndex];
        if (!q) return;
        const nowBookmarked = window.OfflineStorage.toggleBookmark(q.id, q);
        DOM.markBtn.innerHTML = icon('star') + `<span class="bookmark-text">${nowBookmarked ? 'Bookmarked' : 'Bookmark'}</span>`;
        DOM.markBtn.setAttribute('aria-pressed', nowBookmarked ? 'true' : 'false');
        showToast(nowBookmarked ? 'Saved to bookmarks.' : 'Removed from bookmarks.');
      });
    }

    if (DOM.printBtn) DOM.printBtn.addEventListener('click', () => window.print());

    if (DOM.brandLogo) {
      DOM.brandLogo.addEventListener('click', () => switchMode('library'));
      DOM.brandLogo.setAttribute('role', 'button');
      DOM.brandLogo.setAttribute('tabindex', '0');
      DOM.brandLogo.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          switchMode('library');
        }
      });
    }

    if (DOM.libraryGenerateBtn) {
      DOM.libraryGenerateBtn.addEventListener('click', () => switchMode('generator'));
    }

    if (DOM.dropZone) {
      const openPicker = () => DOM.fileInput && DOM.fileInput.click();
      DOM.dropZone.addEventListener('click', openPicker);
      DOM.dropZone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openPicker();
        }
      });
      DOM.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        DOM.dropZone.classList.add('dragover');
      });
      DOM.dropZone.addEventListener('dragleave', () => DOM.dropZone.classList.remove('dragover'));
      DOM.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        DOM.dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) processFile(e.dataTransfer.files[0]);
      });
    }

    if (DOM.fileInput) {
      DOM.fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length) {
          processFile(e.target.files[0]);
          e.target.value = '';
        }
      });
    }

    if (DOM.chipDemoSpm) {
      DOM.chipDemoSpm.addEventListener('click', () => {
        State.sourceMeta = null;
        DOM.docText.value = window.StudySamples.newspaper_2026;
        DOM.docTitle.value = 'SPM IAS Academy — 19 Oct 2026';
        handleGenerate();
      });
    }

    if (DOM.chipDemoScience) {
      DOM.chipDemoScience.addEventListener('click', () => {
        State.sourceMeta = null;
        DOM.docText.value = window.StudySamples.science_space;
        DOM.docTitle.value = 'Chandrayaan-3 Mission Notes';
        handleGenerate();
      });
    }

    if (DOM.generateBtn) DOM.generateBtn.addEventListener('click', handleGenerate);

    if (DOM.revStartBtn) DOM.revStartBtn.addEventListener('click', startRevisionSession);
    if (DOM.revResumeBtn) DOM.revResumeBtn.addEventListener('click', resumeRevisionSession);
    if (DOM.revResetBtn) DOM.revResetBtn.addEventListener('click', resetRevisionProgress);
    if (DOM.revRevealBtn) DOM.revRevealBtn.addEventListener('click', revealRevisionAnswer);
    if (DOM.revPauseBtn) DOM.revPauseBtn.addEventListener('click', pauseRevisionSession);
    if (DOM.revPrevBtn) DOM.revPrevBtn.addEventListener('click', viewPreviousRevisionCard);
    if (DOM.revBackBtn) DOM.revBackBtn.addEventListener('click', returnToCurrentRevisionCard);
    if (DOM.revEvidenceToggle) DOM.revEvidenceToggle.addEventListener('click', toggleRevisionEvidence);
    if (DOM.revSummaryDoneBtn) DOM.revSummaryDoneBtn.addEventListener('click', () => {
      State.revision.session = null;
      renderRevisionDashboard();
      showRevisionPanel('dashboard');
      updateStats();
    });
    if (DOM.revRatings) {
      DOM.revRatings.querySelectorAll('[data-rating]').forEach((btn) => {
        btn.addEventListener('click', () => rateRevision(btn.getAttribute('data-rating')));
      });
    }

    if (DOM.scoreCloseBtn) DOM.scoreCloseBtn.addEventListener('click', closeScorecard);
    if (DOM.scoreReviewBtn) DOM.scoreReviewBtn.addEventListener('click', reviewAnswers);
    if (DOM.scoreRetakeBtn) DOM.scoreRetakeBtn.addEventListener('click', retakeTest);
    if (DOM.scoreModal) {
      DOM.scoreModal.addEventListener('click', (e) => {
        if (e.target === DOM.scoreModal) closeScorecard();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (DOM.processModal && DOM.processModal.classList.contains('open')) {
          closeProcessingDialog();
        } else if (DOM.scoreModal && DOM.scoreModal.classList.contains('open')) {
          closeScorecard();
        } else if (State.navOpen) {
          setNavOpen(false, { returnFocus: true });
        }
        return;
      }
      if (State.activeMode !== 'revision') return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const session = State.revision.session;
      if (!session || session.completed) return;
      if (e.key === ' ' || e.key === 'Enter') {
        if (!State.revision.revealed && !State.revision.viewingPrev) {
          e.preventDefault();
          revealRevisionAnswer();
        }
        return;
      }
      if (State.revision.revealed && !State.revision.viewingPrev) {
        const key = (e.key || '').toLowerCase();
        const map = { '1': 'again', '2': 'hard', '3': 'good', '4': 'easy' };
        if (map[key]) {
          e.preventDefault();
          rateRevision(map[key]);
        }
      }
    });

    window.addEventListener('beforeunload', (e) => {
      if (State.activeMode === 'test' && State.testStarted && !State.testSubmitted) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  // ==========================================================================
  // STARTUP
  // ==========================================================================
  function initApp() {
    initDOM();
    initNavigation();
    initInstallHandlers();
    initNetworkStatus();
    initTheme();
    registerServiceWorker();
    initEvents();
    initProcessing();
    switchMode('library');
    requestPersistentStorage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
