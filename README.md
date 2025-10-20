# Github CRM/ERP – Basisstructuur

Deze zip bevat de **basis** voor jouw repo:
- **Main page** (`index.html`, `styles.css`, `app.js`) met een dropdown-menu linksboven.
- **Module-mappen** (nog zonder inhoud):  
  - `/crm`  
  - `/dashboard`  
  - `/kaart`  
  - `/trajecten`  
  - `/producten-diensten`

> Om lege directories mee te nemen in Git heb ik per map een `.gitkeep` toegevoegd. Er is verder **geen inhoud** in de mappen.

## Plaatsen in je repo (testbranch!)
```bash
git checkout -b dev
git add .
git commit -m "chore(repo): basisstructuur + main met dropdown"
git push -u origin dev
```
Maak vervolgens een **Pull Request** van `dev` → `main`. Niet direct naar `main` pushen.

## Lokale preview
Open `index.html` in je browser, of host via GitHub Pages. Het menu linkt naar de (nog lege) modulemappen.
