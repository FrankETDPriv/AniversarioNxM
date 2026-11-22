document.addEventListener('DOMContentLoaded', () => {
  // Respaldo seguro por si data.js aún no tiene datos o falla al cargar
  const galeriaSegura = typeof GALERIA_DATA !== 'undefined' ? GALERIA_DATA : {};
  const cartaSegura = typeof TEXTO_CARTA_COMPLETA !== 'undefined' ? TEXTO_CARTA_COMPLETA : '';

  // =========================================================================
  // 1. CONTADOR DE TIEMPO DE RELACIÓN (Inicio: 21 de Noviembre de 2022)
  // =========================================================================
  function actualizarContadorRelacion() {
    const fechaInicio = new Date(2022, 10, 21);
    const hoy = new Date();

    let anos = hoy.getFullYear() - fechaInicio.getFullYear();
    let meses = hoy.getMonth() - fechaInicio.getMonth();
    let dias = hoy.getDate() - fechaInicio.getDate();

    if (dias < 0) {
      meses--;
      const ultimoDiaMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0).getDate();
      dias += ultimoDiaMesAnterior;
    }

    if (meses < 0) {
      anos--;
      meses += 12;
    }

    const diffTiempo = hoy.setHours(0, 0, 0, 0) - fechaInicio.setHours(0, 0, 0, 0);
    const diasTotales = Math.max(0, Math.floor(diffTiempo / (1000 * 60 * 60 * 24)));

    const elYears = document.getElementById('cnt-years');
    const elMonths = document.getElementById('cnt-months');
    const elDays = document.getElementById('cnt-days');
    const elTotal = document.getElementById('cnt-total-days');

    if (elYears) elYears.textContent = anos;
    if (elMonths) elMonths.textContent = meses;
    if (elDays) elDays.textContent = dias;
    if (elTotal) elTotal.textContent = diasTotales;
  }

  actualizarContadorRelacion();

  // =========================================================================
  // 2. BLOC DE NOTAS INTERACTIVO (ARRANCAR, DEVOLVER Y LEER COMPLETA)
  // =========================================================================
  const MIS_NOTAS = [
    "Nuestro primer año de pareja, fue algo tan especial. Pues estábamos dando inicio a un largo y bonito recorrido juntos, lleno de ilusiones y nuevas experiencias.",
    "Nuestro segundo año de pareja, fue una parada más en nuestro camino. Donde descubrimos y reafirmamos lo mucho que nos amamos.",
    "Nuestro tercer año de pareja, fue una etapa más tranquila y sencilla. Pero también reflexiva, en la que pudimos mirar atrás y reconocer todas las cosas que habíamos vivido y superado juntos.",
    "Nuestro cuarto año de pareja fue una etapa de muchas bajas y momentos difíciles, pero también de reencuentros. Porque, a pesar de todo lo que pasamos, nuestro amor encontró la manera de recuperar aquella llama que nos acompañó desde el primer año."
  ];

  let indiceNota = 0;
  let animandoNota = false;

  function renderizarNota() {
    const hoja = document.getElementById('notepad-sheet');
    const numeroEl = document.getElementById('note-number');
    const cuerpoEl = document.getElementById('note-body');
    const btnDevolver = document.getElementById('btn-return-note');
    const btnArrancar = document.getElementById('btn-tear-note');
    if (!hoja || !numeroEl || !cuerpoEl) return;

    const texto = MIS_NOTAS[indiceNota];
    numeroEl.textContent = `Nota ${indiceNota + 1} / ${MIS_NOTAS.length}`;
    cuerpoEl.textContent = texto;

    hoja.classList.toggle('compact-note', texto.length > 135);
    hoja.classList.remove('has-overflow');

    requestAnimationFrame(() => {
      if (cuerpoEl.scrollHeight > cuerpoEl.clientHeight + 2) {
        hoja.classList.add('has-overflow');
      }
    });

    if (btnDevolver) btnDevolver.disabled = indiceNota === 0;
    if (btnArrancar) btnArrancar.disabled = indiceNota >= MIS_NOTAS.length - 1;
  }

  window.abrirNotaCompleta = function () {
    const modal = document.getElementById('note-modal');
    if (!modal) return;
    document.getElementById('modal-note-number').textContent = `Nota ${indiceNota + 1} de ${MIS_NOTAS.length} — Para ti`;
    document.getElementById('modal-note-body').textContent = MIS_NOTAS[indiceNota];
    modal.classList.add('open');
  };

  window.cerrarNotaModal = function (event) {
    if (!event || event.target.id === 'note-modal') {
      const modal = document.getElementById('note-modal');
      if (modal) modal.classList.remove('open');
    }
  };

  window.arrancarNota = function () {
    if (animandoNota || indiceNota >= MIS_NOTAS.length - 1) return;
    animandoNota = true;

    const hoja = document.getElementById('notepad-sheet');
    if (!hoja) return;
    hoja.classList.add('tearing-out');

    setTimeout(() => {
      indiceNota++;
      renderizarNota();
      hoja.classList.remove('tearing-out');
      animandoNota = false;
    }, 560);
  };

  window.devolverNota = function () {
    if (animandoNota || indiceNota <= 0) return;
    animandoNota = true;

    const hoja = document.getElementById('notepad-sheet');
    if (!hoja) return;
    indiceNota--;
    renderizarNota();

    hoja.classList.add('returning-start');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        hoja.classList.remove('returning-start');
        setTimeout(() => {
          animandoNota = false;
        }, 600);
      });
    });
  };

  renderizarNota();

  // =========================================================================
  // 3. ANIMACIÓN DE FONDOS Y SECCIONES AL HACER SCROLL
  // =========================================================================
  const secciones = document.querySelectorAll('.screen-section');
  const capasFondo = document.querySelectorAll('.bg-layer');

  // Asegura que todas las tarjetas revelables sean visibles desde el inicio
  document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));

  if ('IntersectionObserver' in window) {
    const observadorScroll = new IntersectionObserver((entradas) => {
      entradas.forEach(entrada => {
        if (entrada.isIntersecting) {
          const indice = entrada.target.dataset.section;

          capasFondo.forEach(capa => {
            capa.classList.toggle('active', capa.dataset.bg === indice);
          });

          const tarjeta = entrada.target.querySelector('.reveal');
          if (tarjeta) tarjeta.classList.add('visible');
        }
      });
    }, { threshold: 0.35 });

    secciones.forEach(sec => observadorScroll.observe(sec));
  }

  // =========================================================================
  // 4. GALERÍA POLAROID PAGINADA (8 POR VISTA) Y VISOR
  // =========================================================================
  const FOTOS_POR_PAGINA = 8;
  let seccionActual = 'matchs';
  let paginaActual = 0;
  let mostrandoSinMarco = false;

  window.cambiarSeccion = function (seccion, btn) {
    seccionActual = seccion;
    paginaActual = 0;

    document.querySelectorAll('.tab-btn').forEach(b => {
      if (b.closest('.tabs')) b.classList.remove('active');
    });
    if (btn) btn.classList.add('active');

    renderizarGaleria();
  };

  window.cambiarPagina = function (direccion) {
    const fotos = galeriaSegura[seccionActual] || [];
    const totalPaginas = Math.ceil(fotos.length / FOTOS_POR_PAGINA);
    const nuevaPagina = paginaActual + direccion;

    if (nuevaPagina >= 0 && nuevaPagina < totalPaginas) {
      paginaActual = nuevaPagina;
      renderizarGaleria();
    }
  };

  function renderizarGaleria() {
    const contenedor = document.getElementById('galeria');
    const indicador = document.getElementById('page-indicator');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    if (!contenedor) return;

    contenedor.innerHTML = '';
    const fotos = galeriaSegura[seccionActual] || [];

    if (fotos.length === 0) {
      contenedor.innerHTML = `<p class="empty-msg">Aún no hay fotos en esta sección.</p>`;
      if (indicador) indicador.textContent = '';
      if (btnPrev) btnPrev.disabled = true;
      if (btnNext) btnNext.disabled = true;
      return;
    }

    const totalPaginas = Math.ceil(fotos.length / FOTOS_POR_PAGINA);
    const inicio = paginaActual * FOTOS_POR_PAGINA;
    const subconjunto = fotos.slice(inicio, inicio + FOTOS_POR_PAGINA);

    subconjunto.forEach(src => {
      const card = document.createElement('div');
      card.className = 'polaroid-card';
      card.onclick = () => window.abrirModal(src);

      const img = document.createElement('img');
      img.src = src;
      img.alt = 'Recuerdo';

      card.appendChild(img);
      contenedor.appendChild(card);
    });

    if (btnPrev) btnPrev.disabled = paginaActual === 0;
    if (btnNext) btnNext.disabled = paginaActual >= totalPaginas - 1;
    if (indicador) indicador.textContent = `Página ${paginaActual + 1} de ${totalPaginas}`;
  }

  window.abrirModal = function (src) {
    const modal = document.getElementById('photo-modal');
    const modalImg = document.getElementById('modal-img');
    const wrapper = document.getElementById('modal-photo-wrapper');
    const toggleBtn = document.getElementById('toggle-frame-btn');
    if (!modal || !modalImg) return;

    mostrandoSinMarco = false;
    if (wrapper) wrapper.className = 'polaroid-viewer';
    if (toggleBtn) toggleBtn.textContent = 'Ver foto original sin marco';
    modalImg.src = src;

    modal.classList.add('open');
  };

  window.alternarMarco = function () {
    const wrapper = document.getElementById('modal-photo-wrapper');
    const toggleBtn = document.getElementById('toggle-frame-btn');
    if (!wrapper || !toggleBtn) return;

    mostrandoSinMarco = !mostrandoSinMarco;

    if (mostrandoSinMarco) {
      wrapper.className = 'raw-viewer';
      toggleBtn.textContent = 'Volver a marco Polaroid';
    } else {
      wrapper.className = 'polaroid-viewer';
      toggleBtn.textContent = 'Ver foto original sin marco';
    }
  };

  window.cerrarModal = function (event) {
    if (!event || event.target.id === 'photo-modal') {
      const modal = document.getElementById('photo-modal');
      if (modal) modal.classList.remove('open');
    }
  };

  window.cambiarSeccion('matchs', document.querySelector('.tabs .tab-btn'));

  // =========================================================================
  // 5. PLAYLIST SPOTIFY + VINILO ANIMADO (ONLINE / OFFLINE)
  // =========================================================================
  let viniloActivo = true;

  function actualizarEstadoVinilo(girando) {
    const disco = document.getElementById('vinyl-disc');
    const brazo = document.getElementById('tonearm');
    const eq = document.getElementById('equalizer-bars');
    const btn = document.getElementById('btn-toggle-vinyl');
    if (!disco || !brazo || !eq || !btn) return;

    viniloActivo = girando;
    disco.classList.toggle('spinning', girando);
    brazo.classList.toggle('playing', girando);
    eq.classList.toggle('active', girando);
    btn.textContent = girando ? 'Pausar disco' : 'Girar disco';
  }

  window.alternarVinilo = function () {
    actualizarEstadoVinilo(!viniloActivo);
  };

  async function verificarConexionSpotify() {
    const bloqueOnline = document.getElementById('spotify-online');
    const bloqueOffline = document.getElementById('spotify-offline');
    if (!bloqueOnline || !bloqueOffline) return;

    if (!navigator.onLine) {
      bloqueOnline.style.display = 'none';
      bloqueOffline.style.display = 'block';
      actualizarEstadoVinilo(false);
      return;
    }

    try {
      await fetch('https://open.spotify.com/favicon.ico', { mode: 'no-cors', cache: 'no-store' });
      bloqueOnline.style.display = 'block';
      bloqueOffline.style.display = 'none';
      actualizarEstadoVinilo(true);
    } catch (error) {
      bloqueOnline.style.display = 'none';
      bloqueOffline.style.display = 'block';
      actualizarEstadoVinilo(false);
    }
  }

  verificarConexionSpotify();
  window.addEventListener('online', verificarConexionSpotify);
  window.addEventListener('offline', verificarConexionSpotify);

  // =========================================================================
  // 6. CARTA LARGA EN HOJA DE NOVELA ANTIGUA (PAGINADA + LECTURA COMPLETA)
  // =========================================================================
  let paginasCarta = [];
  let paginaCartaActual = 0;

  function dividirCartaEnPaginas(texto, maxCaracteresPorPagina = 620) {
    if (!texto || !texto.trim()) {
      return ["Agrega el texto de tu carta en static/js/data.js para leerla aquí."];
    }

    const parrafos = texto.split(/\n\s*\n/);
    const paginas = [];
    let paginaTemporal = "";

    parrafos.forEach(parrafo => {
      const limpio = parrafo.trim();
      if (!limpio) return;

      if ((paginaTemporal + "\n\n" + limpio).length <= maxCaracteresPorPagina) {
        paginaTemporal = paginaTemporal ? paginaTemporal + "\n\n" + limpio : limpio;
      } else {
        if (paginaTemporal) paginas.push(paginaTemporal);
        if (limpio.length > maxCaracteresPorPagina) {
          const oraciones = limpio.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [limpio];
          let fragmento = "";
          oraciones.forEach(oracion => {
            if ((fragmento + oracion).length <= maxCaracteresPorPagina) {
              fragmento += oracion;
            } else {
              if (fragmento) paginas.push(fragmento.trim());
              fragmento = oracion;
            }
          });
          paginaTemporal = fragmento.trim();
        } else {
          paginaTemporal = limpio;
        }
      }
    });

    if (paginaTemporal) paginas.push(paginaTemporal);
    return paginas;
  }

  function renderizarPaginaCarta() {
    const contenedor = document.getElementById('letter-page-content');
    const numEl = document.getElementById('letter-page-num');
    const btnPrev = document.getElementById('btn-letter-prev');
    const btnNext = document.getElementById('btn-letter-next');
    if (!contenedor) return;

    contenedor.textContent = paginasCarta[paginaCartaActual];
    contenedor.classList.toggle('first-page', paginaCartaActual === 0);

    if (numEl) numEl.textContent = `Página ${paginaCartaActual + 1} de ${paginasCarta.length}`;
    if (btnPrev) btnPrev.disabled = paginaCartaActual === 0;
    if (btnNext) btnNext.disabled = paginaCartaActual >= paginasCarta.length - 1;
  }

  window.cambiarPaginaCarta = function (direccion) {
    const nueva = paginaCartaActual + direccion;
    if (nueva >= 0 && nueva < paginasCarta.length) {
      paginaCartaActual = nueva;
      renderizarPaginaCarta();
    }
  };

  window.abrirCartaCompleta = function () {
    const modal = document.getElementById('letter-modal');
    const fullTextEl = document.getElementById('modal-letter-full-text');
    if (!modal || !fullTextEl) return;
    fullTextEl.textContent = cartaSegura || "Agrega el texto de tu carta en static/js/data.js";
    modal.classList.add('open');
  };

  window.cerrarCartaModal = function (event) {
    if (!event || event.target.id === 'letter-modal') {
      const modal = document.getElementById('letter-modal');
      if (modal) modal.classList.remove('open');
    }
  };

  paginasCarta = dividirCartaEnPaginas(cartaSegura);
  renderizarPaginaCarta();

  // =========================================================================
  // 7. CIERRE GLOBAL DE MODALES CON TECLA ESCAPE
  // =========================================================================
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      window.cerrarModal();
      window.cerrarNotaModal();
      window.cerrarCartaModal();
    }
  });
});