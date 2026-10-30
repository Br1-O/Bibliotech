/**
* Project     : Bibliotech  |  Frontend - Componente
* ContentTabs: pestanas reutilizables de materiales del usuario.
*/

const ContentTabs = {
    definitions: [
        ['uploads', 'profile.tabs.uploads'],
        ['favorites', 'profile.tabs.favorites'],
        ['reads', 'profile.tabs.reads'],
        ['backlog', 'profile.tabs.backlog']
    ],

    render({ active = 'uploads', onChange }) {
        const buttons = this.definitions.map(([key, label]) => {
            const btn = el('button', {
                className: `bt-profile__tab${active === key ? ' is-active' : ''}`,
                attrs: { type: 'button', role: 'tab', 'aria-selected': active === key ? 'true' : 'false' },
                text: LanguageManager.t(label)
            });
            btn.addEventListener('click', () => onChange?.(key));
            return btn;
        });
        return el('div', { className: 'bt-profile__tabs', attrs: { role: 'tablist' } }, buttons);
    }
};
