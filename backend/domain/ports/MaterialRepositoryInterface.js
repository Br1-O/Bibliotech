/**
* Project     : Bibliotech  |  Capa: Dominio - Puerto de Salida
* Contrato del repositorio de Material educativo.
*/
const RepositoryInterface = require('./RepositoryInterface');

class MaterialRepositoryInterface extends RepositoryInterface {
    async save(material)                                     { return this._notImplemented('save'); }
    async findById(id)                                       { return this._notImplemented('findById'); }
    async findByHash(hash)                                   { return this._notImplemented('findByHash'); }
    async findAllGlobal(filters)                             { return this._notImplemented('findAllGlobal'); }
    async findBySubject(subjectId, filters)                  { return this._notImplemented('findBySubject'); }
    async findByAuthor(authorId, filters)                    { return this._notImplemented('findByAuthor'); }
    async findPendingByAuthor(authorId)                      { return this._notImplemented('findPendingByAuthor'); }
    async findPendingForProfessor(profesorId)                { return this._notImplemented('findPendingForProfessor'); }
    async countPendingByAuthor(authorId)                     { return this._notImplemented('countPendingByAuthor'); }
    async associateToSubject(materialId, subjectId, estado)  { return this._notImplemented('associateToSubject'); }
    async updateAssociationState(materialId, subjectId, estado) { return this._notImplemented('updateAssociationState'); }
    async updateEstado(materialId, estado)                   { return this._notImplemented('updateEstado'); }
    async deleteAssociation(materialId, subjectId)           { return this._notImplemented('deleteAssociation'); }
    async countAssociations(materialId)                      { return this._notImplemented('countAssociations'); }
    async cancelPendingUpload(materialId)                    { return this._notImplemented('cancelPendingUpload'); }
    async rejectPendingUpload(materialId)                    { return this._notImplemented('rejectPendingUpload'); }
    async update(materialId, changes)                        { return this._notImplemented('update'); }
    async delete(materialId)                                 { return this._notImplemented('delete'); }
    async toggleFavorite(materialId, userId)                 { return this._notImplemented('toggleFavorite'); }
    async findFavorites(userId, filters)                     { return this._notImplemented('findFavorites'); }
    async findFavoriteIds(userId)                            { return this._notImplemented('findFavoriteIds'); }
    async countFavorites(materialId)                         { return this._notImplemented('countFavorites'); }
    async setSubjectMandatory(materialId, subjectId, isMandatory) { return this._notImplemented('setSubjectMandatory'); }
    async getSubjectMandatory(materialId, subjectId)         { return this._notImplemented('getSubjectMandatory'); }
    async countApprovedByUploader(uploaderId)                { return this._notImplemented('countApprovedByUploader'); }
    async findFilterOptions()                                { return this._notImplemented('findFilterOptions'); }
    async findByIds(ids)                                     { return this._notImplemented('findByIds'); }
}

module.exports = MaterialRepositoryInterface;
