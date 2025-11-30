//-------------------------------------------------------
//  GLOBAL GAME STATE
//-------------------------------------------------------
let birds = [];
let targetBird = null;
let guessesRemaining = 10;
let usedNames = new Set();
let guessHistory = [];

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

//-------------------------------------------------------
//  START / RESET GAME
//-------------------------------------------------------
function startGame() {
  targetBird = birds[Math.floor(Math.random() * birds.length)];
  guessesRemaining = 10;
  usedNames.clear();
  guessHistory = [];

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
  if (!choice || usedNames.has(choice)) return;

  const guess = birds.find(b => b.Name === choice);
  if (!guess) return;

  usedNames.add(choice);
  guessesRemaining--;
  updateStatus();

  // ---- Direction arrows ----
    const massArrow =
    guess.Mass < targetBird.Mass ? "↑" :
    guess.Mass > targetBird.Mass ? "↓" : "";

  const beakArrow =
    guess["Beak.Index"] < targetBird["Beak.Index"] ? "↑" :
    guess["Beak.Index"] > targetBird["Beak.Index"] ? "↓" : "";

  const tiles = [
    { label: "Taxa", value: `${guess.Order} > ${guess.Family}`, score: compareTaxa(guess, targetBird) },
    { label: "Mass", value: `${guess.Mass} g ${massArrow}`, score: compareMass(guess.Mass, targetBird.Mass) },
    { label: "Beak Index", 
      value: `${guess["Beak.Index"]?.toFixed(2)} ${beakArrow}`, 
    score: compareBeak(guess["Beak.Index"], targetBird["Beak.Index"]) },
    { label: "Realm", value: guess.Realm, score: compareRealm(guess.Realm, targetBird.Realm) },
    { label: "Habitat", value: guess.Habitat, score: compareExact(guess.Habitat, targetBird.Habitat) },
    { label: "Migration", value: guess.Migration, score: compareExact(guess.Migration, targetBird.Migration) },
    { label: "Nest", value: guess.Nest, score: compareExact(guess.Nest, targetBird.Nest) },
    { label: "Diet", value: guess.Diet, score: compareExact(guess.Diet, targetBird.Diet) }
  ];

  displayGuess(choice, tiles);

  if (choice === targetBird.Name || guessesRemaining === 0) {
    revealFinal();
  }
}

//-------------------------------------------------------
//  DISPLAY GUESS BLOCK
//-------------------------------------------------------
function displayGuess(name, tiles) {
  const history = document.getElementById("history");
  const row = document.createElement("div");
  row.className = "guess-row";

  const bird = birds.find(b => b.Name === name);

  row.innerHTML = `
    <div class="guess-container">

      <!-- IMAGE -->
      <div class="image-section">
        ${bird.Picture ? bird.Picture : "<div>No image</div>"}

        <button class="info-toggle">ℹ️</button>

        <div class="extra-info hidden">
          <p><b>${bird.Vname}</b> · <i>${bird.Sname}</i></p>

          ${bird["ML.Code"] ? `<p>🖼 Macaulay Library: <b>${bird["ML.Code"]}</b></p>` : ""}
          ${bird["eBird.Code"] ? `<p>🕊 eBird Checklist: <b>${bird["eBird.Code"]}</b></p>` : ""}

          <p style="margin-top:8px;">
            <a href="${bird.Doi}" target="_blank">🔗 Species Page (DOI)</a>
          </p>
        </div>
      </div>

      <!-- TILE GRID -->
      <div class="tile-grid"></div>

    </div>
  `;

  const grid = row.querySelector(".tile-grid");
  tiles.forEach(t => {
    grid.innerHTML += `
      <div class="tile ${t.score}">
        <div class="tile-content">
          <span class="attr-label">${t.label}</span>
          <span class="attr-value"><b>${t.value}</b></span>
        </div>
      </div>`;
  });

  row.querySelector(".info-toggle").addEventListener("click", () => {
    row.querySelector(".extra-info").classList.toggle("hidden");
  });

  history.prepend(row);
}

//-------------------------------------------------------
//  FINAL REVEAL (same layout as guess)
//-------------------------------------------------------
function revealFinal() {
  const container = document.getElementById("reveal");
  container.innerHTML = "";

  const row = document.createElement("div");
  row.className = "guess-row";
  row.style.background = "#2ECC71"; // green reveal

  const bird = targetBird;

  row.innerHTML = `
    <div class="guess-container">

      <div class="image-section">
        ${bird.Picture}

        <button class="info-toggle">ℹ️</button>

        <div class="extra-info hidden">
          <p><b>${bird.Vname}</b> · <i>${bird.Sname}</i></p>

          ${bird["ML.Code"] ? `<p>🖼 Macaulay Library: <b>${bird["ML.Code"]}</b></p>` : ""}
          ${bird["eBird.Code"] ? `<p>🕊 eBird Checklist: <b>${bird["eBird.Code"]}</b></p>` : ""}

          <p style="margin-top:8px;">
            <a href="${bird.Doi}" target="_blank">🔗 Species Page (DOI)</a>
          </p>
        </div>
      </div>

      <h2 class="reveal-title">🦜 The Mystery Bird Was:<br>${bird.Name}</h2>

      <div class="tile-grid"></div>

    </div>
  `;

  const tiles = [
    { label: "Taxa", value: `${bird.Order} > ${bird.Family}`, score: "" },
    { label: "Mass", value: `${bird.Mass} g`, score: "" },
    { label: "Beak Index", value: bird["Beak.Index"].toFixed(2), score: "" },
    { label: "Realm", value: bird.Realm, score: "" },
    { label: "Habitat", value: bird.Habitat, score: "" },
    { label: "Migration", value: bird.Migration, score: "" },
    { label: "Nest", value: bird.Nest, score: "" },
    { label: "Diet", value: bird.Diet, score: "" }
  ];

  const grid = row.querySelector(".tile-grid");
  tiles.forEach(t => {
    grid.innerHTML += `
      <div class="tile reveal-tile">
        <div class="tile-content">
          <span class="attr-label">${t.label}</span>
          <span class="attr-value"><b>${t.value}</b></span>
        </div>
      </div>`;
  });

  row.querySelector(".info-toggle").addEventListener("click", () => {
    row.querySelector(".extra-info").classList.toggle("hidden");
  });

  container.prepend(row);
}

//-------------------------------------------------------
//  AUTOCOMPLETE SYSTEM (with arrow-key navigation)
//-------------------------------------------------------
function setupAutocomplete() {
  const input = document.getElementById("guessInput");
  const wrapper = document.querySelector(".autocomplete-container");

  const list = document.createElement("div");
  list.id = "autocompleteList";
  list.className = "autocomplete-list";
  wrapper.appendChild(list);

  let activeIndex = -1;

  //---------------------------------------------------
  // RENDER AUTOCOMPLETE LIST
  //---------------------------------------------------
  function renderList(matches, q) {
    list.innerHTML = matches.map((b, i) => {
      const highlighted =
        q === ""
          ? b.Name
          : b.Name.replace(new RegExp(q, "gi"),
              m => `<span class="highlight">${m}</span>`);

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
  // FILTER LIST ON INPUT
  //---------------------------------------------------
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    input.dataset.fromSuggestion = "false";

    let matches;
    if (!q) {
      matches = birds.slice(0, 50);
    } else {
      matches = birds.filter(b =>
        b.Name.toLowerCase().includes(q)).slice(0, 50);
    }

    if (matches.length === 0) {
      list.style.display = "none";
      return;
    }

    renderList(matches, q);
  });

  //---------------------------------------------------
  // CLICK → SELECT
  //---------------------------------------------------
  list.addEventListener("click", e => {
    const item = e.target.closest(".autocomplete-item");
    if (!item) return;

    input.value = item.dataset.name;
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

    // QUICK CLEAR if value came from suggestion
    if (e.key === "Backspace" && input.dataset.fromSuggestion === "true") {
      e.preventDefault();
      input.value = "";
      input.dataset.fromSuggestion = "false";
      list.style.display = "none";
      return;
    }

    // ARROW DOWN: move highlight AND update input text
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!count) return;

      activeIndex = (activeIndex + 1) % count;

      items.forEach(el => el.classList.remove("active"));
      const activeItem = items[activeIndex];
      activeItem.classList.add("active");
      activeItem.scrollIntoView({ block: "nearest" });

      // show selected suggestion in the input
      input.value = activeItem.dataset.name;
      input.dataset.fromSuggestion = "true";
      return;
    }

    // ARROW UP: move highlight AND update input text
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!count) return;

      activeIndex = (activeIndex - 1 + count) % count;

      items.forEach(el => el.classList.remove("active"));
      const activeItem = items[activeIndex];
      activeItem.classList.add("active");
      activeItem.scrollIntoView({ block: "nearest" });

      // show selected suggestion in the input
      input.value = activeItem.dataset.name;
      input.dataset.fromSuggestion = "true";
      return;
    }

    // ENTER = always submit what's in the input box
    if (e.key === "Enter") {
      e.preventDefault();

      const finalChoice = input.value.trim();
      if (!finalChoice) return;

      handleGuess(finalChoice);

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
