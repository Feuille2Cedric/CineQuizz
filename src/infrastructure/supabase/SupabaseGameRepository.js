function toStats(profile) {
  return {
    totalAnswered: profile?.total_answered ?? 0,
    totalCorrect: profile?.total_correct ?? 0
  };
}

export class SupabaseGameRepository {
  constructor(client) {
    this.client = client;
    this.mode = "supabase";
    this.userId = null;
    this.profile = null;
  }

  async initialize(preferredNickname) {
    const user = await this.#ensureUser(preferredNickname);
    this.userId = user.id;

    const nickname =
      preferredNickname?.trim() ||
      window.localStorage.getItem("cinequizz:last-nickname") ||
      "Spectateur";
    await this.#upsertProfile(nickname);
    this.profile = await this.#loadProfile();

    window.localStorage.setItem("cinequizz:last-nickname", this.profile.nickname);

    return {
      userId: this.userId,
      nickname: this.profile.nickname,
      stats: toStats(this.profile),
      answeredQuestionIds: await this.#loadAnsweredQuestionIds(),
      mode: this.mode
    };
  }

  async updateNickname(nickname) {
    await this.#upsertProfile(nickname.trim() || "Spectateur");
    this.profile = await this.#loadProfile();
    window.localStorage.setItem("cinequizz:last-nickname", this.profile.nickname);
    return {
      nickname: this.profile.nickname,
      stats: toStats(this.profile)
    };
  }

  async registerAnswer({ questionId, difficulty, isCorrect, normalizedAnswer }) {
    const { data, error } = await this.client.rpc("register_answer", {
      p_question_id: questionId,
      p_difficulty: difficulty,
      p_is_correct: isCorrect,
      p_normalized_answer: normalizedAnswer
    });

    if (error) {
      throw new Error(`register_answer a echoue: ${error.message}`);
    }

    const result = Array.isArray(data) ? data[0] : data;

    this.profile = {
      ...this.profile,
      total_answered: result?.total_answered ?? this.profile.total_answered,
      total_correct: result?.total_correct ?? this.profile.total_correct
    };

    return {
      inserted: Boolean(result?.inserted),
      stats: toStats(this.profile)
    };
  }

  async getLeaderboard() {
    const { data, error } = await this.client
      .from("profiles")
      .select("user_id,nickname,total_correct,total_answered")
      .order("total_correct", { ascending: false })
      .order("total_answered", { ascending: true })
      .limit(50);

    if (error) {
      throw new Error(`Chargement du classement impossible: ${error.message}`);
    }

    return data ?? [];
  }

  async #ensureUser(preferredNickname) {
    const {
      data: { session }
    } = await this.client.auth.getSession();

    if (session?.user) {
      return session.user;
    }

    const { data, error } = await this.client.auth.signInAnonymously({
      options: {
        data: {
          display_name: preferredNickname?.trim() || "Spectateur"
        }
      }
    });

    if (error) {
      throw new Error(`Connexion anonyme Supabase impossible: ${error.message}`);
    }

    return data.user;
  }

  async #upsertProfile(nickname) {
    const { error } = await this.client.from("profiles").upsert(
      {
        user_id: this.userId,
        nickname
      },
      {
        onConflict: "user_id"
      }
    );

    if (error) {
      throw new Error(`Mise a jour du pseudo impossible: ${error.message}`);
    }
  }

  async #loadProfile() {
    const { data, error } = await this.client
      .from("profiles")
      .select("user_id,nickname,total_correct,total_answered")
      .eq("user_id", this.userId)
      .single();

    if (error) {
      throw new Error(`Chargement du profil impossible: ${error.message}`);
    }

    return data;
  }

  async #loadAnsweredQuestionIds() {
    const { data, error } = await this.client
      .from("user_question_progress")
      .select("question_id")
      .eq("user_id", this.userId);

    if (error) {
      throw new Error(`Chargement de la progression impossible: ${error.message}`);
    }

    return (data ?? []).map((entry) => entry.question_id);
  }
}
