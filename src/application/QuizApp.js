import { Question } from "../domain/entities/Question.js";
import { isCorrectAnswer, normalizeText } from "../domain/services/answerNormalizer.js";

const DIFFICULTY_LEVELS = new Set(["easy", "medium", "hard", "cinephile"]);
const INPUT_LIMITS = {
  prompt: 400,
  answer: 240,
  reason: 1000,
  aliases: 20,
  aliasLength: 120,
  distractors: 10,
  distractorLength: 180
};

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
    hard: { correct: 0, answered: 0 },
    cinephile: { correct: 0, answered: 0 }
  };
}

function toDifficultyLabel(difficulty) {
  return {
    easy: "Facile",
    medium: "Moyen",
    hard: "Difficile",
    cinephile: "Cinephile"
  }[difficulty] ?? difficulty;
}

function normalizeDifficulty(difficulty) {
  const value = String(difficulty ?? "").trim().toLowerCase();

  if (!DIFFICULTY_LEVELS.has(value)) {
    throw new Error("Difficulte invalide.");
  }

  return value;
}

function ensureTextLimit(value, maxLength, label) {
  const normalized = String(value ?? "").trim();

  if (normalized.length > maxLength) {
    throw new Error(`${label} est trop long.`);
  }

  return normalized;
}

function ensureChoiceList(values, maxItems, maxLength, label) {
  const normalized = (values ?? [])
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  if (normalized.length > maxItems) {
    throw new Error(`${label} contient trop d'elements.`);
  }

  for (const entry of normalized) {
    if (entry.length > maxLength) {
      throw new Error(`Un element de ${label.toLowerCase()} est trop long.`);
    }
  }

  return normalized;
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

  const manualChoices = question.metadata?.mcqChoices ?? question.metadata?.mcq_choices;
  const manualDistractors = question.metadata?.distractors;

  if (Array.isArray(manualChoices) && manualChoices.length >= 2) {
    return true;
  }

  if (Array.isArray(manualDistractors) && manualDistractors.length >= 1) {
    return true;
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

function normalizeChoiceList(values) {
  return [...new Set((values ?? []).map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function buildQuestionMetadata(baseMetadata = {}, questionType = "text", distractors = []) {
  const metadata = { ...(baseMetadata ?? {}) };
  delete metadata.answerMode;
  delete metadata.distractors;
  delete metadata.mcqChoices;
  delete metadata.mcq_choices;

  if (questionType === "mcq") {
    return {
      ...metadata,
      answerMode: "mcq",
      distractors: normalizeChoiceList(distractors)
    };
  }

  return {
    ...metadata,
    answerMode: "text"
  };
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
      hard: 0,
      cinephile: 0
    };
    const remainingDifficultyCounts = {
      easy: 0,
      medium: 0,
      hard: 0,
      cinephile: 0
    };

    for (const question of this.state.questions) {
      if (!Object.hasOwn(difficultyCounts, question.difficulty)) {
        continue;
      }

      difficultyCounts[question.difficulty] += 1;

      if (!this.state.answeredQuestionIds.has(question.id)) {
        remainingDifficultyCounts[question.difficulty] += 1;
      }
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
        easy: {
          total: difficultyCounts.easy,
          remaining: remainingDifficultyCounts.easy
        },
        medium: {
          total: difficultyCounts.medium,
          remaining: remainingDifficultyCounts.medium
        },
        hard: {
          total: difficultyCounts.hard,
          remaining: remainingDifficultyCounts.hard
        },
        cinephile: {
          total: difficultyCounts.cinephile,
          remaining: remainingDifficultyCounts.cinephile
        },
        total: {
          total: this.state.questions.length,
          remaining: this.#getRemainingQuestionCount()
        }
      }
    };
  }

  setDifficulty(difficulty) {
    this.state.difficulty = normalizeDifficulty(difficulty);
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
    questionType,
    answer,
    aliases,
    distractors,
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

    const normalizedReason = ensureTextLimit(reason, INPUT_LIMITS.reason, "L'explication");

    const effectiveQuestionType =
      type === "edit"
        ? questionType === "mcq"
          ? "mcq"
          : "text"
        : shouldUseMultipleChoice(currentQuestion)
          ? "mcq"
          : "text";
    const trimmedPrompt = ensureTextLimit(prompt, INPUT_LIMITS.prompt, "La question");
    const trimmedAnswer = ensureTextLimit(answer, INPUT_LIMITS.answer, "La reponse");
    const effectivePrompt = type === "edit" ? trimmedPrompt || currentQuestion.prompt : null;
    const effectiveAnswer = type === "edit" ? trimmedAnswer || currentQuestion.answer : null;
    const effectiveAliases =
      type === "edit" && effectiveQuestionType !== "mcq"
        ? trimmedAnswer
          ? ensureChoiceList(
              aliases,
              INPUT_LIMITS.aliases,
              INPUT_LIMITS.aliasLength,
              "Les reponses acceptees supplementaires"
            )
          : currentQuestion.acceptedAnswers.slice(1)
        : [];
    const effectiveDistractors =
      type === "edit" && effectiveQuestionType === "mcq"
        ? (distractors ?? []).length
          ? ensureChoiceList(
              distractors,
              INPUT_LIMITS.distractors,
              INPUT_LIMITS.distractorLength,
              "Les fausses reponses"
            )
          : currentQuestion.metadata?.distractors ?? []
        : [];

    if (type === "edit" && (!effectivePrompt.trim() || !effectiveAnswer.trim())) {
      throw new Error("Une proposition de modification doit contenir une question et une reponse.");
    }

    if (type === "edit" && effectiveQuestionType === "mcq" && effectiveDistractors.length < 2) {
      throw new Error("Une proposition de QCM doit contenir au moins 2 fausses reponses.");
    }

    await this.gameRepository.submitQuestionFeedback({
      type,
      questionId,
      reason: normalizedReason,
      questionSnapshot: currentQuestion.toJSON(),
      proposedPrompt: effectivePrompt,
      proposedAnswer: effectiveAnswer,
      proposedAcceptedAnswers: effectiveAliases,
      proposedDifficulty: type === "edit" ? normalizeDifficulty(difficulty) : null,
      proposedMetadata:
        type === "edit"
          ? {
              answerMode: effectiveQuestionType,
              distractors: effectiveQuestionType === "mcq" ? effectiveDistractors : []
            }
          : {}
    });

    await this.#refreshModerationRequests();
    return this.getViewModel();
  }

  async submitNewQuestionSuggestion({
    prompt,
    questionType,
    answer,
    aliases,
    distractors,
    difficulty,
    reason
  }) {
    this.#assertCanUseSupabaseProfile();

    if (typeof this.gameRepository.submitNewQuestionSuggestion !== "function") {
      throw new Error("Les propositions de questions ne sont pas disponibles dans ce mode.");
    }

    if (!prompt.trim() || !answer.trim()) {
      throw new Error("Une nouvelle question doit contenir une question et une reponse.");
    }

    const normalizedPrompt = ensureTextLimit(prompt, INPUT_LIMITS.prompt, "La question");
    const normalizedAnswer = ensureTextLimit(answer, INPUT_LIMITS.answer, "La reponse");
    const normalizedReason = ensureTextLimit(reason, INPUT_LIMITS.reason, "L'explication");
    const normalizedAliases = ensureChoiceList(
      aliases,
      INPUT_LIMITS.aliases,
      INPUT_LIMITS.aliasLength,
      "Les reponses acceptees supplementaires"
    );
    const normalizedDistractors = ensureChoiceList(
      distractors,
      INPUT_LIMITS.distractors,
      INPUT_LIMITS.distractorLength,
      "Les fausses reponses"
    );

    if (questionType === "mcq" && normalizedDistractors.length < 2) {
      throw new Error("Un QCM doit contenir au moins 2 fausses reponses.");
    }

    await this.gameRepository.submitNewQuestionSuggestion({
      prompt: normalizedPrompt,
      questionType,
      answer: normalizedAnswer,
      acceptedAnswers: normalizedAliases,
      distractors: normalizedDistractors,
      difficulty: normalizeDifficulty(difficulty),
      reason: normalizedReason
    });

    await this.#refreshModerationRequests();
    return this.getViewModel();
  }

  async refreshModerationRequests() {
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

  async saveQuestionOverride({ questionId, prompt, questionType, answer, aliases, distractors, difficulty }) {
    const currentQuestion = this.#findQuestion(questionId);

    if (!currentQuestion) {
      throw new Error("Question introuvable.");
    }

    const effectiveQuestionType = questionType === "mcq" ? "mcq" : "text";
    const normalizedPrompt = ensureTextLimit(prompt, INPUT_LIMITS.prompt, "La question");
    const normalizedAnswer = ensureTextLimit(answer, INPUT_LIMITS.answer, "La reponse");
    const normalizedAliases = ensureChoiceList(
      aliases,
      INPUT_LIMITS.aliases,
      INPUT_LIMITS.aliasLength,
      "Les reponses acceptees supplementaires"
    );
    const normalizedDistractors = ensureChoiceList(
      distractors,
      INPUT_LIMITS.distractors,
      INPUT_LIMITS.distractorLength,
      "Les fausses reponses"
    );
    const acceptedAnswers = [normalizedAnswer, ...normalizedAliases]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean);
    const metadata = buildQuestionMetadata(
      currentQuestion.metadata,
      effectiveQuestionType,
      normalizedDistractors
    );

    if (this.state.profile.isAdmin && typeof this.gameRepository.updateQuestion === "function") {
      await this.gameRepository.updateQuestion({
        questionId,
        prompt: normalizedPrompt,
        answer: normalizedAnswer,
        acceptedAnswers,
        difficulty: normalizeDifficulty(difficulty),
        metadata
      });

      await this.#reloadQuestions();
      this.state.currentResult = null;
      this.state.currentQuestion = this.#resolveQuestionAfterEdition(questionId);
      this.state.currentChoices = this.#buildAnswerChoices(this.state.currentQuestion);
      return this.getViewModel();
    }

    this.patchRepository.saveOverride(questionId, {
      prompt: normalizedPrompt,
      answer: normalizedAnswer,
      acceptedAnswers,
      difficulty,
      metadata
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

    const manualChoices = normalizeChoiceList(
      question.metadata?.mcqChoices ?? question.metadata?.mcq_choices ?? []
    );
    const manualDistractors = normalizeChoiceList(question.metadata?.distractors ?? []);

    if (manualChoices.length) {
      return shuffle(normalizeChoiceList([question.answer, ...manualChoices]));
    }

    if (manualDistractors.length) {
      return shuffle(normalizeChoiceList([question.answer, ...manualDistractors]));
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
