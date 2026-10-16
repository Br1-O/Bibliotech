/**
* Project     : Bibliotech  |  Capa: Dominio - Patron Observer
* Sujeto observable generico. Mantiene la lista de observadores y los notifica.
*/

class Observable {
    constructor() {
        this.observers = [];
    }

    attach(observer) {
        if (!this.observers.includes(observer)) this.observers.push(observer);
        return observer;
    }

    detach(observer) {
        this.observers = this.observers.filter(o => o !== observer);
    }

    notify(event, payload) {
        return this.observers.map(observer => observer.update(event, payload));
    }
}

module.exports = Observable;
