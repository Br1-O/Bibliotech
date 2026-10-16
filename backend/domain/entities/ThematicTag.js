/**
* Project     : Bibliotech
*/

class ThematicTag {
    constructor({ id = null, nombre, categoria = 'general', creadoPor = null, baneado = 0, createdAt = null }) {
        this.id = id;
        this.nombre = nombre;
        this.categoria = categoria;
        this.creadoPor = creadoPor;
        this.baneado = baneado;
        this.createdAt = createdAt;
    }
}

module.exports = ThematicTag;
