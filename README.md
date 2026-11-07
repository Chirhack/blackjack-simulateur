# Blackjack : simulateur et compteur Hi-Lo

Deux pages HTML autonomes, à ouvrir directement dans un navigateur.

- **`simulateur/blackjack-table.html`** : table de blackjack jouable, avec le tableau de stratégie de base sur le côté. La case de la main en cours s'allume en direct. Version claire : `blackjack-table-light.html`.
- **`blackjack.html`** : compteur Hi-Lo mécanique, une figure animée qui montre le true count comme une pente. Version claire : `blackjack-light.html`.

Jeu fictif, sans argent réel.

## Commandes de la table

T tirer, R rester, D doubler, S séparer, Entrée distribuer, 1 à 4 pour les jetons. La page démarre en pilote automatique ; un clic ou une touche rend la main.

## Règles

6 paquets, le croupier reste sur tous les 17, doublement après séparation, blackjack payé 3:2, 4 mains au plus, un seul tirage sur des as séparés, ni assurance ni abandon, coupe à 234 cartes.

## Chiffres mesurés

| Mesure | Valeur |
|---|---|
| Stratégie de base, mise fixe | environ −0,41 % |
| Avantage selon le true count | −0,38 % + 0,49 % par point |
| Seuil de rentabilité | TC +0,8 |

`node sim.mjs 30000000` relance la simulation, et `node simulateur/test.mjs` vérifie le moteur de jeu et le tableau.

## Reconstruire les pages

`build.mjs` importe le kit de la skill Anatomy par un chemin absolu local. Pour reconstruire ailleurs, adaptez ces imports. Les pages HTML déjà construites n'en ont pas besoin.
