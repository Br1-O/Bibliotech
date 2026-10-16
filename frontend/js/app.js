/**
* Project     : Bibliotech  |  Frontend
* app.js: bootstrap comun. Inicializa el idioma y notifica a las pantallas
* mediante el evento 'bt:ready' cuando el locale ya esta disponible.
*/

document.addEventListener('DOMContentLoaded', async () => {
    await LanguageManager.init();
    // Los componentes reutilizables se montan cuando el DOM ya existe.
    if (window.Loader) Loader.hide();
    document.dispatchEvent(new CustomEvent('bt:ready'));
});
