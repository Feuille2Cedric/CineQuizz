import { QuizApp } from "../application/QuizApp.js";
import { QuestionCatalogRepository } from "../infrastructure/catalog/QuestionCatalogRepository.js";
import { SupabaseQuestionCatalogRepository } from "../infrastructure/catalog/SupabaseQuestionCatalogRepository.js";
import { BrowserGameRepository } from "../infrastructure/persistence/BrowserGameRepository.js";
import { LocalQuestionPatchRepository } from "../infrastructure/persistence/LocalQuestionPatchRepository.js";
import {
  createSupabaseClient,
  hasSupabaseRuntime
} from "../infrastructure/supabase/createSupabaseClient.js";
import { SupabaseGameRepository } from "../infrastructure/supabase/SupabaseGameRepository.js";

const dom = {
  pageShell: document.getElementById("page-shell"),
  authGate: document.getElementById("auth-gate"),
  storageMode: document.getElementById("storage-mode"),
  modeSwitchButton: document.getElementById("mode-switch-button"),
  syncStatus: document.getElementById("sync-status"),
  authPanel: document.getElementById("auth-panel"),
  authKicker: document.getElementById("auth-kicker"),
  authTitle: document.getElementById("auth-title"),
  authModeCopy: document.getElementById("auth-mode-copy"),
  authForm: document.getElementById("auth-form"),
  authModeSignin: document.getElementById("auth-mode-signin"),
  authModeSignup: document.getElementById("auth-mode-signup"),
  authLocalButton: document.getElementById("auth-local-button"),
  authReady: document.getElementById("auth-ready"),
  authReadyEmail: document.getElementById("auth-ready-email"),
  authContinueButton: document.getElementById("auth-continue-button"),
  authNicknameField: document.getElementById("auth-nickname-field"),
  authNicknameInput: document.getElementById("auth-nickname-input"),
  authIdentifierLabel: document.getElementById("auth-identifier-label"),
  authEmailInput: document.getElementById("auth-email-input"),
  authPasswordInput: document.getElementById("auth-password-input"),
  authSubmitButton: document.getElementById("auth-submit-button"),
  adminBadge: document.getElementById("admin-badge"),
  authSession: document.getElementById("auth-session"),
  authEmailValue: document.getElementById("auth-email-value"),
  authSignoutButton: document.getElementById("auth-signout-button"),
  authStatus: document.getElementById("auth-status"),
  adminTabButton: document.getElementById("admin-tab-button"),
  tabs: [...document.querySelectorAll(".tab")],
  panels: [...document.querySelectorAll(".tab-panel")],
  difficultyButtons: [...document.querySelectorAll(".difficulty-button")],
  nicknameForm: document.getElementById("nickname-form"),
  nicknameInput: document.getElementById("nickname-input"),
  nicknameSubmitButton: document.querySelector('#nickname-form button[type="submit"]'),
  questionCard: document.querySelector(".question-card"),
  questionDifficulty: document.getElementById("question-difficulty"),
  questionProgress: document.getElementById("question-progress"),
  questionText: document.getElementById("question-text"),
  answerForm: document.getElementById("answer-form"),
  answerInputBlock: document.getElementById("answer-input-block"),
  answerInputLabel: document.getElementById("answer-input-label"),
  answerInput: document.getElementById("answer-input"),
  answerChoiceGroup: document.getElementById("answer-choice-group"),
  answerSubmitButton: document.querySelector('#answer-form button[type="submit"]'),
  nextQuestionButton: document.getElementById("next-question-button"),
  answerFeedback: document.getElementById("answer-feedback"),
  contributionToggleButton: document.getElementById("contribution-toggle-button"),
  editToggleButton: document.getElementById("edit-toggle-button"),
  adminDeleteQuestionButton: document.getElementById("admin-delete-question-button"),
  editPanel: document.getElementById("edit-panel"),
  editForm: document.getElementById("edit-form"),
  editPrompt: document.getElementById("edit-prompt"),
  editAnswer: document.getElementById("edit-answer"),
  editAliases: document.getElementById("edit-aliases"),
  editDifficulty: document.getElementById("edit-difficulty"),
  clearOverrideButton: document.getElementById("clear-override-button"),
  contributionStatus: document.getElementById("contribution-status"),
  contributionQuestionMeta: document.getElementById("contribution-question-meta"),
  contributionQuestionText: document.getElementById("contribution-question-text"),
  questionFeedbackForm: document.getElementById("question-feedback-form"),
  questionFeedbackType: document.getElementById("question-feedback-type"),
  questionFeedbackReason: document.getElementById("question-feedback-reason"),
  feedbackEditFields: document.getElementById("feedback-edit-fields"),
  feedbackPrompt: document.getElementById("feedback-prompt"),
  feedbackAnswer: document.getElementById("feedback-answer"),
  feedbackAliasesFields: document.getElementById("feedback-aliases-fields"),
  feedbackAliases: document.getElementById("feedback-aliases"),
  feedbackMcqFields: document.getElementById("feedback-mcq-fields"),
  feedbackDistractors: document.getElementById("feedback-distractors"),
  feedbackDifficulty: document.getElementById("feedback-difficulty"),
  questionFeedbackSubmit: document.getElementById("question-feedback-submit"),
  newQuestionForm: document.getElementById("new-question-form"),
  newQuestionPrompt: document.getElementById("new-question-prompt"),
  newQuestionType: document.getElementById("new-question-type"),
  newQuestionAnswer: document.getElementById("new-question-answer"),
  newQuestionAliasesFields: document.getElementById("new-question-aliases-fields"),
  newQuestionAliases: document.getElementById("new-question-aliases"),
  newQuestionMcqFields: document.getElementById("new-question-mcq-fields"),
  newQuestionDistractors: document.getElementById("new-question-distractors"),
  newQuestionDifficulty: document.getElementById("new-question-difficulty"),
  newQuestionReason: document.getElementById("new-question-reason"),
  newQuestionSubmit: document.getElementById("new-question-submit"),
  adminRequestList: document.getElementById("admin-request-list"),
  leaderboardBody: document.getElementById("leaderboard-body"),
  statCorrect: document.getElementById("stat-correct"),
  statAnswered: document.getElementById("stat-answered"),
  statAccuracy: document.getElementById("stat-accuracy"),
  statRemaining: document.getElementById("stat-remaining"),
  statEasyRatio: document.getElementById("stat-easy-ratio"),
  statMediumRatio: document.getElementById("stat-medium-ratio"),
  statHardRatio: document.getElementById("stat-hard-ratio"),
  catalogEasy: document.getElementById("catalog-easy"),
  catalogMedium: document.getElementById("catalog-medium"),
  catalogHard: document.getElementById("catalog-hard"),
  catalogTotal: document.getElementById("catalog-total"),
  questionPackInput: document.getElementById("question-pack-input"),
  exportOverridesButton: document.getElementById("export-overrides-button"),
  resetCustomDataButton: document.getElementById("reset-custom-data-button"),
  dataMessage: document.getElementById("data-message")
};

const uiState = {
  editPanelOpen: false,
  editQuestionId: null,
  contributionQuestionId: null,
  entryDismissed: false,
  viewModel: null,
  authMode: "sign-in",
  authBusy: false,
  runtimePreference: null,
  supabaseAvailable: false
};

const RUNTIME_PREFERENCE_KEY = "cinequizz:runtime-preference";
const EMPTY_DIFFICULTY_STATS = {
  easy: { correct: 0, answered: 0 },
  medium: { correct: 0, answered: 0 },
  hard: { correct: 0, answered: 0 }
};

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function difficultyLabel(difficulty) {
  return {
    easy: "Facile",
    medium: "Moyen",
    hard: "Difficile"
  }[difficulty] ?? difficulty;
}

function serializeLeaderboardRows(entries, currentUserId) {
  if (!entries.length) {
    return `<tr><td colspan="5">Aucun score disponible pour le moment.</td></tr>`;
  }

  return entries
    .map((entry, index) => {
      const totalAnswered = entry.total_answered ?? entry.totalAnswered ?? 0;
      const totalCorrect = entry.total_correct ?? entry.totalCorrect ?? 0;
      const accuracy = totalAnswered ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
      const userId = entry.user_id ?? entry.userId;
      const rowClass = userId === currentUserId ? "current-user" : "";

      return `
        <tr class="${rowClass}">
          <td>${index + 1}</td>
          <td>${escapeHtml(entry.nickname)}</td>
          <td>${totalCorrect}</td>
          <td>${totalAnswered}</td>
          <td>${accuracy}%</td>
        </tr>
      `;
    })
    .join("");
}

function serializeModerationRequests(requests) {
  if (!requests.length) {
    return `<p class="empty-state">Aucune demande de moderation pour le moment.</p>`;
  }

  return requests
    .map((request) => {
      const snapshotPrompt = request.question_snapshot?.prompt;
      const prompt = request.proposed_prompt ?? snapshotPrompt ?? "Question non renseignee";
      const answer = request.proposed_answer ?? request.question_snapshot?.answer ?? "Non renseignee";
      const proposedMetadata = request.proposed_metadata ?? {};
      const isMcq = proposedMetadata.answerMode === "mcq";
      const distractors = Array.isArray(proposedMetadata.distractors)
        ? proposedMetadata.distractors
        : [];
      const difficulty =
        request.proposed_difficulty ??
        request.question_snapshot?.difficulty ??
        (request.request_type === "report" ? "-" : "medium");
      const isPending = request.status === "pending";

      return `
        <article class="request-card">
          <div class="request-topline">
            <div>
              <p class="request-badges">
                <span class="mode-pill">${escapeHtml(request.request_type)}</span>
                <span class="mode-pill request-status request-status-${escapeHtml(request.status)}">${escapeHtml(request.status)}</span>
              </p>
              <h3>${escapeHtml(prompt)}</h3>
            </div>
            <p class="request-meta">
              ${escapeHtml(request.requester_nickname)} | ${new Date(request.created_at).toLocaleString("fr-FR")}
            </p>
          </div>

          <div class="request-body">
            <p><strong>Question cible:</strong> ${escapeHtml(request.question_id ?? "nouvelle question")}</p>
            <p><strong>Difficulte:</strong> ${escapeHtml(difficulty)}</p>
            <p><strong>Type:</strong> ${isMcq ? "QCM" : "Question normale"}</p>
            <p><strong>Reponse:</strong> ${escapeHtml(answer)}</p>
            ${
              distractors.length
                ? `<p><strong>Fausses reponses:</strong> ${escapeHtml(distractors.join(" | "))}</p>`
                : ""
            }
            <p><strong>Motif:</strong> ${escapeHtml(request.reason || "Aucun detail")}</p>
            ${
              request.admin_note
                ? `<p><strong>Note admin:</strong> ${escapeHtml(request.admin_note)}</p>`
                : ""
            }
          </div>

          ${
            isPending
              ? `<div class="action-row request-actions">
                  <button type="button" class="primary-button" data-admin-action="approve" data-request-id="${escapeHtml(request.id)}">
                    Valider
                  </button>
                  <button type="button" class="ghost-button" data-admin-action="reject" data-request-id="${escapeHtml(request.id)}">
                    Refuser
                  </button>
                  ${
                    request.question_id
                      ? `<button type="button" class="ghost-button danger-button" data-admin-action="delete-question" data-request-id="${escapeHtml(request.id)}" data-question-id="${escapeHtml(request.question_id)}">
                          Retirer la question
                        </button>`
                      : ""
                  }
                </div>`
              : ""
          }
        </article>
      `;
    })
    .join("");
}

function setFeedbackMessage(message, variant = "") {
  dom.answerFeedback.textContent = message;
  dom.answerFeedback.className = "feedback";

  if (variant) {
    dom.answerFeedback.classList.add(variant);
  }
}

function setAnswerFieldState(state = "") {
  dom.answerInput.classList.remove("is-correct", "is-wrong");
  dom.questionCard.classList.remove("is-correct", "is-wrong");

  if (state) {
    dom.answerInput.classList.add(state);
    dom.questionCard.classList.add(state);
  }
}

function escapeAttribute(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

function renderAnswerChoices(viewModel) {
  const isMcq = viewModel.answerMode === "mcq";
  const selectedChoice = dom.answerForm.dataset.selectedChoice ?? "";

  dom.answerForm.dataset.answerMode = isMcq ? "mcq" : "text";
  dom.answerChoiceGroup.classList.toggle("is-hidden", !isMcq);
  dom.answerInputBlock.classList.toggle("is-hidden", isMcq);
  dom.answerInputBlock.hidden = isMcq;
  dom.answerInputBlock.style.display = isMcq ? "none" : "";
  dom.answerInputLabel.setAttribute("aria-hidden", String(isMcq));
  dom.answerInput.classList.toggle("is-hidden", isMcq);
  dom.answerInput.style.display = isMcq ? "none" : "";

  if (!isMcq) {
    dom.answerChoiceGroup.innerHTML = "";
    dom.answerForm.dataset.selectedChoice = "";
    return;
  }

  dom.answerChoiceGroup.innerHTML = viewModel.currentChoices
    .map((choice) => {
      const isSelected = choice === selectedChoice;
      const isCorrectChoice = viewModel.currentResult && choice === viewModel.currentResult.expectedAnswer;
      const isWrongSelected =
        viewModel.currentResult &&
        !viewModel.currentResult.isCorrect &&
        isSelected &&
        choice !== viewModel.currentResult.expectedAnswer;

      const classes = [
        "answer-choice",
        isSelected ? "is-selected" : "",
        isCorrectChoice ? "is-correct" : "",
        isWrongSelected ? "is-wrong" : ""
      ]
        .filter(Boolean)
        .join(" ");

      return `
        <button
          type="button"
          class="${classes}"
          data-answer-choice="${escapeAttribute(choice)}"
        >
          ${escapeHtml(choice)}
        </button>
      `;
    })
    .join("");
}

function setAuthMode(mode) {
  uiState.authMode = mode === "sign-up" ? "sign-up" : "sign-in";
  dom.authForm.dataset.mode = uiState.authMode;
  setAuthStatus("");
  dom.authPasswordInput.value = "";
  renderAuthMode();

  if (uiState.authMode === "sign-up") {
    dom.authNicknameInput.focus();
  } else {
    dom.authEmailInput.focus();
  }
}

function renderAuthMode() {
  const isSignUp = uiState.authMode === "sign-up";
  const buttonLabel = uiState.authBusy
    ? isSignUp
      ? "Creation..."
      : "Connexion..."
    : isSignUp
      ? "Creer un compte"
      : "Se connecter";

  dom.authModeSignin.classList.toggle("is-active", !isSignUp);
  dom.authModeSignup.classList.toggle("is-active", isSignUp);
  dom.authForm.dataset.mode = uiState.authMode;
  dom.authModeSignin.disabled = uiState.authBusy;
  dom.authModeSignup.disabled = uiState.authBusy;
  dom.authNicknameField.classList.toggle("is-hidden", !isSignUp);
  dom.authNicknameField.hidden = !isSignUp;
  dom.authNicknameField.setAttribute("aria-hidden", String(!isSignUp));
  dom.authNicknameInput.disabled = uiState.authBusy || !isSignUp;
  dom.authNicknameInput.required = isSignUp;
  dom.authEmailInput.disabled = uiState.authBusy;
  dom.authPasswordInput.disabled = uiState.authBusy;
  dom.authLocalButton.disabled = uiState.authBusy;
  dom.authKicker.textContent = isSignUp ? "Inscription" : "Connexion";
  dom.authTitle.textContent = isSignUp ? "Creer un compte" : "Entrer dans CineQuizz";
  dom.authModeCopy.textContent = isSignUp
    ? "Choisissez un pseudo unique, ajoutez votre e-mail, puis creez votre compte."
    : "Connectez-vous avec votre e-mail ou votre pseudo pour reprendre votre progression.";
  dom.authIdentifierLabel.textContent = isSignUp ? "E-mail" : "E-mail ou pseudo";
  dom.authEmailInput.placeholder = isSignUp
    ? "vous@example.com"
    : "vous@example.com ou votre pseudo";
  dom.authEmailInput.autocomplete = isSignUp ? "email" : "username";
  dom.authPasswordInput.autocomplete = isSignUp ? "new-password" : "current-password";
  dom.authSubmitButton.disabled = uiState.authBusy;
  dom.authSubmitButton.textContent = buttonLabel;
}

function setAuthStatus(message = "", variant = "") {
  dom.authStatus.textContent = message;
  dom.authStatus.className = "auth-status";

  if (variant) {
    dom.authStatus.classList.add(variant);
  }
}

function setAuthBusy(isBusy) {
  uiState.authBusy = isBusy;
  renderAuthMode();
}

function reportUiError(error) {
  console.error(error);
  dom.dataMessage.textContent = error.message;
  setFeedbackMessage(`Erreur: ${error.message}`, "is-wrong");
}

function reportAuthError(error) {
  console.error(error);
  setAuthStatus(error.message, "is-error");
  dom.dataMessage.textContent = error.message;
}

function fillEditForm(question) {
  if (!question) {
    return;
  }

  dom.editForm.dataset.questionId = question.id;
  dom.editPrompt.value = question.prompt;
  dom.editAnswer.value = question.answer;
  dom.editAliases.value = question.acceptedAnswers.slice(1).join(", ");
  dom.editDifficulty.value = question.difficulty;
}

function fillContributionEditForm(question, canRevealAnswer = false) {
  if (!question) {
    return;
  }

  const isMcq = questionUsesMultipleChoice(question);
  dom.feedbackPrompt.value = question.prompt;
  dom.feedbackAnswer.value = canRevealAnswer ? question.answer : "";
  dom.feedbackAnswer.placeholder = canRevealAnswer
    ? ""
    : "Reponse masquee tant que vous n'avez pas repondu. Laissez vide pour conserver la reponse actuelle.";
  dom.feedbackAliases.value = !isMcq && canRevealAnswer ? question.acceptedAnswers.slice(1).join(", ") : "";
  dom.feedbackDistractors.value = isMcq
    ? (question.metadata?.distractors ?? []).map((value) => String(value ?? "").trim()).filter(Boolean).join("\n")
    : "";
  dom.feedbackDifficulty.value = question.difficulty;
}

function questionUsesMultipleChoice(question) {
  if (!question) {
    return false;
  }

  const manualChoices = question.metadata?.mcqChoices ?? question.metadata?.mcq_choices;
  const manualDistractors = question.metadata?.distractors;
  const answerLength = String(question.answer ?? "").trim().length;
  const answerWordCount = String(question.answer ?? "").trim().split(/\s+/).filter(Boolean).length;

  return (
    question.metadata?.answerMode !== "text" &&
    (
      question.metadata?.answerMode === "mcq" ||
      (Array.isArray(manualChoices) && manualChoices.length >= 2) ||
      (Array.isArray(manualDistractors) && manualDistractors.length >= 1) ||
      answerLength >= 90 ||
      answerWordCount >= 14
    )
  );
}

function setContributionFieldVisibility(element, shouldShow, displayValue = "grid") {
  element.classList.toggle("is-hidden", !shouldShow);
  element.hidden = !shouldShow;
  element.style.display = shouldShow ? displayValue : "none";
}

function syncContributionMode() {
  const wantsEdit = dom.questionFeedbackType.value === "edit";
  const isMcq = questionUsesMultipleChoice(uiState.viewModel?.currentQuestion);

  setContributionFieldVisibility(dom.feedbackEditFields, wantsEdit);
  setContributionFieldVisibility(dom.feedbackAliasesFields, wantsEdit && !isMcq);
  setContributionFieldVisibility(dom.feedbackMcqFields, wantsEdit && isMcq);

  dom.feedbackAliases.disabled = !wantsEdit || isMcq;
  dom.feedbackDistractors.disabled = !wantsEdit || !isMcq;
}

function syncNewQuestionMode() {
  const isMcq = dom.newQuestionType.value === "mcq";
  dom.newQuestionForm.dataset.questionType = isMcq ? "mcq" : "text";
  setContributionFieldVisibility(dom.newQuestionAliasesFields, !isMcq);
  setContributionFieldVisibility(dom.newQuestionMcqFields, isMcq);

  dom.newQuestionAliases.disabled = dom.newQuestionType.disabled || isMcq;
  dom.newQuestionDistractors.disabled = dom.newQuestionType.disabled || !isMcq;
}

function render(viewModel) {
  uiState.viewModel = viewModel;
  const difficultyStats = viewModel.stats.byDifficulty ?? EMPTY_DIFFICULTY_STATS;
  renderAuthMode();

  const isSupabase = viewModel.mode === "supabase";
  const requiresAuth = isSupabase && !viewModel.auth.isAuthenticated;
  const canContribute = Boolean(viewModel.canContribute);
  const shouldShowEntry = isSupabase && (!uiState.entryDismissed || requiresAuth);
  const activeQuestionId = viewModel.currentQuestion?.id ?? null;
  const canEditQuestion = Boolean(activeQuestionId) && viewModel.profile.isAdmin;
  const canAdministerQuestion = Boolean(activeQuestionId) && viewModel.profile.isAdmin;

  if (uiState.editQuestionId !== activeQuestionId) {
    uiState.editPanelOpen = false;
    uiState.editQuestionId = activeQuestionId;
  }

  if (uiState.contributionQuestionId !== activeQuestionId) {
    uiState.contributionQuestionId = activeQuestionId;

    if (viewModel.currentQuestion) {
      fillContributionEditForm(viewModel.currentQuestion, viewModel.canRevealCurrentAnswer);
    } else {
      dom.feedbackPrompt.value = "";
      dom.feedbackAnswer.value = "";
      dom.feedbackAliases.value = "";
      dom.feedbackDifficulty.value = "medium";
    }
  }

  dom.storageMode.textContent = isSupabase ? "Mode Supabase" : "Mode local";
  dom.syncStatus.textContent = isSupabase
    ? requiresAuth
      ? "Supabase est configure. Connectez-vous pour charger votre progression et le classement."
      : "Questions, progression et classement charges depuis Supabase."
    : uiState.supabaseAvailable
      ? "Mode local actif. Votre progression reste sur cet appareil. Vous pouvez repasser a Supabase a tout moment."
      : "Progression stockee dans ce navigateur. Configurez config.js pour activer Supabase.";
  dom.modeSwitchButton.classList.toggle("is-hidden", !uiState.supabaseAvailable || isSupabase);
  dom.authLocalButton.classList.toggle("is-hidden", !uiState.supabaseAvailable);

  dom.pageShell.classList.toggle("is-hidden", shouldShowEntry);
  dom.authGate.classList.toggle("is-hidden", !shouldShowEntry);
  dom.authForm.classList.toggle("is-hidden", !requiresAuth);
  dom.authReady.classList.toggle("is-hidden", !shouldShowEntry || requiresAuth || !viewModel.auth.isAuthenticated);
  dom.authReadyEmail.textContent = viewModel.auth.email ?? "";
  dom.authSession.classList.toggle("is-hidden", !isSupabase || !viewModel.auth.isAuthenticated);
  dom.authEmailValue.textContent = viewModel.auth.email ?? "";
  dom.adminBadge.classList.toggle("is-hidden", !viewModel.profile.isAdmin);
  dom.adminTabButton.classList.toggle("is-hidden", !viewModel.profile.isAdmin);

  if (!viewModel.profile.isAdmin && document.querySelector("#admin-tab.is-active")) {
    activateTab("quiz-tab");
  }

  dom.nicknameInput.value = viewModel.profile.nickname ?? "";
  dom.nicknameInput.disabled = requiresAuth;
  dom.nicknameSubmitButton.disabled = requiresAuth;

  if (!dom.authNicknameInput.value && viewModel.profile.nickname && viewModel.profile.nickname !== "Spectateur") {
    dom.authNicknameInput.value = viewModel.profile.nickname;
  }

  dom.statCorrect.textContent = viewModel.stats.totalCorrect;
  dom.statAnswered.textContent = viewModel.stats.totalAnswered;
  dom.statAccuracy.textContent = `${viewModel.stats.accuracy}%`;
  dom.statRemaining.textContent = viewModel.stats.remaining;
  dom.statEasyRatio.textContent = `${difficultyStats.easy.correct} / ${difficultyStats.easy.answered}`;
  dom.statMediumRatio.textContent = `${difficultyStats.medium.correct} / ${difficultyStats.medium.answered}`;
  dom.statHardRatio.textContent = `${difficultyStats.hard.correct} / ${difficultyStats.hard.answered}`;

  dom.catalogEasy.textContent = viewModel.catalogCounts.easy;
  dom.catalogMedium.textContent = viewModel.catalogCounts.medium;
  dom.catalogHard.textContent = viewModel.catalogCounts.hard;
  dom.catalogTotal.textContent = viewModel.catalogCounts.total;

  for (const button of dom.difficultyButtons) {
    button.classList.toggle("is-active", button.dataset.difficulty === viewModel.difficulty);
  }

  dom.questionDifficulty.textContent = difficultyLabel(viewModel.difficulty);
  dom.questionProgress.textContent = requiresAuth
    ? "Connexion requise pour jouer en mode Supabase"
    : `${viewModel.stats.remainingForDifficulty} question(s) restante(s) sur cette difficulte`;
  dom.contributionToggleButton.classList.toggle("is-hidden", !canContribute || !activeQuestionId);
  dom.editToggleButton.classList.toggle("is-hidden", !canEditQuestion);
  dom.adminDeleteQuestionButton.classList.toggle("is-hidden", !canAdministerQuestion);
  dom.editToggleButton.textContent = uiState.editPanelOpen
    ? "Masquer l'editeur"
    : "Corriger cette question";

  if (requiresAuth) {
    dom.questionText.textContent =
      "Connectez-vous ou creez un compte pour conserver votre progression et participer au classement global.";
    dom.answerInput.value = "";
    dom.answerForm.dataset.selectedChoice = "";
    dom.answerInput.disabled = true;
    dom.answerSubmitButton.disabled = true;
    dom.nextQuestionButton.disabled = true;
    dom.editPanel.classList.add("is-hidden");
    setAnswerFieldState();
    setFeedbackMessage("Mode Supabase actif. Authentification requise.");
  } else if (!viewModel.currentQuestion) {
    dom.questionText.textContent =
      "Toutes les questions de cette difficulte ont deja ete repondues pour ce profil.";
    dom.answerInput.value = "";
    dom.answerForm.dataset.selectedChoice = "";
    dom.answerInput.disabled = true;
    dom.answerSubmitButton.disabled = true;
    dom.nextQuestionButton.disabled = true;
    dom.editPanel.classList.add("is-hidden");
    setAnswerFieldState();
    setFeedbackMessage("Changez de difficulte ou importez de nouvelles questions.");
  } else {
    dom.questionText.textContent = viewModel.currentQuestion.prompt;
    dom.answerInput.disabled = viewModel.answerMode === "mcq";
    dom.answerSubmitButton.disabled = false;
    dom.nextQuestionButton.disabled = false;
    fillEditForm(viewModel.currentQuestion);

    if (viewModel.answerMode !== "mcq" && viewModel.currentResult === null) {
      dom.answerForm.dataset.selectedChoice = "";
    }

    if (!viewModel.currentResult) {
      setAnswerFieldState();
      setFeedbackMessage(
        viewModel.answerMode === "mcq"
          ? "QCM active pour cette question. Choisissez une proposition puis validez."
          : "Pret. Tapez votre reponse puis validez."
      );
    } else if (viewModel.currentResult.isCorrect) {
      setAnswerFieldState("is-correct");
      setFeedbackMessage(
        `Bonne reponse. La reponse attendue etait: ${viewModel.currentResult.expectedAnswer}`,
        "is-correct"
      );
    } else {
      setAnswerFieldState("is-wrong");
      setFeedbackMessage(
        `Incorrect. Votre reponse: ${viewModel.currentResult.submittedAnswer || "(vide)"}\nBonne reponse: ${viewModel.currentResult.expectedAnswer}`,
        "is-wrong"
      );
    }
  }

  renderAnswerChoices(viewModel);

  dom.editPanel.classList.toggle("is-hidden", !canEditQuestion || !uiState.editPanelOpen);
  syncContributionMode();

  if (!canContribute) {
    dom.contributionStatus.textContent = isSupabase
      ? "Connectez-vous pour envoyer des signalements, proposer des modifications ou soumettre de nouvelles questions."
      : "Les contributions communautaires sont disponibles uniquement en mode Supabase.";
  } else if (viewModel.currentQuestion && !viewModel.canRevealCurrentAnswer) {
    dom.contributionStatus.textContent =
      "Vous pouvez signaler la question tout de suite. La bonne reponse ne sera revelee dans ce formulaire qu'apres avoir repondu a la question.";
  } else {
    dom.contributionStatus.textContent =
      "Vos demandes arrivent dans la file de moderation. Un administrateur peut les valider ou les refuser.";
  }

  dom.questionFeedbackForm.classList.toggle("is-hidden", !viewModel.currentQuestion);
  dom.questionFeedbackType.disabled = !canContribute || !viewModel.currentQuestion;
  dom.questionFeedbackReason.disabled = !canContribute || !viewModel.currentQuestion;
  dom.feedbackPrompt.disabled = !canContribute;
  dom.feedbackAnswer.disabled = !canContribute;
  dom.feedbackAliases.disabled = !canContribute;
  dom.feedbackDistractors.disabled = !canContribute;
  dom.feedbackDifficulty.disabled = !canContribute;
  dom.questionFeedbackSubmit.disabled = !canContribute || !viewModel.currentQuestion;
  dom.newQuestionPrompt.disabled = !canContribute;
  dom.newQuestionType.disabled = !canContribute;
  dom.newQuestionAnswer.disabled = !canContribute;
  dom.newQuestionDifficulty.disabled = !canContribute;
  dom.newQuestionReason.disabled = !canContribute;
  dom.newQuestionSubmit.disabled = !canContribute;
  syncNewQuestionMode();

  if (!viewModel.currentQuestion) {
    dom.contributionQuestionMeta.textContent = "Aucune question active.";
    dom.contributionQuestionText.textContent =
      "Chargez une question pour envoyer un signalement ou proposer une meilleure version.";
  } else {
    dom.contributionQuestionMeta.textContent = `${difficultyLabel(viewModel.currentQuestion.difficulty)} | ${viewModel.currentQuestion.id}`;
    dom.contributionQuestionText.textContent = viewModel.currentQuestion.prompt;
  }

  dom.leaderboardBody.innerHTML = serializeLeaderboardRows(
    viewModel.leaderboard,
    viewModel.profile.userId
  );
  dom.adminRequestList.innerHTML = serializeModerationRequests(viewModel.moderationRequests);
}

function activateTab(targetId) {
  for (const tab of dom.tabs) {
    tab.classList.toggle("is-active", tab.dataset.tabTarget === targetId);
  }

  for (const panel of dom.panels) {
    panel.classList.toggle("is-active", panel.id === targetId);
  }
}

function downloadJson(filename, contents) {
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildRuntimeServices() {
  const runtimeConfig = window.CINEQUIZZ_CONFIG ?? {};
  const runtimePreference = window.localStorage.getItem(RUNTIME_PREFERENCE_KEY) ?? "auto";

  if (runtimePreference === "local" || !hasSupabaseRuntime(runtimeConfig)) {
    return {
      supabaseAvailable: hasSupabaseRuntime(runtimeConfig),
      catalogRepository: new QuestionCatalogRepository(),
      gameRepository: new BrowserGameRepository()
    };
  }

  const client = createSupabaseClient(runtimeConfig);

  return {
    supabaseAvailable: true,
    catalogRepository: new SupabaseQuestionCatalogRepository(client),
    gameRepository: new SupabaseGameRepository(client)
  };
}

async function main() {
  const patchRepository = new LocalQuestionPatchRepository();
  let app;

  async function bootApplication() {
    let { catalogRepository, gameRepository, supabaseAvailable } = buildRuntimeServices();
    uiState.supabaseAvailable = supabaseAvailable;
    uiState.runtimePreference = window.localStorage.getItem(RUNTIME_PREFERENCE_KEY) ?? "auto";

    app = new QuizApp({
      catalogRepository,
      patchRepository,
      gameRepository
    });

    let viewModel;
    let startupMessage = "";

    try {
      viewModel = await app.initialize(window.localStorage.getItem("cinequizz:last-nickname") ?? "");
    } catch (error) {
      console.error(error);
      window.localStorage.setItem(RUNTIME_PREFERENCE_KEY, "local");
      uiState.runtimePreference = "local";
      uiState.supabaseAvailable = supabaseAvailable;
      app = new QuizApp({
        catalogRepository: new QuestionCatalogRepository(),
        patchRepository,
        gameRepository: new BrowserGameRepository()
      });
      viewModel = await app.initialize(window.localStorage.getItem("cinequizz:last-nickname") ?? "");
      startupMessage = `Supabase indisponible, retour au mode local: ${error.message}`;
    }

    render(viewModel);

    if (startupMessage) {
      dom.syncStatus.textContent = startupMessage;
    }
  }

  syncContributionMode();
  syncNewQuestionMode();
  renderAuthMode();
  dom.authForm.dataset.mode = uiState.authMode;

  async function ensureAppReady() {
    if (app) {
      return;
    }

    await bootApplication();
  }

  [dom.authModeSignin, dom.authModeSignup].filter(Boolean).forEach((button) => {
    button.addEventListener("click", () => {
      setAuthMode(button.dataset.authMode);
    });
  });

  dom.authForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      await ensureAppReady();
      setAuthStatus("");
      const action = dom.authForm.dataset.mode === "sign-up" ? "sign-up" : "sign-in";
      const identifier = dom.authEmailInput.value.trim();
      const password = dom.authPasswordInput.value;
      const preferredNickname = dom.authNicknameInput.value.trim();

      if (!identifier) {
        setAuthStatus("L'e-mail ou le pseudo est requis.", "is-error");
        return;
      }

      if (!password || password.length < 6) {
        setAuthStatus("Le mot de passe doit faire au moins 6 caracteres.", "is-error");
        return;
      }

      if (action === "sign-up" && !preferredNickname) {
        setAuthStatus("Le pseudo est requis pour creer un compte.", "is-error");
        return;
      }

      if (action === "sign-up" && preferredNickname.length < 3) {
        setAuthStatus("Le pseudo doit faire au moins 3 caracteres.", "is-error");
        return;
      }

      if (action === "sign-up" && !looksLikeEmail(identifier)) {
        setAuthStatus("Un e-mail valide est requis pour creer un compte.", "is-error");
        return;
      }

      setAuthBusy(true);

      const result =
        action === "sign-up"
          ? await app.signUp({ email: identifier, password, preferredNickname })
          : await app.signIn({ identifier, password });

      uiState.entryDismissed = result.viewModel.auth.isAuthenticated;
      if (action === "sign-up" && !result.viewModel.auth.isAuthenticated) {
        uiState.authMode = "sign-in";
      }
      render(result.viewModel);
      renderAuthMode();
      dom.authPasswordInput.value = "";
      dom.authNicknameInput.value = result.viewModel.auth.isAuthenticated
        ? result.viewModel.profile.nickname ?? ""
        : "";
      dom.nicknameInput.value = result.viewModel.profile.nickname ?? "";
      setAuthStatus(result.message, "is-success");
      dom.dataMessage.textContent = result.message;

      if (!dom.answerInput.disabled) {
        dom.answerInput.focus();
      } else {
        dom.authEmailInput.focus();
      }
    } catch (error) {
      reportAuthError(error);
    } finally {
      setAuthBusy(false);
    }
  });

  await bootApplication();

  dom.tabs.forEach((tabButton) => {
    tabButton.addEventListener("click", async () => {
      if (
        tabButton.dataset.tabTarget === "admin-tab" &&
        uiState.viewModel?.profile?.isAdmin &&
        typeof app.refreshModerationRequests === "function"
      ) {
        try {
          render(await app.refreshModerationRequests());
        } catch (error) {
          reportUiError(error);
        }
      }

      activateTab(tabButton.dataset.tabTarget);
    });
  });

  dom.difficultyButtons.forEach((button) => {
    button.addEventListener("click", () => {
      render(app.setDifficulty(button.dataset.difficulty));
      dom.answerInput.value = "";
      if (!dom.answerInput.disabled) {
        dom.answerInput.focus();
      }
    });
  });

  dom.nicknameForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const nickname = dom.nicknameInput.value.trim();

      if (!nickname || nickname.length < 3) {
        dom.dataMessage.textContent = "Le pseudo doit faire au moins 3 caracteres.";
        return;
      }

      window.localStorage.setItem("cinequizz:last-nickname", nickname);
      render(await app.updateNickname(nickname));
    } catch (error) {
      reportUiError(error);
    }
  });

  dom.authSignoutButton.addEventListener("click", async () => {
    try {
      uiState.entryDismissed = false;
      uiState.authMode = "sign-in";
      render(await app.signOut());
      renderAuthMode();
      dom.authPasswordInput.value = "";
      setAuthStatus("Session fermee.", "is-success");
      dom.authNicknameInput.value = dom.nicknameInput.value.trim();
      dom.dataMessage.textContent = "Deconnexion effectuee.";
      dom.authEmailInput.focus();
    } catch (error) {
      reportAuthError(error);
    }
  });

  dom.authContinueButton.addEventListener("click", () => {
    uiState.entryDismissed = true;
    render(uiState.viewModel);

    if (!dom.answerInput.disabled) {
      dom.answerInput.focus();
    }
  });

  dom.authLocalButton.addEventListener("click", async () => {
    window.localStorage.setItem(RUNTIME_PREFERENCE_KEY, "local");
    uiState.entryDismissed = true;
    await bootApplication();

    if (!dom.answerInput.disabled) {
      dom.answerInput.focus();
    }
  });

  dom.modeSwitchButton.addEventListener("click", async () => {
    window.localStorage.setItem(RUNTIME_PREFERENCE_KEY, "supabase");
    uiState.entryDismissed = false;
    await bootApplication();
    dom.authEmailInput.focus();
  });

  dom.answerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      if (uiState.viewModel?.answerMode === "mcq" && !dom.answerForm.dataset.selectedChoice) {
        setFeedbackMessage("Choisissez une proposition avant de valider.", "is-wrong");
        return;
      }

      const submittedAnswer =
        uiState.viewModel?.answerMode === "mcq"
          ? (dom.answerForm.dataset.selectedChoice ?? "").trim()
          : dom.answerInput.value.trim();

      render(await app.submitAnswer(submittedAnswer));
    } catch (error) {
      reportUiError(error);
    }
  });

  dom.answerChoiceGroup.addEventListener("click", (event) => {
    const button = event.target.closest("[data-answer-choice]");

    if (!button || uiState.viewModel?.currentResult) {
      return;
    }

    dom.answerForm.dataset.selectedChoice = button.dataset.answerChoice ?? "";
    renderAnswerChoices(uiState.viewModel);
  });

  dom.contributionToggleButton.addEventListener("click", () => {
    activateTab("contributions-tab");
    dom.questionFeedbackReason.focus();
  });

  dom.editToggleButton.addEventListener("click", () => {
    uiState.editPanelOpen = !uiState.editPanelOpen;
    dom.editToggleButton.textContent = uiState.editPanelOpen
      ? "Masquer l'editeur"
      : "Corriger cette question";
    dom.editPanel.classList.toggle("is-hidden", !uiState.editPanelOpen);
  });

  dom.nextQuestionButton.addEventListener("click", () => {
    dom.answerInput.value = "";
    dom.answerForm.dataset.selectedChoice = "";
    render(app.pickNextQuestion());
    if (!dom.answerInput.disabled) {
      dom.answerInput.focus();
    }
  });

  dom.questionFeedbackType.addEventListener("change", () => {
    syncContributionMode();

    if (dom.questionFeedbackType.value === "edit" && uiState.viewModel?.currentQuestion) {
      fillContributionEditForm(
        uiState.viewModel.currentQuestion,
        uiState.viewModel.canRevealCurrentAnswer
      );
    }
  });

  dom.newQuestionType.addEventListener("change", () => {
    syncNewQuestionMode();
  });

  dom.questionFeedbackForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const currentQuestionId = uiState.viewModel?.currentQuestion?.id;

      if (!currentQuestionId) {
        throw new Error("Aucune question active a signaler.");
      }

      const requestType = dom.questionFeedbackType.value;
      const result = await app.submitQuestionFeedback({
        type: requestType,
        questionId: currentQuestionId,
        reason: dom.questionFeedbackReason.value.trim(),
        prompt: dom.feedbackPrompt.value,
        answer: dom.feedbackAnswer.value,
        aliases: dom.feedbackAliases.value
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        distractors: dom.feedbackDistractors.value
          .split(/\r?\n/)
          .map((value) => value.trim())
          .filter(Boolean),
        difficulty: dom.feedbackDifficulty.value
      });

      render(result);
      dom.questionFeedbackReason.value = "";
      dom.dataMessage.textContent =
        requestType === "edit"
          ? "Proposition de modification envoyee a l'administration."
          : "Signalement envoye a l'administration.";
    } catch (error) {
      reportUiError(error);
    }
  });

  dom.newQuestionForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const result = await app.submitNewQuestionSuggestion({
        prompt: dom.newQuestionPrompt.value,
        questionType: dom.newQuestionType.value,
        answer: dom.newQuestionAnswer.value,
        aliases: dom.newQuestionAliases.value
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        distractors: dom.newQuestionDistractors.value
          .split(/\r?\n/)
          .map((value) => value.trim())
          .filter(Boolean),
        difficulty: dom.newQuestionDifficulty.value,
        reason: dom.newQuestionReason.value.trim()
      });

      render(result);
      dom.newQuestionForm.reset();
      dom.newQuestionType.value = "text";
      dom.newQuestionDifficulty.value = "medium";
      syncNewQuestionMode();
      dom.dataMessage.textContent = "Nouvelle question envoyee a l'administration.";
    } catch (error) {
      reportUiError(error);
    }
  });

  dom.adminDeleteQuestionButton.addEventListener("click", async () => {
    try {
      const questionId = uiState.viewModel?.currentQuestion?.id;

      if (!questionId) {
        throw new Error("Aucune question active a retirer.");
      }

      if (!window.confirm("Retirer cette question du catalogue actif ?")) {
        return;
      }

      render(await app.deleteQuestion(questionId));
      dom.dataMessage.textContent = "Question retiree du catalogue actif.";
    } catch (error) {
      reportUiError(error);
    }
  });

  dom.editForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const questionId = dom.editForm.dataset.questionId;
      uiState.editPanelOpen = false;

      render(
        await app.saveQuestionOverride({
          questionId,
          prompt: dom.editPrompt.value,
          answer: dom.editAnswer.value,
          aliases: dom.editAliases.value
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          difficulty: dom.editDifficulty.value
        })
      );
      dom.dataMessage.textContent = "Correction locale enregistree.";
    } catch (error) {
      reportUiError(error);
    }
  });

  dom.clearOverrideButton.addEventListener("click", async () => {
    try {
      const questionId = dom.editForm.dataset.questionId;
      uiState.editPanelOpen = false;
      render(await app.clearQuestionOverride(questionId));
      dom.dataMessage.textContent = "Correction locale supprimee.";
    } catch (error) {
      reportUiError(error);
    }
  });

  dom.questionPackInput.addEventListener("change", async (event) => {
    try {
      const [file] = event.target.files ?? [];

      if (!file) {
        return;
      }

      const jsonText = await file.text();
      const result = await app.importQuestionPack(jsonText);
      render(result.viewModel);
      dom.dataMessage.textContent = `${result.importedCount} question(s) importee(s) dans ce navigateur.`;
      dom.questionPackInput.value = "";
    } catch (error) {
      dom.questionPackInput.value = "";
      reportUiError(error);
    }
  });

  dom.exportOverridesButton.addEventListener("click", () => {
    const contents = app.exportOverrides();
    downloadJson("cinequizz-overrides.json", contents);
    dom.dataMessage.textContent = "Corrections locales exportees en JSON.";
  });

  dom.resetCustomDataButton.addEventListener("click", async () => {
    try {
      render(await app.resetLocalCustomData());
      dom.dataMessage.textContent = "Imports locaux et corrections locales reinitialises.";
    } catch (error) {
      reportUiError(error);
    }
  });

  dom.adminRequestList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-admin-action]");

    if (!button) {
      return;
    }

    try {
      const requestId = button.dataset.requestId;
      const adminAction = button.dataset.adminAction;

      if (adminAction === "delete-question") {
        const questionId = button.dataset.questionId;

        if (!questionId) {
          throw new Error("Question cible introuvable.");
        }

        if (!window.confirm("Retirer cette question du catalogue actif ?")) {
          return;
        }

        render(await app.deleteQuestion(questionId));
        dom.dataMessage.textContent = "Question retiree du catalogue actif.";
        return;
      }

      const adminNote =
        adminAction === "reject"
          ? window.prompt("Optionnel: note de refus", "") ?? ""
          : window.prompt("Optionnel: note de validation", "") ?? "";

      render(
        await app.reviewModerationRequest({
          requestId,
          decision: adminAction === "approve" ? "approve" : "reject",
          adminNote
        })
      );

      dom.dataMessage.textContent =
        adminAction === "approve"
          ? "Demande validee."
          : "Demande refusee.";
    } catch (error) {
      reportUiError(error);
    }
  });
}

main().catch((error) => {
  console.error(error);
  setFeedbackMessage(`Initialisation impossible: ${error.message}`, "is-wrong");
});
