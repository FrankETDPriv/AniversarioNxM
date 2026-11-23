// =========================================================================
// MINIJUEGO: BACKROOMS DEL GATITO - EDICIÓN LIMINAL (static/js/game.js)
// =========================================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- CONFIGURACIÓN GENERAL ---
const SUELO_Y = 278;
const VELOCIDAD_GATO = 190;
const DURACION_ONDAS = 6.0; // 6 segundos de alerta antes de que entre el monstruo

let estadoJuego = 'espera'; // 'espera' | 'jugando' | 'victoria' | 'derrota'
let tiempoGlobal = 0;
let ultimoFrame = 0;
let animFrameId = null;
let timeoutPremioId = null;

// --- JUGADOR (GATITO) ---
const gato = {
  x: 150,
  y: SUELO_Y,
  dir: 1,
  caminando: false,
  escondidoEn: null,
  ondasActivas: false,
  contadorOndas: 0,
  invulnerableTimer: 0
};

// --- MONSTRUO DE LOS BACKROOMS ---
const monstruo = {
  activo: false,
  sala: 0,
  x: -80,
  dir: 1,
  fase: 'entrando', // 'entrando' | 'buscando' | 'saliendo'
  timerFase: 0,
  miradaDir: 1,
  proximoAtaque: 12
};

// --- CÓDIGO DE SALIDA Y PROGRESO ---
let codigoSecreto = ['0', '0', '0', '0'];
let digitosDescubiertos = [null, null, null, null];
let entradaKeypad = '';
let salaActual = 0;
let salas = [];
let objetoCercano = null;
let mensajeFlotante = { texto: '', timer: 0, color: '#f3e5ab' };
let particulas = [];

// --- CONTROLES DE TECLADO ---
const teclas = { left: false, right: false };

window.addEventListener('keydown', e => {
  if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
    if (document.activeElement === document.body) e.preventDefault();
  }
  if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') teclas.left = true;
  if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') teclas.right = true;

  if ((e.key === 'e' || e.key === 'E' || e.key === 'Enter') && estadoJuego === 'jugando') {
    const keypad = document.getElementById('br-keypad');
    if (keypad && keypad.style.display === 'block') return;
    ejecutarAccionCercana();
  }
  if (e.key === 'Escape') {
    cerrarKeypad();
  }
});

window.addEventListener('keyup', e => {
  if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') teclas.left = false;
  if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') teclas.right = false;
});

// Clic directo en el canvas para interactuar o salir de escondite
canvas.addEventListener('click', e => {
  if (estadoJuego !== 'jugando') return;
  const keypad = document.getElementById('br-keypad');
  if (keypad && keypad.style.display === 'block') return;

  const rect = canvas.getBoundingClientRect();
  const clickX = (e.clientX - rect.left) * (canvas.width / rect.width);
  const clickY = (e.clientY - rect.top) * (canvas.height / rect.height);

  if (gato.escondidoEn) {
    salirDeEscondite();
    return;
  }

  const sala = salas[salaActual];
  for (const obj of sala.objetos) {
    const topY = obj.anclaY ? obj.anclaY - obj.h / 2 : SUELO_Y - obj.h;
    const botY = obj.anclaY ? obj.anclaY + obj.h / 2 : SUELO_Y;
    if (
      clickX >= obj.x - obj.w / 2 - 14 &&
      clickX <= obj.x + obj.w / 2 + 14 &&
      clickY >= topY - 18 &&
      clickY <= botY + 12
    ) {
      if (Math.abs(gato.x - obj.x) <= 78) {
        interactuarConObjeto(obj);
      } else {
        mostrarAviso('Acércate un poco más para revisar', '#d8c89e');
      }
      return;
    }
  }

  for (const puerta of sala.puertas) {
    if (Math.abs(clickX - puerta.x) <= 45 && clickY >= SUELO_Y - 118) {
      if (Math.abs(gato.x - puerta.x) <= 75) {
        usarPuerta(puerta);
      } else {
        mostrarAviso('Camina hasta la puerta primero', '#d8c89e');
      }
      return;
    }
  }
});

// --- SINTETIZADOR DE AUDIO (SIN ARCHIVOS EXTERNOS) ---
let audioCtx = null;
function reproducirSonido(freq, duracion = 0.09, tipo = 'sine', vol = 0.04, freqFin = null) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freqFin || freq * 1.1, audioCtx.currentTime + duracion);

    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duracion);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duracion);
  } catch (err) {
    // Silencioso si el navegador bloquea audio
  }
}

// --- GENERACIÓN DE 7 HABITACIONES LIMINALES ---
function construirEscenarios() {
  codigoSecreto = Array.from({ length: 4 }, () => String(Math.floor(Math.random() * 10)));
  digitosDescubiertos = [null, null, null, null];

  salas = [
    // SALA 0: PASILLO AMARILLO
    {
      id: 0,
      nombre: '1. Pasillo Amarillo',
      tonoPared: '#b89f4d',
      tonoFranja: '#8f7932',
      decoracionExtra: [
        { tipo: 'puerta_pared', x: 355, y: 118 }, // Puerta imposible flotando en la pared
        { tipo: 'reloj_sin_agujas', x: 175, y: 74 }
      ],
      puertas: [
        { x: 660, destino: 1, spawnX: 85, etiqueta: 'Sillas →' }
      ],
      objetos: [
        { id: 'taq_0', tipo: 'taquilla', nombre: 'Taquilla metálica', x: 245, w: 46, h: 96, escondite: true, revisado: false, pista: null },
        { id: 'cua_0', tipo: 'cuadro_ojo', nombre: 'Cuadro que observa', x: 455, anclaY: 162, w: 52, h: 42, escondite: false, revisado: false, pista: null },
        { id: 'caj_0', tipo: 'caja', nombre: 'Caja de archivo', x: 560, w: 44, h: 42, escondite: true, revisado: false, pista: null }
      ]
    },

    // SALA 1: SALA DE LAS SILLAS REPETIDAS
    {
      id: 1,
      nombre: '2. Sala de las Sillas',
      tonoPared: '#b09746',
      tonoFranja: '#826e2d',
      decoracionExtra: [
        { tipo: 'silla_techo', x: 260, y: 12 }, // Silla pegada boca abajo en el techo
        { tipo: 'silla_techo', x: 470, y: 12 }, // Otra silla en el techo
        { tipo: 'silla_fondo', x: 185 },
        { tipo: 'silla_fondo', x: 245 },
        { tipo: 'silla_fondo', x: 305 },
        { tipo: 'silla_fondo', x: 365 },
        { tipo: 'silla_fondo', x: 425 }
      ],
      puertas: [
        { x: 60, destino: 0, spawnX: 625, etiqueta: '← Pasillo' },
        { x: 660, destino: 2, spawnX: 85, etiqueta: 'Maniquíes →' }
      ],
      objetos: [
        { id: 'silla_1', tipo: 'silla_interactiva', nombre: 'Silla #4 (Idéntica)', x: 335, w: 38, h: 56, escondite: false, revisado: false, pista: null },
        { id: 'taq_1', tipo: 'taquilla', nombre: 'Armario estrecho', x: 535, w: 46, h: 96, escondite: true, revisado: false, pista: null }
      ]
    },

    // SALA 2: GALERÍA DE MANIQUÍES
    {
      id: 2,
      nombre: '3. Galería de Maniquíes',
      tonoPared: '#a89044',
      tonoFranja: '#786526',
      decoracionExtra: [
        { tipo: 'maniqui_techo', x: 340, y: 10 }, // Maniquí invertido colgando del techo
        { tipo: 'espejo_roto', x: 455, y: 125 }
      ],
      puertas: [
        { x: 60, destino: 1, spawnX: 625, etiqueta: '← Sillas' },
        { x: 660, destino: 3, spawnX: 85, etiqueta: 'Invertido →' }
      ],
      objetos: [
        { id: 'man_2a', tipo: 'maniqui', nombre: 'Maniquí de madera', x: 205, w: 40, h: 94, escondite: true, revisado: false, pista: null },
        { id: 'man_2b', tipo: 'maniqui_inclinado', nombre: 'Maniquí torcido', x: 345, w: 40, h: 94, escondite: false, revisado: false, pista: null },
        { id: 'mesa_2', tipo: 'mesa', nombre: 'Mesa de sastre', x: 515, w: 78, h: 46, escondite: true, revisado: false, pista: null }
      ]
    },

    // SALA 3: CUARTO INVERTIDO (MUEBLES INCRUSTADOS EN PARED Y TECHO)
    {
      id: 3,
      nombre: '4. Cuarto Invertido',
      tonoPared: '#9e883f',
      tonoFranja: '#6e5d24',
      decoracionExtra: [
        { tipo: 'mesa_techo', x: 240, y: 12 },   // Escritorio boca abajo en el techo
        { tipo: 'lampara_techo', x: 495, y: 12 }, // Lámpara de pie colgando invertida
        { tipo: 'reloj_sin_agujas', x: 365, y: 82 }
      ],
      puertas: [
        { x: 60, destino: 2, spawnX: 625, etiqueta: '← Maniquíes' },
        { x: 660, destino: 4, spawnX: 85, etiqueta: 'Puertas →' }
      ],
      objetos: [
        { id: 'pared_mesa_3', tipo: 'mesa_pared', nombre: 'Mesa incrustada en pared', x: 215, anclaY: 175, w: 66, h: 44, escondite: false, revisado: false, pista: null },
        { id: 'taq_3', tipo: 'taquilla', nombre: 'Cabina de metal', x: 365, w: 46, h: 96, escondite: true, revisado: false, pista: null },
        { id: 'caj_3', tipo: 'caja', nombre: 'Caja fusionada', x: 525, w: 48, h: 46, escondite: true, revisado: false, pista: null }
      ]
    },

    // SALA 4: LABERINTO DE PUERTAS REPETIDAS
    {
      id: 4,
      nombre: '5. Pasillo de Puertas',
      tonoPared: '#b29848',
      tonoFranja: '#826d2c',
      decoracionExtra: [
        { tipo: 'puerta_pared', x: 220, y: 45 },
        { tipo: 'puerta_pared', x: 490, y: 45 }
      ],
      puertas: [
        { x: 60, destino: 3, spawnX: 625, etiqueta: '← Invertido' },
        { x: 660, destino: 5, spawnX: 85, etiqueta: 'Almacén →' }
      ],
      objetos: [
        { id: 'pfalsa_4a', tipo: 'puerta_falsa', nombre: 'Puerta sellada #1', x: 215, w: 50, h: 108, escondite: false, revisado: false, pista: null },
        { id: 'man_4', tipo: 'maniqui', nombre: 'Maniquí vigilante', x: 360, w: 40, h: 94, escondite: true, revisado: false, pista: null },
        { id: 'pfalsa_4b', tipo: 'puerta_falsa', nombre: 'Puerta sellada #2', x: 505, w: 50, h: 108, escondite: false, revisado: false, pista: null }
      ]
    },

    // SALA 5: ALMACÉN INFINITO (CAJAS REPETIDAS HASTA EL TECHO)
    {
      id: 5,
      nombre: '6. Almacén Infinito',
      tonoPared: '#a68d41',
      tonoFranja: '#756224',
      decoracionExtra: [
        { tipo: 'torre_cajas', x: 165 },
        { tipo: 'torre_cajas', x: 315 },
        { tipo: 'torre_cajas', x: 465 },
        { tipo: 'torre_cajas', x: 585 }
      ],
      puertas: [
        { x: 60, destino: 4, spawnX: 625, etiqueta: '← Puertas' },
        { x: 660, destino: 6, spawnX: 85, etiqueta: 'Salida →' }
      ],
      objetos: [
        { id: 'caj_5a', tipo: 'caja', nombre: 'Caja marcada #09', x: 235, w: 46, h: 46, escondite: true, revisado: false, pista: null },
        { id: 'mon_5', tipo: 'monitor', nombre: 'Monitor con estática', x: 390, w: 46, h: 48, escondite: false, revisado: false, pista: null },
        { id: 'taq_5', tipo: 'taquilla', nombre: 'Casillero oxidado', x: 530, w: 46, h: 96, escondite: true, revisado: false, pista: null }
      ]
    },

    // SALA 6: SALA DE SALIDA
    {
      id: 6,
      nombre: '7. Sala de Salida',
      tonoPared: '#b59a49',
      tonoFranja: '#856f2c',
      decoracionExtra: [
        { tipo: 'silla_techo', x: 340, y: 12 },
        { tipo: 'reloj_sin_agujas', x: 520, y: 74 }
      ],
      puertas: [
        { x: 60, destino: 5, spawnX: 625, etiqueta: '← Almacén' },
        { x: 645, destino: 'SALIDA', spawnX: 0, etiqueta: 'PUERTA EXIT' }
      ],
      objetos: [
        { id: 'mesa_6', tipo: 'mesa', nombre: 'Escritorio metálico', x: 225, w: 78, h: 46, escondite: true, revisado: false, pista: null },
        { id: 'man_6', tipo: 'maniqui', nombre: 'Maniquí de recepción', x: 380, w: 40, h: 94, escondite: false, revisado: false, pista: null },
        { id: 'taq_6', tipo: 'taquilla', nombre: 'Cabina de seguridad', x: 510, w: 48, h: 96, escondite: true, revisado: false, pista: null }
      ]
    }
  ];

  // Repartir los 4 dígitos aleatoriamente en 4 objetos distintos a lo largo de las 7 salas
  const todosLosObjetos = salas.flatMap(s => s.objetos);
  const mezclados = [...todosLosObjetos].sort(() => Math.random() - 0.5);

  for (let i = 0; i < 4; i++) {
    mezclados[i].pista = {
      posicion: i,
      valor: codigoSecreto[i]
    };
  }
}

// --- INICIO Y FIN DE PARTIDA ---
function iniciarJuego() {
  if (animFrameId) cancelAnimationFrame(animFrameId);
  if (timeoutPremioId) clearTimeout(timeoutPremioId);

  cerrarKeypad();
  construirEscenarios();

  const btnPlay = document.getElementById('btn-play-game');
  if (btnPlay) btnPlay.textContent = 'Reiniciar';

  const premioEl = document.getElementById('premio');
  if (premioEl) {
    premioEl.style.display = 'none';
    premioEl.textContent = '';
  }

  salaActual = 0;
  gato.x = 135;
  gato.y = SUELO_Y;
  gato.dir = 1;
  gato.escondidoEn = null;
  gato.ondasActivas = false;
  gato.contadorOndas = 0;
  gato.invulnerableTimer = 2.5;

  monstruo.activo = false;
  monstruo.proximoAtaque = 10 + Math.random() * 5;

  particulas = [];
  estadoJuego = 'jugando';
  ultimoFrame = performance.now();

  actualizarHUD();
  mostrarAviso('Explora las 7 salas extrañas y halla los 4 dígitos', '#f3e5ab');
  reproducirSonido(520, 0.12, 'triangle', 0.04);

  animFrameId = requestAnimationFrame(buclePrincipal);
}

function ganarJuego() {
  estadoJuego = 'victoria';
  cerrarKeypad();
  gato.ondasActivas = false;
  monstruo.activo = false;
  actualizarHUD();

  reproducirSonido(523, 0.12, 'sine', 0.05);
  setTimeout(() => reproducirSonido(659, 0.12, 'sine', 0.05), 110);
  setTimeout(() => reproducirSonido(784, 0.24, 'sine', 0.06), 220);

  const premioEl = document.getElementById('premio');
  if (premioEl) {
    premioEl.style.display = 'block';
    premioEl.textContent = '¿eSEPRABAS UN PREMio? Pues parece que llegara el algun momento  21.XX.202X';

    timeoutPremioId = setTimeout(() => {
      premioEl.textContent = 'Gracias por jugar la demo';
    }, 4500);
  }
}

function perderJuego() {
  estadoJuego = 'derrota';
  cerrarKeypad();
  reproducirSonido(150, 0.35, 'sawtooth', 0.05, 75);

  const premioEl = document.getElementById('premio');
  if (premioEl) {
    premioEl.style.display = 'block';
    premioEl.textContent = 'La entidad te encontró en los Backrooms... Pulsa Reiniciar para intentarlo de nuevo.';
  }
  actualizarHUD();
}

// --- INTERACCIONES, ESCONDITES Y PUERTAS ---
function ejecutarAccionCercana() {
  if (estadoJuego !== 'jugando') return;

  if (gato.escondidoEn) {
    salirDeEscondite();
    return;
  }

  const sala = salas[salaActual];
  for (const obj of sala.objetos) {
    if (Math.abs(gato.x - obj.x) <= 58) {
      interactuarConObjeto(obj);
      return;
    }
  }

  for (const puerta of sala.puertas) {
    if (Math.abs(gato.x - puerta.x) <= 62) {
      usarPuerta(puerta);
      return;
    }
  }

  mostrarAviso('No hay nada cerca para interactuar', '#cbb8a6');
}

function interactuarConObjeto(obj) {
  if (obj.pista && !obj.revisado) {
    obj.revisado = true;
    digitosDescubiertos[obj.pista.posicion] = obj.pista.valor;
    actualizarHUD();
    const efectoY = obj.anclaY || SUELO_Y - obj.h / 2;
    crearParticulas(obj.x, efectoY, '#f5d77f', 14);
    reproducirSonido(740, 0.14, 'triangle', 0.05, 920);
    mostrarAviso(`¡Dígito #${obj.pista.posicion + 1} encontrado: [ ${obj.pista.valor} ]!`, '#ffe28a');

    if (obj.escondite && gato.ondasActivas) {
      entrarEnEscondite(obj);
    }
    return;
  }

  obj.revisado = true;

  if (obj.escondite) {
    entrarEnEscondite(obj);
  } else if (obj.tipo === 'puerta_falsa') {
    reproducirSonido(190, 0.14, 'sawtooth', 0.035, 140);
    mostrarAviso('Esta puerta da a una pared sólida...', '#d8c89e');
  } else if (obj.tipo === 'maniqui_inclinado' || obj.tipo === 'maniqui') {
    reproducirSonido(280, 0.08, 'sine', 0.03);
    mostrarAviso('El maniquí parece haber girado la cabeza...', '#d8c89e');
  } else {
    reproducirSonido(320, 0.06, 'sine', 0.03);
    mostrarAviso(`${obj.nombre}: nada útil aquí`, '#d8c89e');
  }
}

function entrarEnEscondite(obj) {
  gato.escondidoEn = obj;
  gato.x = obj.x;
  reproducirSonido(260, 0.08, 'sine', 0.04, 190);
  mostrarAviso(`Escondido tras ${obj.nombre} (Pulsa E para salir)`, '#a8e6cf');
  actualizarHUD();
}

function salirDeEscondite() {
  if (monstruo.activo && monstruo.sala === salaActual) {
    mostrarAviso('¡Shhh! Espera a que la entidad se vaya', '#ff7b7b');
    return;
  }
  gato.escondidoEn = null;
  reproducirSonido(340, 0.07, 'sine', 0.035);
  actualizarHUD();
}

function usarPuerta(puerta) {
  if (monstruo.activo && monstruo.sala === salaActual) {
    mostrarAviso('¡La entidad bloquea la sala! Escóndete', '#ff7b7b');
    return;
  }

  if (puerta.destino === 'SALIDA') {
    abrirKeypad();
    return;
  }

  salaActual = puerta.destino;
  gato.x = puerta.spawnX;
  gato.escondidoEn = null;
  reproducirSonido(410, 0.08, 'triangle', 0.035);
  actualizarHUD();
}

// --- KEYPAD DE LA PUERTA DE SALIDA ---
function abrirKeypad() {
  entradaKeypad = '';
  actualizarDisplayKeypad();
  const keypad = document.getElementById('br-keypad');
  if (keypad) keypad.style.display = 'block';
}

function cerrarKeypad() {
  const keypad = document.getElementById('br-keypad');
  if (keypad) keypad.style.display = 'none';
}

function ingresarDigito(num) {
  if (entradaKeypad.length >= 4) return;
  entradaKeypad += num;
  reproducirSonido(620, 0.05, 'sine', 0.04);
  actualizarDisplayKeypad();
}

function limpiarKeypad() {
  entradaKeypad = '';
  reproducirSonido(300, 0.06, 'sine', 0.03);
  actualizarDisplayKeypad();
}

function actualizarDisplayKeypad() {
  const disp = document.getElementById('br-keypad-display');
  if (!disp) return;
  const chars = entradaKeypad.padEnd(4, '_').split('');
  disp.textContent = chars.join(' ');
}

function verificarCodigo() {
  const esperado = codigoSecreto.join('');
  if (entradaKeypad === esperado) {
    ganarJuego();
  } else {
    reproducirSonido(180, 0.18, 'sawtooth', 0.04, 120);
    mostrarAviso('Código incorrecto', '#ff7b7b');
    limpiarKeypad();
  }
}

// --- ACTUALIZACIÓN DE HUD Y AVISOS ---
function actualizarHUD() {
  const roomEl = document.getElementById('br-room');
  const digitsEl = document.getElementById('br-digits');
  const statusEl = document.getElementById('br-status');

  if (roomEl && salas[salaActual]) {
    roomEl.textContent = salas[salaActual].nombre;
  }

  if (digitsEl) {
    digitsEl.textContent = digitosDescubiertos.map(d => (d !== null ? d : '_')).join(' ');
  }

  if (statusEl) {
    if (estadoJuego === 'victoria') {
      statusEl.textContent = '¡Escapaste!';
      statusEl.style.color = '#9be5aa';
    } else if (estadoJuego === 'derrota') {
      statusEl.textContent = 'Atrapado';
      statusEl.style.color = '#ff6b6b';
    } else if (monstruo.activo && monstruo.sala === salaActual) {
      statusEl.textContent = gato.escondidoEn ? 'Escondido (Silencio)' : '¡PELIGRO!';
      statusEl.style.color = gato.escondidoEn ? '#ffd166' : '#ff4d4d';
    } else if (gato.ondasActivas) {
      statusEl.textContent = `¡ONDAS! ${gato.contadorOndas.toFixed(1)}s`;
      statusEl.style.color = '#ff595e';
    } else if (gato.escondidoEn) {
      statusEl.textContent = 'Escondido';
      statusEl.style.color = '#a8e6cf';
    } else {
      statusEl.textContent = 'Seguro';
      statusEl.style.color = 'var(--gold)';
    }
  }
}

function mostrarAviso(texto, color = '#f3e5ab') {
  mensajeFlotante = { texto, timer: 2.6, color };
}

function crearParticulas(x, y, color, cantidad = 10) {
  for (let i = 0; i < cantidad; i++) {
    const ang = (Math.PI * 2 * i) / cantidad + Math.random() * 0.4;
    const vel = 0.7 + Math.random() * 2.0;
    particulas.push({
      x,
      y,
      vx: Math.cos(ang) * vel,
      vy: Math.sin(ang) * vel,
      vida: 1,
      color,
      radio: 2 + Math.random() * 2.2
    });
  }
}

// --- LÓGICA DEL MONSTRUO Y ONDAS ROJAS ---
function actualizarAmenaza(dt) {
  if (gato.invulnerableTimer > 0) {
    gato.invulnerableTimer -= dt;
    return;
  }

  if (!gato.ondasActivas && !monstruo.activo) {
    monstruo.proximoAtaque -= dt;
    if (monstruo.proximoAtaque <= 0) {
      gato.ondasActivas = true;
      gato.contadorOndas = DURACION_ONDAS;
      reproducirSonido(220, 0.22, 'sawtooth', 0.04, 180);
      mostrarAviso('¡Ondas rojas! Algo se acerca... ¡Escóndete en 6s!', '#ff6b6b');
      actualizarHUD();
    }
    return;
  }

  if (gato.ondasActivas) {
    const segAnterior = Math.ceil(gato.contadorOndas);
    gato.contadorOndas -= dt;
    const segActual = Math.ceil(gato.contadorOndas);

    if (segActual < segAnterior && segActual > 0) {
      reproducirSonido(480 + (6 - segActual) * 65, 0.08, 'sine', 0.035);
    }

    actualizarHUD();

    if (gato.contadorOndas <= 0) {
      gato.ondasActivas = false;
      iniciarEntradaMonstruo();
    }
    return;
  }

  if (monstruo.activo) {
    if (monstruo.fase === 'entrando') {
      monstruo.x += monstruo.dir * 135 * dt;
      const objetivoCentro = canvas.width * 0.5;
      if ((monstruo.dir === 1 && monstruo.x >= objetivoCentro) || (monstruo.dir === -1 && monstruo.x <= objetivoCentro)) {
        monstruo.x = objetivoCentro;
        monstruo.fase = 'buscando';
        monstruo.timerFase = 3.4;
        monstruo.miradaDir = -1;
        reproducirSonido(110, 0.25, 'sawtooth', 0.04, 85);
      }
    } else if (monstruo.fase === 'buscando') {
      monstruo.timerFase -= dt;
      monstruo.miradaDir = Math.sin(monstruo.timerFase * 4.2) >= 0 ? 1 : -1;

      if (monstruo.timerFase <= 0) {
        monstruo.fase = 'saliendo';
      }
    } else if (monstruo.fase === 'saliendo') {
      monstruo.x += monstruo.dir * 165 * dt;
      if (monstruo.x < -90 || monstruo.x > canvas.width + 90) {
        monstruo.activo = false;
        monstruo.proximoAtaque = 13 + Math.random() * 6;
        gato.invulnerableTimer = 2.0;
        mostrarAviso('La entidad se marchó a otro escenario...', '#a8e6cf');
        actualizarHUD();
      }
    }

    if (!gato.escondidoEn && monstruo.sala === salaActual) {
      const dist = Math.abs(monstruo.x - gato.x);
      if (dist < 240 || monstruo.fase === 'buscando') {
        perderJuego();
      }
    }

    actualizarHUD();
  }
}

function iniciarEntradaMonstruo() {
  monstruo.activo = true;
  monstruo.sala = salaActual;
  const entraPorIzquierda = gato.x > canvas.width / 2;
  monstruo.x = entraPorIzquierda ? -55 : canvas.width + 55;
  monstruo.dir = entraPorIzquierda ? 1 : -1;
  monstruo.fase = 'entrando';
  monstruo.timerFase = 0;
  reproducirSonido(130, 0.3, 'sawtooth', 0.045, 70);
}

// --- BUCLE PRINCIPAL ---
function buclePrincipal(ahora) {
  const dt = Math.min(0.05, (ahora - ultimoFrame) / 1000);
  ultimoFrame = ahora;
  tiempoGlobal += dt;

  if (estadoJuego === 'jugando') {
    const keypadAbierto = document.getElementById('br-keypad')?.style.display === 'block';

    if (!gato.escondidoEn && !keypadAbierto) {
      let mov = 0;
      if (teclas.left) mov -= 1;
      if (teclas.right) mov += 1;

      if (mov !== 0) {
        gato.dir = mov;
        gato.caminando = true;
        gato.x = Math.max(42, Math.min(canvas.width - 42, gato.x + mov * VELOCIDAD_GATO * dt));
      } else {
        gato.caminando = false;
      }
    } else {
      gato.caminando = false;
    }

    actualizarObjetoCercano();
    actualizarAmenaza(dt);
  }

  if (mensajeFlotante.timer > 0) {
    mensajeFlotante.timer -= dt;
  }

  renderizarEscena(dt);
  animFrameId = requestAnimationFrame(buclePrincipal);
}

function actualizarObjetoCercano() {
  objetoCercano = null;
  if (gato.escondidoEn) return;

  const sala = salas[salaActual];
  for (const obj of sala.objetos) {
    if (Math.abs(gato.x - obj.x) <= 58) {
      const promptY = obj.anclaY ? obj.anclaY - obj.h / 2 - 14 : SUELO_Y - obj.h - 14;
      objetoCercano = {
        x: obj.x,
        y: promptY,
        etiqueta: obj.pista && !obj.revisado
          ? `[E] Revisar ${obj.nombre}`
          : obj.escondite
            ? `[E] Esconderse (${obj.nombre})`
            : `[E] Revisar ${obj.nombre}`
      };
      return;
    }
  }

  for (const puerta of sala.puertas) {
    if (Math.abs(gato.x - puerta.x) <= 62) {
      objetoCercano = {
        x: puerta.x,
        y: SUELO_Y - 122,
        etiqueta: puerta.destino === 'SALIDA' ? '[E] Introducir Código' : `[E] ${puerta.etiqueta}`
      };
      return;
    }
  }
}

// --- RENDERIZADO VISUAL DE BACKROOMS LIMINALES ---
function renderizarEscena(dt) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const sala = salas[salaActual] || {
    tonoPared: '#b89f4d',
    tonoFranja: '#8f7932',
    decoracionExtra: [],
    puertas: [],
    objetos: []
  };

  // 1. Pared amarilla característica de los Backrooms
  ctx.fillStyle = sala.tonoPared;
  ctx.fillRect(0, 0, canvas.width, SUELO_Y);

  // Patrón vertical del papel tapiz
  ctx.fillStyle = 'rgba(72, 58, 18, 0.14)';
  for (let x = 18; x < canvas.width; x += 36) {
    ctx.fillRect(x, 0, 8, SUELO_Y);
  }

  // Cenefa y zócalo marrón oscuro
  ctx.fillStyle = sala.tonoFranja;
  ctx.fillRect(0, 148, canvas.width, 12);
  ctx.fillStyle = '#4a3b19';
  ctx.fillRect(0, SUELO_Y - 12, canvas.width, 12);

  // 2. Luces fluorescentes del techo con parpadeo leve
  const parpadeo = Math.sin(tiempoGlobal * 27) > 0.94 ? 0.35 : 0.9;
  [160, 360, 560].forEach((lx, idx) => {
    const alfa = idx === 1 ? parpadeo : 0.85;
    const grad = ctx.createLinearGradient(lx, 0, lx, SUELO_Y);
    grad.addColorStop(0, `rgba(255, 250, 210, ${0.22 * alfa})`);
    grad.addColorStop(1, 'rgba(255, 250, 210, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(lx - 45, 8);
    ctx.lineTo(lx + 45, 8);
    ctx.lineTo(lx + 115, SUELO_Y);
    ctx.lineTo(lx - 115, SUELO_Y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = `rgba(255, 253, 232, ${alfa})`;
    ctx.fillRect(lx - 38, 4, 76, 7);
  });

  // 3. Decoración extraña / liminal de fondo (muebles en techo, puertas en pared, repeticiones)
  if (sala.decoracionExtra) {
    sala.decoracionExtra.forEach(dec => dibujarDecoracionLiminal(dec));
  }

  // 4. Alfombra húmeda del suelo
  ctx.fillStyle = '#6e5a28';
  ctx.fillRect(0, SUELO_Y, canvas.width, canvas.height - SUELO_Y);
  ctx.fillStyle = 'rgba(35, 26, 10, 0.25)';
  for (let x = 0; x < canvas.width; x += 24) {
    ctx.fillRect(x, SUELO_Y + 4, 12, canvas.height - SUELO_Y);
  }

  // 5. Puertas de transición y puerta de salida
  sala.puertas.forEach(p => dibujarPuerta(p));

  // 6. Objetos interactivos de la habitación
  sala.objetos.forEach(obj => dibujarObjeto(obj));

  // 7. Gatito
  if (!gato.escondidoEn) {
    dibujarGatitoBackrooms(gato.x, gato.y, gato.dir, gato.caminando);
  } else {
    dibujarOjosEscondidos(gato.escondidoEn.x, SUELO_Y - 22);
  }

  // 8. Ondas rojas sobre la cabeza del gatito (6 segundos)
  if (gato.ondasActivas && estadoJuego === 'jugando') {
    const anclaX = gato.escondidoEn ? gato.escondidoEn.x : gato.x;
    const anclaY = gato.escondidoEn ? SUELO_Y - gato.escondidoEn.h - 14 : gato.y - 54;
    dibujarOndasRojas(anclaX, anclaY, gato.contadorOndas);
  }

  // 9. Monstruo de los Backrooms
  if (monstruo.activo && monstruo.sala === salaActual) {
    dibujarMonstruoBackrooms(monstruo);
  }

  // 10. Viñeta oscura ambiental
  const viñeta = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    150,
    canvas.width / 2,
    canvas.height / 2,
    430
  );
  viñeta.addColorStop(0, 'rgba(0, 0, 0, 0)');
  viñeta.addColorStop(1, gato.ondasActivas || monstruo.activo ? 'rgba(35, 0, 0, 0.58)' : 'rgba(15, 12, 5, 0.48)');
  ctx.fillStyle = viñeta;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 11. Partículas, prompt de interacción y mensajes flotantes
  actualizarYRenderizarParticulas(dt);

  if (objetoCercano && estadoJuego === 'jugando') {
    dibujarPromptInteraccion(objetoCercano.x, objetoCercano.y, objetoCercano.etiqueta);
  }

  if (mensajeFlotante.timer > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, mensajeFlotante.timer);
    ctx.fillStyle = 'rgba(20, 15, 8, 0.82)';
    ctx.beginPath();
    ctx.roundRect(canvas.width / 2 - 220, 22, 440, 30, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(226, 190, 141, 0.4)';
    ctx.stroke();

    ctx.fillStyle = mensajeFlotante.color;
    ctx.font = 'bold 13px Trebuchet MS, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(mensajeFlotante.texto, canvas.width / 2, 42);
    ctx.restore();
  }

  // Pantalla de inicio en espera
  if (estadoJuego === 'espera') {
    ctx.fillStyle = 'rgba(18, 14, 7, 0.78)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#f3e5ab';
    ctx.font = 'italic 22px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('Pulsa "Jugar" para entrar a los Backrooms', canvas.width / 2, canvas.height / 2 - 12);

    ctx.fillStyle = '#cbb8a6';
    ctx.font = '13px Trebuchet MS, sans-serif';
    ctx.fillText('7 salas extrañas · Encuentra los 4 dígitos · Escóndete al ver ondas rojas', canvas.width / 2, canvas.height / 2 + 16);
  }
}

// --- DIBUJO DE ELEMENTOS LIMINALES Y EXTRAÑOS ---
function dibujarDecoracionLiminal(dec) {
  ctx.save();
  if (dec.tipo === 'silla_techo') {
    // Silla pegada boca abajo en el techo
    ctx.translate(dec.x, dec.y + 42);
    ctx.scale(1, -1);
    dibujarSiluetaSilla(0, 0, '#4d3720');
  } else if (dec.tipo === 'silla_fondo') {
    // Fila de sillas idénticas en segundo plano
    ctx.globalAlpha = 0.72;
    dibujarSiluetaSilla(dec.x, SUELO_Y - 52, '#573f26');
  } else if (dec.tipo === 'mesa_techo') {
    // Escritorio invertido colgando del techo
    ctx.translate(dec.x, dec.y + 44);
    ctx.scale(1, -1);
    ctx.fillStyle = '#4a351e';
    ctx.fillRect(-38, 0, 76, 9);
    ctx.fillRect(-32, 9, 7, 35);
    ctx.fillRect(25, 9, 7, 35);
  } else if (dec.tipo === 'lampara_techo') {
    // Lámpara de pie colgando boca abajo del techo
    ctx.translate(dec.x, dec.y + 68);
    ctx.scale(1, -1);
    ctx.fillStyle = '#3d2d1a';
    ctx.fillRect(-12, 62, 24, 6);
    ctx.fillRect(-2, 16, 4, 46);
    ctx.fillStyle = '#e8d79c';
    ctx.beginPath();
    ctx.moveTo(-14, 18);
    ctx.lineTo(14, 18);
    ctx.lineTo(9, 0);
    ctx.lineTo(-9, 0);
    ctx.closePath();
    ctx.fill();
  } else if (dec.tipo === 'maniqui_techo') {
    // Maniquí colgando invertido del techo
    ctx.translate(dec.x, dec.y + 84);
    ctx.scale(1, -1);
    dibujarSiluetaManiqui(0, 84, false);
  } else if (dec.tipo === 'puerta_pared') {
    // Puerta imposible flotando a mitad de pared sin escaleras
    ctx.fillStyle = '#3d2f18';
    ctx.fillRect(dec.x - 22, dec.y, 44, 86);
    ctx.fillStyle = '#574222';
    ctx.fillRect(dec.x - 18, dec.y + 4, 36, 82);
    ctx.fillStyle = '#cbb8a6';
    ctx.beginPath();
    ctx.arc(dec.x + 11, dec.y + 46, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (dec.tipo === 'reloj_sin_agujas') {
    // Reloj de pared blanco sin manecillas
    ctx.fillStyle = '#ece6d5';
    ctx.beginPath();
    ctx.arc(dec.x, dec.y, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3b2e1e';
    ctx.lineWidth = 3;
    ctx.stroke();
  } else if (dec.tipo === 'espejo_roto') {
    // Espejo oscuro con grietas
    ctx.fillStyle = '#2b3336';
    ctx.fillRect(dec.x - 22, dec.y - 34, 44, 68);
    ctx.strokeStyle = '#5c4628';
    ctx.lineWidth = 3;
    ctx.strokeRect(dec.x - 22, dec.y - 34, 44, 68);
    ctx.strokeStyle = 'rgba(220, 235, 240, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(dec.x - 10, dec.y - 20);
    ctx.lineTo(dec.x + 4, dec.y + 2);
    ctx.lineTo(dec.x - 6, dec.y + 24);
    ctx.moveTo(dec.x + 4, dec.y + 2);
    ctx.lineTo(dec.x + 16, dec.y - 8);
    ctx.stroke();
  } else if (dec.tipo === 'torre_cajas') {
    // Pilas infinitas de cajas idénticas hasta el techo
    for (let cy = SUELO_Y - 38; cy > -20; cy -= 38) {
      ctx.fillStyle = '#7d613d';
      ctx.fillRect(dec.x - 22, cy, 44, 38);
      ctx.strokeStyle = '#473620';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(dec.x - 22, cy, 44, 38);
    }
  }
  ctx.restore();
}

function dibujarSiluetaSilla(x, topY, color) {
  ctx.fillStyle = color;
  // Respaldo
  ctx.fillRect(x - 14, topY, 5, 32);
  ctx.fillRect(x - 14, topY + 4, 24, 5);
  ctx.fillRect(x - 14, topY + 14, 24, 5);
  // Asiento
  ctx.fillRect(x - 14, topY + 28, 28, 5);
  // Patas
  ctx.fillRect(x - 14, topY + 33, 5, 19);
  ctx.fillRect(x + 9, topY + 33, 5, 19);
}

function dibujarSiluetaManiqui(x, baseY, inclinado = false) {
  ctx.save();
  ctx.translate(x, baseY);
  if (inclinado) ctx.rotate(0.14);

  // Pedestal
  ctx.fillStyle = '#3b332b';
  ctx.fillRect(-16, -6, 32, 6);

  // Poste metálico
  ctx.fillStyle = '#6e685f';
  ctx.fillRect(-2, -36, 4, 30);

  // Torso articulado beige pálido
  ctx.fillStyle = '#d9cbb8';
  ctx.beginPath();
  ctx.ellipse(0, -54, 11, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  // Brazos articulados rígidos
  ctx.strokeStyle = '#c4b49f';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-11, -68);
  ctx.lineTo(-18, -42);
  ctx.moveTo(11, -68);
  ctx.lineTo(17, -45);
  ctx.stroke();

  // Cuello y cabeza lisa sin rostro
  ctx.fillStyle = '#d9cbb8';
  ctx.fillRect(-3, -78, 6, 6);
  ctx.beginPath();
  ctx.ellipse(0, -86, 8, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function dibujarPuerta(p) {
  const esSalida = p.destino === 'SALIDA';
  const w = 52;
  const h = 112;
  const x = p.x - w / 2;
  const y = SUELO_Y - h;

  ctx.save();
  ctx.fillStyle = esSalida ? '#3b1d1d' : '#3d2f18';
  ctx.fillRect(x - 4, y - 4, w + 8, h + 4);

  ctx.fillStyle = esSalida ? '#592828' : '#5c4624';
  ctx.fillRect(x, y, w, h);

  ctx.fillStyle = esSalida ? '#ff6b6b' : '#e2be8d';
  ctx.beginPath();
  ctx.arc(p.x + 16, y + h / 2, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = esSalida ? '#9e2a2b' : 'rgba(24, 18, 9, 0.82)';
  ctx.fillRect(p.x - 32, y - 24, 64, 17);
  ctx.fillStyle = esSalida ? '#ffe3e3' : '#e2be8d';
  ctx.font = 'bold 10px Trebuchet MS, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(p.etiqueta, p.x, y - 12);
  ctx.restore();
}

function dibujarObjeto(obj) {
  const x = obj.x - obj.w / 2;
  const y = obj.anclaY ? obj.anclaY - obj.h / 2 : SUELO_Y - obj.h;

  ctx.save();
  if (obj.tipo === 'taquilla') {
    ctx.fillStyle = '#4e5452';
    ctx.fillRect(x, y, obj.w, obj.h);
    ctx.strokeStyle = '#2c302e';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, obj.w, obj.h);
    ctx.fillStyle = '#232625';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(x + 10, y + 14 + i * 7, obj.w - 20, 3);
    }
    ctx.fillStyle = '#cbb8a6';
    ctx.fillRect(x + obj.w - 11, y + obj.h / 2 - 6, 4, 12);
  } else if (obj.tipo === 'mesa') {
    ctx.fillStyle = '#5c4328';
    ctx.fillRect(x, y, obj.w, 10);
    ctx.fillRect(x + 6, y + 10, 8, obj.h - 10);
    ctx.fillRect(x + obj.w - 14, y + 10, 8, obj.h - 10);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.fillRect(x + 14, y + 10, obj.w - 28, obj.h - 10);
  } else if (obj.tipo === 'mesa_pared') {
    // Mesa incrustada horizontalmente saliendo de la pared
    ctx.fillStyle = '#5c4328';
    ctx.fillRect(x, y + 14, obj.w, 10);
    ctx.fillRect(x + 10, y, 8, 14);
    ctx.fillRect(x + obj.w - 18, y, 8, 14);
    ctx.strokeStyle = '#362615';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y + 14, obj.w, 10);
  } else if (obj.tipo === 'caja') {
    ctx.fillStyle = '#8c6d46';
    ctx.fillRect(x, y, obj.w, obj.h);
    ctx.strokeStyle = '#4d3a22';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, obj.w, obj.h);
    ctx.beginPath();
    ctx.moveTo(x, y + obj.h / 2);
    ctx.lineTo(x + obj.w, y + obj.h / 2);
    ctx.stroke();
  } else if (obj.tipo === 'silla_interactiva') {
    dibujarSiluetaSilla(obj.x, y, '#6b4d2e');
  } else if (obj.tipo === 'maniqui' || obj.tipo === 'maniqui_inclinado') {
    dibujarSiluetaManiqui(obj.x, SUELO_Y, obj.tipo === 'maniqui_inclinado');
  } else if (obj.tipo === 'puerta_falsa') {
    ctx.fillStyle = '#3d2f18';
    ctx.fillRect(x - 3, y - 3, obj.w + 6, obj.h + 3);
    ctx.fillStyle = '#543f20';
    ctx.fillRect(x, y, obj.w, obj.h);
    ctx.fillStyle = '#cbb8a6';
    ctx.beginPath();
    ctx.arc(obj.x + 14, y + obj.h / 2, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (obj.tipo === 'cuadro_ojo') {
    ctx.save();
    ctx.translate(obj.x, obj.anclaY);
    ctx.rotate(-0.07);
    ctx.fillStyle = '#2b2116';
    ctx.fillRect(-obj.w / 2, -obj.h / 2, obj.w, obj.h);
    ctx.strokeStyle = '#5c4328';
    ctx.lineWidth = 3;
    ctx.strokeRect(-obj.w / 2, -obj.h / 2, obj.w, obj.h);
    // Ojo pintado en el cuadro que sigue al gato
    const miradaX = Math.max(-6, Math.min(6, (gato.x - obj.x) * 0.03));
    ctx.fillStyle = '#ede4d3';
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c140d';
    ctx.beginPath();
    ctx.arc(miradaX, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (obj.tipo === 'monitor') {
    ctx.fillStyle = '#4a3b2c';
    ctx.fillRect(x + 4, y + 24, obj.w - 8, 24);
    ctx.fillStyle = '#b8b2a2';
    ctx.fillRect(x + 8, y, obj.w - 16, 24);
    ctx.fillStyle = '#263832';
    ctx.fillRect(x + 12, y + 4, obj.w - 24, 15);
  }

  // Destello dorado sutil si aún no ha sido revisado
  if (!obj.revisado && estadoJuego === 'jugando') {
    const brillo = 0.45 + Math.sin(tiempoGlobal * 5) * 0.35;
    const indicatorY = y - 10;
    ctx.fillStyle = `rgba(255, 226, 138, ${brillo})`;
    ctx.beginPath();
    ctx.arc(obj.x, indicatorY, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function dibujarGatitoBackrooms(x, y, dir, caminando) {
  ctx.save();
  const rebote = caminando ? Math.abs(Math.sin(tiempoGlobal * 14)) * 3.5 : Math.sin(tiempoGlobal * 3) * 1;
  ctx.translate(x, y - 22 - rebote);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
  ctx.beginPath();
  ctx.ellipse(0, 22 + rebote, 17, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.scale(dir, 1);

  ctx.strokeStyle = '#e2be8d';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-12, 8);
  ctx.quadraticCurveTo(-24, -2 + Math.sin(tiempoGlobal * 6) * 4, -20, -12);
  ctx.stroke();

  ctx.fillStyle = '#e2be8d';
  ctx.beginPath();
  ctx.ellipse(-2, 8, 14, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  const paso = caminando ? Math.sin(tiempoGlobal * 14) * 4 : 0;
  ctx.fillRect(-10 + paso, 15, 5, 7);
  ctx.fillRect(4 - paso, 15, 5, 7);

  ctx.beginPath();
  ctx.arc(6, -5, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-4, -14);
  ctx.lineTo(-1, -26);
  ctx.lineTo(5, -17);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(8, -17);
  ctx.lineTo(14, -26);
  ctx.lineTo(17, -14);
  ctx.fill();

  ctx.fillStyle = '#1c120c';
  ctx.beginPath();
  ctx.arc(3, -6, 2.2, 0, Math.PI * 2);
  ctx.arc(13, -6, 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(2.5, -6.8, 0.8, 0, Math.PI * 2);
  ctx.arc(12.5, -6.8, 0.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#e07a5f';
  ctx.beginPath();
  ctx.arc(9, -2, 1.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function dibujarOjosEscondidos(x, y) {
  ctx.save();
  ctx.fillStyle = '#ffe28a';
  ctx.beginPath();
  ctx.arc(x - 5, y, 2.3, 0, Math.PI * 2);
  ctx.arc(x + 5, y, 2.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function dibujarOndasRojas(x, y, segundosRestantes) {
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const fase = (tiempoGlobal * 2.4 + i * 0.33) % 1;
    const radio = 10 + fase * 26;
    const alpha = (1 - fase) * 0.85;

    ctx.strokeStyle = `rgba(255, 55, 55, ${alpha})`;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(x, y, radio, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }

  ctx.fillStyle = '#ff4d4d';
  ctx.font = 'bold 14px Trebuchet MS, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.max(0, segundosRestantes).toFixed(1)}s`, x, y - 24);
  ctx.restore();
}

function dibujarMonstruoBackrooms(m) {
  ctx.save();
  const balanceo = Math.sin(tiempoGlobal * 8) * 3;
  ctx.translate(m.x, SUELO_Y + balanceo);

  const orientacion = m.fase === 'buscando' ? m.miradaDir : m.dir;
  ctx.scale(orientacion, 1);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.beginPath();
  ctx.ellipse(0, -balanceo, 26, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#14110f';
  ctx.fillStyle = '#14110f';
  ctx.lineCap = 'round';

  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-6, -65);
  ctx.lineTo(-14, -32);
  ctx.lineTo(-10, 0);
  ctx.moveTo(6, -65);
  ctx.lineTo(14, -32);
  ctx.lineTo(10, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(0, -95, 13, 34, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-11, -118);
  ctx.quadraticCurveTo(-24, -75, -18, -36);
  ctx.moveTo(11, -118);
  ctx.quadraticCurveTo(26, -75, 20, -36);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(4, -138, 12, 15, 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ff3b3b';
  ctx.shadowColor = '#ff3b3b';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(9, -139, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function dibujarPromptInteraccion(x, y, texto) {
  ctx.save();
  ctx.font = 'bold 11px Trebuchet MS, sans-serif';
  const ancho = ctx.measureText(texto).width + 18;
  ctx.fillStyle = 'rgba(20, 15, 8, 0.85)';
  ctx.beginPath();
  ctx.roundRect(x - ancho / 2, y - 16, ancho, 20, 6);
  ctx.fill();

  ctx.strokeStyle = 'rgba(226, 190, 141, 0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#f3e5ab';
  ctx.textAlign = 'center';
  ctx.fillText(texto, x, y - 2);
  ctx.restore();
}

function actualizarYRenderizarParticulas(dt) {
  for (let i = particulas.length - 1; i >= 0; i--) {
    const p = particulas[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vida -= dt * 2.1;
    if (p.vida <= 0) {
      particulas.splice(i, 1);
      continue;
    }
    ctx.save();
    ctx.globalAlpha = p.vida;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radio, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Dibujo inicial en espera al cargar la página
construirEscenarios();
renderizarEscena(0);