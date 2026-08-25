/**
 * PORTAL VENEZUELA GANADERA 2030 - Lógica de Formularios y Muro de Propuestas
 */

// Propuestas base para poblar el muro inicialmente
const INITIAL_PROPOSALS = [
  {
    id: "prop-1",
    cedula: "V-14582910",
    nombre: "Ing. Rafael Colmenares",
    telefono: "0414-5551234",
    correo: "rcolmenares@gmail.com",
    estado: "Zulia",
    macroeje: "Sanidad y Bioseguridad",
    titulo: "Plan Piloto de Trazabilidad Ganadera con Aretes Electrónicos RFID",
    detalle: "Implementar un sistema de trazabilidad individual georreferenciado en fincas piloto del Sur del Lago para acelerar la certificación de estatus sanitario libre de aftosa y mejorar el control de movilización.",
    fecha: "2026-08-20"
  },
  {
    id: "prop-2",
    cedula: "V-11304958",
    nombre: "Dr. Marcos Albarrán",
    telefono: "0424-7778899",
    correo: "marcos.albarran@agro.ve",
    estado: "Barinas",
    macroeje: "Alimentación y Pasturas",
    titulo: "Bancos de Proteína y Silos Forrajeros Comunitarios para Época Seca",
    detalle: "Creación de centros de acopio y conservación de heno y ensilaje de maíz en asociaciones locales de los llanos occidentales para mitigar el déficit nutricional durante el verano.",
    fecha: "2026-08-21"
  },
  {
    id: "prop-3",
    cedula: "V-18920441",
    nombre: "Dra. Elena Villasmil",
    telefono: "0412-3334455",
    correo: "elena.vet@fedenaga.org",
    estado: "Táchira",
    macroeje: "Genética y Reproducción",
    titulo: "Programa de Multiplicación de Ganado Criollo Limonero y Carora",
    detalle: "Fortalecimiento de núcleos genéticos adaptados al trópico mediante convenios con laboratorios universitarios para transferencia embrionaria e inseminación a tiempo fijo (IATF).",
    fecha: "2026-08-22"
  },
  {
    id: "prop-4",
    cedula: "V-13840291",
    nombre: "Carlos Eduardo Rondón",
    telefono: "0416-8889900",
    correo: "cerondon@apureagro.com",
    estado: "Apure",
    macroeje: "Infraestructura y Energía",
    titulo: "Sistemas Fotovoltaicos para Bombeo de Agua y Cercado Eléctrico",
    detalle: "Financiamiento asociativo de paneles solares autónomos para potreros lejanos de la red eléctrica, garantizando agua continua al ganado y seguridad perimetral.",
    fecha: "2026-08-23"
  },
  {
    id: "prop-5",
    cedula: "V-16789123",
    nombre: "Abg. Fernando Gómez",
    telefono: "0424-1122334",
    correo: "fgomez.legal@gmail.com",
    estado: "Guárico",
    macroeje: "Seguridad Jurídica",
    titulo: "Unidades Especializadas contra el Abigeato y Registro de Hierros Digital",
    detalle: "Digitalización unificada del catálogo nacional de hierros y señales de ganado con validación QR para fiscalías y puntos de control en carreteras.",
    fecha: "2026-08-24"
  },
  {
    id: "prop-6",
    cedula: "V-20114562",
    nombre: "Mariana Delgado",
    telefono: "0414-9988776",
    correo: "mdelgado@agrobufalos.com",
    estado: "Monagas",
    macroeje: "Agroindustria y Mercados",
    titulo: "Planta de Enfriamiento y Procesamiento de Leche de Búfala de Oriente",
    detalle: "Articulación de 40 productores bufalinos para instalar una quesera tecnificada con certificación pasteurizada para abastecer el mercado central y explorar exportación.",
    fecha: "2026-08-25"
  }
];

const INITIAL_ADHESIONS = [
  {
    id: "adh-1",
    cedula: "V-8493021",
    nombre: "Manuel Antonio Rivas",
    telefono: "0414-7281920",
    correo: "mrivas@ganaderia.ve",
    estado: "Zulia",
    sector: "Ganadería Bovina",
    asociacion: "UGALAPA / Machiques",
    fecha: "2026-08-19"
  },
  {
    id: "adh-2",
    cedula: "V-12948502",
    nombre: "Patricia Gómez de Soto",
    telefono: "0424-8192039",
    correo: "patricia.soto@hacienda.ve",
    estado: "Táchira",
    sector: "Asociación Gremial",
    asociacion: "ASOGATA",
    fecha: "2026-08-20"
  },
  {
    id: "adh-3",
    cedula: "V-15829104",
    nombre: "Héctor Luis Briceño",
    telefono: "0412-9281726",
    correo: "",
    estado: "Barinas",
    sector: "Ganadería Bufalina",
    asociacion: "Criadores de Búfalo de Barinas",
    fecha: "2026-08-21"
  },
  {
    id: "adh-4",
    cedula: "V-17294810",
    nombre: "Dra. Sofía Zambrano",
    telefono: "0416-6281920",
    correo: "szambrano@ucla.edu.ve",
    estado: "Lara",
    sector: "Academia / Investigación",
    asociacion: "Universidad Centroccidental Lisandro Alvarado",
    fecha: "2026-08-22"
  }
];

// Gestión del Almacenamiento Local (con sincronización)
function getProposals() {
  const data = localStorage.getItem("vg2030_proposals");
  if (!data) {
    localStorage.setItem("vg2030_proposals", JSON.stringify(INITIAL_PROPOSALS));
    return INITIAL_PROPOSALS;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    return INITIAL_PROPOSALS;
  }
}

function saveProposal(item) {
  const list = getProposals();
  list.unshift(item);
  localStorage.setItem("vg2030_proposals", JSON.stringify(list));
}

function getAdhesions() {
  const data = localStorage.getItem("vg2030_adhesions");
  if (!data) {
    localStorage.setItem("vg2030_adhesions", JSON.stringify(INITIAL_ADHESIONS));
    return INITIAL_ADHESIONS;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    return INITIAL_ADHESIONS;
  }
}

function saveAdhesion(item) {
  const list = getAdhesions();
  list.unshift(item);
  localStorage.setItem("vg2030_adhesions", JSON.stringify(list));
}

// Variables de paginación del muro público
let publicCurrentPage = 1;
const ITEMS_PER_PAGE = 6;

document.addEventListener("DOMContentLoaded", () => {
  // Modales
  const modalAdhesion = document.getElementById("modal-adhesion");
  const modalPropuesta = document.getElementById("modal-propuesta");
  const modalGracias = document.getElementById("modal-gracias");
  const graciasMensaje = document.getElementById("gracias-mensaje");
  const btnCerrarGracias = document.getElementById("btn-cerrar-gracias");

  // Botones para abrir modales
  const cardAdhesion = document.getElementById("card-adhesion");
  const cardPropuesta = document.getElementById("card-propuesta");

  if (cardAdhesion) cardAdhesion.addEventListener("click", () => openModal(modalAdhesion));
  if (cardPropuesta) cardPropuesta.addEventListener("click", () => openModal(modalPropuesta));

  function openModal(modal) {
    if (modal) modal.classList.add("open");
  }

  function closeModal(modal) {
    if (modal) modal.classList.remove("open");
  }

  // Cerrar modales con botón X o clic fuera
  document.querySelectorAll(".modal-close-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const targetId = btn.getAttribute("data-close");
      const modal = document.getElementById(targetId);
      closeModal(modal);
    });
  });

  document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal(backdrop);
    });
  });

  if (btnCerrarGracias) {
    btnCerrarGracias.addEventListener("click", () => closeModal(modalGracias));
  }

  // Formulario 1: Adhesión
  const formAdhesion = document.getElementById("form-adhesion");
  if (formAdhesion) {
    formAdhesion.addEventListener("submit", (e) => {
      e.preventDefault();

      const cedula = document.getElementById("adh-cedula").value.trim();
      const nombre = document.getElementById("adh-nombre").value.trim();
      const telefono = document.getElementById("adh-telefono").value.trim();
      const correo = document.getElementById("adh-correo").value.trim();
      const estado = document.getElementById("adh-estado").value;
      const sector = document.getElementById("adh-sector").value;
      const asociacion = document.getElementById("adh-asociacion").value.trim();

      if (!cedula || !nombre) {
        alert("Por favor ingrese Cédula y Nombres (campos obligatorios).");
        return;
      }

      const newAdhesion = {
        id: "adh-" + Date.now(),
        cedula,
        nombre,
        telefono: telefono || "No especificado",
        correo: correo || "No especificado",
        estado,
        sector,
        asociacion: asociacion || "Particular",
        fecha: new Date().toISOString().split("T")[0]
      };

      saveAdhesion(newAdhesion);
      formAdhesion.reset();
      closeModal(modalAdhesion);

      // Mostrar Agradecimiento
      graciasMensaje.innerHTML = `Estimado(a) <strong>${nombre}</strong> (C.I. ${cedula}):<br><br>Su adhesión a la iniciativa nacional <strong>Venezuela Ganadera 2030</strong> ha sido registrada con éxito. ¡Gracias por sumar al futuro del campo venezolano!`;
      openModal(modalGracias);
    });
  }

  // Formulario 2: Propuesta
  const formPropuesta = document.getElementById("form-propuesta");
  if (formPropuesta) {
    formPropuesta.addEventListener("submit", (e) => {
      e.preventDefault();

      const cedula = document.getElementById("prop-cedula").value.trim();
      const nombre = document.getElementById("prop-nombre").value.trim();
      const telefono = document.getElementById("prop-telefono").value.trim();
      const correo = document.getElementById("prop-correo").value.trim();
      const estado = document.getElementById("prop-estado").value;
      const macroeje = document.getElementById("prop-macroeje").value;
      const titulo = document.getElementById("prop-titulo").value.trim();
      const detalle = document.getElementById("prop-detalle").value.trim();

      if (!cedula || !nombre || !titulo || !detalle) {
        alert("Por favor complete los campos obligatorios (*).");
        return;
      }

      const newProposal = {
        id: "prop-" + Date.now(),
        cedula,
        nombre,
        telefono: telefono || "No especificado",
        correo: correo || "No especificado",
        estado,
        macroeje,
        titulo,
        detalle,
        fecha: new Date().toISOString().split("T")[0]
      };

      saveProposal(newProposal);
      formPropuesta.reset();
      closeModal(modalPropuesta);

      // Actualizar muro público
      renderPublicProposals();

      // Mostrar Agradecimiento
      graciasMensaje.innerHTML = `Estimado(a) <strong>${nombre}</strong>:<br><br>Su propuesta <em>"${titulo}"</em> ha sido recibida exitosamente para el macroeje <strong>${macroeje}</strong>. ¡Gracias por su valioso aporte al Master Plan!`;
      openModal(modalGracias);
    });
  }

  // Renderizado del Muro Público con Búsqueda, Filtro y Paginación
  const searchInput = document.getElementById("public-search-input");
  const filterSelect = document.getElementById("public-macroeje-filter");

  if (searchInput) searchInput.addEventListener("input", () => { publicCurrentPage = 1; renderPublicProposals(); });
  if (filterSelect) filterSelect.addEventListener("change", () => { publicCurrentPage = 1; renderPublicProposals(); });

  function renderPublicProposals() {
    const grid = document.getElementById("public-proposals-grid");
    const pagination = document.getElementById("public-pagination");
    if (!grid) return;

    const all = getProposals();
    const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const filter = filterSelect ? filterSelect.value : "all";

    const filtered = all.filter(p => {
      const matchQuery = !query || 
        p.titulo.toLowerCase().includes(query) || 
        p.detalle.toLowerCase().includes(query) || 
        p.estado.toLowerCase().includes(query) || 
        p.nombre.toLowerCase().includes(query);
      const matchFilter = filter === "all" || p.macroeje === filter;
      return matchQuery && matchFilter;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
          <i class="fa-regular fa-folder-open" style="font-size: 2rem; color: var(--gold); margin-bottom: 10px; display:block;"></i>
          No se encontraron propuestas con los criterios seleccionados.
        </div>
      `;
      if (pagination) pagination.innerHTML = "";
      return;
    }

    // Paginación
    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    if (publicCurrentPage > totalPages) publicCurrentPage = totalPages;
    const startIndex = (publicCurrentPage - 1) * ITEMS_PER_PAGE;
    const pageItems = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    grid.innerHTML = pageItems.map(p => `
      <div class="proposal-card">
        <div class="proposal-meta">
          <span class="badge-macroeje">${p.macroeje}</span>
          <span class="proposal-date">${p.fecha}</span>
        </div>
        <h3 class="proposal-title">${p.titulo}</h3>
        <p class="proposal-desc">${p.detalle}</p>
        <div class="proposal-author">
          <span class="author-name"><i class="fa-solid fa-user" style="color:var(--gold); margin-right:4px;"></i> ${p.nombre}</span>
          <span class="author-state"><i class="fa-solid fa-location-dot" style="margin-right:4px;"></i> ${p.estado}</span>
        </div>
      </div>
    `).join("");

    // Renderizar controles de paginación
    if (pagination) {
      let pageHtml = `
        <button class="page-btn" ${publicCurrentPage === 1 ? 'disabled' : ''} onclick="changePublicPage(${publicCurrentPage - 1})">
          <i class="fa-solid fa-chevron-left"></i>
        </button>
      `;

      for (let i = 1; i <= totalPages; i++) {
        pageHtml += `
          <button class="page-btn ${i === publicCurrentPage ? 'active' : ''}" onclick="changePublicPage(${i})">
            ${i}
          </button>
        `;
      }

      pageHtml += `
        <button class="page-btn ${publicCurrentPage === totalPages ? 'disabled' : ''} onclick="changePublicPage(${publicCurrentPage + 1})">
          <i class="fa-solid fa-chevron-right"></i>
        </button>
      `;

      pagination.innerHTML = totalPages > 1 ? pageHtml : "";
    }
  }

  window.changePublicPage = function(newPage) {
    publicCurrentPage = newPage;
    renderPublicProposals();
    const muro = document.getElementById("muro-propuestas");
    if (muro) muro.scrollIntoView({ behavior: 'smooth' });
  };

  // Render inicial
  renderPublicProposals();
});
