# Editor web per file `.bmpr` — piano di progetto

Progetto personale / portfolio. Nome provvisorio: **«bmpr-editor»** (da decidere).
Base tecnica: `NOTE_bmpr_cantiere_personale.md` (formato del file, esempi JSON).

## Stato di attuazione — 23/10/2026

Il piano sotto resta il riferimento originale. È stata implementata una prima versione con React + TypeScript, Vite, sql.js, SVG, rough.js, Vitest/Playwright e distribuzione Docker/Compose tramite Nginx. Avvio e funzionalità sono descritti in `README.md`.

Sono presenti lettore, viewer, editor base, nuovi controlli/pagine, cronologia, immagini incorporate, export SVG/PNG/Markdown/JSON/Mermaid/draw.io e writer conservativo. Il writer resta sperimentale: manca la prova in Balsamiq. Sono state eseguite verifiche locali in memoria su 281 archivi privati, senza distribuirli né modificarli. Gli esempi nel progetto sono sintetici.

Restano aperti: validazione in Balsamiq e confronto con i suoi PNG, avvio Docker sulla macchina di supporto, maggiore fedeltà dei controlli avanzati, nome definitivo, licenza e eventuale pubblicazione. Nessun sito è stato pubblicato.

## 1. Obiettivo

Un'app web gratuita che:
1. apre un file `.bmpr` (Balsamiq) **nel browser, senza server** (il file non lascia il PC);
2. mostra le pagine (mockup e diagrammi);
3. permette di modificarle (spostare, ridimensionare, testi, aggiungere / togliere elementi);
4. risalva un `.bmpr` che Balsamiq riapre (**requisito obbligatorio**, vedi sezione 6);
5. esporta in SVG, PNG, Markdown e, per i diagrammi, Mermaid.

Fuori obiettivo: copiare Balsamiq al 100% (tutti i controlli, stesso aspetto, collaborazione online).

## 2. Scelte tecniche (proposta)

| Tema | Proposta | Perché |
|---|---|---|
| Linguaggio | **TypeScript** | tipi per il modello dei controlli, meno errori |
| Build | **Vite** | semplice, veloce, produce file statici |
| Lettura / scrittura SQLite | **sql.js** (SQLite compilato in WebAssembly) | il `.bmpr` è SQLite: si apre e si salva direttamente nel browser |
| Disegno | **SVG** | vettoriale, zoom senza perdita, facile da esportare |
| Interfaccia | TypeScript semplice all'inizio; React solo se l'interfaccia cresce | meno dipendenze |
| Stile sketch (dopo) | **rough.js** + font a mano libero | look «disegnato a mano» |
| Test | **Vitest** | stesso ecosistema di Vite |
| Pubblicazione | **GitHub Pages** | gratis, sito statico, link da mettere nel portfolio |

## 3. Architettura

```
src/
  io/
    bmprReader.ts     apre il file con sql.js, legge INFO, BRANCHES, RESOURCES, THUMBNAILS
    bmprWriter.ts     riscrive DATA delle pagine, aggiorna ArchiveRevision, salva il file
  model/
    types.ts          Project, Page, Control (con i campi noti + "resto" sconosciuto)
    normalize.ts      stringhe → numeri, colori interi → #RRGGBB, w/h mancanti → measuredW/H
  render/
    registry.ts       mappa typeID → funzione che disegna
    controls/         un file per tipo: canvas.ts, label.ts, paragraph.ts, arrow.ts, icon.ts, textInput.ts, …
    unknown.ts        tipo non gestito → riquadro tratteggiato con il nome del typeID
  editor/
    selection.ts      selezione singola / multipla
    transform.ts      sposta, ridimensiona, maniglie
    textEdit.ts       modifica testi sul posto
    history.ts        undo / redo (ogni modifica è un comando reversibile)
    palette.ts        aggiunta di nuovi controlli
  export/
    svg.ts  png.ts  markdown.ts  mermaid.ts
  ui/
    app.ts            layout: elenco pagine | area di disegno | pannello proprietà
tests/
  fixtures/           file .bmpr di esempio (NON di clienti)
```

**Regola principale: non perdere dati.** Ogni controllo tiene da parte tutti i campi che l'editor non conosce e li riscrive identici al salvataggio. Un controllo di tipo sconosciuto si vede come riquadro tratteggiato ma resta nel file. Così un file aperto e salvato non si rovina mai, anche se l'editor gestisce pochi tipi.

## 4. Step di sviluppo

Ogni step finisce con qualcosa che funziona e si può mostrare.

### Step 0 — Preparazione
- Creare 4–5 file `.bmpr` di esempio con Balsamiq (versione di prova): uno a diagramma, uno con form, uno con tabelle, uno con icone e frecce curve, uno con più pagine.
- Esportare da Balsamiq anche il PNG di ogni pagina: serve per confrontare il disegno.
- Creare il repository, Vite + TypeScript, Vitest.
- Controllare i termini d'uso di Balsamiq sul formato e decidere nome e licenza.

**Fatto quando:** il progetto si avvia e ci sono i file di esempio con i loro PNG.

### Step 1 — Lettore
- `bmprReader`: apertura con sql.js, elenco pagine (saltando quelle `trashed`), controlli di ogni pagina.
- `normalize`: numeri, colori, dimensioni.
- Pagina di debug che mostra il JSON pulito.

**Fatto quando:** tutti i file di esempio si aprono, i test controllano numero di pagine e controlli.

### Step 2 — Viewer
- Disegno in SVG dei tipi base: `Canvas`, `Label`, `Paragraph`, `TextInput`, `Icon` (prima come segnaposto), `Arrow` (dritta e curva con `p0`, `p1`, `p2`).
- Ordine di disegno con `zOrder`; tipi sconosciuti come riquadro tratteggiato.
- Elenco pagine a sinistra, zoom e spostamento della vista.

**Fatto quando:** le pagine di esempio somigliano ai PNG esportati da Balsamiq (stesse posizioni, stessi testi).

### Step 3 — Export
- SVG della pagina, PNG (SVG disegnato su canvas), Markdown con i testi di tutte le pagine.

**Fatto quando:** i tre export si scaricano e si aprono.
**Prima versione pubblicabile (viewer + export) → GitHub Pages.**

### Step 4 — Editor base
- Selezione con clic e con riquadro, spostamento, ridimensionamento con maniglie.
- Modifica dei testi con doppio clic.
- Cancellazione, copia / incolla, undo / redo.
- Pannello proprietà: posizione, dimensione, colore, testo.

**Fatto quando:** si modifica una pagina senza errori e undo / redo riporta sempre allo stato giusto.

### Step 5 — Salvataggio `.bmpr`
- `bmprWriter`: riscrive `DATA` delle pagine modificate, aggiorna `ArchiveRevision`, il resto del file resta uguale.
- Test «andata e ritorno»: apro e salvo senza modifiche → il contenuto delle pagine è identico all'originale.
- Prova manuale: il file salvato si riapre in Balsamiq.

**Fatto quando:** tutti i file di esempio passano il test andata e ritorno e si riaprono in Balsamiq.

### Step 6 — Nuovi elementi
- Barra con i controlli da aggiungere: riquadro, etichetta, paragrafo, freccia, icona, campo di testo.
- Aggiunta e cancellazione di pagine.

**Fatto quando:** si crea da zero una pagina nuova, si salva e Balsamiq la apre.

### Step 7 — Più controlli
- Un tipo alla volta, in ordine di utilità: `Button`, `ComboBox`, `CheckBox`, `RadioButton`, `DataGrid`, `Window`/`BrowserWindow`, gruppi, ecc.
- Per ogni tipo: disegno, proprietà modificabili, test.

**Fatto quando:** i file di esempio non hanno più riquadri tratteggiati.

### Step 8 — Aspetto
- Stile sketch con rough.js e font a mano libero (attivabile / disattivabile).
- Icone: mappatura degli ID (`circle-solid`, …) su una libreria di icone libera.

### Step 9 — Export diagrammi
- Mermaid e draw.io per le pagine a diagramma: i riquadri diventano nodi, le frecce si agganciano al riquadro più vicino ai loro estremi.
- Avviso chiaro che il risultato è approssimato.

### Step 10 — Portfolio
- README con screenshot, demo online con un file di esempio, descrizione di cosa fa e cosa no.
- Breve articolo / pagina portfolio: formato analizzato, scelte tecniche, test andata e ritorno.

## 5. Rischi

| Rischio | Come si gestisce |
|---|---|
| Formato non documentato, varia tra versioni | più file di esempio, controllo di `SchemaVersion`, campi sconosciuti conservati |
| File salvato che Balsamiq non apre | test andata e ritorno + prova in Balsamiq a ogni step dal 5 in poi |
| Marchio / licenza Balsamiq | niente nome, logo, icone o font di Balsamiq; «compatibile con .bmpr» |
| Mockup di clienti | tutto in locale nel browser; nei test e nella demo solo file creati da zero |

## 6. Requisito obbligatorio: il file si riapre in Balsamiq

Ogni `.bmpr` salvato dall'editor **deve riaprirsi in Balsamiq** senza errori e senza perdere niente. Se questo non è garantito, il salvataggio non si rilascia.

Come si verifica:
- test automatico «andata e ritorno»: apro, salvo senza modifiche → le pagine sono identiche all'originale;
- test automatico con modifiche: apro, modifico, salvo, riapro con l'editor → le modifiche ci sono e il resto è invariato;
- prova manuale in Balsamiq vero (versione di prova) a ogni step dal 5 in poi, su tutti i file di esempio;
- l'editor non cancella e non riscrive mai campi o controlli che non conosce;
- l'editor salva sempre in un **file nuovo** (o chiede conferma prima di sovrascrivere), così l'originale non si perde.

## 7. Rischi legali: cosa non fare

**Non fare:**
- usare «Balsamiq» nel nome dell'app, del dominio o del repository (es. no «Balsamiq Free», «Free Balsamiq Editor»);
- usare logo, colori del marchio o grafica del sito Balsamiq;
- copiare icone, font, immagini o librerie di controlli di Balsamiq (né dal programma né dai suoi file);
- copiare codice di Balsamiq, decompilarlo o aggirarne la licenza;
- presentare l'app come «sostituto gratuito» o «versione gratis» di Balsamiq, o far pensare a un legame ufficiale;
- usare nella demo, nei test o nel portfolio mockup di clienti (anche solo screenshot).

**Si può fare (da verificare prima di pubblicare):**
- dire che l'app è «compatibile con i file .bmpr»;
- leggere e scrivere il formato dei file, ricavato studiando file propri;
- usare font e icone con licenza libera (es. OFL, MIT) e citarle nel README.

**Prima di pubblicare:** leggere i termini d'uso / licenza di Balsamiq per vedere se vietano qualcosa sul formato dei file; se resta un dubbio, chiedere a un legale.

## 8. Da decidere

1. Nome del progetto.
2. TypeScript semplice o React per l'interfaccia.
3. Licenza (es. MIT).
4. Dove pubblicarlo (GitHub Pages sul tuo account o altro).
