
# CRM Augment (Vanilla)
Sleep deze map **crm/augment/** in je repo.

## Gebruik in je HTML (bijv. crm/index.html)
1) Voeg boven je afsluitende </body> toe:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<link rel="stylesheet" href="crm/augment/crm-augment.css">
<script src="crm/augment/crm-augment.js"></script>

<button id="crm-add-btn">+ Toevoegen / Bewerken</button>
<script>
  const SUPABASE_URL  = 'https://<JOUW-PROJECT>.supabase.co';
  const SUPABASE_ANON = '<JOUW-ANON-KEY>';
  function currentOrgId(){
    return window.activeClubId || document.querySelector('[data-org]')?.getAttribute('data-org') || '';
  }
  CRMUI.init({ supabaseUrl: SUPABASE_URL, anonKey: SUPABASE_ANON, getOrgId: currentOrgId });
  CRMUI.attach('#crm-add-btn');
</script>
```

2) Zorg dat er ergens in je DOM de actieve club-id beschikbaar is, bijv.:
```html
<div data-org="ID_CODE_VAN_ORGANISATIE"></div>
```

3) SQL heb je al uitgevoerd (club_interactions, trajecten, ...). Klaar!
