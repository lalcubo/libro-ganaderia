/**
 * PORTAL VENEZUELA GANADERA 2030 - Panel de Administración
 * Incluye gestión de registros, eliminación de adheridos y propuestas, y cambio de clave
 */

const DEFAULT_ADMIN_USER = "admin";
const DEFAULT_ADMIN_PASS = "ganaderia2030";

function getAdminPass() {
  return localStorage.getItem("vg2030_admin_password") || DEFAULT_ADMIN_PASS;
}

function setAdminPass(newPass) {
  localStorage.setItem("vg2030_admin_password", newPass);
}

// Estado de paginación
let adheridosCurrentPage = 1;
let propuestasCurrentPage = 1;
const ADMIN_ITEMS_PER_PAGE = 8;
let currentViewingPropId = null;

document.addEventListener("DOMContentLoaded", () => {
  const loginView = document.getElementById("admin-login-view");
  const dashboardView = document.getElementById("admin-dashboard-view");
  const formLogin = document.getElementById("form-admin-login");
  const loginErrorMsg = document.getElementById("login-error-msg");
  const btnLogout = document.getElementById("btn-logout");
  const btnOpenChangePass = document.getElementById("btn-open-change-pass");

  // Pestañas
  const tabBtnAdheridos = document.getElementById("tab-btn-adheridos");
  const tabBtnPropuestas = document.getElementById("tab-btn-propuestas");
  const tabAdheridos = document.getElementById("tab-adheridos");
  const tabPropuestas = document.getElementById("tab-propuestas");

  // Búsqueda y Filtros
  const searchAdheridos = document.getElementById("admin-search-adheridos");
  const searchPropuestas = document.getElementById("admin-search-propuestas");
  const filterMacroeje = document.getElementById("admin-filter-macroeje");

  // Botones de Exportar
  const btnExportAdhExcel = document.getElementById("btn-export-adheridos-excel");
  const btnExportAdhPdf = document.getElementById("btn-export-adheridos-pdf");
  const btnExportPropExcel = document.getElementById("btn-export-propuestas-excel");
  const btnExportPropPdf = document.getElementById("btn-export-propuestas-pdf");

  // Modales
  const modalVerPropuesta = document.getElementById("modal-ver-propuesta");
  const modalChangePass = document.getElementById("modal-change-pass");
  const formChangePass = document.getElementById("form-change-pass");
  const cpMsg = document.getElementById("cp-msg");
  const btnModalDeleteProp = document.getElementById("btn-modal-delete-prop");

  // Verificar sesión activa
  if (sessionStorage.getItem("vg2030_admin_auth") === "true") {
    showDashboard();
  }

  // 1. Login
  if (formLogin) {
    formLogin.addEventListener("submit", (e) => {
      e.preventDefault();
      const u = document.getElementById("admin-user").value.trim();
      const p = document.getElementById("admin-pass").value.trim();

      if (u === DEFAULT_ADMIN_USER && p === getAdminPass()) {
        sessionStorage.setItem("vg2030_admin_auth", "true");
        loginErrorMsg.style.display = "none";
        showDashboard();
      } else {
        loginErrorMsg.style.display = "block";
      }
    });
  }

  // 2. Logout
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      sessionStorage.removeItem("vg2030_admin_auth");
      loginView.style.display = "block";
      dashboardView.style.display = "none";
      btnLogout.style.display = "none";
      if (btnOpenChangePass) btnOpenChangePass.style.display = "none";
    });
  }

  function showDashboard() {
    loginView.style.display = "none";
    dashboardView.style.display = "block";
    btnLogout.style.display = "inline-flex";
    if (btnOpenChangePass) btnOpenChangePass.style.display = "inline-flex";
    refreshDashboard();
  }

  // 3. Conmutador de Pestañas
  if (tabBtnAdheridos && tabBtnPropuestas) {
    tabBtnAdheridos.addEventListener("click", () => {
      tabBtnAdheridos.classList.add("active");
      tabBtnPropuestas.classList.remove("active");
      tabAdheridos.style.display = "block";
      tabPropuestas.style.display = "none";
    });

    tabBtnPropuestas.addEventListener("click", () => {
      tabBtnPropuestas.classList.add("active");
      tabBtnAdheridos.classList.remove("active");
      tabPropuestas.style.display = "block";
      tabAdheridos.style.display = "none";
    });
  }

  // Datos
  function getAdhesionsData() {
    const raw = localStorage.getItem("vg2030_adhesions");
    return raw ? JSON.parse(raw) : [];
  }

  function saveAdhesionsData(list) {
    localStorage.setItem("vg2030_adhesions", JSON.stringify(list));
  }

  function getProposalsData() {
    const raw = localStorage.getItem("vg2030_proposals");
    return raw ? JSON.parse(raw) : [];
  }

  function saveProposalsData(list) {
    localStorage.setItem("vg2030_proposals", JSON.stringify(list));
  }

  // Actualizar Dashboard
  function refreshDashboard() {
    const adheridos = getAdhesionsData();
    const propuestas = getProposalsData();

    document.getElementById("stat-total-adheridos").textContent = adheridos.length;
    document.getElementById("stat-total-propuestas").textContent = propuestas.length;
    document.getElementById("badge-count-adheridos").textContent = adheridos.length;
    document.getElementById("badge-count-propuestas").textContent = propuestas.length;

    const estadosSet = new Set([...adheridos.map(a => a.estado), ...propuestas.map(p => p.estado)]);
    document.getElementById("stat-total-estados").textContent = estadosSet.size;

    renderAdheridosTable();
    renderPropuestasTable();
  }

  // 4. Render Tabla de Adheridos con Botón de Eliminar
  function renderAdheridosTable() {
    const tbody = document.getElementById("admin-tbody-adheridos");
    const pagination = document.getElementById("admin-pagination-adheridos");
    const all = getAdhesionsData();
    const q = searchAdheridos ? searchAdheridos.value.toLowerCase().trim() : "";

    const filtered = all.filter(a => {
      return !q || 
        a.cedula.toLowerCase().includes(q) || 
        a.nombre.toLowerCase().includes(q) || 
        a.estado.toLowerCase().includes(q) ||
        (a.asociacion && a.asociacion.toLowerCase().includes(q));
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:30px; color:var(--text-muted);">No hay registros de adhesión que coincidan con la búsqueda.</td></tr>`;
      pagination.innerHTML = "";
      return;
    }

    const totalPages = Math.ceil(filtered.length / ADMIN_ITEMS_PER_PAGE);
    if (adheridosCurrentPage > totalPages) adheridosCurrentPage = totalPages;
    const start = (adheridosCurrentPage - 1) * ADMIN_ITEMS_PER_PAGE;
    const pageItems = filtered.slice(start, start + ADMIN_ITEMS_PER_PAGE);

    tbody.innerHTML = pageItems.map((a, i) => `
      <tr>
        <td style="color:var(--gold); font-weight:700;">${start + i + 1}</td>
        <td><strong>${a.cedula}</strong></td>
        <td>${a.nombre}</td>
        <td>${a.telefono}</td>
        <td>${a.correo}</td>
        <td><span style="color:var(--gold); font-weight:600;">${a.estado}</span></td>
        <td>${a.sector} <br><small style="color:var(--text-muted);">${a.asociacion || ''}</small></td>
        <td style="white-space:nowrap; font-size:0.8rem; color:var(--text-muted);">${a.fecha}</td>
        <td>
          <button class="nav-btn nav-btn-outline" style="padding:4px 8px; font-size:0.75rem; color:#ff5252; border-color:rgba(255,82,82,0.4);" onclick="window.eliminarAdherido('${a.id}')" title="Eliminar registro">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `).join("");

    renderPaginationControl(pagination, totalPages, adheridosCurrentPage, (p) => {
      adheridosCurrentPage = p;
      renderAdheridosTable();
    });
  }

  // 5. Render Tabla de Propuestas con Botón de Eliminar
  function renderPropuestasTable() {
    const tbody = document.getElementById("admin-tbody-propuestas");
    const pagination = document.getElementById("admin-pagination-propuestas");
    const all = getProposalsData();
    const q = searchPropuestas ? searchPropuestas.value.toLowerCase().trim() : "";
    const macroFilter = filterMacroeje ? filterMacroeje.value : "all";

    const filtered = all.filter(p => {
      const matchQ = !q || 
        p.cedula.toLowerCase().includes(q) || 
        p.nombre.toLowerCase().includes(q) || 
        p.titulo.toLowerCase().includes(q) || 
        p.estado.toLowerCase().includes(q) ||
        p.detalle.toLowerCase().includes(q);
      const matchM = macroFilter === "all" || p.macroeje === macroFilter;
      return matchQ && matchM;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">No hay propuestas registradas con los criterios seleccionados.</td></tr>`;
      pagination.innerHTML = "";
      return;
    }

    const totalPages = Math.ceil(filtered.length / ADMIN_ITEMS_PER_PAGE);
    if (propuestasCurrentPage > totalPages) propuestasCurrentPage = totalPages;
    const start = (propuestasCurrentPage - 1) * ADMIN_ITEMS_PER_PAGE;
    const pageItems = filtered.slice(start, start + ADMIN_ITEMS_PER_PAGE);

    tbody.innerHTML = pageItems.map((p, i) => `
      <tr>
        <td style="color:var(--gold); font-weight:700;">${start + i + 1}</td>
        <td><strong>${p.cedula}</strong></td>
        <td>${p.nombre}</td>
        <td><span style="color:var(--gold); font-weight:600;">${p.estado}</span></td>
        <td><span class="badge-macroeje">${p.macroeje}</span></td>
        <td style="font-weight:600;">${p.titulo}</td>
        <td style="white-space:nowrap; font-size:0.8rem; color:var(--text-muted);">${p.fecha}</td>
        <td style="white-space:nowrap;">
          <button class="nav-btn nav-btn-outline" style="padding:4px 8px; font-size:0.75rem; margin-right:4px;" onclick="window.verDetallePropuesta('${p.id}')">
            <i class="fa-solid fa-eye"></i> Leer
          </button>
          <button class="nav-btn nav-btn-outline" style="padding:4px 8px; font-size:0.75rem; color:#ff5252; border-color:rgba(255,82,82,0.4);" onclick="window.eliminarPropuesta('${p.id}')" title="Eliminar propuesta">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `).join("");

    renderPaginationControl(pagination, totalPages, propuestasCurrentPage, (p) => {
      propuestasCurrentPage = p;
      renderPropuestasTable();
    });
  }

  // 6. Eliminar Adherido
  window.eliminarAdherido = function(id) {
    const list = getAdhesionsData();
    const item = list.find(a => a.id === id);
    if (!item) return;

    if (confirm(`¿Estás seguro de eliminar el registro de adhesión de ${item.nombre} (C.I. ${item.cedula})?`)) {
      const updated = list.filter(a => a.id !== id);
      saveAdhesionsData(updated);
      refreshDashboard();
    }
  };

  // 7. Eliminar Propuesta
  window.eliminarPropuesta = function(id) {
    const list = getProposalsData();
    const item = list.find(p => p.id === id);
    if (!item) return;

    if (confirm(`¿Estás seguro de eliminar la propuesta "${item.titulo}" de ${item.nombre}?`)) {
      const updated = list.filter(p => p.id !== id);
      saveProposalsData(updated);
      if (modalVerPropuesta.classList.contains("open")) {
        modalVerPropuesta.classList.remove("open");
      }
      refreshDashboard();
    }
  };

  if (btnModalDeleteProp) {
    btnModalDeleteProp.addEventListener("click", () => {
      if (currentViewingPropId) {
        window.eliminarPropuesta(currentViewingPropId);
      }
    });
  }

  // 8. Cambiar Contraseña del Admin
  if (btnOpenChangePass) {
    btnOpenChangePass.addEventListener("click", () => {
      formChangePass.reset();
      cpMsg.style.display = "none";
      modalChangePass.classList.add("open");
    });
  }

  if (formChangePass) {
    formChangePass.addEventListener("submit", (e) => {
      e.preventDefault();
      const current = document.getElementById("cp-current").value.trim();
      const newP = document.getElementById("cp-new").value.trim();
      const confirmP = document.getElementById("cp-confirm").value.trim();

      if (current !== getAdminPass()) {
        cpMsg.style.color = "#ff5252";
        cpMsg.textContent = "La contraseña actual no es correcta.";
        cpMsg.style.display = "block";
        return;
      }

      if (newP !== confirmP) {
        cpMsg.style.color = "#ff5252";
        cpMsg.textContent = "Las nuevas contraseñas no coinciden.";
        cpMsg.style.display = "block";
        return;
      }

      if (newP.length < 6) {
        cpMsg.style.color = "#ff5252";
        cpMsg.textContent = "La nueva contraseña debe tener al menos 6 caracteres.";
        cpMsg.style.display = "block";
        return;
      }

      setAdminPass(newP);
      cpMsg.style.color = "#4caf50";
      cpMsg.textContent = "¡Contraseña actualizada exitosamente!";
      cpMsg.style.display = "block";

      setTimeout(() => {
        modalChangePass.classList.remove("open");
      }, 1500);
    });
  }

  // Paginación genérica
  function renderPaginationControl(container, totalPages, currentPage, onSelect) {
    if (totalPages <= 1) {
      container.innerHTML = "";
      return;
    }
    let html = `
      <button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
    `;
    for (let i = 1; i <= totalPages; i++) {
      html += `
        <button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">
          ${i}
        </button>
      `;
    }
    html += `
      <button class="page-btn ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">
        <i class="fa-solid fa-chevron-right"></i>
      </button>
    `;
    container.innerHTML = html;

    container.querySelectorAll(".page-btn:not([disabled])").forEach(btn => {
      btn.addEventListener("click", () => {
        const p = parseInt(btn.getAttribute("data-page"), 10);
        onSelect(p);
      });
    });
  }

  // Ver detalle de propuesta en modal
  window.verDetallePropuesta = function(id) {
    const propuestas = getProposalsData();
    const p = propuestas.find(item => item.id === id);
    if (!p) return;
    currentViewingPropId = id;

    document.getElementById("modal-prop-tags").innerHTML = `
      <span class="badge-macroeje">${p.macroeje}</span>
      <span style="font-size:0.78rem; color:var(--text-muted); padding:4px 8px;">Fecha: ${p.fecha}</span>
    `;
    document.getElementById("modal-prop-titulo").textContent = p.titulo;
    document.getElementById("modal-prop-detalle").textContent = p.detalle;
    document.getElementById("modal-prop-autor-info").innerHTML = `
      <div><strong>Proponente:</strong> ${p.nombre}</div>
      <div><strong>Cédula:</strong> ${p.cedula}</div>
      <div><strong>Estado:</strong> ${p.estado}</div>
      <div><strong>Teléfono:</strong> ${p.telefono}</div>
      <div><strong>Correo:</strong> ${p.correo}</div>
    `;

    modalVerPropuesta.classList.add("open");
  };

  // Eventos de búsqueda
  if (searchAdheridos) searchAdheridos.addEventListener("input", () => { adheridosCurrentPage = 1; renderAdheridosTable(); });
  if (searchPropuestas) searchPropuestas.addEventListener("input", () => { propuestasCurrentPage = 1; renderPropuestasTable(); });
  if (filterMacroeje) filterMacroeje.addEventListener("change", () => { propuestasCurrentPage = 1; renderPropuestasTable(); });

  // Cerrar modales
  document.querySelectorAll(".modal-close-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-close");
      const m = document.getElementById(targetId);
      if (m) m.classList.remove("open");
    });
  });

  document.querySelectorAll(".modal-backdrop").forEach(bd => {
    bd.addEventListener("click", (e) => {
      if (e.target === bd) bd.classList.remove("open");
    });
  });

  // =========================================================================
  // EXPORTADORES A EXCEL (CSV UTF-8) Y PDF
  // =========================================================================

  // 1. Exportar Adheridos a Excel (CSV con BOM)
  if (btnExportAdhExcel) {
    btnExportAdhExcel.addEventListener("click", () => {
      const data = getAdhesionsData();
      let csv = "\uFEFF";
      csv += "ID,Cedula,Nombre,Telefono,Correo,Estado,Sector,Asociacion,Fecha\n";
      data.forEach(a => {
        csv += `"${a.id}","${a.cedula}","${a.nombre}","${a.telefono}","${a.correo}","${a.estado}","${a.sector}","${a.asociacion || ''}","${a.fecha}"\n`;
      });
      downloadFile(csv, "Venezuela-Ganadera-2030-Adheridos.csv", "text/csv;charset=utf-8;");
    });
  }

  // 2. Exportar Adheridos a PDF
  if (btnExportAdhPdf) {
    btnExportAdhPdf.addEventListener("click", () => {
      const data = getAdhesionsData();
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF("landscape");

      doc.setFontSize(16);
      doc.setTextColor(35, 108, 52);
      doc.text("VENEZUELA GANADERA 2030 - REGISTRO DE ADHESIONES", 14, 15);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Reporte generado el: ${new Date().toLocaleDateString()} | Total registros: ${data.length}`, 14, 22);

      const tableData = data.map((a, i) => [
        i + 1,
        a.cedula,
        a.nombre,
        a.telefono,
        a.correo,
        a.estado,
        a.sector,
        a.fecha
      ]);

      doc.autoTable({
        startY: 26,
        head: [['#', 'Cédula', 'Nombre', 'Teléfono', 'Correo', 'Estado', 'Sector', 'Fecha']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [35, 108, 52], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 3 }
      });

      doc.save("Venezuela-Ganadera-2030-Adheridos.pdf");
    });
  }

  // 3. Exportar Propuestas a Excel (CSV con BOM)
  if (btnExportPropExcel) {
    btnExportPropExcel.addEventListener("click", () => {
      const data = getProposalsData();
      let csv = "\uFEFF";
      csv += "ID,Cedula,Nombre,Telefono,Correo,Estado,Macroeje,Titulo,Detalle,Fecha\n";
      data.forEach(p => {
        const cleanDetalle = (p.detalle || "").replace(/"/g, '""').replace(/\n/g, ' ');
        csv += `"${p.id}","${p.cedula}","${p.nombre}","${p.telefono}","${p.correo}","${p.estado}","${p.macroeje}","${p.titulo}","${cleanDetalle}","${p.fecha}"\n`;
      });
      downloadFile(csv, "Venezuela-Ganadera-2030-Propuestas.csv", "text/csv;charset=utf-8;");
    });
  }

  // 4. Exportar Propuestas a PDF
  if (btnExportPropPdf) {
    btnExportPropPdf.addEventListener("click", () => {
      const data = getProposalsData();
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF("landscape");

      doc.setFontSize(16);
      doc.setTextColor(35, 108, 52);
      doc.text("VENEZUELA GANADERA 2030 - BANCO DE PROPUESTAS", 14, 15);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Reporte generado el: ${new Date().toLocaleDateString()} | Total propuestas: ${data.length}`, 14, 22);

      const tableData = data.map((p, i) => [
        i + 1,
        p.cedula,
        p.nombre,
        p.estado,
        p.macroeje,
        p.titulo,
        p.detalle.substring(0, 80) + '...',
        p.fecha
      ]);

      doc.autoTable({
        startY: 26,
        head: [['#', 'Cédula', 'Proponente', 'Estado', 'Macroeje', 'Título', 'Resumen', 'Fecha']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [212, 175, 55], textColor: [15, 25, 18], fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: {
          5: { cellWidth: 50 },
          6: { cellWidth: 70 }
        }
      });

      doc.save("Venezuela-Ganadera-2030-Propuestas.pdf");
    });
  }

  function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  }
});
