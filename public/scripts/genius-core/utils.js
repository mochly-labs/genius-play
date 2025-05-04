const get = (selector) => document.querySelector(selector);
const getById = (id) => document.getElementById(id);
const wsPort =
  window.location.port === "5050"
    ? "8080"
    : window.location.port === "8080"
    ? "8080"
    : "8080";
const wsHost =
  window.location.port === "127.0.0.1:8080"
    ? "127.0.0.1"
    : window.location.hostname;

const wsUrl = `ws://${wsHost}:${wsPort}/ws`;
const httpUrl = wsUrl
  .replace(/^wss?:\/\//, (m) => (m === "wss://" ? "https://" : "http://"))
  .replace("/ws", "");

function createAlternative(name, image, id) {
  const alternativeWrapper = document.createElement("div");
  alternativeWrapper.className =
    "alternative-wrapper flex flex-col items-center";

  const img = document.createElement("img");
  img.src = image;
  img.alt = `Imagem da Alternativa`;
  img.className = "alternative-img w-24 h-24 object-cover rounded-lg mb-2";
  const button = document.createElement("button");
  button.id = `alternative-${id}`;
  button.className =
    "alternative-btn bg-black/40 backdrop-blur-sm text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-gray-600 transition-all text-lg";
  button.textContent = `${name}`;

  if (img && img.src && !img.src.endsWith("/null"))
    alternativeWrapper.appendChild(img);
  alternativeWrapper.appendChild(button);

  return alternativeWrapper;
}

function updateTeamSelect(value) {
  const redArrow = getById("team-red-arrow");
  const blueArrow = getById("team-blue-arrow");
  const selectText = getById("team-select-text");

  switch (value) {
    case 0:
      redArrow.style.display = "block";
      blueArrow.style.display = "block";
      selectText.style.marginLeft = "0";
      selectText.style.marginRight = "0";
      break;
    case 1:
      redArrow.style.display = "block";
      blueArrow.style.display = "none";
      selectText.style.marginLeft = "auto";
      selectText.style.marginRight = "0";
      break;
    case 2:
      redArrow.style.display = "none";
      blueArrow.style.display = "block";
      selectText.style.marginLeft = "0";
      selectText.style.marginRight = "auto";
      break;
    case 3:
      redArrow.style.display = "none";
      blueArrow.style.display = "none";
      selectText.style.marginLeft = "auto";
      selectText.style.marginRight = "auto";
      break;
    default:
      console.error("Invalid value passed to updateTeamSelect");
  }
}
function shuffle(array, seed) {
  const result = [...array]; // clone to not mutate
  const prng = mulberry32(xmur3(seed)); // seeded RNG

  // Fisher-Yates shuffle using our PRNG
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
function mulberry32(seedFunc) {
  let a = seedFunc();
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function generate() {
  const entropia = [];

  // Tempo
  entropia.push(Date.now().toString(36));
  entropia.push(performance.now().toString(36));

  // Elementos da página
  const tags = [...document.querySelectorAll("*")]
    .map((e) => e.tagName)
    .join("");
  entropia.push(tags);

  // Tamanho da página
  entropia.push(window.innerWidth);
  entropia.push(window.innerHeight);

  // Posição do mouse (se tiver sido movido)
  document.addEventListener(
    "mousemove",
    (e) => {
      entropia.push(e.clientX, e.clientY);
    },
    { once: true }
  );

  // Um pouco de caos com random
  for (let i = 0; i < 10; i++) {
    entropia.push(Math.random().toString(36).slice(2));
  }

  // Crypto randomness se possível
  let randomPart = "";
  if (window.crypto && crypto.getRandomValues) {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    randomPart = Array.from(array)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // Junta tudo e embaralha
  const baguncinha = entropia.join("|") + randomPart;

  // Hash rápido estilo caseiro só pra condensar
  let hash = 0n;
  for (let i = 0; i < baguncinha.length; i++) {
    hash ^= BigInt(baguncinha.charCodeAt(i)) << BigInt(i % 64);
  }

  // Gera a string final com base no hash + entropia
  let resultado = "";
  const base =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
  const seed = hash.toString(36) + baguncinha;

  for (let i = 0; i < 64; i++) {
    const code = seed.charCodeAt(i % seed.length);
    const rnd = (code * (i + 1) + i ** 3) % base.length;
    resultado += base[rnd];
  }


  return shuffle(resultado, "ma oe" + Math.random()).join("");
}