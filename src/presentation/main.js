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
  storageMode: document.getElementById("storage-mode"),
  syncStatus: document.getElementById("sync-status"),
  tabs: [...document.querySelectorAll(".tab")],
  panels: [...document.querySelectorAll(".tab-panel")],
  difficultyButtons: [...document.querySelectorAll(".difficulty-button")],
  nicknameForm: document.getElementById("nickname-form"),
  nicknameInput: document.getElementById("nickname-input"),
  questionDifficulty: document.getElementById("question-difficulty"),
  questionProgress: document.getElementById("question-progress"),
  questionText: document.getElementById("question-text"),
  answerForm: document.getElementById("answer-form"),
  answerInput: document.getElementById("answer-input"),
  nextQuestionButton: document.getElementById("next-question-button"),
  answerFeedback: document.getElementById("answer-feedback"),
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
  dom.storageMode.textContent = viewModel.mode === "supabase" ? "Mode Supabase" : "Mode local";
  dom.syncStatus.textContent =
    viewModel.mode === "supabase"
      ? "Questions, progression et classement charges depuis Supabase."
      : "Progression stockee dans ce navigateur. Configurez config.js pour activer Supabase.";
  dom.nicknameInput.value = viewModel.profile.nickname ?? "";

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
  dom.questionProgress.textContent = `${viewModel.stats.remaining} question(s) restante(s) sur cette difficulte`;

  if (!viewModel.currentQuestion) {
    dom.questionText.textContent =
      "Toutes les questions de cette difficulte ont deja ete repondues pour ce profil.";
    dom.answerInput.value = "";
    dom.answerInput.disabled = true;
    dom.answerForm.querySelector('button[type="submit"]').disabled = true;
    dom.nextQuestionButton.disabled = true;
    dom.editPanel.classList.add("is-hidden");
    setFeedbackMessage("Changez de difficulte ou importez de nouvelles questions.");
  } else {
    dom.questionText.textContent = viewModel.currentQuestion.prompt;
    dom.answerInput.disabled = false;
    dom.answerForm.querySelector('button[type="submit"]').disabled = false;
    dom.nextQuestionButton.disabled = false;

    if (!viewModel.currentResult) {
      setFeedbackMessage("Pret. Tapez votre reponse puis validez.");
      dom.editPanel.classList.add("is-hidden");
    } else if (viewModel.currentResult.isCorrect) {
      setFeedbackMessage(
        `Bonne reponse. La reponse attendue etait: ${viewModel.currentResult.expectedAnswer}`,
        "is-correct"
      );
      fillEditForm(viewModel.currentQuestion);
      dom.editPanel.classList.remove("is-hidden");
    } else {
      setFeedbackMessage(
        `Incorrect. Votre reponse: ${viewModel.currentResult.submittedAnswer || "(vide)"}\nBonne reponse: ${viewModel.currentResult.expectedAnswer}`,
        "is-wrong"
      );
      fillEditForm(viewModel.currentQuestion);
      dom.editPanel.classList.remove("is-hidden");
    }
  }

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
      dom.answerInput.focus();
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

  dom.nextQuestionButton.addEventListener("click", () => {
    dom.answerInput.value = "";
    render(app.pickNextQuestion());
    dom.answerInput.focus();
  });

  dom.editForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const questionId = dom.editForm.dataset.questionId;

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
