/**
* Project     : Bibliotech  |  Capa: Aplicacion / Utilidades
* Calculo de la firma hash (SHA-256) de un archivo para el control de
* unicidad de contenido exacto (RD-05 / RF-04.2).
*/

const crypto = require('crypto');
const fs = require('fs');

const hashHelper = {
    /** Firma digital del contenido de un archivo en disco, sin cargarlo entero en memoria. */
    hashFile(absolutePath) {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            const stream = fs.createReadStream(absolutePath);
            stream.on('error', reject);
            stream.on('data', chunk => hash.update(chunk));
            stream.on('end', () => resolve(hash.digest('hex')));
        });
    },

    /** Firma digital de una cadena (por ejemplo, para enlaces externos). */
    hashString(value) {
        return crypto.createHash('sha256').update(String(value)).digest('hex');
    },

    /** Token aleatorio para recuperacion de contrasena. */
    randomToken(bytes = 32) {
        return crypto.randomBytes(bytes).toString('hex');
    },

    /** Codigo numerico de un solo uso para correos de verificacion/recuperacion. */
    randomCode(length = 6) {
        const max = (10 ** length) - 1;
        return String(crypto.randomInt(0, max + 1)).padStart(length, '0');
    }
};

module.exports = hashHelper;
