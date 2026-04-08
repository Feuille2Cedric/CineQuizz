import { Question } from "../../domain/entities/Question.js";

const OVERRIDES_KEY = "cinequizz:question-overrides";
const IMPORTS_KEY = "cinequizz:question-imports";

function parseStoredJson(key, fallbackValue) {
  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

function writeStoredJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value, null, 2));
}

function buildFallbackId(prompt) {
  return `custom-${String(prompt ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}-${Date.now()}`;
}

export class LocalQuestionPatchRepository {
  getOverrides() {
    return parseStoredJson(OVERRIDES_KEY, {});
  }

  saveOverride(questionId, override) {
    const overrides = this.getOverrides();
    overrides[questionId] = override;
    writeStoredJson(OVERRIDES_KEY, overrides);
    return overrides[questionId];
  }

  removeOverride(questionId) {
    const overrides = this.getOverrides();
    delete overrides[questionId];
    writeStoredJson(OVERRIDES_KEY, overrides);
  }

  getImportedQuestions() {
    const imported = parseStoredJson(IMPORTS_KEY, []);
    return imported.map((rawQuestion) => Question.fromPlain(rawQuestion));
  }

  saveImportedQuestions(rawQuestions) {
    const currentImports = parseStoredJson(IMPORTS_KEY, []);
    const mergedImports = [...currentImports];

    for (const rawQuestion of rawQuestions) {
      const question = Question.fromPlain({
        ...rawQuestion,
        id: rawQuestion.id ?? buildFallbackId(rawQuestion.prompt)
      }).toJSON();

      const existingIndex = mergedImports.findIndex((entry) => entry.id === question.id);

      if (existingIndex >= 0) {
        mergedImports[existingIndex] = question;
      } else {
        mergedImports.push(question);
      }
    }

    writeStoredJson(IMPORTS_KEY, mergedImports);
    return mergedImports;
  }

  clearAll() {
    window.localStorage.removeItem(OVERRIDES_KEY);
    window.localStorage.removeItem(IMPORTS_KEY);
  }

  exportOverrides() {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        overrides: this.getOverrides()
      },
      null,
      2
    );
  }
}
