/**
 * StudySynth — Client Application Controller
 * Adaptive, offline-first workspace for phones, tablets, and desktops.
 */

(function () {
  'use strict';

  const MODE_LABELS = {
    practice: 'Practice Mode',
    test: 'Exam Test (Timed)',
    revision: 'Revision Flashcards',
    generator: 'Generator',
    library: 'Offline Library'
  };

  const MARKS_CORRECT = 2;
  const MARKS_WRONG = 0.66;

  const State = {
    activeMode: 'library',
    currentModule: null,
    starterModule: null,
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
    cardIdx: 0,
    cardFlipped: false,
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

    DOM.flashcardBox = document.getElementById('flashcardBox');
    DOM.flashcardCount = document.getElementById('flashcardCount');
    DOM.prevCardBtn = document.getElementById('prevCardBtn');
    DOM.nextCardBtn = document.getElementById('nextCardBtn');

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
      markInstalled('On device');
      // window.print() is a no-op inside an Android WebView.
      if (DOM.printBtn) DOM.printBtn.hidden = true;
      if (DOM.installBadge) {
        DOM.installBadge.addEventListener('click', () => showToast('This is the installed StudySynth app. It works fully offline.'));
      }
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
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#121826' : '#3943d3');
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
    const activeQuestionCount = State.currentModule && Array.isArray(State.currentModule.questions)
      ? State.currentModule.questions.length
      : 0;
    if ((mode === 'practice' || mode === 'test') && State.currentModule && activeQuestionCount === 0) {
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
      renderFlashcard();
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
  function analyzeSource(rawText, title, sourceMeta, targetCount) {
    return window.StudySynthAnalysis.analyzeSource(rawText, title, sourceMeta, targetCount);
  }

  function buildModule(rawText, title) {
    const analyzed = analyzeSource(rawText, title, null, 10);
    if (analyzed.generationError) throw analyzed.generationError;
    return {
      id: 'mod_initial',
      title: title,
      createdAt: new Date().toISOString(),
      durationMs: 45,
      sectionsCount: analyzed.sections.length,
      inventory: analyzed.inventory,
      questions: analyzed.questions,
      validation: analyzed.validation,
      generation: analyzed.generation
    };
  }

  function loadInitialModule() {
    try {
      const raw = window.StudySamples ? window.StudySamples.newspaper_2026 : '';
      const title = 'SPM IAS Academy — 19 Oct 2026';
      const module = buildModule(raw, title);
      if (!module.questions.length) throw new Error('No questions could be generated from the starter notes.');
      module.id = 'mod_starter_spm_2026';
      module.bundled = true;
      State.starterModule = module;
      setModule(module);
    } catch (err) {
      if (DOM.qContainer) {
        DOM.qContainer.innerHTML = '<div class="empty-state">The starter quiz could not be generated. Open the Generator to load your own notes.</div>';
      }
      console.error('StudySynth starter module failed:', err);
    }
  }

  function setModule(mod) {
    State.currentModule = mod;
    resetExamState();
    State.currentIndex = 0;
    State.practiceAnswers = {};
    State.practiceRevealed = false;
    State.cardIdx = 0;
    State.cardFlipped = false;
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
      renderFlashcard();
      return;
    }
    renderQuestion();
    renderPalette();
    renderFlashcard();
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
  // FLASHCARDS
  // ==========================================================================
  function renderFlashcard() {
    if (!DOM.flashcardBox || !State.currentModule) return;
    const units = State.currentModule.inventory || [];
    if (!units.length) {
      DOM.flashcardBox.innerHTML = '<p class="empty-state">No knowledge units available in this module.</p>';
      if (DOM.flashcardCount) DOM.flashcardCount.textContent = 'Card 0 of 0';
      return;
    }

    if (State.cardIdx >= units.length) State.cardIdx = 0;
    const unit = units[State.cardIdx];
    if (DOM.flashcardCount) {
      DOM.flashcardCount.textContent = `Card ${State.cardIdx + 1} of ${units.length}`;
    }

    if (!State.cardFlipped) {
      DOM.flashcardBox.innerHTML = `
        <span class="flashcard-kicker">${escapeHtml(unit.section_title || 'Knowledge unit')}</span>
        <h3 class="flashcard-title">${escapeHtml(unit.anchor || 'Core fact')}</h3>
        <p class="flashcard-prompt">Tap card to reveal verified explanation</p>
      `;
      DOM.flashcardBox.setAttribute('aria-label', 'Flashcard front. Activate to reveal the answer.');
    } else {
      DOM.flashcardBox.innerHTML = `
        <span class="flashcard-kicker is-revealed">Knowledge unit ${escapeHtml(unit.ku_id || '')}</span>
        <p class="flashcard-answer">${escapeHtml(unit.statement || '')}</p>
        <div class="flashcard-source">Source page: ${escapeHtml(unit.source_page || 'n/a')}</div>
      `;
      DOM.flashcardBox.setAttribute('aria-label', 'Flashcard answer. Activate to hide the answer.');
    }

    DOM.flashcardBox.onclick = () => {
      State.cardFlipped = !State.cardFlipped;
      renderFlashcard();
    };
  }

  function moveCard(delta) {
    const total = State.currentModule ? (State.currentModule.inventory || []).length : 0;
    if (!total) return;
    State.cardIdx = (State.cardIdx + delta + total) % total;
    State.cardFlipped = false;
    renderFlashcard();
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
      storageWarning = 'Local storage is unavailable in this browser. The bundled starter still works for this session.';
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

    const displayList = [];
    if (State.starterModule && !list.some((mod) => mod.id === State.starterModule.id)) {
      displayList.push(State.starterModule);
    }
    displayList.push(...list);

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
      const date = mod.createdAt ? new Date(mod.createdAt).toLocaleDateString() : 'Bundled';
      const safeTitle = escapeHtml(mod.title || 'Untitled set');
      const scoreline = last
        ? `Last score ${Number(last.score).toFixed(2)}/${Number(last.max).toFixed(2)} · ${attemptCount} attempt${attemptCount === 1 ? '' : 's'}`
        : (revisionOnly ? 'Revision-only set · no verified MCQs' : 'Not attempted yet');
      const bundled = !!mod.bundled;

      html += `
        <article class="library-card${bundled ? ' is-starter' : ''}${revisionOnly ? ' is-revision-only' : ''}">
          <div class="library-card-head">
            <div class="library-file-icon">${icon('picture_as_pdf')}</div>
            <div class="library-copy">
              <div class="library-title-row">
                <h3>${safeTitle}</h3>
                ${bundled ? '<span class="library-badge">Starter set</span>' : (revisionOnly ? '<span class="library-badge">Revision only</span>' : '')}
              </div>
              <div class="library-meta">
                <span>${revisionOnly ? 'No verified MCQs' : `${questionCount} verified question${questionCount === 1 ? '' : 's'}`}</span>
                <span>${escapeHtml(date)}</span>
              </div>
              <div class="library-history">${icon('history')}<span>${escapeHtml(scoreline)}</span></div>
            </div>
            ${bundled ? '' : `<button class="lib-del" type="button" data-id="${escapeHtml(mod.id)}" aria-label="Delete ${safeTitle}">${icon('delete')}</button>`}
          </div>
          <div class="library-modes" role="group" aria-label="Study modes for ${safeTitle}">
            <button class="lib-mode lib-mode-practice" type="button" data-id="${escapeHtml(mod.id)}" data-action="practice" aria-label="Practice ${safeTitle}"${revisionOnly ? ' disabled aria-disabled="true"' : ''}>
              ${icon('lightbulb')}
              <span class="lib-mode-copy"><b>Practice</b><small>${revisionOnly ? 'No MCQs' : 'Feedback'}</small></span>
            </button>
            <button class="lib-mode lib-mode-revision" type="button" data-id="${escapeHtml(mod.id)}" data-action="revision" aria-label="Revise ${safeTitle}">
              ${icon('style')}
              <span class="lib-mode-copy"><b>Revision</b><small>Flashcards</small></span>
            </button>
            <button class="lib-mode lib-mode-test" type="button" data-id="${escapeHtml(mod.id)}" data-action="test" aria-label="Take an exam test on ${safeTitle}"${revisionOnly ? ' disabled aria-disabled="true"' : ''}>
              ${icon('timer')}
              <span class="lib-mode-copy"><b>Exam Test</b><small>${revisionOnly ? 'No MCQs' : 'Timed'}</small></span>
            </button>
          </div>
        </article>
      `;
    });

    if (!list.length) {
      html += '<p class="library-hint">Your own PDFs and notes will appear here after you generate a set. The bundled starter is always available.</p>';
    }

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

    if (DOM.prevCardBtn) DOM.prevCardBtn.addEventListener('click', () => moveCard(-1));
    if (DOM.nextCardBtn) DOM.nextCardBtn.addEventListener('click', () => moveCard(1));

    if (DOM.flashcardBox) {
      DOM.flashcardBox.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          State.cardFlipped = !State.cardFlipped;
          renderFlashcard();
        }
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
      if (e.key !== 'Escape') return;
      if (DOM.processModal && DOM.processModal.classList.contains('open')) {
        closeProcessingDialog();
      } else if (DOM.scoreModal && DOM.scoreModal.classList.contains('open')) {
        closeScorecard();
      } else if (State.navOpen) {
        setNavOpen(false, { returnFocus: true });
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
    loadInitialModule();
    switchMode('library');
    requestPersistentStorage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
