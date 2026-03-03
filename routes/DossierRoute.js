const express = require('express');
const router = express.Router();
const Local = require('../model/Local');
const ReservationLocal = require('../model/ReservationLocal');
const Utilisateur = require('../model/Utilisateur');
const DossierRequire = require('../model/DossierRequire'); // ✅ nom correct
const Dossier = require('../model/Dossier');
const TypeDossier = require('../model/TypeDossier');
const DemandeClient = require('../model/DemandeClient');
const { creerNotification } = require('../utils/notification');
const { createUpload, cloudinary, extractPublicId } = require('../config/cloudinary');

const upload = createUpload({
    folder: 'dossiers-clients',
    allowedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
    maxSizeMB: 10
});

// ── HELPER ──────────────────────────────────────────────────
async function getRequiredDocuments(typeClientId) {
    const requirement = await DossierRequire  // ✅ DossierRequire et pas DossierRequirement
        .findOne({ typeClientex: typeClientId })
        .populate('typeDocument')
        .lean();
    return requirement || null;
}

// ── ROUTE 1 — Documents requis ───────────────────────────────
router.get('/required/:reservationId', async (req, res) => {
    try {
        const { reservationId } = req.params;

        const reservation = await ReservationLocal
            .findById(reservationId)
            .populate({
                path: 'clientId',
                select: 'typeClient email',
                populate: { path: 'typeClient', select: 'typeClientex' }
            })
            .lean();

        if (!reservation) return res.status(404).json({ message: 'Réservation introuvable' });

        const client = reservation.clientId;
        if (!client?.typeClient) return res.status(400).json({ message: 'Type client non défini pour cet utilisateur' });

        const requirement = await getRequiredDocuments(client.typeClient._id);
        if (!requirement) return res.status(404).json({ message: 'Aucun document configuré pour ce type de client' });

        return res.json({
            typeClient: client.typeClient.typeClientex,
            obligatoire: requirement.obligatoire,
            documentsRequis: requirement.typeDocument.map(doc => ({
                id: doc._id,
                nom: doc.nom,
                description: doc.description || null
            }))
        });

    } catch (err) {
        console.error('[GET /required]', err);
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
});

// ── ROUTE 2 — Soumettre les dossiers ────────────────────────
router.post('/soumettre/:reservationId', async (req, res) => {
    try {
        const { reservationId } = req.params;
        const clientId = req.user.id;

        const reservation = await ReservationLocal
            .findById(reservationId)
            .populate({
                path: 'clientId',
                populate: { path: 'typeClient' }
            })
            .lean();

        if (!reservation) return res.status(404).json({ message: 'Réservation introuvable' });
        if (String(reservation.clientId._id) !== String(clientId))
            return res.status(403).json({ message: 'Accès refusé' });

        const requirement = await getRequiredDocuments(reservation.clientId.typeClient._id);
        if (!requirement) return res.status(400).json({ message: 'Configuration des documents manquante' });

        const requiredDocIds = requirement.typeDocument.map(d => String(d._id || d));

        const fieldsConfig = requiredDocIds.map(id => ({ name: id, maxCount: 1 }));
        const uploadFields = upload.fields(fieldsConfig);

        uploadFields(req, res, async (err) => {
            if (err) return res.status(400).json({ message: err.message });

            const files = req.files || {};
            const missingDocs = [];
            const dossiersCreated = [];

            for (const docId of requiredDocIds) {
                const file = files[docId]?.[0];

                if (!file) {
                    if (requirement.obligatoire) missingDocs.push(docId);
                    continue;
                }

                const dossierExistant = await Dossier.findOne({
                    clientID: clientId,
                    typeDossier: docId
                });

                if (dossierExistant) {
                    const publicId = extractPublicId(file.path);
                    if (publicId) await cloudinary.uploader.destroy(publicId);
                    return res.status(409).json({
                        message: 'Dossier déjà soumis pour ce type de document',
                        typeDossier: docId
                    });
                }

                const dossier = await Dossier.create({
                    clientID: clientId,
                    typeDossier: docId,
                    cheminDossier: file.path,
                    statusDm: 'en attente'
                });

                dossiersCreated.push(dossier._id);
            }

            if (missingDocs.length > 0) {
                for (const fileArr of Object.values(files)) {
                    for (const f of fileArr) {
                        const publicId = extractPublicId(f.path);
                        if (publicId) await cloudinary.uploader.destroy(publicId);
                    }
                }
                await Dossier.deleteMany({ _id: { $in: dossiersCreated } });
                return res.status(400).json({
                    message: 'Documents obligatoires manquants',
                    manquants: missingDocs
                });
            }

            const demande = await DemandeClient.create({
                clientID: clientId,
                dossierClientID: dossiersCreated[0] || null,
                statusDm: 'en attente'
            });

            const admins = await Utilisateur.find({ role: 'admin' }).select('_id').lean();
            for (const admin of admins) {
                await creerNotification(
                    admin._id,
                    '📋 Nouvelle demande de location',
                    `Un client vient de soumettre un dossier complet (${dossiersCreated.length} document(s)). En attente de validation.`,
                    'info',
                    `/admin/demandes/${demande._id}`
                );
            }

            return res.status(201).json({
                message: 'Dossiers soumis avec succès',
                demandeId: demande._id,
                dossiers: dossiersCreated
            });
        });

    } catch (err) {
        console.error('[POST /soumettre]', err);
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
});

// ── ROUTE 3 — Mes dossiers ───────────────────────────────────
router.get('/mes-dossiers/:reservationId', async (req, res) => {
    try {
        const { reservationId } = req.params;
        const clientId = req.user.id;

        const reservation = await ReservationLocal
            .findById(reservationId)
            .populate({
                path: 'clientId',
                populate: { path: 'typeClient', select: 'typeClientex' }
            })
            .lean();

        if (!reservation) return res.status(404).json({ message: 'Réservation introuvable' });
        if (String(reservation.clientId._id) !== String(clientId))
            return res.status(403).json({ message: 'Accès refusé' });

        const requirement = await getRequiredDocuments(reservation.clientId.typeClient._id);
        if (!requirement) return res.status(404).json({ message: 'Aucune configuration de documents trouvée' });

        const requiredDocIds = requirement.typeDocument.map(d => String(d._id || d));

        const dossiersDéposes = await Dossier
            .find({ clientID: clientId })
            .populate('typeDossier', 'nom')
            .lean();

        const statutDocuments = requiredDocIds.map(docId => {
            const dossier = dossiersDéposes.find(d => String(d.typeDossier?._id) === docId);
            return {
                typeDocumentId: docId,
                present: !!dossier,
                obligatoire: requirement.obligatoire,
                status: dossier?.statusDm || null,
                cheminDossier: dossier?.cheminDossier || null,
                uploadedAt: dossier?.createdAt || null
            };
        });

        const obligatoiresManquants = statutDocuments.filter(d => d.obligatoire && !d.present);
        const dossierComplet = obligatoiresManquants.length === 0;

        return res.json({
            typeClient: reservation.clientId.typeClient.typeClientex,
            dossierComplet,
            progression: `${statutDocuments.filter(d => d.present).length}/${requiredDocIds.length}`,
            obligatoiresManquants: obligatoiresManquants.map(d => d.typeDocumentId),
            documents: statutDocuments
        });

    } catch (err) {
        console.error('[GET /mes-dossiers]', err);
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
});

// ── ROUTE 4 — Admin : dossiers d'un client ───────────────────
router.get('/admin/dossier-client/:clientId', async (req, res) => {
    try {
        const { clientId } = req.params;

        const client = await Utilisateur
            .findById(clientId)
            .populate('typeClient', 'typeClientex')
            .lean();

        if (!client) return res.status(404).json({ message: 'Client introuvable' });
        if (!client.typeClient) return res.status(400).json({ message: 'Type client non défini' });

        const requirement = await getRequiredDocuments(client.typeClient._id);
        if (!requirement) return res.status(404).json({ message: 'Configuration manquante' });

        const requiredDocs = requirement.typeDocument;
        const requiredDocIds = requiredDocs.map(d => String(d._id || d));

        const dossiers = await Dossier
            .find({ clientID: clientId })
            .populate('typeDossier', 'nom description')
            .lean();

        const statutDocuments = requiredDocs.map(doc => {
            const docId = String(doc._id);
            const dossier = dossiers.find(d => String(d.typeDossier?._id) === docId);
            return {
                typeDocumentId: docId,
                nomDocument: doc.nom,
                description: doc.description || null,
                present: !!dossier,
                obligatoire: requirement.obligatoire,
                status: dossier?.statusDm || null,
                cheminDossier: dossier?.cheminDossier || null,
                uploadedAt: dossier?.createdAt || null
            };
        });

        const dossierComplet = statutDocuments.filter(d => d.obligatoire && !d.present).length === 0;

        const reservation = await ReservationLocal
            .findOne({ clientId })
            .populate('localeID', 'nom_boutique emplacement surface categorie etat_boutique')
            .sort({ createdAt: -1 })
            .lean();

        const prixRaw = reservation?.infoLoc?.prix;
        const prixMensuel = prixRaw?.$numberDecimal
            ? parseFloat(prixRaw.$numberDecimal)
            : parseFloat(prixRaw) || 0;

        return res.json({
            client: {
                id: client._id,
                email: client.email,
                telephone: client.telephone,
                typeClient: client.typeClient.typeClientex
            },
            reservation: reservation ? {
                _id: reservation._id,
                status: reservation.status,
                createdAt: reservation.createdAt,
                infoLoc: {
                    duree: reservation.infoLoc?.dure,
                    prixMensuel,
                    totalContrat: (reservation.infoLoc?.dure || 0) * prixMensuel
                },
                local: reservation.localeID ? {
                    nom: reservation.localeID.nom_boutique,
                    emplacement: reservation.localeID.emplacement,
                    surface: reservation.localeID.surface,
                    categorie: reservation.localeID.categorie,
                    etat: reservation.localeID.etat_boutique
                } : null
            } : null,
            dossierComplet,
            progression: `${statutDocuments.filter(d => d.present).length}/${requiredDocIds.length}`,
            documents: statutDocuments
        });

    } catch (err) {
        console.error('[GET /admin/dossier-client]', err);
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
});

// ── ROUTE 5 — Toutes les demandes ────────────────────────────
router.get('/all-demande-client', async (req, res) => {
    try {
        const { statut } = req.query;
        const filter = statut ? { statusDm: statut } : {};

        const demandes = await DemandeClient
            .find(filter)
            .populate({
                path: 'clientID',
                select: 'email telephone typeClient',
                populate: { path: 'typeClient', select: 'typeClientex' }
            })
            .populate('dossierClientID')
            .sort({ createdAt: -1 })
            .lean();

        return res.json(demandes);
    } catch (err) {
        console.error('[GET /demandes]', err);
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
});

module.exports = router;