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
        uploadedBy = null,
        uploaderNombre = null,
        uploaderRol = null,
        author = null,
        categoryId = 5,
        categorySlug = 'technical',
        categoryNombre = null,
        isMandatory = false,
        titulo,
        tipo,
        urlOrPath,
        portada = null,
        fileHash,
        descripcion = null,
        pages = null,
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
        this.uploadedBy = uploadedBy || autorId;
        this.uploaderNombre = uploaderNombre || autorNombre;
        this.uploaderRol = uploaderRol || autorRol;
        this.author = author;
        this.categoryId = Number(categoryId) || 5;
        this.categorySlug = categorySlug || 'technical';
        this.categoryNombre = categoryNombre;
        this.isMandatory = Boolean(isMandatory);
        this.titulo = titulo;
        this.tipo = tipo;
        this.urlOrPath = urlOrPath;
        this.portada = portada;
        this.fileHash = fileHash;
        this.descripcion = descripcion;
        this.pages = Material.normalizePages(pages);
        this.categories = Array.isArray(categories) ? categories : this.parseCategories(categories);
        this.estado = estado;
        this.createdAt = createdAt;
        this.esFavorito = esFavorito || 0;
        this.contadorFavoritos = contadorFavoritos || 0;
    }

    static TIPOS = ['PDF', 'EPUB', 'Word', 'Presentacion', 'Link_Drive', 'Youtube', 'Repositorio'];

    static CATEGORIAS = [
        'fiction', 'literature', 'poetry', 'drama', 'technical', 'science', 'business',
        'education', 'medicine', 'law', 'non-fiction', 'self-help', 'biography', 'history',
        'philosophy', 'religion', 'arts', 'hobbies', 'travel', 'sports', 'cooking', 'kids',
        'young-adult'
    ];

    static normalizePages(value) {
        if (value === null || value === undefined || value === '') return null;
        const pages = Number(value);
        return Number.isInteger(pages) && pages > 0 ? pages : null;
    }

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
