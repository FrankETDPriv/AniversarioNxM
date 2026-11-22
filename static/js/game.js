// =========================================================================
// MINIJUEGO ESTRATÉGICO PULIDO: EL JARDÍN DEL GATITO (static/js/game.js)
// =========================================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const FILAS = 3;
const COLUMNAS = 7;
const ANCHO_CELDA = canvas.width / COLUMNAS;
const ALTO_CELDA = canvas.height / FILAS;
const META_SEGUNDOS = 60;

const COSTOS = {
  cat: 25,
  yarn: 20,
  cushion: 15
};

let herramientaActual = 'cat';
let energia = 55;
let segundosSobrevividos = 0;
let nivelOleada = 1;
let juegoActivo = false;
let juegoTerminado = false;

let unidades = [];
let proyectiles = [];
let enemigos = [];
let particulas = [];
let textosFlotantes = [];

let celdaHover = { fila: -1, col: -1 };
let tiempoGlobal = 0;
let ultimoFrame = 0;
let ultimoSpawn = 0;
let animFrameId = null;
let timerIntervalId = null;
let timeoutPremioId = null;

// --- SINTETIZADOR DE EFECTOS SUAVES (SIN ARCHIVOS EXTERNOS) ---
let audioCtx = null;
function reproducirTono(freq, duracion = 0.08, tipo = 'sine', vol = 0.04) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.15, audioCtx.currentTime + duracion);

    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duracion);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duracion);
  } catch (e) {
    // Silencioso si el entorno bloquea audio
  }
}

// --- SELECCIÓN Y HUD ---
function seleccionarHerramienta(tipo, btn) {
  herramientaActual = tipo;
  document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

function actualizarHUD() {
  document.getElementById('cat-energy').textContent = energia;
  document.getElementById('cat-wave').textContent = nivelOleada;
  document.getElementById('cat-timer').textContent = segundosSobrevividos;

  // Actualiza visualmente qué botones se pueden pagar
  document.querySelectorAll('.tower-btn').forEach(btn => {
    const tipo = btn.dataset.type;
    const puedePagar = energia >= COSTOS[tipo];
    btn.style.opacity = puedePagar ? '1' : '0.5';
  });
}

// --- INTERACCIÓN CON EL TABLERO ---
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  celdaHover = {
    col: Math.floor(x / ANCHO_CELDA),
    fila: Math.floor(y / ALTO_CELDA)
  };
});

canvas.addEventListener('mouseleave', () => {
  celdaHover = { fila: -1, col: -1 };
});

// Clic izquierdo: colocar unidad
canvas.addEventListener('click', e => {
  if (!juegoActivo || juegoTerminado) return;

  const { fila, col } = celdaHover;
  if (col <= 0 || col >= COLUMNAS || fila < 0 || fila >= FILAS) return;

  const ocupada = unidades.some(u => u.fila === fila && u.col === col);
  if (ocupada) {
    crearTextoFlotante(col * ANCHO_CELDA + ANCHO_CELDA / 2, fila * ALTO_CELDA + 25, 'Ocupado', '#cbb8a6');
    return;
  }

  const costo = COSTOS[herramientaActual];
  if (energia < costo) {
    crearTextoFlotante(col * ANCHO_CELDA + ANCHO_CELDA / 2, fila * ALTO_CELDA + 25, 'Falta cariño', '#e07a5f');
    return;
  }

  energia -= costo;
  actualizarHUD();
  reproducirTono(520, 0.09, 'triangle', 0.05);

  const cx = col * ANCHO_CELDA + ANCHO_CELDA / 2;
  const cy = fila * ALTO_CELDA + ALTO_CELDA / 2;

  unidades.push({
    tipo: herramientaActual,
    fila,
    col,
    x: cx,
    y: cy,
    hp: herramientaActual === 'cushion' ? 280 : 100,
    maxHp: herramientaActual === 'cushion' ? 280 : 100,
    timer: 0,
    pulso: 1.35 // Efecto de rebote al aparecer
  });

  crearParticulas(cx, cy, '#e2be8d', 10);
});

// Clic derecho: retirar unidad y recuperar mitad del costo
canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (!juegoActivo || juegoTerminado) return;

  const { fila, col } = celdaHover;
  const idx = unidades.findIndex(u => u.fila === fila && u.col === col);
  if (idx !== -1) {
    const u = unidades[idx];
    const reembolso = Math.floor(COSTOS[u.tipo] / 2);
    energia += reembolso;
    actualizarHUD();
    crearTextoFlotante(u.x, u.y - 10, `+${reembolso}`, '#e2be8d');
    crearParticulas(u.x, u.y, '#cbb8a6', 8);
    unidades.splice(idx, 1);
    reproducirTono(340, 0.07, 'sine', 0.04);
  }
});

// --- CONTROL DE PARTIDA ---
function iniciarJuego() {
  if (animFrameId) cancelAnimationFrame(animFrameId);
  if (timerIntervalId) clearInterval(timerIntervalId);
  if (timeoutPremioId) clearTimeout(timeoutPremioId);

  const btnPlay = document.getElementById('btn-play-game');
  if (btnPlay) btnPlay.textContent = 'Reiniciar';

  energia = 55;
  segundosSobrevividos = 0;
  nivelOleada = 1;
  juegoActivo = true;
  juegoTerminado = false;
  ultimoFrame = performance.now();
  ultimoSpawn = ultimoFrame;

  unidades = [];
  proyectiles = [];
  enemigos = [];
  particulas = [];
  textosFlotantes = [];

  const premioEl = document.getElementById('premio');
  premioEl.style.display = 'none';
  premioEl.textContent = '';

  actualizarHUD();
  reproducirTono(660, 0.12, 'sine', 0.05);

  timerIntervalId = setInterval(() => {
    if (!juegoActivo || juegoTerminado) return;

    segundosSobrevividos++;
    const nuevaOleada = Math.floor(segundosSobrevividos / 12) + 1;
    if (nuevaOleada > nivelOleada) {
      nivelOleada = nuevaOleada;
      crearTextoFlotante(canvas.width / 2, 42, `Oleada ${nivelOleada}`, '#e2be8d');
      reproducirTono(740, 0.14, 'triangle', 0.05);
    }

    if (segundosSobrevividos % 3 === 0) {
      energia += 5;
    }

    actualizarHUD();

    if (segundosSobrevividos >= META_SEGUNDOS) {
      completarDemo();
    }
  }, 1000);

  animFrameId = requestAnimationFrame(bucleJuego);
}

function completarDemo() {
  juegoActivo = false;
  juegoTerminado = true;
  clearInterval(timerIntervalId);

  reproducirTono(523, 0.12, 'sine', 0.05);
  setTimeout(() => reproducirTono(659, 0.12, 'sine', 0.05), 110);
  setTimeout(() => reproducirTono(784, 0.22, 'sine', 0.06), 220);

  const premioEl = document.getElementById('premio');
  premioEl.style.display = 'block';
  premioEl.textContent = '¿eSEPRABAS UN PREMio? Pues parece que llegara el algun momento  21.XX.202X';

  timeoutPremioId = setTimeout(() => {
    premioEl.textContent = 'Gracias por jugar la demo';
  }, 4500);
}

function perderPartida() {
  juegoActivo = false;
  juegoTerminado = true;
  clearInterval(timerIntervalId);
  reproducirTono(220, 0.25, 'sawtooth', 0.04);

  const premioEl = document.getElementById('premio');
  premioEl.style.display = 'block';
  premioEl.textContent = 'Un ratoncito despertó al gatito de su siesta. Pulsa Reiniciar para intentarlo otra vez.';
}

// --- EFECTOS VISUALES ---
function crearParticulas(x, y, color, cantidad = 8) {
  for (let i = 0; i < cantidad; i++) {
    const ang = (Math.PI * 2 * i) / cantidad + Math.random() * 0.4;
    const vel = 0.8 + Math.random() * 2.2;
    particulas.push({
      x,
      y,
      vx: Math.cos(ang) * vel,
      vy: Math.sin(ang) * vel,
      vida: 1,
      color,
      radio: 2 + Math.random() * 2.5
    });
  }
}

function crearTextoFlotante(x, y, texto, color = '#e2be8d') {
  textosFlotantes.push({ x, y, texto, color, vida: 1 });
}

// --- DIBUJO DE TABLERO Y ENTIDADES ---
function dibujarTablero() {
  for (let f = 0; f < FILAS; f++) {
    for (let c = 0; c < COLUMNAS; c++) {
      const x = c * ANCHO_CELDA;
      const y = f * ALTO_CELDA;

      ctx.fillStyle = (f + c) % 2 === 0 ? '#2b1e16' : '#241912';
      ctx.fillRect(x, y, ANCHO_CELDA, ALTO_CELDA);

      ctx.strokeStyle = 'rgba(226, 190, 141, 0.07)';
      ctx.strokeRect(x, y, ANCHO_CELDA, ALTO_CELDA);

      // Resaltado interactivo de casilla bajo el cursor
      if (juegoActivo && !juegoTerminado && c > 0 && celdaHover.fila === f && celdaHover.col === c) {
        const ocupada = unidades.some(u => u.fila === f && u.col === c);
        ctx.fillStyle = ocupada ? 'rgba(224, 122, 95, 0.14)' : 'rgba(226, 190, 141, 0.16)';
        ctx.fillRect(x + 2, y + 2, ANCHO_CELDA - 4, ALTO_CELDA - 4);
      }
    }

    // Zona protegida (columna 0: camas de los gatitos durmiendo)
    ctx.fillStyle = 'rgba(201, 138, 91, 0.12)';
    ctx.fillRect(0, f * ALTO_CELDA, ANCHO_CELDA, ALTO_CELDA);

    const cy = f * ALTO_CELDA + ALTO_CELDA / 2;
    dibujarGatito(ANCHO_CELDA / 2, cy, '#c98a5b', true, 1);

    // "Zzz" flotando suavemente sobre los gatitos dormidos
    const offsetZ = Math.sin(tiempoGlobal * 2.5 + f) * 3;
    ctx.fillStyle = 'rgba(226, 190, 141, 0.55)';
    ctx.font = 'italic 11px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('zZz', ANCHO_CELDA / 2 + 18, cy - 18 + offsetZ);
  }
}

function dibujarGatito(x, y, color, dormido = false, escala = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(escala, escala);

  // Sombra suave
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(0, 16, 16, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Orejas
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-16, -8);
  ctx.lineTo(-10, -24);
  ctx.lineTo(-2, -12);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(16, -8);
  ctx.lineTo(10, -24);
  ctx.lineTo(2, -12);
  ctx.fill();

  // Cabeza
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.fill();

  // Ojos
  ctx.strokeStyle = '#1c120c';
  ctx.fillStyle = '#1c120c';
  ctx.lineWidth = 2;
  if (dormido) {
    ctx.beginPath();
    ctx.arc(-6, -2, 3, 0, Math.PI);
    ctx.arc(6, -2, 3, 0, Math.PI);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(-6, -3, 2.4, 0, Math.PI * 2);
    ctx.arc(6, -3, 2.4, 0, Math.PI * 2);
    ctx.fill();

    // Brillo en ojos
    ctx.fillStyle = '#f7efe6';
    ctx.beginPath();
    ctx.arc(-7, -4, 0.9, 0, Math.PI * 2);
    ctx.arc(5, -4, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // Nariz y bigotes
  ctx.fillStyle = '#f7efe6';
  ctx.beginPath();
  ctx.arc(0, 3, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(247, 239, 230, 0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-10, 2); ctx.lineTo(-22, 0);
  ctx.moveTo(-10, 5); ctx.lineTo(-22, 7);
  ctx.moveTo(10, 2); ctx.lineTo(22, 0);
  ctx.moveTo(10, 5); ctx.lineTo(22, 7);
  ctx.stroke();

  ctx.restore();
}

function dibujarOvillo(x, y, escala = 1, progreso = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(escala, escala);

  // Halo de carga cuando está por producir cariño
  if (progreso > 0.75) {
    ctx.strokeStyle = 'rgba(226, 190, 141, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = '#e2be8d';
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#5c3f2b';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(-3, -2, 11, 0.2, 2.4);
  ctx.moveTo(-12, 5);
  ctx.quadraticCurveTo(0, -4, 13, 4);
  ctx.stroke();

  ctx.restore();
}

function dibujarCojin(x, y, hp, maxHp, escala = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(escala, escala);

  const ratio = Math.max(0.35, hp / maxHp);
  ctx.globalAlpha = ratio;
  ctx.fillStyle = '#8c583a';
  ctx.beginPath();
  ctx.roundRect(-18, -16, 36, 32, 8);
  ctx.fill();

  ctx.strokeStyle = '#e2be8d';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-12, -10, 24, 20);
  ctx.restore();
}

function dibujarRatoncito(e) {
  ctx.save();
  const reboteY = Math.sin(tiempoGlobal * (e.tipo === 'veloz' ? 16 : 10) + e.x * 0.1) * 2;
  ctx.translate(e.x, e.y + reboteY);

  const escala = e.tipo === 'blindado' ? 1.25 : e.tipo === 'veloz' ? 0.88 : 1;
  ctx.scale(escala, escala);

  // Cola
  ctx.strokeStyle = '#cbb8a6';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(14, 2);
  ctx.quadraticCurveTo(24, -6, 28, 4);
  ctx.stroke();

  // Cuerpo según tipo
  ctx.fillStyle = e.tipo === 'blindado' ? '#6e4730' : e.tipo === 'veloz' ? '#c97252' : '#9c8b7e';
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  // Casquito si es blindado
  if (e.tipo === 'blindado') {
    ctx.strokeStyle = '#e2be8d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-2, -1, 13, Math.PI * 0.9, Math.PI * 1.9);
    ctx.stroke();
  }

  // Oreja
  ctx.beginPath();
  ctx.arc(-7, -10, 5, 0, Math.PI * 2);
  ctx.fill();

  // Ojo
  ctx.fillStyle = '#16100c';
  ctx.beginPath();
  ctx.arc(-10, -2, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Barra de vida discreta si recibió daño
  if (e.hp < e.maxHp) {
    const anchoBarra = 28;
    const pct = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(e.x - anchoBarra / 2, e.y - 22, anchoBarra, 4);
    ctx.fillStyle = '#e2be8d';
    ctx.fillRect(e.x - anchoBarra / 2, e.y - 22, anchoBarra * pct, 4);
  }
}

// --- BUCLE PRINCIPAL ---
function bucleJuego(ahora) {
  const dt = Math.min(0.05, (ahora - ultimoFrame) / 1000);
  ultimoFrame = ahora;
  tiempoGlobal += dt;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  dibujarTablero();

  if (juegoActivo && !juegoTerminado) {
    // Generación progresiva de visitantes según oleada
    const intervaloSpawn = Math.max(900, 3100 - (nivelOleada - 1) * 450);
    if (ahora - ultimoSpawn > intervaloSpawn) {
      const filaAleatoria = Math.floor(Math.random() * FILAS);
      const roll = Math.random();
      let tipo = 'normal';
      if (nivelOleada >= 4 && roll < 0.25) tipo = 'blindado';
      else if (nivelOleada >= 2 && roll < 0.5) tipo = 'veloz';

      const hpBase = tipo === 'blindado' ? 160 : tipo === 'veloz' ? 50 : 80;
      const speedBase = tipo === 'blindado' ? 0.34 : tipo === 'veloz' ? 0.88 : 0.52;

      enemigos.push({
        tipo,
        fila: filaAleatoria,
        x: canvas.width + 22,
        y: filaAleatoria * ALTO_CELDA + ALTO_CELDA / 2,
        speed: speedBase + (nivelOleada - 1) * 0.06,
        hp: hpBase + (nivelOleada - 1) * 14,
        maxHp: hpBase + (nivelOleada - 1) * 14
      });
      ultimoSpawn = ahora;
    }

    // Actualizar unidades
    unidades.forEach(u => {
      u.timer += dt;
      if (u.pulso > 1) u.pulso = Math.max(1, u.pulso - dt * 2.5);

      if (u.tipo === 'cat') {
        const hayEnemigoEnFila = enemigos.some(e => e.fila === u.fila && e.x > u.x);
        if (hayEnemigoEnFila && u.timer >= 1.15) {
          proyectiles.push({ fila: u.fila, x: u.x + 18, y: u.y, speed: 290, dmg: 28 });
          u.timer = 0;
          u.pulso = 1.18;
          reproducirTono(780, 0.05, 'sine', 0.025);
        }
      } else if (u.tipo === 'yarn') {
        if (u.timer >= 4.2) {
          energia += 15;
          actualizarHUD();
          crearTextoFlotante(u.x, u.y - 14, '+15', '#e2be8d');
          crearParticulas(u.x, u.y, '#e2be8d', 8);
          reproducirTono(620, 0.08, 'triangle', 0.035);
          u.timer = 0;
          u.pulso = 1.22;
        }
      }
    });

    // Actualizar proyectiles (ondas de cariño)
    for (let i = proyectiles.length - 1; i >= 0; i--) {
      const p = proyectiles[i];
      p.x += p.speed * dt;

      const objetivo = enemigos.find(e => e.fila === p.fila && Math.abs(e.x - p.x) < 18);
      if (objetivo) {
        objetivo.hp -= p.dmg;
        crearParticulas(p.x, p.y, '#f7efe6', 5);
        proyectiles.splice(i, 1);
      } else if (p.x > canvas.width) {
        proyectiles.splice(i, 1);
      }
    }

    // Actualizar enemigos
    for (let i = enemigos.length - 1; i >= 0; i--) {
      const e = enemigos[i];
      if (e.hp <= 0) {
        const recompensa = e.tipo === 'blindado' ? 15 : 8;
        energia += recompensa;
        actualizarHUD();
        crearTextoFlotante(e.x, e.y - 10, `+${recompensa}`, '#e2be8d');
        crearParticulas(e.x, e.y, '#c98a5b', 12);
        reproducirTono(440, 0.08, 'sine', 0.035);
        enemigos.splice(i, 1);
        continue;
      }

      const defensa = unidades.find(u => u.fila === e.fila && Math.abs(u.x - e.x) < 28);
      if (defensa) {
        defensa.hp -= 26 * dt;
        if (defensa.hp <= 0) {
          crearParticulas(defensa.x, defensa.y, '#cbb8a6', 10);
          unidades = unidades.filter(u => u !== defensa);
        }
      } else {
        e.x -= e.speed * 60 * dt;
      }

      if (e.x <= ANCHO_CELDA * 0.78) {
        perderPartida();
        break;
      }
    }
  }

  // Renderizar unidades
  unidades.forEach(u => {
    if (u.tipo === 'cat') dibujarGatito(u.x, u.y, '#e2be8d', false, u.pulso);
    if (u.tipo === 'yarn') dibujarOvillo(u.x, u.y, u.pulso, u.timer / 4.2);
    if (u.tipo === 'cushion') dibujarCojin(u.x, u.y, u.hp, u.maxHp, u.pulso);
  });

  // Renderizar proyectiles estilo onda/corazón luminoso
  proyectiles.forEach(p => {
    ctx.save();
    ctx.fillStyle = '#f7efe6';
    ctx.shadowColor = '#e2be8d';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // Renderizar enemigos
  enemigos.forEach(e => dibujarRatoncito(e));

  // Renderizar partículas
  for (let i = particulas.length - 1; i >= 0; i--) {
    const pt = particulas[i];
    pt.x += pt.vx;
    pt.y += pt.vy;
    pt.vida -= dt * 2.2;
    if (pt.vida <= 0) {
      particulas.splice(i, 1);
      continue;
    }
    ctx.save();
    ctx.globalAlpha = pt.vida;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.radio, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Renderizar textos flotantes
  for (let i = textosFlotantes.length - 1; i >= 0; i--) {
    const tf = textosFlotantes[i];
    tf.y -= 28 * dt;
    tf.vida -= dt * 1.1;
    if (tf.vida <= 0) {
      textosFlotantes.splice(i, 1);
      continue;
    }
    ctx.save();
    ctx.globalAlpha = tf.vida;
    ctx.fillStyle = tf.color;
    ctx.font = 'bold 13px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(tf.texto, tf.x, tf.y);
    ctx.restore();
  }

  animFrameId = requestAnimationFrame(bucleJuego);
}

// Pantalla inicial en espera antes de pulsar Play
function dibujarPantallaEspera() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  dibujarTablero();

  ctx.fillStyle = 'rgba(22, 16, 12, 0.72)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#e2be8d';
  ctx.font = 'italic 23px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('Presiona "Play" para proteger la siesta del gatito', canvas.width / 2, canvas.height / 2 - 8);

  ctx.fillStyle = '#cbb8a6';
  ctx.font = '13px Trebuchet MS, sans-serif';
  ctx.fillText('Clic izquierdo para colocar fichas · Clic derecho para retirar', canvas.width / 2, canvas.height / 2 + 20);
}

dibujarPantallaEspera();