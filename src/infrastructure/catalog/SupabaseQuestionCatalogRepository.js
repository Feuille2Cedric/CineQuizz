import { Question } from "../../domain/entities/Question.js";

export class SupabaseQuestionCatalogRepository {
  constructor(client) {
    this.client = client;
  }

  async loadQuestions() {
    const { data, error } = await this.client
      .from("questions")
      .select("id,difficulty,prompt,answer,accepted_answers,metadata")
      .eq("is_active", true)
      .order("id");

    if (error) {
      throw new Error(`Impossible de charger les questions Supabase: ${error.message}`);
    }

    return (data ?? []).map((rawQuestion) =>
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
