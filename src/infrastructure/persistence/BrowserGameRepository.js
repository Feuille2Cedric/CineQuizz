const PROFILE_KEY = "cinequizz:browser-profile";
const PROGRESS_KEY = "cinequizz:browser-progress";
const LEADERBOARD_KEY = "cinequizz:browser-leaderboard";

function readJson(key, fallbackValue) {
  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

function writeJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value, null, 2));
}

function buildLocalUserId() {
  return `browser-${Math.random().toString(36).slice(2, 12)}`;
}

function toStats(profile) {
  return {
    totalAnswered: profile.totalAnswered ?? 0,
    totalCorrect: profile.totalCorrect ?? 0
  };
}

export class BrowserGameRepository {
  constructor() {
    this.mode = "local";
    this.profile = null;
    this.progress = {};
  }

  async initialize(preferredNickname) {
    this.profile = readJson(PROFILE_KEY, null) ?? {
      userId: buildLocalUserId(),
      nickname: preferredNickname?.trim() || "Spectateur",
      totalAnswered: 0,
      totalCorrect: 0
    };

    if (preferredNickname?.trim()) {
      this.profile.nickname = preferredNickname.trim();
    }

    this.progress = readJson(PROGRESS_KEY, {});
    this.#persistProfile();
    this.#syncLeaderboard();

    return {
      userId: this.profile.userId,
      nickname: this.profile.nickname,
      stats: toStats(this.profile),
      answeredQuestionIds: Object.keys(this.progress),
      mode: this.mode
    };
  }

  async updateNickname(nickname) {
    this.profile.nickname = nickname.trim() || this.profile.nickname;
    this.#persistProfile();
    this.#syncLeaderboard();
    return {
      nickname: this.profile.nickname,
      stats: toStats(this.profile)
    };
  }

  async registerAnswer({ questionId, difficulty, isCorrect, normalizedAnswer }) {
    if (this.progress[questionId]) {
      return {
        inserted: false,
        stats: toStats(this.profile)
      };
    }

    this.progress[questionId] = {
      difficulty,
      isCorrect,
      normalizedAnswer,
      answeredAt: new Date().toISOString()
    };

    this.profile.totalAnswered += 1;
    this.profile.totalCorrect += isCorrect ? 1 : 0;

    this.#persistProfile();
    writeJson(PROGRESS_KEY, this.progress);
    this.#syncLeaderboard();

    return {
      inserted: true,
      stats: toStats(this.profile)
    };
  }

  async getLeaderboard() {
    return readJson(LEADERBOARD_KEY, [])
      .sort((left, right) => {
        if (right.totalCorrect !== left.totalCorrect) {
          return right.totalCorrect - left.totalCorrect;
        }

        if (left.totalAnswered !== right.totalAnswered) {
          return left.totalAnswered - right.totalAnswered;
        }

        return left.nickname.localeCompare(right.nickname);
      })
      .slice(0, 25);
  }

  #persistProfile() {
    writeJson(PROFILE_KEY, this.profile);
  }

  #syncLeaderboard() {
    const leaderboard = readJson(LEADERBOARD_KEY, []);
    const nextLeaderboard = leaderboard.filter((entry) => entry.userId !== this.profile.userId);
    nextLeaderboard.push({
      userId: this.profile.userId,
      nickname: this.profile.nickname,
      totalAnswered: this.profile.totalAnswered,
      totalCorrect: this.profile.totalCorrect
    });
    writeJson(LEADERBOARD_KEY, nextLeaderboard);
  }
}
