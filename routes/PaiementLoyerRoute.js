const express = require('express');
const router = express.Router();
const { getIO } = require('../utils/socket');
const { createUpload, cloudinary, extractPublicId } = require('../config/cloudinary');

const PaiementLoyer = require('../model/PaiementLoyer');
const ReservationLocal = require('../model/ReservationLocal');
const Notification = require('../model/Notification');
const Local = require('../model/Local');
const Utilisateur = require('../model/Utilisateur');
const auth = require("../middleware/auth");

// ─────────────────────────────────────────────
// CONFIG CLOUDINARY — stockage des preuves de paiement
// ─────────────────────────────────────────────
const uploadPreuve = createUpload({
    folder: 'preuves-paiement',
    allowedFormats: ['jpg', 'jpeg', 'png', 'pdf'],
    maxSizeMB: 5
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — getMesLoyers
// ─────────────────────────────────────────────────────────────────────────────
async function getMesLoyers(clientId, reservation) {
    const prixRaw = reservation.infoLoc?.prix;
    const loyerMensuel = prixRaw?.$numberDecimal
        ? parseFloat(prixRaw.$numberDecimal)
        : parseFloat(prixRaw) || 0;

    const duree = parseInt(reservation.infoLoc?.dure) || 0;
    const dateDebut = new Date(reservation.createdAt);

    const paiementsStockes = await PaiementLoyer
        .find({ clientID: clientId })
        .populate('localID', 'nom_boutique emplacement')
        .sort({ moisConcerne: 1 })
        .lean();

    const moisContrat = [];
    for (let i = 0; i < duree; i++) {
        const d = new Date(dateDebut);
        d.setMonth(d.getMonth() + i);
        const moisKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        moisContrat.push(moisKey);
    }

    const today = new Date();
    const loyers = moisContrat.map((moisKey, idx) => {
        const paiement = paiementsStockes.find(p => p.moisConcerne === moisKey);

        const dateEcheance = new Date(dateDebut);
        dateEcheance.setMonth(dateEcheance.getMonth() + idx + 1);

        const moisLabel = new Date(moisKey + '-01')
            .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

        const montantDu = paiement?.montantDu ?? loyerMensuel;
        const montantPaye = paiement?.montantPaye ?? 0;
        const resteAPayer = Math.max(0, montantDu - montantPaye);

        let statut = paiement?.statut ?? 'en attente';
        const estEnRetard = ['en retard', 'impaye'].includes(statut);

        return {
            _id: paiement?._id ?? null,
            moisConcerne: moisKey,
            moisLabel,
            dateEcheance,
            montantDu,
            montantPaye,
            resteAPayer,
            datePaiement: paiement?.datePaiement ?? null,
            statut,
            modePaiement: paiement?.modePaiement ?? null,
            referenceTransaction: paiement?.referenceTransaction ?? null,
            statutPreuve: paiement?.statutPreuve ?? null,
            estEnRetard,
            joursRetard: estEnRetard
                ? Math.floor((today - new Date(dateEcheance)) / (1000 * 60 * 60 * 24))
                : 0,
            note: paiement?.note ?? null
        };
    });

    const totalDu   = loyers.reduce((s, l) => s + l.montantDu, 0);
    const totalPaye = loyers.reduce((s, l) => s + l.montantPaye, 0);
    const moisActuel = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const moisRestants = moisContrat.filter(m => m >= moisActuel).length;

    const resume = {
        moisEnCours: moisActuel,
        loyerMensuel,
        duree,
        moisRestants,
        totalDu,
        totalPaye,
        totalRestant: Math.max(0, totalDu - totalPaye),
        nombreEnRetard: loyers.filter(l => l.estEnRetard).length
    };

    return { resume, loyers };
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 1 — Client voit tous ses loyers avec statuts
// GET /api/paiements/mes-loyers
// ─────────────────────────────────────────────────────────────────────────────
router.get('/mes-loyers',auth, async (req, res) => {
    try {
        const clientId = req.user.id;

        const reservation = await ReservationLocal
            .findOne({ clientId: clientId, status: 'Confirmée' })
            .sort({ createdAt: -1 })
            .lean();

        if (!reservation) {
            return res.json({ message: 'Aucune réservation active', loyers: [], resume: null });
        }

        const { resume, loyers } = await getMesLoyers(clientId, reservation);
        return res.json({ resume, loyers });

    } catch (err) {
        console.error('[GET /mes-loyers]', err);
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 2 — Admin voit les loyers d'un client (par ID ou email)
// GET /PaimentCm/admin/client/:clientId
// ─────────────────────────────────────────────────────────────────────────────
router.get('/admin/client/:clientId', async (req, res) => {
    try {
        const { clientId } = req.params;

        const isEmail = clientId.includes('@');
        const client = isEmail
            ? await Utilisateur.findOne({ email: clientId }).lean()
            : await Utilisateur.findById(clientId).lean();

        if (!client) return res.status(404).json({ message: 'Client introuvable' });

        const realClientId = client._id;

        const paiements = await PaiementLoyer
            .find({ clientID: realClientId })
            .populate('clientID', 'email telephone')
            .populate('localID', 'nom_boutique emplacement loyer')
            .sort({ moisConcerne: 1 })
            .lean();

        const totalDu   = paiements.reduce((s, p) => s + p.montantDu, 0);
        const totalPaye = paiements.reduce((s, p) => s + p.montantPaye, 0);

        const loyers = paiements.map(p => ({
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
            joursRetard: ['en retard', 'impaye'].includes(p.statut)
                ? Math.floor((new Date() - new Date(p.dateEcheance)) / (1000 * 60 * 60 * 24))
                : 0,
            note: p.note
        }));

        return res.json({
            client: { _id: client._id, email: client.email, telephone: client.telephone },
            local: paiements[0]?.localID || null,
            resume: {
                totalDu,
                totalPaye,
                totalRestant: totalDu - totalPaye,
                nombreEnRetard: loyers.filter(p => p.estEnRetard).length
            },
            loyers
        });

    } catch (err) {
        console.error('[GET /admin/client]', err);
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 3 — Admin liste tous les loyers non payés
// GET /api/paiements/admin/a-encaisser
// ─────────────────────────────────────────────────────────────────────────────
router.get('/admin/a-encaisser', async (req, res) => {
    try {
        const paiements = await PaiementLoyer
            .find({ statut: { $in: ['en attente', 'en retard', 'impaye'] } })
            .populate('clientID', 'email telephone')
            .populate('localID', 'nom_boutique emplacement')
            .sort({ dateEcheance: 1 })
            .lean();

        const paiementsFormats = paiements.map(p => ({
            _id: p._id,
            client: p.clientID,
            local: p.localID,
            moisLabel: new Date(p.moisConcerne + '-01')
                .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
            moisConcerne: p.moisConcerne,
            dateEcheance: p.dateEcheance,
            montantDu: p.montantDu,
            montantPaye: p.montantPaye,
            resteAPayer: Math.max(0, p.montantDu - p.montantPaye),
            statut: p.statut,
            statutPreuve: p.statutPreuve,
            joursRetard: ['en retard', 'impaye'].includes(p.statut)
                ? Math.floor((new Date() - new Date(p.dateEcheance)) / (1000 * 60 * 60 * 24))
                : 0
        }));

        return res.json({ total: paiementsFormats.length, paiements: paiementsFormats });

    } catch (err) {
        console.error('[GET /admin/a-encaisser]', err);
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 4 — Admin liste les preuves en attente de validation
// GET /api/paiements/admin/preuves-en-attente
// ─────────────────────────────────────────────────────────────────────────────
router.get('/admin/preuves-en-attente', async (req, res) => {
    try {
        const preuves = await PaiementLoyer
            .find({ statutPreuve: 'en_attente_validation' })
            .populate('clientID', 'email telephone')
            .populate('localID', 'nom_boutique emplacement')
            .sort({ updatedAt: -1 })
            .lean();

        const preuvesFormats = preuves.map(p => ({
            _id: p._id,
            client: p.clientID,
            local: p.localID,
            moisLabel: new Date(p.moisConcerne + '-01')
                .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
            montantDu: p.montantDu,
            montantPaye: p.montantPaye,
            modePaiement: p.modePaiement,
            referenceTransaction: p.referenceTransaction,
            preuveUrl: p.preuveCheminFichier || null, // ← déjà une URL Cloudinary complète
            soumisLe: p.updatedAt
        }));

        return res.json({ total: preuvesFormats.length, preuves: preuvesFormats });

    } catch (err) {
        console.error('[GET /admin/preuves-en-attente]', err);
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 5 — Client soumet sa preuve de paiement
// POST /api/paiements/soumettre-preuve/:paiementId
// ─────────────────────────────────────────────────────────────────────────────
router.post('/soumettre-preuve/:paiementId', uploadPreuve.single('preuve'), async (req, res) => {
    try {
        const { paiementId } = req.params;
        const { modePaiement, referenceTransaction } = req.body;
        const clientId = req.user.id;

        if (!req.file) {
            return res.status(400).json({ message: 'Aucune preuve uploadée' });
        }

        if (!['mvola', 'orange_money'].includes(modePaiement)) {
            // Supprimer de Cloudinary
            const publicId = extractPublicId(req.file.path);
            if (publicId) await cloudinary.uploader.destroy(publicId);
            return res.status(400).json({ message: 'Mode invalide. Valeurs: mvola | orange_money' });
        }

        const paiement = await PaiementLoyer.findById(paiementId);
        if (!paiement) return res.status(404).json({ message: 'Paiement introuvable' });

        if (String(paiement.clientID) !== String(clientId)) {
            const publicId = extractPublicId(req.file.path);
            if (publicId) await cloudinary.uploader.destroy(publicId);
            return res.status(403).json({ message: 'Accès refusé' });
        }

        if (paiement.statut === 'paye') {
            const publicId = extractPublicId(req.file.path);
            if (publicId) await cloudinary.uploader.destroy(publicId);
            return res.status(409).json({ message: 'Ce mois est déjà payé' });
        }

        if (paiement.statutPreuve === 'en_attente_validation') {
            const publicId = extractPublicId(req.file.path);
            if (publicId) await cloudinary.uploader.destroy(publicId);
            return res.status(409).json({ message: 'Une preuve est déjà en attente de validation' });
        }

        await PaiementLoyer.findByIdAndUpdate(paiementId, {
            preuveCheminFichier: req.file.path, // ← URL Cloudinary complète
            referenceTransaction: referenceTransaction || null,
            modePaiement,
            statutPreuve: 'en_attente_validation'
        });

        return res.status(201).json({
            message: 'Preuve soumise. En attente de validation par l\'admin.',
            statutPreuve: 'en_attente_validation'
        });

    } catch (err) {
        console.error('[POST /soumettre-preuve]', err);
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 6 — Admin valide ou rejette une preuve
// PATCH /api/paiements/admin/valider-preuve/:paiementId
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/admin/valider-preuve/:paiementId', async (req, res) => {
    try {
        const { paiementId } = req.params;
        const { decision, montantPaye, note } = req.body;

        if (!['valider', 'rejeter'].includes(decision)) {
            return res.status(400).json({ message: 'Decision invalide. Valeurs: valider | rejeter' });
        }

        const paiement = await PaiementLoyer.findById(paiementId)
            .populate('clientID', 'email telephone')
            .populate('localID', 'nom_boutique');

        if (!paiement) return res.status(404).json({ message: 'Paiement introuvable' });

        if (paiement.statutPreuve !== 'en_attente_validation') {
            return res.status(409).json({ message: 'Aucune preuve en attente pour ce paiement' });
        }

        const moisLabel = new Date(paiement.moisConcerne + '-01')
            .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

        if (decision === 'valider') {
            const montant = parseFloat(montantPaye) || paiement.montantDu;
            const nouveauMontantPaye = paiement.montantPaye + montant;
            const nouveauStatut = nouveauMontantPaye >= paiement.montantDu ? 'paye' : 'en retard';
            const resteAPayer = Math.max(0, paiement.montantDu - nouveauMontantPaye);

            await PaiementLoyer.findByIdAndUpdate(paiementId, {
                montantPaye: nouveauMontantPaye,
                datePaiement: new Date(),
                statut: nouveauStatut,
                statutPreuve: 'validee',
                note: note || null
            });

            getIO().to(`user_${paiement.clientID._id}`).emit('paiement_mis_a_jour', {
                paiementId,
                statut: nouveauStatut,
                statutPreuve: 'validee',
                montantPaye: nouveauMontantPaye,
                resteAPayer,
                message: '✅ Votre preuve a été validée'
            });

            await creerNotification(
                paiement.clientID._id,
                '✅ Paiement confirmé',
                `Votre preuve pour ${moisLabel} a été validée. Merci !`,
                'paiement',
                '/mes-paiements'
            );

            return res.json({
                message: `Preuve validée ✅ — statut: ${nouveauStatut}`,
                nouveauStatut,
                montantPaye: nouveauMontantPaye,
                resteAPayer
            });

        } else {
            // Rejeter — supprimer le fichier de Cloudinary
            if (paiement.preuveCheminFichier) {
                const publicId = extractPublicId(paiement.preuveCheminFichier);
                if (publicId) await cloudinary.uploader.destroy(publicId);
            }

            await PaiementLoyer.findByIdAndUpdate(paiementId, {
                preuveCheminFichier: null,
                referenceTransaction: null,
                statutPreuve: 'rejetee',
                note: note || 'Preuve rejetée par l\'administrateur'
            });

            getIO().to(`user_${paiement.clientID._id}`).emit('paiement_mis_a_jour', {
                paiementId,
                statut: paiement.statut,
                statutPreuve: 'rejetee',
                message: '❌ Votre preuve a été rejetée'
            });

            await creerNotification(
                paiement.clientID._id,
                '❌ Preuve rejetée',
                `Votre preuve pour ${moisLabel} a été rejetée. Raison: ${note || 'non conforme'}. Soumettez-en une nouvelle.`,
                'retard',
                '/mes-paiements'
            );

            return res.json({ message: 'Preuve rejetée. Client notifié.' });
        }

    } catch (err) {
        console.error('[PATCH /admin/valider-preuve]', err);
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 7 — Admin enregistre un paiement directement (sans preuve)
// POST /api/paiements/admin/enregistrer/:paiementId
// ─────────────────────────────────────────────────────────────────────────────
router.post('/admin/enregistrer/:paiementId', async (req, res) => {
    try {
        const { paiementId } = req.params;
        const { montantPaye, modePaiement, note, referenceTransaction } = req.body;

        const montant = parseFloat(montantPaye);
        if (isNaN(montant) || montant <= 0) {
            return res.status(400).json({ message: 'Montant invalide' });
        }

        if (!['mvola', 'orange_money', 'especes'].includes(modePaiement)) {
            return res.status(400).json({ message: 'Mode invalide. Valeurs: mvola | orange_money | especes' });
        }

        const paiement = await PaiementLoyer.findById(paiementId)
            .populate('clientID', 'email telephone')
            .populate('localID', 'nom_boutique');

        if (!paiement) return res.status(404).json({ message: 'Paiement introuvable' });
        if (paiement.statut === 'paye') {
            return res.status(409).json({ message: 'Ce mois est déjà entièrement payé' });
        }

        const nouveauMontantPaye = paiement.montantPaye + montant;
        const resteAPayer = Math.max(0, paiement.montantDu - nouveauMontantPaye);
        const estComplet = nouveauMontantPaye >= paiement.montantDu;
        const nouveauStatut = estComplet
            ? 'paye'
            : (new Date() > paiement.dateEcheance ? 'en retard' : 'en attente');

        await PaiementLoyer.findByIdAndUpdate(paiementId, {
            montantPaye: nouveauMontantPaye,
            datePaiement: estComplet ? new Date() : paiement.datePaiement,
            statut: nouveauStatut,
            modePaiement,
            referenceTransaction: referenceTransaction || null,
            note: note || null,
            statutPreuve: 'non_requise'
        });

        getIO().to(`user_${paiement.clientID._id}`).emit('paiement_mis_a_jour', {
            paiementId,
            statut: nouveauStatut,
            statutPreuve: 'non_requise',
            montantPaye: nouveauMontantPaye,
            resteAPayer,
            message: estComplet ? '✅ Votre paiement a été enregistré' : '💰 Paiement partiel enregistré'
        });

        const moisLabel = new Date(paiement.moisConcerne + '-01')
            .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

        await creerNotification(
            paiement.clientID._id,
            estComplet ? '✅ Paiement enregistré' : '💰 Paiement partiel enregistré',
            estComplet
                ? `Votre loyer de ${moisLabel} (${paiement.montantDu.toLocaleString('fr-FR')} Ar) est confirmé.`
                : `Paiement partiel de ${montant.toLocaleString('fr-FR')} Ar enregistré pour ${moisLabel}. Reste: ${resteAPayer.toLocaleString('fr-FR')} Ar.`,
            estComplet ? 'paiement' : 'info',
            '/mes-paiements'
        );

        return res.json({
            message: estComplet
                ? `✅ Paiement complet enregistré pour ${moisLabel}`
                : `💰 Paiement partiel — reste ${resteAPayer.toLocaleString('fr-FR')} Ar`,
            nouveauStatut,
            montantPaye: nouveauMontantPaye,
            resteAPayer
        });

    } catch (err) {
        console.error('[POST /admin/enregistrer]', err);
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 8 — Client récupère ses notifications
// ─────────────────────────────────────────────────────────────────────────────
router.get('/notifications', async (req, res) => {
    try {
        const notifications = await Notification
            .find({ clientID: req.user.id })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();

        return res.json({
            nonLues: notifications.filter(n => !n.lu).length,
            notifications
        });
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 9 — Marquer une notification comme lue
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/notifications/:id/lu', async (req, res) => {
    try {
        await Notification.findByIdAndUpdate(req.params.id, { lu: true });
        return res.json({ message: 'Notification marquée comme lue' });
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
});

module.exports = router;