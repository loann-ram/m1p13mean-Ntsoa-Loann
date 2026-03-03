const cron = require('node-cron');
const { creerPaiementsMoisCourant, verifierPaiementsEnRetard } = require('./notification');

function demarrerCronJobs() {

    // ── Job 1 — Le 1er de chaque mois à 00h01 ──
    // Crée le document PaiementLoyer du nouveau mois pour tous les contrats actifs
    cron.schedule('1 0 1 * *', async () => {
        console.log('[CRON] Création des paiements du nouveau mois...');
        await creerPaiementsMoisCourant();
    });

    // ── Job 2 — Chaque jour à 9h00 ──
    // Vérifie les paiements en retard et envoie les notifications
    cron.schedule('0 9 * * *', async () => {
        console.log('[CRON] Vérification des paiements en retard...');
        await verifierPaiementsEnRetard();
    });

    console.log('[CRON] Jobs démarrés ✅');
}

module.exports = { demarrerCronJobs };