export class Question {
  constructor({ id, difficulty, prompt, answer, acceptedAnswers = [], metadata = {} }) {
    this.id = id;
    this.difficulty = difficulty;
    this.prompt = prompt;
    this.answer = answer;
    this.acceptedAnswers = Question.#dedupeAnswers([answer, ...acceptedAnswers]);
    this.metadata = metadata;
  }

  static fromPlain(rawQuestion) {
    if (!rawQuestion?.id || !rawQuestion?.prompt || !rawQuestion?.answer) {
      throw new Error("Question invalide: id, prompt et answer sont requis.");
    }

    return new Question({
      id: rawQuestion.id,
      difficulty: rawQuestion.difficulty ?? "medium",
      prompt: rawQuestion.prompt,
      answer: rawQuestion.answer,
      acceptedAnswers: rawQuestion.acceptedAnswers ?? [],
      metadata: rawQuestion.metadata ?? {}
    });
  }

  static #dedupeAnswers(values) {
    return [...new Set(values.filter(Boolean).map((value) => String(value).trim()))];
  }

  toJSON() {
    return {
      id: this.id,
      difficulty: this.difficulty,
      prompt: this.prompt,
      answer: this.answer,
      acceptedAnswers: this.acceptedAnswers,
      metadata: this.metadata
    };
  }
}
