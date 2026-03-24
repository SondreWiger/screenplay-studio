---
marp: true
theme: uncover
paginate: true
backgroundColor: '#070710'
color: '#f4f4fc'
style: |
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;900&display=swap');

  :root {
    --brand: #FF5F1F;
    --dark: #070710;
    --surface: #181828;
    --surface-light: #24243a;
    --text: #f4f4fc;
    --text-muted: #9999bb;
  }

  * {
    font-family: 'Inter', sans-serif;
  }

  section {
    background: var(--dark);
    color: var(--text);
    font-size: 22px;
    padding: 40px 64px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  section::after {
    color: var(--text-muted);
    font-size: 11px;
  }

  h1 {
    color: var(--text);
    font-weight: 900;
    font-size: 2.2em;
    letter-spacing: -0.02em;
    line-height: 1.1;
    margin-bottom: 0.2em;
  }

  h2 {
    color: var(--brand);
    font-weight: 700;
    font-size: 1.4em;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    margin-bottom: 0.3em;
  }

  h3 {
    color: var(--brand);
    font-weight: 600;
    font-size: 1.05em;
    margin-bottom: 0.15em;
  }

  p {
    margin: 0.3em 0;
    line-height: 1.5;
  }

  strong {
    color: var(--brand);
  }

  em {
    color: var(--text-muted);
    font-style: normal;
  }

  a {
    color: var(--brand);
  }

  ul {
    list-style: none;
    padding-left: 0;
    margin: 0.3em 0;
  }

  ul li {
    padding: 3px 0;
    font-size: 0.88em;
    line-height: 1.45;
  }

  ul li::before {
    content: '▸ ';
    color: var(--brand);
    font-weight: bold;
  }

  code {
    background: var(--surface);
    color: var(--brand);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.8em;
  }

  blockquote {
    border-left: 3px solid var(--brand);
    padding: 8px 18px;
    background: var(--surface);
    border-radius: 0 6px 6px 0;
    margin: 10px 0;
    font-size: 0.85em;
  }

  blockquote p {
    margin: 0;
  }

  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.78em;
  }

  th {
    background: var(--brand);
    color: white;
    padding: 7px 12px;
    text-align: left;
    text-transform: uppercase;
    font-size: 0.75em;
    letter-spacing: 0.1em;
  }

  td {
    padding: 5px 12px;
    border-bottom: 1px solid var(--surface-light);
  }

  tr:nth-child(even) td {
    background: var(--surface);
  }

  section.lead {
    text-align: center;
    justify-content: center;
  }

  section.lead h1 {
    font-size: 2.8em;
  }

  section.title-slide {
    text-align: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--dark) 0%, #0f0f1c 50%, #1a0a00 100%);
  }

  section.title-slide h1 {
    font-size: 2.8em;
  }

  section.accent-bar {
    border-top: 4px solid var(--brand);
  }

  section.feature-grid ul li {
    background: var(--surface);
    padding: 8px 16px;
    border-radius: 6px;
    margin: 3px 0;
    border-left: 3px solid var(--brand);
  }

  section.feature-grid ul li::before {
    content: '';
  }

  section.closing {
    text-align: center;
    justify-content: center;
    background: linear-gradient(135deg, #1a0800 0%, var(--dark) 50%, #0f0f1c 100%);
  }

  section.closing h1 {
    font-size: 2.4em;
  }

  section.two-col {
    columns: 2;
    column-gap: 40px;
  }

---

<!-- _class: title-slide -->
<!-- _paginate: false -->

# SCREENPLAY<br>**STUDIO**

### WRITE. PLAN. PRODUCE.

*Fra FADE IN til siste klipp — i ett arbeidsområde.*

*Northem Development · Oslo, Norge · Siden 2024*

---

<!-- _class: accent-bar -->

## INT. PRESENTASJON — DAG

**SCREENPLAY STUDIO** er en **alt-i-ett plattform** for folk som lager film.
Manus. Breakdown. Tidsplan. Budsjett. Samarbeid. Én adresse.

- Profesjonell manusformatering — Courier Prime, selvfølgelig
- Sceneanalyse og shot lists som faktisk henger sammen
- Produksjonskalender teamet ditt kan stole på
- Budsjettsporing som produsenten din vil elske
- Sanntidssamarbeid — ingen flere "siste_versjon_FINAL_v3.fdx"

> *"Den fragmenterte arbeidsflyten med fem ulike verktøy? Det er en wrap."*

---

## Problemet alle kjenner

Verktøykaoset i en typisk produksjon:

| Verktøy | Kostnad | Hva det gjør |
|---------|---------|-------------|
| Final Draft / Celtx | ~$100+/år | Manusformatering |
| Google Sheets #1 | Gratis | Innspillingsplan |
| Google Sheets #2 | Gratis | Budsjett |
| Google Sheets #3 | Gratis | Kontaktliste |
| Notion | $96/år | Rollegallerier |
| E-post + WhatsApp | ∞ frustrasjon | "Har du sett siste versjon?" |

Du vet det er sant. **Screenplay Studio** dreper dette kaoset.

---

<!-- _class: accent-bar -->

## Verktøy for skriving

### ✍️ Manuseditor
Courier Prime, auto-formatering av scene headings, dialog, action. Du skriver — vi formaterer.

### 📋 Beat Sheet
Kartlegg dramaturgien: Save the Cat, Syd Field, Hero's Journey. Velg din gift.

### 🗂️ Korktavle
Dra-og-slipp scener som Post-its på veggen. Fargekod etter akt eller storyline. Mye ryddigere enn den faktiske veggen din.

### 🧠 Tankekart & Bueplanlegger
Brainstorm fritt. Visualiser karakter-arcs fra akt 1 til 3. Se helheten.

---

<!-- _class: accent-bar -->

## Verktøy for produksjon

### 🎬 Sceneanalyse (Breakdown)
Rekvisitter, kostymer, SFX, stunts, VFX — automatisk hentet fra manuset. AD-en din kan puste.

### 📸 Shot List & Storyboard
Kameratype, linse, bevegelse, lys. Legg til referansebilder. Fotografen din vil takke deg.

### 📅 Produksjonskalender
Oppmøtetider, lokasjoner, øvelser. Dra scener inn i kalenderen. Ferdig call sheet.

### 💰 Budsjett
Estimert vs. faktisk. Kategorier, leverandører, oversikt. Ingen flere overraskelser i post.

---

## Samarbeid i sanntid

Slutt å sende filer frem og tilbake. Alle jobber i **samme prosjekt, samtidig**.

- Se hvem som er online — og hva de jobber med
- Rollebasert tilgang: *forfatter, regissør, produsent, crew*
- Full revisjonshistorikk — gå tilbake til forrige draft med ett klikk
- Push-varsler når noe endres i prosjektet ditt

> *"Tenk Google Docs — men det vet hva en SLUGLINE er."*

---

<!-- _class: accent-bar -->

## 7 Formater — én plattform

Ikke bare spillefilm. Vi snakker **alt som starter med et manus**:

- 🎬 **Spillefilm** — Hollywood-standard formatering
- 📺 **TV-serie** — Episodisk, pilot, seasonal arc
- 🎙️ **Hørespill** — Lydproduksjon og radiodrama
- 🎭 **Teater** — Scenemanus med akt-struktur
- 🎧 **Podcast** — Skriptbaserte episoder
- 📱 **Innhold** — YouTube, TikTok, branded content
- 📡 **Kringkasting** — TV-produksjon i sendeflate

Du bytter format. Verktøyene følger med.

---

## Hvem sitter i salen?

### 🎓 Filmstudenter
Samme verktøy som studioene bruker — helt gratis. Fordi en Westerdals-student fortjener like gode verktøy som et Paramount-team.

### ✏️ Manusforfattere
Skriv, strukturer, pitch. Alt fra én plass. Aldri mer "vent, hvor la jeg beat sheetet?"

### 🎬 Produksjonsselskaper
Breakdown → budsjett → tidsplan → innspilling. Hele crewet i én workspace. Mindre admin, mer "rolling".

### 🎭 Teater, podcast & innholdsskapere
Alt som har et manus som fundament hører hjemme her.

---

<!-- _class: accent-bar -->

## Alt henger sammen

- **PDF-eksport** — bransjekorrekt formatering, klar for innlevering
- **AI-analyse** — strukturell innsikt, pacing, dialog-balanse
- **Storyboard** — referansebilder knyttet til hvert skudd i shot listen
- **Lokasjonskart** — kartvisning over alle locations i prosjektet

> Endrer du en scene i editoren? Breakdown, shot list og tidsplan oppdateres. Automatisk. Ingen manuell synkronisering.

Det er hele poenget: **ett system, ikke ti**.

---

## Under panseret

| Lag | Teknologi |
|-----|-----------|
| Frontend | Next.js · React · TypeScript |
| Styling | Tailwind CSS · Framer Motion |
| Database | Supabase (PostgreSQL + RLS) |
| Sanntid | WebSockets · Push-varsler |
| Eksport | jsPDF · html2canvas |
| Kart | Leaflet · react-leaflet |
| Offline | IndexedDB — fungerer uten nett |

Open source. Ingen black box. Ingen vendor lock-in.

---

<!-- _class: accent-bar -->

## Gratis vs. Pro

| | **Gratis** | **Pro** |
|---|:---:|:---:|
| Manuseditor | ✅ | ✅ |
| Alle 12 kjerneeverktøy | ✅ | ✅ |
| 7 manusformater | ✅ | ✅ |
| Sanntidssamarbeid | ✅ | ✅ |
| Avansert eksport | — | ✅ |
| AI-analyse | — | ✅ |
| Egendefinert branding | — | ✅ |
| Prioritert support | — | ✅ |

**Ingen tidsbegrensning. Ingen "trial". Du eier gratis-planen for alltid.**

---

## Mer enn et verktøy

- 🏆 **XP & nivåer** — Skriv mer, nå høyere. Gamification som faktisk motiverer
- 💬 **Community** — Del manus, få feedback, finn samarbeidspartnere
- 📝 **Blogg** — Bransjetips, guider, behind-the-scenes
- 🎯 **Skriveøkter** — Tidsbaserte utfordringer for å holde momentum
- 🌟 **Idétavler** — Pin inspirasjon, moodboards, referanser

> *"Skriving er ensomt nok. Verktøyet ditt trenger ikke å være det."*

---

## Filosofien

> *"Ingen investorroadmap. Ingen enterprise-pivot. Bygget av én utvikler i Norge — formet av de som faktisk bruker det."*

- 🔓 **Åpen kildekode** — Du kan lese hver eneste linje
- 🇳🇴 **Laget i Oslo** — Av en som kjenner bransjen
- 🗣️ **Brukerstyrt** — Features bygges etter feedback fra ekte filmskapere
- 🎨 **10 fargetemaer** — Orange, blå, lilla, grønn, rosa, cyan, amber, lime, rose, indigo

*Mørkt tema som standard — fordi de beste idéene kommer etter midnatt.*

---

<!-- _class: closing -->
<!-- _paginate: false -->

# FADE IN:

### Ditt neste prosjekt starter her.

**Start gratis — ingen kredittkort, ingen hake.**

*screenplay.studio*

*Northem Development · Oslo, Norge*

*WRITE. PLAN.* **PRODUCE.**

*— CUT TO BLACK —*
