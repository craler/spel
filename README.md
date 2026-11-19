# spel

Kornhalls spelhörna: små webbspel som körs direkt i webbläsaren, utan byggsteg. Startsidan `index.html` listar spelen.

## Duv-Diarré (`fagelbajs/`)

Flyg en duva över staden, pricka folk och bilar, bygg kaos och klara dig undan jakten.

Koden är vanliga skript (inga moduler, inget byggsteg) som delar ett globalt scope och laddas i den här ordningen:

| Fil | Innehåll |
| --- | --- |
| `js/core.js` | Hjälpfunktioner och delat speltillstånd |
| `js/audio.js` | Ljud: syntade toner och `audio/samples.mp3` (krasch + vingslag) |
| `js/city.js` | Stadens kvarter: hus, parker, torg, mat, staty, bröllop |
| `js/world.js` | Fotgängare, trafik och kedjekrockar, höken, stridsvagnar, polishelikoptern |
| `js/events.js` | Händelser på torgen: konsert, parad och bilsalong |
| `js/game.js` | Regler och simulering: flygning, bajs, poäng, hot, krasch |
| `js/gl.js` | WebGL 2-rendering: ljus, skuggor, fasader, mark, himmel |
| `js/looks.js` | Utseende: upplåsbara saker att bära, sparade i webbläsaren (inte live än, syns med `?looks=1`) |
| `js/render.js` | Kamera, duvan, 3D-scenen och 2D-lagret (sikte, varningar, HUD) |
| `js/main.js` | Tangentbord, pekskärm, tips och spel-loopen |

Testa lokalt: `python3 -m http.server` i repots rot och öppna `http://localhost:8000/fagelbajs/`.

Bra att veta:

- Ljud: inspelade filer i `audio/` (bajs, splatt vid träff och nedslag, hök, kanonskott, träffmarkör, stadsbrus), resten syntas i `js/audio.js` (vind, vissling, billarm, motorljud från de fyra närmaste bilarna).
- Ljudnivåer som ändras varje bildruta går via `setParam()` i `audio.js`, som bara skickar verkliga ändringar. Det var det som gjorde spelet hackigt efter en lång paus.
- Kameran (C) växlar mellan bakom, ovanifrån och duvans ögon (`camView`, `setCamera()` i `render.js`).
- Bajset kommer ur gumpen (`birdPoint()`/`payload()` i `game.js`). En skarp sväng slungar det utåt, och träffytan växer när duvan stiger och krymper i dyk (`spreadNow()`).
- Topplistan är gemensam och ligger i Supabase (tabellen `scores`, se `scoreApi` i `game.js`). Går den inte att nå visas datorns egen lista.
- Hemlig luftbroms på Q (visas inte i spelet): vingarna framåt, stjärten utfälld, nosen upp (`brake` i `simulate()`).
- Polishelikoptern är avstängd (`heliEnabled=false` i `world.js`). Den finns i `updateHeli()` (`world.js`) och `drawHeli()` (`render.js`). Rotorerna är genomskinliga skivor med utsmetade bladstreck (`veil`-batchen i `gl.js`).
- Pekskärmens spak är analog med dödzon och mjuk kurva (`steer()` i `main.js`).
- Hökens skugga är en egen platt siluett som bara ritas i skuggkartan (`hawkShadow()` i `render.js`).
- Fem tider på dygnet (`skies` i `gl.js`), en ny för varje flygning. Natten har stjärnor, månsken, tända fönster, gatlyktor och strålkastare på bilarna (`nightLights()` i `render.js`).
- Händelser (`events.js`): när duvan har flugit 230–400 m sedan förra händelsen startar en slumpad konsert, parad eller bilsalong på ett torg framåt, minst 220 m från andra pågående händelser (högst två åt gången). En pil visar vägen de första 12 sekunderna, och tillräckligt många träffar innan tiden går ut ger en stor bonus.
- Stridsvagnar (bromsar, svänger på stället, rekyl) finns i `updateTanks()` (`world.js`), näten i `updateThreats()` (`game.js`) och `drawNet()`/`drawSnare()` (`render.js`).
- Bedrifter sparas i webbläsaren (`feats` i `game.js`), liksom rekord och antal flygningar.
- Affischen `poster.jpg` visas på startsidan.
- Grafik (Inställningar): Auto, Snygg, Snabb eller Snabbast (`quality`/`gfx` i `core.js`, `setLevel()` i `main.js`).
  Det som kostar mest är antalet trianglar, så träd, människor och bilar har en enklare modell på avstånd och lyktstolpar ritas bara nära.
  Snabb: mindre skuggkarta med ett sampel, 9 × 9 kvarter, enklare duvkropp och shaders, lägre upplösning. Snabbast: inga skuggor alls, 7 × 7 kvarter och tätare dis,
  människor bara inom 80 m, ännu lägre upplösning och ingen rök. Auto mäter de första sekunderna och stegar ner till Snabb och sedan Snabbast om det behövs (`fagelbajs.autoLevel`).
- Skuggpasset ritar bara de närmaste kvarteren (`Mesh.near`, `drawShadow()` i `gl.js`), och fotgängare och trafik räknas om en gång per bildruta i stället för två.

Trimvärden att känna till: stjärngränser `thresholds` (game.js), riskbonus och kombo i `award()` (game.js),
tankens påfyllning `recharge()` och hökens fart `updateHawk()` (world.js), kvarterstyper i `city.js`.
