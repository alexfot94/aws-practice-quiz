(() => {
  const QUESTIONS = window.AWS_QUIZ_QUESTIONS || [];
  const $ = (id) => document.getElementById(id);
  const els = {
    setup: $('setupCard'), quiz: $('quizArea'), results: $('resultsCard'), examSelect: $('examSelect'),
    orderSelect: $('orderSelect'), lengthSelect: $('lengthSelect'), modeSelect: $('modeSelect'), start: $('startBtn'), resume: $('resumeBtn'),
    progressText: $('progressText'), scoreText: $('scoreText'), accuracyText: $('accuracyText'), timerStat: $('timerStat'), timerText: $('timerText'), progressBar: $('progressBar'),
    examBadge: $('examBadge'), multiBadge: $('multiBadge'), modeBadge: $('modeBadge'), qText: $('questionText'), options: $('options'), feedback: $('feedback'),
    prev: $('prevBtn'), check: $('checkBtn'), next: $('nextBtn'), exit: $('exitBtn'), reviewWrong: $('reviewWrongBtn'), reset: $('resetBtn'),
    resultTitle: $('resultTitle'), resultScore: $('resultScore'), resultDetail: $('resultDetail'), reviewResults: $('reviewResultsBtn'), newQuiz: $('newQuizBtn'),
    theme: $('themeBtn'), homeLogo: $('homeLogoBtn'), reviewCard: $('reviewCard'), reviewList: $('reviewList'), reviewSummary: $('reviewSummary'), continueTest: $('continueTestBtn'), continueTestBottom: $('continueTestBottomBtn')
  };

  let state = { quiz: [], pos: 0, answers: {}, checked: {}, mode: 'quiz', config: null, deadline: null, reviewReturn: null };
  let timerId = null;
  const SAVE_KEY = 'awsQuizStateV2';
  const LEGACY_SAVE_KEY = 'awsQuizStateV1';

  const examNums = [...new Set(QUESTIONS.map(q => q.exam))].sort((a,b) => a-b);
  els.examSelect.innerHTML = '<option value="all">All 23 exams (1,142 questions)</option>' +
    examNums.map(n => `<option value="${n}">Practice Exam ${n} (${QUESTIONS.filter(q=>q.exam===n).length})</option>`).join('');

  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  };

  const sameSet = (a,b) => {
    const aa = [...a].sort();
    const bb = [...b].sort();
    return aa.length === bb.length && aa.every((v,i) => v === bb[i]);
  };

  const numberWord = (n) => ({2:'two',3:'three',4:'four',5:'five'}[n] || String(n));
  const isSimulationConfig = () => state.config?.quizMode === 'simulation-100' || state.config?.quizMode === 'simulation-130';
  const isSimulationActive = () => state.mode === 'quiz' && isSimulationConfig();
  const simulationMinutes = () => state.config?.quizMode === 'simulation-130' ? 130 : 100;

  function loadSavedState() {
    try {
      const current = localStorage.getItem(SAVE_KEY);
      if (current) return JSON.parse(current);
      const legacy = localStorage.getItem(LEGACY_SAVE_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy);
        parsed.config = { ...(parsed.config || {}), quizMode: 'practice' };
        parsed.deadline = null;
        return parsed;
      }
    } catch {}
    return null;
  }

  function save() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    updateResume();
  }

  function updateResume() {
    const saved = loadSavedState();
    els.resume.classList.toggle('hidden', !saved?.quiz?.length || saved.mode === 'complete');
  }

  function startQuiz() {
    stopTimer();
    const exam = els.examSelect.value;
    let pool = exam === 'all' ? [...QUESTIONS] : QUESTIONS.filter(q => q.exam === Number(exam));
    if (els.orderSelect.value === 'shuffle') pool = shuffle(pool);
    const len = els.lengthSelect.value === 'all' ? pool.length : Math.min(Number(els.lengthSelect.value), pool.length);
    pool = pool.slice(0, len);
    const quizMode = els.modeSelect.value;
    const minutes = quizMode === 'simulation-100' ? 100 : quizMode === 'simulation-130' ? 130 : null;
    state = {
      quiz: pool.map(q=>q.id),
      pos: 0,
      answers: {},
      checked: {},
      mode: 'quiz',
      config: { exam, order: els.orderSelect.value, length: els.lengthSelect.value, quizMode },
      deadline: minutes ? Date.now() + minutes * 60 * 1000 : null,
      reviewReturn: null
    };
    save();
    showQuiz();
    render();
    startTimerIfNeeded();
  }

  function resumeQuiz() {
    const saved = loadSavedState();
    if (!saved) return startQuiz();
    state = saved;
    state.config = { ...(state.config || {}), quizMode: state.config?.quizMode || 'practice' };
    state.deadline = state.deadline || null;
    state.reviewReturn = state.reviewReturn || null;
    showQuiz();
    render();
    startTimerIfNeeded();
  }

  function qById(id){ return QUESTIONS.find(q => q.id === id); }
  function current(){ return qById(state.quiz[state.pos]); }
  function selectedFor(id){ return state.answers[id] || []; }
  function isCorrect(q){ return sameSet(selectedFor(q.id), q.correct); }
  function checkedCount(){ return state.quiz.filter(id => state.checked[id]).length; }
  function correctCount(){ return state.quiz.reduce((n,id)=> { const q=qById(id); return n + (state.checked[id] && isCorrect(q) ? 1 : 0); }, 0); }
  function simulationCorrectCount(){ return state.quiz.reduce((n,id) => n + (isCorrect(qById(id)) ? 1 : 0), 0); }
  function answeredCount(){ return state.quiz.filter(id => selectedFor(id).length > 0).length; }

  function showQuiz(){
    els.setup.classList.add('hidden');
    els.results.classList.add('hidden');
    els.reviewCard.classList.add('hidden');
    els.quiz.classList.remove('hidden');
  }

  function showSetup(){
    stopTimer();
    els.quiz.classList.add('hidden');
    els.results.classList.add('hidden');
    els.reviewCard.classList.add('hidden');
    els.setup.classList.remove('hidden');
    updateResume();
  }

  function render() {
    if (!state.quiz.length) return showSetup();
    const q = current();
    if (!q) return showSetup();

    const simulation = isSimulationActive();
    const checked = !!state.checked[q.id];
    const locked = !simulation && checked;
    const selected = selectedFor(q.id);
    const cCount = simulation ? simulationCorrectCount() : correctCount();
    const aCount = simulation ? answeredCount() : checkedCount();

    els.progressText.textContent = `${state.pos + 1} / ${state.quiz.length}`;
    els.scoreText.textContent = simulation ? 'Hidden' : `${cCount} / ${aCount}`;
    els.accuracyText.textContent = simulation ? 'Hidden' : (aCount ? `${Math.round(cCount/aCount*100)}%` : '—');
    els.timerStat.classList.toggle('hidden', !simulation);
    els.progressBar.style.width = `${((state.pos + 1)/state.quiz.length)*100}%`;
    els.examBadge.textContent = `Practice Exam ${q.exam} · Q${q.number}`;

    const required = q.correct.length;
    els.multiBadge.classList.toggle('hidden', required <= 1);
    if (required > 1) els.multiBadge.textContent = `Choose ${numberWord(required)}`;

    els.modeBadge.classList.toggle('hidden', !simulation);
    if (simulation) els.modeBadge.textContent = `Test simulation · ${simulationMinutes()} min`;

    els.qText.textContent = q.question;
    els.options.innerHTML = '';

    q.options.forEach(o => {
      const label = document.createElement('label');
      label.className = 'option' + (locked ? ' locked' : '');
      const input = document.createElement('input');
      input.type = required > 1 ? 'checkbox' : 'radio';
      input.name = required > 1 ? `answer-${q.id}-${o.id}` : `answer-${q.id}`;
      input.value = o.id;
      input.checked = selected.includes(o.id);
      input.disabled = locked;

      input.addEventListener('change', () => {
        if (required > 1) {
          const set = new Set(selectedFor(q.id));
          if (input.checked) {
            if (set.size >= required) {
              input.checked = false;
              els.feedback.className = 'feedback bad';
              els.feedback.textContent = `This question requires exactly ${numberWord(required)} answers.`;
              return;
            }
            set.add(o.id);
          } else {
            set.delete(o.id);
          }
          state.answers[q.id] = [...set];
        } else {
          state.answers[q.id] = [o.id];
        }
        if (simulation) els.feedback.className = 'feedback hidden';
        save();
      });

      const letter = document.createElement('span');
      letter.className='option-letter';
      letter.textContent = `${o.id}.`;
      const text = document.createElement('span');
      text.textContent = o.text;
      label.append(input, letter, text);

      if (locked) {
        if (q.correct.includes(o.id)) label.classList.add(selected.includes(o.id) ? 'correct' : 'missed');
        if (selected.includes(o.id) && !q.correct.includes(o.id)) label.classList.add('wrong');
      }
      els.options.appendChild(label);
    });

    els.feedback.className = 'feedback hidden';
    if (locked) {
      const ok = isCorrect(q);
      els.feedback.className = `feedback ${ok ? 'good' : 'bad'}`;
      const answerText = q.correct.map(letter => {
        const opt = q.options.find(o=>o.id===letter);
        return `${letter}. ${opt?.text || ''}`;
      }).join(' | ');
      els.feedback.textContent = ok ? `Correct! ${answerText}` : `Incorrect. Correct answer: ${answerText}`;
    }

    els.prev.disabled = state.pos === 0;
    els.check.classList.toggle('hidden', simulation || checked);
    els.next.classList.toggle('hidden', !simulation && !checked);

    if (simulation) {
      els.next.textContent = state.pos === state.quiz.length - 1 ? 'Finish test' : 'Next →';
    } else {
      els.next.textContent = state.pos === state.quiz.length - 1 ? 'Finish quiz' : 'Next →';
    }

    els.reviewWrong.disabled = !state.quiz.some(id => state.checked[id] && !isCorrect(qById(id)));
    els.reviewWrong.classList.toggle('hidden', simulation);
  }

  function checkAnswer() {
    const q = current();
    const selected = selectedFor(q.id);
    const required = q.correct.length;

    if (!selected.length) {
      els.feedback.className='feedback bad';
      els.feedback.textContent = required > 1 ? `Choose ${numberWord(required)} answers first.` : 'Select an answer first.';
      return;
    }
    if (required > 1 && selected.length !== required) {
      els.feedback.className='feedback bad';
      els.feedback.textContent = `Choose exactly ${numberWord(required)} answers before checking.`;
      return;
    }

    state.checked[q.id] = true;
    save();
    render();
  }

  function next() {
    if (state.pos >= state.quiz.length - 1) {
      return finish(false);
    }
    state.pos++;
    save();
    render();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function prev(){
    if(state.pos>0){
      state.pos--;
      save();
      render();
    }
  }

  function finish(timedOut = false) {
    if (state.mode === 'complete') return;
    const simulation = isSimulationConfig() && state.mode === 'quiz';
    stopTimer();

    if (simulation) {
      state.quiz.forEach(id => { state.checked[id] = true; });
    }
    state.mode = 'complete';
    save();

    const answered = simulation ? answeredCount() : checkedCount();
    const correct = simulation ? simulationCorrectCount() : correctCount();
    const denominator = simulation ? state.quiz.length : answered;
    const pct = denominator ? Math.round(correct/denominator*100) : 0;
    const unanswered = state.quiz.length - answered;

    els.quiz.classList.add('hidden');
    els.setup.classList.add('hidden');
    els.reviewCard.classList.add('hidden');
    els.results.classList.remove('hidden');
    els.resultScore.textContent = `${pct}%`;
    els.resultTitle.textContent = timedOut ? "Time's up — test submitted" : (pct >= 70 ? 'Nice work!' : 'Keep practicing');

    if (simulation) {
      els.resultDetail.textContent = `${correct} correct out of ${state.quiz.length} questions. ${unanswered} question${unanswered===1?' was':'s were'} unanswered.`;
    } else {
      els.resultDetail.textContent = `${correct} correct out of ${answered} checked questions. ${unanswered} question${unanswered===1?' was':'s were'} not checked.`;
    }
    els.reviewResults.disabled = !state.quiz.some(id=>state.checked[id] && !isCorrect(qById(id)));
  }

  function answerText(q, letters) {
    if (!letters?.length) return 'No answer selected.';
    return letters.map(letter => {
      const opt = q.options.find(o => o.id === letter);
      return `${letter}. ${opt?.text || ''}`;
    }).join(' | ');
  }

  function reviewIncorrect() {
    if (isSimulationActive()) return;
    const wrong = state.quiz.filter(id => state.checked[id] && !isCorrect(qById(id)));
    if (!wrong.length) return;

    stopTimer();
    state.reviewReturn = {
      view: state.mode === 'complete' ? 'results' : 'quiz',
      pos: state.pos
    };
    save();

    els.quiz.classList.add('hidden');
    els.setup.classList.add('hidden');
    els.results.classList.add('hidden');
    els.reviewCard.classList.remove('hidden');
    els.reviewList.innerHTML = '';
    els.reviewSummary.textContent = `${wrong.length} incorrect question${wrong.length === 1 ? '' : 's'} answered so far.`;
    const continueLabel = state.mode === 'complete' ? 'Back to results' : 'Continue test';
    els.continueTest.textContent = continueLabel;
    els.continueTestBottom.textContent = continueLabel;

    wrong.forEach((id, index) => {
      const q = qById(id);
      const item = document.createElement('article');
      item.className = 'card review-item';

      const meta = document.createElement('div');
      meta.className = 'question-meta';
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = `Practice Exam ${q.exam} · Q${q.number}`;
      meta.appendChild(badge);

      const title = document.createElement('h3');
      title.textContent = `${index + 1}. ${q.question}`;

      const grid = document.createElement('div');
      grid.className = 'review-answer-grid';

      const userBox = document.createElement('div');
      userBox.className = 'review-answer user-answer';
      const userLabel = document.createElement('span');
      userLabel.className = 'review-answer-label';
      userLabel.textContent = 'Your answer';
      const userText = document.createElement('p');
      userText.textContent = answerText(q, selectedFor(id));
      userBox.append(userLabel, userText);

      const correctBox = document.createElement('div');
      correctBox.className = 'review-answer correct-answer';
      const correctLabel = document.createElement('span');
      correctLabel.className = 'review-answer-label';
      correctLabel.textContent = 'Correct answer';
      const correctText = document.createElement('p');
      correctText.textContent = answerText(q, q.correct);
      correctBox.append(correctLabel, correctText);

      grid.append(userBox, correctBox);
      item.append(meta, title, grid);
      els.reviewList.appendChild(item);
    });

    window.scrollTo({top:0,behavior:'smooth'});
  }

  function continueAfterReview() {
    const back = state.reviewReturn || { view: state.mode === 'complete' ? 'results' : 'quiz', pos: state.pos };
    if (typeof back.pos === 'number') state.pos = Math.min(Math.max(back.pos, 0), Math.max(state.quiz.length - 1, 0));
    state.reviewReturn = null;
    save();
    els.reviewCard.classList.add('hidden');

    if (back.view === 'results' || state.mode === 'complete') {
      els.quiz.classList.add('hidden');
      els.setup.classList.add('hidden');
      els.results.classList.remove('hidden');
      return;
    }

    showQuiz();
    render();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function resetQuiz() {
    if (!confirm('Reset this quiz and return to quiz selection?')) return;
    stopTimer();
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(LEGACY_SAVE_KEY);
    state = { quiz: [], pos: 0, answers: {}, checked: {}, mode: 'quiz', config: null, deadline: null, reviewReturn: null };
    showSetup();
  }

  function goHome(event) {
    if (event) event.preventDefault();
    // Deliberately preserve the active quiz. The setup screen will offer Resume Quiz.
    if (state.quiz.length && state.mode !== 'complete') save();
    showSetup();
    window.scrollTo({top:0, behavior:'smooth'});
  }

  function formatTime(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
  }

  function updateTimer() {
    if (!isSimulationActive() || !state.deadline) return stopTimer();
    const remaining = state.deadline - Date.now();
    els.timerText.textContent = formatTime(remaining);
    els.timerStat.classList.toggle('warning', remaining > 0 && remaining <= 10 * 60 * 1000);
    if (remaining <= 0) finish(true);
  }

  function startTimerIfNeeded() {
    stopTimer();
    if (!isSimulationActive()) return;
    if (!state.deadline) state.deadline = Date.now() + simulationMinutes() * 60 * 1000;
    updateTimer();
    if (state.mode === 'quiz') timerId = setInterval(updateTimer, 1000);
  }

  function stopTimer() {
    if (timerId) clearInterval(timerId);
    timerId = null;
  }

  els.start.addEventListener('click', startQuiz);
  els.resume.addEventListener('click', resumeQuiz);
  els.check.addEventListener('click', checkAnswer);
  els.next.addEventListener('click', next);
  els.prev.addEventListener('click', prev);
  els.exit.addEventListener('click', showSetup);
  els.reviewWrong.addEventListener('click', reviewIncorrect);
  els.reviewResults.addEventListener('click', reviewIncorrect);
  els.continueTest.addEventListener('click', continueAfterReview);
  els.continueTestBottom.addEventListener('click', continueAfterReview);
  els.newQuiz.addEventListener('click', showSetup);
  els.reset.addEventListener('click', resetQuiz);
  els.homeLogo.addEventListener('click', goHome);
  els.theme.addEventListener('click', () => {
    const root = document.documentElement;
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    localStorage.setItem('awsQuizTheme', next);
  });

  const theme = localStorage.getItem('awsQuizTheme');
  if(theme) document.documentElement.dataset.theme = theme;
  updateResume();
})();
