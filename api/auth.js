import { neon } from "@neondatabase/serverless";

function getSql() {
  const connStr = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connStr) return null;
  return neon(connStr);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const sql = getSql();

  try {
    let currentPass = "ganaderia2030";

    if (sql) {
      // Asegurar que la tabla config exista
      await sql`
        CREATE TABLE IF NOT EXISTS config (
          key VARCHAR(64) PRIMARY KEY,
          value TEXT NOT NULL
        );
      `;

      // Obtener contraseña guardada o inicializar por defecto
      const rows = await sql`SELECT value FROM config WHERE key = 'admin_password';`;

      if (rows.length === 0) {
        await sql`INSERT INTO config (key, value) VALUES ('admin_password', 'ganaderia2030');`;
      } else {
        currentPass = rows[0].value;
      }
    }

    const { action, username, password, currentPassword, newPassword } = req.body;

    // Acción: Login
    if (action === "login") {
      if (username === "admin" && password === currentPass) {
        return res.status(200).json({ success: true, message: "Autenticación exitosa" });
      } else {
        return res.status(401).json({ success: false, error: "Credenciales incorrectas" });
      }
    }

    // Acción: Cambiar Contraseña
    if (action === "change_password") {
      if (currentPassword !== currentPass) {
        return res.status(400).json({ success: false, error: "La contraseña actual no es correcta" });
      }
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ success: false, error: "La nueva contraseña debe tener al menos 6 caracteres" });
      }

      if (sql) {
        await sql`
          INSERT INTO config (key, value) VALUES ('admin_password', ${newPassword})
          ON CONFLICT (key) DO UPDATE SET value = ${newPassword};
        `;
      }

      return res.status(200).json({ success: true, message: "Contraseña actualizada con éxito" });
    }

    return res.status(400).json({ success: false, error: "Acción no válida" });
  } catch (error) {
    console.error("Error en /api/auth:", error);
    return res.status(500).json({ success: false, error: error.message || "Error de servidor" });
  }
}
