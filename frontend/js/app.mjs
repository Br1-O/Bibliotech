/**
* Project     : Bibliotech  |  Frontend
* app.js: bootstrap comun. Inicializa el idioma y notifica a las pantallas
* mediante el evento 'bt:ready' cuando el locale ya esta disponible.
*/
import { Loader } from './components/loader/loader.mjs';
import { PasswordField } from './components/passwordField/passwordField.mjs';
import { LanguageManager } from './i18n/LanguageManager.mjs';
import { authHelper } from './utils/authHelper.mjs';
import { el } from './utils/dom.mjs';


document.addEventListener('DOMContentLoaded', async () => {
    if (typeof authHelper !== 'undefined') authHelper.clearLegacyFileCookie();
    await LanguageManager.init();
    // Los componentes reutilizables se montan cuando el DOM ya existe.
    if (typeof PasswordField !== 'undefined') PasswordField.enhanceAll(document);
    document.dispatchEvent(new CustomEvent('bt:ready'));
    if (typeof Loader !== 'undefined') Loader.pageReady();
});
