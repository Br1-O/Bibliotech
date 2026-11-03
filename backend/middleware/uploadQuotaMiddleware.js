const { getConfig } = require('../config/env');
const AppError = require('../utils/AppError');
const metrics = require('../utils/metrics');

function uploadRequestQuota(req, res, next) {
    const max = getConfig().upload.maxRequestBytes;
    const declared = Number(req.headers['content-length']);
    if (!Number.isFinite(declared) || declared <= 0) {
        metrics.recordUploadRejection('missing_content_length');
        return next(new AppError('validation.uploadLengthRequired', { status: 411 }));
    }
    if (declared > max) {
        metrics.recordUploadRejection('request_too_large');
        return next(new AppError('validation.requestTooLarge', { status: 413 }));
    }
    req.uploadMaxBytes = max;
    return next();
}

module.exports = { uploadRequestQuota };
