const Notification = require('../Model/Notification');
const PaiementLoyer = require('../Model/PaiementLoyer');
const ReservationLocal = require('../Model/ReservationLocal');
const nodemailer = require('nodemailer');
const { getIO } = require('./socket');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

async function creerNotification(clientId, titre, message, type = 'info', lienAction = null) {
    try {
        const notif = await Notification.create({
            clientID:   clientId,
            titre,
            message,
            type,
            lienAction
        });

        const io = getIO();
        if (io) {
            io.to(`user_${clientId}`).emit('nouvelle_notification', {
                _id:        notif._id,
                titre:      notif.titre,
                message:    notif.message,
                type:       notif.type,
                lu:         notif.lu,
                lienAction: notif.lienAction,
                createdAt:  notif.createdAt
            });
            console.log(`🔔 Notification émise → user_${clientId} : ${titre}`);
        }

        return notif;
    } catch (error) {
        console.error('Erreur creerNotification :', error.message);
    }
}
async function envoyerEmailRetard(client, paiement, local) {
    const moisFormate = new Date(paiement.moisConcerne + '-01')
        .toLocaleDateString('fr-FR', {month: 'long', year: 'numeric'});

    const resteAPayer = paiement.montantDu - paiement.montantPaye;

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #c62828; padding: 20px; text-align: center;">
            <h2 style="color: white; margin: 0;">⚠️ Rappel de Paiement</h2>
        </div>
        <div style="padding: 30px; background: #f9f9f9; border: 1px solid #ddd;">
            <p>Bonjour <strong>${client.email}</strong>,</p>
            <p>Nous vous rappelons que votre loyer du mois de <strong>${moisFormate}</strong>
               pour le local <strong>${local?.nom_boutique || 'votre local'}</strong>
               n'a pas encore été réglé.</p>
            <div style="background: white; border-left: 4px solid #c62828; padding: 16px; margin: 20px 0; border-radius: 4px;">
                <p style="margin:0"><strong>Montant dû :</strong> ${paiement.montantDu.toLocaleString('fr-FR')} Ar</p>
                <p style="margin:8px 0 0"><strong>Montant payé :</strong> ${paiement.montantPaye.toLocaleString('fr-FR')} Ar</p>
                <p style="margin:8px 0 0; color: #c62828;"><strong>Reste à payer :</strong> ${resteAPayer.toLocaleString('fr-FR')} Ar</p>
                <p style="margin:8px 0 0"><strong>Date d'échéance :</strong> ${new Date(paiement.dateEcheance).toLocaleDateString('fr-FR')}</p>
            </div>
            <p>Merci de régulariser votre situation dans les plus brefs délais.</p>
        </div>
        <div style="padding: 12px; text-align: center; font-size: 12px; color: #999;">
            MarketSpace — Gestion de locaux commerciaux
        </div>
    </div>`;

    await transporter.sendMail({
        from: `"MarketSpace" <${process.env.EMAIL_USER}>`,
        to: client.email,
        subject: ` Rappel loyer impayé — ${moisFormate}`,
        html
    });
}
async function verifierPaiementsEnRetard() {
    const aujourd_hui = new Date();

    const paiementsEnRetard = await PaiementLoyer.find({
        statut: 'en attente',
        dateEcheance: { $lt: aujourd_hui }
    })
        .populate('clientID', 'email telephone')
        .populate('localID', 'nom_boutique')
        .lean();

    for (const paiement of paiementsEnRetard) {
        await PaiementLoyer.findByIdAndUpdate(paiement._id, { statut: 'en retard' });

        if (!paiement.notificationEnvoyee) {
            const moisFormate = new Date(paiement.moisConcerne + '-01')
                .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            try {
                await envoyerEmailRetard(paiement.clientID, paiement, paiement.localID);

                await creerNotification(
                    paiement.clientID._id,
                    '⚠️ Loyer en retard',
                    `Votre loyer de ${moisFormate} (${paiement.montantDu.toLocaleString('fr-FR')} Ar) n'a pas été payé.`,
                    'retard',
                    '/mes-paiements'
                );

                await PaiementLoyer.findByIdAndUpdate(paiement._id, { notificationEnvoyee: true });
                console.log(`[CRON] Retard notifié → ${paiement.clientID.email}`);
            } catch (err) {
                console.error(`[CRON] Erreur notification → ${paiement.clientID.email}`, err.message);
            }
        }
    }

    console.log(`[CRON] ${paiementsEnRetard.length} paiements en retard traités`);
}
async function creerPaiementsMoisCourant() {
    const now = new Date();
    const annee = now.getFullYear();
    const moisNum = String(now.getMonth() + 1).padStart(2, '0');
    const moisConcerne = `${annee}-${moisNum}`;
    const dateEcheance = new Date(annee, now.getMonth(), 5);

    const reservationsActives = await ReservationLocal
        .find({ status: 'Confirmée' })
        .lean();

    let nbCrees = 0;

    for (const reservation of reservationsActives) {
        const clientId = reservation.clientId;
        if (!clientId) continue;

        const dateDebut = new Date(reservation.createdAt);
        const dateFin = new Date(dateDebut);
        dateFin.setMonth(dateFin.getMonth() + parseInt(reservation.infoLoc?.dure || 0));

        if (now > dateFin) {
            console.log(`[CRON] Contrat terminé → client ${clientId}`);
            continue;
        }

        const existant = await PaiementLoyer.findOne({ clientID: clientId, moisConcerne });
        if (existant) continue;

        const prixRaw = reservation.infoLoc?.prix;
        const montantMensuel = prixRaw?.$numberDecimal
            ? parseFloat(prixRaw.$numberDecimal)
            : parseFloat(prixRaw) || 0;

        await PaiementLoyer.create({
            clientID: clientId,
            localID: reservation.localeID,
            moisConcerne,
            dateEcheance,
            montantDu: montantMensuel,
            montantPaye: 0,
            statut: 'en attente'
        });

        nbCrees++;
    }

    console.log(`[CRON] ${nbCrees} paiements créés pour ${moisConcerne}`);
}
async function creerPaiementMoisEnCours(reponseDemande, clientId, localId, montantMensuel) {
    const now = new Date();
    const annee = now.getFullYear();
    const moisNum = String(now.getMonth() + 1).padStart(2, '0');
    const moisConcerne = `${annee}-${moisNum}`;
    const dateEcheance = new Date(annee, now.getMonth(), 5);

    const existant = await PaiementLoyer.findOne({ clientID: clientId, moisConcerne });
    if (existant) return 0;

    await PaiementLoyer.create({
        reponseDemande,
        clientID: clientId,
        localID: localId,
        moisConcerne,
        dateEcheance,
        montantDu: montantMensuel,
        montantPaye: 0,
        statut: 'en attente'
    });

    console.log(`[PAIEMENT] Mois en cours créé → ${moisConcerne} client ${clientId}`);
    return 1;
}
async function getMesLoyers(clientId, reservation) {
    const paiementsStockes = await PaiementLoyer
        .find({ clientID: clientId })
        .populate('localID', 'nom_boutique emplacement categorie')
        .sort({ moisConcerne: 1 })
        .lean();

    const now = new Date();
    const dateDebut = new Date(reservation.createdAt);
    const duree = parseInt(reservation.infoLoc?.dure || 0);
    const dateFin = new Date(dateDebut);
    dateFin.setMonth(dateFin.getMonth() + duree);

    const prixRaw = reservation.infoLoc?.prix;
    const montantMensuel = prixRaw?.$numberDecimal
        ? parseFloat(prixRaw.$numberDecimal)
        : parseFloat(prixRaw) || 0;

    const moisFuturs = [];
    const dateCurseur = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    while (dateCurseur < dateFin) {
        const annee = dateCurseur.getFullYear();
        const moisNum = String(dateCurseur.getMonth() + 1).padStart(2, '0');

        moisFuturs.push({
            _id: null,
            moisConcerne: `${annee}-${moisNum}`,
            moisLabel: new Date(annee, dateCurseur.getMonth(), 1)
                .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
            dateEcheance: new Date(annee, dateCurseur.getMonth(), 5),
            montantDu: montantMensuel,
            montantPaye: 0,
            resteAPayer: montantMensuel,
            datePaiement: null,
            statut: 'futur',
            modePaiement: null,
            estEnRetard: false,
            isFutur: true
        });

        dateCurseur.setMonth(dateCurseur.getMonth() + 1);
    }

    const paiementsFormats = paiementsStockes.map(p => ({
        _id: p._id,
        moisConcerne: p.moisConcerne,
        moisLabel: new Date(p.moisConcerne + '-01')
            .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
        dateEcheance: p.dateEcheance,
        montantDu: p.montantDu,
        montantPaye: p.montantPaye,
        resteAPayer: Math.max(0, p.montantDu - p.montantPaye),
        datePaiement: p.datePaiement,
        statut: p.statut,
        modePaiement: p.modePaiement,
        referenceTransaction: p.referenceTransaction,
        statutPreuve: p.statutPreuve,
        estEnRetard: ['en retard', 'impaye'].includes(p.statut),
        isFutur: false
    }));

    const totalDu        = paiementsStockes.reduce((s, p) => s + p.montantDu, 0);
    const totalPaye      = paiementsStockes.reduce((s, p) => s + p.montantPaye, 0);
    const nombreEnRetard = paiementsStockes.filter(p =>
        ['en retard', 'impaye'].includes(p.statut)
    ).length;

    return {
        resume: {
            totalDu,
            totalPaye,
            totalRestant: totalDu - totalPaye,
            nombreEnRetard,
            moisRestants: moisFuturs.length,
            totalContrat: (paiementsStockes.length + moisFuturs.length) * montantMensuel
        },
        loyers: [...paiementsFormats, ...moisFuturs]
    };
}

module.exports = {
    creerNotification,
    envoyerEmailRetard,
    verifierPaiementsEnRetard,
    creerPaiementsMoisCourant,
    creerPaiementMoisEnCours,
    getMesLoyers
};
