import { sql } from "@vercel/postgres";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // Asegurar que la tabla exista
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

    // GET: Obtener todas las adhesiones
    if (req.method === "GET") {
      const { rows } = await sql`SELECT * FROM adhesiones ORDER BY fecha DESC, id DESC;`;
      return res.status(200).json({ success: true, data: rows });
    }

    // POST: Insertar nueva adhesión
    if (req.method === "POST") {
      const { id, cedula, nombre, telefono, correo, estado, sector, asociacion, fecha } = req.body;

      if (!cedula || !nombre) {
        return res.status(400).json({ success: false, error: "Cédula y Nombre son obligatorios" });
      }

      // Validar que la cédula NO esté duplicada en las adhesiones
      const existing = await sql`SELECT id, nombre FROM adhesiones WHERE cedula = ${cedula};`;
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
    }

    // DELETE: Eliminar adhesión por ID
    if (req.method === "DELETE") {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ success: false, error: "ID requerido para eliminar" });
      }

      await sql`DELETE FROM adhesiones WHERE id = ${id};`;
      return res.status(200).json({ success: true, message: "Registro eliminado con éxito" });
    }

    return res.status(405).json({ success: false, error: "Método no permitido" });
  } catch (error) {
    console.error("Error en /api/adhesiones:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
