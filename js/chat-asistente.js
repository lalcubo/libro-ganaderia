/**
 * Widget Asistente de IA - Venezuela Ganadera 2030
 * Permite responder dudas del Master Plan y consultar en vivo el estado
 * de propuestas y adhesiones en la base de datos de Neon/PostgreSQL.
 */

(function () {
  let chatHistory = [];
  let isSending = false;

  // Renderizar Markdown ligero a HTML seguro
  function parseMarkdown(text) {
    if (!text) return "";
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Negritas
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    // Cursivas
    html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
    
    // Listas con viñetas
    const lines = html.split("\n");
    let inList = false;
    let result = [];

    for (let line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        if (!inList) {
          result.push("<ul>");
          inList = true;
        }
        result.push(`<li>${trimmed.substring(2)}</li>`);
      } else {
        if (inList) {
          result.push("</ul>");
          inList = false;
        }
        if (trimmed.length > 0) {
          result.push(`<p style="margin: 4px 0;">${trimmed}</p>`);
        }
      }
    }
    if (inList) result.push("</ul>");

    return result.join("");
  }

  function getHoraActual() {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function initChatWidget() {
    // 1. Estructura HTML del Widget
    const container = document.createElement("div");
    container.id = "agro-chat-widget";
    container.innerHTML = `
      <!-- Botón Flotante -->
      <div class="chat-fab-container">
        <div class="chat-fab-tooltip" id="chat-fab-tooltip">
          <i class="fa-solid fa-cow" style="color: #15803d;"></i>
          <span>¿Dudas del Plan o tu Propuesta?</span> Pregúntame
        </div>
        <button class="chat-fab-btn" id="chat-fab-trigger" aria-label="Abrir asistente de IA">
          <i class="fa-solid fa-robot"></i>
          <span class="chat-status-dot"></span>
        </button>
      </div>

      <!-- Ventana de Chat -->
      <div class="chat-window" id="chat-window" role="dialog" aria-hidden="true">
        <div class="chat-header">
          <div class="chat-header-info">
            <div class="chat-avatar">
              <i class="fa-solid fa-cow"></i>
            </div>
            <div class="chat-header-text">
              <h4>AgroAsistente 2030</h4>
              <span>Inteligencia Artificial Oficial</span>
            </div>
          </div>
          <button class="chat-close-btn" id="chat-close-btn" aria-label="Cerrar chat">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="chat-messages" id="chat-messages">
          <div class="chat-msg bot">
            <div class="chat-msg-bubble">
              ¡Saludos! Soy <strong>AgroAsistente 2030</strong>, el asistente del Master Plan Nacional <em>Venezuela Ganadera 2030</em>.<br><br>
              Puedo ayudarte a:
              <ul>
                <li><strong>Investigar tu propuesta:</strong> Escríbeme tu cédula o el tema para ver si ya está registrada.</li>
                <li><strong>Verificar tu adhesión:</strong> Consulta si tu firma o gremio ya están en el acta de apoyo.</li>
                <li><strong>Conocer el Master Plan:</strong> Pregúntame sobre los 12 macroejes, metas al 2030 o FONDONAGA.</li>
              </ul>
              ¿En qué te puedo orientar hoy?
            </div>
            <span class="chat-msg-time">${getHoraActual()}</span>
          </div>
        </div>

        <!-- Preguntas rápidas con navegación -->
        <div class="chat-chips-wrapper">
          <button type="button" class="chips-nav-btn" id="chips-nav-prev" aria-label="Anterior" title="Ver anteriores">
            <i class="fa-solid fa-chevron-left"></i>
          </button>
          <div class="chat-chips" id="chat-chips">
            <button type="button" class="chat-chip" data-query="¿Cómo registro una propuesta ganadera?">¿Cómo registrar propuesta?</button>
            <button type="button" class="chat-chip" data-query="Quiero verificar si mi propuesta está registrada, mi cédula es ">🔍 Verificar mi propuesta</button>
            <button type="button" class="chat-chip" data-query="¿Cuáles son los 12 macroejes del plan?">12 Macroejes</button>
            <button type="button" class="chat-chip" data-query="¿Qué es el fondo FONDONAGA?">¿Qué es FONDONAGA?</button>
            <button type="button" class="chat-chip" data-query="¿Cuántas propuestas y adhesiones van en el país?">📊 Estadísticas</button>
          </div>
          <button type="button" class="chips-nav-btn" id="chips-nav-next" aria-label="Siguiente" title="Ver siguientes">
            <i class="fa-solid fa-chevron-right"></i>
          </button>
        </div>

        <form class="chat-footer" id="chat-form">
          <input type="text" class="chat-input" id="chat-input" placeholder="Escribe tu consulta o cédula aquí..." maxlength="300" autocomplete="off" />
          <button type="submit" class="chat-send-btn" id="chat-send-btn" aria-label="Enviar mensaje">
            <i class="fa-solid fa-paper-plane"></i>
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(container);

    // 2. Referencias del DOM
    const trigger = document.getElementById("chat-fab-trigger");
    const tooltip = document.getElementById("chat-fab-tooltip");
    const windowEl = document.getElementById("chat-window");
    const closeBtn = document.getElementById("chat-close-btn");
    const form = document.getElementById("chat-form");
    const input = document.getElementById("chat-input");
    const messages = document.getElementById("chat-messages");
    const sendBtn = document.getElementById("chat-send-btn");
    const chips = document.getElementById("chat-chips");
    const chipsPrev = document.getElementById("chips-nav-prev");
    const chipsNext = document.getElementById("chips-nav-next");

    if (chipsPrev && chipsNext && chips) {
      chipsPrev.addEventListener("click", () => {
        chips.scrollBy({ left: -140, behavior: "smooth" });
      });
      chipsNext.addEventListener("click", () => {
        chips.scrollBy({ left: 140, behavior: "smooth" });
      });
    }

    // Historial inicial vacío (la primera interacción siempre debe ser del usuario)
    chatHistory = [];

    // Abrir/Cerrar
    function toggleChat(forceOpen = null) {
      const willOpen = forceOpen !== null ? forceOpen : !windowEl.classList.contains("open");
      if (willOpen) {
        windowEl.classList.add("open");
        windowEl.setAttribute("aria-hidden", "false");
        tooltip.style.display = "none";
        setTimeout(() => input.focus(), 200);
      } else {
        windowEl.classList.remove("open");
        windowEl.setAttribute("aria-hidden", "true");
      }
    }

    trigger.addEventListener("click", () => toggleChat());
    tooltip.addEventListener("click", () => toggleChat(true));
    closeBtn.addEventListener("click", () => toggleChat(false));

    // Agregar mensaje a la vista
    // Renderizar carrusel deslizable horizontal de tarjetas de propuestas
    function renderProposalsCarousel(proposals) {
      const wrapper = document.createElement("div");
      wrapper.className = "chat-carousel-wrapper";

      const count = proposals.length;
      wrapper.innerHTML = `
        <div class="chat-carousel-header">
          <span class="chat-carousel-hint">
            <i class="fa-solid fa-layer-group"></i> ${count} ${count === 1 ? "Propuesta encontrada" : "Propuestas encontradas"}
          </span>
          ${count > 1 ? `
            <div class="chat-carousel-arrows">
              <button type="button" class="chat-carousel-arrow prev" aria-label="Anterior"><i class="fa-solid fa-chevron-left"></i></button>
              <button type="button" class="chat-carousel-arrow next" aria-label="Siguiente"><i class="fa-solid fa-chevron-right"></i></button>
            </div>
          ` : ""}
        </div>
        <div class="chat-carousel">
          ${proposals.map(p => `
            <div class="chat-proposal-card">
              <div class="chat-card-top">
                <span class="chat-card-badge" title="${p.macroeje || 'General'}">${p.macroeje || 'Propuesta'}</span>
                <span class="chat-card-date">${p.fecha || ''}</span>
              </div>
              <h5 class="chat-card-title">${p.titulo || 'Sin título'}</h5>
              <p class="chat-card-desc">${p.detalle || ''}</p>
              <div class="chat-card-footer">
                <div class="chat-card-author" title="${p.nombre || ''}">
                  <i class="fa-solid fa-user"></i>
                  <span>${p.nombre || 'Ciudadano'}</span>
                </div>
                <div class="chat-card-state">
                  <i class="fa-solid fa-location-dot"></i>
                  <span>${p.estado || 'Venezuela'}</span>
                </div>
              </div>
            </div>
          `).join("")}
        </div>
      `;

      const carousel = wrapper.querySelector(".chat-carousel");
      const prevBtn = wrapper.querySelector(".chat-carousel-arrow.prev");
      const nextBtn = wrapper.querySelector(".chat-carousel-arrow.next");

      if (prevBtn && nextBtn && carousel) {
        prevBtn.addEventListener("click", () => {
          carousel.scrollBy({ left: -250, behavior: "smooth" });
        });
        nextBtn.addEventListener("click", () => {
          carousel.scrollBy({ left: 250, behavior: "smooth" });
        });
      }

      return wrapper;
    }

    // Agregar mensaje a la vista
    function appendMessage(sender, text, proposals = []) {
      const msgEl = document.createElement("div");
      msgEl.className = `chat-msg ${sender}`;

      const bubble = document.createElement("div");
      bubble.className = "chat-msg-bubble";

      if (sender === "bot") {
        bubble.innerHTML = parseMarkdown(text);
      } else {
        bubble.textContent = text;
      }

      msgEl.appendChild(bubble);

      // Si hay propuestas encontradas, agregar el carrusel de tarjetas debajo del texto
      if (sender === "bot" && Array.isArray(proposals) && proposals.length > 0) {
        const carouselEl = renderProposalsCarousel(proposals);
        msgEl.appendChild(carouselEl);
      }

      const timeEl = document.createElement("span");
      timeEl.className = "chat-msg-time";
      timeEl.textContent = getHoraActual();

      msgEl.appendChild(timeEl);
      messages.appendChild(msgEl);

      // Scroll abajo
      messages.scrollTop = messages.scrollHeight;
    }

    // Indicador de "investigando / escribiendo..."
    function showTypingIndicator() {
      const typingEl = document.createElement("div");
      typingEl.className = "chat-typing";
      typingEl.id = "chat-typing-indicator";
      typingEl.innerHTML = `
        <span class="chat-typing-dot"></span>
        <span class="chat-typing-dot"></span>
        <span class="chat-typing-dot"></span>
        <span class="chat-typing-text">Investigando en el sistema...</span>
      `;
      messages.appendChild(typingEl);
      messages.scrollTop = messages.scrollHeight;
    }

    function removeTypingIndicator() {
      const el = document.getElementById("chat-typing-indicator");
      if (el) el.remove();
    }

    // Enviar mensaje al backend
    async function sendMessage(text) {
      const cleanText = text.trim();
      if (!cleanText || isSending) return;

      appendMessage("user", cleanText);
      chatHistory.push({ sender: "user", text: cleanText });

      input.value = "";
      isSending = true;
      sendBtn.disabled = true;
      showTypingIndicator();

      try {
        const response = await fetch("/api/asistente", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: cleanText,
            history: chatHistory
          })
        });

        const data = await response.json();
        removeTypingIndicator();

        const botReply = data.reply || "No obtuve respuesta del asistente.";
        appendMessage("bot", botReply, data.proposals || []);
        chatHistory.push({ sender: "bot", text: botReply });

      } catch (err) {
        console.error("Error en chat asistente:", err);
        removeTypingIndicator();
        appendMessage("bot", "Hubo una interrupción de conexión con el asistente. Por favor, verifica tu conexión o intenta en unos instantes.");
      } finally {
        isSending = false;
        sendBtn.disabled = false;
        input.focus();
      }
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      sendMessage(input.value);
    });

    // Chips de sugerencia
    chips.addEventListener("click", (e) => {
      const chip = e.target.closest(".chat-chip");
      if (!chip) return;
      const query = chip.dataset.query;
      if (query.endsWith("cédula es ")) {
        input.value = query;
        input.focus();
      } else {
        sendMessage(query);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initChatWidget);
  } else {
    initChatWidget();
  }
})();
