const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Local = require('../model/Local');
const ReservationLocal = require('../model/ReservationLocal');
const Utilisateur = require('../model/Utilisateur');
const DossierRequirement = require('../model/DossierRequire');
const Dossier = require('../model/Dossier');
const TypeDossier = require('../model/TypeDossier');
const DemandeClient = require('../model/DemandeClient');

// ─────────────────────────────────────────────
// CONFIG MULTER — stockage dynamique par client
// ─────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = `uploads/clients/${req.user.id}`;
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${file.fieldname}-${unique}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max par fichier
    fileFilter: (req, file, cb) => {
        const allowed = /pdf|jpg|jpeg|png/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);
        ext && mime ? cb(null, true) : cb(new Error('Format non supporté (pdf, jpg, png uniquement)'));
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// HELPER — récupère les documents requis selon le typeClient de l'utilisateur.
// ─────────────────────────────────────────────────────────────────────────────
async function getRequiredDocuments(typeClientId) {// mila mi afficher anle type de client rehetra alouha zany dia n id ano alefa any
    const requirement = await DossierRequirement
        .findOne({ typeClientex: typeClientId })
        .populate('typeDocument') // on récupère les détails de chaque TypeDocument
        .lean();

    return requirement || null;
}
// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 1 — Récupérer les documents requis pour un client (avant upload)
// GET /api/dossiers/required/:reservationId
// Permet au front de savoir quels champs afficher dans le formulaire d'upload
// ─────────────────────────────────────────────────────────────────────────────
router.get('/required/:reservationId', async (req, res) => {
    try {
        const { reservationId } = req.params;

        // 1. Trouver la réservation et peupler le client avec son typeClient
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

        // 2. Récupérer les documents requis selon le typeClient

        const requirement = await getRequiredDocuments(client.typeClient._id);
        if (!requirement) return res.status(404).json({ message: 'Aucun document configuré pour ce type de client' });

        return res.json({
            typeClient: client.typeClient.typeClientex,
            obligatoire: requirement.obligatoire,
            documentsRequis: requirement.typeDocument.map(doc => ({
                id: doc._id,
                nom: doc.nom,          // ex: "CIN", "NIF", "STAT", "Business Plan"
                description: doc.description || null
            }))
        });

    } catch (err) {
        console.error('[GET /required]', err);
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 2 — Upload des dossiers + création Dossier + DemandeClient
// POST /api/dossiers/soumettre/:reservationId
//
// Le front envoie les fichiers avec pour fieldname l'ID du TypeDocument
// ex: form-data: { "64abc...": <fichier CIN>, "64def...": <fichier NIF> }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/soumettre/:reservationId', async (req, res) => {
    try {
        const { reservationId } = req.params;
        const clientId = req.user.id; // middleware auth requis

        // 1. Vérifier la réservation
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

        // 2. Récupérer les documents requis pour ce typeClient
        const requirement = await getRequiredDocuments(reservation.clientId.typeClient._id);
        if (!requirement) return res.status(400).json({ message: 'Configuration des documents manquante' });

        const requiredDocIds = requirement.typeDocument.map(d => String(d._id || d));

        // 3. Multer dynamique — on accepte les fichiers dont le fieldname = un TypeDocument ID valide
        const fieldsConfig = requiredDocIds.map(id => ({ name: id, maxCount: 1 }));
        const uploadFields = upload.fields(fieldsConfig);

        uploadFields(req, res, async (err) => {
            if (err) return res.status(400).json({ message: err.message });

            const files = req.files || {};
            const missingDocs = [];
            const dossiersCreated = [];

            // 4. Pour chaque document requis, vérifier et créer un Dossier
            for (const docId of requiredDocIds) {
                const file = files[docId]?.[0];

                if (!file) {
                    if (requirement.obligatoire) {
                        missingDocs.push(docId);
                    }
                    continue;
                }
                // ← AJOUT : vérifier si ce type de dossier existe déjà pour ce client
                const dossierExistant = await Dossier.findOne({
                    clientID: clientId,
                    typeDossier: docId
                });

                if (dossierExistant) {
                    // Nettoyer le fichier uploadé
                    fs.unlink(file.path, () => {});
                    return res.status(409).json({
                        message: `Dossier déjà soumis pour ce type de document`,
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

            // 5. Si des documents obligatoires manquent → rejeter
            if (missingDocs.length > 0) {
                // Nettoyer les fichiers déjà uploadés
                Object.values(files).flat().forEach(f => {
                    fs.unlink(f.path, () => {});
                });
                // Supprimer les dossiers créés en BD
                await Dossier.deleteMany({ _id: { $in: dossiersCreated } });

                return res.status(400).json({
                    message: 'Documents obligatoires manquants',
                    manquants: missingDocs
                });
            }

            // 6. Créer la DemandeClient en liant le premier dossier (ou adapter selon votre logique)
            const demande = await DemandeClient.create({
                clientID: clientId,
                dossierClientID: dossiersCreated[0] || null,
                statusDm: 'en attente'
            });

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
// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 3 — Afficher les dossiers du client + vérification complétude
// GET /api/dossiers/mes-dossiers/:reservationId
// ─────────────────────────────────────────────────────────────────────────────
router.get('/mes-dossiers/:reservationId', async (req, res) => {
    try {
        const { reservationId } = req.params;
        const clientId = req.user._id;

        // 1. Récupérer la réservation + typeClient
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

        // 2. Récupérer les documents requis (obligatoires)
        const requirement = await getRequiredDocuments(reservation.clientId.typeClient._id);
        if (!requirement) return res.status(404).json({ message: 'Aucune configuration de documents trouvée' });

        const requiredDocIds = requirement.typeDocument.map(d => String(d._id || d));

        // 3. Récupérer tous les dossiers déposés par ce client
        const dossiersDéposes = await Dossier
            .find({ clientID: clientId })
            .populate('typeDossier', 'nom')
            .lean();

        // 4. Mapper et vérifier la complétude
        const déposeIds = new Set(dossiersDéposes.map(d => String(d.typeDossier?.nom)));

        const statutDocuments = requiredDocIds.map(docId => {
            const dossier = dossiersDéposes.find(d => String(d.typeDossier?.nom) === docId);
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
// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 4 — (Admin) Voir les dossiers d'un client + complétude
// GET /api/dossiers/admin/client/:clientId
// ─────────────────────────────────────────────────────────────────────────────
router.get('/admin/client/:clientId', async (req, res) => {
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

        const requiredDocIds = requirement.typeDocument.map(d => String(d._id || d));

        const dossiers = await Dossier
            .find({ clientID: clientId })
            .populate('typeDossier', 'nom')
            .lean();

        const statutDocuments = requiredDocIds.map(docId => {
            const dossier = dossiers.find(d => String(d.typeDossier?.nom) === docId);
            return {
                typeDocumentId: docId,
                present: !!dossier,
                obligatoire: requirement.obligatoire,
                status: dossier?.statusDm || null,
                cheminDossier: dossier?.cheminDossier || null,
                uploadedAt: dossier?.createdAt || null
            };
        });

        const dossierComplet = statutDocuments.filter(d => d.obligatoire && !d.present).length === 0;

        return res.json({
            client: { id: client._id, email: client.email, typeClient: client.typeClient.typeClientex },
            dossierComplet,
            progression: `${statutDocuments.filter(d => d.present).length}/${requiredDocIds.length}`,
            documents: statutDocuments
        });

    } catch (err) {
        console.error('[GET /admin/client]', err);
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
});


// Afficher tous les demandes de location
router.get('/All-local', async (req, res) => {
    try {
        const locales  = await Local.find();
        res.json(locales);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
// Afficher tous les demandes de location en (parametre => soit valider,en attente,refuser)
router.get('/local-availaible', async (req, res) => {
    try {
        const locales  = await Local.find({etat_boutique:'disponible'},undefined,undefined);
        res.json(locales);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
module.exports = router;