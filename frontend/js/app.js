/**
* Project     : Bibliotech  |  Frontend
* app.js: bootstrap comun. Inicializa el idioma y notifica a las pantallas
* mediante el evento 'bt:ready' cuando el locale ya esta disponible.
*/
import { Loader } from './components/loader/loader.js';
import { PasswordField } from './components/passwordField/passwordField.js';
import { LanguageManager } from './i18n/LanguageManager.js';
import { authHelper } from './utils/authHelper.js';
import { el } from './utils/dom.js';


document.addEventListener('DOMContentLoaded', async () => {
    if (typeof authHelper !== 'undefined') authHelper.clearLegacyFileCookie();
    await LanguageManager.init();
    // Los componentes reutilizables se montan cuando el DOM ya existe.
    if (typeof PasswordField !== 'undefined') PasswordField.enhanceAll(document);
    document.dispatchEvent(new CustomEvent('bt:ready'));
    if (typeof Loader !== 'undefined') Loader.pageReady();
});
