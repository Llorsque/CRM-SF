
# Github CRM — UI Patch (GO UI)

Deze patch levert:
- Clubs-overzicht met zoek/filter
- 4 formulieren (Vereniging, Contactpersoon, Leden/Vrijwilligers per jaar, Contributies per jaar)
- Supabase-koppeling met automatische auditvelden (`created_at`, `updated_at`)
- Live refresh na opslaan

## Installatie
1) Gebruik een testbranch (`ui-dev`) of maak eerst een snapshot op `main`.
2) `npm i`
3) `.env` vullen op basis van `.env.example`
4) Supabase SQL: `sql/01_schema.sql` → `sql/02_policies.sql`
5) `npm run dev`
