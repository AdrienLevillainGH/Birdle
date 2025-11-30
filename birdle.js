/* ============================================
   BIRDLE — Full Revised JS
============================================ */

let birds = [];
let targetBird = null;
let guessesRemaining = 10;
let usedNames = new Set();

/* =============================
   MASS CATEGORIES
============================= */
const MASS_CATEGORIES = [
  { max: 100, label: "0-100" },
  { max: 1000, label: "100-1000" },
  { max: 3000, label: "1000-3000" },
  { max: Infinity, label: ">3000" }
];

/* =============================
   LOAD BIRDS DATA
============================= */
fetch("birds.json")
  .then(res => res.json())
  .then(data => {
    birds = data;
    setupAutocomplete();
    startGame();
  });

/* =============================
   START A NEW GAME
============================= */
function startGame() {
  targetBird = birds[Math.floor(Math.random() * birds.length)];
  guessesRemaining = 10;
  usedNames.clear();

  document.getElementById("history").innerHTML = "";
  document.getElementById("reveal").innerHTML = "";

  updateStatus();
}

/* =============================
   STATUS UPDATE
============================= */
function updateStatus() {
  document.getElementById("status").innerText =
    `Guesses remaining: ${guessesRemaining}`;
}

/* =============================
   COMPARISON HELPERS
============================= */
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

  if (gArr.length === tArr.length && gArr.every(v => tArr.includes(v))) return "correct";
  return gArr.some(v => tArr.includes(v)) ? "partial" : "wrong";
}

function compareExact(g, t) {
  return g === t ? "correct" : "wrong";
}

/* =============================
   CUSTOM AUTOCOMPLETE
============================= */
function setupAutocomplete() {
  const input = document.getElementById("guessInput");

  const list = document.createElement("div");
  list.id = "autocompleteList";
  list.className = "autocomplete-list";
  document.querySelector(".autocomplete-container").appendChild(list);

  let activeIndex = -1; // ⭐ keeps track of keyboard-selected item
  input.dataset.fromSuggestion = "false";

  /* ---------------------------
     RENDER LIST ITEMS
  --------------------------- */
  function renderList(matches, query) {
    list.innerHTML = matches
      .map((b, i) => {
        const highlighted =
          query === ""
            ? b.Name
            : b.Name.replace(
                new RegExp(query, "gi"),
                m => `<span class="highlight">${m}</span>`
              );
        return `
          <div class="autocomplete-item" 
               data-index="${i}" 
               data-name="${b.Name}">
            ${highlighted}
          </div>`;
      })
      .join("");

    list.style.display = "block";
    activeIndex = -1; // reset selection
  }

  /* ---------------------------
     FILTER ON INPUT
  --------------------------- */
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    input.dataset.fromSuggestion = "false";

    let matches;

    // empty → show full list
    if (!q) {
      matches = birds.slice(0, 50);
    } else {
      matches = birds
        .filter(b => b.Name.toLowerCase().includes(q))
        .slice(0, 50);
    }

    if (matches.length === 0) {
      list.style.display = "none";
      return;
    }

    renderList(matches, q);
  });

  /* ---------------------------
     CLICK SELECT
  --------------------------- */
  list.addEventListener("click", e => {
    const item = e.target.closest(".autocomplete-item");
    if (!item) return;

    input.value = item.dataset.name;
    input.dataset.fromSuggestion = "true";
    list.style.display = "none";

    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  });

  /* ---------------------------
     KEYBOARD NAVIGATION
  --------------------------- */
  input.addEventListener("keydown", e => {
    const items = Array.from(list.querySelectorAll(".autocomplete-item"));
    const count = items.length;

    /* --- ONE BACKSPACE QUICK CLEAR --- */
    if (e.key === "Backspace" && input.dataset.fromSuggestion === "true") {
      e.preventDefault();
      input.value = "";
      input.dataset.fromSuggestion = "false";
      list.style.display = "none";
      return;
    }

    /* --- DOWN ARROW --- */
    if (e.key === "ArrowDown") {
      e.preventDefault();

      if (list.style.display !== "block" || count === 0) return;

      activeIndex = (activeIndex + 1) % count;

      items.forEach(el => el.classList.remove("active"));
      items[activeIndex].classList.add("active");

      // auto-scroll
      items[activeIndex].scrollIntoView({ block: "nearest" });

      return;
    }

    /* --- UP ARROW --- */
    if (e.key === "ArrowUp") {
      e.preventDefault();

      if (list.style.display !== "block" || count === 0) return;

      activeIndex = (activeIndex - 1 + count) % count;

      items.forEach(el => el.classList.remove("active"));
      items[activeIndex].classList.add("active");

      items[activeIndex].scrollIntoView({ block: "nearest" });

      return;
    }

    /* --- ENTER selects current --- */
    if (e.key === "Enter") {
      e.preventDefault();

      // if arrow was used
      if (activeIndex >= 0 && items[activeIndex]) {
        const picked = items[activeIndex];
        input.value = picked.dataset.name;
        input.dataset.fromSuggestion = "true";

        list.style.display = "none";

        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);

        document.getElementById("submitGuess").click();
        return;
      }

      // if no active item → pick first
      const first = list.querySelector(".autocomplete-item");
      if (first) {
        input.value = first.dataset.name;
        input.dataset.fromSuggestion = "true";

        list.style.display = "none";

        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);

        document.getElementById("submitGuess").click();
      }
    }
  });

  /* ---------------------------
     CLICK OUTSIDE → CLOSE LIST
  --------------------------- */
  document.addEventListener("click", e => {
    if (!e.target.closest(".autocomplete-container")) {
      list.style.display = "none";
    }
  });
}


/* =============================
   SUBMIT GUESS
============================= */
document.getElementById("submitGuess").addEventListener("click", () => {
  const input = document.getElementById("guessInput");
  const choice = input.value.trim();

  if (!choice || usedNames.has(choice)) return;

  const guess = birds.find(b => b.Name === choice);
  if (!guess) return;

  usedNames.add(choice);
  guessesRemaining--;
  updateStatus();
  input.value = "";

  const arrowMass =
    guess.Mass < targetBird.Mass ? "↑" :
    guess.Mass > targetBird.Mass ? "↓" : "";

  const guessBeak = guess["Beak.Index"];
  const targetBeak = targetBird["Beak.Index"];

  const arrowBeak =
    guessBeak < targetBeak ? "↑" :
    guessBeak > targetBeak ? "↓" : "";

  const beakText =
    typeof guessBeak === "number"
      ? `${guessBeak.toFixed(2)} ${arrowBeak}`
      : "NA";

  const tiles = [
    { label: "Taxa", value: `${guess.Order} > ${guess.Family}`, score: compareTaxa(guess, targetBird) },
    { label: "Mass", value: `${guess.Mass} g ${arrowMass}`, score: compareMass(guess.Mass, targetBird.Mass) },
    { label: "Beak Index", value: beakText, score: compareBeak(guessBeak, targetBeak) },
    { label: "Realm", value: guess.Realm, score: compareRealm(guess.Realm, targetBird.Realm) },
    { label: "Habitat", value: guess.Habitat, score: compareExact(guess.Habitat, targetBird.Habitat) },
    { label: "Migration", value: guess.Migration, score: compareExact(guess.Migration, targetBird.Migration) },
    { label: "Nest", value: guess.Nest, score: compareExact(guess.Nest, targetBird.Nest) },
    { label: "Diet", value: guess.Diet, score: compareExact(guess.Diet, targetBird.Diet) }
  ];

  displayGuess(choice, tiles);

  if (choice === targetBird.Name || guessesRemaining === 0) {
    reveal();
  }
});

/* =============================
   DISPLAY GUESS
============================= */
function displayGuess(name, tiles) {
  const history = document.getElementById("history");
  const bird = birds.find(b => b.Name === name);

  const row = document.createElement("div");
  row.className = "guess-row";

  row.innerHTML = `
    <div class="guess-container">
      <div class="image-section">
        ${bird.Picture || "<div>No image</div>"}
        <button class="info-toggle">ℹ️</button>
        <div class="extra-info hidden">
          <p><b>${bird.Vname}</b> · <i>${bird.Sname}</i></p>
          ${bird["ML.Code"] ? `<p><b>ML:</b> ${bird["ML.Code"]}</p>` : ""}
          ${bird["eBird.Code"] ? `<p><b>eBird:</b> ${bird["eBird.Code"]}</p>` : ""}
          <p><a href="${bird.Doi}" target="_blank">🔗 DOI Page</a></p>
        </div>
      </div>
      <div class="tile-grid"></div>
    </div>
  `;

  const tileGrid = row.querySelector(".tile-grid");

  tiles.forEach(t => {
    tileGrid.innerHTML += `
      <div class="tile ${t.score}">
        <div class="tile-label">${t.label}</div>
        <div class="tile-value">${t.value}</div>
      </div>
    `;
  });

  row.querySelector(".info-toggle").addEventListener("click", () => {
    row.querySelector(".extra-info").classList.toggle("hidden");
  });

  history.prepend(row); // newest on top
}

/* =============================
   REVEAL ANSWER
============================= */
function reveal() {
  if (document.querySelector(".reveal-row")) return;

  const history = document.getElementById("history");
  const bird = targetBird;

  const row = document.createElement("div");
  row.className = "guess-row reveal-row";

  const tiles = [
    { label: "Taxa", value: `${bird.Order} > ${bird.Family}` },
    { label: "Mass", value: `${bird.Mass} g` },
    { label: "Beak Index", value: bird["Beak.Index"]?.toFixed(2) || "NA" },
    { label: "Realm", value: bird.Realm },
    { label: "Habitat", value: bird.Habitat },
    { label: "Migration", value: bird.Migration },
    { label: "Nest", value: bird.Nest },
    { label: "Diet", value: bird.Diet }
  ];

  row.innerHTML = `
    <div class="guess-container">
      <div class="image-section">
        ${bird.Picture}
      </div>
      <div>
        <div class="reveal-title">
          🦜 The Mystery Bird Was: ${bird.Name}
        </div>
        <div class="tile-grid"></div>
      </div>
    </div>
  `;

  const tileGrid = row.querySelector(".tile-grid");
  tiles.forEach(t => {
    tileGrid.innerHTML += `
      <div class="tile reveal-tile">
        <div class="tile-label">${t.label}</div>
        <div class="tile-value">${t.value}</div>
      </div>
    `;
  });

  history.prepend(row);
}

/* =============================
   RULES PANEL
============================= */
document.getElementById("rulesBtn").onclick = () => {
  document.getElementById("rulesPanel").classList.toggle("hidden");
};

document.getElementById("restartBtn").onclick = startGame;
