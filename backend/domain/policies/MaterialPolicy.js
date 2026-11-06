const PUBLIC_READ_STATES = new Set(['Aprobado']);
const FINAL_STATES = new Set(['Cancelado', 'Rechazado']);

function isPubliclyReadable(material) {
    return Boolean(material && PUBLIC_READ_STATES.has(String(material.estado || '')));
}

function isFinalState(material) {
    return Boolean(material && FINAL_STATES.has(String(material.estado || '')));
}

function isOwner(material, ctx = {}) {
    if (!material || ctx.usuarioId === undefined || ctx.usuarioId === null) return false;
    const userId = Number(ctx.usuarioId);
    return Number(material.autorId) === userId || Number(material.uploadedBy) === userId;
}

function isAuthor(material, ctx = {}) {
    if (!material || ctx.usuarioId === undefined || ctx.usuarioId === null) return false;
    return Number(material.autorId) === Number(ctx.usuarioId);
}

function canAccessFile(material, ctx = {}, { ownedSubjectIds = [] } = {}) {
    if (!material) return false;
    if (isPubliclyReadable(material)) return true;
    if (isOwner(material, ctx)) return true;
    if (ctx.rol === 'Superadmin') return true;
    return ctx.rol === 'Profesor' && ownedSubjectIds.length > 0;
}

function canManage(material, ctx = {}, { ownedSubjectIds = [] } = {}) {
    if (!material || ctx.usuarioId === undefined || ctx.usuarioId === null) return false;
    if (ctx.rol === 'Superadmin') return true;
    if (ctx.rol !== 'Profesor' || isFinalState(material)) return false;
    return isOwner(material, ctx) || ownedSubjectIds.length > 0;
}

function canCancel(material, ctx = {}) {
    return Boolean(material && (ctx.rol === 'Superadmin' || isAuthor(material, ctx)));
}

function canAssociate(ctx = {}) {
    return ctx.rol === 'Profesor';
}

function canModerateSubject(subject, ctx = {}) {
    if (!subject) return false;
    if (ctx.rol === 'Superadmin') return true;
    return ctx.rol === 'Profesor' && typeof subject.hasProfessor === 'function' && subject.hasProfessor(ctx.usuarioId);
}

function canDeleteGlobally(ctx = {}) {
    return ctx.rol === 'Superadmin';
}

module.exports = {
    PUBLIC_READ_STATES,
    FINAL_STATES,
    isPubliclyReadable,
    isFinalState,
    isOwner,
    isAuthor,
    canAccessFile,
    canManage,
    canCancel,
    canAssociate,
    canModerateSubject,
    canDeleteGlobally
};
