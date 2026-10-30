/**
* Project     : Bibliotech  |  Capa: Aplicacion - Caso de Uso
* GamificationService: perfil, lecturas, progreso, rachas, insignias, backlog y seguidores.
*/

const AppError = require('../../utils/AppError');

const BADGES = {
    first_commit:      { key: 'first_commit',      icon: '/img/badges/first_commit.png' },
    early_return:      { key: 'early_return',      icon: '/img/badges/early_return.png' },
    overtime:          { key: 'overtime',          icon: '/img/badges/overtime.png' },
    shared_pointer:    { key: 'shared_pointer',    icon: '/img/badges/shared_pointer.png' },
    stack_overflow:    { key: 'stack_overflow',    icon: '/img/badges/stack_overflow.png' },
    array_5:           { key: 'array_5',           icon: '/img/badges/array_5.png' },
    hello_world:       { key: 'hello_world',       icon: '/img/badges/hello_world.png' },
    linter_clean:      { key: 'linter_clean',      icon: '/img/badges/linter_clean.png' },
    code_reviewer:     { key: 'code_reviewer',     icon: '/img/badges/code_reviewer.png' },
    full_stack_reader: { key: 'full_stack_reader', icon: '/img/badges/full_stack_reader.png' }
};

const STREAK_REQUIRED_SECONDS = 300;
const GENDERS = ['Male', 'Female', 'Non-Binary', 'Other'];
const NAME_PATTERN = /^[\p{L}\s]+$/u;
const HANDLE_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{1,98})$/;
const PROFILE_TEXT_FIELDS = ['city', 'country', 'github', 'instagram', 'linkedin', 'phone', 'career', 'institute'];
const LINK_FIELDS = {
    github: /^https?:\/\/(www\.)?github\.com\/[A-Za-z0-9._-]+\/?$/i,
    instagram: /^https?:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._-]+\/?$/i,
    linkedin: /^https?:\/\/(www\.)?linkedin\.com\/(in|company)\/[A-Za-z0-9._-]+\/?$/i
};

const normalizeBirthdate = value => {
    const raw = String(value ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
    const date = new Date(`${raw}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) return null;
    if (date.getTime() > Date.now()) return null;
    const now = new Date();
    let age = now.getUTCFullYear() - date.getUTCFullYear();
    const month = now.getUTCMonth() - date.getUTCMonth();
    if (month < 0 || (month === 0 && now.getUTCDate() < date.getUTCDate())) age -= 1;
    return age >= 0 && age <= 120 ? raw : null;
};

class GamificationService {
    constructor({ gamificationRepository, userRepository, materialRepository, notificationRepository }) {
        this.gamificationRepository = gamificationRepository;
        this.userRepository = userRepository;
        this.materialRepository = materialRepository;
        this.notificationRepository = notificationRepository;
        this.readingSessions = new Map();
    }

    async getProfile(userId, viewerId = null) {
        const user = await this.userRepository.findById(Number(userId));
        if (!user || !user.isActivo()) throw new AppError('errors.notFound', { status: 404 });

        const [stats, badges, streak, ranks, isFollowing] = await Promise.all([
            this.gamificationRepository.getProfileStats(user.id),
            this.gamificationRepository.listBadges(user.id),
            this.gamificationRepository.getStreak(user.id),
            this.gamificationRepository.listRanks(),
            viewerId ? this.gamificationRepository.isFollowing(Number(viewerId), user.id) : false
        ]);

        const currentRank = ranks.find(rank => rank.rankId === user.rankLevel)
            || await this.gamificationRepository.getRankForXp(user.xp);
        const nextRank = ranks.find(rank => rank.minXp > user.xp) || null;
        const isSelf = Number(viewerId) === user.id;

        const profile = user.toSafeJSON();
        profile.rank = currentRank;
        profile.nextRank = nextRank;
        profile.rankProgress = nextRank && currentRank
            ? Math.min(100, Math.max(0, ((user.xp - currentRank.minXp) / (nextRank.minXp - currentRank.minXp)) * 100))
            : 100;

        return {
            user: profile,
            stats: {
                followers: Number(stats.followers) || 0,
                following: Number(stats.following) || 0,
                reads: Number(stats.read_count ?? stats.reads) || 0,
                favorites: Number(stats.favorites) || 0,
                uploads: Number(stats.uploads) || 0,
                backlog: Number(stats.backlog) || 0
            },
            streak,
            nextRank,
            rankProgress: profile.rankProgress,
            badges: badges.map(badge => ({
                ...BADGES[badge.badgeKey],
                unlockedAt: badge.unlockedAt
            })).filter(badge => badge.key),
            allBadges: Object.values(BADGES),
            isFollowing,
            isSelf
        };
    }

    async updateProfile(userId, data = {}) {
        const user = await this.userRepository.findById(userId);
        if (!user) throw new AppError('errors.notFound', { status: 404 });

        const changes = {};
        if (data.nombre !== undefined) {
            const nombre = String(data.nombre).trim();
            if (!nombre) throw new AppError('validation.required', { status: 422, params: { field: 'nombre' } });
            if (nombre.length < 2 || nombre.length > 50 || !NAME_PATTERN.test(nombre)) {
                throw new AppError('validation.invalidData', { status: 422 });
            }
            changes.nombre = nombre;
        }
        if (data.apellido !== undefined) {
            const apellido = String(data.apellido).trim();
            if (!apellido) throw new AppError('validation.required', { status: 422, params: { field: 'apellido' } });
            if (apellido.length < 2 || apellido.length > 50 || !NAME_PATTERN.test(apellido)) {
                throw new AppError('validation.invalidData', { status: 422 });
            }
            changes.apellido = apellido;
        }
        if (data.birthdate !== undefined) {
            if (data.birthdate === null || data.birthdate === '') {
                changes.birthdate = null;
            } else {
                const birthdate = normalizeBirthdate(data.birthdate);
                if (!birthdate) throw new AppError('validation.birthdate', { status: 422 });
                changes.birthdate = birthdate;
            }
        }
        if (data.gender !== undefined) {
            const gender = data.gender === null ? '' : String(data.gender).trim();
            if (!gender || gender === '-') {
                changes.gender = null;
                changes.gender_custom = null;
            } else {
                if (!GENDERS.includes(gender)) throw new AppError('validation.gender', { status: 422 });
                changes.gender = gender;
                if (gender === 'Other') {
                    const custom = String(data.genderCustom ?? '').trim();
                    if (!NAME_PATTERN.test(custom) || custom.length < 3 || custom.length > 10) {
                        throw new AppError('validation.genderCustom', { status: 422 });
                    }
                    changes.gender_custom = custom;
                } else {
                    changes.gender_custom = null;
                }
            }
        }
        for (const field of PROFILE_TEXT_FIELDS) {
            if (data[field] === undefined) continue;
            const value = data[field] === null ? '' : String(data[field]).trim();
            if (!value) { changes[field] = '-'; continue; }
            if ((field === 'city' || field === 'country') &&
                (value.length < 2 || value.length > 50 || !NAME_PATTERN.test(value))) {
                throw new AppError('validation.invalidData', { status: 422 });
            }
            if (field === 'phone' && !/^[0-9+\-\s()]{7,20}$/.test(value)) {
                throw new AppError('validation.invalidData', { status: 422 });
            }
            if (field === 'github' || field === 'instagram' || field === 'linkedin') {
                const valid = LINK_FIELDS[field].test(value) || (HANDLE_PATTERN.test(value) && value.length >= 3 && value.length <= 100);
                if (!valid) throw new AppError('validation.invalidData', { status: 422 });
            }
            if ((field === 'career' || field === 'institute') && (value.length < 2 || value.length > 80)) {
                throw new AppError('validation.invalidData', { status: 422 });
            }
            changes[field] = value;
        }
        if (data.aboutMe !== undefined) {
            const aboutMe = data.aboutMe === null ? '' : String(data.aboutMe).trim();
            if (aboutMe.length > 300) throw new AppError('validation.invalidData', { status: 422 });
            changes.about_me = aboutMe || '-';
        }
        if (data.profilePicture !== undefined) {
            const pictures = await this.gamificationRepository.listProfilePictures();
            const chosen = pictures.find(picture => picture.picture === data.profilePicture);
            if (!chosen || (chosen.level > 0 && chosen.level > user.rankLevel)) {
                throw new AppError('validation.invalidData', { status: 422 });
            }
            changes.profile_picture = chosen.picture;
        }

        await this.userRepository.updateProfile(userId, changes);
        return this.getProfile(userId, userId);
    }

    async toggleRead(userId, materialId) {
        const material = await this.materialRepository.findById(Number(materialId));
        if (!material) throw new AppError('errors.notFound', { status: 404 });

        const existing = await this.gamificationRepository.getRead(userId, material.id);
        if (existing) {
            await this.gamificationRepository.deleteRead(userId, material.id);
            const user = await this.userRepository.findById(userId);
            return { read: false, xp: user.xp, rankLevel: user.rankLevel, rankTitle: user.rankTitle };
        }

        await this.gamificationRepository.addRead(userId, material.id);
        await this.gamificationRepository.removeBacklog(userId, material.id);
        const xp = await this.userRepository.addXp(userId, 100);
        await this.evaluateBadges(userId, { hour: new Date().getHours() });
        await this.notifyFollowers(userId, {
            type: 'read',
            materialId: material.id,
            message: material.titulo
        });
        const user = await this.userRepository.findById(userId);
        return { read: true, xp, rankLevel: user.rankLevel, rankTitle: user.rankTitle };
    }

    async getRead(userId, materialId) {
        const read = await this.gamificationRepository.getRead(userId, Number(materialId));
        const progress = await this.gamificationRepository.getProgress(userId, Number(materialId));
        return { read: Boolean(read), progress };
    }

    async updateProgress(userId, materialId, currentPage, totalPages = null) {
        const material = await this.materialRepository.findById(Number(materialId));
        if (!material) throw new AppError('errors.notFound', { status: 404 });

        const requestedTotal = totalPages === null || totalPages === undefined || totalPages === ''
            ? null : Number(totalPages);
        const effectiveTotal = requestedTotal || Number(material.pages) || null;
        if (!effectiveTotal) {
            throw new AppError('validation.materialPagesMissing', { status: 422 });
        }

        const existingRead = await this.gamificationRepository.getRead(userId, material.id);
        const progress = await this.gamificationRepository.updateProgress(
            userId, material.id, currentPage, effectiveTotal
        );
        const completed = Boolean(progress && progress.totalPages && progress.currentPage >= progress.totalPages);
        if (!completed) return { ...progress, completed: false, read: Boolean(existingRead) };

        await this.gamificationRepository.addRead(userId, material.id);
        await this.gamificationRepository.removeBacklog(userId, material.id);
        if (!existingRead) {
            await this.userRepository.addXp(userId, 100);
            await this.evaluateBadges(userId, { hour: new Date().getHours() });
            await this.notifyFollowers(userId, {
                type: 'read',
                materialId: material.id,
                message: material.titulo
            });
        }
        return { ...progress, completed: true, status: 'read', inBacklog: false, read: true };
    }

    async listReads(userId) {
        const ids = await this.gamificationRepository.listReadIds(userId);
        const materials = await this.materialRepository.findByIds(ids);
        const favoriteIds = new Set((await this.materialRepository.findFavoriteIds(userId)).map(Number));
        materials.forEach(material => { material.esFavorito = favoriteIds.has(Number(material.id)) ? 1 : 0; });
        return this.attachReadFlags(materials, userId);
    }

    async listBacklog(userId) {
        const items = await this.gamificationRepository.listBacklog(userId);
        const materials = await this.materialRepository.findByIds(items.map(item => item.materialId));
        const byId = new Map(materials.map(material => [Number(material.id), material]));
        return items
            .map(item => ({ ...item, material: byId.get(item.materialId) || null }))
            .filter(item => item.material);
    }

    async addToBacklog(userId, materialId) {
        const material = await this.materialRepository.findById(Number(materialId));
        if (!material) throw new AppError('errors.notFound', { status: 404 });
        const item = await this.gamificationRepository.addBacklog(userId, material.id);
        return { added: true, item };
    }

    async removeFromBacklog(userId, materialId) {
        const removed = await this.gamificationRepository.removeBacklog(userId, Number(materialId));
        return { removed };
    }

    async getFlagsForMaterials(userId, materials = []) {
        if (!userId || !materials.length) return materials;
        const ids = materials.map(material => material.id);
        const flags = await this.gamificationRepository.listFlags(userId, ids);
        materials.forEach(material => {
            const backlog = flags.backlog.get(Number(material.id)) || null;
            material.isRead = flags.reads.has(Number(material.id));
            material.inBacklog = Boolean(backlog);
            material.backlogProgress = backlog ? backlog.progress : 0;
            material.backlogCurrentPage = backlog ? backlog.currentPage : 0;
            material.backlogTotalPages = backlog ? backlog.totalPages : null;
        });
        return materials;
    }

    async attachReadFlags(materials, userId) {
        return this.getFlagsForMaterials(userId, Array.isArray(materials) ? materials : []);
    }

    async follow(seguidorId, seguidoId) {
        const seguido = await this.userRepository.findById(Number(seguidoId));
        if (!seguido || !seguido.isActivo()) throw new AppError('errors.notFound', { status: 404 });
        if (Number(seguidorId) === seguido.id) throw new AppError('validation.invalidData', { status: 422 });

        await this.gamificationRepository.follow(seguidorId, seguido.id);
        await this.evaluateBadges(seguidorId, { hour: new Date().getHours() });
        await this.evaluateBadges(seguido.id, { hour: new Date().getHours() });
        return { following: true, followers: await this.gamificationRepository.countFollowers(seguido.id) };
    }

    async unfollow(seguidorId, seguidoId) {
        const removed = await this.gamificationRepository.unfollow(seguidorId, Number(seguidoId));
        return { following: false, removed };
    }

    /**
     * La racha solo avanza tras 5 minutos consecutivos de lectura activa.
     * El visor envia el tiempo acumulado de la sesion (activeSeconds) o el
     * incremento desde el ultimo latido (deltaSeconds).
     */
    async heartbeat(userId, { materialId = null, activeSeconds = 0, deltaSeconds = 0 } = {}) {
        const material = materialId
            ? await this.materialRepository.findById(Number(materialId))
            : null;
        if (!material) {
            const streak = await this.gamificationRepository.getStreak(userId);
            return { ...streak, qualified: false, activeSeconds: 0, requiredSeconds: STREAK_REQUIRED_SECONDS };
        }

        const key = `${userId}:${material.id}`;
        const now = Date.now();
        let session = this.readingSessions.get(key);
        if (!session || now - session.updatedAt > STREAK_REQUIRED_SECONDS * 1000) {
            session = { activeSeconds: 0, updatedAt: now };
            this.readingSessions.set(key, session);
        }
        const reported = Math.max(0, Number(activeSeconds) || 0);
        const delta = Math.min(120, Math.max(0, Number(deltaSeconds) || 0));
        session.activeSeconds = Math.min(24 * 60 * 60,
            Math.max(session.activeSeconds + delta, reported));
        session.updatedAt = now;

        const current = await this.gamificationRepository.getStreak(userId);
        if (session.activeSeconds < STREAK_REQUIRED_SECONDS) {
            return {
                ...current,
                qualified: false,
                activeSeconds: session.activeSeconds,
                requiredSeconds: STREAK_REQUIRED_SECONDS
            };
        }

        const streak = await this.gamificationRepository.registerActivity(userId);
        if (streak.extended) {
            await this.notificationRepository.createMany([userId], {
                type: 'streak',
                message: String(streak.currentStreak)
            });
            if (streak.currentStreak > 1) {
                await this.notifyFollowers(userId, {
                    type: 'streak',
                    message: String(streak.currentStreak)
                });
            }
        }
        return {
            ...streak,
            qualified: true,
            activeSeconds: session.activeSeconds,
            requiredSeconds: STREAK_REQUIRED_SECONDS
        };
    }

    resetHeartbeat(userId, materialId) {
        if (materialId) this.readingSessions.delete(`${userId}:${Number(materialId)}`);
        return { reset: Boolean(materialId) };
    }

    async listProfilePictures(userId) {
        const user = await this.userRepository.findById(userId);
        const pictures = await this.gamificationRepository.listProfilePictures();
        return pictures.filter(picture => picture.level === 0 || picture.level <= (user?.rankLevel || 1));
    }

    async evaluateBadges(userId, context = {}) {
        const [stats, user] = await Promise.all([
            this.gamificationRepository.getProfileStats(userId),
            this.userRepository.findById(userId)
        ]);
        if (!user) return [];

        const earned = [];
        const grant = async key => {
            if (await this.gamificationRepository.addBadge(userId, key)) {
                earned.push(BADGES[key]);
                await this.notificationRepository.createMany([userId], {
                    type: 'badge',
                    message: key
                });
            }
        };

        if (Number(stats.read_count ?? stats.reads) > 0) await grant('hello_world');
        if (Number(stats.uploads) >= 1) await grant('first_commit');
        if (Number(stats.uploads) >= 10) await grant('stack_overflow');
        if (Number(stats.followers) >= 5) await grant('shared_pointer');
        if (Number(stats.following) >= 5) await grant('array_5');
        if (Number(stats.read_count ?? stats.reads) >= 5) await grant('linter_clean');
        if (Number(stats.favorites) >= 10) await grant('code_reviewer');
        if (user.rankLevel >= 5) await grant('full_stack_reader');

        const hour = Number(context.hour);
        if (Number.isFinite(hour)) {
            if (hour >= 5 && hour < 10) await grant('early_return');
            if (hour >= 0 && hour < 5) await grant('overtime');
        }
        return earned;
    }

    async notifyFollowers(userId, { type, message = null, subjectId = null, materialId = null }) {
        const followers = await this.gamificationRepository.listFollowers(userId);
        if (!followers.length) return 0;
        return this.notificationRepository.createMany(followers, {
            type,
            message,
            subjectId,
            materialId,
            actorId: userId
        });
    }

    async onMaterialApproved(userId) {
        await this.evaluateBadges(userId, { hour: new Date().getHours() });
    }

    async onFavoriteChanged(userId) {
        await this.evaluateBadges(userId, { hour: new Date().getHours() });
    }

    async onBacklogChanged(userId) {
        await this.evaluateBadges(userId, { hour: new Date().getHours() });
    }
}

GamificationService.BADGES = BADGES;
GamificationService.STREAK_REQUIRED_SECONDS = STREAK_REQUIRED_SECONDS;

module.exports = GamificationService;
