# Happy Fish : guide de mise en route et de reprise

*Application d'objectifs à deux, avec un poisson pixel art qui grandit. Version 1, lot 1.*

## 1. En bref

| | |
|---|---|
| **But** | Cocher nos objectifs de la semaine et du jour, s'encourager, faire grandir nos poissons |
| **Utilisateurs** | Valentin et Julie, chacun avec son compte |
| **Appareils** | iPhone, app web ajoutée à l'écran d'accueil |
| **Code** | GitHub : `valentindupnt/happy-fish`, branche `main` |
| **Hébergement** | Vercel (offre Hobby, gratuite) |
| **Base de données** | Supabase créé depuis Vercel (offre Free) |
| **Connexion** | Code à 6 chiffres reçu par e-mail, une seule fois |

## 2. Mise en route (une seule fois, environ 20 minutes)

### Déjà fait (3 novembre 2026)
1. **Vercel** : projet `happy-fish` importé depuis GitHub, redéployé à chaque push sur `main`.
2. **Supabase** : projet `happy-fish` (région Paris, offre Free) dans l'organisation de Valentin, créé via le connecteur Supabase de Claude. Schéma et données de départ installés, contrôles de sécurité passés.
3. **Branchement** : l'adresse du projet et sa clé publique (publishable) sont écrites dans `src/lib/supabase.ts`. Aucune variable d'environnement à régler sur Vercel. La clé secrète n'est utilisée nulle part.

Pour un nouveau projet Supabase : dans le SQL Editor, coller le **contenu** de `supabase/schema.sql` puis **Run**, puis celui de `supabase/seed.sql`, puis mettre à jour l'adresse et la clé dans `src/lib/supabase.ts`.

### Reste à faire dans Supabase (supabase.com, projet `happy-fish`)
5. **Authentication**, puis **Emails** (modèles d'e-mails) : dans les modèles **Magic Link** et **Confirm signup**, remplacer le corps par :
   ```html
   <h2>Ton code Happy Fish</h2>
   <p>Tape ce code dans l'app : <strong>{{ .Token }}</strong></p>
   ```
   Sans cette étape, l'e-mail contient un lien au lieu d'un code. Sur iPhone, ce lien s'ouvrirait dans Safari et l'app installée resterait déconnectée.
6. Facultatif : **Authentication**, puis **URL Configuration**, **Site URL** = l'adresse de l'app sur Vercel. Pas indispensable avec la connexion par code.

### Vos deux comptes
7. Valentin ouvre l'adresse de l'app dans Safari, saisit son e-mail, tape le code reçu, donne son prénom et choisit **Créer notre duo**. L'app affiche un code à 6 caractères.
8. Julie fait pareil sur son iPhone, choisit **J'ai un code de mon duo** et saisit ce code.
9. Supabase : **Authentication**, puis **Sign In / Providers**, désactiver **Allow new users to sign up**. Plus personne ne peut créer de compte.
10. Sur chaque iPhone : Safari, **Partager**, **Sur l'écran d'accueil**. Ouvrir ensuite l'app depuis l'icône et se reconnecter une fois avec un code (l'app installée ne partage pas la session de Safari).

## 3. Ce que fait le lot 1

| Écran | Contenu |
|---|---|
| **Aujourd'hui** | Le poisson et son XP, les 7 jours de la semaine, mes sous-objectifs ou ceux de Julie, cocher, reporter, compteur de ratés |
| **Ma semaine** | Vue jour par jour, vue mois, préparation de la semaine, ajout sur un jour précis, semaine de Julie |
| **Ensemble** | Objectifs communs (XP pour les deux) et envies avec notes et lien |
| **Petits mots** | Chat en direct, bulles, friandises (+2 XP pour l'autre, 3 par jour), messages de force en un tap, encouragement sur un objectif |
| **Aquarium** | Les deux bocaux, stades et niveaux |
| **Paramètres** | Surnom et couleur du poisson, surnoms, messages de force, code du duo, déconnexion |

**Lot 2 (à venir)** : notifications et rappel du soir, boutique et grand aquarium commun, bilan du lundi avec la surprise.

## 4. Les règles (écrites dans la base)

| Règle | Détail |
|---|---|
| XP d'un sous-objectif | 1 XP par tranche de 5 minutes, minimum 1, maximum 24 |
| Objectif commun | La même XP pour les deux |
| Journée complète | +5 XP quand tous les sous-objectifs du jour sont cochés |
| Semaine complète | +20 XP quand tous ceux de la semaine sont cochés |
| Décocher | Retire l'XP correspondante |
| Cocher | Seulement ses objectifs ou les communs, et pas un jour à venir |
| Reporter | Vers aujourd'hui ou un jour à venir, jamais dans le passé |
| Niveaux | 60 XP pour le niveau 2, puis 30 XP de plus à chaque niveau, 15 niveaux, 5 stades |
| Grand aquarium | Sans lui, le poisson reste au niveau 6 et l'XP s'accumule en réserve |
| Ratés | Sous-objectifs des jours passés de la semaine, ni faits ni retirés. Un raté reporté puis fait ne compte pas |

Personne ne peut modifier l'XP, une coche ou les données de l'autre en contournant l'app : ces actions passent par des fonctions de la base qui vérifient tout.

## 5. Modifier l'application

| Je veux changer… | Comment |
|---|---|
| Mes objectifs, surnoms, couleurs, messages de force | Directement dans l'app |
| L'apparence, un écran | Le code, poussé sur `main` : Vercel redéploie en 1 à 2 minutes |
| Une règle de la base | Un fichier de migration (voir ci-dessous) |

**Ne jamais relancer `schema.sql`** une fois l'app utilisée : il efface toutes les données. Chaque évolution de la base arrive dans `supabase/migrations/` sous forme de fichier numéroté (`002_…sql`). On le colle dans le SQL Editor et on fait **Run**, une seule fois, dans l'ordre des numéros. La table `schema_migrations` garde la liste de ceux déjà appliqués.

## 6. Reprendre le projet

```bash
git clone https://github.com/valentindupnt/happy-fish.git
cd happy-fish
npm install
cp .env.example .env.local   # adresse et clé publique de Supabase
npm run dev                  # app en local
npm run test:db              # règles de la base, sans Supabase
npm run build                # vérification complète
```

| Fichier ou dossier | Contenu |
|---|---|
| `src/screens/` | Les écrans |
| `src/components/` | Poisson pixel art, bocal, ajout d'objectif, fiche d'un sous-objectif |
| `src/lib/store.tsx` | Chargement des données et mises à jour en direct |
| `src/lib/xp.ts` | Barème XP et niveaux (le même que dans la base) |
| `supabase/schema.sql` | Tables, sécurité, règles |
| `supabase/seed.sql` | Catégories et suggestions de départ |
| `tests/db.test.ts` | 18 tests des règles |

## 7. Dépannage

| Symptôme | Solution |
|---|---|
| « Configuration manquante » | Adresse ou clé Supabase absente de `src/lib/supabase.ts` |
| L'e-mail contient un lien, pas un code | Étape 5 : modifier les deux modèles d'e-mail |
| Pas d'e-mail reçu | Regarder les spams. Le service d'e-mail intégré à Supabase limite le nombre d'envois par heure : attendre un peu |
| « Code inconnu » en rejoignant le duo | Vérifier le code dans Paramètres, sur le téléphone de celui qui a créé le duo |
| L'app ne charge plus rien | Projet Supabase en pause après 7 jours sans activité : **Restore project** dans Supabase |
| « Relation does not exist » | `seed.sql` lancé avant `schema.sql` : lancer `schema.sql` d'abord |
