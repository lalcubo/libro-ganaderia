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

// Investigar en la base de datos de Neon según el mensaje del usuario
async function investigarEnBaseDeDatos(mensaje) {
  const sql = getSql();
  if (!sql) {
    return "Nota del sistema: Base de datos no conectada en este entorno.";
  }

  const hallazgos = [];
  const cedulaCoincidencias = mensaje.match(/\b\d{5,9}\b/g);

  try {
    // 1. Si el usuario escribió un número de cédula
    if (cedulaCoincidencias && cedulaCoincidencias.length > 0) {
      for (const num of cedulaCoincidencias.slice(0, 2)) {
        const props = await sql`
          SELECT titulo, macroeje, estado, fecha, detalle 
          FROM propuestas 
          WHERE cedula LIKE ${'%' + num + '%'} 
          LIMIT 3;
        `;

        const adhs = await sql`
          SELECT nombre, estado, sector, asociacion, fecha 
          FROM adhesiones 
          WHERE cedula LIKE ${'%' + num + '%'} 
          LIMIT 1;
        `;

        if (props.length > 0) {
          hallazgos.push(`PROPUESTAS ENCONTRADAS PARA CÉDULA ${num}: ` + JSON.stringify(props.map(p => ({
            titulo: p.titulo,
            macroeje: p.macroeje,
            estado: p.estado,
            fecha: p.fecha,
            resumen: p.detalle ? p.detalle.substring(0, 150) + "..." : ""
          }))));
        } else {
          hallazgos.push(`BÚSQUEDA DE PROPUESTA: No hay ninguna propuesta registrada con la cédula ${num}.`);
        }

        if (adhs.length > 0) {
          hallazgos.push(`ADHESIÓN ENCONTRADA: ${adhs[0].nombre} está adherido/a desde ${adhs[0].estado} (${adhs[0].fecha}).`);
        } else {
          hallazgos.push(`BÚSQUEDA DE ADHESIÓN: No figura registro de adhesión con la cédula ${num}.`);
        }
      }
    }

    // 2. Si pregunta por temas, proyectos o palabras clave
    const palabras = mensaje
      .toLowerCase()
      .replace(/[¿?¡!.,;:()]/g, " ")
      .split(/\s+/)
      .filter(w => w.length >= 3 && !STOPWORDS.has(w));

    if (palabras.length > 0 && !cedulaCoincidencias) {
      // Buscar por la frase o por palabras clave relevantes
      const termino = palabras.join(" ");
      const rows = await sql`
        SELECT titulo, macroeje, estado, fecha, detalle 
        FROM propuestas 
        WHERE LOWER(titulo) LIKE ${'%' + termino + '%'} 
           OR LOWER(detalle) LIKE ${'%' + termino + '%'}
           OR LOWER(macroeje) LIKE ${'%' + termino + '%'}
        LIMIT 4;
      `;

      if (rows.length > 0) {
        hallazgos.push(`PROPUESTAS ENCONTRADAS EN EL SISTEMA SOBRE '${termino}': ` + JSON.stringify(rows.map(r => ({
          titulo: r.titulo,
          macroeje: r.macroeje,
          estado: r.estado,
          fecha: r.fecha,
          resumen: r.detalle ? r.detalle.substring(0, 160) + "..." : ""
        }))));
      } else {
        hallazgos.push(`BÚSQUEDA EN BASE DE DATOS: Actualmente no hay propuestas registradas sobre '${termino}'. Invita al usuario a presentar su propuesta en la web.`);
      }
    }

    // 3. Si pregunta por estadísticas, conteos o números globales
    if (/\b(cu[aá]ntas?|total|estad[ií]sticas?|conteo|resumen)\b/i.test(mensaje)) {
      const pCount = await sql`SELECT COUNT(*) as count FROM propuestas;`;
      const aCount = await sql`SELECT COUNT(*) as count FROM adhesiones;`;
      hallazgos.push(`ESTADÍSTICAS NACIONALES EN VIVO: Total propuestas registradas: ${pCount[0]?.count || 0}. Total adhesiones de respaldo: ${aCount[0]?.count || 0}.`);
    }

  } catch (err) {
    console.error("Error consultando base de datos para contexto:", err.message);
    hallazgos.push("Nota: No se pudo conectar a la base de datos en vivo en este momento.");
  }

  return hallazgos.length > 0 ? hallazgos.join("\n") : "Búsqueda en base de datos: Sin coincidencias directas.";
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
${datosInvestigados}

Instrucción: Responde a la pregunta del usuario utilizando la información verificada de la base de datos cuando aplique, y tus conocimientos del Plan Venezuela Ganadera 2030. Si no hay registros de lo que busca, explícaselo amablemente e invítalo a participar.
    `.trim();

    const contents = prepararContents(history, mensajeEnriquecido);

    // 3. LLAMADA DIRECTA A GEMINI (Roles USER y MODEL 100% compatibles)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

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

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.error?.message || `HTTP ${response.status}`;
      throw new Error(`Google API: ${errorMsg}`);
    }

    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    return res.status(200).json({
      success: true,
      reply: replyText || "He consultado el sistema pero no pude estructurar una respuesta. ¿Podrías reformular tu pregunta?"
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
