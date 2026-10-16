/**
* Project     : Bibliotech  |  Capa: Dominio - Puertos de Salida
* Interfaz base de repositorio (RNF-03). Toda implementacion concreta
* (MariaDB, MongoDB, memoria) debe respetar estos contratos.
*/

class RepositoryInterface {
    _notImplemented(method) {
        throw new Error(`REPOSITORY_METHOD_NOT_IMPLEMENTED:${this.constructor.name}.${method}`);
    }
}

module.exports = RepositoryInterface;
