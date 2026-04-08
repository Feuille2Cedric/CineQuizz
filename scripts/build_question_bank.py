from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MOVIES_PATH = ROOT / "data" / "source" / "movies.json"
MANUAL_PATH = ROOT / "data" / "source" / "manual-questions.json"
OUTPUT_JSON_PATH = ROOT / "data" / "question-bank.json"
OUTPUT_SQL_PATH = ROOT / "supabase" / "questions.seed.sql"

TARGET_COUNTS = {
    "easy": 667,
    "medium": 667,
    "hard": 666,
}

ORDINAL_LABELS = {
    1: "premier",
    2: "deuxieme",
    3: "troisieme",
    4: "quatrieme",
    5: "cinquieme",
    6: "sixieme",
    7: "septieme",
    8: "huitieme",
    9: "neuvieme",
    10: "dixieme",
}


def load_json(path: Path, fallback):
    if not path.exists():
        return fallback

    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def dedupe_answers(values):
    deduped = []

    for value in values:
        cleaned = str(value).strip()
        if cleaned and cleaned not in deduped:
            deduped.append(cleaned)

    return deduped


def build_question(question_id, difficulty, prompt, answer, accepted_answers, metadata):
    return {
        "id": question_id,
        "difficulty": difficulty,
        "prompt": prompt,
        "answer": str(answer),
        "acceptedAnswers": dedupe_answers([answer, *accepted_answers]),
        "metadata": metadata,
    }


def ordinal_label(index):
    return ORDINAL_LABELS.get(index, f"{index}e")


def decade_label(year):
    decade = (year // 10) * 10
    return f"les annees {decade}"


def decade_answer_variants(year):
    decade = (year // 10) * 10
    return [f"annees {decade}", f"les annees {decade}", str(decade)]


def year_gap_label(gap):
    return "1 an" if gap == 1 else f"{gap} ans"


def after_reference_phrase(gap, title):
    if gap == 0:
        return f'la meme annee que "{title}"'
    return f'{year_gap_label(gap)} apres "{title}"'


def before_reference_phrase(gap, title):
    if gap == 0:
        return f'la meme annee que "{title}"'
    return f'{year_gap_label(gap)} avant "{title}"'


def build_director_contexts(movies):
    by_director = {}

    for movie in movies:
        by_director.setdefault(movie["director"], []).append(movie)

    contexts = {}

    for director, filmography in by_director.items():
        sorted_filmography = sorted(filmography, key=lambda item: (item["year"], item["title"]))

        for index, movie in enumerate(sorted_filmography):
            previous_movie = sorted_filmography[index - 1] if index > 0 else None
            next_movie = sorted_filmography[index + 1] if index + 1 < len(sorted_filmography) else None
            contexts[movie["id"]] = {
                "rank": index + 1,
                "count": len(sorted_filmography),
                "previous": previous_movie,
                "next": next_movie,
                "first": sorted_filmography[0],
                "last": sorted_filmography[-1],
            }

    return contexts


def build_movie_questions(movie, director_context):
    movie_id = movie["id"]
    title = movie["title"]
    director = movie["director"]
    year = movie["year"]
    year_text = str(year)
    country = movie["country"]
    language = movie["language"]
    genre = movie["genre"]
    accepted_title_answers = [title, *movie.get("aliases", [])]
    rank_label = ordinal_label(director_context["rank"])
    total_movies = director_context["count"]
    previous_movie = director_context["previous"]
    next_movie = director_context["next"]
    first_movie = director_context["first"]
    last_movie = director_context["last"]
    next_gap = next_movie["year"] - year if next_movie else None
    previous_gap = year - previous_movie["year"] if previous_movie else None
    metadata = {
        "movieId": movie_id,
        "title": title,
        "country": country,
        "year": year,
    }

    easy_questions = [
        build_question(
            f"{movie_id}-easy-director",
            "easy",
            f'Qui a realise "{title}" ?',
            director,
            [director],
            {**metadata, "template": "easy-director"},
        ),
        build_question(
            f"{movie_id}-easy-title-country-year",
            "easy",
            f'Quel film {genre} produit par {country} est sorti en {year_text} et a ete realise par {director} ?',
            title,
            accepted_title_answers,
            {**metadata, "template": "easy-title-country-year"},
        ),
        build_question(
            f"{movie_id}-easy-genre",
            "easy",
            f'Quel genre correspond le mieux a "{title}" ?',
            genre,
            [genre],
            {**metadata, "template": "easy-genre"},
        ),
        build_question(
            f"{movie_id}-easy-year",
            "easy",
            f'En quelle annee est sorti "{title}" ?',
            year_text,
            [year_text],
            {**metadata, "template": "easy-year"},
        ),
        build_question(
            f"{movie_id}-easy-country-language",
            "easy",
            f'De quel pays provient principalement le film "{title}", tourne en {language} ?',
            country,
            [country],
            {**metadata, "template": "easy-country-language"},
        ),
    ]

    if previous_movie and next_movie:
        medium_primary_question = build_question(
            f"{movie_id}-medium-title-between-two-films",
            "medium",
            f'Dans la filmographie de {director} presente ici, quel film {genre} sort apres "{previous_movie["title"]}" et avant "{next_movie["title"]}" ?',
            title,
            accepted_title_answers,
            {**metadata, "template": "medium-title-between-two-films"},
        )
    elif previous_movie:
        medium_primary_question = build_question(
            f"{movie_id}-medium-title-after-previous",
            "medium",
            f'Dans la filmographie de {director} presente ici, quel film {genre}, tourne en {language}, sort apres "{previous_movie["title"]}" ?',
            title,
            accepted_title_answers,
            {**metadata, "template": "medium-title-after-previous"},
        )
    elif next_movie:
        medium_primary_question = build_question(
            f"{movie_id}-medium-title-before-next",
            "medium",
            f'Dans la filmographie de {director} presente ici, quel film {genre}, produit par {country}, sort avant "{next_movie["title"]}" ?',
            title,
            accepted_title_answers,
            {**metadata, "template": "medium-title-before-next"},
        )
    else:
        medium_primary_question = build_question(
            f"{movie_id}-medium-title-rich-clues",
            "medium",
            f"Quel film de {director}, sorti en {year_text}, est a la fois {genre}, tourne en {language} et produit par {country} ?",
            title,
            accepted_title_answers,
            {**metadata, "template": "medium-title-rich-clues"},
        )

    medium_questions = [
        medium_primary_question,
        build_question(
            f"{movie_id}-medium-director-from-title-country",
            "medium",
            f'Quel realisateur a signe "{title}", film {genre} produit par {country} et sorti en {year_text} ?',
            director,
            [director],
            {**metadata, "template": "medium-director-from-title-country"},
        ),
        build_question(
            f"{movie_id}-medium-decade-from-rich-clues",
            "medium",
            f'Dans quelle decennie sort le film {genre} "{title}", realise par {director} et associe a {country} ?',
            decade_answer_variants(year)[0],
            decade_answer_variants(year),
            {**metadata, "template": "medium-decade-from-rich-clues"},
        ),
        build_question(
            f"{movie_id}-medium-genre-from-title-country",
            "medium",
            f'Quel genre correspond au film "{title}", realise par {director}, produit par {country} et sorti en {year_text} ?',
            genre,
            [genre],
            {**metadata, "template": "medium-genre-from-title-country"},
        ),
        build_question(
            f"{movie_id}-medium-country-from-title-language",
            "medium",
            f'De quel pays provient le film "{title}", realise par {director}, tourne en {language} et classe {genre} ?',
            country,
            [country],
            {**metadata, "template": "medium-country-from-title-language"},
        ),
    ]

    if previous_movie and next_movie:
        hard_questions = [
            build_question(
                f"{movie_id}-hard-title-gap-both-sides",
                "hard",
                f'Dans cette base, quel film {genre}, tourne en {language} et produit par {country}, sort {after_reference_phrase(year - previous_movie["year"], previous_movie["title"])} et {before_reference_phrase(next_movie["year"] - year, next_movie["title"])} dans la filmographie de {director} ?',
                title,
                accepted_title_answers,
                {**metadata, "template": "hard-title-gap-both-sides"},
            ),
            build_question(
                f"{movie_id}-hard-gap-number-between-neighbors",
                "hard",
                f'Combien d''annees separent "{previous_movie["title"]}" et "{title}" dans la filmographie de {director} presente ici ?',
                str(previous_gap),
                [str(previous_gap)],
                {**metadata, "template": "hard-gap-number-between-neighbors"},
            ),
            build_question(
                f"{movie_id}-hard-rank-filmography",
                "hard",
                f'Quel est le {rank_label} film le plus ancien de {director} present dans cette base, si l''on classe sa filmographie par annee de sortie ?',
                title,
                accepted_title_answers,
                {**metadata, "template": "hard-rank-filmography"},
            ),
            build_question(
                f"{movie_id}-hard-year-from-rank",
                "hard",
                f'En quelle annee sort le {rank_label} film le plus ancien de {director} present dans cette base ?',
                year_text,
                [year_text],
                {**metadata, "template": "hard-year-from-rank"},
            ),
            build_question(
                f"{movie_id}-hard-director-between-two-films",
                "hard",
                f'Quel realisateur a dans cette base un film "{previous_movie["title"]}", un film "{next_movie["title"]}" et, entre les deux, le film {genre} "{title}" ?',
                director,
                [director],
                {**metadata, "template": "hard-director-between-two-films"},
            ),
        ]
    elif previous_movie:
        hard_questions = [
            build_question(
                f"{movie_id}-hard-title-gap-after-previous",
                "hard",
                f'Quel film de {director}, classe {genre}, tourne en {language} et produit par {country}, sort {after_reference_phrase(year - previous_movie["year"], previous_movie["title"])} ?',
                title,
                accepted_title_answers,
                {**metadata, "template": "hard-title-gap-after-previous"},
            ),
            build_question(
                f"{movie_id}-hard-gap-number-after-previous",
                "hard",
                f'Combien d''annees separent "{previous_movie["title"]}" et "{title}" dans la filmographie de {director} presente ici ?',
                str(previous_gap),
                [str(previous_gap)],
                {**metadata, "template": "hard-gap-number-after-previous"},
            ),
            build_question(
                f"{movie_id}-hard-rank-filmography",
                "hard",
                f'Quel est le {rank_label} film le plus ancien de {director} present dans cette base, si l''on classe sa filmographie par annee de sortie ?',
                title,
                accepted_title_answers,
                {**metadata, "template": "hard-rank-filmography"},
            ),
            build_question(
                f"{movie_id}-hard-last-after-first",
                "hard",
                f'Quel film de {director} est le plus recent dans cette base, sachant que le plus ancien est "{first_movie["title"]}" ?',
                last_movie["title"],
                [last_movie["title"], *last_movie.get("aliases", [])],
                {**metadata, "template": "hard-last-after-first"},
            ),
            build_question(
                f"{movie_id}-hard-year-from-rank",
                "hard",
                f'En quelle annee sort le {rank_label} film le plus ancien de {director} present dans cette base ?',
                year_text,
                [year_text],
                {**metadata, "template": "hard-year-from-rank"},
            ),
        ]
    elif next_movie:
        hard_questions = [
            build_question(
                f"{movie_id}-hard-title-gap-before-next",
                "hard",
                f'Quel film de {director}, classe {genre}, tourne en {language} et produit par {country}, sort {before_reference_phrase(next_movie["year"] - year, next_movie["title"])} ?',
                title,
                accepted_title_answers,
                {**metadata, "template": "hard-title-gap-before-next"},
            ),
            build_question(
                f"{movie_id}-hard-gap-number-before-next",
                "hard",
                f'Combien d''annees separent "{title}" et "{next_movie["title"]}" dans la filmographie de {director} presente ici ?',
                str(next_gap),
                [str(next_gap)],
                {**metadata, "template": "hard-gap-number-before-next"},
            ),
            build_question(
                f"{movie_id}-hard-rank-filmography",
                "hard",
                f'Quel est le {rank_label} film le plus ancien de {director} present dans cette base, si l''on classe sa filmographie par annee de sortie ?',
                title,
                accepted_title_answers,
                {**metadata, "template": "hard-rank-filmography"},
            ),
            build_question(
                f"{movie_id}-hard-first-before-last",
                "hard",
                f'Quel film de {director} est le plus ancien dans cette base, sachant que le plus recent est "{last_movie["title"]}" ?',
                first_movie["title"],
                [first_movie["title"], *first_movie.get("aliases", [])],
                {**metadata, "template": "hard-first-before-last"},
            ),
            build_question(
                f"{movie_id}-hard-year-from-rank",
                "hard",
                f'En quelle annee sort le {rank_label} film le plus ancien de {director} present dans cette base ?',
                year_text,
                [year_text],
                {**metadata, "template": "hard-year-from-rank"},
            ),
        ]
    else:
        hard_questions = [
            build_question(
                f"{movie_id}-hard-title-complete-identity",
                "hard",
                f"Quel film, realise par {director}, est a la fois {genre}, tourne en {language}, produit par {country} et sorti en {year_text} ?",
                title,
                accepted_title_answers,
                {**metadata, "template": "hard-title-complete-identity"},
            ),
            build_question(
                f"{movie_id}-hard-director-complete-identity",
                "hard",
                f'Quel realisateur a signe le film {genre} "{title}", en {language}, produit par {country}, sorti en {year_text} ?',
                director,
                [director],
                {**metadata, "template": "hard-director-complete-identity"},
            ),
            build_question(
                f"{movie_id}-hard-decade-complete-identity",
                "hard",
                f'Dans quelle decennie sort le film {genre} "{title}", tourne en {language}, produit par {country} et realise par {director} ?',
                decade_answer_variants(year)[0],
                decade_answer_variants(year),
                {**metadata, "template": "hard-decade-complete-identity"},
            ),
            build_question(
                f"{movie_id}-hard-country-complete-identity",
                "hard",
                f'De quel pays provient le film {genre} "{title}", tourne en {language}, realise par {director} et sorti en {year_text} ?',
                country,
                [country],
                {**metadata, "template": "hard-country-complete-identity"},
            ),
            build_question(
                f"{movie_id}-hard-year-complete-identity",
                "hard",
                f'En quelle annee est sorti le film {genre} "{title}", tourne en {language}, produit par {country} et realise par {director} ?',
                year_text,
                [year_text],
                {**metadata, "template": "hard-year-complete-identity"},
            ),
        ]

    return {
        "easy": easy_questions,
        "medium": medium_questions,
        "hard": hard_questions,
    }


def select_interleaved(question_groups, target_count):
    all_questions = [question for group in question_groups for question in group]

    if len(all_questions) < target_count:
        raise ValueError(f"Impossible de selectionner {target_count} questions.")

    if len(all_questions) == target_count:
        return all_questions

    drop_count = len(all_questions) - target_count
    dropped_indexes = set()

    for drop_index in range(drop_count):
        candidate = int(((drop_index + 0.5) * len(all_questions)) / drop_count)
        candidate = min(candidate, len(all_questions) - 1)

        while candidate in dropped_indexes:
            candidate = (candidate + 1) % len(all_questions)

        dropped_indexes.add(candidate)

    return [
        question
        for index, question in enumerate(all_questions)
        if index not in dropped_indexes
    ]


def build_question_bank(movies, manual_questions):
    manual_by_difficulty = {"easy": [], "medium": [], "hard": []}

    for question in manual_questions:
        difficulty = question["difficulty"]
        if difficulty not in manual_by_difficulty:
            raise ValueError(f"Difficulte inconnue dans manual-questions.json: {difficulty}")
        manual_by_difficulty[difficulty].append(question)

    director_contexts = build_director_contexts(movies)
    movie_groups = {"easy": [], "medium": [], "hard": []}

    for movie in movies:
        generated = build_movie_questions(movie, director_contexts[movie["id"]])
        for difficulty in movie_groups:
            movie_groups[difficulty].append(generated[difficulty])

    selected_questions = []

    for difficulty, target_count in TARGET_COUNTS.items():
        manual_count = len(manual_by_difficulty[difficulty])

        if manual_count > target_count:
            raise ValueError(
                f"Trop de questions manuelles pour {difficulty}: {manual_count} > {target_count}"
            )

        generated_count = target_count - manual_count
        selected_questions.extend(manual_by_difficulty[difficulty])
        selected_questions.extend(select_interleaved(movie_groups[difficulty], generated_count))

    return selected_questions


def sql_text(value):
    return "'" + str(value).replace("'", "''") + "'"


def sql_json(value):
    return sql_text(json.dumps(value, ensure_ascii=True)) + "::jsonb"


def write_question_bank_json(questions):
    OUTPUT_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)

    with OUTPUT_JSON_PATH.open("w", encoding="utf-8") as file:
        json.dump(questions, file, ensure_ascii=True, indent=2)


def write_supabase_seed_sql(questions):
    OUTPUT_SQL_PATH.parent.mkdir(parents=True, exist_ok=True)

    lines = [
        "-- Generated by scripts/build_question_bank.py",
        "begin;",
        "",
        "insert into public.questions (",
        "  id,",
        "  difficulty,",
        "  prompt,",
        "  answer,",
        "  accepted_answers,",
        "  metadata,",
        "  is_active",
        ")",
        "values",
    ]

    values = []

    for question in questions:
        values.append(
            "  ("
            + ", ".join(
                [
                    sql_text(question["id"]),
                    sql_text(question["difficulty"]),
                    sql_text(question["prompt"]),
                    sql_text(question["answer"]),
                    sql_json(question["acceptedAnswers"]),
                    sql_json(question.get("metadata", {})),
                    "true",
                ]
            )
            + ")"
        )

    lines.append(",\n".join(values))
    lines.extend(
        [
            "on conflict (id) do update",
            "set",
            "  difficulty = excluded.difficulty,",
            "  prompt = excluded.prompt,",
            "  answer = excluded.answer,",
            "  accepted_answers = excluded.accepted_answers,",
            "  metadata = excluded.metadata,",
            "  is_active = excluded.is_active;",
            "",
            "commit;",
            "",
        ]
    )

    OUTPUT_SQL_PATH.write_text("\n".join(lines), encoding="utf-8")


def main():
    movies = load_json(MOVIES_PATH, [])
    manual_questions = load_json(MANUAL_PATH, [])

    if not movies:
        raise SystemExit("data/source/movies.json est vide ou absent.")

    questions = build_question_bank(movies, manual_questions)

    write_question_bank_json(questions)
    write_supabase_seed_sql(questions)

    difficulty_counts = {"easy": 0, "medium": 0, "hard": 0}

    for question in questions:
        difficulty_counts[question["difficulty"]] += 1

    print(
        f"Question bank generated: {len(questions)} questions "
        f"(easy={difficulty_counts['easy']}, medium={difficulty_counts['medium']}, hard={difficulty_counts['hard']})"
    )


if __name__ == "__main__":
    main()
