const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const fileHelper = require('../utils/fileHelper');

test('resolveLocalPath rejects remote, protocol-relative and non-http schemes', () => {
    assert.equal(fileHelper.resolveLocalPath('https://res.cloudinary.com/demo/raw/upload/v1/a.pdf'), null);
    assert.equal(fileHelper.resolveLocalPath('http://example.com/a.pdf'), null);
    assert.equal(fileHelper.resolveLocalPath('//example.com/a.pdf'), null);
    assert.equal(fileHelper.resolveLocalPath('data:application/pdf;base64,AAAA'), null);
});

test('resolveLocalPath resolves only paths inside uploads', () => {
    const expected = path.join(fileHelper.UPLOAD_DIR, 'a.pdf');
    assert.equal(fileHelper.resolveLocalPath('/uploads/a.pdf'), expected);
    assert.equal(fileHelper.resolveLocalPath('uploads/a.pdf'), expected);
    assert.equal(fileHelper.resolveLocalPath(path.join(fileHelper.UPLOAD_DIR, 'a.pdf')), expected);
    assert.equal(fileHelper.resolveLocalPath('/uploads/../../etc/passwd'), null);
    assert.equal(fileHelper.resolveLocalPath('/etc/passwd'), null);
});

test('isCloudinaryUrl matches Cloudinary hosts only', () => {
    assert.equal(fileHelper.isCloudinaryUrl('https://res.cloudinary.com/demo/raw/upload/v1/a.pdf'), true);
    assert.equal(fileHelper.isCloudinaryUrl('https://res.cloudinary.com.evil.example/a.pdf'), false);
    assert.equal(fileHelper.isCloudinaryUrl('https://example.com/a.pdf'), false);
    assert.equal(fileHelper.isCloudinaryUrl('/uploads/a.pdf'), false);
});

test('deleteStorageFile ignores external URLs that are not Cloudinary assets', async () => {
    assert.equal(await fileHelper.deleteStorageFile('https://drive.google.com/file/d/abc/view'), false);
    assert.equal(await fileHelper.deleteStorageFile('https://www.youtube.com/watch?v=abc123'), false);
});

test('deleteStorageFile deletes local uploads by origin instead of FILES_MODE', async () => {
    fs.mkdirSync(fileHelper.UPLOAD_DIR, { recursive: true });
    const name = `.test-${process.pid}-${Date.now()}.pdf`;
    const absolute = path.join(fileHelper.UPLOAD_DIR, name);
    fs.writeFileSync(absolute, '%PDF-1.4');
    try {
        assert.equal(await fileHelper.deleteStorageFile(`/uploads/${name}`), true);
        assert.equal(fs.existsSync(absolute), false);
    } finally {
        if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
    }
});
