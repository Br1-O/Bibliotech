/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (Navegacion)
* Pantalla de pruebas manuales cuando NODE_ENV=testing.
*/

const express = require('express');
const path = require('path');

module.exports = () => {
    const router = express.Router();
    router.get('/', (req, res) => res.sendFile(path.join(__dirname, '../../frontend/html/tests.html')));
    return router;
};
