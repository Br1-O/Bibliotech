const test = require('node:test');
const assert = require('node:assert/strict');
const { toMaterialDto, toMaterialListDto } = require('../application/dto/materialDto');

test('toMaterialDto hides Cloudinary source URLs and marks stored files', () => {
    const dto = toMaterialDto({
        id: 7,
        tipo: 'PDF',
        urlOrPath: 'https://res.cloudinary.com/demo/raw/upload/material.pdf'
    });

    assert.equal(dto.id, 7);
    assert.equal(dto.hasStoredFile, true);
    assert.equal(dto.urlOrPath, null);
});

test('toMaterialDto preserves link sources and list mapping', () => {
    const link = { id: 8, tipo: 'Youtube', urlOrPath: 'https://youtube.com/watch?v=1' };
    const list = toMaterialListDto([link, null]);

    assert.equal(list[0].urlOrPath, link.urlOrPath);
    assert.equal(list[1], null);
    assert.equal(link.hasStoredFile, undefined);
});
