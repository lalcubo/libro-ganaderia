/**
 * VENEZUELA GANADERA 2030 - Flipbook Interactivo
 * Desarrollado con StPageFlip y Web Audio API
 */

document.addEventListener("DOMContentLoaded", () => {
  const TOTAL_PAGES = 33;
  let pageFlip = null;
  let soundEnabled = true;
  let zoomLevel = 1.0;
  let isDragging = false;
  let startX = 0, startY = 0;
  let translateX = 0, translateY = 0;

  // Elementos del DOM
  const flipbookEl = document.getElementById("flipbook");
  const panContainer = document.getElementById("pan-container");
  const loadingScreen = document.getElementById("loading-screen");
  const loaderProgress = document.getElementById("loader-progress");
  const loaderText = document.getElementById("loader-text");
  const pageDisplay = document.getElementById("page-display");
  const pageSlider = document.getElementById("page-slider");
  const zoomLevelText = document.getElementById("zoom-level-text");

  // Botones
  const btnPrev = document.getElementById("btn-prev");
  const btnNext = document.getElementById("btn-next");
  const btnBottomPrev = document.getElementById("btn-bottom-prev");
  const btnBottomNext = document.getElementById("btn-bottom-next");
  const btnFirst = document.getElementById("btn-first");
  const btnLast = document.getElementById("btn-last");
  const btnZoomIn = document.getElementById("btn-zoom-in");
  const btnZoomOut = document.getElementById("btn-zoom-out");
  const btnZoomReset = document.getElementById("btn-zoom-reset");
  const btnFullscreen = document.getElementById("btn-fullscreen");
  const btnSound = document.getElementById("btn-sound");
  const btnThumbnailsToggle = document.getElementById("btn-thumbnails-toggle");
  const btnCloseThumbnails = document.getElementById("btn-close-thumbnails");
  const thumbnailsDrawer = document.getElementById("thumbnails-drawer");
  const thumbnailsContainer = document.getElementById("thumbnails-container");
  const btnHelp = document.getElementById("btn-help");
  const btnCloseHelp = document.getElementById("btn-close-help");
  const helpModal = document.getElementById("help-modal");

  // Web Audio API para sonido de paso de página realista sin dependencias externas
  let audioCtx = null;
  function playPageFlipSound() {
    if (!soundEnabled) return;
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const filter = audioCtx.createBiquadFilter();

      // Ruido suave de paso de página
      const bufferSize = audioCtx.sampleRate * 0.12;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, audioCtx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);

      noise.start();
    } catch (e) {
      console.warn("Audio Context no disponible aún", e);
    }
  }

  // 1. Precarga de imágenes y generación de HTML de páginas
  function generatePagesHTML() {
    flipbookEl.innerHTML = "";
    for (let i = 1; i <= TOTAL_PAGES; i++) {
      const pageNumStr = i.toString().padStart(2, '0');
      const pageDiv = document.createElement("div");
      pageDiv.className = `page ${i === 1 ? 'cover-page' : ''}`;
      
      const img = document.createElement("img");
      img.src = `pages/page-${pageNumStr}.webp`;
      img.alt = `Página ${i}`;
      img.loading = i <= 4 ? "eager" : "lazy";

      pageDiv.appendChild(img);
      flipbookEl.appendChild(pageDiv);
    }
  }

  // 2. Generar miniaturas en el Drawer
  function generateThumbnails() {
    thumbnailsContainer.innerHTML = "";
    for (let i = 1; i <= TOTAL_PAGES; i++) {
      const pageNumStr = i.toString().padStart(2, '0');
      const thumbItem = document.createElement("div");
      thumbItem.className = `thumb-item ${i === 1 ? 'active' : ''}`;
      thumbItem.dataset.page = i - 1;

      const img = document.createElement("img");
      img.src = `pages/thumbs/page-${pageNumStr}.webp`;
      img.alt = `Miniatura ${i}`;
      img.loading = "lazy";

      const label = document.createElement("span");
      label.textContent = i === 1 ? 'Portada' : `Pág ${i}`;

      thumbItem.appendChild(img);
      thumbItem.appendChild(label);

      thumbItem.addEventListener("click", () => {
        if (pageFlip) {
          pageFlip.flip(i - 1);
          closeThumbnails();
        }
      });

      thumbnailsContainer.appendChild(thumbItem);
    }
  }

  // 3. Inicializar PageFlip
  function initFlipbook() {
    generatePagesHTML();
    generateThumbnails();

    const isMobile = window.innerWidth <= 768;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Dimensiones base por página (Relación estándar carta 1:1.29)
    let baseWidth = 550;
    let baseHeight = 712;

    if (isMobile) {
      baseWidth = Math.min(viewportWidth * 0.92, 450);
      baseHeight = baseWidth * 1.294;
    }

    const PageFlipConstructor = (typeof St !== 'undefined' && St.PageFlip) 
      ? St.PageFlip 
      : (window.PageFlip ? window.PageFlip : (window.StPageFlip ? window.StPageFlip.PageFlip : null));

    if (!PageFlipConstructor) {
      console.error("No se pudo cargar la librería PageFlip.");
      return;
    }

    pageFlip = new PageFlipConstructor(flipbookEl, {
      width: baseWidth,
      height: baseHeight,
      size: "stretch",
      minWidth: 280,
      maxWidth: 900,
      minHeight: 360,
      maxHeight: 1200,
      maxShadowOpacity: 0.55,
      showCover: true,
      mobileScrollSupport: false,
      usePortrait: true,
      startPage: 0,
      flippingTime: 700,
      drawShadow: true,
      autoSize: true,
      useMouseEvents: true
    });

    // Cargar páginas desde el DOM
    pageFlip.loadFromHTML(document.querySelectorAll(".page"));

    // Eventos del Flipbook
    pageFlip.on("flip", (e) => {
      playPageFlipSound();
      updateUIState(e.data);
    });

    pageFlip.on("changeState", (e) => {
      if (e.data === 'flipping') {
        playPageFlipSound();
      }
    });

    // Ocultar pantalla de carga
    setTimeout(() => {
      loaderProgress.style.width = "100%";
      loaderText.textContent = "100%";
      setTimeout(() => {
        loadingScreen.classList.add("hidden");
      }, 400);
    }, 600);
  }

  // 4. Actualizar estado de la UI
  function updateUIState(currentPageIndex) {
    const currentNum = currentPageIndex + 1;
    pageDisplay.innerHTML = currentNum === 1 
      ? `<span>Portada</span> &nbsp;|&nbsp; 1 / ${TOTAL_PAGES}` 
      : `Página ${currentNum} / ${TOTAL_PAGES}`;

    pageSlider.value = currentNum;

    // Actualizar botones de navegación
    btnPrev.classList.toggle("disabled", currentPageIndex === 0);
    btnBottomPrev.disabled = currentPageIndex === 0;
    btnFirst.disabled = currentPageIndex === 0;

    btnNext.classList.toggle("disabled", currentPageIndex >= TOTAL_PAGES - 1);
    btnBottomNext.disabled = currentPageIndex >= TOTAL_PAGES - 1;
    btnLast.disabled = currentPageIndex >= TOTAL_PAGES - 1;

    // Actualizar miniatura activa
    document.querySelectorAll(".thumb-item").forEach((thumb, idx) => {
      thumb.classList.toggle("active", idx === currentPageIndex);
      if (idx === currentPageIndex && thumbnailsDrawer.classList.contains("open")) {
        thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    });
  }

  // 5. Controles de Zoom y Pan (Arrastre)
  function applyZoom() {
    panContainer.style.transform = `scale(${zoomLevel}) translate(${translateX}px, ${translateY}px)`;
    zoomLevelText.textContent = `${Math.round(zoomLevel * 100)}%`;
    panContainer.classList.toggle("is-zoomed", zoomLevel > 1.0);
    if (zoomLevel <= 1.0) {
      translateX = 0;
      translateY = 0;
      panContainer.style.transform = `scale(1) translate(0px, 0px)`;
    }
  }

  function setZoom(newZoom) {
    zoomLevel = Math.min(Math.max(newZoom, 1.0), 2.5);
    applyZoom();
  }

  btnZoomIn.addEventListener("click", () => setZoom(zoomLevel + 0.25));
  btnZoomOut.addEventListener("click", () => setZoom(zoomLevel - 0.25));
  btnZoomReset.addEventListener("click", () => setZoom(1.0));

  // Pan (Arrastre cuando hay Zoom)
  panContainer.addEventListener("mousedown", (e) => {
    if (zoomLevel <= 1.0) return;
    isDragging = true;
    startX = e.clientX - translateX;
    startY = e.clientY - translateY;
    panContainer.classList.add("is-dragging");
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    translateX = e.clientX - startX;
    translateY = e.clientY - startY;
    applyZoom();
  });

  window.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      panContainer.classList.remove("is-dragging");
    }
  });

  // Touch Pan para móviles con Zoom
  panContainer.addEventListener("touchstart", (e) => {
    if (zoomLevel <= 1.0 || e.touches.length !== 1) return;
    isDragging = true;
    startX = e.touches[0].clientX - translateX;
    startY = e.touches[0].clientY - translateY;
  }, { passive: true });

  window.addEventListener("touchmove", (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    translateX = e.touches[0].clientX - startX;
    translateY = e.touches[0].clientY - startY;
    applyZoom();
  }, { passive: true });

  window.addEventListener("touchend", () => {
    isDragging = false;
  });

  // 6. Navegación
  btnPrev.addEventListener("click", () => pageFlip && pageFlip.flipPrev());
  btnNext.addEventListener("click", () => pageFlip && pageFlip.flipNext());
  btnBottomPrev.addEventListener("click", () => pageFlip && pageFlip.flipPrev());
  btnBottomNext.addEventListener("click", () => pageFlip && pageFlip.flipNext());
  btnFirst.addEventListener("click", () => pageFlip && pageFlip.flip(0));
  btnLast.addEventListener("click", () => pageFlip && pageFlip.flip(TOTAL_PAGES - 1));

  // Slider
  pageSlider.addEventListener("input", (e) => {
    const targetPage = parseInt(e.target.value, 10) - 1;
    if (pageFlip && targetPage !== pageFlip.getCurrentPageIndex()) {
      pageFlip.flip(targetPage);
    }
  });

  // 7. Miniaturas
  function openThumbnails() {
    thumbnailsDrawer.classList.add("open");
    const activeThumb = thumbnailsContainer.querySelector(".thumb-item.active");
    if (activeThumb) {
      setTimeout(() => {
        activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }, 100);
    }
  }

  function closeThumbnails() {
    thumbnailsDrawer.classList.remove("open");
  }

  btnThumbnailsToggle.addEventListener("click", () => {
    if (thumbnailsDrawer.classList.contains("open")) {
      closeThumbnails();
    } else {
      openThumbnails();
    }
  });

  btnCloseThumbnails.addEventListener("click", closeThumbnails);

  // 8. Sonido Toggle
  btnSound.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    btnSound.classList.toggle("active", soundEnabled);
    const icon = btnSound.querySelector("i");
    if (soundEnabled) {
      icon.className = "fa-solid fa-volume-high";
      btnSound.title = "Sonido de páginas (Activado)";
      playPageFlipSound();
    } else {
      icon.className = "fa-solid fa-volume-xmark";
      btnSound.title = "Sonido silenciado";
    }
  });

  // 9. Pantalla Completa
  btnFullscreen.addEventListener("click", () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn(`Error al activar pantalla completa: ${err.message}`);
      });
      btnFullscreen.querySelector("i").className = "fa-solid fa-compress";
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        btnFullscreen.querySelector("i").className = "fa-solid fa-expand";
      }
    }
  });

  document.addEventListener("fullscreenchange", () => {
    const icon = btnFullscreen.querySelector("i");
    if (document.fullscreenElement) {
      icon.className = "fa-solid fa-compress";
    } else {
      icon.className = "fa-solid fa-expand";
    }
  });

  // 10. Modal Ayuda
  btnHelp.addEventListener("click", () => helpModal.classList.add("open"));
  btnCloseHelp.addEventListener("click", () => helpModal.classList.remove("open"));
  helpModal.addEventListener("click", (e) => {
    if (e.target === helpModal) helpModal.classList.remove("open");
  });

  // 11. Atajos de Teclado
  window.addEventListener("keydown", (e) => {
    // Si modal está abierto, cerrar con Esc
    if (e.key === "Escape") {
      if (helpModal.classList.contains("open")) {
        helpModal.classList.remove("open");
        return;
      }
      if (thumbnailsDrawer.classList.contains("open")) {
        closeThumbnails();
        return;
      }
      if (zoomLevel > 1.0) {
        setZoom(1.0);
        return;
      }
    }

    if (e.key === "ArrowLeft") {
      if (pageFlip) pageFlip.flipPrev();
    } else if (e.key === "ArrowRight") {
      if (pageFlip) pageFlip.flipNext();
    } else if (e.key === "Home") {
      if (pageFlip) pageFlip.flip(0);
    } else if (e.key === "End") {
      if (pageFlip) pageFlip.flip(TOTAL_PAGES - 1);
    } else if (e.key === "+" || e.key === "=") {
      setZoom(zoomLevel + 0.25);
    } else if (e.key === "-") {
      setZoom(zoomLevel - 0.25);
    } else if (e.key === "f" || e.key === "F") {
      btnFullscreen.click();
    }
  });

  // 12. Soporte para redimensionar la ventana fluidamente
  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (pageFlip) {
        // Redimensionar libro
        pageFlip.updateFromHtml(document.querySelectorAll(".page"));
      }
    }, 250);
  });

  // Iniciar
  initFlipbook();
});
