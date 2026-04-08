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
  syncStatus: document.getElementById("sync-status"),
  authPanel: document.getElementById("auth-panel"),
  authForm: document.getElementById("auth-form"),
  authReady: document.getElementById("auth-ready"),
  authReadyEmail: document.getElementById("auth-ready-email"),
  authContinueButton: document.getElementById("auth-continue-button"),
  authNicknameInput: document.getElementById("auth-nickname-input"),
  authEmailInput: document.getElementById("auth-email-input"),
  authPasswordInput: document.getElementById("auth-password-input"),
  authSession: document.getElementById("auth-session"),
  authEmailValue: document.getElementById("auth-email-value"),
  authSignoutButton: document.getElementById("auth-signout-button"),
  authStatus: document.getElementById("auth-status"),
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
  editToggleButton: document.getElementById("edit-toggle-button"),
  editPanel: document.getElementById("edit-panel"),
  editForm: document.getElementById("edit-form"),
  editPrompt: document.getElementById("edit-prompt"),
  editAnswer: document.getElementById("edit-answer"),
  editAliases: document.getElementById("edit-aliases"),
  editDifficulty: document.getElementById("edit-difficulty"),
  clearOverrideButton: document.getElementById("clear-override-button"),
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
  entryDismissed: false,
  viewModel: null
};

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

function render(viewModel) {
  uiState.viewModel = viewModel;

  const isSupabase = viewModel.mode === "supabase";
  const requiresAuth = isSupabase && !viewModel.auth.isAuthenticated;
  const shouldShowEntry = isSupabase && (!uiState.entryDismissed || requiresAuth);
  const activeQuestionId = viewModel.currentQuestion?.id ?? null;
  const canEditQuestion = Boolean(activeQuestionId) && !requiresAuth;

  if (uiState.editQuestionId !== activeQuestionId) {
    uiState.editPanelOpen = false;
    uiState.editQuestionId = activeQuestionId;
  }

  dom.storageMode.textContent = isSupabase ? "Mode Supabase" : "Mode local";
  dom.syncStatus.textContent = isSupabase
    ? requiresAuth
      ? "Supabase est configure. Connectez-vous pour charger votre progression et le classement."
      : "Questions, progression et classement charges depuis Supabase."
    : "Progression stockee dans ce navigateur. Configurez config.js pour activer Supabase.";

  dom.pageShell.classList.toggle("is-hidden", shouldShowEntry);
  dom.authGate.classList.toggle("is-hidden", !shouldShowEntry);
  dom.authForm.classList.toggle("is-hidden", !requiresAuth);
  dom.authReady.classList.toggle("is-hidden", !shouldShowEntry || requiresAuth || !viewModel.auth.isAuthenticated);
  dom.authReadyEmail.textContent = viewModel.auth.email ?? "";
  dom.authSession.classList.toggle("is-hidden", !isSupabase || !viewModel.auth.isAuthenticated);
  dom.authEmailValue.textContent = viewModel.auth.email ?? "";

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
    : `${viewModel.stats.remaining} question(s) restante(s) sur cette difficulte`;
  dom.editToggleButton.classList.toggle("is-hidden", !canEditQuestion);
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

  dom.leaderboardBody.innerHTML = serializeLeaderboardRows(
    viewModel.leaderboard,
    viewModel.profile.userId
  );
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

  if (!hasSupabaseRuntime(runtimeConfig)) {
    return {
      catalogRepository: new QuestionCatalogRepository(),
      gameRepository: new BrowserGameRepository()
    };
  }

  const client = createSupabaseClient(runtimeConfig);

  return {
    catalogRepository: new SupabaseQuestionCatalogRepository(client),
    gameRepository: new SupabaseGameRepository(client)
  };
}

async function main() {
  const patchRepository = new LocalQuestionPatchRepository();
  let { catalogRepository, gameRepository } = buildRuntimeServices();

  let app = new QuizApp({
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
    catalogRepository = new QuestionCatalogRepository();
    gameRepository = new BrowserGameRepository();
    app = new QuizApp({ catalogRepository, patchRepository, gameRepository });
    viewModel = await app.initialize(window.localStorage.getItem("cinequizz:last-nickname") ?? "");
    startupMessage = `Supabase indisponible, retour au mode local: ${error.message}`;
  }

  render(viewModel);

  if (startupMessage) {
    dom.syncStatus.textContent = startupMessage;
  }

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
}

main().catch((error) => {
  console.error(error);
  setFeedbackMessage(`Initialisation impossible: ${error.message}`, "is-wrong");
});
