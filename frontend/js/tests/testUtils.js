/**
 * Project : Bibliotech | Frontend - Suite de pruebas (utilidades)
 * Autor   : Bruno O. Ortuno
 *
 * Utilidades para la consola de pruebas de la API (tests.html).
 * No depende de los componentes de la aplicacion: solo de la Fetch API,
 * de modo que la misma suite puede ejecutarse en el navegador o en Node
 * (ver testUtils.runAll) para verificar el backend de punta a punta.
 */

var testUtils = (function () {
    'use strict';

    var hasDOM = (typeof document !== 'undefined' && typeof document.getElementById === 'function');
    var tests = [];

    var api = {
        // Registro de pruebas creadas por los modulos de test.
        tests: tests,
        // Base de la API: la consola se sirve desde el mismo origen que el backend.
        apiBase: '/api',
        console: hasDOM ? document.getElementById('api-console') : null,

        // Credenciales semilla (ver backend/config/init.sql).
        accounts: {
            admin: { email: 'admin@bibliotech.edu', password: 'Admin123' },
            profesor: { email: 'profesor@bibliotech.edu', password: 'Profesor123' },
            alumno: { email: 'alumno@bibliotech.edu', password: 'Alumno123' }
        },

        /** Genera un identificador unico para datos de prueba. */
        uniq: function (prefix) {
            return (prefix || 'test') + '-' + Date.now() + '-' + Math.floor(Math.random() * 1e5);
        },

        /**
         * Registra una prueba y crea su boton en el navegador.
         * En Node solo la registra para ejecutarla con runAll().
         */
        createTestButton: function (label, testFn) {
            var entry = { label: label, fn: testFn, button: null };
            tests.push(entry);
            if (!hasDOM) return;

            var btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = label;
            btn.className = 'bt-btn bt-btn--secondary bt-btn--block bt-test-btn';
            btn.onclick = async function () {
                api.setLoading(btn);
                try {
                    await testFn(btn);
                    api.setSuccess(btn);
                } catch (err) {
                    api.log('Error de ejecucion: ' + err.message, true);
                    api.setError(btn);
                }
            };
            entry.button = btn;
            document.getElementById('test-container').appendChild(btn);
        },

        /** Escribe en la consola simulada (o en stdout en Node). */
        log: function (data, isError) {
            var text = '[' + new Date().toLocaleTimeString() + '] ' +
                (typeof data === 'string' ? data : JSON.stringify(data, null, 2));

            if (!this.console) {
                (isError ? console.error : console.log)(text);
                return;
            }

            var entry = document.createElement('pre');
            entry.className = 'bt-test__log' + (isError ? ' is-error' : '');
            entry.textContent = text;
            while (this.console.firstChild) this.console.removeChild(this.console.firstChild);
            this.console.appendChild(entry);
        },

        setLoading: function (btn) { if (btn) btn.className = 'bt-btn bt-btn--accent bt-btn--block'; },
        setSuccess: function (btn) { if (btn) btn.className = 'bt-btn bt-btn--success bt-btn--block'; },
        setError:   function (btn) { if (btn) btn.className = 'bt-btn bt-btn--danger bt-btn--block'; },

        /** Asercion simple: lanza si la condicion es falsa. */
        assert: function (condition, message) {
            if (!condition) throw new Error(message || 'Aserción fallida');
        },

        /**
         * Peticion HTTP contra la API.
         * @param {string} path    Ruta relativa, p.ej. '/auth/login'.
         * @param {Object} options { method, token, body, form, lang }
         * @returns {Promise<{ok:boolean,status:number,data:Object}>}
         */
        request: async function (path, options) {
            options = options || {};
            var headers = {};
            if (options.token) headers['Authorization'] = 'Bearer ' + options.token;
            if (options.lang) headers['X-Language'] = options.lang;

            var body;
            if (options.form) {
                body = options.form; // FormData: el runtime fija el boundary
            } else if (options.body !== undefined) {
                headers['Content-Type'] = 'application/json';
                body = JSON.stringify(options.body);
            }

            var url = api.apiBase + path;
            if (options.lang && options.langInQuery) {
                url += (url.indexOf('?') === -1 ? '?' : '&') + 'lang=' + options.lang;
            }

            var res = await fetch(url, { method: options.method || 'GET', headers: headers, body: body });
            var data = null;
            try { data = await res.json(); } catch (e) { data = null; }
            return { ok: res.ok, status: res.status, data: data };
        },

        /** Inicia sesion y devuelve el token (o null si falla). */
        login: async function (email, password) {
            var r = await api.request('/auth/login', {
                method: 'POST', body: { email: email, password: password }
            });
            return (r.data && r.data.token) || null;
        },

        /** Construye un FormData de subida de material con un PDF simulado. */
        pdfForm: function (fields, content) {
            var form = new FormData();
            Object.keys(fields || {}).forEach(function (key) { form.append(key, fields[key]); });
            var blob = new Blob([content || 'contenido de prueba'], { type: 'application/pdf' });
            form.append('archivo', blob, 'material-de-prueba.pdf');
            return form;
        },

        /** Ejecuta todas las pruebas registradas (modo headless). */
        runAll: async function () {
            var results = [];
            for (var i = 0; i < tests.length; i++) {
                var t = tests[i];
                if (hasDOM && t.button) api.setLoading(t.button);
                try {
                    await t.fn(t.button);
                    results.push({ label: t.label, ok: true });
                    if (hasDOM && t.button) api.setSuccess(t.button);
                } catch (err) {
                    results.push({ label: t.label, ok: false, error: err.message });
                    api.log('FALLO [' + t.label + ']: ' + err.message, true);
                    if (hasDOM && t.button) api.setError(t.button);
                }
            }
            return results;
        }
    };

    return api;
})();

if (typeof module !== 'undefined' && module.exports) module.exports = testUtils;
