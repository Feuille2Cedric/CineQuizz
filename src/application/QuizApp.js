import { Question } from "../domain/entities/Question.js";
import { isCorrectAnswer, normalizeText } from "../domain/services/answerNormalizer.js";

function accuracyFromStats(stats) {
  if (!stats.totalAnswered) {
    return 0;
  }

  return Math.round((stats.totalCorrect / stats.totalAnswered) * 100);
}

function emptyDifficultyStats() {
  return {
    easy: { correct: 0, answered: 0 },
    medium: { correct: 0, answered: 0 },
    hard: { correct: 0, answered: 0 }
  };
}

function toDifficultyLabel(difficulty) {
  return {
    easy: "Facile",
    medium: "Moyen",
    hard: "Difficile"
  }[difficulty] ?? difficulty;
}

function dedupeQuestions(questions) {
  const byId = new Map();

  for (const question of questions) {
    byId.set(question.id, question);
  }

  return [...byId.values()];
}

function shouldUseMultipleChoice(question) {
  if (!question) {
    return false;
  }

  if (question.metadata?.answerMode === "text") {
    return false;
  }

  if (question.metadata?.answerMode === "mcq") {
    return true;
  }

  const answerLength = String(question.answer ?? "").trim().length;
  const answerWordCount = String(question.answer ?? "").trim().split(/\s+/).filter(Boolean).length;
  return answerLength >= 90 || answerWordCount >= 14;
}

function shuffle(values) {
  const copy = [...values];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function normalizeChoiceKey(value) {
  return String(value ?? "").trim().toLowerCase();
}

function answerLength(value) {
  return String(value ?? "").trim().length;
}

function answerWordCount(value) {
  return String(value ?? "").trim().split(/\s+/).filter(Boolean).length;
}

function normalizedWords(value) {
  return normalizeText(value).split(/\s+/).filter(Boolean);
}

function sentenceLead(value, size = 2) {
  return normalizedWords(value).slice(0, size).join(" ");
}

function questionStem(question, size = 4) {
  return normalizedWords(question?.prompt ?? "").slice(0, size).join(" ");
}

function choiceScore(question, candidate) {
  let score = 0;
  const questionTemplate = question.metadata?.template ?? "";
  const candidateTemplate = candidate.metadata?.template ?? "";
  const questionLead = sentenceLead(question.answer, 2);
  const candidateLead = sentenceLead(candidate.answer, 2);
  const questionStemShort = questionStem(question, 2);
  const candidateStemShort = questionStem(candidate, 2);
  const questionStemLong = questionStem(question, 4);
  const candidateStemLong = questionStem(candidate, 4);

  if (candidate.difficulty === question.difficulty) {
    score += 24;
  }

  if (questionTemplate && questionTemplate === candidateTemplate) {
    score += 20;
  }

  if (shouldUseMultipleChoice(candidate)) {
    score += 14;
  }

  if (questionStemShort && questionStemShort === candidateStemShort) {
    score += 18;
  }

  if (questionStemLong && questionStemLong === candidateStemLong) {
    score += 12;
  }

  if (questionLead && questionLead === candidateLead) {
    score += 16;
  }

  score += Math.max(0, 18 - Math.abs(answerLength(candidate.answer) - answerLength(question.answer)) / 6);
  score += Math.max(0, 12 - Math.abs(answerWordCount(candidate.answer) - answerWordCount(question.answer)) * 2);

  return score;
}

export class QuizApp {
  constructor({ catalogRepository, patchRepository, gameRepository }) {
    this.catalogRepository = catalogRepository;
    this.patchRepository = patchRepository;
    this.gameRepository = gameRepository;
    this.state = {
      difficulty: "easy",
      profile: {
        userId: null,
        nickname: "Spectateur",
        isAdmin: false,
        stats: {
          totalAnswered: 0,
          totalCorrect: 0,
          byDifficulty: emptyDifficultyStats()
        }
      },
      auth: {
        isAuthenticated: true,
        email: null
      },
      answeredQuestionIds: new Set(),
      questions: [],
      currentQuestion: null,
      currentChoices: [],
      currentResult: null,
      leaderboard: [],
      moderationRequests: [],
      mode: "local"
    };
  }

  async initialize(preferredNickname) {
    await this.#reloadQuestions();

    const sessionState = await this.gameRepository.initialize(preferredNickname);
    await this.#applySessionState(sessionState);

    this.pickNextQuestion();
    return this.getViewModel();
  }

  getViewModel() {
    const difficultyCounts = {
      easy: 0,
      medium: 0,
      hard: 0
    };

    for (const question of this.state.questions) {
      difficultyCounts[question.difficulty] += 1;
    }

    return {
      mode: this.state.mode,
      auth: this.state.auth,
      profile: this.state.profile,
      difficulty: this.state.difficulty,
      difficultyLabel: toDifficultyLabel(this.state.difficulty),
      currentQuestion: this.state.currentQuestion,
      answerMode: shouldUseMultipleChoice(this.state.currentQuestion) ? "mcq" : "text",
      currentChoices: this.state.currentChoices,
      currentResult: this.state.currentResult,
      canRevealCurrentAnswer: Boolean(this.state.currentResult),
      leaderboard: this.state.leaderboard,
      moderationRequests: this.state.moderationRequests,
      canContribute: this.state.mode === "supabase" && this.state.auth.isAuthenticated,
      stats: {
        ...this.state.profile.stats,
        accuracy: accuracyFromStats(this.state.profile.stats),
        remaining: this.#getRemainingQuestionCount(),
        remainingForDifficulty: this.#getRemainingQuestionCount(this.state.difficulty)
      },
      catalogCounts: {
        ...difficultyCounts,
        total: this.state.questions.length
      }
    };
  }

  setDifficulty(difficulty) {
    this.state.difficulty = difficulty;
    this.state.currentChoices = [];
    this.state.currentResult = null;
    this.pickNextQuestion();
    return this.getViewModel();
  }

  async updateNickname(nickname) {
    this.#assertCanUseSupabaseProfile();
    const result = await this.gameRepository.updateNickname(nickname);
    this.state.profile.nickname = result.nickname;
    this.state.profile.stats = result.stats;
    this.state.leaderboard = await this.gameRepository.getLeaderboard();
    return this.getViewModel();
  }

  async submitAnswer(rawAnswer) {
    this.#assertCanUseSupabaseProfile();

    if (!this.state.currentQuestion) {
      throw new Error("Aucune question active.");
    }

    const currentQuestion = this.state.currentQuestion;
    const isCorrect = isCorrectAnswer(rawAnswer, currentQuestion.acceptedAnswers);
    const normalizedAnswer = normalizeText(rawAnswer);

    const registration = await this.gameRepository.registerAnswer({
      questionId: currentQuestion.id,
      difficulty: currentQuestion.difficulty,
      isCorrect,
      normalizedAnswer
    });

    if (registration.inserted) {
      this.state.answeredQuestionIds.add(currentQuestion.id);
      this.state.profile.stats = registration.stats;
      this.state.leaderboard = await this.gameRepository.getLeaderboard();
    }

    this.state.currentResult = {
      isCorrect,
      expectedAnswer: currentQuestion.answer,
      submittedAnswer: rawAnswer
    };

    return this.getViewModel();
  }

  async signIn({ identifier, password }) {
    const result = await this.gameRepository.signIn({ identifier, password });
    await this.#applySessionState(result.sessionState);
    this.pickNextQuestion();
    return {
      viewModel: this.getViewModel(),
      message: result.message ?? "Connexion reussie."
    };
  }

  async signUp({ email, password, preferredNickname }) {
    const result = await this.gameRepository.signUp({ email, password, preferredNickname });
    await this.#applySessionState(result.sessionState);
    this.pickNextQuestion();
    return {
      viewModel: this.getViewModel(),
      message: result.message ?? "Compte cree."
    };
  }

  async signOut() {
    if (typeof this.gameRepository.signOut !== "function") {
      throw new Error("La deconnexion n'est pas disponible dans ce mode.");
    }

    const sessionState = await this.gameRepository.signOut(this.state.profile.nickname);
    await this.#applySessionState(sessionState);
    this.pickNextQuestion();
    return this.getViewModel();
  }

  async submitQuestionFeedback({
    type,
    questionId,
    reason,
    prompt,
    answer,
    aliases,
    difficulty
  }) {
    this.#assertCanUseSupabaseProfile();

    if (typeof this.gameRepository.submitQuestionFeedback !== "function") {
      throw new Error("Les signalements ne sont pas disponibles dans ce mode.");
    }

    const currentQuestion = this.#findQuestion(questionId);

    if (!currentQuestion) {
      throw new Error("Question introuvable.");
    }

    if (!reason.trim()) {
      throw new Error("Merci d'expliquer votre demande.");
    }

    if (type === "edit" && (!prompt.trim() || !answer.trim())) {
      throw new Error("Une proposition de modification doit contenir une question et une reponse.");
    }

    await this.gameRepository.submitQuestionFeedback({
      type,
      questionId,
      reason,
      questionSnapshot: currentQuestion.toJSON(),
      proposedPrompt: type === "edit" ? prompt : null,
      proposedAnswer: type === "edit" ? answer : null,
      proposedAcceptedAnswers: type === "edit" ? aliases : [],
      proposedDifficulty: type === "edit" ? difficulty : null
    });

    await this.#refreshModerationRequests();
    return this.getViewModel();
  }

  async submitNewQuestionSuggestion({ prompt, answer, aliases, difficulty, reason }) {
    this.#assertCanUseSupabaseProfile();

    if (typeof this.gameRepository.submitNewQuestionSuggestion !== "function") {
      throw new Error("Les propositions de questions ne sont pas disponibles dans ce mode.");
    }

    if (!prompt.trim() || !answer.trim()) {
      throw new Error("Une nouvelle question doit contenir une question et une reponse.");
    }

    await this.gameRepository.submitNewQuestionSuggestion({
      prompt,
      answer,
      acceptedAnswers: aliases,
      difficulty,
      reason
    });

    await this.#refreshModerationRequests();
    return this.getViewModel();
  }

  async deleteQuestion(questionId) {
    this.#assertAdmin();
    await this.gameRepository.deleteQuestion(questionId);
    await this.#reloadQuestions();
    this.#syncCurrentQuestionAfterCatalogReload(questionId);
    await this.#refreshModerationRequests();
    return this.getViewModel();
  }

  async reviewModerationRequest({ requestId, decision, adminNote }) {
    this.#assertAdmin();
    await this.gameRepository.reviewModerationRequest({ requestId, decision, adminNote });
    const currentQuestionId = this.state.currentQuestion?.id ?? null;
    await this.#reloadQuestions();
    this.#syncCurrentQuestionAfterCatalogReload(currentQuestionId);
    await this.#refreshModerationRequests();
    return this.getViewModel();
  }

  pickNextQuestion() {
    const pool = this.state.questions.filter(
      (question) =>
        question.difficulty === this.state.difficulty &&
        !this.state.answeredQuestionIds.has(question.id)
    );

    if (!pool.length) {
      this.state.currentQuestion = null;
      this.state.currentChoices = [];
      return this.getViewModel();
    }

    const nextQuestion = pool[Math.floor(Math.random() * pool.length)];
    this.#prepareCurrentQuestion(nextQuestion);
    return this.getViewModel();
  }

  async saveQuestionOverride({ questionId, prompt, answer, aliases, difficulty }) {
    const currentQuestion = this.#findQuestion(questionId);

    if (!currentQuestion) {
      throw new Error("Question introuvable.");
    }

    const acceptedAnswers = [answer, ...aliases]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean);

    this.patchRepository.saveOverride(questionId, {
      prompt: prompt.trim(),
      answer: answer.trim(),
      acceptedAnswers,
      difficulty
    });

    await this.#reopenQuestionForReplay(questionId);
    await this.#reloadQuestions();
    this.state.currentResult = null;
    this.state.currentQuestion = this.#resolveQuestionAfterEdition(questionId);
    this.state.currentChoices = this.#buildAnswerChoices(this.state.currentQuestion);
    return this.getViewModel();
  }

  async clearQuestionOverride(questionId) {
    this.patchRepository.removeOverride(questionId);
    await this.#reopenQuestionForReplay(questionId);
    await this.#reloadQuestions();
    this.state.currentResult = null;
    this.state.currentQuestion = this.#resolveQuestionAfterEdition(questionId);
    this.state.currentChoices = this.#buildAnswerChoices(this.state.currentQuestion);
    return this.getViewModel();
  }

  async importQuestionPack(jsonText) {
    const payload = JSON.parse(jsonText);
    const rawQuestions = Array.isArray(payload) ? payload : payload.questions;

    if (!Array.isArray(rawQuestions)) {
      throw new Error("Le JSON importe doit contenir un tableau de questions.");
    }

    this.patchRepository.saveImportedQuestions(rawQuestions);
    await this.#reloadQuestions();
    this.pickNextQuestion();

    return {
      importedCount: rawQuestions.length,
      viewModel: this.getViewModel()
    };
  }

  exportOverrides() {
    return this.patchRepository.exportOverrides();
  }

  async resetLocalCustomData() {
    this.patchRepository.clearAll();
    await this.#reloadQuestions();
    this.pickNextQuestion();
    return this.getViewModel();
  }

  async #reloadQuestions() {
    const baseQuestions = await this.catalogRepository.loadQuestions();
    const importedQuestions = this.patchRepository.getImportedQuestions();
    const overrides = this.patchRepository.getOverrides();

    const mergedQuestions = dedupeQuestions([...baseQuestions, ...importedQuestions]).map((question) =>
      this.#applyOverride(question, overrides[question.id])
    );

    this.state.questions = mergedQuestions;
  }

  async #applySessionState(sessionState) {
    this.state.profile.userId = sessionState.userId;
    this.state.profile.nickname = sessionState.nickname;
    this.state.profile.isAdmin = Boolean(sessionState.isAdmin);
    this.state.profile.stats = sessionState.stats;
    this.state.auth = sessionState.auth ?? {
      isAuthenticated: true,
      email: null
    };
    this.state.answeredQuestionIds = new Set(sessionState.answeredQuestionIds);
    this.state.mode = sessionState.mode;
    this.state.leaderboard = await this.gameRepository.getLeaderboard();
    await this.#refreshModerationRequests();
  }

  #applyOverride(question, override) {
    if (!override) {
      return question;
    }

    return Question.fromPlain({
      ...question.toJSON(),
      ...override,
      acceptedAnswers: override.acceptedAnswers ?? question.acceptedAnswers
    });
  }

  #findQuestion(questionId) {
    return this.state.questions.find((question) => question.id === questionId) ?? null;
  }

  #resolveQuestionAfterEdition(questionId) {
    const editedQuestion = this.#findQuestion(questionId);

    if (editedQuestion && editedQuestion.difficulty === this.state.difficulty) {
      return editedQuestion;
    }

    return this.pickNextQuestion().currentQuestion;
  }

  #prepareCurrentQuestion(question) {
    this.state.currentQuestion = question;
    this.state.currentChoices = this.#buildAnswerChoices(question);
    this.state.currentResult = null;
  }

  #buildAnswerChoices(question) {
    if (!shouldUseMultipleChoice(question)) {
      return [];
    }

    const seen = new Set([normalizeChoiceKey(question.answer)]);
    const rankedDistractors = this.state.questions
      .filter((candidate) => candidate.id !== question.id)
      .map((candidate) => ({
        label: String(candidate.answer ?? "").trim(),
        key: normalizeChoiceKey(candidate.answer),
        score: choiceScore(question, candidate)
      }))
      .filter((candidate) => candidate.label && !seen.has(candidate.key))
      .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label, "fr"));

    const distractors = [];

    for (const candidate of rankedDistractors) {
      if (distractors.length >= 3) {
        break;
      }

      seen.add(candidate.key);
      distractors.push(candidate.label);
    }

    return shuffle([question.answer, ...distractors]);
  }

  #getRemainingQuestionCount(difficulty = null) {
    return this.state.questions.filter(
      (question) =>
        (difficulty ? question.difficulty === difficulty : true) &&
        !this.state.answeredQuestionIds.has(question.id)
    ).length;
  }

  async #reopenQuestionForReplay(questionId) {
    if (typeof this.gameRepository.reopenQuestion !== "function") {
      this.state.answeredQuestionIds.delete(questionId);
      return;
    }

    const result = await this.gameRepository.reopenQuestion(questionId);
    this.state.answeredQuestionIds.delete(questionId);

    if (result?.stats) {
      this.state.profile.stats = result.stats;
      this.state.leaderboard = await this.gameRepository.getLeaderboard();
    }
  }

  async #refreshModerationRequests() {
    if (typeof this.gameRepository.getModerationRequests !== "function") {
      this.state.moderationRequests = [];
      return;
    }

    this.state.moderationRequests = this.state.profile.isAdmin
      ? await this.gameRepository.getModerationRequests()
      : [];
  }

  #syncCurrentQuestionAfterCatalogReload(preferredQuestionId = null) {
    const activeQuestionId = preferredQuestionId ?? this.state.currentQuestion?.id ?? null;
    const refreshedQuestion = activeQuestionId ? this.#findQuestion(activeQuestionId) : null;

    if (refreshedQuestion && refreshedQuestion.difficulty === this.state.difficulty) {
      this.#prepareCurrentQuestion(refreshedQuestion);
      return;
    }

    this.pickNextQuestion();
  }

  #assertCanUseSupabaseProfile() {
    if (this.state.mode === "supabase" && !this.state.auth.isAuthenticated) {
      throw new Error("Connexion requise pour sauvegarder la progression et apparaitre dans le classement.");
    }
  }

  #assertAdmin() {
    if (!this.state.profile.isAdmin) {
      throw new Error("Action reservee aux administrateurs.");
    }
  }
}
