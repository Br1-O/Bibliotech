/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (Middleware)
* Resuelve el idioma de la peticion y expone req.t(key, params) para
* traducir mensajes de negocio (RNF-06).
*/

function languageMiddleware(container) {
    const { languageManager } = container;
    const DEFAULT_LANGUAGE = process.env.DEFAULT_LANGUAGE || 'es';

    return (req, res, next) => {
        const requested = (req.query.lang || req.headers['x-language'] ||
            (req.headers['accept-language'] || '').split(',')[0] || '').slice(0, 2).toLowerCase();

        // Si no se pide un idioma valido se usa el idioma por defecto (no el
        // ultimo usado), evitando que el idioma "se filtre" entre peticiones.
        const lang = languageManager.availableLanguages().includes(requested)
            ? requested
            : DEFAULT_LANGUAGE;
        if (languageManager.availableLanguages().includes(lang)) languageManager.setLanguage(lang);

        req.language = lang;
        req.t = (key, params) => languageManager.getThisMessage(key, params || {}, lang);
        next();
    };
}

module.exports = languageMiddleware;
