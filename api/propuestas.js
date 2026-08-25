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

    // GET: Obtener todas las propuestas
    if (req.method === "GET") {
      const { rows } = await sql`SELECT * FROM propuestas ORDER BY fecha DESC, id DESC;`;
      return res.status(200).json({ success: true, data: rows });
    }

    // POST: Insertar nueva propuesta
    if (req.method === "POST") {
      const { id, cedula, nombre, telefono, correo, estado, macroeje, titulo, detalle, fecha } = req.body;

      if (!cedula || !nombre || !titulo || !detalle) {
        return res.status(400).json({ success: false, error: "Cédula, Nombre, Título y Descripción son obligatorios" });
      }

      const recId = id || ("prop-" + Date.now());
      const recFecha = fecha || new Date().toISOString().split("T")[0];

      await sql`
        INSERT INTO propuestas (id, cedula, nombre, telefono, correo, estado, macroeje, titulo, detalle, fecha)
        VALUES (${recId}, ${cedula}, ${nombre}, ${telefono || "No especificado"}, ${correo || "No especificado"}, ${estado || "No especificado"}, ${macroeje || "General"}, ${titulo}, ${detalle}, ${recFecha});
      `;

      return res.status(201).json({ success: true, message: "Propuesta registrada con éxito", id: recId });
    }

    // DELETE: Eliminar propuesta por ID
    if (req.method === "DELETE") {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ success: false, error: "ID requerido para eliminar" });
      }

      await sql`DELETE FROM propuestas WHERE id = ${id};`;
      return res.status(200).json({ success: true, message: "Propuesta eliminada con éxito" });
    }

    return res.status(405).json({ success: false, error: "Método no permitido" });
  } catch (error) {
    console.error("Error en /api/propuestas:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
