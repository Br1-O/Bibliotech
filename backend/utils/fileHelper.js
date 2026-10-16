/**
* Project     : Bibliotech  |  Capa: Infraestructura/Utils
* fileHelper: operaciones seguras sobre el filesystem para el material subido.
*/

const fs = require('fs');
const path = require('path');

const fileHelper = {
    /** Elimina un archivo fisico dado su ruta relativa (ej: /uploads/x.pdf). */
    deleteFile(relativePath) {
        if (!relativePath) return false;
        const absolutePath = path.join(process.cwd(), relativePath);
        try {
            if (fs.existsSync(absolutePath)) {
                fs.unlinkSync(absolutePath);
                return true;
            }
        } catch (err) {
            console.error(`Error al borrar archivo: ${err.message}`);
        }
        return false;
    }
};

module.exports = fileHelper;
