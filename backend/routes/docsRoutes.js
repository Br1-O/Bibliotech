const express = require('express');
const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '..', '..', 'docs');

function sendSpec(req, res, fileName, contentType) {
    const filePath = path.join(DOCS_DIR, fileName);
    return fs.readFile(filePath, (error, content) => {
        if (error) {
            const message = req.t ? req.t('errors.notFound') : 'Not found';
            return res.status(404).json({ message });
        }
        res.set('Cache-Control', 'public, max-age=300');
        res.set('Content-Disposition', `inline; filename="${fileName}"`);
        return res.set('Content-Type', `${contentType}; charset=utf-8`).send(content);
    });
}

module.exports = () => {
    const router = express.Router();

    router.get('/', (req, res) =>
        res.json({
            openapi: ['/api/docs/openapi.yaml', '/api/docs/openapi.json'],
            documentation: '/api/documentation'
        })
    );
    router.get('/openapi.yaml', (req, res) => sendSpec(req, res, 'openapi.yaml', 'application/yaml'));
    router.get('/openapi.json', (req, res) => sendSpec(req, res, 'openapi.json', 'application/json'));

    return router;
};
