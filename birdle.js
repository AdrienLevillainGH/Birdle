//-------------------------------------------------------
//  GLOBAL GAME STATE
//-------------------------------------------------------
let birds = [];
let targetBird = null;
let guessesRemaining = 10;
let usedNames = new Set();
let guessHistory = [];
let gameOver = false;


let currentLang = "en";   // default language

// Language → field mapping in birds.json
const LANG_MAP = {
  en: "Vname",
  fr: "Fr.Name"
  // Add more languages later:
  // es: "Es.Name",
  // de: "De.Name"
};

const MASS_CATEGORIES = [
  { max: 100, label: "0-100" },
  { max: 1000, label: "100-1000" },
  { max: 3000, label: "1000-3000" },
  { max: Infinity, label: ">3000" }
];

//-------------------------------------------------------
//  LOAD BIRDS.JSON
//-------------------------------------------------------
fetch("birds.json")
  .then(res => res.json())
  .then(data => {
    birds = data;
    birds.sort((a, b) => a.Name.localeCompare(b.Name));
    setupAutocomplete();
    startGame();
  });


// ------------------------
// DICE MECHANISMS
// ------------------------

document.getElementById("randomBtn").addEventListener("click", () => {
    if (gameOver) return;

    // Pick random bird
    const randomBird = birds[Math.floor(Math.random() * birds.length)];

    // Set input value
    const input = document.getElementById("guessInput");
    input.value = `${randomBird[LANG_MAP[currentLang]]} (${randomBird.Sname})`;
    input.dataset.fromSuggestion = "true";

    // Submit guess automatically
    handleGuess(randomBird.Name);
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

  });

// Translation icon mechanisms

  const langBtn = document.getElementById("langBtn");
const langMenu = document.getElementById("langMenu");

langBtn.addEventListener("click", () => {
    langMenu.classList.toggle("hidden");
});

langMenu.addEventListener("click", (e) => {
    if (!e.target.dataset.lang) return;

    const lang = e.target.dataset.lang;
    document.getElementById("langSelect").value = lang;

    // trigger existing language change logic
    document.getElementById("langSelect").dispatchEvent(new Event("change"));

    langMenu.classList.add("hidden");
});

// Close menu when clicking outside
document.addEventListener("click", e => {
    if (!e.target.closest(".icon-btn") && !e.target.closest(".lang-menu")) {
        langMenu.classList.add("hidden");
    }
});

// Reval mystery bird modal tile

function showFinalModal() {
    const box = document.getElementById("finalBirdBox");
    const bird = targetBird;

    const imgUrl = extractMLImage(bird.Picture);

    // bird name according to language
    const field = LANG_MAP[currentLang];
    const commonName = bird[field];
    const sci = bird.Sname;

    box.innerHTML = `
        <div style="font-size:18px; font-weight:500; margin-bottom:0px;">${commonName}</div>
        <div style="font-size:18px; font-weight:500; font-style:italic; opacity:1; margin-bottom:6px;">(${sci})</div>

        ${imgUrl 
            ? `<img src="${imgUrl}" style="width:100%; max-width:350px; border-radius:12px;">`
            : "<div>No image available</div>"
        }
    `;

    document.getElementById("finalModal").classList.remove("hidden");
}

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
    desc: "Body mass classes: 0-100g / 100-1000g / 1000-3000g / >3000g.\nArrows show direction",
    buttons: [
      { cls: "incorrect", label: "Incorrect" },
      { cls: "partial", label: "Same\nclass" },
      { cls: "correct", label: "Correct" }
    ]
  },
  beak: {
    title: "Beak",
    desc: "Length of the beak relative to the specie body mass. Varies between 0 and 1. High values suggest a long beak.\nArrows show direction.",
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
//  EXTRACT IMAGE FROM ML
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
  targetBird = birds[Math.floor(Math.random() * birds.length)];
  guessesRemaining = 10;
  usedNames.clear();
  guessHistory = [];
  gameOver = false;

  // Re-enable search bar
  const input = document.getElementById("guessInput");
  const list = document.getElementById("autocomplete-list");
  input.classList.remove("disabled");
  input.removeAttribute("disabled");
  list.classList.remove("disabled");
  document.getElementById("status").classList.remove("disabled");

  document.getElementById("history").innerHTML = "";
  document.getElementById("reveal").innerHTML = "";
  updateStatus();
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

  const guess = birds.find(b => b.Name === choice);
  if (!guess) return;

  usedNames.add(choice);
  guessesRemaining--;
  updateStatus();

  // -----------------------------------------
  // CHECK IF CORRECT BIRD → END GAME
  // -----------------------------------------
  if (choice === targetBird.Name) {

    revealFinal(true);    // your existing win reveal UI
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

  // -----------------------------------------
  // CHECK IF OUT OF GUESSES → END GAME
  // -----------------------------------------
  if (guessesRemaining === 0) {
    revealFinal();
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
  const field = LANG_MAP[currentLang];
  const commonName = bird[field];
  const sciName = bird.Sname;

  row.innerHTML = `
    <div class="guess-container">
      <div class="image-section">

        <div class="bird-name-display centered-name">
          <span class="common-name"><b>${commonName}</b></span>
          <span class="scientific-name"><i>(${sciName})</i></span>
        </div>

        ${(() => {
          const img = extractMLImage(bird.Picture);
          return img ? `<img class="bird-photo" src="${img}" />` : "<div>No image</div>";
        })()}

        <button class="info-toggle"><i class="bi bi-info-circle-fill"></i></button>

        <div class="extra-info hidden">
          ${(() => {
            const mlCode = extractMLCode(bird.Picture);
            const mlPart = mlCode
              ? `<a href="https://macaulaylibrary.org/asset/${mlCode}" target="_blank" class="info-link">ML${mlCode}</a>`
              : "";

            const doiPart = bird.Doi
              ? `<a href="${bird.Doi}" target="_blank" class="info-link">Learn more</a>`
              : "";

            if (mlPart || doiPart) {
              return `<p>Credits: ${mlPart}${mlPart && doiPart ? ". " : ""}${doiPart}</p>`;
            }
            return "";
          })()}
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
    const panel = e.currentTarget.parentElement.querySelector(".extra-info");
    panel.classList.toggle("hidden");
  });

  history.prepend(row);
}

//-------------------------------------------------------
//  FINAL REVEAL (LANGUAGE-AWARE)
//-------------------------------------------------------
function revealFinal() {
  const bird = targetBird;

  const tiles = [
    { label: "Taxa", value: `${bird.Order}<br>&gt;&nbsp;${bird.Family}`, score: "correct" },
    { label: "Mass", value: `${bird.Mass} g`, score: "correct" },
    { label: "Beak Index", value: bird["Beak.Index"].toFixed(2), score: "correct" },
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
    const field = LANG_MAP[currentLang];
    const common = bird[field];
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
      matches = birds.slice(0, 50);
    } else {
      matches = birds.filter(b =>
        getDisplayName(b).toLowerCase().includes(q)
      ).slice(0, 50);
    }

    if (matches.length === 0) {
      list.style.display = "none";
      return;
    }

    renderList(matches, q);
  });

  // Show full list when focusing an empty input
  input.addEventListener("focus", () => {
    const q = input.value.trim();

    if (q === "") {
        const matches = birds.slice(0, 50);  // show first 50 birds
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

    const bird = birds.find(b => b.Name === item.dataset.name);

    input.value = getDisplayName(bird);
    input.dataset.fromSuggestion = "true";
    list.style.display = "none";

    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
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

      const bird = birds.find(b => b.Name === activeItem.dataset.name);
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

      const bird = birds.find(b => b.Name === activeItem.dataset.name);
      input.value = getDisplayName(bird);
      input.dataset.fromSuggestion = "true";
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();

      const disp = input.value.trim();
      if (!disp) return;

      const matchBird = birds.find(b =>
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
//  RULES & RESTART
//-------------------------------------------------------
document.getElementById("restartBtn").onclick = startGame;

document.getElementById("rulesBtn").onclick = () => {
  const panel = document.getElementById("rulesPanel");
  panel.style.display = panel.style.display === "none" ? "block" : "none";
};

//-------------------------------------------------------
//  LANGUAGE SELECT MENU
//-------------------------------------------------------
document.getElementById("langSelect").addEventListener("change", (e) => {
  currentLang = e.target.value;

  document.getElementById("guessInput").placeholder =
    currentLang === "en" ? "Type a guess..." :
    currentLang === "fr" ? "Cherche un oiseau..." :
    "Type a guess...";

  document.getElementById("guessInput").dispatchEvent(new Event("input"));

  rerenderHistoryInCurrentLanguage();

  if (targetBird && document.getElementById("reveal").children.length > 0) {
    const reveal = document.getElementById("reveal");
    reveal.innerHTML = "";
    revealFinal();
  }
});

//-------------------------------------------------------
//  RE-RENDER HISTORY
//-------------------------------------------------------
function rerenderHistoryInCurrentLanguage() {
  const historyEl = document.getElementById("history");
  const rows = Array.from(historyEl.children);

  rows.forEach(row => {
    const name = row.dataset.birdName;
    const bird = birds.find(b => b.Name === name);

    const field = LANG_MAP[currentLang];
    const commonName = bird[field];
    const sciName = bird.Sname;

    const nameBoxCommon = row.querySelector(".bird-name-display .common-name");
    const nameBoxSci = row.querySelector(".bird-name-display .scientific-name");

    if (nameBoxCommon) nameBoxCommon.innerHTML = `<b>${commonName}</b>`;
    if (nameBoxSci) nameBoxSci.innerHTML = `<i>(${sciName})</i>`;
  });
}
