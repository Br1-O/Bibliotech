/**
* Project     : Bibliotech  |  Capa: Aplicacion / Utilidades
* Calculo de la firma hash (SHA-256) de un archivo para el control de
* unicidad de contenido exacto (RD-05 / RF-04.2).
*/

const crypto = require('crypto');
const fs = require('fs');

const hashHelper = {
    /** Firma digital del contenido de un archivo en disco. */
    hashFile(absolutePath) {
        const buffer = fs.readFileSync(absolutePath);
        return crypto.createHash('sha256').update(buffer).digest('hex');
    },

    /** Firma digital de una cadena (por ejemplo, para enlaces externos). */
    hashString(value) {
        return crypto.createHash('sha256').update(String(value)).digest('hex');
    },

    /** Token aleatorio para recuperacion de contrasena. */
    randomToken(bytes = 32) {
        return crypto.randomBytes(bytes).toString('hex');
    }
};

module.exports = hashHelper;
