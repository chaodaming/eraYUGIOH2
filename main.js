let db, allCards = [], mainDeckCards = [], extraDeckCards = [], selectedCard = null;
let currentDeckTab = "main";
const typeColors = {
  "通常罠": "#B766AD", "永続罠": "#B766AD", "カウンター罠": "#B766AD",
  "通常魔法": "#00BB00", "永続魔法": "#00BB00", "装備魔法": "#00BB00",
  "儀式魔法": "#00BB00", "フィールド": "#00BB00", "速攻魔法": "#00BB00",
  "効果モン": "#D26900", "通常モン": "#FFC78E", "融合": "#E800E8",
  "儀式": "#6A6AFF", "シンクロ": "#FCFCFC", "エクシーズ": "#9D9D9D", "リンク": "#2894FF",
  "超次元": "#EA0000"
};
const extraTypes = ["融合", "シンクロ", "エクシーズ", "リンク", "超次元"];

init();

async function init() {
  const SQL = await initSqlJs({ locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}` });
  const response = await fetch("cards.db");
  const buffer = await response.arrayBuffer();
  db = new SQL.Database(new Uint8Array(buffer));
  loadCards();
}

function loadCards() {
  const res = db.exec(`
    SELECT c.*, GROUP_CONCAT(cat.category) as categories
    FROM cards c
    LEFT JOIN card_categories cat ON c.id = cat.card_id
    GROUP BY c.id
  `);
  const stmt = res[0];
  for (const row of stmt.values) {
    const obj = {};
    stmt.columns.forEach((col, i) => obj[col] = row[i]);
    obj.categories = obj.categories ? obj.categories.split(',') : [];
    allCards.push(obj);
  }
  allCards.sort((a, b) => Number(a.id) - Number(b.id));
  renderFilterPanel();
  renderCardList();
  renderDeck();
}

function renderCardList() {
  const container = document.getElementById("card-list");
  container.innerHTML = "";
  let filtered = applyFiltersAndSearch();

  // 按目前 deck 分頁過濾卡片類型
  if (currentDeckTab === 'main') {
    filtered = filtered.filter(c => !extraTypes.includes(c.種類));
  } else {
    filtered = filtered.filter(c => extraTypes.includes(c.種類));
  }

  filtered.forEach(card => {
    const el = document.createElement("div");
    el.className = "card-item";
    el.draggable = true;
    el.textContent = card.略称;
    el.style.color = typeColors[card.種類] || "#fff";
    if (selectedCard?.id === card.id) el.classList.add("selected");
    el.ondragstart = e => handleDragStart(e, card.id);
    el.onclick = () => {
      selectedCard = card;
      renderCardInfo();
      renderDeck();
      renderCardList();
    };
    container.appendChild(el);
  });

  document.getElementById("result-count").textContent = `(${filtered.length})`;
}

function renderCardInfo() {
  const c = selectedCard;
  if (!c) return;
  const set = (id, val) => document.getElementById(id).textContent = val || "";
  set("card-id", c.id);
  set("card-name", c.名前 || "");
  set("card-shortname", c.略称 || "");
  set("card-type", c.種類 || "");
  set("card-attr", c.属性 || "");
  set("card-race", c.種族 || "");
  set("card-level", c.レベル || "");
  set("card-atk", c.攻撃力 || "");
  set("card-def", c.守備力 || "");
  set("card-gender", c.性別 || "");
  const descHTML = (c.説明 || "")
    .replace(/「(.*?)」/g, (_, word) => {
      const encoded = encodeURIComponent(word);
      return `<a href="#" class="desc-link" data-word="${encoded}">「${word}」</a>`;
    })
    .replace(/\n/g, "<br>");

  document.getElementById("card-desc").innerHTML = descHTML;

  const catContainer = document.getElementById("card-categories");
  catContainer.innerHTML = "";
  c.categories.forEach(cat => {
    const btn = document.createElement("button");
    btn.textContent = cat;
    btn.onclick = () => {
      document.getElementById("search-text").value = cat;
      renderCardList();
    };
    catContainer.appendChild(btn);
  });

  const control = document.getElementById("card-controls");
  control.innerHTML = "";
  const plus = document.createElement("button");
  plus.textContent = "+";
  plus.onclick = () => {
    addToCurrentDeck(c.id);
  };
  const minus = document.createElement("button");
  minus.textContent = "−";
  minus.onclick = () => {
    const deck = currentDeckList();
    const idx = deck.findIndex(x => x.id === c.id);
    if (idx !== -1) {
      deck.splice(idx, 1);
      renderDeck();
    }
  };
  control.appendChild(minus);
  control.appendChild(plus);

  document.querySelectorAll(".desc-link").forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault();
      const word = decodeURIComponent(e.currentTarget.dataset.word);
      document.getElementById("search-text").value = word;
      renderCardList();
    });
  });
}

function renderDeck() {
  const panel = document.getElementById("deck-list");
  panel.innerHTML = "";
  const deck = currentDeckList();
  deck.sort((a, b) => Number(a.id) - Number(b.id)); // 排序
  const title = document.getElementById("deck-title");
  title.textContent = currentDeckTab === "main" ? "主デッキ" : "EXデッキ";

  const count = document.createElement("div");
  count.textContent = `枚数: ${deck.length}/${currentDeckTab === "main" ? 40 : 15}`;
  title.appendChild(count);

  deck.forEach(card => {
    const el = document.createElement("div");
    el.className = "card-item";
    el.draggable = true;
    el.textContent = card.名前;
    el.style.color = typeColors[card.種類] || "#fff";
    if (selectedCard?.id === card.id) el.classList.add("selected");
    el.ondragstart = e => handleDeckDragStart(e, card.id);
    el.onclick = () => {
      selectedCard = card;
      renderCardInfo();
      renderDeck();
      renderCardList();
    };
    panel.appendChild(el);
  });
}

function applyFiltersAndSearch() {
  const categoryText = document.getElementById("filter-category").value.trim();
  const filters = {
    種類: getChecked("filter-種類"),
    属性: getChecked("filter-属性"),
    種族: getChecked("filter-種族"),
    レベル: getChecked("filter-レベル"),
    性別: getChecked("filter-性別")
  };
  const search = document.getElementById("search-text")?.value.trim();
  return allCards.filter(card => {
    for (let key in filters) {
      if (filters[key].length && !filters[key].includes(String(card[key]))) return false;
    }
    if (categoryText && !card.categories.some(c => c.includes(categoryText))) return false;
    if (search) {
      const target = [
        card.id,
        card.名前,
        card.略称,
        card.説明,
        ...(card.categories || [])
      ].join(" ");
      if (!target.includes(search)) return false;
    }
    return true;
  });
}

function renderFilterPanel() {
  const filters = {
    "種類": [...new Set(allCards.map(c => c.種類))],
    "属性": [...new Set(allCards.map(c => c.属性))],
    "種族": [...new Set(allCards.map(c => c.種族))],
    "レベル": [...new Set(allCards.map(c => c.レベル))],
    "性別": [...new Set(allCards.map(c => c.性別))]
  };
  const filterDiv = document.getElementById("filters");
  filterDiv.innerHTML = "";
  for (let key in filters) {
    const fs = document.createElement("fieldset");
    const lg = document.createElement("legend");
    lg.textContent = key;
    fs.appendChild(lg);
    filters[key]
      .filter(x => x !== null && x !== undefined)
      .sort((a, b) => (typeof a === 'number' && typeof b === 'number') ? a - b : String(a).localeCompare(String(b), 'ja'))
      .forEach(val => {
        const label = document.createElement("label");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = val;
        cb.className = `filter-${key}`;
        cb.onchange = renderCardList;
        label.appendChild(cb);
        label.append(` ${val}`);
        fs.appendChild(label);
      });
    filterDiv.appendChild(fs);
  }
}

function getChecked(cls) {
  return [...document.querySelectorAll(`.${cls}:checked`)].map(cb => cb.value);
}

function toggleFilter() {
  document.getElementById("filter-panel").classList.toggle("collapsed");
}
function toggleSearch() {
  document.getElementById("search-panel").classList.toggle("collapsed");
}
function resetFilters() {
  document.querySelectorAll("#filters input[type='checkbox']").forEach(cb => cb.checked = false);
  document.getElementById("filter-category").value = "";
  renderCardList();
}
function resetSearch() {
  document.getElementById("search-text").value = "";
  renderCardList();
}

function switchDeckTab(tab) {
  currentDeckTab = tab;
  renderDeck();
  renderCardList();
}

function currentDeckList() {
  return currentDeckTab === "main" ? mainDeckCards : extraDeckCards;
}

function canAddToCurrentDeck(card) {
  const deck = currentDeckList();
  const limit = currentDeckTab === "main" ? 40 : 15;
  // 總張數限制
  if (deck.length >= limit) return false;
  // 主／EX 類型限制
  if (currentDeckTab === "main" && extraTypes.includes(card.種類)) return false;
  if (currentDeckTab === "extra" && !extraTypes.includes(card.種類)) return false;
  // 單卡最多三張限制
  const sameCardCount = deck.filter(c => c.id === card.id).length;
  if (sameCardCount >= 3) return false;
  // 六位數以上的id屬於衍伸物，不能放入
  if (card.id >= 100000) return false;
  return true;
}

// 🧲 拖曳邏輯
function handleDragStart(event, cardId) {
  console.log('drag from plain');
  event.dataTransfer.setData("text/plain", JSON.stringify({
    id: cardId,
    source: "right"
  }));
}
function handleDeckDragStart(event, cardId) {
  console.log('drag from deck');
  event.dataTransfer.setData("text/plain", JSON.stringify({
    id: cardId,
    source: "mid"
  }));
}
function allowDrop(event) {
  event.preventDefault();
}

function handleDrop(event) {
  const dropElement = [...document.querySelector('.main').children]
    .find(div => div.contains(event.target));
  let dropZone = null;
  if (dropElement) {
    dropZone = dropElement.className;
  } else {
    return;
  }
  event.preventDefault();
  const data = JSON.parse(event.dataTransfer.getData("text/plain"));
  let dragFrom = data.source;
  let cardId = data.id;
  console.log(`drag from ${dragFrom} to ${dropZone}`);
  // 來自於right, 放置於mid
  if (dragFrom === "right" && dropZone === "panel middle") {
    addToCurrentDeck(cardId);
  }
  else if (dragFrom === "mid" && dropZone !== "panel middle") {
    removeFromDeck(cardId);
  }
}

function removeFromDeck(cardId) {
  const list = currentDeckList();
  const idx = list.findIndex(c => c.id === cardId);
  if (idx !== -1) {
    list.splice(idx, 1);
    renderDeck();
  }
}

function addToCurrentDeck(cardId) {
  const card = allCards.find(c => c.id === cardId);
  if (card && canAddToCurrentDeck(card)) {
    currentDeckList().push(card);
    renderDeck();
  }
}

// 匯出功能
function exportDeck() {
  console.log('export');
  const lines = [];
  const main = mainDeckCards.map(c => c.id);
  const extra = extraDeckCards.map(c => c.id);
  for (let i = 0; i < 40; i++) lines.push(main[i] || -1);
  for (let i = 0; i < 5; i++) lines.push(""); // 空行
  for (let i = 0; i < 15; i++) lines.push(extra[i] || -1);
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "deck.txt";
  a.click();
  URL.revokeObjectURL(url);
}

// 匯入功能
function importDeck() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".txt";

  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const lines = reader.result.split(/\r?\n/);
      const mainIds = lines.slice(0, 40).filter(id => id !== "-1");
      const extraIds = lines.slice(45, 60).filter(id => id !== "-1");

      mainDeckCards = mainIds.map(id => allCards.find(c => String(c.id) === id)).filter(Boolean);
      extraDeckCards = extraIds.map(id => allCards.find(c => String(c.id) === id)).filter(Boolean);

      renderDeck();
      renderCardList();
    };
    reader.readAsText(file);
  };

  input.click();
}

document.addEventListener("mousedown", (event) => {
  const filterPanel = document.getElementById("filter-panel");
  const searchPanel = document.getElementById("search-panel");

  // 忽略 filter panel 本身與觸發按鈕
  const clickedFilter = filterPanel.contains(event.target) || event.target.id === "filter-toggle";
  const clickedSearch = searchPanel.contains(event.target) || event.target.id === "search-toggle";

  if (!clickedFilter) filterPanel.classList.add("collapsed");
  if (!clickedSearch) searchPanel.classList.add("collapsed");
});