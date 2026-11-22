# Miswan Academy — installatie (Supabase)

0. **Eigen project**: maak op supabase.com een gratis account en een nieuw project.
   Open daarna `static/js/config.js` en vul bij `url` de **Project URL** en bij `key` de **publishable key** in
   (Project Settings → API Keys). Gebruik nooit de `secret`/`service_role` key.
1. **Database**: SQL Editor → New query → plak heel `supabase/schema.sql` → Run.
2. **Authentication → Providers → Email**: zet *Confirm email* **uit**. Zet *Email OTP Expiration* op 600 (10 min).
3. **Authentication → Email Templates → Magic Link**: zet de code in de mail, bv.
   `<h2>Your Miswan Academy Login Code</h2><p style="font-size:28px;letter-spacing:6px"><b>{{ .Token }}</b></p>`
4. **Project Settings → Authentication → SMTP**: zet eigen SMTP aan (Gmail: `smtp.gmail.com`, poort 465, app-wachtwoord van miswanacademy@gmail.com).
   Zonder eigen SMTP verstuurt Supabase maar een paar mails per uur.
5. **Admin aanmaken**: Authentication → Users → Add user (Auto Confirm, sterk wachtwoord), daarna in de SQL Editor:
   `update public.profiles set role='admin' where email='jouw@email.com';`
6. **Authentication → URL Configuration**: Site URL = het adres waar de site gehost wordt.
7. Upload de hele map (behalve `supabase/` en dit bestand) naar GitHub Pages / Netlify. Open `login.html`.

Opmerking: het e-mailadres van een bestaande student is niet te wijzigen (alleen naam, telefoon, land, level, plan, notities, wachtwoord).
