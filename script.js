/* =========================================================
   ENGLISH ADVENTURE – Lógica del juego (JavaScript puro)
     1. Configuración
     2. Escenarios, misiones y desafíos  ← aquí se agrega contenido nuevo
     3. Guardado con LocalStorage
     4. Utilidades y efectos
     5. Sonido (Web Audio) y voz (SpeechSynthesis)
     6. Inicio y creación del aventurero
     7. Mapa, panel de misiones y tabla de progreso
     8. Motor de la misión (vidas, temporizador, recompensas)
     9. Tipos de desafío
    10. Resultados, derrota y victoria
    11. Eventos e inicio
   ========================================================= */
'use strict';

/* ---------- 1. Configuración ---------- */
const STORAGE_KEY = 'englishAdventure.v1';
const MAX_LIVES = 5;
const LIFE_PRICE = 30;            // monedas que cuesta una vida
const XP_CORRECT = 10;            // experiencia por respuesta correcta
const XP_MISSION = 30;            // experiencia por misión cumplida
const COINS_MISSION = 20;         // monedas por misión cumplida (primera vez)
const COINS_PERFECT = 10;         // extra por misión sin errores
const COINS_REPEAT = 5;           // monedas al repetir una misión ya cumplida
const TIME_SHORT = 25;            // segundos por desafío en misiones con tiempo
const TIME_LONG = 45;             // segundos para relacionar u ordenar oraciones
const AVATARS = ['🤠', '🧙‍♂️', '🦸‍♀️', '🥷', '🧑‍🚀', '🧝‍♀️'];
const MODE_LABELS = { explorer: 'Explorador (Primaria)', expert: 'Experto (Secundaria)' };
const MODES = Object.keys(MODE_LABELS);

/* ---------- 2. Escenarios, misiones y desafíos ----------
   CÓMO AGREGAR CONTENIDO
   • Desafío nuevo: añade una línea dentro de "challenges" con una de estas funciones:
       mc('Pregunta', 'correcta', ['mala 1', 'mala 2', 'mala 3'], { opciones })
          opciones: img (emoji), color ('#rrggbb'), sub (ayuda en español),
                    text (lectura), label ('Acertijo', 'Lectura', 'Traduce'…), say (frase a pronunciar)
       word('palabra', 'pista')              → palabra escondida: hay que ordenar todas sus letras
       word('palabra', 'pista', [1, 3])      → completar: faltan las letras en esas posiciones (la primera es 0)
       match([['🐻', 'bear'], ['🦉', 'owl']]) → relacionar parejas
       order('Oración en español.', 'Sentence in English.') → ordenar las palabras
   • Misión nueva: añade { name, es, timed, challenges: [...] } en la lista de la modalidad.
     Con timed: true la misión tiene temporizador. Se cumple acertando 2 de cada 3 desafíos.
   • Escenario nuevo: copia un bloque completo de SCENARIOS, cambia su id (único), textos,
     posición en el mapa (x, y en porcentaje) y misiones. Se desbloquea al completar el anterior
     y el último de la lista es el que entrega el tesoro.                                        */
const mc = (q, a, others, extra = {}) => ({ t: 'mc', q, a, opts: [a, ...others], ...extra });
const word = (en, hint, blanks) => ({ t: 'word', en, hint, blanks });
const match = (pairs) => ({ t: 'match', pairs });
const order = (es, en) => ({ t: 'order', es, en });

const SCENARIOS = [
  {
    id: 'forest', name: 'The Magic Forest', es: 'El bosque mágico', short: 'Forest',
    theme: 'Animals and Colors', icon: '🌲', x: 16, y: 70,
    badge: '🦊', badgeName: 'Forest Guardian',
    story: 'Los animales del bosque guardan la primera pista del tesoro. Solo hablan inglés.',
    missions: {
      explorer: [
        { name: 'Forest friends', es: 'Identifica animales y colores.', timed: false, challenges: [
          mc('What animal is this?', 'fox', ['wolf', 'bear', 'rabbit'], { img: '🦊', sub: '¿Qué animal es?' }),
          mc('What color is this?', 'green', ['red', 'blue', 'brown'], { color: '#2f8f4e', sub: '¿Qué color es?' }),
          match([['🐻', 'bear'], ['🦉', 'owl'], ['🐸', 'frog'], ['🦋', 'butterfly']]),
        ] },
        { name: 'Hidden words', es: 'Descubre las palabras escondidas antes de que se acabe el tiempo.', timed: true, challenges: [
          word('bird', '🐦 pájaro'),
          mc('¿Cómo se dice «amarillo» en inglés?', 'yellow', ['orange', 'purple', 'white'], { label: 'Traduce' }),
          word('rabbit', '🐰 conejo', [1, 4]),
        ] },
      ],
      expert: [
        { name: 'Voices of the forest', es: 'Resuelve preguntas de vocabulario sobre el bosque.', timed: false, challenges: [
          mc('Which animal is nocturnal and hunts at night?', 'owl', ['deer', 'squirrel', 'duck']),
          mc('I am the color of the night sky without stars. What color am I?', 'black', ['white', 'yellow', 'pink'], { label: 'Acertijo' }),
          word('squirrel', '🐿️ ardilla'),
        ] },
        { name: 'The fox trail', es: 'Lee, traduce y construye oraciones contra el reloj.', timed: true, challenges: [
          mc('When does the fox hunt?', 'At dusk', ['At noon', 'In the morning', 'All day'],
            { label: 'Lectura', text: 'The fox has orange fur and a white tail tip. It hunts small animals at dusk.' }),
          order('El lobo gris vive en el bosque.', 'The gray wolf lives in the forest.'),
          mc('¿Cómo se dice «venado» en inglés?', 'deer', ['bear', 'beaver', 'eagle'], { label: 'Traduce' }),
        ] },
      ],
    },
  },
  {
    id: 'city', name: 'The Lost City', es: 'La ciudad perdida', short: 'City',
    theme: 'Numbers and Objects', icon: '🏛️', x: 36, y: 28,
    badge: '🗝️', badgeName: 'Key Keeper',
    story: 'Entre las ruinas hay números tallados y objetos antiguos. Descifra sus nombres para abrir el paso.',
    missions: {
      explorer: [
        { name: 'Count the ruins', es: 'Cuenta, identifica objetos y resuelve un acertijo.', timed: false, challenges: [
          mc('How many keys?', 'four', ['three', 'five', 'six'], { img: '🔑🔑🔑🔑', sub: '¿Cuántas llaves hay?' }),
          mc('What is this?', 'clock', ['door', 'lamp', 'chair'], { img: '⏰', sub: '¿Qué es esto?' }),
          mc('I have pages and you read me. What am I?', 'a book', ['a ball', 'a bed', 'a hat'],
            { label: 'Acertijo', sub: 'Tengo páginas y me lees. ¿Qué soy?' }),
        ] },
        { name: 'The secret code', es: 'Completa y traduce las palabras del código secreto.', timed: true, challenges: [
          word('seven', '7 siete', [1, 3]),
          mc('¿Cómo se dice «llave» en inglés?', 'key', ['map', 'box', 'coin'], { label: 'Traduce', img: '🔑' }),
          word('door', '🚪 puerta'),
        ] },
      ],
      expert: [
        { name: 'Riddles of stone', es: 'Resuelve acertijos y completa palabras.', timed: false, challenges: [
          mc('I have hands but I cannot clap. What am I?', 'a clock', ['a glove', 'a statue', 'a mirror'], { label: 'Acertijo' }),
          mc('Which number is “three hundred and fifteen”?', '315', ['350', '3015', '513']),
          word('umbrella', '☂️ paraguas', [0, 3, 6]),
        ] },
        { name: 'The tower', es: 'Traduce y construye oraciones antes de que caiga la torre.', timed: true, challenges: [
          mc('¿Cómo se dice «escalera» en inglés?', 'stairs', ['streets', 'walls', 'roofs'], { label: 'Traduce' }),
          order('Hay doce ventanas en la torre.', 'There are twelve windows in the tower.'),
          mc('The more you take, the more you leave behind. What are they?', 'footsteps', ['coins', 'photos', 'keys'], { label: 'Acertijo' }),
        ] },
      ],
    },
  },
  {
    id: 'food', name: 'The Food Kingdom', es: 'El reino de la comida', short: 'Food',
    theme: 'Food and Fruits', icon: '🍉', x: 58, y: 68,
    badge: '👨‍🍳', badgeName: 'Royal Chef',
    story: 'El rey solo deja pasar a quien conozca los alimentos de su mercado.',
    missions: {
      explorer: [
        { name: 'The royal market', es: 'Identifica alimentos y relaciónalos con sus nombres.', timed: false, challenges: [
          mc('What fruit is this?', 'banana', ['apple', 'pear', 'lemon'], { img: '🍌', sub: '¿Qué fruta es?' }),
          match([['🍞', 'bread'], ['🧀', 'cheese'], ['🥛', 'milk'], ['🥚', 'egg']]),
          mc('I like ___.', 'pizza', ['pencil', 'purple', 'puppy'],
            { label: 'Completa la oración', img: '🍕', sub: 'Me gusta la pizza.', say: 'I like pizza.' }),
        ] },
        { name: "The king's dinner", es: 'Prepara la cena del rey antes de que se enfríe.', timed: true, challenges: [
          word('apple', '🍎 manzana', [1, 3]),
          mc('What is red and sweet?', 'strawberry', ['lemon', 'carrot', 'bread'], { sub: '¿Qué es rojo y dulce?' }),
          mc('The banana is ___.', 'yellow', ['blue', 'black', 'pink'],
            { label: 'Completa la oración', img: '🍌', sub: 'El banano es amarillo.', say: 'The banana is yellow.' }),
        ] },
      ],
      expert: [
        { name: 'The spice road', es: 'Demuestra tu vocabulario de cocina.', timed: false, challenges: [
          mc('Which word is a vegetable?', 'spinach', ['peach', 'plum', 'cherry']),
          match([['harina', 'flour'], ['cuchara', 'spoon'], ['postre', 'dessert'], ['hervir', 'boil']]),
          mc("Complete: I'd like ___ orange juice, please.", 'some', ['any', 'a', 'many'],
            { label: 'Completa la oración', say: "I'd like some orange juice, please." }),
        ] },
        { name: 'The royal recipe', es: 'Lee la receta y termina el plato a tiempo.', timed: true, challenges: [
          mc('What does the chef NOT put in the soup?', 'Sugar', ['Salt', 'Butter', 'Pepper'],
            { label: 'Lectura', text: 'The chef adds salt, pepper and a little butter to the soup. He never uses sugar.' }),
          order('Ella está cocinando arroz con pollo.', 'She is cooking rice with chicken.'),
          word('vegetable', '🥦 verdura', [1, 4, 7]),
        ] },
      ],
    },
  },
  {
    id: 'castle', name: 'The Grammar Castle', es: 'El castillo de la gramática', short: 'Castle',
    theme: 'Grammar', icon: '🏰', x: 78, y: 28,
    badge: '🛡️', badgeName: 'Grammar Knight',
    story: 'Las puertas del castillo se abren solo con oraciones bien construidas.',
    missions: {
      explorer: [
        { name: 'The castle gate', es: 'Completa oraciones y reconoce los verbos.', timed: false, challenges: [
          mc('I ___ a student.', 'am', ['is', 'are', 'be'], { label: 'Completa la oración', sub: 'Yo soy estudiante.', say: 'I am a student.' }),
          mc('Which word is an action?', 'jump', ['table', 'green', 'dog'], { label: 'Busca el verbo', img: '🤸', sub: '¿Cuál palabra es una acción?' }),
          order('Ella es mi amiga.', 'She is my friend.'),
        ] },
        { name: 'The throne room', es: 'Ordena palabras y elige el verbo correcto con tiempo.', timed: true, challenges: [
          mc('He ___ a red ball.', 'has', ['have', 'are', 'am'], { label: 'Completa la oración', sub: 'Él tiene una pelota roja.', say: 'He has a red ball.' }),
          order('Me gustan los gatos.', 'I like cats.'),
          mc('They ___ happy.', 'are', ['is', 'am', 'be'], { label: 'Completa la oración', sub: 'Ellos están felices.', say: 'They are happy.' }),
        ] },
      ],
      expert: [
        { name: 'The hall of tenses', es: 'Elige el tiempo verbal correcto e identifica verbos.', timed: false, challenges: [
          mc('Yesterday we ___ to the museum.', 'went', ['go', 'goes', 'going'], { label: 'Tiempo verbal', say: 'Yesterday we went to the museum.' }),
          mc('Find the verb: “The knight quickly opened the heavy door.”', 'opened', ['quickly', 'heavy', 'knight'], { label: 'Busca el verbo' }),
          order('Ella no ha terminado su tarea.', "She hasn't finished her homework."),
        ] },
        { name: "The dragon's test", es: 'Supera la prueba del dragón antes de que despierte.', timed: true, challenges: [
          mc('Look! The dragon ___ over the castle right now.', 'is flying', ['flies', 'flew', 'fly'],
            { label: 'Tiempo verbal', say: 'Look! The dragon is flying over the castle right now.' }),
          mc('If it rains tomorrow, we ___ at home.', 'will stay', ['stayed', 'stays', 'staying'],
            { label: 'Tiempo verbal', say: 'If it rains tomorrow, we will stay at home.' }),
          order('¿Dónde vivías cuando eras niño?', 'Where did you live when you were a child?'),
        ] },
      ],
    },
  },
  {
    id: 'treasure', name: 'The Final Treasure', es: 'El tesoro final', short: 'Treasure',
    theme: 'English Challenge', icon: '💎', x: 88, y: 74,
    badge: '👑', badgeName: 'Treasure Hunter',
    story: 'El cofre está cerca. Usa todo lo que aprendiste para abrirlo.',
    missions: {
      explorer: [
        { name: 'The treasure island', es: 'Vocabulario, lectura y una palabra escondida.', timed: false, challenges: [
          mc('¿Cómo se dice «tesoro» en inglés?', 'treasure', ['island', 'pirate', 'ship'], { label: 'Traduce', img: '💎' }),
          mc('What color is the boat?', 'Blue', ['Red', 'Green', 'Yellow'],
            { label: 'Lectura', text: 'Tom has a blue boat. He goes to the island.', sub: '¿De qué color es el bote?' }),
          word('map', '🗺️ mapa'),
        ] },
        { name: 'Open the chest', es: 'Último reto: abre el cofre antes de que suba la marea.', timed: true, challenges: [
          order('Tengo una llave grande.', 'I have a big key.'),
          mc('What is the opposite of “big”?', 'small', ['tall', 'fast', 'happy'], { sub: '¿Qué es lo contrario de «grande»?' }),
          mc('How many coins?', 'ten', ['eight', 'nine', 'seven'], { img: '🪙🪙🪙🪙🪙🪙🪙🪙🪙🪙', sub: '¿Cuántas monedas hay?' }),
        ] },
      ],
      expert: [
        { name: 'The old map', es: 'Comprensión lectora, traducción y vocabulario.', timed: false, challenges: [
          mc('Where was the cave?', 'Behind a waterfall', ['On top of a mountain', 'Under an old bridge', 'Next to the map'],
            { label: 'Lectura', text: 'The explorers followed the old map for three days. On the fourth day, they finally found a cave behind a waterfall.' }),
          mc('¿Cuál es la mejor traducción de «Nunca he visto un tesoro»?', 'I have never seen a treasure.',
            ['I never saw the treasure yesterday.', 'I did not see a treasure.', 'I am never seeing a treasure.'], { label: 'Traduce' }),
          word('adventure', '🧭 aventura'),
        ] },
        { name: 'Open the chest', es: 'Último reto: abre el cofre antes de que suba la marea.', timed: true, challenges: [
          order('Encontraremos el tesoro antes del atardecer.', 'We will find the treasure before sunset.'),
          mc('Which word is a synonym of “brave”?', 'courageous', ['careful', 'curious', 'generous']),
          mc('Choose the correct sentence.', 'She has lived here since 2020.',
            ['She have lived here since 2020.', 'She has lived here for 2020.', 'She is live here since 2020.']),
        ] },
      ],
    },
  },
];

/* ---------- 3. Guardado con LocalStorage ---------- */
function defaultSave() {
  return {
    started: false, name: 'Aventurero', avatar: AVATARS[0], mode: 'explorer',
    lives: MAX_LIVES, coins: 0, stars: 0, xp: 0, sound: true, pos: 0,
    done: { explorer: {}, expert: {} },        // done[modo][idEscenario] = [true, false…] por misión
  };
}

/** Lee la partida guardada y la valida; lo que falte toma su valor inicial. */
function loadSave() {
  const base = defaultSave();
  try {
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!d || typeof d !== 'object') return base;
    base.started = d.started === true;
    if (typeof d.name === 'string' && d.name.trim()) base.name = d.name.trim().slice(0, 14);
    if (AVATARS.includes(d.avatar)) base.avatar = d.avatar;
    if (MODES.includes(d.mode)) base.mode = d.mode;
    const num = (v, min, max) => Math.min(max, Math.max(min, Math.floor(Number(v)) || 0));
    base.lives = num(d.lives, 0, MAX_LIVES);
    base.coins = num(d.coins, 0, 1e9);
    base.stars = num(d.stars, 0, 1e9);
    base.xp = num(d.xp, 0, 1e9);
    base.pos = num(d.pos, 0, SCENARIOS.length - 1);
    base.sound = d.sound !== false;
    MODES.forEach((m) => SCENARIOS.forEach((s) => {
      const src = d.done && d.done[m] && d.done[m][s.id];
      if (Array.isArray(src)) base.done[m][s.id] = src.map(Boolean);
    }));
    if (base.lives === 0) base.lives = MAX_LIVES;     // nunca se continúa una partida sin vidas
  } catch (e) { /* datos dañados o almacenamiento bloqueado */ }
  return base;
}

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(save)); } catch (e) { /* sin almacenamiento */ }
}

let save = loadSave();

/* Consultas de progreso (siempre para la modalidad actual) */
const missionsOf = (s) => SCENARIOS[s].missions[save.mode];
const missionDone = (s, m) => Boolean((save.done[save.mode][SCENARIOS[s].id] || [])[m]);
const scenarioDone = (s) => missionsOf(s).every((_, m) => missionDone(s, m));
const scenarioUnlocked = (s) => s === 0 || scenarioDone(s - 1);
const missionUnlocked = (s, m) => scenarioUnlocked(s) && (m === 0 || missionDone(s, m - 1));
const allDone = () => SCENARIOS.every((_, s) => scenarioDone(s));
const levelOf = (xp) => Math.floor(xp / 100) + 1;

/* ---------- 4. Utilidades y efectos ---------- */
const $ = (id) => document.getElementById(id);

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  if (tag === 'button') node.type = 'button';
  return node;
}

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Desordena y evita que quede igual al original. */
function scramble(list) {
  if (new Set(list).size < 2) return list.slice();
  let out = shuffle(list);
  while (out.join('|') === list.join('|')) out = shuffle(list);
  return out;
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];

let toastTimer = null;
function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
}

/** Lluvia de emojis hacia arriba al ganar recompensas. */
function burst(emojis, count = 24) {
  const box = $('fx');
  for (let i = 0; i < count; i++) {
    const p = el('span', 'fx-piece', pick(emojis));
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDuration = 1.8 + Math.random() * 1.8 + 's';
    p.style.animationDelay = Math.random() * 0.6 + 's';
    box.append(p);
    setTimeout(() => p.remove(), 4500);
  }
}

/* ---------- 5. Sonido y voz ---------- */
let audioCtx = null;

function tone(freq, start, dur, type = 'sine', vol = 0.16) {
  if (!save.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const t = audioCtx.currentTime + start;
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + dur);
  } catch (e) { /* navegador sin Web Audio */ }
}

const sfx = {
  ok: () => { tone(660, 0, 0.12); tone(880, 0.1, 0.22); },
  bad: () => { tone(220, 0, 0.14, 'square', 0.09); tone(165, 0.13, 0.25, 'square', 0.09); },
  tap: () => { tone(520, 0, 0.05, 'triangle', 0.1); },
  win: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.13, 0.25)); },
  lose: () => { [392, 330, 262, 196].forEach((f, i) => tone(f, i * 0.18, 0.3, 'triangle')); },
};

const canSpeak = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
let enVoice = null;
let currentUtter = null;        // referencia para que el navegador no descarte la frase
let speechWarned = false;

function loadVoice() {
  const voices = speechSynthesis.getVoices();
  enVoice = voices.find((v) => /^en[-_]US/i.test(v.lang)) || voices.find((v) => /^en/i.test(v.lang)) || null;
}
if (canSpeak) {
  loadVoice();
  speechSynthesis.addEventListener('voiceschanged', loadVoice);
} else {
  document.body.classList.add('no-speech');     // oculta los botones de escuchar
}

/** Pronuncia un texto en inglés. Con `byUser` suena aunque el sonido esté apagado y
    avisa (una sola vez) si el navegador no logra reproducir la voz. */
function speak(text, byUser = false) {
  if (!canSpeak || !text || (!save.sound && !byUser)) return;
  const u = new SpeechSynthesisUtterance(String(text).replace(/_+/g, ' '));
  let started = false;
  u.lang = 'en-US';
  if (enVoice) u.voice = enVoice;
  u.rate = save.mode === 'explorer' ? 0.8 : 0.95;
  u.onstart = () => { started = true; };
  currentUtter = u;
  // Cancelar y hablar en el mismo instante deja mudo a Chrome: se espera un momento
  if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
  setTimeout(() => {
    if (currentUtter !== u) return;
    speechSynthesis.resume();
    speechSynthesis.speak(u);
  }, 80);
  if (byUser) {
    setTimeout(() => {
      if (started || currentUtter !== u || speechWarned) return;
      speechWarned = true;
      toast('Este navegador no pudo reproducir la voz en inglés.');
    }, 2500);
  }
}

function stopSpeech() {
  currentUtter = null;
  if (canSpeak) speechSynthesis.cancel();
}

/* ---------- 6. Inicio y creación del aventurero ---------- */
function showScreen(name) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  $('screen-' + name).classList.add('active');
  window.scrollTo(0, 0);
}

function showHome() {
  stopMission();
  $('btn-continue').hidden = !save.started;
  $('btn-new').className = save.started ? 'btn btn-plain' : 'btn btn-green';
  const info = $('home-info');
  info.hidden = !save.started;
  if (save.started) {
    info.textContent = `${save.avatar} ${save.name} · Nivel ${levelOf(save.xp)} · ${save.coins} monedas · ${save.stars} estrellas`;
  }
  showScreen('home');
}

const setup = { avatar: AVATARS[0], mode: 'explorer' };

function showSetup() {
  setup.avatar = AVATARS[0];
  setup.mode = 'explorer';
  $('inp-name').value = '';
  paintSetup();
  showScreen('setup');
}

function paintSetup() {
  document.querySelectorAll('.avatar-opt').forEach((b) => b.setAttribute('aria-pressed', String(b.textContent === setup.avatar)));
  document.querySelectorAll('.mode-opt').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === setup.mode)));
}

function beginAdventure() {
  const sound = save.sound;
  save = defaultSave();
  save.sound = sound;
  save.started = true;
  save.name = $('inp-name').value.trim().slice(0, 14) || 'Aventurero';
  save.avatar = setup.avatar;
  save.mode = setup.mode;
  persist();
  showMap();
}

/* ---------- 7. Mapa, panel de misiones y tabla de progreso ---------- */
const MAP_DECOR = [['🌴', 6, 88], ['⛵', 48, 46], ['🐳', 70, 90], ['🏝️', 96, 50], ['☁️', 56, 10], ['🌋', 24, 14]];

function paintHud() {
  $('hud-avatar').textContent = save.avatar;
  $('hud-name').textContent = save.name;
  $('hud-mode').textContent = 'Modo ' + MODE_LABELS[save.mode];
  $('hud-level').textContent = 'Nv. ' + levelOf(save.xp);
  $('hud-xp-fill').style.width = (save.xp % 100) + '%';
  $('hud-lives').textContent = '❤️'.repeat(save.lives) + '🤍'.repeat(MAX_LIVES - save.lives);
  $('hud-coins').textContent = save.coins;
  $('hud-stars').textContent = save.stars;
  const buy = $('btn-buy-life');
  buy.hidden = save.lives >= MAX_LIVES;
  buy.disabled = save.coins < LIFE_PRICE;
  $('btn-switch-mode').textContent = 'Cambiar a modo ' + (save.mode === 'explorer' ? 'Experto' : 'Explorador');
  $('btn-sound').textContent = save.sound ? '🔊' : '🔇';
}

function showMap() {
  stopMission();
  if (save.lives <= 0) recoverLives();          // nunca se vuelve al mapa sin vidas
  // El avatar nunca queda parado en un territorio bloqueado
  while (save.pos > 0 && !scenarioUnlocked(save.pos)) save.pos--;
  paintHud();
  paintMap();
  paintPanel();
  showScreen('map');
}

function paintMap() {
  const map = $('map');
  map.innerHTML = '';

  // Ruta punteada que une los territorios
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'route');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  const line = document.createElementNS(svgNS, 'polyline');
  line.setAttribute('points', SCENARIOS.map((s) => `${s.x},${s.y}`).join(' '));
  svg.append(line);
  map.append(svg);

  MAP_DECOR.forEach(([emoji, x, y]) => {
    const d = el('span', 'map-deco', emoji);
    d.style.left = x + '%';
    d.style.top = y + '%';
    map.append(d);
  });

  SCENARIOS.forEach((s, i) => {
    const open = scenarioUnlocked(i);
    const node = el('button', 'node' + (open ? '' : ' locked') + (scenarioDone(i) ? ' done' : '') + (i === save.pos ? ' current' : ''));
    node.style.left = s.x + '%';
    node.style.top = s.y + '%';
    node.setAttribute('aria-label', `${s.name}${open ? '' : ' (bloqueado)'}`);
    node.append(el('span', 'node-icon', s.icon), el('span', 'node-label', s.short || s.name));
    node.addEventListener('click', () => travelTo(i));
    map.append(node);
  });

  const marker = el('span', 'marker', save.avatar);
  marker.id = 'marker';
  marker.style.left = SCENARIOS[save.pos].x + '%';
  marker.style.top = SCENARIOS[save.pos].y + '%';
  map.append(marker);
}

/** Mueve el avatar a otro territorio (si está desbloqueado). */
function travelTo(i) {
  if (!scenarioUnlocked(i)) {
    sfx.bad();
    toast(`Territorio bloqueado. Completa las misiones de “${SCENARIOS[i - 1].name}”.`);
    return;
  }
  save.pos = i;
  persist();
  sfx.tap();
  const marker = $('marker');
  marker.style.left = SCENARIOS[i].x + '%';
  marker.style.top = SCENARIOS[i].y + '%';
  document.querySelectorAll('.node').forEach((n, k) => n.classList.toggle('current', k === i));
  paintPanel();
}

/** Panel con la historia del territorio y sus tarjetas de misión. */
function paintPanel() {
  const s = SCENARIOS[save.pos];
  const panel = $('scenario-panel');
  panel.innerHTML = '';

  const head = el('div', 'panel-head');
  const titles = el('div');
  titles.append(el('h2', '', s.name), el('p', '', `${s.es} · Tema: ${s.theme}`));
  head.append(el('span', 'panel-icon', s.icon), titles);
  panel.append(head, el('p', 'panel-story', s.story));

  const earned = scenarioDone(save.pos);
  panel.append(el('p', 'badge-line' + (earned ? ' earned' : ''),
    earned ? `${s.badge} Insignia ganada: ${s.badgeName}` : `Insignia por completar el territorio: ${s.badge} ${s.badgeName}`));

  const list = el('div', 'mission-list');
  missionsOf(save.pos).forEach((m, mi) => {
    const done = missionDone(save.pos, mi);
    const open = missionUnlocked(save.pos, mi);
    const card = el('div', 'mission-card' + (open ? '' : ' locked'));
    const title = el('h3', '', `Misión ${mi + 1}: ${m.name}`);
    if (m.timed) title.append(el('span', 'tag', '⏳ Con tiempo'));
    if (done) title.append(el('span', 'tag done', '✓ Cumplida'));
    const goal = Math.ceil(m.challenges.length * 2 / 3);
    const btn = el('button', 'btn btn-small ' + (done ? 'btn-plain' : 'btn-gold'), !open ? '🔒 Bloqueada' : done ? 'Repetir' : 'Jugar');
    btn.disabled = !open;
    btn.addEventListener('click', () => startMission(save.pos, mi));
    card.append(title, btn,
      el('p', '', m.es),
      el('p', '', `Objetivo: acierta ${goal} de ${m.challenges.length} desafíos. Recompensa: ${COINS_MISSION} 🪙 y ${XP_MISSION} XP.`));
    list.append(card);
  });
  panel.append(list);
}

function showProgress() {
  $('progress-mode').textContent = 'Modo ' + MODE_LABELS[save.mode];
  const body = $('progress-body');
  body.innerHTML = '';
  let missionsDone = 0;
  let missionsTotal = 0;
  let badges = 0;
  SCENARIOS.forEach((s, i) => {
    const tr = el('tr');
    const marks = missionsOf(i).map((_, m) => {
      missionsTotal++;
      if (missionDone(i, m)) { missionsDone++; return '✅'; }
      return missionUnlocked(i, m) ? '⬜' : '🔒';
    }).join(' ');
    const got = scenarioDone(i);
    if (got) badges++;
    tr.append(el('td', '', `${s.icon} ${s.name}`), el('td', '', marks), el('td', '', got ? `${s.badge} ${s.badgeName}` : '—'));
    body.append(tr);
  });
  const totals = $('progress-totals');
  totals.innerHTML = '';
  [`Misiones: ${missionsDone}/${missionsTotal}`, `Insignias: ${badges}/${SCENARIOS.length}`,
    `Nivel ${levelOf(save.xp)} (${save.xp} XP)`, `🪙 ${save.coins}`, `⭐ ${save.stars}`]
    .forEach((t) => totals.append(el('span', 'reward', t)));
  showScreen('progress');
}

/* ---------- 8. Motor de la misión ---------- */
let game = null;

const PRAISE = ['Great job!', 'Awesome!', 'Well done!', 'Excellent!', 'Brilliant!'];

function startMission(s, m) {
  if (!missionUnlocked(s, m)) return showMap();
  stopMission();
  if (save.lives <= 0) save.lives = MAX_LIVES;
  const mission = SCENARIOS[s].missions[save.mode][m];
  game = {
    s, m, mission,
    idx: 0, correct: 0, results: [],
    answered: false, answerText: '', say: null, reveal: null,
    tick: null, timeLeft: 0, timeTotal: 0,
  };
  $('m-title').textContent = `${SCENARIOS[s].icon} ${mission.name}`;
  $('m-timer').hidden = !mission.timed;
  showScreen('mission');
  renderChallenge();
}

/** Detiene el temporizador y la voz al salir de una misión. */
function stopMission() {
  if (game) clearInterval(game.tick);
  stopSpeech();
}

function paintMissionHud() {
  $('m-lives').textContent = '❤️'.repeat(save.lives) + '🤍'.repeat(MAX_LIVES - save.lives);
  const dots = $('m-dots');
  dots.innerHTML = '';
  game.mission.challenges.forEach((_, i) => {
    const state = i < game.results.length ? (game.results[i] ? 'ok' : 'bad') : i === game.idx ? 'now' : '';
    dots.append(el('span', state));
  });
}

function renderChallenge() {
  const q = game.mission.challenges[game.idx];
  game.answered = false;
  game.reveal = null;
  game.say = null;
  $('feedback').hidden = true;
  paintMissionHud();

  const area = $('challenge');
  area.innerHTML = '';
  RENDERERS[q.t](q, area);

  if (game.mission.timed) startTimer(q.t === 'match' || q.t === 'order' ? TIME_LONG : TIME_SHORT);
  window.scrollTo(0, 0);
}

function startTimer(seconds) {
  clearInterval(game.tick);
  game.timeTotal = seconds;
  game.timeLeft = seconds;
  paintTimer();
  const current = game;
  game.tick = setInterval(() => {
    if (game !== current) return clearInterval(current.tick);
    game.timeLeft -= 0.1;
    paintTimer();
    if (game.timeLeft <= 0) {
      if (game.reveal) game.reveal();
      finish(false, "Time's up!");
    }
  }, 100);
}

function paintTimer() {
  const left = Math.max(0, game.timeLeft);
  $('m-timer-fill').style.width = (left / game.timeTotal) * 100 + '%';
  $('m-timer-num').textContent = Math.ceil(left);
  $('m-timer').classList.toggle('low', left <= 5);
}

/** Cierra el desafío: da estrella y experiencia, o quita una vida. */
function finish(ok, failTitle) {
  if (!game || game.answered) return;
  game.answered = true;
  clearInterval(game.tick);
  game.results.push(ok);

  let title, detail;
  if (ok) {
    game.correct++;
    save.stars++;
    save.xp += XP_CORRECT;
    title = pick(PRAISE);
    detail = `+1 ⭐ y +${XP_CORRECT} XP · ${game.answerText}`;
    sfx.ok();
  } else {
    save.lives = Math.max(0, save.lives - 1);
    title = failTitle || 'Oops! Pierdes una vida';
    detail = 'Respuesta correcta: ' + game.answerText;
    sfx.bad();
  }
  persist();
  paintMissionHud();

  const last = game.idx === game.mission.challenges.length - 1;
  $('fb-title').textContent = title;
  $('fb-detail').textContent = detail;
  $('fb-speak').hidden = !game.say;
  $('btn-next').textContent = save.lives <= 0 ? 'Continuar' : last ? 'Terminar misión' : 'Siguiente';
  const fb = $('feedback');
  fb.classList.toggle('bad', !ok);
  fb.hidden = false;
  fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

  const current = game;
  const idx = game.idx;
  if (game.say) setTimeout(() => { if (game === current && game.idx === idx && game.answered) speak(current.say); }, 400);
}

function nextChallenge() {
  if (!game || !game.answered) return;
  if (save.lives <= 0) return showDefeat();
  if (game.idx === game.mission.challenges.length - 1) return endMission();
  game.idx++;
  renderChallenge();
}

/* ---------- 9. Tipos de desafío ---------- */

/** Encabezado común: etiqueta, lectura, pregunta, ayuda e imagen. */
function renderPrompt(area, { label, text, q, sub, color, img }) {
  area.append(el('span', 'q-label', label));
  if (text) area.append(el('p', 'q-text', text));
  area.append(el('h2', 'q-prompt', q));
  if (sub) area.append(el('p', 'q-sub', sub));
  if (color) {
    const sw = el('div', 'swatch');
    sw.style.background = color;
    area.append(sw);
  }
  if (img) area.append(el('div', 'q-img', img));
}

/* Selección múltiple: vocabulario, acertijos, traducción, lectura y gramática */
function renderMC(q, area) {
  renderPrompt(area, { ...q, label: q.label || 'Pregunta' });
  game.answerText = q.a;
  game.say = q.say || q.a;

  const long = q.opts.some((o) => o.length > 16);
  const grid = el('div', 'options' + (long ? ' long' : ''));
  const buttons = shuffle(q.opts).map((opt) => {
    const b = el('button', 'option', opt);
    b.addEventListener('click', () => {
      if (game.answered) return;
      if (opt !== q.a) b.classList.add('wrong');
      mark();
      finish(opt === q.a);
    });
    grid.append(b);
    return b;
  });
  const mark = () => buttons.forEach((b) => {
    b.disabled = true;
    if (b.textContent === q.a) b.classList.add('right');
  });
  game.reveal = mark;
  area.append(grid);
}

/* Palabra escondida (ordenar todas las letras) o completar las que faltan */
function renderWord(q, area) {
  const letters = q.en.split('');
  const hidden = !q.blanks;
  const blanks = hidden ? letters.map((_, i) => i) : q.blanks;
  renderPrompt(area, hidden
    ? { label: 'Palabra escondida', q: 'Ordena las letras', sub: q.hint }
    : { label: 'Completa la palabra', q: 'Pon las letras que faltan', sub: q.hint });
  game.answerText = `${q.en} = ${q.hint}`;
  game.say = q.en;

  const needed = blanks.map((i) => letters[i]);
  const bank = hidden
    ? scramble(needed)
    : shuffle([...needed, ...shuffle('abcdefghiklmnoprstuwy'.split('').filter((c) => !needed.includes(c))).slice(0, 3)]);
  const filled = blanks.map(() => null);          // ficha puesta en cada espacio

  const row = el('div', 'slots');
  const bankEl = el('div', 'bank');
  const check = el('button', 'btn btn-green', 'Comprobar');
  const slots = [];
  let tiles = [];

  const paint = () => {
    slots.forEach((s, k) => { s.textContent = filled[k] === null ? '' : bank[filled[k]]; });
    check.disabled = filled.includes(null);
  };
  const isRight = (k) => filled[k] !== null && bank[filled[k]] === needed[k];

  letters.forEach((ch, i) => {
    const k = blanks.indexOf(i);
    if (k < 0) return row.append(el('span', 'slot', ch));
    const slot = el('button', 'slot blank');
    slot.setAttribute('aria-label', 'Espacio para una letra');
    slot.addEventListener('click', () => {           // tocar un espacio devuelve su letra
      if (game.answered || filled[k] === null) return;
      tiles[filled[k]].disabled = false;
      filled[k] = null;
      paint();
    });
    slots[k] = slot;
    row.append(slot);
  });

  tiles = bank.map((ch, ti) => {
    const tile = el('button', 'tile', ch);
    tile.addEventListener('click', () => {           // tocar una ficha llena el primer espacio libre
      if (game.answered) return;
      const k = filled.indexOf(null);
      if (k < 0) return;
      filled[k] = ti;
      tile.disabled = true;
      sfx.tap();
      paint();
    });
    bankEl.append(tile);
    return tile;
  });

  // Muestra la palabra correcta y marca cada letra como acertada o fallada
  game.reveal = () => {
    slots.forEach((s, k) => {
      s.classList.remove('blank');
      s.classList.add(isRight(k) ? 'right' : 'wrong');
      s.textContent = needed[k];
    });
    tiles.forEach((t) => { t.disabled = true; });
    check.hidden = true;
  };

  check.addEventListener('click', () => {
    const ok = slots.every((_, k) => isRight(k));
    game.reveal();
    finish(ok);
  });

  paint();
  area.append(row, bankEl, check);
}

/* Relacionar parejas (imagen o palabra en español con su palabra en inglés) */
function renderMatch(q, area) {
  renderPrompt(area, { label: 'Relaciona', q: 'Match the pairs', sub: 'Toca un elemento de la izquierda y luego su pareja' });
  game.answerText = q.pairs.map((p) => p.join(' = ')).join(', ');
  game.say = null;

  const grid = el('div', 'match');
  const colL = el('div', 'match-col');
  const colR = el('div', 'match-col');
  const all = [];
  let sel = { L: null, R: null };
  let done = 0;
  let mistakes = 0;

  const evaluate = () => {
    if (!sel.L || !sel.R) return;
    const { L, R } = sel;
    sel = { L: null, R: null };
    L.node.classList.remove('sel');
    R.node.classList.remove('sel');
    if (L.pair === R.pair) {
      [L.node, R.node].forEach((n) => { n.classList.add('done'); n.disabled = true; });
      done++;
      if (done === q.pairs.length) return finish(mistakes === 0, 'Oops! Hubo errores al relacionar');
      sfx.tap();
      speak(q.pairs[L.pair][1]);
    } else {
      mistakes++;
      sfx.bad();
      [L.node, R.node].forEach((n) => {
        n.classList.add('shake');
        setTimeout(() => n.classList.remove('shake'), 400);
      });
    }
  };

  const makeItem = (side, text, pair) => {
    const isText = /[a-záéíóúñ]/i.test(text);
    const node = el('button', 'match-item' + (side === 'L' ? ' pic' + (isText ? ' text' : '') : ''), text);
    node.addEventListener('click', () => {
      if (game.answered) return;
      if (sel[side]) sel[side].node.classList.remove('sel');
      sel[side] = { node, pair };
      node.classList.add('sel');
      evaluate();
    });
    all.push(node);
    return node;
  };

  const indexes = q.pairs.map((_, i) => i);
  shuffle(indexes).forEach((i) => colL.append(makeItem('L', q.pairs[i][0], i)));
  shuffle(indexes).forEach((i) => colR.append(makeItem('R', q.pairs[i][1], i)));
  game.reveal = () => all.forEach((n) => { n.disabled = true; });
  grid.append(colL, colR);
  area.append(grid);
}

/* Ordenar palabras para construir la oración */
function renderOrder(q, area) {
  renderPrompt(area, { label: 'Construye la oración', q: q.es, sub: 'Toca las palabras en el orden correcto' });
  game.answerText = q.en;
  game.say = q.en;

  const words = q.en.split(' ');
  const orderIdx = scramble(words.map((_, i) => i));
  if (orderIdx.map((i) => words[i]).join(' ') === q.en && words.length > 1) orderIdx.reverse();
  const placed = [];                                 // índices de las palabras ya colocadas
  const line = el('div', 'sentence');
  const bankEl = el('div', 'bank');
  const check = el('button', 'btn btn-green', 'Comprobar');
  const tiles = {};

  const paint = () => {
    line.innerHTML = '';
    placed.forEach((wi, pos) => {
      const chip = el('button', 'tile word', words[wi]);
      chip.addEventListener('click', () => {           // tocar una palabra la devuelve
        if (game.answered) return;
        placed.splice(pos, 1);
        tiles[wi].disabled = false;
        paint();
      });
      line.append(chip);
    });
    check.disabled = placed.length < words.length;
  };

  orderIdx.forEach((wi) => {
    const tile = el('button', 'tile word', words[wi]);
    tile.addEventListener('click', () => {
      if (game.answered) return;
      placed.push(wi);
      tile.disabled = true;
      sfx.tap();
      paint();
    });
    tiles[wi] = tile;
    bankEl.append(tile);
  });

  const close = (ok) => {
    line.classList.add(ok ? 'right' : 'wrong');
    Object.values(tiles).forEach((t) => { t.disabled = true; });
    check.hidden = true;
  };
  game.reveal = () => close(false);

  check.addEventListener('click', () => {
    const ok = placed.map((i) => words[i]).join(' ') === q.en;
    close(ok);
    finish(ok);
  });

  paint();
  area.append(line, bankEl, check);
}

const RENDERERS = { mc: renderMC, word: renderWord, match: renderMatch, order: renderOrder };

/* ---------- 10. Resultados, derrota y victoria ---------- */

/** Evalúa el objetivo de la misión, entrega recompensas y revisa insignias y desbloqueos. */
function endMission() {
  clearInterval(game.tick);
  stopSpeech();
  const { s, m, mission } = game;
  const scen = SCENARIOS[s];
  const total = mission.challenges.length;
  const goal = Math.ceil(total * 2 / 3);
  const won = game.correct >= goal;
  const rewards = $('res-rewards');
  rewards.innerHTML = '';

  const main = $('btn-res-main');
  const alt = $('btn-res-alt');

  if (!won) {
    $('res-icon').textContent = '🧗';
    $('res-title').textContent = 'Mission failed';
    $('res-text').textContent = `Acertaste ${game.correct} de ${total} y necesitabas ${goal}. Inténtalo otra vez: ya conoces el camino.`;
    main.textContent = 'Volver a intentarlo';
    main.onclick = () => startMission(s, m);
    alt.textContent = 'Volver al mapa';
    alt.onclick = showMap;
    sfx.lose();
    showScreen('result');
    return;
  }

  const firstTime = !missionDone(s, m);
  const wasScenarioDone = scenarioDone(s);
  const wasAllDone = allDone();
  const coins = firstTime ? COINS_MISSION + (game.correct === total ? COINS_PERFECT : 0) : COINS_REPEAT;
  const xp = firstTime ? XP_MISSION : 10;
  const levelBefore = levelOf(save.xp);

  // Guardar el avance
  const key = scen.id;
  if (!save.done[save.mode][key]) save.done[save.mode][key] = [];
  save.done[save.mode][key][m] = true;
  save.coins += coins;
  save.xp += xp;
  persist();

  const newBadge = !wasScenarioDone && scenarioDone(s);
  const newVictory = !wasAllDone && allDone();
  const hasNextScenario = s < SCENARIOS.length - 1;

  $('res-icon').textContent = newBadge ? scen.badge : '🏆';
  $('res-title').textContent = newBadge ? 'Territory complete!' : 'Mission complete!';
  let text = `Acertaste ${game.correct} de ${total} desafíos.`;
  if (newBadge && hasNextScenario) text += ` Ganaste una insignia y se abrió el camino a “${SCENARIOS[s + 1].name}”.`;
  else if (newBadge) text += ' Ganaste la última insignia. ¡El cofre del tesoro es tuyo!';
  else if (firstTime) text += ' Se desbloqueó la siguiente misión.';
  else text += ' Ya habías cumplido esta misión, así que la recompensa es menor.';
  $('res-text').textContent = text;

  rewards.append(el('span', 'reward', `+${coins} 🪙`), el('span', 'reward', `+${xp} XP`));
  if (levelOf(save.xp) > levelBefore) rewards.append(el('span', 'reward', `¡Nivel ${levelOf(save.xp)}!`));
  if (newBadge) rewards.append(el('span', 'reward badge', `${scen.badge} ${scen.badgeName}`));

  if (newVictory) {
    main.textContent = 'Abrir el cofre';
    main.onclick = showVictory;
  } else {
    main.textContent = 'Continuar';
    main.onclick = () => {
      if (newBadge && hasNextScenario) save.pos = s + 1;     // el avatar avanza al territorio nuevo
      persist();
      showMap();
    };
  }
  alt.textContent = 'Repetir misión';
  alt.onclick = () => startMission(s, m);

  sfx.win();
  burst(newBadge ? ['🪙', '⭐', scen.badge] : ['🪙', '⭐']);
  showScreen('result');
}

function showDefeat() {
  clearInterval(game.tick);
  stopSpeech();
  sfx.lose();
  showScreen('defeat');
}

/** Tras una derrota se recuperan todas las vidas. */
function recoverLives() {
  save.lives = MAX_LIVES;
  persist();
}

function showVictory() {
  $('vic-text').textContent =
    `${save.name}, recorriste los ${SCENARIOS.length} territorios en modo ${MODE_LABELS[save.mode]} y recuperaste el tesoro perdido. Congratulations!`;
  const stats = $('vic-stats');
  stats.innerHTML = '';
  [`Nivel ${levelOf(save.xp)}`, `🪙 ${save.coins}`, `⭐ ${save.stars}`, SCENARIOS.map((s) => s.badge).join(' ')]
    .forEach((t) => stats.append(el('span', 'reward', t)));
  const other = save.mode === 'explorer' ? 'expert' : 'explorer';
  $('btn-vic-mode').textContent = 'Jugar en modo ' + MODE_LABELS[other];
  sfx.win();
  burst(['🪙', '💎', '⭐', '👑'], 50);
  showScreen('victory');
}

function switchMode() {
  save.mode = save.mode === 'explorer' ? 'expert' : 'explorer';
  save.pos = 0;
  // El avatar se ubica en el territorio más avanzado que esté abierto
  SCENARIOS.forEach((_, i) => { if (scenarioUnlocked(i)) save.pos = i; });
  persist();
  showMap();
  toast('Ahora juegas en modo ' + MODE_LABELS[save.mode] + '.');
}

/* ---------- 11. Eventos e inicio ---------- */
AVATARS.forEach((a) => {
  const b = el('button', 'avatar-opt', a);
  b.addEventListener('click', () => { setup.avatar = a; paintSetup(); sfx.tap(); });
  $('avatar-grid').append(b);
});
document.querySelectorAll('.mode-opt').forEach((b) => b.addEventListener('click', () => {
  setup.mode = b.dataset.mode;
  paintSetup();
  sfx.tap();
}));

$('btn-continue').addEventListener('click', showMap);
$('btn-new').addEventListener('click', () => {
  if (save.started && !window.confirm('¿Empezar una aventura nueva? Se borrará todo el progreso guardado.')) return;
  showSetup();
});
$('btn-begin').addEventListener('click', beginAdventure);
$('btn-setup-back').addEventListener('click', showHome);

$('btn-progress').addEventListener('click', showProgress);
$('btn-progress-back').addEventListener('click', showMap);
$('btn-switch-mode').addEventListener('click', switchMode);
$('btn-to-home').addEventListener('click', showHome);

$('btn-buy-life').addEventListener('click', () => {
  if (save.coins < LIFE_PRICE || save.lives >= MAX_LIVES) return;
  save.coins -= LIFE_PRICE;
  save.lives++;
  persist();
  paintHud();
  sfx.ok();
  burst(['❤️'], 8);
});

$('btn-quit').addEventListener('click', () => {
  if (window.confirm('¿Salir de la misión? Se perderá el avance de esta misión.')) showMap();
});
$('btn-next').addEventListener('click', nextChallenge);
$('fb-speak').addEventListener('click', () => speak(game.say, true));

$('btn-retry').addEventListener('click', () => { recoverLives(); startMission(game.s, game.m); });
$('btn-defeat-map').addEventListener('click', () => { recoverLives(); showMap(); });

$('btn-vic-map').addEventListener('click', showMap);
$('btn-vic-mode').addEventListener('click', switchMode);

$('btn-sound').addEventListener('click', () => {
  save.sound = !save.sound;
  if (!save.sound) stopSpeech();
  persist();
  $('btn-sound').textContent = save.sound ? '🔊' : '🔇';
  sfx.tap();
});

$('btn-sound').textContent = save.sound ? '🔊' : '🔇';
showHome();
