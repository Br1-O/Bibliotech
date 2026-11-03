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

        /** Activa una cuenta con el token de desarrollo que expone la API. */
        activateAccount: async function (token) {
            var r = await api.request('/auth/activate', {
                method: 'POST', body: { token: token }
            });
            api.assert(r.ok, 'No se pudo activar la cuenta: ' + (r.data && r.data.message));
            return r;
        },

        /** Simula el clic en el enlace de activacion enviado por correo. */
        activateAccountViaLink: async function (token) {
            var base = api.apiBase.replace(/\/api\/?$/, '');
            var res = await fetch(base + '/activar-cuenta/' + encodeURIComponent(token));
            api.assert(res.ok, 'El enlace de activacion no respondio correctamente');
            api.assert(res.url.indexOf('activacion=exitosa') !== -1, 'El enlace de activacion no confirmo la cuenta');
            return res;
        },

        /** Registra un alumno, activa su cuenta y devuelve { id, email, token }. */
        registerVerifiedAlumno: async function (suffix) {
            var email = api.uniq(suffix || 'alumno') + '@bibliotech.edu';
            var password = 'Alumno123';
            var reg = await api.request('/auth/register', {
                method: 'POST',
                body: { nombre: 'Alumno', apellido: 'Verificado', email: email, password: password }
            });
            api.assert(reg.status === 201, 'Registro fallido: ' + (reg.data && reg.data.message));
            api.assert(reg.data.devToken, 'La API no devolvio el token de activacion de desarrollo');
            await api.activateAccount(reg.data.devToken);
            var token = await api.login(email, password);
            api.assert(token, 'Login fallido tras verificar la cuenta');
            return { id: reg.data.user.id, email: email, password: password, token: token };
        },

        /** Crea una materia asignada al profesor semilla y devuelve su id. */
        createProfessorSubject: async function (prefix) {
            var admin = await api.login(api.accounts.admin.email, api.accounts.admin.password);
            api.assert(admin, 'No se pudo iniciar sesion como admin');
            var r = await api.request('/subjects', {
                method: 'POST', token: admin,
                body: {
                    nombre: api.uniq(prefix || 'Materia Profesor'),
                    descripcion: 'Materia de pruebas',
                    profesorId: 2
                }
            });
            api.assert(r.status === 201, 'No se pudo crear la materia del profesor');
            return r.data.subject.id;
        },

        /** Reutiliza una materia del profesor durante toda la suite. */
        professorSubject: async function () {
            if (!api._professorSubject) {
                api._professorSubject = await api.createProfessorSubject('Materia Suite');
            }
            return api._professorSubject;
        },

        createUnassignedSubject: async function (prefix) {
            var admin = await api.login(api.accounts.admin.email, api.accounts.admin.password);
            api.assert(admin, 'No se pudo iniciar sesion como admin');
            var r = await api.request('/subjects', {
                method: 'POST', token: admin,
                body: {
                    nombre: api.uniq(prefix || 'Materia Sin Profesor'),
                    descripcion: 'Materia de pruebas sin titular'
                }
            });
            api.assert(r.status === 201, 'No se pudo crear la materia sin profesor');
            return r.data.subject.id;
        },

        pdfBlob: function (content) {
            return new Blob(['%PDF-1.4\n' + (content || 'contenido de prueba')], { type: 'application/pdf' });
        },

        pngBlob: function (content) {
            var signature = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
            var payload = new TextEncoder().encode(String(content || 'portada de prueba'));
            var bytes = new Uint8Array(signature.length + payload.length);
            bytes.set(signature, 0);
            bytes.set(payload, signature.length);
            return new Blob([bytes], { type: 'image/png' });
        },

        /** Construye un FormData de subida de material con un PDF simulado. */
        pdfForm: function (fields, content) {
            var form = new FormData();
            Object.keys(fields || {}).forEach(function (key) { form.append(key, fields[key]); });
            form.append('archivo', api.pdfBlob(content), 'material-de-prueba.pdf');
            return form;
        },

        /** Descarga autenticada de un archivo de material. */
        fileFetch: async function (material, token, action) {
            var id = material && typeof material === 'object' ? material.id : material;
            var base = api.apiBase.replace(/\/api\/?$/, '');
            var headers = {};
            if (token) headers.Authorization = 'Bearer ' + token;
            return fetch(base + '/api/materials/' + encodeURIComponent(id) + '/' + (action || 'file'), { headers: headers });
        },

        /** Ejecuta todas las pruebas registradas (modo headless). */
        runAll: async function (filter) {
            var results = [];
            for (var i = 0; i < tests.length; i++) {
                var t = tests[i];
                if (filter && t.label.indexOf(filter) === -1) continue;
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
