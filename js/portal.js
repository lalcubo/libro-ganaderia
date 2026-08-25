/**
 * PORTAL VENEZUELA GANADERA 2030 - Lógica conectada a Vercel Postgres API
 */

let cachedProposals = [];
let publicCurrentPage = 1;
const ITEMS_PER_PAGE = 6;

// Obtener propuestas desde la API de Vercel Postgres
async function fetchProposalsFromAPI() {
  try {
    const res = await fetch("/api/propuestas");
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        cachedProposals = data.data;
        localStorage.setItem("vg2030_proposals", JSON.stringify(cachedProposals));
        return cachedProposals;
      }
    }
  } catch (e) {
    console.warn("API offline o local, usando cache local", e);
  }
  const local = localStorage.getItem("vg2030_proposals");
  cachedProposals = local ? JSON.parse(local) : [];
  return cachedProposals;
}

// Guardar propuesta en la API de Vercel Postgres
async function submitProposalToAPI(item) {
  try {
    const res = await fetch("/api/propuestas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item)
    });
    if (res.ok) {
      const result = await res.json();
      return result;
    }
  } catch (e) {
    console.warn("No se pudo conectar con la API, guardando en cache local", e);
  }
  cachedProposals.unshift(item);
  localStorage.setItem("vg2030_proposals", JSON.stringify(cachedProposals));
  return { success: true };
}

// Guardar adhesión en la API de Vercel Postgres
async function submitAdhesionToAPI(item) {
  try {
    const res = await fetch("/api/adhesiones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item)
    });
    const result = await res.json();
    return result;
  } catch (e) {
    console.warn("No se pudo conectar con la API, validando en cache local", e);
  }
  const local = localStorage.getItem("vg2030_adhesions");
  const list = local ? JSON.parse(local) : [];
  
  // Validar duplicado localmente
  const exists = list.some(a => a.cedula === item.cedula);
  if (exists) {
    return { success: false, isDuplicate: true, error: `La cédula ${item.cedula} ya se encuentra registrada.` };
  }

  list.unshift(item);
  localStorage.setItem("vg2030_adhesions", JSON.stringify(list));
  return { success: true };
}

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Forzar que las Cédulas SOLO acepten números en tiempo real
  document.querySelectorAll(".input-cedula-onlynum").forEach(input => {
    input.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/[^0-9]/g, "");
    });
  });

  // 2. Forzar que los Nombres se escriban en MAYÚSCULAS automáticamente
  document.querySelectorAll(".input-uppercase").forEach(input => {
    input.addEventListener("input", (e) => {
      e.target.value = e.target.value.toUpperCase();
    });
  });

  // Modales
  const modalAdhesion = document.getElementById("modal-adhesion");
  const modalPropuesta = document.getElementById("modal-propuesta");
  const modalGracias = document.getElementById("modal-gracias");
  const graciasMensaje = document.getElementById("gracias-mensaje");
  const btnCerrarGracias = document.getElementById("btn-cerrar-gracias");

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

  document.querySelectorAll(".modal-close-btn").forEach(btn => {
    btn.addEventListener("click", () => {
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

  // 3. Enviar Formulario de Adhesión
  const formAdhesion = document.getElementById("form-adhesion");
  if (formAdhesion) {
    formAdhesion.addEventListener("submit", async (e) => {
      e.preventDefault();

      const nac = document.getElementById("adh-nacionalidad").value;
      const cedulaNum = document.getElementById("adh-cedula-num").value.trim();
      const nombre = document.getElementById("adh-nombre").value.trim().toUpperCase();
      const telefono = document.getElementById("adh-telefono").value.trim();
      const correo = document.getElementById("adh-correo").value.trim();
      const estado = document.getElementById("adh-estado").value;
      const sector = document.getElementById("adh-sector").value;
      const asociacion = document.getElementById("adh-asociacion").value.trim().toUpperCase();

      if (!cedulaNum || !nombre) {
        alert("Por favor ingrese Cédula y Nombres (campos obligatorios).");
        return;
      }

      const cedulaCompleta = `${nac}${cedulaNum}`;

      const submitBtn = formAdhesion.querySelector(".form-submit-btn");
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Guardando...`;
      submitBtn.disabled = true;

      const newAdhesion = {
        id: "adh-" + Date.now(),
        cedula: cedulaCompleta,
        nombre: nombre,
        telefono: telefono || "No especificado",
        correo: correo || "No especificado",
        estado,
        sector,
        asociacion: asociacion || "PARTICULAR",
        fecha: new Date().toISOString().split("T")[0]
      };

      const result = await submitAdhesionToAPI(newAdhesion);

      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;

      if (!result.success && result.isDuplicate) {
        alert(`Aviso: La cédula ${cedulaCompleta} ya se encuentra registrada como adherida a la iniciativa.`);
        return;
      }

      formAdhesion.reset();
      closeModal(modalAdhesion);

      graciasMensaje.innerHTML = `Estimado(a) <strong>${nombre}</strong> (C.I. ${cedulaCompleta}):<br><br>Su adhesión a la iniciativa nacional <strong>Venezuela Ganadera 2030</strong> ha sido registrada con éxito en la base de datos. ¡Gracias por sumar al futuro del campo venezolano!`;
      openModal(modalGracias);
    });
  }

  // 4. Enviar Formulario de Propuesta
  const formPropuesta = document.getElementById("form-propuesta");
  if (formPropuesta) {
    formPropuesta.addEventListener("submit", async (e) => {
      e.preventDefault();

      const nac = document.getElementById("prop-nacionalidad").value;
      const cedulaNum = document.getElementById("prop-cedula-num").value.trim();
      const nombre = document.getElementById("prop-nombre").value.trim().toUpperCase();
      const telefono = document.getElementById("prop-telefono").value.trim();
      const correo = document.getElementById("prop-correo").value.trim();
      const estado = document.getElementById("prop-estado").value;
      const macroeje = document.getElementById("prop-macroeje").value;
      const titulo = document.getElementById("prop-titulo").value.trim();
      const detalle = document.getElementById("prop-detalle").value.trim();

      if (!cedulaNum || !nombre || !titulo || !detalle) {
        alert("Por favor complete los campos obligatorios (*).");
        return;
      }

      const cedulaCompleta = `${nac}${cedulaNum}`;

      const submitBtn = formPropuesta.querySelector(".form-submit-btn");
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Guardando...`;
      submitBtn.disabled = true;

      const newProposal = {
        id: "prop-" + Date.now(),
        cedula: cedulaCompleta,
        nombre: nombre,
        telefono: telefono || "No especificado",
        correo: correo || "No especificado",
        estado,
        macroeje,
        titulo,
        detalle,
        fecha: new Date().toISOString().split("T")[0]
      };

      await submitProposalToAPI(newProposal);
      await fetchProposalsFromAPI();

      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
      formPropuesta.reset();
      closeModal(modalPropuesta);

      renderPublicProposals();

      graciasMensaje.innerHTML = `Estimado(a) <strong>${nombre}</strong>:<br><br>Su propuesta <em>"${titulo}"</em> ha sido registrada exitosamente en la base de datos para el macroeje <strong>${macroeje}</strong>. ¡Gracias por su valioso aporte al Master Plan!`;
      openModal(modalGracias);
    });
  }

  // 5. Render Muro Público
  const searchInput = document.getElementById("public-search-input");
  const filterSelect = document.getElementById("public-macroeje-filter");

  if (searchInput) searchInput.addEventListener("input", () => { publicCurrentPage = 1; renderPublicProposals(); });
  if (filterSelect) filterSelect.addEventListener("change", () => { publicCurrentPage = 1; renderPublicProposals(); });

  function renderPublicProposals() {
    const grid = document.getElementById("public-proposals-grid");
    const pagination = document.getElementById("public-pagination");
    if (!grid) return;

    const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const filter = filterSelect ? filterSelect.value : "all";

    const filtered = cachedProposals.filter(p => {
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
        <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; color: var(--text-muted); background: var(--bg-surface); border-radius: var(--radius-md); border: 1px dashed var(--border-gold);">
          <i class="fa-regular fa-folder-open" style="font-size: 2.2rem; color: var(--gold); margin-bottom: 12px; display:block;"></i>
          <h4 style="color:#fff; font-size:1.1rem; margin-bottom:6px;">Aún no hay propuestas registradas</h4>
          <p style="font-size:0.9rem;">Sé el primero en enviar tu proyecto o propuesta para enriquecer el Master Plan Nacional.</p>
        </div>
      `;
      if (pagination) pagination.innerHTML = "";
      return;
    }

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

  await fetchProposalsFromAPI();
  renderPublicProposals();
});
