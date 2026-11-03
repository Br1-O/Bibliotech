const test = require('node:test');
const assert = require('node:assert/strict');
const {
    detectSignature,
    validateFileSignature,
    validateCoverSignature
} = require('../utils/mediaValidator');

test('detectSignature recognizes PDF, ZIP, OLE and image headers', () => {
    assert.equal(detectSignature(Buffer.from('%PDF-1.7\n')), 'pdf');
    assert.equal(detectSignature(Buffer.from([0x50, 0x4B, 0x03, 0x04])), 'zip');
    assert.equal(detectSignature(Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])), 'ole');
    assert.equal(detectSignature(Buffer.from([0xFF, 0xD8, 0xFF, 0xE0])), 'jpeg');
    assert.equal(detectSignature(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])), 'png');
    assert.equal(detectSignature(Buffer.from('GIF89a')), 'gif');
    assert.equal(detectSignature(Buffer.from('RIFF0000WEBP')), 'webp');
    assert.equal(detectSignature(Buffer.from('not a document')), null);
});

test('validateFileSignature matches the declared material type', async () => {
    const pdf = { originalname: 'a.pdf', buffer: Buffer.from('%PDF-1.4\n') };
    const fakePdf = { originalname: 'a.pdf', buffer: Buffer.from('plain text') };
    const docx = { originalname: 'a.docx', buffer: Buffer.from([0x50, 0x4B, 0x03, 0x04]) };
    assert.equal((await validateFileSignature(pdf, 'PDF')).ok, true);
    assert.equal((await validateFileSignature(fakePdf, 'PDF')).ok, false);
    assert.equal((await validateFileSignature(docx, 'Word')).ok, true);
});

test('validateCoverSignature matches image extension', async () => {
    const png = { originalname: 'cover.png', buffer: Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) };
    const fakePng = { originalname: 'cover.png', buffer: Buffer.from('plain text') };
    assert.equal((await validateCoverSignature(png)).ok, true);
    assert.equal((await validateCoverSignature(fakePng)).ok, false);
});
