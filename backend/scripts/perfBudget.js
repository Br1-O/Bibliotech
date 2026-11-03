/**
* Presupuesto minimo de latencia para consultas calientes.
* Uso: npm run test:perf
* Requiere la misma configuracion DB_* que el backend.
*
* El presupuesto se aplica al costo de la consulta por encima del viaje de ida
* y vuelta a la base (SELECT 1). Asi una base remota no oculta regresiones.
*/

const { performance } = require('perf_hooks');
const db = require('../config/db');

const budgetMs = Math.max(20, Number(process.env.PERF_BUDGET_MS) || 150);

const probes = [
    {
        name: 'catalogo global paginado',
        sql: `SELECT m.id, m.titulo, m.created_at
                FROM materials m
               WHERE m.estado = 'Aprobado'
               ORDER BY m.created_at DESC, m.id DESC LIMIT 20 OFFSET 0`
    },
    {
        name: 'materiales por materia',
        sql: `SELECT m.id, m.titulo, m.created_at
                FROM material_subjects msx
                INNER JOIN materials m ON m.id = msx.material_id
               WHERE msx.subject_id = ? AND msx.estado_aprobacion = 'Aprobado'
                 AND m.estado = 'Aprobado'
               ORDER BY msx.material_id DESC, m.id DESC LIMIT 20 OFFSET 0`,
        params: [1]
    },
    {
        name: 'bandeja de notificaciones',
        sql: `SELECT id, type, created_at FROM notifications
               WHERE usuario_id = ? ORDER BY created_at DESC, id DESC LIMIT 20`,
        params: [1]
    },
    {
        name: 'estadisticas de perfil',
        sql: `SELECT
                (SELECT COUNT(*) FROM user_subscriptions WHERE target_user_id = ?) AS followers,
                (SELECT COUNT(*) FROM user_subscriptions WHERE subscriber_id = ?) AS following,
                (SELECT COUNT(*) FROM material_reads WHERE user_id = ?) AS read_count,
                (SELECT COUNT(*) FROM material_favorites WHERE usuario_id = ?) AS favorites,
                (SELECT COUNT(*) FROM materials WHERE uploaded_by = ? AND estado = 'Aprobado') AS uploads,
                (SELECT COUNT(*) FROM reading_backlog WHERE user_id = ?) AS backlog`,
        params: [1, 1, 1, 1, 1, 1]
    }
];

const runQuery = process.env.DB_PREPARED_STATEMENTS === 'true'
    ? (sql, params) => db.execute(sql, params)
    : (sql, params) => db.query(sql, params);

async function measure(probe) {
    const samples = [];
    for (let i = 0; i < 5; i += 1) {
        const start = performance.now();
        await runQuery(probe.sql, probe.params || []);
        samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    return samples[2];
}

(async () => {
    let failed = false;
    try {
        const baseline = await measure({ sql: 'SELECT 1' });
        console.log(`baseline SELECT 1: ${baseline.toFixed(1)} ms`);
        for (const probe of probes) {
            const median = await measure(probe);
            const overhead = Math.max(0, median - baseline);
            const ok = overhead <= budgetMs;
            if (!ok) failed = true;
            console.log(`${ok ? 'PASS' : 'FAIL'} ${probe.name}: ${median.toFixed(1)} ms total, ${overhead.toFixed(1)} ms overhead (budget ${budgetMs} ms)`);
        }
    } catch (error) {
        console.error(error.message);
        failed = true;
    } finally {
        await db.close();
    }
    process.exit(failed ? 1 : 0);
})();
