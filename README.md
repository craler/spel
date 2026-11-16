# spel

Spelhörnan: små webbspel som körs direkt i webbläsaren, utan byggsteg. Startsidan `index.html` listar spelen.

## Fågelbajs (`fagelbajs/`)

Flyg en duva över staden, pricka folk och bilar, bygg kaos och klara dig undan jakten.

Koden är vanliga skript (inga moduler, inget byggsteg) som delar ett globalt scope och laddas i den här ordningen:

| Fil | Innehåll |
| --- | --- |
| `js/core.js` | Hjälpfunktioner och delat speltillstånd |
| `js/audio.js` | Ljud: syntade toner och `audio/samples.mp3` (krasch + vingslag) |
| `js/city.js` | Stadens kvarter: hus, parker, torg, mat, staty, bröllop |
| `js/world.js` | Fotgängare, trafik och kedjekrockar, mat, höken |
| `js/game.js` | Regler och simulering: flygning, bajs, poäng, hot, krasch |
| `js/gl.js` | WebGL 2-rendering: ljus, skuggor, fasader, mark, himmel |
| `js/render.js` | Kamera, duvan, 3D-scenen och 2D-lagret (sikte, varningar, HUD) |
| `js/main.js` | Tangentbord, pekskärm, tips och spel-loopen |

Testa lokalt: `python3 -m http.server` i repots rot och öppna `http://localhost:8000/fagelbajs/`.

Bra att veta:

- Allt ljud utom krasch och vingslag syntas i `js/audio.js` (sprut, nedslag, träffmarkör, hök, billarm, stadsbrus).
- Hökens skugga är en egen platt siluett som bara ritas i skuggkartan (`hawkShadow()` i `render.js`).
- Träffytan växer med fallhöjden (`hitRadius()` i `game.js`); siktet ritar samma radie på marken.
- Fyra tider på dygnet (`skies` i `gl.js`), en ny för varje flygning.
- Topplistan med namn (`scores` i `game.js`) sparas i webbläsaren, alltså per dator, inte gemensamt på nätet.
- Stridsvagnar och nät finns i `updateTanks()` (`world.js`) och `updateThreats()` (`game.js`).
- Bedrifter sparas i webbläsaren (`feats` i `game.js`), liksom rekord och antal flygningar.

Trimvärden att känna till: stjärngränser `thresholds` (game.js), riskbonus och kombo i `award()` (game.js),
tankens påfyllning `recharge()` och hökens fart `updateHawk()` (world.js), kvarterstyper i `city.js`.
