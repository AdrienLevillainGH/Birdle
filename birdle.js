//-------------------------------------------------------
//  GLOBAL GAME STATE
//-------------------------------------------------------
let birds = [];
let todayPool = [];
let targetBird = null;
let guessesRemaining = 10;
let usedNames = new Set();
let guessHistory = [];
let gameOver = false;

// -------------------------------------------------------
//  BIRD HISTORY (to enforce non-repeat rules)
// -------------------------------------------------------
function loadBirdHistory() {
    return JSON.parse(localStorage.getItem("bird_history") || "{}");
}

function saveBirdHistory(history) {
    localStorage.setItem("bird_history", JSON.stringify(history));
}


// -------------------------
// LOCAL STORAGE HELPERS
// -------------------------
function saveGameState() {
    const state = {
        day: getDailySeed(),
        guesses: guessHistory
    };
    localStorage.setItem("birdle_state", JSON.stringify(state));
}

function loadGameState() {
    const raw = localStorage.getItem("birdle_state");
    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

// Deterministic pseudo-random generator (Mulberry32)
function mulberry32(seed) {
    return function () {
        seed |= 0;
        seed = seed + 0x6D2B79F5 | 0;
        var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// Convert today's date → integer seed
function getDailySeed() {
    const today = new Date();
    const y = today.getUTCFullYear();
    const m = today.getUTCMonth() + 1;
    const d = today.getUTCDate();

    return parseInt(`${y}${m}${d}`);  
}

function startNextBirdleCountdown() {
    function update() {
        const now = new Date();

        // Next UTC midnight
        const next = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate() + 1,
            0, 0, 0
        ));

        const diff = next - now;

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const seconds = Math.floor((diff / 1000) % 60);

        document.getElementById("countdown").textContent =
            `${String(hours).padStart(2, "0")}:` +
            `${String(minutes).padStart(2, "0")}:` +
            `${String(seconds).padStart(2, "0")}`;
    }

    update();
    setInterval(update, 1000);
}


const MASS_CATEGORIES = [
  { max: 100, label: "0-100" },
  { max: 1000, label: "100-1000" },
  { max: 3000, label: "1000-3000" },
  { max: Infinity, label: ">3000" }
];

// -------------------------------
// Languages (simple version)
// -------------------------------
let LANG_MAP = {};       // "English" → "English"
let currentLang = "English";  // default

function buildLanguageMapFromData(birds) {
    const langs = new Set();

    birds.forEach(b => {
        if (b.commonNames) {
            Object.keys(b.commonNames).forEach(l => langs.add(l));
        }
    });

    LANG_MAP = {};
    [...langs].forEach(l => LANG_MAP[l] = l);

    // Default to English if present
    if (LANG_MAP["English"]) currentLang = "English";
    else currentLang = Object.keys(LANG_MAP)[0];
}

// Language → flag-icons country code
const LANG_FLAGS = {
    "Bulgarian": "bg",
    "Catalan": "es-ct",                 // fallback to Spain 🇪🇸
    "Croatian": "hr",
    "Danish": "dk",
    "Dutch": "nl",
    "English": "gb",
    "English (AVI)": "gb",
    "English (United States)": "us",
    "Estonian": "ee",
    "French": "fr",
    "German": "de",
    "Norwegian": "no",
    "Polish": "pl",
    "Serbian": "rs",
    "Slovak": "sk",
    "Spanish": "es",
    "Spanish (Spain)": "es",
    "Swedish": "se",
    "Turkish": "tr",
    "Ukrainian": "ua"
};

// -------------------------------------------------------
//  SMART DAILY BIRD PICKER (no repeats, no same Order twice)
// -------------------------------------------------------

// Require at least N days before same Order can appear again
const MIN_DAYS_BETWEEN_SAME_ORDER = 3;   // eg. passer; X; X; X; passer can be drawn again
const MIN_DAYS_BETWEEN_SAME_FAMILY = 13;   // 2 weeks between each "same family pick"; avoid that we get many up to 3 spoonbills in 8 days.


function pickDailyBird(seed) {
    const rand = mulberry32(seed);

    // Deterministic initial index
    let index = Math.floor(rand() * birds.length);

    const history = loadBirdHistory();

    // Last 60 days
    const last60 = new Set();
    for (let i = 1; i <= 60; i++) {
        const pastDay = seed - i; // works because seed uses YYYYMMDD
        if (history[pastDay]) last60.add(history[pastDay]);
    }

    // Prevent same Order within past X days
    function violatesOrderBan(candidate, history, seed) {
    for (let i = 1; i <= MIN_DAYS_BETWEEN_SAME_ORDER; i++) {
        const pastDay = seed - i;
        const pastName = history[pastDay];
        if (!pastName) continue;

        const pastBird = birds.find(b => b.Name === pastName);
        if (pastBird && pastBird.Order === candidate.Order) {
            return true; // violation
        }
    }
    return false;
    }


    // Try deterministic candidates until one fits rules
    for (let attempts = 0; attempts < birds.length; attempts++) {
    const candidate = birds[index];

    const repeated = last60.has(candidate.Name);

    // ORDER rule
    let sameOrder = false;
    for (let i = 1; i <= MIN_DAYS_BETWEEN_SAME_ORDER; i++) {
        const pastName = history[seed - i];
        if (!pastName) continue;
        const pastBird = birds.find(b => b.Name === pastName);
        if (pastBird && pastBird.Order === candidate.Order) {
            sameOrder = true;
            break;
        }
    }

    // FAMILY rule
    let sameFamily = false;
    for (let i = 1; i <= MIN_DAYS_BETWEEN_SAME_FAMILY; i++) {
        const pastName = history[seed - i];
        if (!pastName) continue;
        const pastBird = birds.find(b => b.Name === pastName);
        if (pastBird && pastBird.Family === candidate.Family) {
            sameFamily = true;
            break;
        }
    }

    // ACCEPT candidate only if it satisfies all constraints
    if (!repeated && !sameOrder && !sameFamily) {
        history[seed] = candidate.Name;
        saveBirdHistory(history);
        return candidate;
    }

    index = (index + 1) % birds.length;
    }

    // Fallback (should never be used)
    history[seed] = birds[index].Name;
    saveBirdHistory(history);
    return birds[index];
}


function buildDailyBirdPool(seed, targetBird) {
    const rand = mulberry32(seed);

    const MAX_PER_ORDER = 10;
    const MAX_HABITAT_SHARE = 0.33;   // 33% of the pool
    const POOL_SIZE = 100;

    let pool = [targetBird];

    const orderCount = { [targetBird.Order]: 1 };
    const habitatCount = { [targetBird.Habitat]: 1 };

    function incrementCounts(bird) {
        orderCount[bird.Order] = (orderCount[bird.Order] || 0) + 1;
        habitatCount[bird.Habitat] = (habitatCount[bird.Habitat] || 0) + 1;
    }

    let attempts = 0;

    while (pool.length < POOL_SIZE && attempts < birds.length * 10) {
        attempts++;

        const candidate = birds[Math.floor(rand() * birds.length)];
        if (pool.includes(candidate)) continue;

        // RULE A: max 10 per order
        const oc = orderCount[candidate.Order] || 0;
        if (oc >= MAX_PER_ORDER) continue;

        // RULE B: prevent habitat domination
        const habShare = (habitatCount[candidate.Habitat] || 0) / pool.length;
        if (habShare > MAX_HABITAT_SHARE) continue;

        // Accept
        pool.push(candidate);
        incrementCounts(candidate);
    }

    // Fallback fill
    while (pool.length < POOL_SIZE) {
        const c = birds[Math.floor(rand() * birds.length)];
        if (!pool.includes(c)) pool.push(c);
    }

    return pool;
}



//-------------------------------------------------------
//  LOAD BIRDS.JSON
//-------------------------------------------------------
fetch("birds_with_contributors_and_names.json")
  .then(res => {
      console.log("JSON status:", res.status);
      return res.json();
  })
  .then(data => {
      console.log("Loaded birds:", data.length);

      birds = data;

      console.log("Sample bird:", birds[0]);
      console.log("commonNames keys of first bird:", birds[0]?.commonNames && Object.keys(birds[0].commonNames));

      buildLanguageMapFromData(birds);
      console.log("LANG_MAP after build:", LANG_MAP);

      buildLanguageMenu();
      console.log("menu children:", document.getElementById("langMenu").children.length);

      birds.sort(sortByCurrentLanguage);
      setupAutocomplete();
  })
  .catch(err => console.error("JSON LOAD ERROR:", err));

  function buildLanguageMenu() {
    const menu = document.getElementById("langMenu");
    const select = document.getElementById("langSelect");

    menu.innerHTML = "";
    select.innerHTML = "";

    Object.keys(LANG_MAP).forEach(lang => {
        const div = document.createElement("div");
        div.dataset.lang = lang;

        const flagCode = LANG_FLAGS[lang];
        const flagHtml = flagCode
        ? `<span class="fi fi-${flagCode}"></span>`
        : "";

      div.innerHTML = `
      ${flagHtml}
       <span class="lang-label">${lang}</span>
      `;

      menu.appendChild(div);


        const opt = document.createElement("option");
        opt.value = lang;
        opt.textContent = lang;
        select.appendChild(opt);
    });

    // Ensure dropdown shows current language
    select.value = currentLang;
}



 function getCommonName(bird) {
    const lang = currentLang;

    if (bird.commonNames?.[lang]) {
        return bird.commonNames[lang];
    }

    return bird.commonNames?.["English"] || bird.Vname || bird.Name;
}

function sortByCurrentLanguage(a, b) {
    return getCommonName(a).localeCompare(getCommonName(b));
}



// ------------------------
// DICE MECHANISMS
// ------------------------

document.getElementById("randomBtn").addEventListener("click", () => {
    if (gameOver) return;

    const unusedBirds = todayPool.filter(b => !usedNames.has(b.Name));
    if (unusedBirds.length === 0) return;

    const randomBird =
        unusedBirds[Math.floor(Math.random() * unusedBirds.length)];

    handleGuess(randomBird.Name);

    const input = document.getElementById("guessInput");
    input.value = "";
    input.dataset.fromSuggestion = "false";
    document.getElementById("autocomplete-list").style.display = "none";
});


// ------------------------
// RULES MODAL SYSTEM
// ------------------------
document.addEventListener("DOMContentLoaded", () => {
    const rulesModal = document.getElementById("rulesModal");
    const rulesBtn = document.getElementById("rulesBtn");
    const closeRules = document.getElementById("closeRules");

    if (!rulesModal || !rulesBtn || !closeRules) {
        console.error("Modal elements not found in DOM");
        return;
    }

    rulesBtn.onclick = () => {
      rulesModal.classList.remove("hidden");
    };

    closeRules.onclick = () => {
      rulesModal.classList.add("hidden");
    };

    // Close modal if clicking outside the window
    rulesModal.addEventListener("click", (e) => {
      if (e.target === rulesModal) {
        rulesModal.classList.add("hidden");
      }
    });

    document.getElementById("closeFinal").onclick = () => {
    document.getElementById("finalModal").classList.add("hidden");
    };

    document.getElementById("finalModal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("finalModal")) {
        document.getElementById("finalModal").classList.add("hidden");
    }
    });

    // Decompte & DOI dans la final tile
const botw = document.getElementById("botwButton");
if (botw) {
    botw.addEventListener("click", () => {
        const link = targetBird.Doi || "https://birdsoftheworld.org";
        window.open(link, "_blank");
    });
}
  });


// Translation icon mechanisms (MUST WAIT FOR DOM)
document.addEventListener("DOMContentLoaded", () => {

    const langBtn  = document.getElementById("langBtn");
    const langMenu = document.getElementById("langMenu");

    langBtn.addEventListener("click", () => {
        langMenu.classList.toggle("hidden");
    });

    // FIX: robust click detection
    langMenu.addEventListener("click", (e) => {
        const item = e.target.closest("[data-lang]");
        if (!item) return;

        const lang = item.dataset.lang;
        const select = document.getElementById("langSelect");

        select.value = lang;
        select.dispatchEvent(new Event("change")); // triggers your existing logic

        langMenu.classList.add("hidden");
    });

    // Close when clicking outside
    document.addEventListener("click", e => {
        if (!e.target.closest(".icon-btn") &&
            !e.target.closest(".lang-menu")) {
            langMenu.classList.add("hidden");
        }
    });

});

// Button BOTW

document.getElementById("bowLinkBtn").onclick = () => {
    if (selectedBird && selectedBird.Doi) {
        window.open(selectedBird.Doi, "_blank");
      }
    };

// Reval mystery bird modal tile

function showFinalModal() {
    const box = document.getElementById("finalBirdBox");
    const bird = targetBird;

    const imgUrl = extractMLImage(bird.Picture);

    // bird name according to language
    const commonName = getCommonName(bird);
    const sci = bird.Sname;

    box.innerHTML = `
        <div style="font-size:18px; font-weight:500; margin-bottom:0px;">${commonName}</div>
        <div style="font-size:18px; font-weight:500; font-style:italic; opacity:1; margin-bottom:6px;">(${sci})</div>

        ${imgUrl 
            ? `<img src="${imgUrl}" style="width:100%; max-width:350px; border-radius:12px;">`
            : "<div>No image available</div>"
        }
    `;
    
    const bowBtn = document.getElementById("bowLinkBtn");
    bowBtn.onclick = () => window.open(bird.Doi, "_blank");


    document.getElementById("finalModal").classList.remove("hidden");
    startNextBirdleCountdown(); 
}

// ---------------------------------------
// Landing screen
// ---------------------------------------
document.addEventListener("DOMContentLoaded", () => {

    const landing = document.getElementById("landingScreen");
    const game = document.getElementById("gameScreen");
    const playBtn = document.getElementById("startPlayBtn");

    playBtn.addEventListener("click", () => {
        landing.classList.add("hidden");  // hide landing
        game.classList.remove("hidden");   // show game
        startGame();                       // start daily puzzle
    });
});



// ---------------------------------------
// RULES ATTRIBUTE SYSTEM (Spotle style)
// ---------------------------------------

const rulesDetails = document.getElementById("rulesDetails");
const attrTiles = document.querySelectorAll(".rules-attr-tile");

const ATTRIBUTE_INFO = {
  taxa: {
    title: "Taxa",
    desc: "Order > Family.",
    buttons: [
      { cls: "incorrect", label: "Incorrect" },
      { cls: "partial", label: "Order\ncorrect" },
      { cls: "correct", label: "Correct" }
    ]
  },
  mass: {
    title: "Body Mass (in g)",
    desc: "Body mass classes: 0-100g / 100-1000g / 1000-3000g / >3000g. Arrows show direction.",
    buttons: [
      { cls: "incorrect", label: "Incorrect" },
      { cls: "partial", label: "Same\nclass" },
      { cls: "correct", label: "Correct" }
    ]
  },
  beak: {
    title: "Beak",
    desc: "Length of the beak relative to the specie body mass. Varies between 0 and 1. High values suggest a long beak. Arrows show direction.",
    buttons: [
      { cls: "incorrect", label: "Incorrect" },
      { cls: "partial", label: "Close\n(±0.125)" },
      { cls: "correct", label: "Exact" }
    ]
  },
  realm: {
    title: "Realm",
    desc: "Afrotropical / Indomalayan / Neartic / Neotropical / Oceania / Palearctic / South Polar.",
    buttons: [
      { cls: "incorrect", label: "Incorrect" },
      { cls: "partial", label: "Partial\noverlap" },
      { cls: "correct", label: "Correct" }
    ]
  },
  habitat: {
    title: "Habitat",
    desc: "Forest / Grassland / Dry plains / Wetland / Marine.",
    buttons: [
      { cls: "incorrect", label: "Incorrect" },
      { cls: "correct", label: "Correct" }
    ]
  },
  migration: {
    title: "Migration",
    desc: "Sedentary / Partial Migrants / Migratory.",
    buttons: [
      { cls: "incorrect", label: "Incorrect" },
      { cls: "correct", label: "Correct" }
    ]
  },
  nest: {
    title: "Nest",
    desc: "Open / Closed / Cavity (Tree cavity, Burrow, Crevices) / Mound / Other (Brood Parasitism, Absence of nest).",
    buttons: [
      { cls: "incorrect", label: "Incorrect" },
      { cls: "correct", label: "Correct" }
    ]
  },
  diet: {
    title: "Primary Diet",
    desc: "Frugivore / Granivore / Herbivore (leaves, flowers, algaes...) / Invertebrate / Vertebrate / Scavenger / Omnivore.",
    buttons: [
      { cls: "incorrect", label: "Incorrect" },
      { cls: "correct", label: "Correct" }
    ]
  }
};

// Expand tile
attrTiles.forEach(tile => {
  tile.addEventListener("click", () => {
    const key = tile.dataset.attr;

    attrTiles.forEach(t => t.classList.remove("active"));
    tile.classList.add("active");

    const info = ATTRIBUTE_INFO[key];

    rulesDetails.classList.remove("hidden");
    rulesDetails.innerHTML = `
      <h3>${info.title}</h3>
      <p>${info.desc.replace(/\n/g, "<br>")}</p>
      <div class="rule-detail-buttons">
        ${info.buttons
            .map(b => `<div class="rule-button ${b.cls}">${b.label.replace(/\n/g, "<br>")}</div>`)
            .join("")}
      </div>
    `;
  });
});

//-------------------------------------------------------
//  EXTRACT IMAGE FROM ML & METADATA
//-------------------------------------------------------
function extractMLImage(iframeHtml) {
  if (!iframeHtml) return null;
  const match = iframeHtml.match(/asset\/(\d+)\//);
  if (!match) return null;
  const assetId = match[1];
  return `https://cdn.download.ams.birds.cornell.edu/api/v1/asset/${assetId}/1200`;
}

function extractMLCode(iframeHtml) {
  if (!iframeHtml) return null;
  const match = iframeHtml.match(/asset\/(\d+)\//);
  return match ? match[1] : null;
}

// Extract contributor name directly from the embed HTML as fallback
function extractContributorFromEmbed(html) {
    if (!html) return null;

    // ML embed captions usually contain "© Name"
    const cleaned = html.replace(/\s+/g, " ");
    const match = cleaned.match(/©\s*([^<\|;]+)/);

    return match ? match[1].trim() : null;
}


async function fetchContributorName(mlCode, pictureHtml) {

    console.log("FETCHING CONTRIBUTOR FOR", mlCode);

    // ---- 1) Try ML API (may fail due to CORS) ----
    if (mlCode) {
        try {
            const url = `https://macaulaylibrary.org/api/v2/assets/${mlCode}`;
            const res = await fetch(url);
            console.log("API STATUS:", res.status);

            if (res.ok) {
                const data = await res.json();
                console.log("API JSON:", data);

                const fromApi =
                    data.contributors?.[0]?.fullName ||
                    data.representativeContributor?.displayName;

                if (fromApi) return fromApi;
            }
        } catch (err) {
            console.warn("ML API fetch failed:", err);
        }
    }

    console.log("Local fallback parse:", extractContributorFromEmbed(pictureHtml));

    // ---- 2) Local fallback ----
    return extractContributorFromEmbed(pictureHtml) || null;
}



//-------------------------------------------------------
//  START / RESET GAME
//-------------------------------------------------------

function disableSearchBar() {
  const input = document.getElementById("guessInput");
  const list = document.getElementById("autocomplete-list");

  input.classList.add("disabled");
  input.setAttribute("disabled", "true");

  list.classList.add("disabled");
  document.getElementById("status").classList.add("disabled");
}

function startGame() {

  // Daily seed
  const seed = getDailySeed();
  const rand = mulberry32(seed);

  // Pick deterministic daily bird
  targetBird = pickDailyBird(seed);
   // Pick 100 birds pool
  todayPool = buildDailyBirdPool(seed, targetBird);
  todayPool.sort(sortByCurrentLanguage);

  // Try loading previous game state
  const stored = loadGameState();
  const isSameDay = stored && stored.day === seed;

  if (isSameDay) {
      console.log("Restoring previous Birdle...");

      // Restore guess history
      guessHistory = stored.guesses || [];

      // Reset used names from history
      usedNames.clear();
      guessHistory.forEach(g => usedNames.add(g.name));

      // Compute remaining guesses
      guessesRemaining = 10 - guessHistory.length;
      gameOver = guessesRemaining <= 0 ||
                 guessHistory.some(g => g.name === targetBird.Name);

      // Restore UI
      const historyEl = document.getElementById("history");
      historyEl.innerHTML = "";

      guessHistory.forEach(entry => {
      displayGuess(entry.name, entry.tiles);

      if (entry.finalReveal) {
        gameOver = true;
        disableSearchBar();
        showFinalModal();
      }
      });

      updateStatus();

      // If user already solved the bird earlier
      if (gameOver) {
          disableSearchBar();
          showFinalModal();
      }

  } else {
      console.log("New Birdle day — starting fresh");

      // Reset for fresh game
      guessHistory = [];
      usedNames.clear();
      guessesRemaining = 10;
      gameOver = false;

      // Clear storage for new day
      localStorage.removeItem("birdle_state");

      document.getElementById("history").innerHTML = "";
      document.getElementById("reveal").innerHTML = "";
      updateStatus();
  }

  // If the game is not over, enable the search bar
  const input = document.getElementById("guessInput");
  const list = document.getElementById("autocomplete-list");

  if (!gameOver) {
      input.classList.remove("disabled");
      input.removeAttribute("disabled");
      list.classList.remove("disabled");
      document.getElementById("status").classList.remove("disabled");
  }
}

// -------------------------------------------------------
//  TEST TOOL: Simulate N days and check rule validity
//  Uses MIN_DAYS_BETWEEN_SAME_ORDER and real history
// -------------------------------------------------------
function testBirdSelection(daysToSimulate = 200) {
    const results = [];
    const history = loadBirdHistory();  // Use real history as a starting point

    for (let offset = 0; offset < daysToSimulate; offset++) {
        const simulatedSeed = getDailySeed() + offset;

        // Temporarily use simulated history inside pickDailyBird
        const tempLoad = () => history;
        const tempSave = (h) => Object.assign(history, h);

        const originalLoad = loadBirdHistory;
        const originalSave = saveBirdHistory;

        loadBirdHistory = tempLoad;
        saveBirdHistory = tempSave;

        // Pick candidate for this simulated day
        const bird = pickDailyBird(simulatedSeed);

        // Restore real functions
        loadBirdHistory = originalLoad;
        saveBirdHistory = originalSave;

        const name = bird.Name;
        const order = bird.Order;

        // -------------------------
        // Rule 1 — Check repeat ban
        // -------------------------
        let repeatViolation = false;
        for (let d = 1; d <= 60; d++) {
            if (history[simulatedSeed - d] === name) {
                repeatViolation = true;
                break;
            }
        }

        // -------------------------
        // Rule 2 — Check Order ban
        // -------------------------
        let orderViolation = false;
        for (let i = 1; i <= MIN_DAYS_BETWEEN_SAME_ORDER; i++) {
            const pastName = history[simulatedSeed - i];
            if (!pastName) continue;

            const pastBird = birds.find(b => b.Name === pastName);
            if (pastBird && pastBird.Order === order) {
                orderViolation = true;
                break;
            }
        }

        // Rule 3 - FAMILY RULE CHECK
        let familyViolation = false;
        for (let i = 1; i <= MIN_DAYS_BETWEEN_SAME_FAMILY; i++) {
        const pastName = history[simulatedSeed - i];
        if (!pastName) continue;

        const pastBird = birds.find(b => b.Name === pastName);
        if (pastBird && pastBird.Family === bird.Family) {
        familyViolation = true;
        break;
         }
        }

        // Record simulated result
        results.push({
        day: simulatedSeed,
        bird: name,
        order,
        family: bird.Family,
        repeatViolation,
        orderViolation,
        familyViolation
        });

        // Update simulated history
        history[simulatedSeed] = name;
    }

    console.table(results);
    console.log(
        `✔ If all values in 'repeatViolation' and 'orderViolation' are false, your rules work (Order ban = ${MIN_DAYS_BETWEEN_SAME_ORDER} days).`
    );
}

function updateStatus() {
  document.getElementById("status").innerText =
    `Guesses remaining: ${guessesRemaining}`;
}


//-------------------------------------------------------
//  COMPARISON HELPERS
//-------------------------------------------------------
function compareTaxa(g, t) {
  if (g.Order === t.Order && g.Family === t.Family) return "correct";
  if (g.Order === t.Order) return "partial";
  return "wrong";
}

function massCategory(v) {
  return MASS_CATEGORIES.find(c => v <= c.max).label;
}

function compareMass(g, t) {
  if (g === t) return "correct";
  return massCategory(g) === massCategory(t) ? "partial" : "wrong";
}

function compareBeak(g, t) {
  if (g === t) return "correct";
  return Math.abs(g - t) <= 0.125 ? "partial" : "wrong";
}

function compareRealm(g, t) {
  const gArr = g.split(",").map(s => s.trim());
  const tArr = t.split(",").map(s => s.trim());
  if (gArr.length === tArr.length && gArr.every(v => tArr.includes(v)))
    return "correct";
  return gArr.some(v => tArr.includes(v)) ? "partial" : "wrong";
}

function compareExact(g, t) {
  return g === t ? "correct" : "wrong";
}


//-------------------------------------------------------
//  HANDLE GUESS
//-------------------------------------------------------
function handleGuess(choice) {

  if (gameOver) return;       // ⬅ prevents guesses after game end
  
  if (!choice || usedNames.has(choice)) return;

  const guess = todayPool.find(b => b.Name === choice);
  if (!guess) return;

  usedNames.add(choice);
  guessesRemaining--;
  updateStatus();

  // -----------------------------------------
  // CHECK IF CORRECT BIRD → END GAME
  // -----------------------------------------
  if (choice === targetBird.Name) {

    const bird = targetBird;

    const finalTiles = [
        { label: "Taxa", value: `${bird.Order}<br>&gt;&nbsp;${bird.Family}`, score: "correct" },
        { label: "Mass", value: `${bird.Mass} g`, score: "correct" },
        { label: "Beak", value: bird["Beak.Index"].toFixed(2), score: "correct" },
        { label: "Realm", value: bird.Realm, score: "correct" },
        { label: "Habitat", value: bird.Habitat, score: "correct" },
        { label: "Migration", value: bird.Migration, score: "correct" },
        { label: "Nest", value: bird.Nest, score: "correct" },
        { label: "Diet", value: bird.Diet, score: "correct" }
    ];

    // 1️⃣ Save reveal tile to history
    guessHistory.push({
        name: bird.Name,
        tiles: finalTiles,
        finalReveal: true
    });

    saveGameState();

    // 2️⃣ Show reveal card in UI
    revealFinal(true);

    // SEND ANALYTICS EVENT — PLAYER WON
  gtag('event', 'win', {
  guesses_used: 10 - guessesRemaining,
  day: getDailySeed()
  });

    // 3️⃣ Lock game & show modal
    gameOver = true;
    disableSearchBar();
    showFinalModal();
    return;
}

  // -----------------------------------------
  // NORMAL (INCORRECT) GUESS BEHAVIOUR
  // -----------------------------------------
  const massArrow =
    guess.Mass < targetBird.Mass ? "↑" :
    guess.Mass > targetBird.Mass ? "↓" : "";

  const beakArrow =
    guess["Beak.Index"] < targetBird["Beak.Index"] ? "↑" :
    guess["Beak.Index"] > targetBird["Beak.Index"] ? "↓" : "";

  const tiles = [
    { label: "Taxa", value: `${guess.Order}<br>&gt;&nbsp;${guess.Family}`, score: compareTaxa(guess, targetBird)},
    { label: "Mass", value: `${guess.Mass} g ${massArrow}`, score: compareMass(guess.Mass, targetBird.Mass) },
    { label: "Beak", value: `${guess["Beak.Index"]?.toFixed(2)} ${beakArrow}`, score: compareBeak(guess["Beak.Index"], targetBird["Beak.Index"]) },
    { label: "Realm", value: guess.Realm, score: compareRealm(guess.Realm, targetBird.Realm) },
    { label: "Habitat", value: guess.Habitat, score: compareExact(guess.Habitat, targetBird.Habitat) },
    { label: "Migration", value: guess.Migration, score: compareExact(guess.Migration, targetBird.Migration) },
    { label: "Nest", value: guess.Nest, score: compareExact(guess.Nest, targetBird.Nest) },
    { label: "Diet", value: guess.Diet, score: compareExact(guess.Diet, targetBird.Diet) }
  ];

  displayGuess(choice, tiles);

  // Save guess to history + persist
  guessHistory.push({ name: choice, tiles });
  saveGameState();

  // -----------------------------------------
  // CHECK IF OUT OF GUESSES → END GAME
  // -----------------------------------------
  if (guessesRemaining === 0) {

    // 1️⃣ Build tiles exactly like revealFinal() does
    const bird = targetBird;

    const finalTiles = [
        { label: "Taxa", value: `${bird.Order}<br>&gt;&nbsp;${bird.Family}`, score: "correct" },
        { label: "Mass", value: `${bird.Mass} g`, score: "correct" },
        { label: "Beak", value: bird["Beak.Index"].toFixed(2), score: "correct" },
        { label: "Realm", value: bird.Realm, score: "correct" },
        { label: "Habitat", value: bird.Habitat, score: "correct" },
        { label: "Migration", value: bird.Migration, score: "correct" },
        { label: "Nest", value: bird.Nest, score: "correct" },
        { label: "Diet", value: bird.Diet, score: "correct" }
    ];

    // 2️⃣ Store it in guess history
    guessHistory.push({
        name: targetBird.Name,
        tiles: finalTiles,
        finalReveal: true
    });

    saveGameState();

    // 3️⃣ Show UI version (this calls displayGuess)
    revealFinal();
    
    // SEND ANALYTICS EVENT — PLAYER LOST
    gtag('event', 'loss', {
    guesses_used: 10,
    day: getDailySeed()
    });

    // 4️⃣ Lock game
    gameOver = true;
    disableSearchBar();
    showFinalModal();
}

}


//-------------------------------------------------------
//  DISPLAY GUESS BLOCK (LANGUAGE-AWARE)
//-------------------------------------------------------
function displayGuess(name, tiles) {
  const history = document.getElementById("history");
  const row = document.createElement("div");
  row.className = "guess-row";
  row.dataset.birdName = name;

  const bird = birds.find(b => b.Name === name);
  const commonName = getCommonName(bird);
  const sciName = bird.Sname;

  row.innerHTML = `
    <div class="guess-container">
      <div class="image-section">

        <div class="bird-name-display centered-name">
          <span class="common-name"><b>${commonName}</b></span>
          <span class="scientific-name"><i>(${sciName})</i></span>
        </div>

        <div class="image-wrapper">
        ${(() => {
        const img = extractMLImage(bird.Picture);
        return img ? `<img class="bird-photo" src="${img}" />` : "<div>No image</div>";
        })()}
        <button class="info-toggle"><i class="bi bi-info-circle-fill"></i></button>
        </div>

        <div class="extra-info hidden">
            <p class="credits-line"></p>
        </div>

      </div>

      <div class="tile-grids-wrapper">
        <div class="tile-grid grid-top"></div>
        <div class="tile-grid grid-bottom"></div>
      </div>
    </div>
  `;

  const gridTop = row.querySelector(".grid-top");
  const gridBottom = row.querySelector(".grid-bottom");

  tiles.slice(0, 4).forEach(t => {
    gridTop.innerHTML += `
      <div class="tile ${t.score}">
        <div class="tile-content">
          <span class="attr-label">${t.label}</span>
          <span class="attr-value"><b>${t.value}</b></span>
        </div>
      </div>`;
  });

  tiles.slice(4).forEach(t => {
    gridBottom.innerHTML += `
      <div class="tile ${t.score}">
        <div class="tile-content">
          <span class="attr-label">${t.label}</span>
          <span class="attr-value"><b>${t.value}</b></span>
        </div>
      </div>`;
  });

  row.querySelector(".info-toggle").addEventListener("click", (e) => {
    const container = e.currentTarget.closest(".image-section");
    const panel = container.querySelector(".extra-info");
    panel.classList.toggle("hidden");
  });

  // Insert into page
  history.prepend(row);

  // -------------------------------------------------------
  // BUILD CREDITS FROM LOCAL JSON (NO ASYNC FETCH ANYMORE)
  // -------------------------------------------------------
  const contributor = bird.Contributor || "Unknown";
  const localizedCommon = getCommonName(bird);

  const mlCode = extractMLCode(bird.Picture);
  const mlLink = mlCode
      ? `<a href="https://macaulaylibrary.org/asset/${mlCode}" target="_blank" class="info-link">(ML${mlCode})</a>`
      : "";

  const botwLink = bird.Doi
      ? `<a href="${bird.Doi}" target="_blank" class="info-link">Birds of the World</a>`
      : "";

  const creditText =
      `${localizedCommon} © ${contributor}; ` +
      `Cornell Lab of Ornithology | Macaulay Library ${mlLink}; ${botwLink}.`;

  row.querySelector(".credits-line").innerHTML = creditText;
}



//-------------------------------------------------------
//  FINAL REVEAL (LANGUAGE-AWARE)
//-------------------------------------------------------
function revealFinal() {
  const bird = targetBird;

  const tiles = [
    { label: "Taxa", value: `${bird.Order}<br>&gt;&nbsp;${bird.Family}`, score: "correct" },
    { label: "Mass", value: `${bird.Mass} g`, score: "correct" },
    { label: "Beak", value: bird["Beak.Index"].toFixed(2), score: "correct" },
    { label: "Realm", value: bird.Realm, score: "correct" },
    { label: "Habitat", value: bird.Habitat, score: "correct" },
    { label: "Migration", value: bird.Migration, score: "correct" },
    { label: "Nest", value: bird.Nest, score: "correct" },
    { label: "Diet", value: bird.Diet, score: "correct" }
  ];

  const container = document.getElementById("reveal");
  container.innerHTML = "";

  displayGuess(bird.Name, tiles);
}

//-------------------------------------------------------
//  AUTOCOMPLETE SYSTEM (LANGUAGE-AWARE)
//-------------------------------------------------------
function setupAutocomplete() {
  const input = document.getElementById("guessInput");
  const wrapper = document.querySelector(".autocomplete-container");

  const list = document.createElement("div");
  list.id = "autocomplete-list";
  list.className = "autocomplete-list";
  wrapper.appendChild(list);

  let activeIndex = -1;

  function getDisplayName(bird) {
    const common = getCommonName(bird);
  return `${common} (${bird.Sname})`;
  }

  //---------------------------------------------------
  // RENDER AUTOCOMPLETE
  //---------------------------------------------------
  function renderList(matches, q) {
    list.innerHTML = matches.map((b, i) => {
      const disp = getDisplayName(b);

      const highlighted =
        q === ""
          ? disp
          : disp.replace(new RegExp(q, "gi"), m => `<span class="highlight">${m}</span>`);

      return `
        <div class="autocomplete-item"
             data-index="${i}"
             data-name="${b.Name}">
          ${highlighted}
        </div>`;
    }).join("");

    list.style.display = "block";
    activeIndex = -1;
  }

  //---------------------------------------------------
  // FILTER LIST
  //---------------------------------------------------
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    input.dataset.fromSuggestion = "false";

    let matches;
    if (!q) {
    matches = todayPool.filter(b => !usedNames.has(b.Name)); 
    } else {
      matches = todayPool.filter(b =>
      !usedNames.has(b.Name) &&
      getDisplayName(b).toLowerCase().includes(q)
      );
    }

    if (matches.length === 0) {
      list.style.display = "none";
      return;
    }

    renderList(matches, q);
  });

  input.addEventListener("focus", () => {
    const q = input.value.trim();

    if (q === "") {
        const matches = todayPool.filter(b => !usedNames.has(b.Name));
        renderList(matches, "");
        list.style.display = "block";
    }
});

  //---------------------------------------------------
  // CLICK → SELECT
  //---------------------------------------------------
  list.addEventListener("click", e => {
    const item = e.target.closest(".autocomplete-item");
    if (!item) return;

    const bird = todayPool.find(b => b.Name === item.dataset.name);
    if (!bird) return;

    // Immediately submit the guess
    handleGuess(bird.Name);

    // Clear input & close list
    input.value = "";
    input.dataset.fromSuggestion = "false";
    list.style.display = "none";
    });

  //---------------------------------------------------
  // KEYBOARD NAVIGATION
  //---------------------------------------------------
  input.addEventListener("keydown", e => {
    const items = Array.from(list.querySelectorAll(".autocomplete-item"));
    const count = items.length;

    if (e.key === "Backspace" && input.dataset.fromSuggestion === "true") {
      e.preventDefault();
      input.value = "";
      input.dataset.fromSuggestion = "false";
      list.style.display = "none";
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!count) return;

      activeIndex = (activeIndex + 1) % count;

      items.forEach(el => el.classList.remove("active"));
      const activeItem = items[activeIndex];
      activeItem.classList.add("active");

      const bird = todayPool.find(b => b.Name === activeItem.dataset.name);
      input.value = getDisplayName(bird);
      input.dataset.fromSuggestion = "true";
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!count) return;

      activeIndex = (activeIndex - 1 + count) % count;

      items.forEach(el => el.classList.remove("active"));
      const activeItem = items[activeIndex];
      activeItem.classList.add("active");

      const bird = todayPool.find(b => b.Name === activeItem.dataset.name);
      input.value = getDisplayName(bird);
      input.dataset.fromSuggestion = "true";
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();

      const disp = input.value.trim();
      if (!disp) return;

      const matchBird = todayPool.find(b =>
        getDisplayName(b).toLowerCase() === disp.toLowerCase()
      );

      if (!matchBird) return;

      handleGuess(matchBird.Name);

      input.value = "";
      input.dataset.fromSuggestion = "false";
      list.style.display = "none";
      activeIndex = -1;
      return;
    }
  });

  //---------------------------------------------------
  // CLICK OUTSIDE → CLOSE LIST
  //---------------------------------------------------
  document.addEventListener("click", e => {
    if (!e.target.closest(".autocomplete-container")) {
      list.style.display = "none";
    }
  });
}

//-------------------------------------------------------
//  RULES 
//-------------------------------------------------------

document.getElementById("rulesBtn").onclick = () => {
  const panel = document.getElementById("rulesPanel");
  panel.style.display = panel.style.display === "none" ? "block" : "none";
};

//-------------------------------------------------------
//  LANGUAGE SELECT MENU
//-------------------------------------------------------
document.getElementById("langSelect").addEventListener("change", (e) => {
    currentLang = e.target.value;

    document.getElementById("guessInput").placeholder = "Type a bird name...";

    todayPool.sort(sortByCurrentLanguage);

    rerenderHistoryInCurrentLanguage();

    // Re-render final reveal if visible
    if (targetBird && document.getElementById("reveal").children.length > 0) {
        document.getElementById("reveal").innerHTML = "";
        revealFinal();
    }

    // Refresh autocomplete
    document.getElementById("guessInput").dispatchEvent(new Event("input"));
});


//-------------------------------------------------------
//  RE-RENDER HISTORY
//-------------------------------------------------------
function rerenderHistoryInCurrentLanguage() {
    const rows = Array.from(document.getElementById("history").children);

    rows.forEach(row => {
        const name = row.dataset.birdName;
        const bird = birds.find(b => b.Name === name);

        const common = getCommonName(bird);

        const nameBoxCommon = row.querySelector(".bird-name-display .common-name");
        const nameBoxSci = row.querySelector(".bird-name-display .scientific-name");

        if (nameBoxCommon) nameBoxCommon.innerHTML = `<b>${common}</b>`;
        if (nameBoxSci) nameBoxSci.innerHTML = `<i>(${bird.Sname})</i>`;
    });
}


//-------------------------------------------------------
//  SIMULATE NEXT 60 DAYS — ANALYZE DAILY POOLS
//-------------------------------------------------------
async function simulateDailyPools(days = 60) {
    if (!birds.length) {
        console.error("Birds database not loaded yet.");
        return;
    }

    console.log("=== SIMULATION: NEXT " + days + " DAYS ===");

    const results = [];

    for (let i = 0; i < days; i++) {
        const seed = getDailySeed() + i;

        // Pick a deterministic bird for that day
        const target = pickDailyBird(seed);

        // Build the 100-bird pool for that day
        const pool = buildDailyBirdPool(seed, target);

        // Count by Order
        const orderCount = {};
        pool.forEach(b => {
            orderCount[b.Order] = (orderCount[b.Order] || 0) + 1;
        });

        // Count by Habitat
        const habitatCount = {};
        pool.forEach(b => {
            habitatCount[b.Habitat] = (habitatCount[b.Habitat] || 0) + 1;
        });

        results.push({
            day: seed,
            target: target.Name,
            orderCount,
            habitatCount
        });
    }

    console.log("=== SIMULATION RESULTS ===");
    console.log(results);
    return results;
}
