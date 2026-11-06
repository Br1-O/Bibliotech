/**
 * Project     : Bibliotech  |  Capa: Aplicacion - DTO
 * Forma publica estable de un material para la API.
 */

const fileHelper = require('../../utils/fileHelper');
const mediaValidator = require('../../utils/mediaValidator');

function toMaterialDto(material) {
    if (!material) return material;
    const result = typeof material.toJSON === 'function' ? material.toJSON() : { ...material };
    if (mediaValidator.isFileType(result.tipo)) {
        result.hasStoredFile = Boolean(result.urlOrPath);
        if (fileHelper.isCloudinaryUrl(result.urlOrPath)) result.urlOrPath = null;
    }
    return result;
}

function toMaterialListDto(materials) {
    return (materials || []).map(toMaterialDto);
}

module.exports = { toMaterialDto, toMaterialListDto };
