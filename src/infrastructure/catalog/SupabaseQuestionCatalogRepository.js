import { Question } from "../../domain/entities/Question.js";

export class SupabaseQuestionCatalogRepository {
  constructor(client) {
    this.client = client;
  }

  async loadQuestions() {
    const pageSize = 1000;
    const questions = [];
    let from = 0;

    while (true) {
      const to = from + pageSize - 1;
      const { data, error } = await this.client
        .from("questions")
        .select("id,difficulty,prompt,answer,accepted_answers,metadata")
        .eq("is_active", true)
        .order("id")
        .range(from, to);

      if (error) {
        throw new Error(`Impossible de charger les questions Supabase: ${error.message}`);
      }

      const batch = data ?? [];
      questions.push(...batch);

      if (batch.length < pageSize) {
        break;
      }

      from += pageSize;
    }

    return questions.map((rawQuestion) =>
      Question.fromPlain({
        id: rawQuestion.id,
        difficulty: rawQuestion.difficulty,
        prompt: rawQuestion.prompt,
        answer: rawQuestion.answer,
        acceptedAnswers: rawQuestion.accepted_answers ?? [],
        metadata: rawQuestion.metadata ?? {}
      })
    );
  }
}
