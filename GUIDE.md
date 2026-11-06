# Happy Fish : guide de mise en route et de reprise

*Application d'objectifs à deux, avec un poisson pixel art qui grandit. Version 1, lots 1, 2 et 3, puis progression longue (migration 006).*

## 1. En bref

| | |
|---|---|
| **But** | Cocher nos objectifs de la semaine et du jour, s'encourager, faire grandir nos poissons |
| **Utilisateurs** | Valentin et Julie, chacun avec son compte |
| **Appareils** | iPhone, app web ajoutée à l'écran d'accueil |
| **Code** | GitHub : `valentindupnt/happy-fish`, branche `main` |
| **Hébergement** | Vercel (offre Hobby, gratuite) |
| **Base de données** | Supabase, projet `happy-fish` (offre Free, Paris) |
| **Connexion** | E-mail et mot de passe, une fois par appareil (aucun e-mail envoyé) |

## 2. Mise en route (une seule fois, environ 20 minutes)

### Déjà fait (3 novembre 2026)
1. **Vercel** : projet `happy-fish` importé depuis GitHub, redéployé à chaque push sur `main`.
2. **Supabase** : projet `happy-fish` (région Paris, offre Free) dans l'organisation de Valentin, créé via le connecteur Supabase de Claude. Schéma et données de départ installés, contrôles de sécurité passés.
3. **Branchement** : l'adresse du projet et sa clé publique (publishable) sont écrites dans `src/lib/supabase.ts`. Aucune variable d'environnement à régler sur Vercel. La clé secrète n'est utilisée nulle part.

Pour un nouveau projet Supabase : dans le SQL Editor, coller le **contenu** de `supabase/schema.sql` puis **Run**, puis celui de `supabase/seed.sql`, puis mettre à jour l'adresse et la clé dans `src/lib/supabase.ts`.

### Reste à faire dans Supabase (supabase.com, projet `happy-fish`)
4. **Authentication**, puis **Sign In / Providers**, puis **Email** : désactiver **Confirm email**, puis **Save**. L'app n'envoie aucun e-mail : l'envoi intégré de Supabase ne marche que pour les membres de l'équipe Supabase, et ses modèles ne sont modifiables qu'avec un service d'envoi externe (SMTP).

### Vos deux comptes
5. Valentin ouvre l'adresse de l'app dans Safari, choisit **Créer mon compte** (e-mail et mot de passe), donne son prénom et choisit **Créer notre duo**. L'app affiche un code à 6 caractères.
6. Julie fait pareil sur son iPhone, choisit **J'ai un code de mon duo** et saisit ce code.
7. Supabase : **Authentication**, puis **Sign In / Providers**, désactiver **Allow new users to sign up**. Plus personne ne peut créer de compte.
8. Sur chaque iPhone : Safari, **Partager**, **Sur l'écran d'accueil**. Ouvrir ensuite l'app depuis l'icône et se reconnecter une fois avec **Me connecter** (l'app installée ne partage pas la session de Safari).
9. **Notifications**, toujours depuis l'icône de l'écran d'accueil (sur iPhone, elles ne marchent pas dans Safari) : **Paramètres**, **Activer les notifications sur cet appareil**, accepter, puis **Envoyer un test**. Chacun choisit ensuite ce qu'il veut recevoir avec les interrupteurs.

**Mot de passe oublié** : pas d'e-mail de réinitialisation. Dans Supabase, **Authentication**, puis **Users**, ouvrir le compte et lui envoyer ou définir un nouveau mot de passe, ou demander à Claude de le faire.

## 3. Ce que fait l'application

| Écran | Contenu |
|---|---|
| **Aujourd'hui** | Le poisson et son humeur, le bilan de la semaine passée et les surprises, le récap du mois (les 5 premiers jours), les 7 jours de la semaine, mes sous-objectifs ou ceux de Julie, cocher (avec des bulles), reporter, quêtes annexes du jour, mes séries, compteur de ratés avec la bulle « Surprise » (roue) |
| **Ma semaine** | Vue jour par jour, vue mois, préparation de la semaine, ajout sur un jour précis, semaine de Julie |
| **Ensemble** | Défi de la semaine tiré au dé, objectifs communs (XP pour les deux), Wall of fame en liste déroulante (dernier snap de chacun, bouton « Toute la fame »), envies avec notes et lien (liste déroulante) |
| **Petits mots** | Chat en direct, photos (avec légende, en grand d'un tap), GIFs de poissons pixel (bouton GIF), bulles, friandises (+1 XP pour l'autre, 3 par jour), messages de force en un tap, encouragement sur un objectif. La barre d'onglets, les messages de force et le sous-titre se cachent quand le clavier est ouvert pour laisser de la place aux messages. Chaque mot est envoyé avec un identifiant choisi par l'app : si le réseau lâche, l'envoi est retenté une fois sans jamais créer de doublon. Les mots reçus ne disparaissent plus pendant un rechargement lent, et la liste se remet à jour toute seule si la connexion en direct a été coupée |
| **Aquarium** | La scène de l'habitat en grand (bocaux, puis aquarium, récif, lagon), « Ensemble » ou gros plan sur un poisson, sa fiche avec la silhouette du prochain stade, les visiteurs qui passent, le carnet des visiteurs, le prochain habitat, le récap du mois |
| **Boutique** | « Notre habitat » en tête (conditions, cagnotte, achat ensemble), couleurs, bocaux, habits et accessoires, familiers, décorations par habitat |
| **Paramètres** | Surnom et couleur du poisson, surnoms, messages de force, notifications, widget de l'écran d'accueil, changement de mot de passe, déconnexion |
| **Fiche d'un sous-objectif** | Minuteur plein écran : écran noir, le poisson nage, le sous-objectif se coche tout seul à la fin |

**Progression longue (migration 006)** : 50 niveaux, 10 stades dessinés, 5 habitats achetés ensemble, écran Aquarium centré sur les poissons.

**Carnet des visiteurs (migration 007)** : 23 visiteurs à collectionner dès le premier jour. 14 perso (chacun les siens) et 9 à deux, qui arrivent soit par le nombre de sous-objectifs cochés, soit par les séries. Le carnet montre des jauges et des silhouettes ; un visiteur trouvé passe de temps en temps dans la scène (une ouverture sur trois, et à coup sûr le jour où la journée est complète) et rapporte des pièces. Une fenêtre « Un nouveau visiteur » s'ouvre à son arrivée, avec une notification.

**Lot 3** : humeurs du poisson (il dort de 22 h à 7 h, danse quand la journée est complète, boude à partir de 2 ratés dans la semaine), séries, minuteur, dé des défis, roue des surprises, décor de Noël en décembre (neige, sapin, bonnet pour les poissons sans accessoire), récap du mois, mode hors ligne, widget.

**Décorations, cadeaux et collections (migration 008, pas encore appliquée)** : 30 décorations payées avec ses propres pièces, posées à la main sur 5 emplacements fixes dans son aquarium (4 par personne dans l'aquarium commun, dès le premier habitat partagé). Elles restent dans le bocal et peuvent être déplacées dans l'aquarium commun. 7 collections avec un bonus de pièces quand elles sont complètes. Objets de Noël en vente du 1er au 25 décembre, puis gardés dans la vitrine. On peut offrir un objet à l'autre (message de 140 caractères maximum) ; si le niveau manque, le cadeau attend en réserve.

**Offrir un objet de son inventaire (migration 013, pas encore appliquée)** : un habit, un familier ou une décoration déjà possédé se donne à l'autre depuis la Boutique (bouton **Offrir** à côté de l'objet). Il quitte l'inventaire de celui qui offre (retiré de son poisson ou de son aquarium) et arrive chez l'autre, avec un petit mot facultatif. Aucune pièce n'est échangée et celui qui offre n'est pas remboursé.

**Photos (migration 009)** : rangées dans l'espace de stockage privé `chat-images` de Supabase (rubrique **Storage**), un dossier par duo que seuls ses deux membres peuvent lire. Chaque photo est réduite à 1 600 px avant l'envoi (environ 300 Ko), soit quelques milliers de photos dans le 1 Go de l'offre gratuite.

**Mots forts (migration 014)** : les messages de force (Réglages, propres à chaque compte) se choisissent avec un effet juste avant l'envoi. Un tap sur un mot ouvre une petite barre « Envoyer avec » : Pop, Cœurs, Bulles, Confettis ou Sans effet, tout en violet, et le choix envoie le mot. Dans Réglages, un tap sur un mot permet de lui donner un effet habituel (facultatif), seulement repéré dans la barre. L'effet est gardé sur le petit mot : l'autre le voit arriver avec la même bulle violette, le repère « Mot fort » et la pluie de pixels (une fois, désactivée si le téléphone limite les animations). Un compte sans aucun mot reçoit Tu gères, Courage et Fier de toi, qu'il peut modifier ou supprimer. Fichiers : `src/lib/effects.ts`, `Chat.tsx`, `Settings.tsx`.

**GIFs (migration 010)** : 22 GIFs pixel art rangés dans `public/gifs/` (16 memes et 6 « téléphone rose »), choisis depuis le bouton **GIF** de Petits mots. Le message garde seulement le nom du GIF, que la base vérifie. Les fichiers sont en pixel art à leur taille d'origine (128 × 112), agrandis net à l'écran : neuf fois moins de mémoire qu'en 384 × 336. Ils sont servis par Vercel et gardés sur le téléphone pour le mode hors ligne (adresse en `?v=2` pour ignorer l'ancien cache). Pour en ajouter un : déposer le fichier dans `public/gifs/` et l'inscrire dans `src/lib/gifs.ts`, sans migration.

**Notifications (lot 2)** : petit mot, photo ou GIF reçus, bulle ou friandise, objectif coché par l'autre (désactivé par défaut), rappel du soir vers 20 h s'il reste des sous-objectifs, bilan du lundi vers 8 h, nouveau visiteur dans le carnet (chaque notification se coupe dans Paramètres).

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
| Niveaux | 30 XP pour le niveau 2, puis 6 XP de plus à chaque niveau, 50 niveaux, 10 stades de 5 niveaux (Alevin, Petit, Juvénile, Moyen, Grand, Adulte, Majestueux, Ancien, Légendaire, Mythique). Chaque stade ajoute un détail au dessin |
| Habitats | Deux bocaux (plafond niveau 10), Aquarium à deux (les deux au niveau 8, 150 pièces, plafond 20), Grand aquarium (18, 350, plafond 30), Récif (28, 500, plafond 40), Lagon (38, 700, plafond 50). Au-dessus du plafond, l'XP s'accumule en réserve |
| Ratés | Sous-objectifs des jours passés de la semaine, ni faits ni retirés. Un raté reporté puis fait ne compte pas |
| Friandise | +1 XP pour le poisson de l'autre, 3 par jour |
| Surprise | Calculée le lundi matin : 3 ratés ou plus la semaine passée, et on doit une surprise à l'autre. Seul celui qui la reçoit peut la marquer comme reçue |
| Pièces | 1 pièce pour 5 XP gagnés, plus celles des visiteurs perso, moins les achats et les versements à la cagnotte. L'XP en réserve rapporte aussi des pièces, donc la cagnotte ne peut pas se bloquer |
| Séries | Sous-objectifs d'un objectif récurrent faits d'affilée. Reporté puis fait : la série continue. Raté (jour passé, pas fait) : retour à zéro. Retiré, ou aujourd'hui pas encore fait : sans effet |
| Quêtes annexes | Facultatif. Chaque jour, 3 quêtes tirées au hasard dans sa propre liste (37 de départ : 18 simples, 19 dures, copiées au premier tirage, modifiables avec « Gérer mes quêtes »). Une quête se valide avec un snap (photo) : 3 pièces si elle est simple, 5 si elle est dure, pour celui qui la valide. Une quête faite peut être gardée pour demain (2 au maximum) : elle revient à la même place et sa série monte ; si elle n’est pas refaite, la série retombe à zéro, sans pénalité. Les snaps vont dans le Wall of fame (espace `chat-images`). Pas de bonus ni de relance. Une quête retirée est archivée, les anciens snaps gardent son nom (migration 012) |
| Défi de la semaine | Un seul lancer de dé par semaine, parmi les défis de la liste commune. Défi réussi : 10 pièces dans la cagnotte |
| Roue des surprises | Tire une idée au hasard dans la liste commune. Le résultat n'est enregistré nulle part |
| Hors ligne | L'app s'ouvre avec les dernières données. Les coches attendent le retour du réseau puis partent toutes seules ; les autres actions demandent le réseau |
| Boutique | Chaque objet s'achète une fois, à partir d'un certain niveau. On ne peut équiper que ce qu'on possède |
| Visiteurs perso | Sous-objectifs cochés par chacun (les siens et les communs) : 10, 30, 75, 150, 300, 500, 800, 1 200. Meilleure série sur un objectif récurrent : 3, 7, 14, 30, 60, 100 jours. Les pièces (de 5 à 80) s'ajoutent au solde de celui qui l'a trouvé |
| Visiteurs à deux | Sous-objectifs cochés par le duo (chacun une fois) : 50, 200, 500, 1 000, 2 000. Série à deux, jours d'affilée où chacun a coché au moins un sous-objectif : 5, 21, 50, 100 jours. Les pièces (de 15 à 150) vont dans la cagnotte. Il faut un duo complet |
| Visiteur trouvé | Il le reste, même si on décoche ensuite. Les séries comptent le record : une série cassée ne fait rien perdre |
| Cagnotte | Chacun y verse ses pièces. L'habitat suivant s'achète d'un bouton dans la Boutique, par l'un ou l'autre, quand les deux poissons ont le niveau requis et que la cagnotte suffit. Elle sert aussi aux décorations, chaque habitat ouvrant les siennes |

Personne ne peut modifier l'XP, une coche ou les données de l'autre en contournant l'app : ces actions passent par des fonctions de la base qui vérifient tout.

## 5. Modifier l'application

| Je veux changer… | Comment |
|---|---|
| Mes objectifs, surnoms, couleurs, messages de force | Directement dans l'app |
| L'apparence, un écran | Le code, poussé sur `main` : Vercel redéploie en 1 à 2 minutes |
| Une règle de la base | Un fichier de migration (voir ci-dessous) |

**Ne jamais relancer `schema.sql`** une fois l'app utilisée : il efface toutes les données. Chaque évolution de la base arrive dans `supabase/migrations/` sous forme de fichier numéroté (`002_…sql`). On le colle dans le SQL Editor et on fait **Run**, une seule fois, dans l'ordre des numéros. La table `schema_migrations` garde la liste de ceux déjà appliqués. Les migrations `002_lot2.sql`, `003_push.sql`, `004_lot3.sql`, `005_widget.sql`, `006_progression.sql`, `007_visitors.sql`, `008_deco.sql`, `009_chat_photos.sql`, `010_gifs.sql`, `011_wheel.sql` et `012_quests.sql` sont déjà appliquées sur le projet `happy-fish`.

### Le widget, côté coulisses
- Le widget passe par l'app gratuite **Scriptable**. Dans Paramètres, **Installer le widget** donne les étapes et copie un script qui contient une clé personnelle.
- Le script interroge la fonction `widget` (dossier `supabase/functions/widget/`, vérification JWT désactivée) avec cette clé, qui renvoie les poissons du duo et l'avancement du jour. Il se met à jour environ toutes les 15 minutes (c'est iOS qui décide du moment exact).
- Les clés sont dans la table `widget_tokens`, que l'app ne peut pas lire directement. **Changer la clé du widget** rend l'ancien script inutilisable.

### Les notifications, côté coulisses
- La fonction `notify` (dossier `supabase/functions/notify/`, déployée dans Supabase, onglet **Edge Functions**) envoie les notifications.
- La base l'appelle quand un petit mot arrive ou qu'un objectif est coché, et une tâche planifiée (`happy-fish-tick`, extension pg_cron) la réveille toutes les heures pour le rappel du soir et le bilan du lundi (heure de Paris).
- Les clés d'envoi (VAPID) et le secret qui protège la fonction sont rangés dans **Vault** (Supabase, rubrique **Vault**, dans **Integrations**) sous les noms `hf_vapid_public`, `hf_vapid_private`, `hf_hook_secret` et `hf_notify_url`. La clé privée et le secret n'existent nulle part ailleurs : ne jamais les copier dans le code.
- La clé publique VAPID est aussi écrite dans `src/lib/push.ts`, c'est normal. Si on change les clés dans Vault, il faut changer celle-ci et chacun réactive les notifications.
- Pour un nouveau projet Supabase : appliquer les deux migrations, créer les quatre secrets Vault, déployer la fonction avec la vérification JWT désactivée (elle vérifie elle-même le secret ou la session).

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
| `src/lib/xp.ts` | Barème XP, stades, habitats et pièces (les mêmes que dans la base, vérifiés par `tests/progression.test.ts`) |
| `src/lib/push.ts`, `public/sw.js` | Abonnement aux notifications et leur affichage sur le téléphone |
| `supabase/schema.sql` | Tables, sécurité, règles |
| `supabase/seed.sql` | Catégories et suggestions de départ |
| `supabase/migrations/` | Évolutions de la base (lot 2 : boutique, cagnotte, bilan, notifications) |
| `supabase/functions/notify/` | Envoi des notifications |
| `supabase/functions/widget/` | Données du widget de l'écran d'accueil |
| `src/lib/mood.ts`, `src/lib/fx.ts`, `src/lib/season.ts` | Humeurs du poisson, bulles, décor de saison |
| `src/lib/widgetScript.ts` | Script Scriptable généré avec la clé de chacun |
| `src/lib/visitors.ts` | Catalogue des 23 visiteurs (le même que dans la base, vérifié par `tests/visitors.test.ts`) ; dessins dans `src/components/Visitors.tsx`, écran du carnet dans `src/components/Carnet.tsx` |
| `src/lib/deco.ts` | Décorations : emplacements, saisons, groupes ; dessins dans `src/components/Deco.tsx`, éditeur `DecoEditor.tsx`, rayon `DecoShop.tsx`, cadeaux `Gifts.tsx` |
| `src/lib/gifs.ts`, `public/gifs/` | Catalogue des GIFs des petits mots et leurs fichiers (vérifiés par `tests/gifs.test.ts`) |
| `src/components/Quests.tsx` | Quêtes annexes du jour, gestion de sa liste, Wall of fame |
| `src/lib/messages.ts` | Fusion des rechargements de petits mots, nouvel essai réseau, identifiant choisi avant l’envoi |
| `tests/` | 114 tests (`effects.test.ts` mots forts, `messages.test.ts` et `chat-id.test.ts` petits mots, `wheel.test.ts` roue, `quests.test.ts` quêtes, `gifs.test.ts` GIFs, `deco.test.ts` décorations, cadeaux, collections, `db.test.ts` lot 1, `lot2.test.ts` lot 2, `lot3.test.ts` lot 3, `progression.test.ts` progression longue, `visitors.test.ts` carnet des visiteurs, `widget.test.ts` et `widgetScript.test.ts` pour le widget) |

## 7. Dépannage

| Symptôme | Solution |
|---|---|
| « Configuration manquante » | Adresse ou clé Supabase absente de `src/lib/supabase.ts` |
| « Compte pas encore confirmé » | Étape 4 : désactiver **Confirm email** dans Supabase |
| « Code inconnu » en rejoignant le duo | Vérifier le code dans Paramètres, sur le téléphone de celui qui a créé le duo |
| L'app ne charge plus rien | Projet Supabase en pause après 7 jours sans activité : **Restore project** dans Supabase |
| « Relation does not exist » | `seed.sql` lancé avant `schema.sql` : lancer `schema.sql` d'abord |
| Pas de bouton pour activer les notifications | Ouvrir l'app depuis l'icône de l'écran d'accueil, pas depuis Safari (iOS 16.4 ou plus récent) |
| Notifications refusées par erreur | Réglages de l'iPhone, **Notifications**, **Happy Fish**, autoriser |
| Le test n'arrive pas | Supabase, **Edge Functions**, `notify`, onglet **Logs** ; désactiver puis réactiver dans Paramètres |
| Le widget affiche « attend le réseau » | Pas de réseau, ou clé changée : recopier le script depuis Paramètres et le recoller dans Scriptable |
| Une coche faite dans le métro n'apparaît pas chez l'autre | Elle part au retour du réseau, à la prochaine ouverture de l'app |
