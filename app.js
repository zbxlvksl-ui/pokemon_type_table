/* 포켓몬 타입 상성 계산기 (단일 페이지, 18타입) */

const TYPE_ORDER = [
  "Normal",
  "Fire",
  "Water",
  "Electric",
  "Grass",
  "Ice",
  "Fighting",
  "Poison",
  "Ground",
  "Flying",
  "Psychic",
  "Bug",
  "Rock",
  "Ghost",
  "Dragon",
  "Dark",
  "Steel",
  "Fairy",
];

// GitHub 공개 타입 차트 JSON (strengths: 2배, weaknesses: 0.5배, immunes: 0배)
// https://raw.githubusercontent.com/filipekiss/pokemon-type-chart/master/types.json
const TYPES_CHART = [
  { name: "Normal", immunes: ["Ghost"], weaknesses: ["Rock", "Steel"], strengths: [] },
  { name: "Fire", immunes: [], weaknesses: ["Fire", "Water", "Rock", "Dragon"], strengths: ["Grass", "Ice", "Bug", "Steel"] },
  { name: "Water", immunes: [], weaknesses: ["Water", "Grass", "Dragon"], strengths: ["Fire", "Ground", "Rock"] },
  { name: "Electric", immunes: ["Ground"], weaknesses: ["Electric", "Grass", "Dragon"], strengths: ["Water", "Flying"] },
  { name: "Grass", immunes: [], weaknesses: ["Fire", "Grass", "Poison", "Flying", "Bug", "Dragon", "Steel"], strengths: ["Water", "Ground", "Rock"] },
  { name: "Ice", immunes: [], weaknesses: ["Fire", "Water", "Ice", "Steel"], strengths: ["Grass", "Ground", "Flying", "Dragon"] },
  { name: "Fighting", immunes: ["Ghost"], weaknesses: ["Poison", "Flying", "Psychic", "Bug", "Fairy"], strengths: ["Normal", "Ice", "Rock", "Dark", "Steel"] },
  { name: "Poison", immunes: ["Steel"], weaknesses: ["Poison", "Ground", "Rock", "Ghost"], strengths: ["Grass", "Fairy"] },
  { name: "Ground", immunes: ["Flying"], weaknesses: ["Grass", "Bug"], strengths: ["Fire", "Electric", "Poison", "Rock", "Steel"] },
  { name: "Flying", immunes: [], weaknesses: ["Electric", "Rock", "Steel"], strengths: ["Grass", "Fighting", "Bug"] },
  { name: "Psychic", immunes: ["Dark"], weaknesses: ["Psychic", "Steel"], strengths: ["Fighting", "Poison"] },
  { name: "Bug", immunes: [], weaknesses: ["Fire", "Fighting", "Poison", "Flying", "Ghost", "Steel", "Fairy"], strengths: ["Grass", "Psychic", "Dark"] },
  { name: "Rock", immunes: [], weaknesses: ["Fighting", "Ground", "Steel"], strengths: ["Fire", "Ice", "Flying", "Bug"] },
  { name: "Ghost", immunes: ["Normal"], weaknesses: ["Dark"], strengths: ["Psychic", "Ghost"] },
  { name: "Dragon", immunes: ["Fairy"], weaknesses: ["Steel"], strengths: ["Dragon"] },
  { name: "Dark", immunes: [], weaknesses: ["Fighting", "Dark", "Fairy"], strengths: ["Psychic", "Ghost"] },
  { name: "Steel", immunes: [], weaknesses: ["Fire", "Water", "Electric", "Steel"], strengths: ["Ice", "Rock", "Fairy"] },
  { name: "Fairy", immunes: [], weaknesses: ["Fire", "Poison", "Steel"], strengths: ["Fighting", "Dragon", "Dark"] },
];

const KO_TYPE = {
  Normal: "노말",
  Fire: "불",
  Water: "물",
  Electric: "전기",
  Grass: "풀",
  Ice: "얼음",
  Fighting: "격투",
  Poison: "독",
  Ground: "땅",
  Flying: "비행",
  Psychic: "에스퍼",
  Bug: "벌레",
  Rock: "바위",
  Ghost: "고스트",
  Dragon: "드래곤",
  Dark: "악",
  Steel: "강철",
  Fairy: "페어리",
};

const TYPE_COLORS = {
  Normal: "#A8A77A",
  Fire: "#EE8130",
  Water: "#6390F0",
  Electric: "#F7D02C",
  Grass: "#7AC74C",
  Ice: "#96D9D6",
  Fighting: "#C22E28",
  Poison: "#A33EA1",
  Ground: "#E2BF65",
  Flying: "#A98FF3",
  Psychic: "#F95587",
  Bug: "#A6B91A",
  Rock: "#B6A136",
  Ghost: "#735797",
  Dragon: "#6F35FC",
  Dark: "#705746",
  Steel: "#B7B7CE",
  Fairy: "#D685AD",
};

const state = {
  selectedDefenders: [], // up to 2, values are english names in TYPE_ORDER
};

const FRAME_KEYS = ["x4", "x2", "x1", "x0p5", "x0p25", "immune"];
const iconEls = new Map(); // typeName -> DOM element

function hexToRgb(hex) {
  const raw = (hex || "").replace("#", "").trim();
  if (raw.length !== 6) return { r: 0, g: 0, b: 0 };
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return { r, g, b };
}

function getReadableTextColor(bgHex) {
  // 상대적으로 밝은 배경이면 어두운 글자, 어두운 배경이면 흰 글자
  const { r, g, b } = hexToRgb(bgHex);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.68 ? "#0b1220" : "#ffffff";
}

function getTypeEntry(typeName) {
  return TYPES_CHART.find((t) => t.name === typeName);
}

function effectiveness(attackerType, defenderType) {
  const entry = getTypeEntry(attackerType);
  if (!entry) return 1;
  if (entry.immunes && entry.immunes.includes(defenderType)) return 0;
  if (entry.strengths && entry.strengths.includes(defenderType)) return 2;
  if (entry.weaknesses && entry.weaknesses.includes(defenderType)) return 0.5;
  return 1;
}

function categorizeMultiplier(mult) {
  // 2타입 대상 시 가능한 배율: 4 / 2 / 1 / 0.5 / 0.25 / 0
  if (Math.abs(mult - 0) < 1e-9) return { key: "immune", label: "무효" };
  if (Math.abs(mult - 4) < 1e-9) return { key: "x4", label: "x4배" };
  if (Math.abs(mult - 2) < 1e-9) return { key: "x2", label: "x2배" };
  if (Math.abs(mult - 1) < 1e-9) return { key: "x1", label: "x1배" };
  if (Math.abs(mult - 0.5) < 1e-9) return { key: "x0p5", label: "0.5배" };
  if (Math.abs(mult - 0.25) < 1e-9) return { key: "x0p25", label: "0.25배" };
  // 예외 케이스(이론상 발생하지 않음)
  return { key: "x1", label: "x1배" };
}

function computeCategoryForMove(moveType) {
  const defenders = state.selectedDefenders;
  if (defenders.length === 0) return categorizeMultiplier(1);

  let mult = 1;
  for (const d of defenders) {
    mult *= effectiveness(moveType, d);
    if (mult === 0) break;
  }
  return categorizeMultiplier(mult);
}

function renderSlots() {
  const slot1 = document.getElementById("slot1");
  const slot2 = document.getElementById("slot2");

  if (!state.selectedDefenders[0]) {
    slot1.textContent = "선택 없음";
    slot1.style.background = "";
    slot1.style.borderColor = "";
    slot1.classList.add("slot-placeholder");
  } else {
    const t = state.selectedDefenders[0];
    slot1.textContent = KO_TYPE[t];
    slot1.classList.remove("slot-placeholder");
    slot1.style.background = TYPE_COLORS[t];
    slot1.style.borderColor = "rgba(255,255,255,.55)";
    slot1.style.color = getReadableTextColor(TYPE_COLORS[t]);
  }

  if (!state.selectedDefenders[1]) {
    slot2.textContent = "선택 없음";
    slot2.style.background = "";
    slot2.style.borderColor = "";
    slot2.classList.add("slot-placeholder");
  } else {
    const t = state.selectedDefenders[1];
    slot2.textContent = KO_TYPE[t];
    slot2.classList.remove("slot-placeholder");
    slot2.style.background = TYPE_COLORS[t];
    slot2.style.borderColor = "rgba(255,255,255,.55)";
    slot2.style.color = getReadableTextColor(TYPE_COLORS[t]);
  }
}

function typeButtonHTML(typeName) {
  const ko = KO_TYPE[typeName] ?? typeName;
  const bg = TYPE_COLORS[typeName] ?? "#94a3b8";
  const fg = getReadableTextColor(bg);
  return `
    <button
      type="button"
      class="type-btn"
      data-type="${typeName}"
      aria-pressed="false"
      style="background:${bg}; color:${fg}"
    >
      <span>${ko}</span>
    </button>
  `.trim();
}

function renderTypePicker() {
  const picker = document.getElementById("typePicker");
  picker.innerHTML = TYPE_ORDER.map(typeButtonHTML).join("");

  const buttons = picker.querySelectorAll(".type-btn");
  buttons.forEach((btn) => {
    const typeName = btn.getAttribute("data-type");
    btn.addEventListener("click", () => onTypeClicked(typeName));
  });
}

function updateSelectedUI() {
  const picker = document.getElementById("typePicker");
  const buttons = picker.querySelectorAll(".type-btn");
  buttons.forEach((btn) => {
    const typeName = btn.getAttribute("data-type");
    const isSelected = state.selectedDefenders.includes(typeName);
    btn.classList.toggle("selected", isSelected);
    btn.setAttribute("aria-pressed", isSelected ? "true" : "false");
  });
}

function buildEffectIcons() {
  const frameX1 = document.getElementById("frame-x1");
  frameX1.innerHTML = "";
  iconEls.clear();

  for (const typeName of TYPE_ORDER) {
    const koMove = KO_TYPE[typeName] ?? typeName;
    const bg = TYPE_COLORS[typeName] ?? "#94a3b8";
    const fg = getReadableTextColor(bg);

    const el = document.createElement("button");
    el.type = "button";
    el.className = "type-icon";
    el.dataset.type = typeName;
    el.textContent = koMove;
    el.style.background = bg;
    el.style.color = fg;

    iconEls.set(typeName, el);
    frameX1.appendChild(el);
  }
}

function getFrameBody(catKey) {
  return document.getElementById(`frame-${catKey}`);
}

function renderEffectFrames() {
  const emptyState = document.getElementById("emptyState");
  const effectFrames = document.getElementById("effectFrames");

  const isEmpty = state.selectedDefenders.length === 0;
  emptyState.style.display = isEmpty ? "block" : "none";
  effectFrames.classList.toggle("is-empty", isEmpty);

  // FLIP: old positions
  const oldRects = {};
  iconEls.forEach((el, typeName) => {
    oldRects[typeName] = el.getBoundingClientRect();
  });

  // Move icons into their category frames
  for (const k of FRAME_KEYS) {
    getFrameBody(k).innerHTML = "";
  }

  for (const moveType of TYPE_ORDER) {
    const cat = computeCategoryForMove(moveType);
    getFrameBody(cat.key).appendChild(iconEls.get(moveType));
  }

  // FLIP: animate deltas
  iconEls.forEach((el, typeName) => {
    const oldRect = oldRects[typeName];
    const newRect = el.getBoundingClientRect();
    const dx = oldRect.left - newRect.left;
    const dy = oldRect.top - newRect.top;

    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;

    el.style.transition = "transform 0s ease";
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    el.style.willChange = "transform";
  });

  requestAnimationFrame(() => {
    iconEls.forEach((el) => {
      el.style.transition = "transform 220ms ease";
      el.style.transform = "translate(0px, 0px)";
    });
  });
}

function onTypeClicked(typeName) {
  const existsIndex = state.selectedDefenders.indexOf(typeName);
  if (existsIndex !== -1) {
    // 토글: 이미 선택된 타입을 다시 누르면 제거
    state.selectedDefenders.splice(existsIndex, 1);
  } else {
    if (state.selectedDefenders.length < 2) {
      state.selectedDefenders.push(typeName);
    } else {
      // 2개 꽉 찬 경우: 먼저 선택된 슬롯을 교체
      state.selectedDefenders.shift();
      state.selectedDefenders.push(typeName);
    }
  }

  renderSlots();
  updateSelectedUI();
  renderEffectFrames();
}

function resetSelection() {
  state.selectedDefenders = [];
  renderSlots();
  updateSelectedUI();
  renderEffectFrames();
}

function init() {
  renderSlots();
  renderTypePicker();
  updateSelectedUI();
  buildEffectIcons();
  renderEffectFrames();

  const resetBtn = document.getElementById("resetBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", resetSelection);
  }
}

window.addEventListener("DOMContentLoaded", init);

