import { sql } from "@vercel/postgres";

let memoryAdhesions = [];

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

    // GET
    if (req.method === "GET") {
      if (hasPostgres) {
        const { rows } = await sql`SELECT * FROM adhesiones ORDER BY fecha DESC, id DESC;`;
        return res.status(200).json({ success: true, data: rows });
      } else {
        return res.status(200).json({ success: true, data: memoryAdhesions });
      }
    }

    // POST
    if (req.method === "POST") {
      const { id, cedula, nombre, telefono, correo, estado, sector, asociacion, fecha } = req.body;

      if (!cedula || !nombre) {
        return res.status(400).json({ success: false, error: "Cédula y Nombre son obligatorios" });
      }

      if (hasPostgres) {
        const existing = await sql`SELECT id FROM adhesiones WHERE cedula = ${cedula};`;
        if (existing.rows.length > 0) {
          return res.status(409).json({ 
            success: false, 
            error: `La cédula ${cedula} ya se encuentra registrada como adherida a la iniciativa.`,
            isDuplicate: true 
          });
        }

        const recId = id || ("adh-" + Date.now());
        const recFecha = fecha || new Date().toISOString().split("T")[0];

        await sql`
          INSERT INTO adhesiones (id, cedula, nombre, telefono, correo, estado, sector, asociacion, fecha)
          VALUES (${recId}, ${cedula}, ${nombre}, ${telefono || "No especificado"}, ${correo || "No especificado"}, ${estado || "No especificado"}, ${sector || "General"}, ${asociacion || "Particular"}, ${recFecha});
        `;
        return res.status(201).json({ success: true, message: "Adhesión registrada con éxito", id: recId });
      } else {
        const exists = memoryAdhesions.some(a => a.cedula === cedula);
        if (exists) {
          return res.status(409).json({ 
            success: false, 
            error: `La cédula ${cedula} ya se encuentra registrada como adherida a la iniciativa.`,
            isDuplicate: true 
          });
        }
        const recId = id || ("adh-" + Date.now());
        const newRecord = {
          id: recId,
          cedula,
          nombre,
          telefono: telefono || "No especificado",
          correo: correo || "No especificado",
          estado: estado || "No especificado",
          sector: sector || "General",
          asociacion: asociacion || "Particular",
          fecha: fecha || new Date().toISOString().split("T")[0]
        };
        memoryAdhesions.unshift(newRecord);
        return res.status(201).json({ success: true, message: "Adhesión registrada con éxito", id: recId });
      }
    }

    // DELETE
    if (req.method === "DELETE") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ success: false, error: "ID requerido" });

      if (hasPostgres) {
        await sql`DELETE FROM adhesiones WHERE id = ${id};`;
      } else {
        memoryAdhesions = memoryAdhesions.filter(a => a.id !== id);
      }
      return res.status(200).json({ success: true, message: "Registro eliminado con éxito" });
    }

    return res.status(405).json({ success: false, error: "Método no permitido" });
  } catch (error) {
    console.error("Error en /api/adhesiones:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
