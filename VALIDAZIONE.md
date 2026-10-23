# Verifica del 23 ottobre 2026

## Eseguito qui, senza Docker

| Verifica | Risultato |
| --- | --- |
| TypeScript + build Vite di produzione | Superata |
| Vitest, casi sintetici | 28 test superati, inclusi 11 casi di regressione del rendering |
| Playwright sulla build di produzione | 4 test superati |
| Archivi privati, sola lettura e copie solo in memoria | 281 file, 3867 pagine; 281 modifiche e riaperture superate |
| Aperture private nel browser sulla build compilata | 4 archivi rappresentativi, più pagine per archivio; nessun errore JavaScript, nessuna richiesta esterna |
| Generazione fixture sintetiche | 5 `.bmpr` e riferimenti SVG generati |
| Inventario dei riferimenti PNG locali | 456 abbinamenti candidati in 113 archivi; non equivalgono a confronti verificati |
| Confronto visivo manuale | 13 pagine esaminate affiancando PNG esistente e SVG dell'editor in Chromium |
| Audit npm eseguito separatamente | 0 vulnerabilità riportate |

Le verifiche sugli archivi coprono no-op identico byte per byte, modifica di una pagina, conservazione delle altre risorse e tabelle, riapertura con sql.js e integrità SQLite. I casi sintetici includono dati BLOB, campi e controlli sconosciuti, pagine aggiunte/cestinate/ripristinate, risorse con lo stesso ID in rami diversi, errori di formato, trasformazioni, cronologia, escaping negli export e immagini passive.

I test browser coprono testo, geometria, trascinamento, ridimensionamento, doppio clic, duplicazione, eliminazione, undo/redo, pagine, sei formati di export, PNG valido, download `.bmpr` sperimentale e riapertura, errori di input e layout tablet. La cattura delle richieste non ha osservato traffico verso servizi esterni.

I dati privati non sono stati copiati nel progetto, nei test o negli artefatti distribuiti. Manifest e immagini dei confronti visivi sono conservati soltanto nella cartella temporanea locale, fuori dal repository. I test strutturali e lo smoke test browser non generano screenshot privati. Le immagini in `docs/screenshots/` mostrano esclusivamente la demo sintetica.

## Confronto visivo eseguito

Campioni dell'inventario locale: 0, 1, 2, 3, 5, 12, 14, 15, 25, 46, 89, 156, 255. Comprendono diagrammi, schermate incorporate e ritagliate, moduli, tabelle e pannelli a schede. Il confronto è manuale, non una misura automatica di somiglianza pixel per pixel.

Difetti individuati e corretti: geometria e limiti delle frecce curve, punte predefinite e tratteggio, ritaglio dei gruppi in millesimi, etichette troncate, enfasi nel testo, pannelli senza bordo, colonne delle tabelle, icone comuni e altezza delle schede. Gli asterischi delle espressioni cron ora rimangono letterali. Le correzioni principali hanno test sintetici riproducibili senza dati dei clienti.

I PNG dei campioni 1, 14 e soprattutto 25 presentano differenze di contenuto rispetto al BMPR corrente: non sono riferimenti affidabili per certificare quella revisione. Il campione 25 è escluso dal giudizio di fedeltà. Restano differenze di font, spessori, spaziature, stile delle tabelle e controlli avanzati; il renderer non è una replica pixel-identica di Balsamiq. Le altre 443 coppie candidate non sono state esaminate manualmente.

## Non ancora verificato

- Build e avvio effettivi del container Docker: Docker non è installato su questa macchina.
- Riapertura in Balsamiq dei file salvati, comprese nuove pagine e file creati da zero.
- Confronto esaustivo dell'intera raccolta e delle revisioni esatte dei PNG.
- Tutti i controlli avanzati e tutte le versioni del formato.
- Pubblicazione, nome definitivo e licenza.

Il salvataggio rimane quindi sperimentale. La procedura per completare la verifica sulla macchina di supporto è nel README.
