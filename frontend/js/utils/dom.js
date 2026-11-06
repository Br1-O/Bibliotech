/**
* Project     : Bibliotech  |  Frontend - Utilidades
* dom.js: construccion de nodos nativos sin innerHTML (practica segura).
*/

/**
 * Crea un elemento DOM.
 * @param {string} tag
 * @param {Object} props { className, text, html?, dataset, attrs, on, style }
 * @param {Array<Node|string>} children
 */
function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);

    if (props.className) node.className = props.className;
    if (props.text !== undefined) node.textContent = props.text;
    if (props.id) node.id = props.id;
    if (props.type) node.type = props.type;
    if (props.value !== undefined) node.value = props.value;

    if (props.dataset) {
        Object.entries(props.dataset).forEach(([k, v]) => { node.dataset[k] = v; });
    }
    if (props.attrs) {
        Object.entries(props.attrs).forEach(([k, v]) => node.setAttribute(k, v));
    }
    if (props.style) {
        Object.entries(props.style).forEach(([k, v]) => { node.style[k] = v; });
    }
    if (props.on) {
        Object.entries(props.on).forEach(([event, handler]) => node.addEventListener(event, handler));
    }

    // Cualquier otra clave se trata como atributo (label, variant, size, etc.),
    // de modo que los Web Components reciban sus atributos observados.
    const handled = ['className', 'text', 'value', 'type', 'dataset', 'attrs', 'style', 'on'];
    Object.entries(props).forEach(([key, val]) => {
        if (handled.includes(key)) return;
        if (val === false || val === null || val === undefined) return;
        node.setAttribute(key, val === true ? '' : val);
    });

    [].concat(children).forEach(child => {
        if (child === null || child === undefined) return;
        node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });

    return node;
}

/** Limpia y reemplaza el contenido de un contenedor. */
function render(container, nodes) {
    container.replaceChildren();
    [].concat(nodes).forEach(n => container.appendChild(n));
}

export { el, render };
