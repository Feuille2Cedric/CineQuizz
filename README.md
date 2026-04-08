# CineQuizz

Application de quiz cinema statique, compatible GitHub Pages, avec:

- reponse libre insensible a la casse, aux accents et a la ponctuation
- filtre par difficulte `easy`, `medium`, `hard`
- score de bonnes reponses
- questions deja traitees qui ne reapparaissent plus pour un meme profil
- classement global via Supabase
- catalogue de questions importable directement dans Supabase
- correction locale des questions/reponses apres avoir joue
- import simple de nouveaux packs JSON

## Architecture

Le projet suit une separation simple inspiree de la clean architecture:

- `src/domain`: entites et regles metier
- `src/application`: orchestration du quiz
- `src/infrastructure`: chargement du catalogue, persistance locale, persistance Supabase
- `src/presentation`: UI et branchement DOM
- `data/source`: sources JSON maintenables
- `data/question-bank.json`: catalogue fallback local genere
- `supabase/schema.sql`: tables, policies RLS et fonction RPC `register_answer`
- `supabase/questions.seed.sql`: import SQL direct des 2000 questions

## Banque de questions

La base initiale est generee a partir de [`data/source/movies.json`](/c:/Users/crima/.vscode/CineQuizz/data/source/movies.json) et de [`data/source/manual-questions.json`](/c:/Users/crima/.vscode/CineQuizz/data/source/manual-questions.json).

Generation actuelle:

- 2000 questions
- 667 faciles
- 667 moyennes
- 666 difficiles

Pour regenerer le catalogue:

```powershell
python scripts/build_question_bank.py
```

## Ajouter des questions

### Option 1: enrichir le catalogue cinema

Ajoutez une entree dans [`data/source/movies.json`](/c:/Users/crima/.vscode/CineQuizz/data/source/movies.json):

```json
{
  "id": "mon-film",
  "title": "Mon Film",
  "director": "Nom Prenom",
  "year": 2024,
  "country": "France",
  "language": "francais",
  "genre": "drame",
  "aliases": ["Titre alternatif"]
}
```

Puis regenerez:

```powershell
python scripts/build_question_bank.py
```

### Option 2: ajouter des questions directes

Ajoutez des objets complets dans [`data/source/manual-questions.json`](/c:/Users/crima/.vscode/CineQuizz/data/source/manual-questions.json):

```json
[
  {
    "id": "manual-example",
    "difficulty": "hard",
    "prompt": "Quel film a remporte la Palme d'Or en 1994 ?",
    "answer": "Pulp Fiction",
    "acceptedAnswers": ["Pulp Fiction"],
    "metadata": {
      "source": "manual"
    }
  }
]
```

### Option 3: import local depuis l'interface

L'onglet `Donnees` accepte:

- un tableau JSON de questions
- ou un objet `{ "questions": [...] }`

Exemple:

```json
[
  {
    "id": "pack-local-1",
    "difficulty": "easy",
    "prompt": "Qui a realise Alien ?",
    "answer": "Ridley Scott",
    "acceptedAnswers": ["Ridley Scott"]
  }
]
```

Cet import est local au navigateur. Pour un ajout permanent, mettez a jour les fichiers JSON du depot.

## Supabase

L'application fonctionne sans Supabase, mais le classement global, la progression synchronisee et le chargement des questions distantes necessitent Supabase.

### 1. Creer le schema

Executez [`supabase/schema.sql`](/c:/Users/crima/.vscode/CineQuizz/supabase/schema.sql) dans l'editor SQL de Supabase.

### 2. Importer les 2000 questions

Executez ensuite [`supabase/questions.seed.sql`](/c:/Users/crima/.vscode/CineQuizz/supabase/questions.seed.sql) dans l'editor SQL de Supabase.

### 3. Activer l'auth anonyme

Dans Supabase Auth, activez les utilisateurs anonymes.

### 4. Renseigner la configuration

Editez [`config.js`](/c:/Users/crima/.vscode/CineQuizz/config.js):

```js
window.CINEQUIZZ_CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY"
};
```

Le mode Supabase charge et stocke:

- les 2000 questions depuis `public.questions`
- le profil utilisateur
- le nombre total de bonnes reponses
- le nombre total de reponses
- les identifiants des questions deja repondues

Le fallback local reste disponible via [`data/question-bank.json`](/c:/Users/crima/.vscode/CineQuizz/data/question-bank.json) si Supabase n'est pas configure.

## Lancer en local

Comme l'application charge un JSON fallback via `fetch`, il faut un petit serveur statique:

```powershell
python -m http.server 8000
```

Puis ouvrez `http://localhost:8000`.

## Deploiement GitHub Pages

1. Poussez le depot sur GitHub.
2. Ajoutez deux secrets GitHub dans `Settings > Secrets and variables > Actions`:
   - `CINEQUIZZ_SUPABASE_URL`
   - `CINEQUIZZ_SUPABASE_ANON_KEY`
3. Dans `Settings > Pages`, choisissez `GitHub Actions` comme source de deploiement.
4. Le workflow [`deploy.yml`](/c:/Users/crima/.vscode/CineQuizz/.github/workflows/deploy.yml) genere `config.js` au build a partir de ces secrets.
5. Le `config.js` du depot reste vide par defaut. Pour lancer le projet en local, remplissez-le manuellement sans le republier tel quel.

Important: la cle `anon` Supabase n'est pas secrete cote navigateur. Cette approche evite de la versionner dans le depot, mais elle restera visible dans le JavaScript servi aux utilisateurs.

## Fichiers importants

- [`index.html`](/c:/Users/crima/.vscode/CineQuizz/index.html)
- [`styles.css`](/c:/Users/crima/.vscode/CineQuizz/styles.css)
- [`src/application/QuizApp.js`](/c:/Users/crima/.vscode/CineQuizz/src/application/QuizApp.js)
- [`src/presentation/main.js`](/c:/Users/crima/.vscode/CineQuizz/src/presentation/main.js)
- [`scripts/build_question_bank.py`](/c:/Users/crima/.vscode/CineQuizz/scripts/build_question_bank.py)
- [`data/question-bank.json`](/c:/Users/crima/.vscode/CineQuizz/data/question-bank.json)
- [`supabase/questions.seed.sql`](/c:/Users/crima/.vscode/CineQuizz/supabase/questions.seed.sql)
