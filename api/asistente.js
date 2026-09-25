import { neon } from "@neondatabase/serverless";

function getSql() {
  const connStr = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connStr) return null;
  return neon(connStr);
}

// Limpiar cédula para búsquedas flexibles
function cleanCedula(str) {
  if (!str) return "";
  return String(str).replace(/\D/g, "");
}

// Descripción del conocimiento del Plan Venezuela Ganadera 2030
const SYSTEM_PROMPT = `
Eres "AgroAsistente 2030", el Asistente de Inteligencia Artificial Oficial del proyecto nacional "Venezuela Ganadera 2030: Master Plan Nacional para el Desarrollo Ganadero y Pecuario".
Tu objetivo es orientar a productores agropecuarios, gremios, profesionales, estudiantes y ciudadanos venezolanos sobre el contenido del Master Plan, resolver dudas y ayudarles a verificar el estado de sus propuestas y adhesiones.

TONO Y PERSONALIDAD:
- Eres respetuoso, formal pero cercano y empático con el hombre y la mujer del campo venezolano.
- Utilizas un lenguaje claro, profesional y positivo. Conoces la terminología ganadera venezolana (pastos, forrajes, rebaño, genética, FONDONAGA, macroejes, asociaciones ganaderas, FEDENAGA, etc.).
- Respuestas claras, concisas y bien formateadas con viñetas cuando sea útil.

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

INSTRUCCIONES DE USO DE HERRAMIENTAS:
- Si un usuario pregunta si su propuesta está registrada o quiere saber el estado de su proyecto y te da su cédula o nombre, DEBES USAR la herramienta 'consultar_propuesta'.
- Si pregunta si su firma o adhesión está en el sistema, DEBES USAR 'consultar_adhesion'.
- Si pregunta cuántas propuestas o adhesiones van en un estado o en el país, DEBES USAR 'obtener_estadisticas'.
- Si NO tienes herramientas que apliquen (por ejemplo, preguntas generales sobre el libro, los macroejes o cómo participar), responde directamente con tu conocimiento.
- Por privacidad, NUNCA expongas teléfonos completos ni correos electrónicos privados en tus respuestas.
`;

const TOOLS_DECLARATIONS = [
  {
    name: "consultar_propuesta",
    description: "Busca en la base de datos si existe una propuesta registrada por un productor, usando su número de cédula o una palabra clave del título.",
    parameters: {
      type: "OBJECT",
      properties: {
        cedula: {
          type: "STRING",
          description: "Número de cédula del productor (ej: 12345678, V-12345678)"
        },
        palabraClave: {
          type: "STRING",
          description: "Palabra clave o título de la propuesta para buscar"
        }
      }
    }
  },
  {
    name: "consultar_adhesion",
    description: "Verifica si una persona, productor o gremio ya registró su adhesión de respaldo al Plan Venezuela Ganadera 2030 mediante su cédula.",
    parameters: {
      type: "OBJECT",
      properties: {
        cedula: {
          type: "STRING",
          description: "Número de cédula del adherente"
        }
      },
      required: ["cedula"]
    }
  },
  {
    name: "obtener_estadisticas",
    description: "Obtiene estadísticas del sistema: total de propuestas recibidas y total de adhesiones a nivel nacional o por estado.",
    parameters: {
      type: "OBJECT",
      properties: {
        estado: {
          type: "STRING",
          description: "Nombre del estado venezolano (opcional, ej. Barinas, Zulia, Guárico)"
        }
      }
    }
  }
];

// Ejecución local de herramientas en Neon Postgres
async function ejecutarHerramienta(name, args) {
  const sql = getSql();

  try {
    if (name === "consultar_propuesta") {
      const numCedula = cleanCedula(args.cedula);
      const palabra = (args.palabraClave || "").trim().toLowerCase();

      if (!sql) {
        return {
          encontrado: false,
          mensaje: "La base de datos en vivo está desconectada temporalmente en este entorno."
        };
      }

      let rows = [];
      if (numCedula && numCedula.length >= 4) {
        rows = await sql`
          SELECT id, cedula, nombre, estado, macroeje, titulo, detalle, fecha 
          FROM propuestas 
          WHERE cedula LIKE ${'%' + numCedula + '%'}
          ORDER BY fecha DESC LIMIT 3;
        `;
      } else if (palabra.length >= 3) {
        rows = await sql`
          SELECT id, cedula, nombre, estado, macroeje, titulo, detalle, fecha 
          FROM propuestas 
          WHERE LOWER(titulo) LIKE ${'%' + palabra + '%'} OR LOWER(detalle) LIKE ${'%' + palabra + '%'}
          ORDER BY fecha DESC LIMIT 3;
        `;
      }

      if (rows.length === 0) {
        return {
          encontrado: false,
          mensaje: "No se encontraron propuestas con los datos proporcionados. Invita al productor a registrarla desde la sección 'Presentar Propuesta' del portal."
        };
      }

      return {
        encontrado: true,
        total: rows.length,
        propuestas: rows.map(r => ({
          titulo: r.titulo,
          nombreProponente: r.nombre,
          estado: r.estado,
          macroeje: r.macroeje,
          fecha: r.fecha,
          resumenDetalle: r.detalle ? r.detalle.substring(0, 180) + "..." : ""
        }))
      };
    }

    if (name === "consultar_adhesion") {
      const numCedula = cleanCedula(args.cedula);
      if (!numCedula || numCedula.length < 4) {
        return { encontrado: false, mensaje: "Se requiere un número de cédula válido para verificar la adhesión." };
      }

      if (!sql) {
        return { encontrado: false, mensaje: "Base de datos en vivo no disponible actualmente." };
      }

      const rows = await sql`
        SELECT nombre, estado, sector, asociacion, fecha 
        FROM adhesiones 
        WHERE cedula LIKE ${'%' + numCedula + '%'}
        LIMIT 1;
      `;

      if (rows.length === 0) {
        return {
          encontrado: false,
          mensaje: "No se encontró ningún registro de adhesión con esa cédula. Puedes invitar a la persona a adherirse haciendo clic en el botón 'Adherirme al Proyecto'."
        };
      }

      return {
        encontrado: true,
        adhesion: rows[0]
      };
    }

    if (name === "obtener_estadisticas") {
      if (!sql) {
        return { totalPropuestas: 0, totalAdhesiones: 0, nota: "Modo demostración" };
      }

      const estado = (args.estado || "").trim();
      let propCount = 0;
      let adhCount = 0;

      if (estado) {
        const p = await sql`SELECT COUNT(*) as count FROM propuestas WHERE LOWER(estado) = LOWER(${estado});`;
        const a = await sql`SELECT COUNT(*) as count FROM adhesiones WHERE LOWER(estado) = LOWER(${estado});`;
        propCount = Number(p[0]?.count || 0);
        adhCount = Number(a[0]?.count || 0);
      } else {
        const p = await sql`SELECT COUNT(*) as count FROM propuestas;`;
        const a = await sql`SELECT COUNT(*) as count FROM adhesiones;`;
        propCount = Number(p[0]?.count || 0);
        adhCount = Number(a[0]?.count || 0);
      }

      return {
        filtroEstado: estado || "Nacional",
        totalPropuestas: propCount,
        totalAdhesiones: adhCount
      };
    }

    return { error: `Herramienta desconocida: ${name}` };
  } catch (err) {
    console.error("Error en ejecución de herramienta:", err);
    return { error: "Hubo un error al consultar los datos del sistema." };
  }
}

// Llamada a la API de Gemini
async function llamarGemini(apiKey, contents, toolsDeclarations = null) {
  const models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"];

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
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

      if (toolsDeclarations && toolsDeclarations.length > 0) {
        payload.tools = [
          {
            function_declarations: toolsDeclarations
          }
        ];
      }

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Error llamando a Gemini (${model}):`, response.status, errorText);
        // Si es 404, probamos el siguiente modelo
        if (response.status === 404) continue;
        throw new Error(`Gemini API respondió ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (err) {
      if (model === models[models.length - 1]) throw err;
    }
  }
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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "PEGA_AQUI_TU_API_KEY_DE_GEMINI") {
    return res.status(200).json({
      success: true,
      reply: "¡Hola! Soy **AgroAsistente 2030**. Para activarme por completo, por favor configura tu clave de Gemini (`GEMINI_API_KEY`) en el archivo `.env` o en el panel de Vercel. Puedes obtenerla gratis en [aistudio.google.com](https://aistudio.google.com/)."
    });
  }

  try {
    const { message, history } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ success: false, error: "El mensaje es requerido" });
    }

    // Preparar historial compatible con Gemini
    const contents = [];
    if (Array.isArray(history)) {
      for (const item of history.slice(-6)) {
        if (item.sender === "user" || item.sender === "bot") {
          contents.push({
            role: item.sender === "user" ? "user" : "model",
            parts: [{ text: item.text }]
          });
        }
      }
    }

    // Agregar el mensaje actual del usuario
    contents.push({
      role: "user",
      parts: [{ text: message }]
    });

    // 1ra Llamada a Gemini (con herramientas disponibles)
    const geminiRes = await llamarGemini(apiKey, contents, TOOLS_DECLARATIONS);

    const candidate = geminiRes.candidates?.[0];
    if (!candidate) {
      return res.status(200).json({
        success: true,
        reply: "Disculpa, no pude procesar la respuesta en este momento. Por favor intenta de nuevo."
      });
    }

    // Verificar si Gemini decidió llamar a una herramienta (Function Calling)
    const parts = candidate.content?.parts || [];
    const functionCallPart = parts.find(p => p.functionCall);

    if (functionCallPart) {
      const { name, args } = functionCallPart.functionCall;
      
      // Ejecutar la consulta en la base de datos
      const toolResult = await ejecutarHerramienta(name, args);

      // Agregar la respuesta del modelo y el resultado de la función para la segunda vuelta
      contents.push({
        role: "model",
        parts: [{ functionCall: { name, args } }]
      });

      contents.push({
        role: "function",
        parts: [
          {
            functionResponse: {
              name: name,
              response: { output: toolResult }
            }
          }
        ]
      });

      // 2da Llamada a Gemini para sintetizar la respuesta final en lenguaje natural
      const finalRes = await llamarGemini(apiKey, contents, null);
      const finalText = finalRes.candidates?.[0]?.content?.parts?.[0]?.text;

      return res.status(200).json({
        success: true,
        reply: finalText || "He verificado la información en el sistema, pero no pude generar un resumen detallado."
      });
    }

    // Si no hubo llamada a herramientas, devolver el texto directo
    const directText = parts.find(p => p.text)?.text || "Disculpa, no entendí bien la consulta.";
    return res.status(200).json({
      success: true,
      reply: directText
    });

  } catch (err) {
    console.error("Error en endpoint asistente:", err);
    return res.status(500).json({
      success: false,
      reply: "Ocurrió un error al comunicar con el asistente. Por favor, intenta de nuevo en unos momentos.",
      error: err.message
    });
  }
}
