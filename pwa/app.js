/**
 * StudySynth — Client Application Controller (Adaptive Template & Install Gate)
 * Manages standalone PWA lifecycle, offline question generation, and original UI template state.
 */

(function () {
  'use strict';

  // State Management
  const State = {
    activeMode: 'practice', // 'practice', 'test', 'revision', 'generator', 'library'
    currentModule: null,
    currentIndex: 0,
    userAnswers: {},
    timerSeconds: 0,
    timerInterval: null,
    testSubmitted: false,
    deferredInstallPrompt: null
  };

  // DOM Cache
  const DOM = {};

  function initDOM() {
    DOM.appShell = document.getElementById('appShell');
    DOM.installBadge = document.getElementById('installBadge');

    // Topbar
    DOM.brandLogo = document.getElementById('brandLogo');
    DOM.setTitle = document.getElementById('setTitle');
    DOM.setTopic = document.getElementById('setTopic');
    DOM.progNum = document.getElementById('progNum');
    DOM.progBar = document.getElementById('progBar');
    DOM.progPct = document.getElementById('progPct');
    DOM.themeToggle = document.getElementById('themeToggle');
    DOM.printBtn = document.getElementById('printBtn');

    // Rail & Modes
    DOM.modeItems = document.querySelectorAll('.mode-item');
    DOM.railAcc = document.getElementById('railAcc');
    DOM.railBar = document.getElementById('railBar');
    DOM.railSub = document.getElementById('railSub');

    // Views
    DOM.quizView = document.getElementById('quizView');
    DOM.generatorView = document.getElementById('generatorView');
    DOM.revisionView = document.getElementById('revisionView');
    DOM.libraryView = document.getElementById('libraryView');

    // Question Sheet
    DOM.sheetNum = document.getElementById('sheetNum');
    DOM.sheetModeLabel = document.getElementById('sheetModeLabel');
    DOM.sheetContext = document.getElementById('sheetContext');
    DOM.markBtn = document.getElementById('markBtn');
    DOM.examTimer = document.getElementById('examTimer');
    DOM.qContainer = document.getElementById('questionContainer');
    DOM.prevBtn = document.getElementById('prevBtn');
    DOM.nextBtn = document.getElementById('nextBtn');
    DOM.submitBtn = document.getElementById('submitBtn');

    // Livebar
    DOM.liveAccNum = document.getElementById('liveAccNum');
    DOM.statCorrect = document.getElementById('statCorrect');
    DOM.statWrong = document.getElementById('statWrong');
    DOM.livePalette = document.getElementById('livePalette');

    // Generator
    DOM.dropZone = document.getElementById('dropZone');
    DOM.fileInput = document.getElementById('fileInput');
    DOM.docTitle = document.getElementById('docTitle');
    DOM.docText = document.getElementById('docText');
    DOM.chipDemoSpm = document.getElementById('chipDemoSpm');
    DOM.chipDemoScience = document.getElementById('chipDemoScience');
    DOM.generateBtn = document.getElementById('generateBtn');

    // Flashcards
    DOM.flashcardBox = document.getElementById('flashcardBox');
    DOM.flashcardCount = document.getElementById('flashcardCount');
    DOM.prevCardBtn = document.getElementById('prevCardBtn');
    DOM.nextCardBtn = document.getElementById('nextCardBtn');

    // Library
    DOM.libraryContainer = document.getElementById('libraryContainer');
    DOM.toast = document.getElementById('toast');
  }

  // Toast Helper
  function showToast(msg) {
    if (!DOM.toast) return;
    DOM.toast.textContent = msg;
    DOM.toast.classList.add('show');
    setTimeout(() => DOM.toast.classList.remove('show'), 2600);
  }

  // ==========================================================================
  // INSTALLATION BADGE & PWA LIFECYCLE
  // ==========================================================================
  function isStandalone() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'standalone' || params.get('standalone') === '1') return true;
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
    if (window.matchMedia('(display-mode: minimal-ui)').matches) return true;
    if (window.navigator.standalone === true) return true;
    if (document.referrer.includes('android-app://')) return true;
    return false;
  }

  function initInstallHandlers() {
    if (DOM.installBadge && isStandalone()) {
      DOM.installBadge.innerHTML = '<span>✓ Installed</span>';
      DOM.installBadge.classList.add('installed');
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      State.deferredInstallPrompt = e;
    });

    if (DOM.installBadge) {
      DOM.installBadge.addEventListener('click', async () => {
        if (isStandalone()) {
          showToast('StudySynth is already installed & running offline.');
          return;
        }

        if (State.deferredInstallPrompt) {
          State.deferredInstallPrompt.prompt();
          const { outcome } = await State.deferredInstallPrompt.userChoice;
          if (outcome === 'accepted') {
            State.deferredInstallPrompt = null;
            DOM.installBadge.innerHTML = '<span>✓ Installed</span>';
            DOM.installBadge.classList.add('installed');
            showToast('StudySynth installed successfully!');
          }
        } else {
          showToast('To install: Tap browser menu (⋮) -> "Install App" or "Add to Home Screen"');
        }
      });
    }
  }

  // Service Worker Registration
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => console.log('StudySynth ServiceWorker registered:', reg.scope))
          .catch((err) => console.warn('ServiceWorker registration error:', err));
      });
    }
  }

  // Theme Toggle
  function initTheme() {
    const saved = localStorage.getItem('studysynth_theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    if (DOM.themeToggle) {
      DOM.themeToggle.textContent = saved === 'dark' ? '☀️' : '🌙';
      DOM.themeToggle.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme') || 'light';
        const next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('studysynth_theme', next);
        DOM.themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
      });
    }
  }

  // Mode Switcher
  function switchMode(mode) {
    State.activeMode = mode;
    document.body.setAttribute('data-mode', mode);

    DOM.modeItems.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
    });

    DOM.quizView.style.display = (mode === 'practice' || mode === 'test') ? 'flex' : 'none';
    DOM.generatorView.style.display = mode === 'generator' ? 'block' : 'none';
    DOM.revisionView.style.display = mode === 'revision' ? 'flex' : 'none';
    DOM.libraryView.style.display = mode === 'library' ? 'block' : 'none';

    if (DOM.sheetModeLabel) {
      DOM.sheetModeLabel.textContent = mode === 'test' ? 'Exam Test (Timed)' : 'Practice Mode';
    }

    if (mode === 'test' && !State.testSubmitted && !State.timerInterval) {
      startTimer();
    } else if (mode === 'practice') {
      stopTimer();
    }

    if (mode === 'revision') {
      renderFlashcard();
    } else if (mode === 'library') {
      renderLibrary();
    } else if (mode === 'practice' || mode === 'test') {
      renderQuestion();
    }
  }

  // Timer
  function startTimer() {
    State.timerSeconds = 0;
    updateTimerDisplay();
    State.timerInterval = setInterval(() => {
      State.timerSeconds++;
      updateTimerDisplay();
    }, 1000);
  }

  function stopTimer() {
    if (State.timerInterval) {
      clearInterval(State.timerInterval);
      State.timerInterval = null;
    }
  }

  function updateTimerDisplay() {
    if (!DOM.examTimer) return;
    const m = Math.floor(State.timerSeconds / 60);
    const s = State.timerSeconds % 60;
    DOM.examTimer.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // Module Loading & Default Data Initialization
  function loadInitialModule() {
    const raw = window.StudySamples ? window.StudySamples.newspaper_2026 : '';
    const title = 'SPM IAS Academy — 19 Oct 2026';
    const sections = window.StudySynthEngine.parseRawDocument(raw, title);
    const inventory = window.StudySynthEngine.buildKnowledgeInventory(sections);
    const questions = window.StudySynthEngine.generateQuestionBank(inventory, { targetCount: 10 });
    const val = window.StudySynthEngine.validateQuestionBank(questions);

    const initialMod = {
      id: 'mod_initial',
      title: title,
      createdAt: new Date().toISOString(),
      durationMs: 45,
      sectionsCount: sections.length,
      inventory: inventory,
      questions: questions,
      validation: val
    };

    setModule(initialMod);
  }

  function setModule(mod) {
    State.currentModule = mod;
    State.currentIndex = 0;
    State.userAnswers = {};
    State.testSubmitted = false;

    if (DOM.setTitle) DOM.setTitle.textContent = `${mod.questions.length} QUESTIONS`;
    if (DOM.setTopic) DOM.setTopic.textContent = mod.title;

    updateStats();
    renderQuestion();
    renderPalette();
  }

  // Render Current Question Sheet
  function renderQuestion() {
    if (!State.currentModule || !State.currentModule.questions) return;
    const qList = State.currentModule.questions;
    const q = qList[State.currentIndex];
    if (!q) return;

    // Header updates
    if (DOM.sheetNum) DOM.sheetNum.textContent = `Q ${String(State.currentIndex + 1).padStart(2, '0')}`;
    if (DOM.sheetContext) DOM.sheetContext.textContent = q.source_title || 'General Studies';
    if (DOM.progNum) DOM.progNum.textContent = `${State.currentIndex + 1}/${qList.length}`;
    const pct = Math.round(((State.currentIndex + 1) / qList.length) * 100);
    if (DOM.progBar) DOM.progBar.style.width = `${pct}%`;
    if (DOM.progPct) DOM.progPct.textContent = `${pct}%`;

    const isBookmarked = !!window.OfflineStorage.getBookmarks()[q.id];
    if (DOM.markBtn) DOM.markBtn.textContent = isBookmarked ? '★ Bookmarked' : '☆ Bookmark';

    let html = `
      <div class="q-context">${q.cognitive_level || 'RECALL'} <span class="sep">/</span> ${q.source_title || 'SOURCE'}</div>
      <h2 class="q-stem">${q.stem}</h2>
    `;

    // Multi-statement block
    if (q.type === 'multi_statement' && q.statements) {
      html += `
        <div class="stmt-block">
          <div class="stmt-kicker">Statements for Evaluation</div>
          <ul class="stmt-list">
            ${q.statements.map(s => `<li><span class="stmt-n">${s.number}</span><span>${s.text}</span></li>`).join('')}
          </ul>
          <div class="stmt-closer">${q.prompt_suffix || 'Which of the statements given above is/are correct?'}</div>
        </div>
      `;
    }

    const selectedKey = State.userAnswers[q.id];
    const isPractice = State.activeMode === 'practice';
    const showFeedback = (isPractice && selectedKey) || State.testSubmitted;

    html += `<div class="opts">`;
    for (const opt of q.options) {
      let optClass = 'opt';
      let verdictBadge = '';

      if (selectedKey === opt.key) optClass += ' selected';

      if (showFeedback) {
        if (opt.key === q.answer_key) {
          optClass += ' correct';
          verdictBadge = '<span class="verdict">Correct Key</span>';
        } else if (selectedKey === opt.key) {
          optClass += ' incorrect';
          verdictBadge = '<span class="verdict">Your Answer</span>';
        }
      }

      html += `
        <button class="${optClass}" data-key="${opt.key}">
          <span class="k">${opt.key}</span>
          <span class="t">${opt.text}</span>
          ${verdictBadge}
        </button>
      `;
    }
    html += `</div>`;

    if (showFeedback) {
      const isCorrect = selectedKey === q.answer_key;
      html += `
        <div class="study-note ${isCorrect ? 'is-ok' : 'is-bad'}">
          <div class="sn-head">
            <span>${isCorrect ? '✓ Correctly Answered' : '✗ Incorrect Selection'}</span>
            <span style="margin-left:auto; font-weight:700;">Verified Key: Option ${q.answer_key}</span>
          </div>
          <div class="sn-body">
            <p>${q.explanation || 'Verified from primary source records.'}</p>
          </div>
        </div>
      `;
    }

    DOM.qContainer.innerHTML = html;

    // Attach option listeners
    DOM.qContainer.querySelectorAll('.opt').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (State.testSubmitted) return;
        const key = btn.getAttribute('data-key');
        State.userAnswers[q.id] = key;
        updateStats();
        renderQuestion();
        renderPalette();
      });
    });

    // Update Next/Prev/Submit
    if (DOM.prevBtn) DOM.prevBtn.disabled = State.currentIndex === 0;
    const isLast = State.currentIndex === qList.length - 1;
    if (DOM.nextBtn) DOM.nextBtn.style.display = isLast ? 'none' : 'inline-flex';
    if (DOM.submitBtn) DOM.submitBtn.style.display = isLast ? 'inline-flex' : 'none';
  }

  // Update Stats & Accuracy
  function updateStats() {
    if (!State.currentModule) return;
    const qList = State.currentModule.questions;
    let correct = 0;
    let answered = 0;

    qList.forEach((q) => {
      const ans = State.userAnswers[q.id];
      if (ans) {
        answered++;
        if (ans === q.answer_key) correct++;
      }
    });

    const acc = answered > 0 ? Math.round((correct / answered) * 100) : 0;
    const wrong = answered - correct;

    if (DOM.liveAccNum) DOM.liveAccNum.textContent = `${acc}%`;
    if (DOM.statCorrect) DOM.statCorrect.textContent = correct;
    if (DOM.statWrong) DOM.statWrong.textContent = wrong;

    if (DOM.railAcc) DOM.railAcc.textContent = `${acc}%`;
    if (DOM.railBar) DOM.railBar.style.width = `${Math.round((answered / qList.length) * 100)}%`;
    if (DOM.railSub) DOM.railSub.textContent = `${answered} answered of ${qList.length}`;
  }

  // Question Palette
  function renderPalette() {
    if (!DOM.livePalette || !State.currentModule) return;
    const qList = State.currentModule.questions;
    DOM.livePalette.innerHTML = '';

    qList.forEach((q, idx) => {
      const btn = document.createElement('button');
      btn.className = 'palette-btn';
      if (idx === State.currentIndex) btn.classList.add('current');
      if (State.userAnswers[q.id]) btn.classList.add('answered');
      btn.textContent = idx + 1;
      btn.addEventListener('click', () => {
        State.currentIndex = idx;
        renderQuestion();
        renderPalette();
      });
      DOM.livePalette.appendChild(btn);
    });
  }

  // Generator Action
  async function handleGenerate() {
    const text = (DOM.docText.value || '').trim();
    if (!text) {
      showToast('Please provide notes, text, or a document first.');
      return;
    }

    const title = (DOM.docTitle.value || '').trim() || 'Custom Study Quiz';
    showToast('Extracting knowledge units deterministically...');

    const startTime = performance.now();
    try {
      const sections = window.StudySynthEngine.parseRawDocument(text, title);
      const inventory = window.StudySynthEngine.buildKnowledgeInventory(sections);
      if (inventory.length === 0) {
        showToast('No structured knowledge units found.');
        return;
      }

      const questions = window.StudySynthEngine.generateQuestionBank(inventory, { targetCount: 15 });
      const val = window.StudySynthEngine.validateQuestionBank(questions);
      const durationMs = Math.round(performance.now() - startTime);

      const newMod = {
        id: 'mod_' + Date.now(),
        title: title,
        createdAt: new Date().toISOString(),
        durationMs: durationMs,
        sectionsCount: sections.length,
        inventory: inventory,
        questions: questions,
        validation: val
      };

      await window.OfflineStorage.saveModule(newMod);
      setModule(newMod);
      showToast(`Generated ${questions.length} questions in ${durationMs}ms!`);
      switchMode('practice');
    } catch (err) {
      showToast('Generation error: ' + err.message);
    }
  }

  // Flashcards
  let cardIdx = 0;
  let cardFlipped = false;

  function renderFlashcard() {
    if (!DOM.flashcardBox || !State.currentModule) return;
    const units = State.currentModule.inventory || [];
    if (units.length === 0) {
      DOM.flashcardBox.innerHTML = '<p style="color:var(--muted)">No knowledge units available.</p>';
      return;
    }

    const ku = units[cardIdx];
    if (DOM.flashcardCount) {
      DOM.flashcardCount.textContent = `Card ${cardIdx + 1} of ${units.length}`;
    }

    if (!cardFlipped) {
      DOM.flashcardBox.innerHTML = `
        <span style="font-size:11px; font-weight:800; text-transform:uppercase; color:var(--accent); letter-spacing:0.08em; margin-bottom:12px;">
          ${ku.section_title}
        </span>
        <h3 style="font-size:18px; font-weight:750; color:var(--ink);">${ku.anchor || 'Core Fact'}</h3>
        <p style="font-size:12px; color:var(--muted); margin-top:16px;">Tap card to reveal verified explanation</p>
      `;
    } else {
      DOM.flashcardBox.innerHTML = `
        <span style="font-size:10.5px; font-weight:800; text-transform:uppercase; color:var(--good); letter-spacing:0.08em; margin-bottom:10px;">
          Knowledge Unit ${ku.ku_id}
        </span>
        <p style="font-size:15px; line-height:1.6; color:var(--ink); text-align:left;">${ku.statement}</p>
        <div style="font-size:12px; color:var(--accent); margin-top:14px; text-align:left;">Source Page: ${ku.source_page}</div>
      `;
    }

    DOM.flashcardBox.onclick = () => {
      cardFlipped = !cardFlipped;
      renderFlashcard();
    };
  }

  // Library
  async function renderLibrary() {
    if (!DOM.libraryContainer) return;
    DOM.libraryContainer.innerHTML = '<p style="color:var(--muted);">Loading offline modules...</p>';

    const list = await window.OfflineStorage.getModules();
    if (list.length === 0) {
      DOM.libraryContainer.innerHTML = '<p style="color:var(--muted);">No saved quizzes yet. Generate one in the Generator tab.</p>';
      return;
    }

    let html = '';
    list.forEach((mod) => {
      html += `
        <div style="background:var(--surface-2); border:1px solid var(--line); border-radius:12px; padding:16px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h4 style="font-size:15px; font-weight:750;">${mod.title}</h4>
            <div style="font-size:12px; color:var(--muted); margin-top:4px;">
              ${mod.questions.length} Questions • ${new Date(mod.createdAt).toLocaleDateString()} • Generated in ${mod.durationMs}ms
            </div>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-primary lib-load" data-id="${mod.id}" style="padding:6px 14px; min-width:auto; font-size:12px;">Launch</button>
            <button class="btn lib-del" data-id="${mod.id}" style="padding:6px 10px; color:var(--bad); font-size:12px;">🗑️</button>
          </div>
        </div>
      `;
    });

    DOM.libraryContainer.innerHTML = html;

    DOM.libraryContainer.querySelectorAll('.lib-load').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const target = list.find(m => m.id === id);
        if (target) {
          setModule(target);
          switchMode('practice');
        }
      });
    });

    DOM.libraryContainer.querySelectorAll('.lib-del').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        await window.OfflineStorage.deleteModule(id);
        renderLibrary();
        showToast('Module deleted from local storage.');
      });
    });
  }

  // Event Listeners
  function initEvents() {
    // Mode buttons in rail
    DOM.modeItems.forEach((btn) => {
      btn.addEventListener('click', () => {
        switchMode(btn.getAttribute('data-mode'));
      });
    });

    // Navigation Next / Prev / Submit
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

    if (DOM.submitBtn) {
      DOM.submitBtn.addEventListener('click', () => {
        stopTimer();
        State.testSubmitted = true;
        renderQuestion();
        showToast('Test completed! Explanations and answer keys unlocked.');
      });
    }

    if (DOM.markBtn) {
      DOM.markBtn.addEventListener('click', () => {
        if (!State.currentModule) return;
        const q = State.currentModule.questions[State.currentIndex];
        const isNowBookmarked = window.OfflineStorage.toggleBookmark(q.id, q);
        DOM.markBtn.textContent = isNowBookmarked ? '★ Bookmarked' : '☆ Bookmark';
        showToast(isNowBookmarked ? 'Saved to bookmarks' : 'Removed from bookmarks');
      });
    }

    if (DOM.printBtn) {
      DOM.printBtn.addEventListener('click', () => window.print());
    }

    // Generator inputs & File Drag-and-Drop
    if (DOM.dropZone) {
      DOM.dropZone.addEventListener('click', () => DOM.fileInput.click());
      DOM.dropZone.addEventListener('dragover', (e) => e.preventDefault());
      DOM.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length > 0) processFile(e.dataTransfer.files[0]);
      });
    }

    if (DOM.fileInput) {
      DOM.fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) processFile(e.target.files[0]);
      });
    }

    async function processFile(file) {
      showToast('Processing file offline...');
      try {
        const text = await window.OfflineDocParser.readFileContent(file);
        DOM.docText.value = text;
        DOM.docTitle.value = file.name.replace(/\.[^/.]+$/, '');
        showToast(`Loaded ${file.name}`);
      } catch (err) {
        showToast('Error parsing file: ' + err.message);
      }
    }

    if (DOM.chipDemoSpm) {
      DOM.chipDemoSpm.addEventListener('click', () => {
        DOM.docText.value = window.StudySamples.newspaper_2026;
        DOM.docTitle.value = 'SPM IAS Academy — 19 Oct 2026';
        handleGenerate();
      });
    }

    if (DOM.chipDemoScience) {
      DOM.chipDemoScience.addEventListener('click', () => {
        DOM.docText.value = window.StudySamples.science_space;
        DOM.docTitle.value = 'Chandrayaan-3 Mission Notes';
        handleGenerate();
      });
    }

    if (DOM.generateBtn) {
      DOM.generateBtn.addEventListener('click', handleGenerate);
    }

    // Flashcards
    if (DOM.prevCardBtn) {
      DOM.prevCardBtn.addEventListener('click', () => {
        const total = State.currentModule ? (State.currentModule.inventory || []).length : 0;
        if (total > 0) {
          cardIdx = (cardIdx - 1 + total) % total;
          cardFlipped = false;
          renderFlashcard();
        }
      });
    }

    if (DOM.nextCardBtn) {
      DOM.nextCardBtn.addEventListener('click', () => {
        const total = State.currentModule ? (State.currentModule.inventory || []).length : 0;
        if (total > 0) {
          cardIdx = (cardIdx + 1) % total;
          cardFlipped = false;
          renderFlashcard();
        }
      });
    }
  }

  // App Initialization
  function initApp() {
    initDOM();
    initInstallHandlers();
    initTheme();
    registerServiceWorker();
    initEvents();
    loadInitialModule();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
