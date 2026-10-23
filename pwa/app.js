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

  function answeredCount(answers) {
    const qList = State.currentModule && Array.isArray(State.currentModule.questions)
      ? State.currentModule.questions
      : [];
    return qList.reduce((count, q) => count + (answers && answers[q.id] ? 1 : 0), 0);
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
        startTimer(true);
      } else {
        startTimer(false);
      }
    }
    // An active exam keeps its timer and answers if the learner checks notes
    // or revision. Submitting remains the only way to end the timed session.

    if (mode === 'revision') {
      renderFlashcard();
    } else if (mode === 'library') {
      renderLibrary();
    } else if (isQuiz) {
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
  // EXAM TIMER
  // ==========================================================================
  function startTimer(reset) {
    if (reset) {
      State.timerSeconds = 0;
      State.testStartedAt = Date.now();
    }
    if (!State.testStartedAt) State.testStartedAt = Date.now();
    State.testStarted = true;
    updateTimerDisplay();

    if (!State.timerInterval) {
      State.timerInterval = setInterval(() => {
        State.timerSeconds = Math.floor((Date.now() - State.testStartedAt) / 1000);
        updateTimerDisplay();
      }, 1000);
    }
  }

  function stopTimer() {
    if (State.timerInterval) {
      clearInterval(State.timerInterval);
      State.timerInterval = null;
    }
  }

  function updateTimerDisplay() {
    if (DOM.examTimer) DOM.examTimer.textContent = formatTime(State.timerSeconds);
  }

  function resetExamState() {
    stopTimer();
    State.testStarted = false;
    State.testSubmitted = false;
    State.testStartedAt = 0;
    State.timerSeconds = 0;
    State.testAnswers = {};
    updateTimerDisplay();
  }

  // ==========================================================================
  // MODULE LOADING
  // ==========================================================================
  function analyzeSource(rawText, title, sourceMeta, targetCount) {
    const E = window.StudySynthEngine;
    const sections = E.parseRawDocument(rawText, title);
    const extracted = E.extractSourceFacts(sections, { sourceMeta: sourceMeta });
    const conflictResult = E.detectFactConflicts(extracted);
    const inventory = E.buildKnowledgeInventory(sections, {
      facts: conflictResult.facts,
      conflicts: conflictResult.conflicts,
      sourceMeta: sourceMeta
    });
    const context = {
      sections: sections,
      facts: conflictResult.facts,
      conflicts: conflictResult.conflicts
    };
    let questions = [];
    let generationError = null;
    try {
      questions = E.generateQuestionBank(inventory, Object.assign({
        targetCount: targetCount || 15,
        sourceMeta: sourceMeta
      }, context));
    } catch (err) {
      generationError = err;
      questions = [];
    }
    const generation = questions.generation || (generationError && generationError.metrics) || null;
    const validation = E.validateQuestionBank(questions, Object.assign({
      candidateCount: generation ? generation.totalCandidates : 0,
      rejectionCounts: generation ? generation.rejectionCounts : {}
    }, context));
    return {
      sections,
      facts: conflictResult.facts,
      conflicts: conflictResult.conflicts,
      inventory,
      questions,
      generation,
      generationError,
      validation
    };
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
    if (!State.currentModule || !Array.isArray(State.currentModule.questions)) return;
    const qList = State.currentModule.questions;
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
  function computeScore(answers) {
    const qList = State.currentModule && Array.isArray(State.currentModule.questions)
      ? State.currentModule.questions
      : [];
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
    const total = State.currentModule.questions.length;
    DOM.examAnswered.textContent = `${answeredCount(State.testAnswers)}/${total} answered`;
  }

  function updateStats() {
    if (!State.currentModule) return;
    const resultsHidden = State.activeMode === 'test' && !State.testSubmitted;
    const total = State.currentModule.questions.length;

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
    const qList = State.currentModule.questions;
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

    if (State.testSubmitted) return;

    State.testSubmitted = true;
    stopTimer();
    State.timerSeconds = State.testStartedAt ? Math.floor((Date.now() - State.testStartedAt) / 1000) : 0;
    updateTimerDisplay();
    renderQuestion();
    renderPalette();
    updateStats();

    const result = computeScore(State.testAnswers);
    State.lastResult = result;
    saveAttempt(result);

    openScorecard(result);
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
    const qList = State.currentModule.questions;
    let target = qList.findIndex((q) => {
      const answer = State.testAnswers[q.id];
      return !answer || answer !== q.answer_key;
    });
    if (target < 0) target = 0;
    State.currentIndex = target;
    switchMode('test');
    renderQuestion();
    renderPalette();
    showToast('Use the previous and next controls to review every answer.');
  }

  function retakeTest() {
    if (!State.currentModule) return;
    State.testAnswers = {};
    State.currentIndex = 0;
    State.testSubmitted = false;
    State.testStarted = false;
    State.timerSeconds = 0;
    State.testStartedAt = 0;
    stopTimer();
    closeScorecard();
    switchMode('test');
    startTimer(true);
    renderQuestion();
    renderPalette();
    updateStats();
    showToast('Fresh test started. Timer reset to 00:00.');
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

    if (DOM.generateBtn) {
      DOM.generateBtn.disabled = true;
      const label = DOM.generateBtn.querySelector('.generate-label');
      if (label) label.textContent = 'Generating locally…';
      else DOM.generateBtn.textContent = 'Generating locally…';
    }
    setFileStatus('Extracting source facts and verifying candidates…', '');

    const startTime = performance.now();
    let analyzed = null;
    try {
      analyzed = analyzeSource(text, title, sourceMeta, 15);
      const durationMs = Math.max(1, Math.round(performance.now() - startTime));
      if (!analyzed.inventory.length) {
        throw new Error('No structured knowledge units were found. Try a longer passage with complete sentences.');
      }
      if (analyzed.generationError) throw analyzed.generationError;
      if (!analyzed.validation.valid) {
        throw new Error('Generated questions failed final source verification, so nothing was saved. Add clearer source text and try again.');
      }

      const questions = analyzed.questions;
      const validation = analyzed.validation;
      const rejected = validation.rejected || 0;
      const rejectionSummary = Object.keys(validation.rejectionCounts || {})
        .filter((key) => Number(validation.rejectionCounts[key]) > 0)
        .map((key) => `${key.replace(/_/g, ' ')} (${validation.rejectionCounts[key]})`)
        .slice(0, 4)
        .join(', ');

      const newMod = {
        id: 'mod_' + Date.now(),
        title: title,
        createdAt: new Date().toISOString(),
        durationMs: durationMs,
        sectionsCount: analyzed.sections.length,
        inventory: analyzed.inventory,
        questions: questions,
        validation: validation,
        generation: analyzed.generation,
        sourceMeta: sourceMeta ? {
          origin: sourceMeta.origin,
          confidence: sourceMeta.confidence,
          lowConfidence: !!sourceMeta.lowConfidence,
          confirmed: !!sourceMeta.confirmed,
          edited: !!sourceMeta.edited
        } : null
      };

      let saved = true;
      try {
        await window.OfflineStorage.saveModule(newMod);
      } catch (storageErr) {
        saved = false;
        console.warn('Module could not be saved to the library:', storageErr);
      }

      setModule(newMod);
      switchMode('library');
      await renderLibrary();
      const skipNote = rejected > 0 ? ` ${rejected} candidate${rejected === 1 ? '' : 's'} skipped.` : '';
      const reasonNote = rejectionSummary ? ` Reasons: ${rejectionSummary}.` : '';
      setFileStatus(`Ready · ${questions.length} verified question${questions.length === 1 ? '' : 's'} from ${analyzed.inventory.length} knowledge unit${analyzed.inventory.length === 1 ? '' : 's'} in ${durationMs} ms.${skipNote}${reasonNote}`, 'ok');
      showToast(saved
        ? `Saved “${title}”. ${questions.length} verified question${questions.length === 1 ? '' : 's'} available.`
        : `Generated “${title}”, but the library could not save it.`);
    } catch (err) {
      if (err && err.code === 'NO_VERIFIED_QUESTIONS' && analyzed && analyzed.inventory.length) {
        try {
          const result = analyzed;
          const revisionOnly = {
            id: 'mod_' + Date.now(),
            title: title,
            createdAt: new Date().toISOString(),
            durationMs: Math.max(1, Math.round(performance.now() - startTime)),
            sectionsCount: result.sections.length,
            inventory: result.inventory,
            questions: [],
            validation: result.validation,
            generation: result.generation,
            revisionOnly: true,
            sourceMeta: sourceMeta ? {
              origin: sourceMeta.origin,
              confidence: sourceMeta.confidence,
              lowConfidence: !!sourceMeta.lowConfidence,
              confirmed: !!sourceMeta.confirmed,
              edited: !!sourceMeta.edited
            } : null
          };
          let saved = true;
          try {
            await window.OfflineStorage.saveModule(revisionOnly);
          } catch (storageErr) {
            saved = false;
          }
          setModule(revisionOnly);
          switchMode('library');
          await renderLibrary();
          setFileStatus(`Revision only · no MCQ passed source verification. ${err.message}${saved ? ' The knowledge units were saved for revision.' : ' Storage was unavailable, so the revision set was not saved.'}`, 'error');
          showToast(saved
            ? 'Saved for revision only. No verified MCQs were published.'
            : 'Created a revision-only set, but the library could not save it. No verified MCQs were published.');
          return;
        } catch (revisionErr) {
          // Fall through to the original failure path.
        }
      }
      setFileStatus(err.message || 'Generation failed.', 'error');
      showToast(err.message || 'Generation failed.');
    } finally {
      if (DOM.generateBtn) {
        DOM.generateBtn.disabled = false;
        const label = DOM.generateBtn.querySelector('.generate-label');
        if (label) label.textContent = 'Generate Offline Quiz & Study Package';
        else DOM.generateBtn.textContent = 'Generate Offline Quiz & Study Package';
      }
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

    setFileStatus(`Reading ${file.name} on this device…`, '');
    showToast('Processing file offline…');

    try {
      const onProgress = (progress) => {
        if (progress && typeof progress.progress === 'number') {
          setFileStatus(`${progress.status || 'Recognising text'} · ${Math.round(progress.progress * 100)}%`, '');
        }
      };
      const detailed = window.OfflineDocParser.readFileContentDetailed
        ? await window.OfflineDocParser.readFileContentDetailed(file, onProgress)
        : { text: await window.OfflineDocParser.readFileContent(file, onProgress), origin: 'text', confidence: null };
      const text = detailed && detailed.text ? detailed.text : '';

      if (!text || text.trim().length < 25) {
        throw new Error('No readable text was found. For scanned PDFs, try a clear photo of each page instead.');
      }

      DOM.docText.value = text;
      DOM.docTitle.value = file.name.replace(/\.[^/.]+$/, '');
      const lowConfidence = detailed.origin === 'ocr' && (!Number.isFinite(detailed.confidence) || detailed.confidence < 90);
      State.sourceMeta = {
        origin: detailed.origin || 'text',
        confidence: detailed.confidence,
        lowConfidence: lowConfidence,
        confirmed: !lowConfidence,
        edited: false,
        originalText: text
      };
      if (lowConfidence) {
        const confirmed = window.confirm(
          `On-device OCR confidence is ${Math.round(detailed.confidence)}%. ` +
          'Review the extracted text carefully and correct any errors. ' +
          'Do you want to use this text as-is? Choose Cancel to keep it for editing without generating yet.'
        );
        State.sourceMeta.confirmed = confirmed;
        if (confirmed) {
          setFileStatus(`Loaded ${file.name} · OCR confidence ${Math.round(detailed.confidence)}% · you confirmed the text as-is.`, 'error');
          showToast('Low-confidence OCR loaded after confirmation. Check the text carefully.');
        } else {
          setFileStatus(`Loaded ${file.name} · OCR confidence ${Math.round(detailed.confidence)}%. Correct the text before generating; generation is blocked until you do.`, 'error');
          showToast('Review and correct the OCR text before generating.');
        }
      } else {
        setFileStatus(`Loaded ${file.name} · ${text.length.toLocaleString()} characters extracted locally.`, 'ok');
        showToast(`Loaded ${file.name}.`);
      }
    } catch (err) {
      const message = err && err.message ? err.message : 'This file could not be read.';
      setFileStatus(message, 'error');
      showToast(message);
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
        const qList = State.currentModule ? State.currentModule.questions : [];
        if (State.currentIndex < qList.length - 1) {
          State.currentIndex++;
          renderQuestion();
          renderPalette();
        }
      });
    }

    if (DOM.submitBtn) DOM.submitBtn.addEventListener('click', submitTest);
    if (DOM.examSubmitBtn) DOM.examSubmitBtn.addEventListener('click', submitTest);

    if (DOM.markBtn) {
      DOM.markBtn.addEventListener('click', () => {
        if (!State.currentModule) return;
        const q = State.currentModule.questions[State.currentIndex];
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
      if (DOM.scoreModal && DOM.scoreModal.classList.contains('open')) {
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
