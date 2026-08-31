import { neon } from "@neondatabase/serverless";

function getSql() {
  const connStr = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connStr) return null;
  return neon(connStr);
}

let memoryProposals = [];

function cleanString(str, maxLength = 255) {
  if (typeof str !== "string") return "";
  return str
    .replace(/<[^>]*>?/gm, "")
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

  const sql = getSql();

  try {
    if (sql) {
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
      if (sql) {
        const rows = await sql`SELECT * FROM propuestas ORDER BY fecha DESC, id DESC;`;
        return res.status(200).json({ success: true, data: rows });
      } else {
        return res.status(200).json({ success: true, data: memoryProposals });
      }
    }

    // POST: Registrar propuesta
    if (req.method === "POST") {
      const { id, cedula, nombre, telefono, correo, estado, macroeje, titulo, detalle, fecha, hp_website } = req.body;

      if (hp_website && hp_website.trim() !== "") {
        return res.status(200).json({ success: true, message: "OK" });
      }

      const cleanCedula = cleanString(cedula, 25).toUpperCase();
      const cleanNombre = cleanString(nombre, 100).toUpperCase();
      const cleanTelefono = cleanString(telefono, 35);
      const cleanCorreo = cleanString(correo, 100).toLowerCase();
      const cleanEstado = cleanString(estado, 50);
      const cleanMacroeje = cleanString(macroeje, 100);
      const cleanTitulo = cleanString(titulo, 200);
      const cleanDetalle = cleanString(detalle, 5000);
      const cleanFecha = cleanString(fecha, 20) || new Date().toISOString().split("T")[0];
      const recId = cleanString(id, 64) || ("prop-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7));

      if (!cleanCedula || !cleanNombre || !cleanTitulo || !cleanDetalle) {
        return res.status(400).json({ success: false, error: "Todos los campos obligatorios deben ser completados." });
      }

      if (cleanCedula.length < 5 || !/^[VEJPGCvejpgc]?[0-9.\-\s]+$/.test(cleanCedula)) {
        return res.status(400).json({ success: false, error: "El formato de cédula/RIF no es válido." });
      }

      if (cleanCorreo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanCorreo)) {
        return res.status(400).json({ success: false, error: "El formato del correo electrónico no es válido." });
      }

      if (sql) {
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
        return res.status(201).json({ success: true, message: "Propuesta registrada con éxito", id: recId });
      } else {
        const newRecord = {
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
        };
        memoryProposals.unshift(newRecord);
        return res.status(201).json({ success: true, message: "Propuesta registrada con éxito", id: recId });
      }
    }

    // DELETE: Eliminar propuesta
    if (req.method === "DELETE") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ success: false, error: "ID requerido" });
      const cleanId = cleanString(id, 64);

      if (sql) {
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
