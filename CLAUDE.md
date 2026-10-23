# bmpr-editor — contesto del progetto

Progetto personale di Antonio, anche per il portfolio. Nato il 22/10/2026 da un lavoro per un cliente, in cui un file Balsamiq `.bmpr` è stato letto senza avere Balsamiq.

Leggere prima:
- `PIANO_editor_bmpr.md`: obiettivo, scelte tecniche, architettura, step 0–10, requisiti, rischi legali, decisioni aperte;
- `NOTE_bmpr_cantiere_personale.md`: cosa è stato fatto sul file del cliente e com'è fatto il formato `.bmpr`, con esempi JSON.

## Cosa è il progetto

Un'app web gratuita che apre i file `.bmpr` **nel browser, senza server**, li mostra, li modifica, li risalva e li esporta (SVG, PNG, Markdown, Mermaid per i diagrammi).

## Stato

- Prima versione implementata il 23/10/2026: React + TypeScript, Vite, sql.js, SVG, rough.js, test Vitest/Playwright, Docker + Compose + Nginx. Leggere `README.md` per avvio, funzionalità e limiti.
- L'utente ha autorizzato l'implementazione completa nel repository e il confezionamento Docker. Docker non è installato qui: avvio del container e riapertura delle copie in Balsamiq da provare sulla macchina di supporto.
- Il salvataggio è accessibile soltanto come download sperimentale con attivazione esplicita nell'interfaccia. Non presentare la compatibilità Balsamiq come verificata.
- Demo e fixture distribuite sono sintetiche. L'utente ha indicato la raccolta Dropbox come fonte di esempi: autorizzate analisi e prove locali in sola lettura, senza inserire file, testi o screenshot privati nel repository.
- Nome cartella: `bmpr-editor`, scelto da Antonio. Il nome dell'app è ancora da decidere.
- Confronto visivo locale eseguito su 13 pagine della raccolta, con correzioni al renderer; manifest e immagini private soltanto nella cartella temporanea esterna. Vedere `VALIDAZIONE.md` per campioni, riferimenti obsoleti e limiti. Non confondere i 456 abbinamenti candidati con verifiche completate.
- Ancora da decidere: licenza e pubblicazione. L'app è stata preparata per Docker locale; non è stata pubblicata.

## Fatti accertati sul formato

- Il `.bmpr` è un database **SQLite 3** con le tabelle `INFO`, `BRANCHES`, `RESOURCES`, `THUMBNAILS`, `USERS`, `COMMENTS`.
- Ogni pagina è in `RESOURCES.DATA` come JSON: `mockup.controls.control` = lista di controlli con `typeID`, `x`, `y`, `w`, `h`, `zOrder` e `properties`.
- Analizzati in sola lettura 281 file reali: 240 con schema 2.0 e 41 con schema 1.2, per 3867 pagine. Su tutti verificati no-op identico e modifica/riapertura nell'editor in memoria, senza modificare gli originali. Questa verifica non sostituisce Balsamiq vero.

## Regole fisse

1. **Il file salvato deve riaprirsi in Balsamiq**, senza errori e senza perdere niente. È un requisito obbligatorio: campi e controlli sconosciuti vanno conservati e riscritti identici, si salva su un file nuovo o si chiede conferma prima di sovrascrivere, test «andata e ritorno» e prova in Balsamiq vero.
2. **Rischi legali, cosa non fare**:
   - niente «Balsamiq» nel nome dell'app, del dominio o del repository;
   - niente logo, grafica, icone, font o codice di Balsamiq;
   - non presentarla come «Balsamiq gratis» né far pensare a un legame ufficiale.
   Si può dire solo «compatibile con i file .bmpr». Prima di pubblicare, leggere la licenza di Balsamiq.
3. **Privacy**: l'app lavora solo in locale nel browser. In test distribuiti, demo e portfolio si usano solo file creati da zero, **mai mockup di clienti**. I testi di esempio nelle note sono stati neutralizzati; ricontrollare comunque i documenti prima di pubblicare. Su indicazione dell'utente si possono verificare localmente i file Dropbox in sola lettura, senza distribuirne contenuti o artefatti.

## Come lavorare con Antonio

- Rispondere in italiano, sintetico, senza fare film.
- Non prendere decisioni da solo e non inventare nomi: proporre e chiedere.
- Prima di creare cartelle nuove, chiedere se il lavoro va in una esistente.
- Credenziali e dati personali non vanno mai pubblicati o caricati su repository.
