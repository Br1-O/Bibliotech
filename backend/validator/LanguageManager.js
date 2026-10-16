/**
* Project     : Bibliotech  |  Capa: Validacion (Filter/Validator)
* LanguageManager: carga locales JSON y resuelve mensajes localizados.
* RF-07 / RF-06 (RNF-06): validacion multilenguaje orientada al modelo de negocio.
*
* Diagrama de referencia (SRS 6.2):
*   - _loadLocales()
*   - setLanguage(lang)
*   - getLanguage()
*   - getThisMessage(messageName, params)
*/

const fs = require('fs');
const path = require('path');

class LanguageManager {
    constructor({ directory = path.join(__dirname, 'locales'), defaultLanguage = process.env.DEFAULT_LANGUAGE || 'es' } = {}) {
        this.directory = directory;
        this.locales = {};
        this._loadLocales();
        this.language = this.locales[defaultLanguage] ? defaultLanguage : Object.keys(this.locales)[0];
    }

    /** Carga en memoria todos los archivos .json de la carpeta de locales. */
    _loadLocales() {
        const files = fs.readdirSync(this.directory).filter(f => f.endsWith('.json'));
        files.forEach(file => {
            const lang = path.basename(file, '.json');
            this.locales[lang] = JSON.parse(fs.readFileSync(path.join(this.directory, file), 'utf8'));
        });
    }

    /** Idiomas disponibles. */
    availableLanguages() {
        return Object.keys(this.locales);
    }

    setLanguage(lang) {
        if (!this.locales[lang]) throw new Error(`LANGUAGE_NOT_SUPPORTED:${lang}`);
        this.language = lang;
        return this.language;
    }

    getLanguage() {
        return this.language;
    }

    /**
     * Resuelve una clave con notacion de punto (ej: "validation.required")
     * e interpola parametros {clave}.
     */
    getThisMessage(key, params = {}, lang = this.language) {
        const dict = this.locales[lang] || this.locales[this.language] || {};
        const raw = key.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), dict);
        const template = raw !== undefined ? raw : key;
        return String(template).replace(/\{(\w+)\}/g, (_, token) =>
            params[token] !== undefined ? params[token] : `{${token}}`);
    }
}

module.exports = LanguageManager;
