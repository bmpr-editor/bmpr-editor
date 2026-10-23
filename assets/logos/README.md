# bmpr-editor — proposte di logo

Aprire **index.html** nel browser per confrontare le quattro proposte e cambiare fondo/colore. **preview.png** è la tavola di anteprima; **catalogo.pdf** è il catalogo stampabile. Il pacchetto completo è `../bmpr-editor-logo-kit.zip`.

Il nome provvisorio è quello attuale dell'app, **bmpr-editor**. Queste sono proposte da scegliere, non un marchio già applicato all'interfaccia.

| Proposta | Idea | Colori principali |
| --- | --- | --- |
| 01-monogramma | Lettera b e angolo di modifica | Blu #2557E8, turchese #13B8A6 |
| 02-wireframe | Pannello, griglia e selezione | Petrolio #173D4D, arancio #F47847 |
| 03-pagine | Tavole sovrapposte e piega | Viola #6D40C8, lilla #BD8BFF |
| 04-nodi | Componenti collegati in un flusso | Verde #086E69, ocra #D5A62C |

Ogni proposta comprende due composizioni: `mark` (simbolo quadrato) e `lockup` (simbolo e nome orizzontali).

## Formati e dimensioni

| Cartella/file | Contenuto | Uso |
| --- | --- | --- |
| svg/ | 10 SVG: due composizioni × cinque varianti | Master vettoriali scalabili, web, impaginazione |
| png/ | Simbolo: 16, 32, 48, 64, 128, 180, 192, 256, 512, 1024 px | Favicon, interfaccia, avatar, presentazioni |
| png/ | Firma: larghezze 320, 640, 1280, 2560 px | Header, documenti, schermi ad alta densità |
| webp/ | 10 versioni lossless, con alpha dove previsto | Web ottimizzato |
| jpg/ | Simbolo e firma su fondo bianco/scuro | Software che non accetta trasparenza |
| icons/ | ICO multirisoluzione 16–256 px | Favicon browser |
| icons/ | Apple touch 180 px, Android 192/512 px, manifest | Segnalibri e installazione web; icone su fondo bianco |
| print/ | 10 PDF vettoriali: simbolo 50 mm, firma 150 mm | Impaginazione e stampa scalabile |
| print/ | 2 TIFF con alpha, 300 dpi: simbolo circa 50 mm e firma circa 150 mm | Flussi di stampa raster |

Le altezze della firma vengono calcolate mantenendo il rapporto 570:128 e arrotondate al pixel. `color-transparent`, `mono-black` e `mono-white` hanno realmente il canale alpha: la scacchiera della galleria non è incorporata nei file. `color-white` e `color-dark` sono opachi. I PDF monocromatici bianchi possono apparire vuoti su una pagina bianca: servono per l'inserimento su un fondo scuro.

## Colore e stampa

I file sono RGB; i TIFF dichiarano 300 dpi. I PDF contengono geometrie vettoriali e non richiedono il font installato. Non sono PDF/X con profilo CMYK: per la produzione tipografica, lo stampatore deve applicare il profilo adatto a carta e macchina. Non è inclusa un'abbondanza perché sono loghi isolati, non impaginati al vivo. Non sono previsti EPS o AI proprietari: SVG e PDF sono i master interoperabili.

La firma usa contorni ricavati da Arial Bold presente sul sistema di generazione; nessun file di font è distribuito. I simboli sono geometrie originali definite nello script. I contorni sono modificabili in un editor vettoriale; per cambiare il nome conviene rigenerare la firma.

## Uso consigliato

- Per il sito: SVG, con PNG/WebP quando necessario; non ingrandire un PNG piccolo.
- Per favicon e icone: usare il simbolo, senza la firma estesa.
- Per la firma estesa: almeno 160 px di larghezza; le esportazioni da 320 px supportano la resa 2×.
- Mantenere l'area di rispetto già presente nei file, senza deformare le proporzioni.
- Per stampa a un colore: usare `mono-black` o `mono-white`.

## Rigenerazione

Script nella cartella `scripts/` del progetto, nell'ordine:

1. `python scripts/generate-brand.py` — richiede fontTools e Arial Bold (`C:/Windows/Fonts/arialbd.ttf` per impostazione predefinita; variabile `BMPR_BRAND_FONT` per un percorso alternativo).
2. `node scripts/export-brand.mjs` — richiede le dipendenze npm del progetto e Chromium Playwright, oppure `BMPR_TEST_BROWSER`.
3. `python scripts/package-brand.py` — richiede Pillow; verifica dimensioni e alpha, produce WebP/JPG/ICO/TIFF e ZIP.

L'export è locale, senza servizi remoti o dati dei mockup. I file sono generati da SVG nativi, senza immagini raster incorporate nei master.
