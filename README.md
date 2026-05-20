# L1_Web

# Galerie d'images

Application web full-stack réalisée pour le cours [VanillaAcademy](https://vanillacademy.com) : galerie d'images avec commentaires, comptes utilisateurs et système de likes.

## Stack

- **Backend** : Node.js (module `http` natif, sans Express)
- **BDD** : PostgreSQL via le driver `pg`
- **Frontend** : HTML / CSS / JavaScript vanilla (pas de framework)

## Fonctionnalités

- 📷 Galerie d'images générée dynamiquement depuis la BDD (grille CSS responsive)
- 💬 Système de commentaires lié à chaque image
- 🔐 Inscription / connexion avec mot de passe hashé (SHA-256 + sel aléatoire)
- 🍪 Sessions persistantes via cookies
- ❤️ Likes par utilisateur connecté + section "Mes likes" sur l'accueil
- 🔍 Zoom interactif sur l'image (clic gauche / clic droit)
- ✅ Validation côté client du formulaire de commentaire

## Lancer le projet

```bash
# 1. Initialiser la BDD PostgreSQL
psql -f application_image.sql

# 2. Installer les dépendances
npm install

# 3. Démarrer le serveur
node server.js
