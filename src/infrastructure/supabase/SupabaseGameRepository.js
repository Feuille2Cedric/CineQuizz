function toStats(profile) {
  return {
    totalAnswered: profile?.total_answered ?? 0,
    totalCorrect: profile?.total_correct ?? 0,
    byDifficulty: profile?.byDifficulty ?? {
      easy: { correct: 0, answered: 0 },
      medium: { correct: 0, answered: 0 },
      hard: { correct: 0, answered: 0 }
    }
  };
}

function sanitizeAnswerList(answer, acceptedAnswers = []) {
  return [...new Set([answer, ...(acceptedAnswers ?? [])].map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function slugify(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
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
    await this.#assertNicknameAvailable(nickname, this.userId);
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
      total_correct: result?.total_correct ?? this.profile.total_correct,
      byDifficulty: await this.#loadDifficultyStats()
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

  async getModerationRequests() {
    if (!this.userId || !this.profile?.is_admin) {
      return [];
    }

    const { data, error } = await this.client
      .from("question_moderation_requests")
      .select(`
        id,
        requester_user_id,
        requester_nickname,
        question_id,
        request_type,
        status,
        reason,
        proposed_prompt,
        proposed_answer,
        proposed_accepted_answers,
        proposed_difficulty,
        question_snapshot,
        admin_note,
        reviewed_by,
        reviewed_at,
        created_at
      `)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Chargement des demandes admin impossible: ${error.message}`);
    }

    return data ?? [];
  }

  async submitQuestionFeedback({
    type,
    questionId,
    reason,
    questionSnapshot,
    proposedPrompt,
    proposedAnswer,
    proposedAcceptedAnswers,
    proposedDifficulty
  }) {
    this.#assertAuthenticated();

    const payload = {
      requester_user_id: this.userId,
      requester_nickname: this.profile?.nickname ?? "Spectateur",
      question_id: questionId,
      request_type: type,
      reason: reason.trim(),
      question_snapshot: questionSnapshot ?? {}
    };

    if (type === "edit") {
      payload.proposed_prompt = proposedPrompt.trim();
      payload.proposed_answer = proposedAnswer.trim();
      payload.proposed_accepted_answers = sanitizeAnswerList(proposedAnswer, proposedAcceptedAnswers);
      payload.proposed_difficulty = proposedDifficulty;
    }

    const { error } = await this.client.from("question_moderation_requests").insert(payload);

    if (error) {
      throw new Error(`Envoi de la demande impossible: ${error.message}`);
    }
  }

  async submitNewQuestionSuggestion({
    reason,
    prompt,
    answer,
    acceptedAnswers,
    difficulty
  }) {
    this.#assertAuthenticated();

    const { error } = await this.client.from("question_moderation_requests").insert({
      requester_user_id: this.userId,
      requester_nickname: this.profile?.nickname ?? "Spectateur",
      request_type: "new",
      reason: reason.trim(),
      proposed_prompt: prompt.trim(),
      proposed_answer: answer.trim(),
      proposed_accepted_answers: sanitizeAnswerList(answer, acceptedAnswers),
      proposed_difficulty: difficulty,
      question_snapshot: {}
    });

    if (error) {
      throw new Error(`Envoi de la nouvelle question impossible: ${error.message}`);
    }
  }

  async deleteQuestion(questionId) {
    this.#assertAdmin();

    const { error } = await this.client
      .from("questions")
      .update({ is_active: false })
      .eq("id", questionId);

    if (error) {
      throw new Error(`Suppression impossible: ${error.message}`);
    }
  }

  async reviewModerationRequest({ requestId, decision, adminNote = "" }) {
    this.#assertAdmin();

    const { data: request, error: requestError } = await this.client
      .from("question_moderation_requests")
      .select(`
        id,
        question_id,
        request_type,
        status,
        proposed_prompt,
        proposed_answer,
        proposed_accepted_answers,
        proposed_difficulty,
        requester_nickname
      `)
      .eq("id", requestId)
      .single();

    if (requestError) {
      throw new Error(`Chargement de la demande impossible: ${requestError.message}`);
    }

    let resultingQuestionId = request.question_id ?? null;

    if (decision === "approve") {
      if (request.request_type === "edit" && request.question_id) {
        const { error } = await this.client
          .from("questions")
          .update({
            prompt: request.proposed_prompt,
            answer: request.proposed_answer,
            accepted_answers: sanitizeAnswerList(
              request.proposed_answer,
              request.proposed_accepted_answers ?? []
            ),
            difficulty: request.proposed_difficulty
          })
          .eq("id", request.question_id);

        if (error) {
          throw new Error(`Application de la modification impossible: ${error.message}`);
        }
      }

      if (request.request_type === "new") {
        resultingQuestionId = this.#buildCommunityQuestionId(request.proposed_prompt);

        const { error } = await this.client.from("questions").insert({
          id: resultingQuestionId,
          difficulty: request.proposed_difficulty ?? "medium",
          prompt: request.proposed_prompt,
          answer: request.proposed_answer,
          accepted_answers: sanitizeAnswerList(
            request.proposed_answer,
            request.proposed_accepted_answers ?? []
          ),
          metadata: {
            source: "community-suggestion",
            requestId: request.id,
            requesterNickname: request.requester_nickname
          },
          is_active: true
        });

        if (error) {
          throw new Error(`Creation de la question impossible: ${error.message}`);
        }
      }
    }

    const { error: updateError } = await this.client
      .from("question_moderation_requests")
      .update({
        status: decision === "approve" ? "approved" : "rejected",
        admin_note: adminNote.trim() || null,
        reviewed_by: this.userId,
        reviewed_at: new Date().toISOString(),
        question_id: resultingQuestionId
      })
      .eq("id", requestId);

    if (updateError) {
      throw new Error(`Mise a jour de la moderation impossible: ${updateError.message}`);
    }
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
      total_correct: result?.total_correct ?? this.profile.total_correct,
      byDifficulty: await this.#loadDifficultyStats()
    };

    return {
      removed: Boolean(result?.removed),
      stats: toStats(this.profile)
    };
  }

  async signIn({ identifier, password }) {
    const email = await this.#resolveEmailForIdentifier(identifier);

    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw new Error(`Connexion impossible: ${error.message}`);
    }

    return {
      sessionState: await this.#buildAuthenticatedState(data.user)
    };
  }

  async signUp({ email, password, preferredNickname }) {
    const nickname = this.#resolveNickname(preferredNickname);
    await this.#assertNicknameAvailable(nickname);
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
    this.profile = await this.#ensureProfile(this.#resolveNickname(preferredNickname, user), user);
    window.localStorage.setItem("cinequizz:last-nickname", this.profile.nickname);

    return {
      userId: this.userId,
      nickname: this.profile.nickname,
      isAdmin: Boolean(this.profile.is_admin),
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
      isAdmin: false,
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

  #assertAdmin() {
    this.#assertAuthenticated();

    if (!this.profile?.is_admin) {
      throw new Error("Action reservee aux administrateurs.");
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
      throw new Error(this.#formatProfileError(error, "Mise a jour du pseudo impossible"));
    }
  }

  async #createProfile(nickname) {
    const { error } = await this.client.from("profiles").insert({
      user_id: this.userId,
      nickname
    });

    if (error) {
      throw new Error(this.#formatProfileError(error, "Creation du profil impossible"));
    }
  }

  async #loadProfile({ allowMissing = false } = {}) {
    const { data, error } = await this.client
      .from("profiles")
      .select("user_id,nickname,is_admin,total_correct,total_answered")
      .eq("user_id", this.userId)
      .single();

    if (error) {
      if (allowMissing && error.code === "PGRST116") {
        return null;
      }

      throw new Error(`Chargement du profil impossible: ${error.message}`);
    }

    return {
      ...data,
      byDifficulty: await this.#loadDifficultyStats()
    };
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

  async #loadDifficultyStats() {
    const stats = {
      easy: { correct: 0, answered: 0 },
      medium: { correct: 0, answered: 0 },
      hard: { correct: 0, answered: 0 }
    };

    if (!this.userId) {
      return stats;
    }

    const { data, error } = await this.client
      .from("user_question_progress")
      .select("difficulty,is_correct")
      .eq("user_id", this.userId);

    if (error) {
      throw new Error(`Chargement des stats par difficulte impossible: ${error.message}`);
    }

    for (const attempt of data ?? []) {
      if (!attempt?.difficulty || !stats[attempt.difficulty]) {
        continue;
      }

      stats[attempt.difficulty].answered += 1;

      if (attempt.is_correct) {
        stats[attempt.difficulty].correct += 1;
      }
    }

    return stats;
  }

  async #ensureProfile(preferredNickname, user) {
    const existingProfile = await this.#loadProfile({ allowMissing: true });

    if (existingProfile) {
      return existingProfile;
    }

    const nickname = this.#resolveNickname(preferredNickname, user);
    await this.#assertNicknameAvailable(nickname);
    await this.#createProfile(nickname);
    return this.#loadProfile();
  }

  async #assertNicknameAvailable(nickname, excludedUserId = null) {
    const candidate = String(nickname ?? "").trim();

    if (!candidate) {
      throw new Error("Le pseudo est requis.");
    }

    const currentNickname = this.profile?.nickname;

    if (
      excludedUserId &&
      currentNickname &&
      currentNickname.trim().toLowerCase() === candidate.toLowerCase()
    ) {
      return;
    }

    const { data, error } = await this.client.rpc("is_nickname_available", {
      p_nickname: candidate
    });

    if (error) {
      throw new Error(`Verification du pseudo impossible: ${error.message}`);
    }

    if (!data) {
      throw new Error("Ce pseudo est deja pris.");
    }
  }

  async #resolveEmailForIdentifier(identifier) {
    const candidate = String(identifier ?? "").trim();

    if (!candidate) {
      throw new Error("L'e-mail ou le pseudo est requis.");
    }

    const { data, error } = await this.client.rpc("resolve_sign_in_email", {
      p_identifier: candidate
    });

    if (error) {
      throw new Error(`Resolution de l'identifiant impossible: ${error.message}`);
    }

    if (!data) {
      throw new Error("Aucun compte ne correspond a cet e-mail ou pseudo.");
    }

    return data;
  }

  #formatProfileError(error, fallbackMessage) {
    if (error?.code === "23505" && error?.message?.includes("profiles_nickname_unique_idx")) {
      return "Ce pseudo est deja pris.";
    }

    return `${fallbackMessage}: ${error.message}`;
  }

  #buildCommunityQuestionId(prompt) {
    const slug = slugify(prompt) || "question";
    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    return `community-${slug}-${suffix}`;
  }
}
