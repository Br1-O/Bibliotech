/**
* Project     : Bibliotech  |  Capa: Infraestructura/Utils
* fileHelper: operaciones seguras sobre el almacenamiento del material subido.
* Soporta FILES_MODE local (filesystem) y cloud (Cloudinary).
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
    },

    /**
     * Elimina el material del almacenamiento segun el modo configurado.
     * Los enlaces externos (Drive/YouTube) no se borran.
     * @returns {Promise<boolean>}
     */
    async deleteStorageFile(urlOrPath) {
        if (!urlOrPath || typeof urlOrPath !== 'string') return false;
        // Enlaces externos: no hay archivo propio que eliminar.
        if (!urlOrPath.startsWith('/uploads/')) return false;

        const mode = process.env.FILES_MODE || 'local';
        if (mode === 'cloud') {
            try {
                const cloudinary = require('cloudinary').v2;
                cloudinary.config({
                    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                    api_key: process.env.CLOUDINARY_API_KEY,
                    api_secret: process.env.CLOUDINARY_API_SECRET
                });
                const publicId = urlOrPath.replace(/^\/uploads\//, '');
                // El recurso pudo subirse como imagen (PDF) o como raw (documento).
                for (const resourceType of ['image', 'raw']) {
                    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
                    if (result && (result.result === 'ok' || result.result === 'not found')) return true;
                }
                return false;
            } catch (err) {
                console.error(`Error al borrar archivo remoto: ${err.message}`);
                return false;
            }
        }
        return this.deleteFile(urlOrPath);
    }
};

module.exports = fileHelper;
