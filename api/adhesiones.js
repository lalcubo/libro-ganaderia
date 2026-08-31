import { neon } from "@neondatabase/serverless";

function getSql() {
  const connStr = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connStr) return null;
  return neon(connStr);
}

let memoryAdhesions = [];

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
        CREATE TABLE IF NOT EXISTS adhesiones (
          id VARCHAR(64) PRIMARY KEY,
          cedula VARCHAR(32) NOT NULL,
          nombre VARCHAR(128) NOT NULL,
          telefono VARCHAR(64),
          correo VARCHAR(128),
          estado VARCHAR(64) NOT NULL,
          sector VARCHAR(128) NOT NULL,
          asociacion VARCHAR(128),
          fecha VARCHAR(32) NOT NULL
        );
      `;
    }

    // GET: Listar registros
    if (req.method === "GET") {
      if (sql) {
        const rows = await sql`SELECT * FROM adhesiones ORDER BY fecha DESC, id DESC;`;
        return res.status(200).json({ success: true, data: rows });
      } else {
        return res.status(200).json({ success: true, data: memoryAdhesions });
      }
    }

    // POST: Registrar adhesión
    if (req.method === "POST") {
      const { id, cedula, nombre, telefono, correo, estado, sector, asociacion, fecha, hp_website } = req.body;

      if (hp_website && hp_website.trim() !== "") {
        return res.status(200).json({ success: true, message: "OK" });
      }

      const cleanCedula = cleanString(cedula, 25).toUpperCase();
      const cleanNombre = cleanString(nombre, 100).toUpperCase();
      const cleanTelefono = cleanString(telefono, 35);
      const cleanCorreo = cleanString(correo, 100).toLowerCase();
      const cleanEstado = cleanString(estado, 50);
      const cleanSector = cleanString(sector, 100);
      const cleanAsociacion = cleanString(asociacion, 120).toUpperCase();
      const cleanFecha = cleanString(fecha, 20) || new Date().toISOString().split("T")[0];
      const recId = cleanString(id, 64) || ("adh-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7));

      if (!cleanCedula || !cleanNombre) {
        return res.status(400).json({ success: false, error: "Cédula y Nombre son obligatorios." });
      }

      if (cleanCedula.length < 5 || !/^[VEJPGCvejpgc]?[0-9.\-\s]+$/.test(cleanCedula)) {
        return res.status(400).json({ success: false, error: "El formato de cédula/RIF no es válido." });
      }

      if (cleanCorreo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanCorreo)) {
        return res.status(400).json({ success: false, error: "El formato del correo electrónico no es válido." });
      }

      if (sql) {
        const existing = await sql`SELECT id FROM adhesiones WHERE cedula = ${cleanCedula} LIMIT 1;`;
        if (existing.length > 0) {
          return res.status(409).json({ 
            success: false, 
            error: `La cédula ${cleanCedula} ya se encuentra registrada como adherida a la iniciativa.`,
            isDuplicate: true 
          });
        }

        await sql`
          INSERT INTO adhesiones (id, cedula, nombre, telefono, correo, estado, sector, asociacion, fecha)
          VALUES (
            ${recId}, 
            ${cleanCedula}, 
            ${cleanNombre}, 
            ${cleanTelefono || "No especificado"}, 
            ${cleanCorreo || "No especificado"}, 
            ${cleanEstado || "No especificado"}, 
            ${cleanSector || "General"}, 
            ${cleanAsociacion || "Particular"}, 
            ${cleanFecha}
          );
        `;
        return res.status(201).json({ success: true, message: "Adhesión registrada con éxito", id: recId });
      } else {
        const exists = memoryAdhesions.some(a => a.cedula === cleanCedula);
        if (exists) {
          return res.status(409).json({ 
            success: false, 
            error: `La cédula ${cleanCedula} ya se encuentra registrada como adherida a la iniciativa.`,
            isDuplicate: true 
          });
        }
        const newRecord = {
          id: recId,
          cedula: cleanCedula,
          nombre: cleanNombre,
          telefono: cleanTelefono || "No especificado",
          correo: cleanCorreo || "No especificado",
          estado: cleanEstado || "No especificado",
          sector: cleanSector || "General",
          asociacion: cleanAsociacion || "Particular",
          fecha: cleanFecha
        };
        memoryAdhesions.unshift(newRecord);
        return res.status(201).json({ success: true, message: "Adhesión registrada con éxito", id: recId });
      }
    }

    // DELETE: Eliminar adhesión
    if (req.method === "DELETE") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ success: false, error: "ID requerido" });
      const cleanId = cleanString(id, 64);

      if (sql) {
        await sql`DELETE FROM adhesiones WHERE id = ${cleanId};`;
      } else {
        memoryAdhesions = memoryAdhesions.filter(a => a.id !== cleanId);
      }
      return res.status(200).json({ success: true, message: "Registro eliminado con éxito" });
    }

    return res.status(405).json({ success: false, error: "Método no permitido" });
  } catch (error) {
    console.error("Error en /api/adhesiones:", error);
    return res.status(500).json({ success: false, error: error.message || "Error interno del servidor" });
  }
}
