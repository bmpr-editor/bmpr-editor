# File Balsamiq `.bmpr` senza Balsamiq — cosa si è fatto e cosa si può fare

Note tecniche per un progetto personale (editor/viewer web gratuito di mockup Balsamiq).
Nate da un lavoro per un cliente: **prima di usarle nel portfolio togliere nomi, testi e immagini del cliente** e usare un `.bmpr` di esempio creato da zero.

## 0. Si può fare un editor gratis? Sì

Sì, si può fare: un'app web (HTML + JavaScript) che apre il `.bmpr` nel browser, lo mostra, lo modifica e lo risalva. Finora non è stato costruito niente: è stato solo letto un file.

Piano completo (architettura e step): **`PIANO_editor_bmpr.md`**. In breve, si fa a tappe, ognuna già usabile da sola:

| Tappa | Cosa fa | Difficoltà |
|---|---|---|
| 1. Viewer | apre il `.bmpr` e mostra le pagine (riquadri, testi, frecce, icone base) | bassa |
| 2. Export | salva le pagine come SVG / PNG e i testi come Markdown | bassa |
| 3. Editor base | spostare, ridimensionare, cambiare testi, aggiungere / cancellare riquadri, etichette, frecce | media |
| 4. Salvataggio `.bmpr` | riscrive il file in modo che Balsamiq lo riapra | media, da testare con Balsamiq (trial) |
| 5. Più controlli | pulsanti, campi, tabelle, finestre, ecc., uno alla volta | lunga ma ripetitiva |
| 6. Stile sketch e icone | look «a mano» e icone libere | media |

Cosa **non** verrà come Balsamiq: tutti i suoi controlli e il suo aspetto identico (per tempo e per marchio). Obiettivo realistico: aprire, vedere, modificare e risalvare i mockup di tipo diagramma / schermata semplice.

## 1. Cosa è stato fatto davvero

| Cosa | Come | Automatico? |
|---|---|---|
| Lettura del `.bmpr` | è un database **SQLite 3**: aperto in sola lettura con Python (`sqlite3`) | sì |
| Estrazione di tutti i testi di tutte le pagine | lettura del JSON di ogni mockup, campo `properties.text` dei controlli | sì |
| Immagine «ricostruita» di una pagina | disegno dei controlli alle loro coordinate (`x`, `y`, `w`, `h`): rettangoli colorati, etichette, frecce, icone | sì, ma **approssimato** |
| Flowchart in **Mermaid** | **fatto a mano** (da Claude) guardando il PNG esportato dall'autore e la ricostruzione, poi validato con `mermaid-cli` | **no**: è un'interpretazione, non una conversione |
| SVG del Mermaid | `npx @mermaid-js/mermaid-cli -i file.mmd -o file.svg` | sì |

Quindi: **il `.bmpr` è stato letto e ridisegnato in modo grezzo; il Mermaid non è una conversione automatica.**

Limiti della ricostruzione fatta:
- le icone (es. `circle-solid`) sono diventate pallini neri: non c'era la libreria di icone;
- le frecce sono state disegnate dritte: la curvatura (`p1`) è stata ignorata;
- niente font «a mano» di Balsamiq, niente stile sketch;
- gruppi, simboli e controlli complessi non gestiti.

## 2. Il formato `.bmpr` (quanto visto)

SQLite con queste tabelle:

| Tabella | Contenuto |
|---|---|
| `INFO` | `SchemaVersion` (qui `2.0`), `ArchiveFormat` = `bmpr`, `ArchiveRevision`, `ArchiveAttributes` (JSON con il nome del progetto) |
| `BRANCHES` | rami/versioni (`ID`, `ATTRIBUTES` JSON) |
| `RESOURCES` | **le pagine**: `ID`, `BRANCHID`, `ATTRIBUTES` (JSON: `kind` = `mockup`, `name`, `trashed`, `modified`…), `DATA` (JSON del mockup) |
| `THUMBNAILS` | anteprime delle pagine |
| `USERS`, `COMMENTS` | utenti e commenti (nel file visto: 0 commenti) |

Il JSON di una pagina (`DATA`): `mockup.controls.control` = lista di controlli. Esempi reali:

```json
{"ID":"0","typeID":"Canvas","zOrder":"2","x":"298","y":"181","w":"987","h":"97",
 "properties":{"color":"10667209"}}

{"ID":"14","typeID":"Label","x":"319","y":"448","measuredW":"76","measuredH":"21",
 "properties":{"text":"OCR Bolletta","color":"10066329"}}

{"ID":"6","typeID":"Icon","x":"582","y":"438",
 "properties":{"icon":{"ID":"circle-solid","size":"small"}}}

{"ID":"13","typeID":"Arrow","x":"323","y":"287","w":"19","h":"103",
 "properties":{"curvature":"0","p0":{"x":2,"y":0},"p1":{"x":0.495,"y":-0.078},
               "p2":{"x":19,"y":103},"leftArrow":"false","color":"10066329"}}
```

Note utili:
- tutti i numeri sono **stringhe**;
- `color` è un intero decimale RGB (`10667209` = `0xA2C4C9`);
- se `w`/`h` mancano si usano `measuredW`/`measuredH`;
- `zOrder` decide l'ordine di disegno;
- freccia: `p0` e `p2` sono gli estremi in pixel relativi al controllo; `p1` sembra il punto di controllo della curva, **normalizzato** (0–1) rispetto al segmento: da verificare con più esempi;
- nella pagina analizzata i tipi erano: `Icon`, `Arrow`, `Paragraph`, `Label`, `Canvas`, `TextInput`. Balsamiq ne ha molti altri (Button, ComboBox, DataGrid, Window, ecc.).

## 3. Cosa si può fare nel progetto personale

In ordine di difficoltà:

1. **Viewer web**: si carica il `.bmpr` nel browser (SQLite in JavaScript, es. `sql.js`) e si disegnano le pagine in SVG. Niente server, niente upload: il file resta sul PC dell'utente.
2. **Export**: pagina → SVG / PNG; testi → TXT / Markdown; elenco pagine e controlli → JSON pulito.
3. **Export verso Mermaid / draw.io**: automatico solo per i diagrammi a box e frecce. Serve capire quale freccia collega quali box (aggancio per vicinanza degli estremi `p0`/`p2` ai rettangoli): fattibile ma approssimato. Per le schermate UI Mermaid non ha senso.
4. **Stile sketch**: font a mano libero (es. Comic Neue, Architects Daughter) e linee tremolanti (es. libreria `rough.js`).
5. **Icone**: gli ID (`circle-solid`, …) sembrano nomi in stile Font Awesome; mappatura verso una libreria di icone libera.
6. **Editor**: spostare, ridimensionare, modificare testi e salvare di nuovo in `.bmpr` (aggiornando `DATA` e `ArchiveRevision`). È la parte più lunga; il rischio è produrre file che Balsamiq poi non apre: va testato con Balsamiq vero (trial).

## 4. Attenzioni

- **Marchio e licenza**: non chiamarlo «Balsamiq» e non copiarne icone, font o grafica; dire «compatibile con file .bmpr». Verificare i termini d'uso di Balsamiq sul formato prima di pubblicare.
- **Formato non documentato**: tutto quanto sopra è dedotto da un solo file (schema `2.0`). Raccogliere più `.bmpr` di esempio, con controlli diversi, prima di generalizzare.
- **Privacy**: il viewer deve lavorare solo in locale nel browser (i mockup dei clienti non vanno caricati su server).

## 5. Comandi minimi per ripartire

```python
import sqlite3, json
c = sqlite3.connect('file:progetto.bmpr?mode=ro', uri=True)   # sola lettura
for attrs, data in c.execute("select ATTRIBUTES, DATA from RESOURCES"):
    a = json.loads(attrs)
    if a.get("kind") != "mockup" or a.get("trashed") == True:
        continue
    controls = json.loads(data)["mockup"]["controls"]["control"]
    print(a["name"], len(controls))
    for k in controls:
        t = k.get("properties", {}).get("text")
        if t: print("  ", k["typeID"], t)
```

```bash
npx -y @mermaid-js/mermaid-cli -i diagramma.mmd -o diagramma.svg
```
