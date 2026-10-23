# bmpr-editor — contesto del progetto

Progetto personale di Antonio, anche per il portfolio. Nato il 22/10/2026 da un lavoro per un cliente, in cui un file Balsamiq `.bmpr` è stato letto senza avere Balsamiq.

Leggere prima:
- `PIANO_editor_bmpr.md`: obiettivo, scelte tecniche, architettura, step 0–10, requisiti, rischi legali, decisioni aperte;
- `NOTE_bmpr_cantiere_personale.md`: cosa è stato fatto sul file del cliente e com'è fatto il formato `.bmpr`, con esempi JSON.

## Cosa è il progetto

Un'app web gratuita che apre i file `.bmpr` **nel browser, senza server**, li mostra, li modifica, li risalva e li esporta (SVG, PNG, Markdown, Mermaid per i diagrammi).

## Stato

- Solo analisi e piano. **Nessun codice scritto.** Prossimo passo: Step 0 (file di esempio creati con Balsamiq in versione di prova, repository, Vite + TypeScript).
- Nome cartella: `bmpr-editor`, scelto da Antonio. Il nome dell'app è ancora da decidere.
- Ancora da decidere: TypeScript semplice o React, licenza, dove pubblicare.

## Fatti accertati sul formato

- Il `.bmpr` è un database **SQLite 3** con le tabelle `INFO`, `BRANCHES`, `RESOURCES`, `THUMBNAILS`, `USERS`, `COMMENTS`.
- Ogni pagina è in `RESOURCES.DATA` come JSON: `mockup.controls.control` = lista di controlli con `typeID`, `x`, `y`, `w`, `h`, `zOrder` e `properties`.
- È stato visto **un solo file** (`SchemaVersion` 2.0): il resto va verificato su altri file.

## Regole fisse

1. **Il file salvato deve riaprirsi in Balsamiq**, senza errori e senza perdere niente. È un requisito obbligatorio: campi e controlli sconosciuti vanno conservati e riscritti identici, si salva su un file nuovo o si chiede conferma prima di sovrascrivere, test «andata e ritorno» e prova in Balsamiq vero.
2. **Rischi legali, cosa non fare**:
   - niente «Balsamiq» nel nome dell'app, del dominio o del repository;
   - niente logo, grafica, icone, font o codice di Balsamiq;
   - non presentarla come «Balsamiq gratis» né far pensare a un legame ufficiale.
   Si può dire solo «compatibile con i file .bmpr». Prima di pubblicare, leggere la licenza di Balsamiq.
3. **Privacy**: l'app lavora solo in locale nel browser. In test, demo e portfolio si usano solo file creati da zero, **mai mockup di clienti**. Le note contengono ancora esempi con testi del cliente: vanno tolti prima di pubblicare.

## Come lavorare con Antonio

- Rispondere in italiano, sintetico, senza fare film.
- Non prendere decisioni da solo e non inventare nomi: proporre e chiedere.
- Prima di creare cartelle nuove, chiedere se il lavoro va in una esistente.
- Credenziali e dati personali non vanno mai pubblicati o caricati su repository.
