import { sql } from "@vercel/postgres";

let memoryProposals = [];

// Helper de sanitización y prevención de ataques (XSS / Inyecciones)
function cleanString(str, maxLength = 255) {
  if (typeof str !== "string") return "";
  return str
    .replace(/<[^>]*>?/gm, "") // Eliminar etiquetas HTML/scripts
    .trim()
    .slice(0, maxLength);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const hasPostgres = !!process.env.POSTGRES_URL;

  try {
    if (hasPostgres) {
      await sql`
        CREATE TABLE IF NOT EXISTS propuestas (
          id VARCHAR(64) PRIMARY KEY,
          cedula VARCHAR(32) NOT NULL,
          nombre VARCHAR(128) NOT NULL,
          telefono VARCHAR(64),
          correo VARCHAR(128),
          estado VARCHAR(64) NOT NULL,
          macroeje VARCHAR(128) NOT NULL,
          titulo VARCHAR(255) NOT NULL,
          detalle TEXT NOT NULL,
          fecha VARCHAR(32) NOT NULL
        );
      `;
    }

    // GET: Listar propuestas
    if (req.method === "GET") {
      if (hasPostgres) {
        const { rows } = await sql`SELECT * FROM propuestas ORDER BY fecha DESC, id DESC;`;
        return res.status(200).json({ success: true, data: rows });
      } else {
        return res.status(200).json({ success: true, data: memoryProposals });
      }
    }

    // POST: Registrar propuesta con validaciones de seguridad
    if (req.method === "POST") {
      const { id, cedula, nombre, telefono, correo, estado, macroeje, titulo, detalle, fecha, hp_website } = req.body;

      // 1. Trampa Honeypot contra Bots automatizados
      if (hp_website && hp_website.trim() !== "") {
        // Silenciosamente responder 200 sin registrar nada
        return res.status(200).json({ success: true, message: "OK" });
      }

      // 2. Sanitización y limpieza de campos
      const cleanCedula = cleanString(cedula, 25).toUpperCase();
      const cleanNombre = cleanString(nombre, 100).toUpperCase();
      const cleanTelefono = cleanString(telefono, 35);
      const cleanCorreo = cleanString(correo, 100).toLowerCase();
      const cleanEstado = cleanString(estado, 50);
      const cleanMacroeje = cleanString(macroeje, 100);
      const cleanTitulo = cleanString(titulo, 250);
      const cleanDetalle = cleanString(detalle, 3500);
      const cleanFecha = cleanString(fecha, 20) || new Date().toISOString().split("T")[0];
      const recId = cleanString(id, 64) || ("prop-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7));

      // 3. Validación de campos obligatorios
      if (!cleanCedula || !cleanNombre || !cleanTitulo || !cleanDetalle) {
        return res.status(400).json({ success: false, error: "Campos obligatorios requeridos (*)" });
      }

      if (hasPostgres) {
        await sql`
          INSERT INTO propuestas (id, cedula, nombre, telefono, correo, estado, macroeje, titulo, detalle, fecha)
          VALUES (
            ${recId}, 
            ${cleanCedula}, 
            ${cleanNombre}, 
            ${cleanTelefono || "No especificado"}, 
            ${cleanCorreo || "No especificado"}, 
            ${cleanEstado || "No especificado"}, 
            ${cleanMacroeje || "General"}, 
            ${cleanTitulo}, 
            ${cleanDetalle}, 
            ${cleanFecha}
          );
        `;
      } else {
        memoryProposals.unshift({
          id: recId,
          cedula: cleanCedula,
          nombre: cleanNombre,
          telefono: cleanTelefono || "No especificado",
          correo: cleanCorreo || "No especificado",
          estado: cleanEstado || "No especificado",
          macroeje: cleanMacroeje || "General",
          titulo: cleanTitulo,
          detalle: cleanDetalle,
          fecha: cleanFecha
        });
      }

      return res.status(201).json({ success: true, message: "Propuesta registrada con éxito", id: recId });
    }

    // DELETE: Eliminar propuesta
    if (req.method === "DELETE") {
      const { id } = req.query;
      const cleanId = cleanString(id, 64);
      if (!cleanId) return res.status(400).json({ success: false, error: "ID requerido" });

      if (hasPostgres) {
        await sql`DELETE FROM propuestas WHERE id = ${cleanId};`;
      } else {
        memoryProposals = memoryProposals.filter(p => p.id !== cleanId);
      }
      return res.status(200).json({ success: true, message: "Propuesta eliminada con éxito" });
    }

    return res.status(405).json({ success: false, error: "Método no permitido" });
  } catch (error) {
    console.error("Error en /api/propuestas:", error);
    return res.status(500).json({ success: false, error: error.message || "Error interno del servidor" });
  }
}
