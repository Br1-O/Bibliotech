/**
* Project     : Bibliotech
* Author      : Bruno O. Ortuno
* License     : http://www.gnu.org/licenses/gpl.txt  GNU GPL 3.0
* Date        : 2026
*
* Punto de entrada. Ensambla la arquitectura hexagonal:
*   Adaptadores de entrada (REST + navegacion) -> Servicios de aplicacion
*   -> Puertos de salida (repositorios) -> Adaptadores de infraestructura.
*/

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { buildContainer } = require('./infrastructure/container');
const languageMiddleware = require('./middleware/languageMiddleware');
const errorMiddleware = require('./middleware/errorMiddleware');

const container = buildContainer();
const app = express();

// --- Middlewares globales ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(languageMiddleware(container));

// --- Carpetas y archivos estaticos ---
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));
app.use(express.static(path.join(__dirname, '../frontend')));

// --- Rutas de la API (adaptadores de entrada) ---
app.use('/api/auth', require('./routes/authRoutes')(container));
app.use('/api/subjects', require('./routes/subjectRoutes')(container));
app.use('/api/materials', require('./routes/materialRoutes')(container));
app.use('/api/subscriptions', require('./routes/subscriptionRoutes')(container));
app.use('/api/audit', require('./routes/auditRoutes')(container));
app.use('/api/thematic-tags', require('./routes/thematicTagsRoutes')(container));

// --- Rutas de navegacion del frontend ---
if (process.env.NODE_ENV === 'testing') {
    app.use('/', require('./routes/testsRoutes')());
} else {
    app.use('/', require('./routes/viewRoutes')());
}

// --- Manejo centralizado de errores (siempre al final) ---
app.use(require('./middleware/errorMiddleware'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('==========================================');
    console.log('  Bibliotech listo en:');
    console.log(`  http://localhost:${PORT}`);
    console.log('==========================================');
});
