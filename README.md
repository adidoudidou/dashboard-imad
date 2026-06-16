# Dashboard Imad — Next.js + Google Sheets

Dashboard de gestion commerciale avec données en temps réel.

## Dashboards inclus
- 💰 Total Revenus / Dépenses / Bénéfice net
- 📦 Tableau d'échéances (À payer / En retard)
- 🎯 Objectif de bénéfice mensuel avec progression (sauvegardé dans le Sheet)
- 📈 Bénéfice HT par mois (graphique barres)
- 📅 Évolution journalière du CA
- 📊 Progression mois vs mois dernier
- 🛒 Ventes totales par catégorie (Boissons, Boucherie, Charcuterie, Épicerie, Fruits & Légumes, Rôtisserie)
- 📐 Marge brute par catégorie
- ⚖️ Seuil de rentabilité
- 🧮 Coût matière % (avec alertes couleur)
- 🥧 Répartition des dépenses

## Structure du Sheet attendue
- Onglet **Ventes** : colonnes Date, Numéro Z, CA HT Jour, Ventes Boissons, Ventes Boucherie, etc.
- Onglet **Dépenses** : colonnes Date de facturation, Fournisseur, Montant HT, Catégorie, Statut_paiement, etc.
- Onglet **Objectifs** : créé automatiquement à la première sauvegarde d'objectif

## Installation
```bash
npm install
cp .env.local.example .env.local
# Remplir les variables dans .env.local
npm run dev
```

## Configuration Google Cloud
1. Activer l'API Google Sheets sur console.cloud.google.com
2. Créer un compte de service → télécharger le JSON
3. Partager le Sheet avec le `client_email` du JSON (accès Éditeur)
4. Copier `client_email` et `private_key` dans `.env.local`

## Déploiement Vercel
1. Push sur GitHub
2. vercel.com/new → importer le repo
3. Ajouter les 3 variables d'environnement dans Settings → Environment Variables
4. Deploy

## Logique des calculs
- **Seules les lignes avec Numéro Z** sont comptées comme ventes réelles
- **Marge brute** = Ventes catégorie - Dépenses fournisseurs même catégorie (hors charges fixes)
- **Seuil de rentabilité** = Charges fixes ÷ Taux de marge sur coût variable
- **Coût matière %** = Total dépenses fournisseurs ÷ Total ventes × 100
