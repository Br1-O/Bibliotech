/**
* Project     : Bibliotech  |  Capa: Dominio
* Entidad Material educativo (RD-04, RD-05).
*/

class Material {
    constructor({
        id = null,
        autorId,
        autorNombre = null,
        titulo,
        tipo,
        urlOrPath,
        fileHash,
        descripcion = null,
        categories = [],
        estado = 'Pendiente',
        createdAt = null,
        esFavorito = 0,
        contadorFavoritos = 0
    }) {
        this.id = id;
        this.autorId = autorId;
        this.autorNombre = autorNombre;
        this.titulo = titulo;
        this.tipo = tipo;
        this.urlOrPath = urlOrPath;
        this.fileHash = fileHash;
        this.descripcion = descripcion;
        this.categories = Array.isArray(categories) ? categories : this.parseCategories(categories);
        this.estado = estado;
        this.createdAt = createdAt;
        this.esFavorito = esFavorito || 0;
        this.contadorFavoritos = contadorFavoritos || 0;
    }

    static TIPOS = ['PDF', 'Word', 'Presentacion', 'Link_Drive', 'Youtube'];

    parseCategories(raw) {
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        return String(raw).split(',').map(c => c.trim()).filter(Boolean);
    }

    /** RD-04: un alumno solo puede cancelar mientras siga pendiente. */
    cancelUpload() {
        if (this.estado !== 'Pendiente') throw new Error('MATERIAL_NOT_CANCELLABLE');
        this.estado = 'Cancelado';
    }

    toJSON() {
        return { ...this, categories: this.categories };
    }
}

module.exports = Material;
