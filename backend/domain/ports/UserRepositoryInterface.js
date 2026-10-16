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
    async findAll()                               { return this._notImplemented('findAll'); }
    async findByRole(nombreRol)                   { return this._notImplemented('findByRole'); }
}

module.exports = UserRepositoryInterface;
