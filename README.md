# Parkeren in Den Bosch — live vrije plekken (prototype)

Webapp die realtime toont hoeveel plekken vrij zijn in de parkeergarages en P+R-locaties
van gemeente 's-Hertogenbosch.

## Runnen

Het is een statische website (geen build-stap):

```
cd den-bosch-parkeren
python3 -m http.server 8000
```

Open daarna http://localhost:8000 . De app haalt live data op bij de RDW en vervverst
elke 30 seconden. Als de live data niet bereikbaar is (bijv. geblokkeerd netwerk),
valt de app automatisch terug op een statische voorbeeldweergave.

Test van de parse-logica: `node test-parse.js`

## Bestanden

- `index.html` — pagina + uitleg (waarom reserveren niet kan)
- `style.css` — opmaak
- `app.js` — ophalen en renderen van NPR-data
- `fallback-data.js` — statische voorbeeldlocaties voor als live data faalt
- `test-parse.js` — parse-tests tegen echte NPR-voorbeeld-JSON

## Gebruikte databron (gratis, open, geen sleutel nodig)

- Index van alle Nederlandse parkeerfaciliteiten (SPDP 2.0):
  https://npropendata.rdw.nl/parkingdata/v2/
- Per faciliteit:
  - statisch: `https://npropendata.rdw.nl/parkingdata/v2/static/{identifier}` (naam, adres, cooërdinaten, capaciteit, tarieven, openingstijden)
  - dynamisch: `https://npropendata.rdw.nl/parkingdata/v2/dynamic/{identifier}` (open/vol, capaciteit, vrije plekken, lastUpdated)
- Gemeente 's-Hertogenbosch is aangesloten op het NPR met gebiedsbeheerder-ID **796**
  en publiceert dynamische data via zijn eigen feed (`opd.it-t.nl/.../denbosch/dynamic`),
  die ook via bovenstaande RDW-endpoints bereikbaar is.

## Onderzoeksconclusies

### Wat WEL mogelijk is
- **Live vrije plekken per garage/terrein in Den Bosch**: ja. De gemeente publiceert
  realtime bezetting via het NPR (RDW Open Parkeerdata). Deze app gebruikt die bron.
- **Statische info** (adressen, coordinaten, tarieven, laadpunten, openingstijden): ja, via NPR.

### Wat NIET mogelijk is (en waarom)
1. **Een parkeerplek reserveren via open data — nee.**
   - In Nederland worden openbare straatparkeerplaatsen nooit gereserveerd: je start een
     parkeersessie pas als je er staat (betaalautomaat of parkeerapp) en betaalt achteraf op
     kenteken. Het NPR registreert *parkeerrechten*, geen reserveringen.
   - Reserveren bestaat alleen bij commerciele exploitanten (Q-Park, ParkBee) in hun eigen
     garages, via hun eigen platform en tegen betaling vooraf. Gemeentelijke garages in
     Den Bosch bieden dit niet. Er is geen open API waarmee je een plek kunt reserveren.
2. **Realtime bezetting per individuele straatparkeerplaats — nee.**
   - Er is landelijk geen bron met per-plek bezetting op straat. Alleen garage/terrein-niveau
   - (teller bij de slagboom) wordt gepubliceerd. Individuele straatplekken zijn technisch
     niet bemeten; de stad werkt met zoneborden ("vrij/vol" per garage).
   - Uitzondering: Den Bosch heeft de app *Parkeren Plus* voor vrije
     gehandicaptenparkeerplaatsen op straat — dit is een aparte, smalle stroom.
3. **Volledige dekking van ALLE parkeerplekken in de gemeente**: niet via een bron.
   - Straatparkeergebieden zijn wel statisch bekend in het NPR (met tarieven), maar zonder
     live bezetting.

## Bronnen

- RDW Open Parkeerdata (NPR): https://npropendata.rdw.nl/ en https://www.nationaalparkeerregister.nl/open-parkeerdata
- Overzicht beherende organisaties: https://opendata.rdw.nl/Parkeren/g/f6v7-gjpa (rij 796 = 's-Hertogenbosch)
- Gemeente: https://www.s-hertogenbosch.nl/product/parkeren/
- Reserveren commercieel: https://www.q-park.nl/nl-nl/producten/reserveren/parkeerplaats/ , https://parkbee.com/nl
