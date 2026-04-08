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
  authForm: document.getElementById("auth-form"),
  authLocalButton: document.getElementById("auth-local-button"),
  authReady: document.getElementById("auth-ready"),
  authReadyEmail: document.getElementById("auth-ready-email"),
  authContinueButton: document.getElementById("auth-continue-button"),
  authNicknameInput: document.getElementById("auth-nickname-input"),
  authEmailInput: document.getElementById("auth-email-input"),
  authPasswordInput: document.getElementById("auth-password-input"),
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
  questionDifficulty: document.getElementById("question-difficulty"),
  questionProgress: document.getElementById("question-progress"),
  questionText: document.getElementById("question-text"),
  answerForm: document.getElementById("answer-form"),
  answerInput: document.getElementById("answer-input"),
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
  feedbackAliases: document.getElementById("feedback-aliases"),
  feedbackDifficulty: document.getElementById("feedback-difficulty"),
  questionFeedbackSubmit: document.getElementById("question-feedback-submit"),
  newQuestionForm: document.getElementById("new-question-form"),
  newQuestionPrompt: document.getElementById("new-question-prompt"),
  newQuestionAnswer: document.getElementById("new-question-answer"),
  newQuestionAliases: document.getElementById("new-question-aliases"),
  newQuestionDifficulty: document.getElementById("new-question-difficulty"),
  newQuestionReason: document.getElementById("new-question-reason"),
  newQuestionSubmit: document.getElementById("new-question-submit"),
  adminRequestList: document.getElementById("admin-request-list"),
  leaderboardBody: document.getElementById("leaderboard-body"),
  statCorrect: document.getElementById("stat-correct"),
  statAnswered: document.getElementById("stat-answered"),
  statAccuracy: document.getElementById("stat-accuracy"),
  statRemaining: document.getElementById("stat-remaining"),
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
  runtimePreference: null,
  supabaseAvailable: false
};

const RUNTIME_PREFERENCE_KEY = "cinequizz:runtime-preference";

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
            <p><strong>Reponse:</strong> ${escapeHtml(answer)}</p>
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

function reportUiError(error) {
  console.error(error);
  dom.dataMessage.textContent = error.message;
  setFeedbackMessage(`Erreur: ${error.message}`, "is-wrong");
}

function reportAuthError(error) {
  console.error(error);
  dom.authStatus.textContent = error.message;
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

function fillContributionEditForm(question) {
  if (!question) {
    return;
  }

  dom.feedbackPrompt.value = question.prompt;
  dom.feedbackAnswer.value = question.answer;
  dom.feedbackAliases.value = question.acceptedAnswers.slice(1).join(", ");
  dom.feedbackDifficulty.value = question.difficulty;
}

function syncContributionMode() {
  const wantsEdit = dom.questionFeedbackType.value === "edit";
  dom.feedbackEditFields.classList.toggle("is-hidden", !wantsEdit);
}

function render(viewModel) {
  uiState.viewModel = viewModel;

  const isSupabase = viewModel.mode === "supabase";
  const requiresAuth = isSupabase && !viewModel.auth.isAuthenticated;
  const canContribute = Boolean(viewModel.canContribute);
  const shouldShowEntry = isSupabase && (!uiState.entryDismissed || requiresAuth);
  const activeQuestionId = viewModel.currentQuestion?.id ?? null;
  const canEditQuestion = Boolean(activeQuestionId) && !requiresAuth;
  const canAdministerQuestion = Boolean(activeQuestionId) && viewModel.profile.isAdmin;

  if (uiState.editQuestionId !== activeQuestionId) {
    uiState.editPanelOpen = false;
    uiState.editQuestionId = activeQuestionId;
  }

  if (uiState.contributionQuestionId !== activeQuestionId) {
    uiState.contributionQuestionId = activeQuestionId;

    if (viewModel.currentQuestion) {
      fillContributionEditForm(viewModel.currentQuestion);
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
    dom.answerInput.disabled = true;
    dom.answerSubmitButton.disabled = true;
    dom.nextQuestionButton.disabled = true;
    dom.editPanel.classList.add("is-hidden");
    setFeedbackMessage("Mode Supabase actif. Authentification requise.");
  } else if (!viewModel.currentQuestion) {
    dom.questionText.textContent =
      "Toutes les questions de cette difficulte ont deja ete repondues pour ce profil.";
    dom.answerInput.value = "";
    dom.answerInput.disabled = true;
    dom.answerSubmitButton.disabled = true;
    dom.nextQuestionButton.disabled = true;
    dom.editPanel.classList.add("is-hidden");
    setFeedbackMessage("Changez de difficulte ou importez de nouvelles questions.");
  } else {
    dom.questionText.textContent = viewModel.currentQuestion.prompt;
    dom.answerInput.disabled = false;
    dom.answerSubmitButton.disabled = false;
    dom.nextQuestionButton.disabled = false;
    fillEditForm(viewModel.currentQuestion);

    if (!viewModel.currentResult) {
      setFeedbackMessage("Pret. Tapez votre reponse puis validez.");
    } else if (viewModel.currentResult.isCorrect) {
      setFeedbackMessage(
        `Bonne reponse. La reponse attendue etait: ${viewModel.currentResult.expectedAnswer}`,
        "is-correct"
      );
    } else {
      setFeedbackMessage(
        `Incorrect. Votre reponse: ${viewModel.currentResult.submittedAnswer || "(vide)"}\nBonne reponse: ${viewModel.currentResult.expectedAnswer}`,
        "is-wrong"
      );
    }
  }

  dom.editPanel.classList.toggle("is-hidden", !canEditQuestion || !uiState.editPanelOpen);
  syncContributionMode();

  if (!canContribute) {
    dom.contributionStatus.textContent = isSupabase
      ? "Connectez-vous pour envoyer des signalements, proposer des modifications ou soumettre de nouvelles questions."
      : "Les contributions communautaires sont disponibles uniquement en mode Supabase.";
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
  dom.feedbackDifficulty.disabled = !canContribute;
  dom.questionFeedbackSubmit.disabled = !canContribute || !viewModel.currentQuestion;
  dom.newQuestionPrompt.disabled = !canContribute;
  dom.newQuestionAnswer.disabled = !canContribute;
  dom.newQuestionAliases.disabled = !canContribute;
  dom.newQuestionDifficulty.disabled = !canContribute;
  dom.newQuestionReason.disabled = !canContribute;
  dom.newQuestionSubmit.disabled = !canContribute;

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

  await bootApplication();
  syncContributionMode();

  dom.tabs.forEach((tabButton) => {
    tabButton.addEventListener("click", () => activateTab(tabButton.dataset.tabTarget));
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

  dom.authForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const action = event.submitter?.dataset.authAction;
      const email = dom.authEmailInput.value.trim();
      const password = dom.authPasswordInput.value;
      const preferredNickname = dom.authNicknameInput.value.trim() || dom.nicknameInput.value.trim();

      if (!email) {
        dom.authStatus.textContent = "L'e-mail est requis.";
        return;
      }

      if (!password || password.length < 6) {
        dom.authStatus.textContent = "Le mot de passe doit faire au moins 6 caracteres.";
        return;
      }

      const result =
        action === "sign-up"
          ? await app.signUp({ email, password, preferredNickname })
          : await app.signIn({ email, password, preferredNickname });

      uiState.entryDismissed = result.viewModel.auth.isAuthenticated;
      render(result.viewModel);
      dom.authPasswordInput.value = "";
      dom.nicknameInput.value = result.viewModel.profile.nickname ?? "";
      dom.authStatus.textContent = result.message;
      dom.dataMessage.textContent = result.message;

      if (!dom.answerInput.disabled) {
        dom.answerInput.focus();
      }
    } catch (error) {
      reportAuthError(error);
    }
  });

  dom.authSignoutButton.addEventListener("click", async () => {
    try {
      uiState.entryDismissed = false;
      render(await app.signOut());
      dom.authPasswordInput.value = "";
      dom.authNicknameInput.value = dom.nicknameInput.value.trim();
      dom.authStatus.textContent = "Session fermee.";
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
      if (!dom.answerInput.disabled) {
        render(await app.submitAnswer(dom.answerInput.value.trim()));
      }
    } catch (error) {
      reportUiError(error);
    }
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
    render(app.pickNextQuestion());
    if (!dom.answerInput.disabled) {
      dom.answerInput.focus();
    }
  });

  dom.questionFeedbackType.addEventListener("change", () => {
    syncContributionMode();

    if (dom.questionFeedbackType.value === "edit" && uiState.viewModel?.currentQuestion) {
      fillContributionEditForm(uiState.viewModel.currentQuestion);
    }
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
        answer: dom.newQuestionAnswer.value,
        aliases: dom.newQuestionAliases.value
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        difficulty: dom.newQuestionDifficulty.value,
        reason: dom.newQuestionReason.value.trim()
      });

      render(result);
      dom.newQuestionForm.reset();
      dom.newQuestionDifficulty.value = "medium";
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
