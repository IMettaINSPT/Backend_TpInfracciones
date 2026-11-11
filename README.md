# Sistema de Gestión de Infracciones de Tránsito Municipal 

Backend transaccional desarrollado para la administración, fiscalización, descargo y recaudación digital de infracciones viales dentro de la administración pública municipal.

---

## 📌 Descripción General del Sistema

El sistema centraliza y digitaliza el ciclo de vida de las infracciones viales según el perfil de cada usuario:

* **Inspectores:** Consultan datos vehiculares en calle por patente y labran actas con número correlativo y código de barras.
* **Administrativos:** Gestionan el padrón de titulares y rodados, registran descargos formales de los infractores y procesan cobros digitales (`tarjeta` y `billetera_virtual`) emitiendo comprobantes de pago.
* **Administradores:** Controlan las cuentas operativas del sistema, supervisan auditorías de cambios y anulan cobros o actas restituyendo la deuda automáticamente.
* **Panel de Control:** Consulta de deuda exigible acumulada por patente o consolidada por titular, y balances de recaudación del período.

---

## 🛠️ Tecnologías Usadas

* **Runtime & Framework:** Node.js, Express.js.
* **Lenguaje:** TypeScript (compilación estricta sin tipos ambiguos).
* **Base de Datos:** MongoDB con ODM Mongoose.
* **Seguridad:** JWT (JSON Web Tokens) con RBAC (roles: `admin`, `administrativo`, `inspector`) y contraseñas hasheadas con Bcrypt.
* **Testing:** Vitest, Supertest, MongoDB Memory Server y `@vitest/coverage-v8`.

---

## ⚙️ Variables de Entorno (.env)

El proyecto requiere dos archivos `.env` en la raíz para separar el entorno de desarrollo local de las pruebas automatizadas:

### 1. Archivo `.env.development` (para desarrollo local)
```env
PORT=4000
MONGO_URL=mongodb+srv://ivanmetta_db_user:Progra3_2026@cluster0.l3drqd0.mongodb.net/infracciones_dev?retryWrites=true&w=majority
JWT_SECRET=secreto_desarrollo_seguro_2026
FRONTEND_URL=http://localhost:5173
```

### 2. Archivo `.env.test` (para la suite de pruebas)
```env
PORT=4001
JWT_SECRET=secreto_testing_mock_123
FRONTEND_URL=http://localhost:3000
```
> *Nota: En `.env.test` no se requiere `MONGO_URL` ya que Vitest levanta una base en memoria RAM aislada.*

---

## 📦 Migración Inicial de Datos (Seeders)

El sistema incorpora un script inicial (`src/database/seeder.ts`) que se ejecuta de forma automática al iniciar la conexión con la base de datos. Si la colección de usuarios está vacía, genera los perfiles base iniciales para operar:

| Rol | Email | Contraseña |
| :--- | :--- | :--- |
| **Admin** | `admin@infracciones.gob.ar` | `Admin123!` |
| **Administrativo** | `operador@infracciones.gob.ar` | `Admin123!` |
| **Inspector** | `inspector@infracciones.gob.ar` | `Admin123!` |

---

## ▶️ Ejecución del Servidor

Instalar las dependencias e iniciar el servidor en modo desarrollo con recarga automática:

```bash
npm install
npm run dev
```

---

## 🧪 Ejecución de Tests

Las pruebas de integración corren sobre una base de datos en memoria (`mongodb-memory-server`) sin afectar la base de datos real:

* **Correr todos los tests:**
  ```bash
  npm test
  ```
* **Correr tests con reporte de cobertura:**
  ```bash
  npm run test:coverage
  ```
* **Compilado de codigo :**
  ```bash
  npm run check
  ```