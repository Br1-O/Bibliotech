/**
* Project     : Bibliotech  |  Frontend - Componente
* ProfileSummary: resumen de rango, racha e insignias para los paneles.
*/

const ProfileSummary = {
    mount(container) {
        if (!container || !authHelper.isAuthenticated()) return;
        const user = authHelper.getUser() || {};
        if (!user.id) return;

        container.classList.add('bt-profile-summary');
        container.textContent = '';
        apiService.get(`/profile/${user.id}`).then(profile => {
            if (!container.isConnected) return;
            const rank = profile.user.rank || {};
            const streak = Number(profile.streak?.currentStreak) || 0;
            const earned = profile.badges || [];
            const progress = Math.round(Number(profile.rankProgress) || 0);

            const badges = earned.length
                ? el('div', { className: 'bt-profile-summary__badges' }, earned.map(badge =>
                    el('img', {
                        attrs: {
                            src: badge.icon,
                            alt: LanguageManager.t(`badges.${badge.key}.name`),
                            title: LanguageManager.t(`badges.${badge.key}.name`),
                            loading: 'lazy'
                        }
                    })))
                : el('span', { className: 'bt-text-muted', text: LanguageManager.t('profile.noBadges') });

            container.append(
                el('div', { className: 'bt-profile-summary__identity' }, [
                    el('img', {
                        className: 'bt-profile-summary__avatar',
                        attrs: { src: profile.user.profilePicture || '/img/profile_pictures/default-1.png', alt: '' }
                    }),
                    el('div', { className: 'bt-stack', style: { gap: '2px' } }, [
                        el('strong', { text: profile.user.nombreCompleto }),
                        el('span', { className: 'bt-card__meta', text: rank.title || LanguageManager.t('profile.noRank') }),
                        el('span', { className: 'bt-card__meta', text: LanguageManager.t('profile.xp', { xp: profile.user.xp || 0 }) })
                    ]),
                    streak > 0
                        ? el('span', { className: 'bt-profile-summary__streak', title: LanguageManager.t('profile.streak') }, [
                            el('span', { attrs: { 'aria-hidden': 'true' }, text: '🔥' }),
                            el('span', { text: String(streak) })
                        ])
                        : null
                ]),
                el('div', { className: 'bt-profile-summary__progress' }, [
                    el('div', { className: 'bt-progress', attrs: { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(progress) } }, [
                        el('span', { attrs: { style: `width:${progress}%` } })
                    ]),
                    el('span', {
                        className: 'bt-card__meta',
                        text: profile.nextRank
                            ? LanguageManager.t('profile.nextRank', {
                                rank: profile.nextRank.title,
                                xp: Math.max(0, profile.nextRank.minXp - (profile.user.xp || 0))
                            })
                            : LanguageManager.t('profile.maxRank')
                    })
                ]),
                el('div', { className: 'bt-profile-summary__footer' }, [
                    badges,
                    el('a', {
                        className: 'bt-btn bt-btn--ghost bt-btn--sm',
                        text: LanguageManager.t('profile.viewProfile'),
                        attrs: { href: '/perfil' }
                    })
                ])
            );
        }).catch(() => {
            container.textContent = '';
        });
    }
};
