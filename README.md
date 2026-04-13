# CineQuizz

Application de quiz cinema statique, compatible GitHub Pages, avec:

- reponse libre insensible a la casse, aux accents et a la ponctuation
- filtre par difficulte `easy`, `medium`, `hard`, `cinephile`
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
- les questions `cinephile` peuvent etre ajoutees manuellement

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
    "difficulty": "cinephile",
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

## Securite

Cette section resume les protections actuellement ajoutees dans le projet.

### Authentification et mots de passe

- L'application ne stocke jamais les mots de passe dans les tables `public`.
- La connexion et l'inscription passent par Supabase Auth depuis [`SupabaseGameRepository.js`](/c:/Users/crima/.vscode/CineQuizz/src/infrastructure/supabase/SupabaseGameRepository.js).
- Les mots de passe sont donc geres par Supabase, pas par du code maison dans le front.
- La cle utilisee dans le navigateur est une cle publishable, pas une `service_role`.

### Configuration des cles

- Les informations Supabase ne sont plus committees en dur dans le depot.
- Le workflow [`deploy.yml`](/c:/Users/crima/.vscode/CineQuizz/.github/workflows/deploy.yml) genere `config.js` au build a partir des secrets GitHub Actions.
- Cela evite de versionner l'URL et la cle publishable dans le repo.
- Important: la cle publishable reste visible dans le JavaScript servi au navigateur, ce qui est normal. Elle ne donne pas les droits d'une `service_role`.

### Row Level Security

- Les tables sensibles utilisent RLS dans [`schema.sql`](/c:/Users/crima/.vscode/CineQuizz/supabase/schema.sql).
- `questions`:
  - lecture publique uniquement sur les questions actives
  - insertion et modification reservees aux admins
- `user_question_progress`:
  - chaque utilisateur ne lit et n'ecrit que sa propre progression
- `question_moderation_requests`:
  - un utilisateur normal ne lit que ses propres demandes
  - un admin peut lire et traiter l'ensemble de la file
- `profiles`:
  - la lecture a ete restreinte a son propre profil
  - le classement ne lit plus directement la table

### Classement public minimal

- Pour ne pas exposer toute la table `profiles`, le classement passe par la fonction SQL `get_leaderboard_profiles()`.
- Cette fonction ne renvoie que les champs utiles au leaderboard:
  - `user_id`
  - `nickname`
  - `total_correct`
  - `total_answered`
- La migration correspondante est [`restrict_profiles_access.sql`](/c:/Users/crima/.vscode/CineQuizz/supabase/restrict_profiles_access.sql).

### Separation des droits admin

- Les actions d'administration reposent sur `profiles.is_admin`.
- La verification des droits se fait a la fois:
  - dans le front pour masquer les boutons admin
  - dans le backend Supabase via RLS et la fonction `public.is_admin()`
- Meme si quelqu'un force l'interface dans le navigateur, la base doit encore accepter l'action.

### Validation et reduction de surface d'entree

- Les difficultes autorisees sont explicitement limitees a:
  - `easy`
  - `medium`
  - `hard`
  - `cinephile`
- Les formulaires de creation/modification valident les champs avant envoi.
- Des limites de taille ont ete ajoutees cote interface et cote application pour:
  - question
  - reponse
  - explication
  - aliases
  - distracteurs QCM
- Cela ne remplace pas la securite SQL, mais reduit les entrees anormales et les abus simples.

### Injection SQL

- Le code applicatif ne construit pas de requetes SQL dynamiques a partir de chaines utilisateur.
- Les acces a la base passent par:
  - les methodes du client Supabase (`insert`, `update`, `select`, `eq`)
  - ou des fonctions SQL/RPC avec parametres
- Le risque d'injection SQL classique est donc fortement reduit par conception.
- Les contraintes SQL et les policies RLS restent la vraie barriere de securite.

### Durcissement navigateur

- Une Content Security Policy a ete ajoutee dans [`index.html`](/c:/Users/crima/.vscode/CineQuizz/index.html).
- Une `Referrer-Policy` stricte est definie.
- Une `Permissions-Policy` desactive des APIs non necessaires comme:
  - camera
  - microphone
  - geolocalisation
- L'objectif est de limiter les chargements externes et certaines surfaces d'abus navigateur.

### Protections operationnelles a verifier dans Supabase

Ces points ne sont pas controles par le repo et doivent etre verifies dans le dashboard Supabase:

- activer la confirmation d'e-mail
- verifier les `Rate Limits` d'authentification
- renforcer la politique de mot de passe
- activer, si besoin, les protections supplementaires d'Auth proposees par Supabase

### Migrations de securite ajoutees

- [`restrict_profiles_access.sql`](/c:/Users/crima/.vscode/CineQuizz/supabase/restrict_profiles_access.sql)
  - restreint la lecture directe de `profiles`
  - ajoute la fonction `get_leaderboard_profiles()`
- [`harden_security_barriers.sql`](/c:/Users/crima/.vscode/CineQuizz/supabase/harden_security_barriers.sql)
  - renforce les contraintes SQL sur les questions, la moderation et la progression
  - durcit les policies RLS et les privileges SQL
  - empeche un utilisateur authentifie de modifier directement `is_admin` ou ses statistiques dans `profiles`
- [`add_deleted_moderation_status.sql`](/c:/Users/crima/.vscode/CineQuizz/supabase/add_deleted_moderation_status.sql)
  - ajoute le statut `deleted` pour la moderation
- [`add_cinephile_difficulty.sql`](/c:/Users/crima/.vscode/CineQuizz/supabase/add_cinephile_difficulty.sql)
  - etend les contraintes SQL pour accepter `cinephile`

### Limites actuelles

- Le front reste une application statique: il ne remplace pas un backend prive.
- La cle publishable est publique par nature.
- La securite finale depend encore de la configuration Supabase reelle du projet.
- Avant une ouverture publique large, il faut verifier le dashboard Supabase en plus du code du repo.
