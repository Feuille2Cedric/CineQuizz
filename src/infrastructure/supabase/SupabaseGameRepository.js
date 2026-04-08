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
    const user = await this.#getCurrentUser();
    return user
      ? this.#buildAuthenticatedState(user, preferredNickname)
      : this.#buildUnauthenticatedState(preferredNickname);
  }

  async updateNickname(nickname) {
    this.#assertAuthenticated();
    await this.#upsertProfile(nickname.trim() || "Spectateur");
    this.profile = await this.#loadProfile();
    window.localStorage.setItem("cinequizz:last-nickname", this.profile.nickname);
    return {
      nickname: this.profile.nickname,
      stats: toStats(this.profile)
    };
  }

  async registerAnswer({ questionId, difficulty, isCorrect, normalizedAnswer }) {
    this.#assertAuthenticated();
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
    if (!this.userId) {
      return [];
    }

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

  async reopenQuestion(questionId) {
    this.#assertAuthenticated();

    const { data, error } = await this.client.rpc("reopen_question", {
      p_question_id: questionId
    });

    if (error) {
      throw new Error(`Reouverture impossible: ${error.message}`);
    }

    const result = Array.isArray(data) ? data[0] : data;

    this.profile = {
      ...this.profile,
      total_answered: result?.total_answered ?? this.profile.total_answered,
      total_correct: result?.total_correct ?? this.profile.total_correct
    };

    return {
      removed: Boolean(result?.removed),
      stats: toStats(this.profile)
    };
  }

  async signIn({ email, password, preferredNickname }) {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw new Error(`Connexion impossible: ${error.message}`);
    }

    return {
      sessionState: await this.#buildAuthenticatedState(data.user, preferredNickname)
    };
  }

  async signUp({ email, password, preferredNickname }) {
    const nickname = this.#resolveNickname(preferredNickname);
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: nickname
        }
      }
    });

    if (error) {
      throw new Error(`Inscription impossible: ${error.message}`);
    }

    if (data.session?.user) {
      return {
        sessionState: await this.#buildAuthenticatedState(data.session.user, nickname),
        message: "Compte cree et connecte."
      };
    }

    this.userId = null;
    this.profile = null;

    return {
      sessionState: this.#buildUnauthenticatedState(nickname),
      message:
        "Compte cree. Verifiez votre e-mail puis connectez-vous pour retrouver votre progression et le classement."
    };
  }

  async signOut(preferredNickname) {
    const { error } = await this.client.auth.signOut();

    if (error) {
      throw new Error(`Deconnexion impossible: ${error.message}`);
    }

    this.userId = null;
    this.profile = null;

    return this.#buildUnauthenticatedState(preferredNickname);
  }

  async #getCurrentUser() {
    const {
      data: { session }
    } = await this.client.auth.getSession();

    return session?.user ?? null;
  }

  async #buildAuthenticatedState(user, preferredNickname) {
    this.userId = user.id;

    await this.#upsertProfile(this.#resolveNickname(preferredNickname, user));
    this.profile = await this.#loadProfile();
    window.localStorage.setItem("cinequizz:last-nickname", this.profile.nickname);

    return {
      userId: this.userId,
      nickname: this.profile.nickname,
      stats: toStats(this.profile),
      answeredQuestionIds: await this.#loadAnsweredQuestionIds(),
      mode: this.mode,
      auth: {
        isAuthenticated: true,
        email: user.email ?? null
      }
    };
  }

  #buildUnauthenticatedState(preferredNickname) {
    const nickname = this.#resolveNickname(preferredNickname);
    return {
      userId: null,
      nickname,
      stats: {
        totalAnswered: 0,
        totalCorrect: 0
      },
      answeredQuestionIds: [],
      mode: this.mode,
      auth: {
        isAuthenticated: false,
        email: null
      }
    };
  }

  #resolveNickname(preferredNickname, user = null) {
    const savedNickname = window.localStorage.getItem("cinequizz:last-nickname");
    return (
      preferredNickname?.trim() ||
      savedNickname ||
      user?.user_metadata?.display_name ||
      user?.email?.split("@")[0] ||
      "Spectateur"
    );
  }

  #assertAuthenticated() {
    if (!this.userId) {
      throw new Error("Connexion requise pour utiliser Supabase.");
    }
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
