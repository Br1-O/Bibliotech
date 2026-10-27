/**
* Project     : Bibliotech  |  Capa: Dominio
* Entidad Material educativo (RD-04, RD-05).
*/

class Material {
    constructor({
        id = null,
        autorId,
        autorNombre = null,
        autorRol = null,
        titulo,
        tipo,
        urlOrPath,
        portada = null,
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
        this.autorRol = autorRol;
        this.titulo = titulo;
        this.tipo = tipo;
        this.urlOrPath = urlOrPath;
        this.portada = portada;
        this.fileHash = fileHash;
        this.descripcion = descripcion;
        this.categories = Array.isArray(categories) ? categories : this.parseCategories(categories);
        this.estado = estado;
        this.createdAt = createdAt;
        this.esFavorito = esFavorito || 0;
        this.contadorFavoritos = contadorFavoritos || 0;
    }

    static TIPOS = ['PDF', 'EPUB', 'Word', 'Presentacion', 'Link_Drive', 'Youtube', 'Repositorio'];

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
