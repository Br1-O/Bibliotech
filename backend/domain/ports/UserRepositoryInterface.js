/**
* Project     : Bibliotech  |  Capa: Dominio - Puerto de Salida
* Contrato del repositorio de Usuarios.
*/
const RepositoryInterface = require('./RepositoryInterface');

class UserRepositoryInterface extends RepositoryInterface {
    async save(user)                              { return this._notImplemented('save'); }
    async findById(id)                            { return this._notImplemented('findById'); }
    async findByEmail(email)                      { return this._notImplemented('findByEmail'); }
    async updatePassword(id, hashedPass)          { return this._notImplemented('updatePassword'); }
    async setResetToken(email, token, expiration) { return this._notImplemented('setResetToken'); }
    async findByResetToken(token)                 { return this._notImplemented('findByResetToken'); }
    async setVerificationToken(email, token, expiration) { return this._notImplemented('setVerificationToken'); }
    async findByVerificationToken(token)          { return this._notImplemented('findByVerificationToken'); }
    async verifyUser(id)                          { return this._notImplemented('verifyUser'); }
    async updateEstado(id, estado)                { return this._notImplemented('updateEstado'); }
    async softDelete(id)                          { return this._notImplemented('softDelete'); }
    async findAll()                               { return this._notImplemented('findAll'); }
    async findByRole(nombreRol)                   { return this._notImplemented('findByRole'); }
    async updateProfile(id, data)                 { return this._notImplemented('updateProfile'); }
    async addXp(id, amount)                       { return this._notImplemented('addXp'); }
}

module.exports = UserRepositoryInterface;
