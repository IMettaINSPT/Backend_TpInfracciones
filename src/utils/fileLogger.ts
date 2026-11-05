import fs from 'fs';
import path from 'path';

const logsDir = path.join(process.cwd(), 'logs');
const errorLogPath = path.join(logsDir, 'error.log');

// Asegura que el directorio logs/ exista
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

export const logErrorToFile = (err: Error, req?: { method?: string; url?: string; ip?: string }) => {
  const timestamp = new Date().toISOString();
  const method = req?.method || 'N/A';
  const url = req?.url || 'N/A';
  const ip = req?.ip || 'N/A';
  
  const logEntry = `[${timestamp}] [IP: ${ip}] ${method} ${url} - Error: ${err.message}\nStack: ${err.stack || 'No stack trace'}\n------------------------------------------------------------\n`;

  // Agrega al final del archivo de texto sin bloquear
  fs.appendFile(errorLogPath, logEntry, 'utf8', (appendErr) => {
    if (appendErr) {
      console.error('[Logger File Error] No se pudo escribir en el archivo de log:', appendErr);
    }
  });
};