# spel

Kornhalls spelhörna: små webbspel som körs direkt i webbläsaren, utan byggsteg. Startsidan `index.html` listar spelen.

## Launchpad Legends (`launchpad/`) – kommer snart

Ett spel för en Novation Launchpad Mini MK3. Allt spelas i knapparnas ljus; skärmen visar regler, poäng och en klickbar spegel av plattan.
Körs i Chrome eller Edge på en dator, och bör fungera i Chrome på en Android-telefon med en USB-C-adapter (OTG), men det är inte provat. Safari och alla webbläsare på iPhone/iPad saknar Web MIDI. Koppla in plattan med USB, öppna sidan och tillåt MIDI.

Knapparna på Mini MK3: rutnätet 8 × 8, översta raden (▲ ▼ ◀ ▶ Session Drums Keys User) och högerkolumnen (8 knappar, den nedersta heter Stop Solo Mute). Alla är fyrkantiga, och spegeln på skärmen ritar dem likadant.

På startsidan visas kortet som **Kommer snart** och går inte att klicka på (`soon: true` i `index.html`).
För att testa: öppna startsidan med `?test=1` eller gå direkt till `launchpad/`. Ta bort `soon: true` när spelet ska släppas.

| Fil | Innehåll |
| --- | --- |
| `js/pad.js` | Launchpad via Web MIDI: Programmer mode, koordinater, ritfunktioner, skickar bara ändrade lampor (RGB-SysEx), spegeln på sidan |
| `js/sound.js` | Syntade ljud (WebAudio): rockbandet till Takt (trummor, bas, distad kompgitarr och leadgitarr med eko, `leadHold` för hålltoner), trummaskinens ljud, två trumset (`KIT`), en synt med eko, fyrverkeri- och undervattensljud. Allt går genom en begränsare (`masterChain`) så att många ljud samtidigt inte spricker. Ljud kräver ett klick på sidan, knapptryck på plattan räknas inte |
| `js/games.js` | Småspelen: Färgminne, Takt (rytmspel), Rymdförsvar, Sjunkbomb, Ficklampan, Minneslabyrinten, Portalhopp, Mullvad, Minne, Pad-pong, plus font (siffror, bokstäver, stora siffror), slutskärm och knappen för 1 eller 2 spelare |
| `js/classics.js` | Klassiska brädspel: Fyra i rad och Sänka skepp (båda mot datorn eller två spelare) och Släck allt (ljuspussel) |
| `js/toys.js` | Musik och leksaker: Trumset, Trummaskin, Fyrverkeriet och Livet |
| `js/main.js` | Spellistan sida för sida (`PAGES`), menyn, spel-loopen, tillbaka-knappen och skärmen |

- Menyn: plattan visar en regnbågsljusshow (`SHOWS` i `main.js`, sex effekter som tonar över i varandra), och tryck på plattan skickar ut färgade ringar. Knapparna i högerkolumnen är spellistan (ett spel per knapp, i spelets färg), och spelen ligger på tre sidor (Spel, Brädspel och två spelare, Musik och leksaker) som ◀ ▶ byter mellan. En knapp i högerkolumnen eller ▲ ▼ visar spelet på plattan (namnet och sedan en demo); samma knapp igen eller ett tryck på plattan startar det. Håller man musen över ett spel i listan på skärmen visas spelets demo direkt på plattan (utan namnet). Efter 15 s utan tryck går menyn tillbaka till ljusshowen. Håll in knappen uppe till höger (User, röd) för att gå tillbaka.
- Färgminne: fyra färgfält som i Simon. Första nivån är tre färger i rad. Ordningen visas 20 % snabbare än i första versionen (`timing()`). Före varje nivå lyser nivåns nummer kort upp i vitt (`levelFor`).
- Rymdförsvar: saker kommer ner mot en; tryck i nedersta raden för att skjuta upp i den kolumnen. Sidoknapparna är vapen (`RF_WEAPONS`: Laser, Trippel, Solfjäder, Raket, Blixt), ett nytt låses upp vid våg 2–5 och blinkar vitt tills man väljer det. Fiender (`RF_FOES`): röd vanlig, rosa pansar (3 träffar), vit snabb. Tre liv på översta raden.
- Ficklampan: en labyrint större än plattan (`carveMaze`, 11 × 11 upp till 21 × 21) där plattan följer pricken. Bara väggar nära pricken lyser, utgången pulserar grönt och ett svagt grönt sken vid kanten visar riktningen. Från nivå 3 finns nycklar och dörrar i samma färg (gul, blå, röd), placerade så att nyckeln alltid går att nå före sin dörr.
- Minneslabyrinten: en slingrande gång på 8 × 8 (`memoryMaze`) lyser i 3 s (`showFor`). Går man in i en vägg blinkar den rött, man åker till start och väggen lyser svagt resten av nivån. Gången blir längre och får fler återvändsgränder för varje nivå.
- Portalhopp: en figur springer själv och vänder vid väggar. Första trycket sätter en blå portal, nästa en orange, sedan flyttas de i tur och ordning. 16 banor i `PH_LEVELS` (`name`, `map` med 8 × 8 tecken, `par` = portalflyttar för tre stjärnor, standard 2, och `hint` som visas tills första portalen sätts).
  Tecken: `#` mark, `^` taggar, `S`/`s` start åt höger/vänster, `G` mål, `b` knapp som öppnar alla dörrar `D`, `t` tidsknapp (dörrarna öppna i `PH_TIMER` steg), `|` portalrensare (tar bort båda portalerna), `J` hoppplatta (skjuter figuren snett uppåt i `PH_JUMP` steg, och hoppet fortsätter genom portaler).
  Portalerna ligger kvar när figuren dör, färre portalflyttar ger fler stjärnor och den nedersta knappen i högerkolumnen börjar om banan. ◀ ▶ byter bana bland dem man har nått, och bästa stjärnorna per bana sparas (`legends.portalhopp.stars`).
  Ny bana: `phCheck(karta)` i konsolen provar alla portalpar som sätts före start. Banan ska inte gå att klara utan portaler (`none: false`). Banor med portalrensare kräver nya portaler medan figuren springer, och dem testar man genom att spela.
- I båda labyrinterna går man ett steg genom att trycka på rutan bredvid pricken (eller längre bort åt samma håll, `stepToward`).
- Takt: rytmspel i stil med Guitar Hero till "I bergakungens sal" (Grieg 1875, fri att använda) i rockversion. Melodin finns i `TAKT_THEME` (4 takter, halvtoner över A3), powerackorden i `TAKT_ROOTS`, och `TAKT_SONG` är låtens delar: tonart (A-moll eller E-moll) och tempo, som ökar mot slutet som i originalet.
  Varje träff spelar melodins ton på leadgitarren. Filerna följer melodin efter tonhöjd (`TAKT_RANK`), så samma slinga alltid har samma form. Långa toner har en svans som man håller intryckt (`leadHold` låter så länge man håller), och släpper man för tidigt bryts serien.
  Nivå 1 har fyra filer, bara tonerna på taktslagen (bandet spelar resten, `auto`) och hålltoner bara på de längsta tonerna. Nivå 2 har sex filer och alla toner, nivå 3 åtta filer och högre tempo (`TAKT_LEVELS`).
  Ju längre serie, desto mer spelar bandet (×2 öppna gitarrackord, ×3 crash och snabba hihats, ×4 arpeggio). 70 % träffar låser upp nästa nivå. Ljudet skickas tidigare med högtalarnas fördröjning (`outputLatency`) så att det landar med ljusen.
- Fyra i rad: bräde 7 × 6 längst ner på plattan, brickorna faller från översta raden. Datorn söker med negamax och alfa-beta (`c4Best`), och `C4_LEVELS` styr hur många drag framåt den ser och hur ofta den slumpar. Varje vinst i rad höjer nivån, en förlust avslutar.
- 1 eller 2 spelare: i Fyra i rad, Sänka skepp och Pad-pong växlar Keys på översta raden (`PLAYERS_BTN`) mellan att spela mot datorn och två spelare på samma platta. En stor 1:a eller 2:a visas en stund (`playersInput`, `drawPlayers`). I Pad-pong spelar datorn blå och missar oftare ju snabbare bollen går.
- Sänka skepp: flottan (`BS_FLEET`: 4, 3, 3, 2, 2) slumpas så att inga skepp rör varandra. Blått = miss, orange = träff, rött = sänkt, och vattnet runt ett sänkt skepp markeras. Träff ger ett skott till. Datorn (`bsAim`) räknar hur många sätt skeppen kan ligga på och skjuter där det är flest, men slumpar ofta (`BS_SLOPPY`) så att den går att slå. Den behöver runt 34 skott för en hel flotta.
- Släck allt: ett tryck växlar lampan och dess fyra grannar. 12 nivåer från 3 × 3 till 8 × 8 (`LO_LEVELS`: storlek och antal slumptryck). Pusslen görs genom att trycka slumpvis på ett släckt bräde, så de går alltid att lösa. `loSolve` räknar ut kortaste lösningen (Gauss-elimination över GF(2)), som ger `par` och tipsen.
- Trummaskin: 8 ljud × 16 steg i tre lager (bas, trummor och melodi på pentatonisk skala). Steg 9–16 spelar samma som 1–8 tills man ändrar något där (`split`). Ljuden schemaläggs i förväg på ljudklockan som i Takt. Takten sparas i `legends.trummaskin`.
- Fyrverkeriet: gnistorna ritas mellan knapparna (`fwSplat` fördelar ljuset på de fyra närmaste) och adderas. Sorterna finns i `FW_TYPES`.
- Livet: Conways Game of Life på 8 × 8 där kanterna hänger ihop. Färgen visar cellens ålder, ◀ backar upp till 200 steg, och varje födsel spelar en ton efter raden. Mönstren finns i `LIFE_PATTERNS`.
- Sjunkbomb: ubåtsjakt. Fartyget på översta raden, vågor på rad 2. Ett tryck släpper en sjunkbomb i kolumnen som smäller på det djup man tryckte (smällen når en ruta åt varje håll). Ubåtarna (`SB_SUBS`) skjuter upp minor som kostar ett liv om de når ytan under fartyget. Högst `SB_MAX` bomber i vattnet. Varje våg blir snabbare.
- Trumset: trummor att spela direkt, 16 plattor på 2 × 2 (`TS_PADS`) och 8 extraljud i högerkolumnen (`TS_EXTRA`). Drums = rockset, Keys = elektroset, ▶ = metronom, ▲ ▼ = tempo. Stängd hihat klipper den öppna.
- Mullvad visar före varje omgång vad färgerna ger (grön 1, guld 5, röd −3) och räknar ner 3-2-1.
- Nytt småspel: lägg ett objekt i `games.js`, `classics.js` eller `toys.js` (eller en ny fil som laddas före `main.js` i `index.html`) med `start/update/draw/input/hud/demo` och lägg till det på en sida i `PAGES` i `main.js` (högst 8 per sida, en per knapp i högerkolumnen; ◀ ▶ på översta raden byter sida i menyn). `legend` visar färgförklaringar på skärmen. Översta raden 0–6 är fri, knapp 7 är tillbaka.
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
  Snabb: mindre skuggkarta med ett sampel, 9 × 9 kvarter, enklare duvkropp och shaders, lägre upplösning. Snabbast: inga riktiga skuggor (mjuka skuggfläckar i stället, `blob()` i `render.js`),
  7 × 7 kvarter och tätare dis, människor bara inom 80 m, ännu lägre upplösning och ingen rök.
- Auto (`keepPace()` i `main.js`) går direkt till Snabbast om bildrutorna kommer för långsamt, och provar sedan nivåerna ovanför en i taget när det går lugnt. En ändring behålls bara om den
  gav fler bilder per sekund: på en skärm som är låst till 30 bilder per sekund (telefon i strömsparläge) hjälper ingenting, och då behålls Snygg och full upplösning. Samma test gäller upplösningen.

Så hålls bildrutorna billiga (bra att känna till innan något läggs till):

- Bara det som syns ritas. Statiska föremål packas en gång per kvarter (`packBlock()` i `render.js`) och varje bildruta kopieras de kvarter som ligger i bild, närmast först (`fillStatics()`).
  Rörliga föremål prövas ett och ett mot bilden (`inView()`).
- Skuggorna från allt som står still ligger i en egen skuggkarta som bara ritas om när duvan flugit 32 m eller något ändrats (`staticShadow()` i `gl.js`, `shadowDirty`).
  Varje bildruta kopieras den och bara det som rör sig ritas ovanpå.
- Detaljnivå efter avstånd: träd, människor, bilar och bajsfläckar har en enkel modell längre bort; lyktstolpar och fläckarnas upphöjda delar ritas bara nära.
- Ritordning: hus och föremål först, sedan mark, sist himmel. De dyraste pixlarna (mark och himmel) räknas då bara där de syns.
- Text på 2D-lagret ritas en gång till en liten bild och stämplas sedan ut (`text()` i `render.js`). Text med kontur var tidigare den enskilt dyraste delen av en bildruta.
- Inget skapas i onödan varje bildruta: fotgängare (`walkersOf()`), bilar (`carFor()`) och duvans kropp (`bodyData()`) görs en gång och uppdateras på plats.

Trimvärden att känna till: stjärngränser `thresholds` (game.js), riskbonus och kombo i `award()` (game.js),
tankens påfyllning `recharge()` och hökens fart `updateHawk()` (world.js), kvarterstyper i `city.js`.
