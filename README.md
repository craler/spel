# spel

Kornhalls spelhörna: små webbspel som körs direkt i webbläsaren, utan byggsteg. Startsidan `index.html` listar spelen.

## Launchpad Legends (`launchpad/`) – kommer snart

Ett spel för en Novation Launchpad Mini MK3. Allt spelas i knapparnas ljus; skärmen visar regler, poäng och en klickbar spegel av plattan.
Körs i Chrome eller Edge på en dator (Safari och alla webbläsare på iPhone/iPad saknar Web MIDI). Koppla in plattan med USB, öppna sidan och tillåt MIDI.

På startsidan visas kortet som **Kommer snart** och går inte att klicka på (`soon: true` i `index.html`).
För att testa: öppna startsidan med `?test=1` eller gå direkt till `launchpad/`. Ta bort `soon: true` när spelet ska släppas.

| Fil | Innehåll |
| --- | --- |
| `js/pad.js` | Launchpad via Web MIDI: Programmer mode, koordinater, ritfunktioner, skickar bara ändrade lampor (RGB-SysEx), spegeln på sidan |
| `js/sound.js` | Syntade ljud och rockbandet till Takt: trummor, bas, distad kompgitarr och leadgitarr med eko (WebAudio). Ljud kräver ett klick på sidan, knapptryck på plattan räknas inte |
| `js/games.js` | Småspelen: Färgminne, Takt (rytmspel), Rymdförsvar, Ficklampan, Minneslabyrinten, Mullvad, Minne, Pad-pong, plus font (siffror, bokstäver, stora siffror) och slutskärm |
| `js/main.js` | Menyn, spel-loopen, tillbaka-knappen och skärmen |

- Menyn: plattan visar en regnbågsljusshow (`SHOWS` i `main.js`, sex effekter som tonar över i varandra), och tryck på plattan skickar ut färgade ringar. De runda knapparna till höger är spellistan (ett spel per knapp, i spelets färg). En sidoknapp eller ▲ ▼ visar spelet på plattan (namnet och sedan en demo); samma knapp igen eller ett tryck på plattan startar det. Håller man musen över ett spel i listan på skärmen visas spelets demo direkt på plattan (utan namnet). Efter 15 s utan tryck går menyn tillbaka till ljusshowen. Håll in den runda knappen uppe till höger (User, röd) för att gå tillbaka.
- Färgminne: fyra färgfält som i Simon. Första nivån är tre färger i rad. Ordningen visas 20 % snabbare än i första versionen (`timing()`). Före varje nivå lyser nivåns nummer kort upp i vitt (`levelFor`).
- Rymdförsvar: saker kommer ner mot en; tryck i nedersta raden för att skjuta upp i den kolumnen. Sidoknapparna är vapen (`RF_WEAPONS`: Laser, Trippel, Solfjäder, Raket, Blixt), ett nytt låses upp vid våg 2–5 och blinkar vitt tills man väljer det. Fiender (`RF_FOES`): röd vanlig, rosa pansar (3 träffar), vit snabb. Tre liv på översta raden.
- Ficklampan: en labyrint större än plattan (`carveMaze`, 11 × 11 upp till 21 × 21) där plattan följer pricken. Bara väggar nära pricken lyser, utgången pulserar grönt och ett svagt grönt sken vid kanten visar riktningen. Från nivå 3 finns nycklar och dörrar i samma färg (gul, blå, röd), placerade så att nyckeln alltid går att nå före sin dörr.
- Minneslabyrinten: en slingrande gång på 8 × 8 (`memoryMaze`) lyser i 3 s (`showFor`). Går man in i en vägg blinkar den rött, man åker till start och väggen lyser svagt resten av nivån. Gången blir längre och får fler återvändsgränder för varje nivå.
- I båda labyrinterna går man ett steg genom att trycka på rutan bredvid pricken (eller längre bort åt samma håll, `stepToward`).
- Takt: rytmspel i stil med Guitar Hero. Nivå 1 har fyra filer i mitten (grön, röd, gul, blå), nivå 2 sex och nivå 3 åtta (`TAKT_LEVELS`). Låten (`TAKT_SONG`) har intro, vers, refräng och avslut, och noterna är fraser som upprepas. Varje träff spelar leadgitarrens ton, och filerna är ackordets toner så det alltid låter rätt. Ju längre serie, desto mer spelar bandet (×2 öppna gitarrackord, ×3 crash och snabba hihats, ×4 arpeggio). 70 % träffar låser upp nästa nivå. Ljudet skickas tidigare med högtalarnas fördröjning (`outputLatency`) så att det landar med ljusen.
- Mullvad visar före varje omgång vad färgerna ger (grön 1, guld 5, röd −3) och räknar ner 3-2-1.
- Nytt småspel: lägg ett objekt i `games.js` med `start/update/draw/input/hud/demo` och lägg till det i `GAMES` (högst 8 – nu är alla 8 platser tagna). `legend` visar färgförklaringar på skärmen. Översta raden 0–6 är fri, knapp 7 är tillbaka.
- Rekord sparas i webbläsaren (`legends.best.<id>`).
- Skripten och stilen i `launchpad/index.html` har `?v=...` på slutet. Byt värdet när du ändrar filerna, annars kan webbläsare visa en gammal version.
- Ser färgerna urblekta eller för mörka ut på riktiga plattan: justera `GAMMA` i `pad.js`.

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
- Fyra tider på dygnet (`skies` i `gl.js`), en ny för varje flygning. Natten är borttagen men koden för den finns kvar (`night` i himlen, `nightLights()` i `render.js`). Fönsterputsarna är avstängda (`b.cleaner` i `city.js`), och en femtedel av fotgängarna är borttagna (`gather()` i `world.js`).
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
