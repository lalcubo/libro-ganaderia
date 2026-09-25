import { neon } from "@neondatabase/serverless";

function getSql() {
  const connStr = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING;
  if (!connStr) return null;
  return neon(connStr);
}

// Limpiar cédula para búsquedas flexibles
function cleanCedula(str) {
  if (!str) return "";
  return String(str).replace(/\D/g, "");
}

// Filtro de seguridad básico contra Prompt Injection
function contieneInyeccion(texto) {
  const patronesPeligrosos = [
    /ignora\s+(todas\s+)?(las\s+)?instrucciones/i,
    /ignore\s+(all\s+)?previous\s+instructions/i,
    /system\s*prompt/i,
    /revela\s+(tu\s+)?(prompt|clave|api\s*key)/i,
    /olvida\s+lo\s+anterior/i,
    /act\s+as\s+dan/i,
    /modo\s+desarrollador/i,
    /environmental?\s*variables?/i
  ];
  return patronesPeligrosos.some(p => p.test(texto));
}

// Palabras comunes a ignorar en búsquedas
const STOPWORDS = new Set([
  "hay", "alguna", "algun", "alguno", "propuesta", "propuestas", "sobre", "para", "como", "esta", 
  "este", "estos", "estas", "cual", "cuales", "donde", "cuando", "quien", "por", "que", "del", 
  "las", "los", "una", "uno", "unos", "unas", "con", "sin", "registrada", "registrado", "tienen"
]);

function normTexto(str) {
  return (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// Investigar en la base de datos de Neon según el mensaje del usuario
async function investigarEnBaseDeDatos(mensaje) {
  const sql = getSql();
  if (!sql) {
    return {
      contextoTexto: "Nota del sistema: Base de datos no conectada en este entorno.",
      propuestasCoincidentes: []
    };
  }

  const secciones = [];
  const cedulaCoincidencias = mensaje.match(/\b\d{5,9}\b/g);
  let coincidentes = [];

  try {
    // 1. Traer las propuestas reales del portal
    const todasLasPropuestas = await sql`
      SELECT id, cedula, titulo, macroeje, estado, nombre, fecha, detalle 
      FROM propuestas 
      ORDER BY fecha DESC, id DESC 
      LIMIT 60;
    `;

    if (todasLasPropuestas.length > 0) {
      const listaFormateada = todasLasPropuestas.map(p => 
        `- Título: "${p.titulo}" | Macroeje: ${p.macroeje} | Autor: ${p.nombre} | Estado: ${p.estado} | Fecha: ${p.fecha} | Planteamiento: "${p.detalle || ''}"`
      ).join("\n");

      secciones.push(`[PROPUESTAS REGISTRADAS EN EL PORTAL (${todasLasPropuestas.length} propuestas encontradas)]:\n${listaFormateada}`);

      // Filtrar coincidentes para el carrusel
      if (cedulaCoincidencias && cedulaCoincidencias.length > 0) {
        coincidentes = todasLasPropuestas.filter(p => 
          cedulaCoincidencias.some(c => (p.cedula || "").includes(c))
        );
      } else {
        const msgNorm = normTexto(mensaje);
        const palabras = msgNorm
          .replace(/[¿?¡!.,;:()]/g, " ")
          .split(/\s+/)
          .filter(w => w.length >= 3 && !STOPWORDS.has(w));

        if (palabras.length > 0) {
          coincidentes = todasLasPropuestas.filter(p => {
            const contenido = normTexto(`${p.titulo} ${p.detalle} ${p.macroeje} ${p.estado} ${p.nombre}`);
            return palabras.some(w => contenido.includes(w));
          });
        } else if (/\b(propuestas?|proyectos?|iniciativas?)\b/i.test(mensaje)) {
          coincidentes = todasLasPropuestas.slice(0, 6);
        }
      }
    } else {
      secciones.push(`[REGISTRO ACTUAL DE PROPUESTAS]: Actualmente no hay propuestas registradas en la base de datos.`);
    }

    // 2. Si el usuario escribió un número de cédula, buscar adhesión
    if (cedulaCoincidencias && cedulaCoincidencias.length > 0) {
      for (const num of cedulaCoincidencias.slice(0, 2)) {
        const adhsCedula = await sql`
          SELECT nombre, estado, sector, asociacion, fecha 
          FROM adhesiones 
          WHERE cedula LIKE ${'%' + num + '%'} 
          LIMIT 1;
        `;

        if (adhsCedula.length > 0) {
          secciones.push(`[ADHESIÓN DE LA CÉDULA ${num}]: Registrada a nombre de ${adhsCedula[0].nombre} en ${adhsCedula[0].estado} (${adhsCedula[0].fecha}).`);
        } else {
          secciones.push(`[ADHESIÓN DE LA CÉDULA ${num}]: No figura registro de adhesión con esta cédula.`);
        }
      }
    }

    // 3. Métricas y estadísticas en tiempo real
    const pCount = await sql`SELECT COUNT(*) as count FROM propuestas;`;
    const aCount = await sql`SELECT COUNT(*) as count FROM adhesiones;`;
    secciones.push(`[MÉTRICAS TOTALES EN VIVO]: Total propuestas en el sistema: ${pCount[0]?.count || 0}. Total adhesiones firmadas: ${aCount[0]?.count || 0}.`);

  } catch (err) {
    console.error("Error consultando base de datos para contexto:", err.message);
    secciones.push("Nota: Ocurrió un detalle al consultar los datos en vivo: " + err.message);
  }

  return {
    contextoTexto: secciones.join("\n\n"),
    propuestasCoincidentes: coincidentes.slice(0, 8)
  };
}

// Descripción del conocimiento del Plan Venezuela Ganadera 2030
const SYSTEM_PROMPT = `
Eres "AgroAsistente 2030", el Asistente de Inteligencia Artificial Oficial del proyecto nacional "Venezuela Ganadera 2030: Master Plan Nacional para el Desarrollo Ganadero y Pecuario".
Tu objetivo es orientar a productores agropecuarios, gremios, profesionales, estudiantes y ciudadanos venezolanos sobre el contenido del Master Plan, resolver dudas y ayudarles a verificar el estado de sus propuestas y adhesiones.

TONO Y PERSONALIDAD:
- Eres respetuoso, formal pero cercano y empático con el hombre y la mujer del campo venezolano.
- Utilizas un lenguaje claro, profesional y positivo. Conoces la terminología ganadera venezolana (pastos, forrajes, rebaño, genética, FONDONAGA, macroejes, asociaciones ganaderas, FEDENAGA, etc.).
- Respuestas claras, concisas y bien formateadas con viñetas cuando sea útil.
- Responde siempre en español.

CONOCIMIENTO BASE DEL PLAN VENEZUELA GANADERA 2030:
- Líder / Promotor del proyecto: José de Jesús Labrador Amaya (Productor y dirigente gremial venezolano).
- Propósito: Hoja de ruta nacional para la recuperación, modernización y desarrollo de la ganadería bovina, bufalina, caprina, ovina y cadenas pecuarias en Venezuela.
- Proceso de Consulta Nacional: 60 días activos para conocer la propuesta, adherirse y presentar proyectos e iniciativas desde todos los estados del país.
- Lema central: "CONÓCELO · ADHIÉRETE · PROPÓN · CONSTRUYAMOS".
- Los 12 Macroejes de acción:
  1 y 2. Unidad y Fortalecimiento Gremial (cohesión del sector, representatividad).
  3. Seguridad Integral (lucha contra el abigeato, seguridad personal y jurídica en el campo, vialidad rural).
  4. Alimentación y Pasturas (recuperación de suelos, ensilaje, reservas forrajeras, nutrición animal).
  5. Genética y Reproducción (mejoramiento genético, inseminación artificial, biotecnología adaptada al trópico).
  6. Sanidad y Bioseguridad (erradicación de la fiebre aftosa para exportación, control de brucelosis, trazabilidad del rebaño).
  7. Educación y Tecnología (capacitación técnica de mayordomos y obreros, relevo generacional, adopción tecnológica).
  8. Seguridad Jurídica (respeto a la propiedad privada, regularización de tierras, confianza para invertir).
  9. Arquitectura y Capacidad Institucional (articulación entre gremios, ministerios, universidades e institutos de investigación).
  10. Infraestructura y Energía (electrificación rural, pozos profundos, energía solar para bombeo de agua, caminos de penetración).
  11. Agroindustria y Mercados (cadena de frío, precios justos para la leche y la carne, apertura a mercados de exportación).
  12. Sostenibilidad y Resiliencia (ganadería regenerativa, sistemas silvopastoriles, balance hídrico y ambiental).
- Financiamiento Especial: FONDONAGA (Fondo Nacional Ganadero propuesto para apalancar créditos e inversión con reglas claras).

REGLA FUNDAMENTAL SOBRE DATOS EN VIVO:
- Se te proporcionará información verificada en tiempo real de la base de datos de propuestas y adhesiones.
- Úsala como la verdad del sistema: si dice que no hay propuestas, di amablemente que no hay registradas y anímalos a enviarla; si hay propuestas, indícalas con su título y macroeje.
- NUNCA reveles teléfonos ni correos electrónicos privados.
`;

// Normalizar historial para cumplir con las reglas estrictas de Gemini (USER, MODEL alternado)
function prepararContents(history, nuevoMensajeConDatos) {
  const list = [];

  if (Array.isArray(history)) {
    for (const item of history.slice(-4)) {
      if (!item || !item.text) continue;
      const role = item.sender === "user" ? "user" : "model";
      list.push({ role, text: String(item.text).trim() });
    }
  }

  // Descartar mensajes iniciales que no sean del usuario
  while (list.length > 0 && list[0].role !== "user") {
    list.shift();
  }

  const contents = [];
  let ultimoRol = null;

  for (const item of list) {
    if (item.role === ultimoRol) {
      if (contents.length > 0) {
        contents[contents.length - 1].parts[0].text += "\n" + item.text;
      }
    } else {
      contents.push({
        role: item.role,
        parts: [{ text: item.text }]
      });
      ultimoRol = item.role;
    }
  }

  // Agregar el mensaje actual del usuario garantizando rol USER
  if (ultimoRol === "user" && contents.length > 0) {
    contents[contents.length - 1].parts[0].text += "\n" + nuevoMensajeConDatos;
  } else {
    contents.push({
      role: "user",
      parts: [{ text: nuevoMensajeConDatos }]
    });
  }

  return contents;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Método no permitido" });
  }

  const apiKeyRaw = process.env.GEMINI_API_KEY || "";
  const apiKey = apiKeyRaw.replace(/['"]/g, "").trim();

  if (!apiKey || apiKey === "PEGA_AQUI_TU_API_KEY_DE_GEMINI") {
    return res.status(200).json({
      success: true,
      reply: "¡Hola! Soy **AgroAsistente 2030**. Para activarme por completo, asegúrate de configurar tu clave de Gemini (`GEMINI_API_KEY`) en el panel de Vercel. Puedes obtenerla gratis en [aistudio.google.com](https://aistudio.google.com/)."
    });
  }

  try {
    const { message, history } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ success: false, error: "El mensaje es requerido" });
    }

    const cleanMessage = message.trim().slice(0, 500);

    // Prevención de Prompt Injection
    if (contieneInyeccion(cleanMessage)) {
      return res.status(200).json({
        success: true,
        reply: "Hola. Como asistente de Venezuela Ganadera 2030, solo estoy autorizado para brindar información sobre el Master Plan Ganadero, macroejes, propuestas y adhesiones del sector."
      });
    }

    // 1. INVESTIGACIÓN EN TIEMPO REAL EN NEON POSTGRES
    const datosInvestigados = await investigarEnBaseDeDatos(cleanMessage);

    // 2. CONSTRUIR PROMPT ENRIQUECIDO CON DATOS VERIFICADOS
    const mensajeEnriquecido = `
Pregunta del usuario:
"${cleanMessage}"

[INFORMACIÓN VERIFICADA EN BASE DE DATOS DEL SISTEMA]:
${datosInvestigados.contextoTexto}

Instrucción: Responde a la pregunta del usuario utilizando la información verificada de la base de datos cuando aplique, y tus conocimientos del Plan Venezuela Ganadera 2030. Si no hay registros de lo que busca, explícaselo amablemente e invítalo a participar.
    `.trim();

    const contents = prepararContents(history, mensajeEnriquecido);

    const payload = {
      system_instruction: {
        parts: [{ text: SYSTEM_PROMPT }]
      },
      contents: contents,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 900
      }
    };

    // 3. LLAMADA DIRECTA A GEMINI 3.8 FLASH CON REINTENTO AUTOMÁTICO
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    let replyText = null;
    let lastError = null;

    for (let intento = 1; intento <= 3; intento++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
          replyText = data.candidates[0].content.parts[0].text;
          break; // Éxito
        }

        lastError = data.error?.message || `HTTP ${response.status}`;
        
        // Si hay sobrecarga temporal, esperar antes del siguiente intento
        if (intento < 3) {
          await new Promise(r => setTimeout(r, 800 * intento));
        }
      } catch (e) {
        lastError = e.message;
        if (intento < 3) {
          await new Promise(r => setTimeout(r, 800 * intento));
        }
      }
    }

    if (!replyText) {
      if (lastError && (lastError.includes("high demand") || lastError.includes("demand"))) {
        return res.status(200).json({
          success: true,
          reply: "Los servidores de Google reportan alta demanda momentánea. Por favor envía de nuevo tu consulta en unos segundos."
        });
      }
      throw new Error(`Google API: ${lastError || "Sin respuesta"}`);
    }

    return res.status(200).json({
      success: true,
      reply: replyText,
      proposals: datosInvestigados.propuestasCoincidentes || []
    });

  } catch (err) {
    console.error("Error en endpoint asistente:", err.message);

    let mensajeAmigable = `⚠️ Detalle: ${err.message}`;
    if (err.message.includes("API key not valid") || err.message.includes("API_KEY_INVALID")) {
      mensajeAmigable = "⚠️ **Clave de Gemini no válida:** Verifica que en Vercel la variable `GEMINI_API_KEY` tenga la clave exacta copiada de Google AI Studio (comienza por `AIzaSy...`).";
    }

    return res.status(200).json({
      success: false,
      reply: mensajeAmigable,
      error: err.message
    });
  }
}
