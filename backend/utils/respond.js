/**
* Project     : Bibliotech  |  Capa: Aplicacion / Utilidades
* Helper de respuesta: traduce las claves de mensaje devueltas por los
* servicios de aplicacion antes de enviarlas al cliente.
*/

function ok(req, res, payload = {}, status = 200) {
    const body = { ...payload };
    if (typeof body.message === 'string' && body.message.includes('.')) {
        body.message = req.t(body.message);
    }
    return res.status(status).json(body);
}

module.exports = { ok };
