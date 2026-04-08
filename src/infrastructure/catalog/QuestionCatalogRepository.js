import { Question } from "../../domain/entities/Question.js";

export class QuestionCatalogRepository {
  async loadQuestions() {
    const response = await fetch("./data/question-bank.json", { cache: "no-store" });

    if (!response.ok) {
      throw new Error("Impossible de charger ./data/question-bank.json");
    }

    const payload = await response.json();
    const questions = Array.isArray(payload) ? payload : payload.questions;

    return questions.map((rawQuestion) => Question.fromPlain(rawQuestion));
  }
}
