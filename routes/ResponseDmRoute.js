const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const jwt = require('jsonwebtoken'); // ← AJOUT

const DemandeClient = require('../model/DemandeClient');
const ReponseDemande = require('../model/ResponseDm');
const ReservationLocal = require('../model/ReservationLocal');
const Local = require('../model/Local');
const { creerPaiementMoisEnCours } = require('../utils/notification');
const Boutique = require('../model/Boutique');
const Notification = require('../model/Notification');
const authAdmin = require("../middleware/authAdmin");
const auth = require("../middleware/auth");

function genererHTMLContrat(data) {
    const templatePath = path.join(__dirname, '../templates/contrat-template.html');
    let html = fs.readFileSync(templatePath, 'utf-8');
    const dateDebutObj = new Date(data.dateDebut);
    const dateFinObj = new Date(dateDebutObj);
    dateFinObj.setMonth(dateFinObj.getMonth() + parseInt(data.duree));
    const fmt = (d) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const replacements = {
        '{{contratNumero}}': data.contratNumero,
        '{{dateEmission}}': fmt(new Date()),
        '{{clientEmail}}': data.clientEmail,
        '{{clientTelephone}}': data.clientTelephone || 'Non renseigné',
        '{{typeClient}}': data.typeClient || 'Standard',
        '{{localNom}}': data.localNom,
        '{{localCategorie}}': data.localCategorie,
        '{{localEmplacement}}': data.localEmplacement,
        '{{localSurface}}': data.localSurface,
        '{{dateDebut}}': fmt(data.dateDebut),
        '{{duree}}': data.duree,
        '{{dateFin}}': fmt(dateFinObj),
        '{{statusReservation}}': data.statusReservation,
        '{{prix}}': Number(data.prix).toLocaleString('fr-FR'),
        '{{commentaire}}': data.commentaire || ''
    };
    for (const [key, val] of Object.entries(replacements)) {
        html = html.replaceAll(key, val);
    }
    return html;
}

async function genererPDF(html, nomFichier) {
    const outputDir = path.join(__dirname, '../uploads/contrats');
    fs.mkdirSync(outputDir, { recursive: true });
    const filePath = path.join(outputDir, nomFichier);
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({ path: filePath, format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } });
    await browser.close();
    return `uploads/contrats/${nomFichier}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE — Aperçu PDF inline (pas de auth — token vérifié manuellement)
// GET /ResponseDm/contrat-apercu/:demandeId?token=xxx
// ─────────────────────────────────────────────────────────────────────────────
router.get('/contrat-apercu/:demandeId', async (req, res) => {
    try {
        const { demandeId } = req.params;
        const token = req.query.token;

        if (!token) return res.status(401).send('Token manquant');

        let payload;
        try {
            payload = jwt.verify(token, process.env.JWT_SECRET);
        } catch {
            return res.status(401).send('Token expiré — veuillez réessayer');
        }

        if (payload.purpose !== 'pdf_view' || payload.demandeId !== demandeId) {
            return res.status(403).send('Accès refusé');
        }

        const reponse = await ReponseDemande.findOne({ demandeID: demandeId, statut: 'accepte' }).lean();
        if (!reponse?.contratPDF) return res.status(404).send('Contrat non trouvé');

        const filePath = path.join(__dirname, '..', reponse.contratPDF);
        if (!fs.existsSync(filePath)) return res.status(404).send('Fichier introuvable');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="contrat-${demandeId}.pdf"`);
        res.setHeader('Cache-Control', 'no-store');
        fs.createReadStream(filePath).pipe(res);

    } catch (err) {
        res.status(500).send('Erreur serveur');
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE — Générer un tempToken 60s pour accéder au PDF
// POST /ResponseDm/contrat-token/:demandeId
// Protégée par auth (middleware global dans app.js)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/contrat-token/:demandeId', async (req, res) => {
    try {
        const { demandeId } = req.params;

        const reponse = await ReponseDemande.findOne({ demandeID: demandeId, statut: 'accepte' }).lean();
        if (!reponse?.contratPDF) {
            return res.status(404).json({ message: 'Contrat non trouvé' });
        }

        const tempToken = jwt.sign(
            { demandeId, purpose: 'pdf_view' },
            process.env.JWT_SECRET,
            { expiresIn: '60s' }
        );

        return res.json({ tempToken });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE — Valider une demande (admin)
// PUT /ResponseDm/valider/:demandeId
// ─────────────────────────────────────────────────────────────────────────────

router.put('/valider/:demandeId', authAdmin ,async (req, res) => {
    try {
        const { demandeId } = req.params;
        const { statut, commentaire } = req.body;
        const adminId = req.user.id;

        if (!['accepte', 'refuse'].includes(statut)) {
            return res.status(400).json({ message: 'Statut invalide. Valeurs: accepte | refuse' });
        }

        const demande = await DemandeClient
            .findById(demandeId)
            .populate({ path: 'clientID', populate: { path: 'typeClient', select: 'typeClientex' } })
            .lean();

        if (!demande) return res.status(404).json({ message: 'Demande introuvable' });
        if (demande.statusDm !== 'en attente') return res.status(409).json({ message: 'Cette demande a déjà été traitée' });

        const reservation = await ReservationLocal
            .findOne({ clientId: demande.clientID._id })
            .populate('localeID')
            .sort({ createdAt: -1 })
            .lean();

        if (!reservation) return res.status(404).json({ message: 'Réservation introuvable pour ce client' });

        const local = reservation.localeID;
        const client = demande.clientID;

        await DemandeClient.findByIdAndUpdate(demandeId, { statusDm: statut });

        let contratPath = null;
        let prixMensuel = 0;

        if (statut === 'accepte') {
            const contratNumero = `CTR-${Date.now()}`;
            const nomFichier = `contrat-${demandeId}-${Date.now()}.pdf`;
            const prixRaw = reservation.infoLoc?.prix;
            prixMensuel = prixRaw?.$numberDecimal ? parseFloat(prixRaw.$numberDecimal) : parseFloat(prixRaw) || 0;

            const htmlContrat = genererHTMLContrat({
                contratNumero,
                clientEmail: client.email,
                clientTelephone: client.telephone,
                typeClient: client.typeClient?.typeClientex,
                localNom: local.nom_boutique,
                localCategorie: local.categorie,
                localEmplacement: local.emplacement,
                localSurface: local.surface,
                dateDebut: reservation.createdAt,
                duree: reservation.infoLoc?.dure,
                statusReservation: reservation.status,
                prix: prixMensuel,
                commentaire
            });

            contratPath = await genererPDF(htmlContrat, nomFichier);
            await Local.findByIdAndUpdate(local._id, { etat_boutique: 'louée' });
            await ReservationLocal.findByIdAndUpdate(reservation._id, { status: 'Confirmée' });
        }

        const reponse = await ReponseDemande.create({
            demandeID: demandeId,
            adminID: adminId,
            statut,
            commentaire: commentaire || null,
            contratPDF: contratPath
        });

        if (statut === 'accepte') {
            await creerPaiementMoisEnCours(reponse._id, demande.clientID._id, local._id, prixMensuel);
        }

        // ──────────── Création de la notification pour le client ────────────
        const notifTitre = statut === 'accepte'
            ? 'Votre demande a été acceptée'
            : 'Votre demande a été refusée';

        const notifMessage = statut === 'accepte'
            ? `Félicitations ! Votre demande pour le local "${local.nom_boutique}" a été acceptée. Vous pouvez consulter votre contrat.`
            : `Votre demande pour le local "${local.nom_boutique}" a été refusée.`;

        await Notification.create({
            clientID: client._id,
            titre: notifTitre,
            message: notifMessage,
            type: 'info',
            lienAction: '/mon-contrat' // correspond à ta route Angular
        });
        // ────────────────────────────────────────────────────────────────────

        return res.status(201).json({
            message: statut === 'accepte' ? 'Demande validée et contrat généré avec succès' : 'Demande refusée',
            reponseId: reponse._id,
            statut,
            contratPDF: contratPath ?? null
        });

    } catch (err) {
        console.error('[PUT /valider]', err);
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
});

const { createUpload } = require('../config/cloudinary');
const uploadLogo = createUpload({folder: 'boutiques/logos'});
router.put('/validerDemande/:demandeId', authAdmin, uploadLogo.single('logo'), async (req, res) => {
    try {
        const { demandeId } = req.params;
        const {
            statut,
            commentaire,
            nomBoutique,
            description,
            telephone,
            horaires,
            categorie
        } = req.body;

        const adminId = req.user.id;

        if (!['accepte', 'refuse'].includes(statut)) {
            return res.status(400).json({ message: 'Statut invalide. Valeurs: accepte | refuse' });
        }

        const demande = await DemandeClient
            .findById(demandeId)
            .populate({ path: 'clientID', populate: { path: 'typeClient', select: 'typeClientex' } })
            .lean();

        if (!demande) return res.status(404).json({ message: 'Demande introuvable' });
        if (demande.statusDm !== 'en attente') return res.status(409).json({ message: 'Cette demande a déjà été traitée' });

        // Récupération de la réservation
        const reservation = await ReservationLocal
            .findOne({ clientId: demande.clientID._id })
            .populate('localeID')
            .sort({ createdAt: -1 })
            .lean();

        if (!reservation) return res.status(404).json({ message: 'Réservation introuvable pour ce client' });

        const local = reservation.localeID;
        const client = demande.clientID;

        // Mise à jour du statut de la demande
        await DemandeClient.findByIdAndUpdate(demandeId, { statusDm: statut });

        let contratPath = null;
        let prixMensuel = 0;

        // Traitement pour une demande acceptée
        if (statut === 'accepte') {
            // Validation des champs obligatoires pour la boutique
            if (!nomBoutique || !telephone || !categorie) {
                return res.status(400).json({
                    message: 'Pour accepter une demande, veuillez fournir: nomBoutique, telephone, categorie'
                });
            }

            // Vérification que le local est toujours disponible
            if (local.etat_boutique !== 'disponible') {
                return res.status(400).json({ message: 'Ce local n\'est plus disponible' });
            }

            // Vérification que le nom de boutique n'existe pas déjà
            const boutiqueExistante = await Boutique.findOne({ nom: nomBoutique });
            if (boutiqueExistante) {
                return res.status(400).json({ message: 'Nom de boutique déjà utilisé' });
            }

            // Vérification de la catégorie
            const categorieExist = await Categorie.findById(categorie);
            if (!categorieExist) {
                return res.status(400).json({ message: 'Catégorie invalide' });
            }

            // Création de la boutique
            const logoUrl = req.file ? req.file.path : null;
            const logoPublicId = req.file ? req.file.filename : null;

            const boutique = new Boutique({
                utilisateurId: client._id,
                nom: nomBoutique,
                description: description || '',
                telephone,
                logo: logoUrl,
                categorie,
                horaires: horaires || {},
                local: local._id
            });

            await boutique.save();

            // Mise à jour du rôle de l'utilisateur
            client.roles = client.roles || [];
            if (!client.roles.includes('boutique')) {
                client.roles.push('boutique');
            }
            await Utilisateur.findByIdAndUpdate(client._id, { roles: client.roles });

            // Génération du contrat
            const contratNumero = `CTR-${Date.now()}`;
            const nomFichier = `contrat-${demandeId}-${Date.now()}.pdf`;
            const prixRaw = reservation.infoLoc?.prix;
            prixMensuel = prixRaw?.$numberDecimal ? parseFloat(prixRaw.$numberDecimal) : parseFloat(prixRaw) || 0;

            const htmlContrat = genererHTMLContrat({
                contratNumero,
                clientEmail: client.email,
                clientTelephone: client.telephone,
                typeClient: client.typeClient?.typeClientex,
                localNom: local.nom_boutique,
                localCategorie: local.categorie,
                localEmplacement: local.emplacement,
                localSurface: local.surface,
                dateDebut: reservation.createdAt,
                duree: reservation.infoLoc?.dure,
                statusReservation: reservation.status,
                prix: prixMensuel,
                commentaire,
                nomBoutique // Ajout du nom de boutique dans le contrat
            });

            contratPath = await genererPDF(htmlContrat, nomFichier);

            // Mise à jour du statut du local et de la réservation
            await Local.findByIdAndUpdate(local._id, { etat_boutique: 'louée' });
            await ReservationLocal.findByIdAndUpdate(reservation._id, { status: 'Confirmée' });
        }

        // Création de la réponse
        const reponse = await ReponseDemande.create({
            demandeID: demandeId,
            adminID: adminId,
            statut,
            commentaire: commentaire || null,
            contratPDF: contratPath
        });

        // Création du premier paiement si accepté
        if (statut === 'accepte') {
            await creerPaiementMoisEnCours(reponse._id, client._id, local._id, prixMensuel);
        }

        // Création de la notification
        const notifTitre = statut === 'accepte'
            ? 'Votre demande a été acceptée'
            : 'Votre demande a été refusée';

        const notifMessage = statut === 'accepte'
            ? `Félicitations ! Votre demande pour le local "${local.nom_boutique}" a été acceptée. Votre boutique "${nomBoutique}" a été créée. Vous pouvez consulter votre contrat.`
            : `Votre demande pour le local "${local.nom_boutique}" a été refusée.`;

        await Notification.create({
            clientID: client._id,
            titre: notifTitre,
            message: notifMessage,
            type: 'info',
            lienAction: '/mon-contrat'
        });

        return res.status(201).json({
            message: statut === 'accepte'
                ? 'Demande validée, boutique créée et contrat généré avec succès'
                : 'Demande refusée',
            reponseId: reponse._id,
            statut,
            contratPDF: contratPath ?? null,
            boutiqueCreee: statut === 'accepte' ? true : false
        });

    } catch (err) {
        console.error('[PUT /valider]', err);

        // Gestion des erreurs de duplication
        if (err.code === 11000 && err.keyPattern?.local) {
            return res.status(400).json({ message: 'Ce local est déjà utilisé par une boutique active' });
        }

        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE — Télécharger le contrat PDF
// GET /ResponseDm/contrat/:demandeId
// ─────────────────────────────────────────────────────────────────────────────
router.get('/contrat/:demandeId', async (req, res) => {
    try {
        const { demandeId } = req.params;
        const reponse = await ReponseDemande.findOne({ demandeID: demandeId, statut: 'accepte' }).lean();
        if (!reponse?.contratPDF) return res.status(404).json({ message: 'Contrat non trouvé' });
        const filePath = path.join(__dirname, '..', reponse.contratPDF);
        if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Fichier PDF introuvable sur le serveur' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="contrat-${demandeId}.pdf"`);
        fs.createReadStream(filePath).pipe(res);
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE — Lister toutes les demandes
// GET /ResponseDm/demandes?statut=en attente
// ─────────────────────────────────────────────────────────────────────────────
router.get('/demandes',authAdmin, async (req, res) => {
    try {
        const { statut } = req.query;
        const filter = statut ? { statusDm: statut } : {};
        const demandes = await DemandeClient
            .find(filter)
            .populate('clientID', 'email telephone typeClient')
            .populate('dossierClientID')
            .sort({ createdAt: -1 })
            .lean();
        return res.json(demandes);
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE — Voir le statut d'une demande (client)
// GET /ResponseDm/ma-demande/:demandeId
// ─────────────────────────────────────────────────────────────────────────────
router.get('/ma-demande/:demandeId', auth,async (req, res) => {
    try {
        const { demandeId } = req.params;
        const clientId = req.user.id;
        const demande = await DemandeClient.findById(demandeId).lean();
        if (!demande) return res.status(404).json({ message: 'Demande introuvable' });
        if (String(demande.clientID) !== String(clientId)) return res.status(403).json({ message: 'Accès refusé' });
        const reponse = await ReponseDemande.findOne({ demandeID: demandeId }).lean();
        return res.json({
            statusDm: demande.statusDm,
            dateDm: demande.dateDm,
            reponse: reponse ? {
                statut: reponse.statut,
                commentaire: reponse.commentaire,
                dateReponse: reponse.dateReponse,
                contratDisponible: !!reponse.contratPDF,
                contratURL: reponse.contratPDF ?? null
            } : null
        });
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE — Détail complet d'une réponse
// GET /ResponseDm/detail/:demandeId
// ─────────────────────────────────────────────────────────────────────────────
router.get('/detail/:demandeId', async (req, res) => {
    try {
        const { demandeId } = req.params;
        const reponse = await ReponseDemande.findOne({ demandeID: demandeId })
            .populate({ path: 'demandeID', populate: { path: 'clientID', select: 'email telephone roles typeClient', populate: { path: 'typeClient', select: 'typeClientex' } } })
            .populate('adminID', 'email')
            .lean();

        if (!reponse) return res.status(404).json({ message: 'Réponse introuvable' });

        const client = reponse.demandeID?.clientID;
        const reservation = await ReservationLocal
            .findOne({ clientId: client._id, status: 'Confirmée' })
            .populate('localeID')
            .sort({ createdAt: -1 })
            .lean();

        if (!reservation) return res.status(404).json({ message: 'Réservation confirmée introuvable' });

        const local = reservation.localeID;
        const boutique = await Boutique.findOne({ local: local._id, is_active: true }).populate('categories', 'nom').lean();
        const prixRaw = reservation.infoLoc?.prix;
        const prixMensuel = prixRaw?.$numberDecimal ? parseFloat(prixRaw.$numberDecimal) : parseFloat(prixRaw) || 0;

        return res.json({
            contrat: { _id: reponse._id, statut: reponse.statut, commentaire: reponse.commentaire, dateReponse: reponse.dateReponse, contratPDF: reponse.contratPDF ?? null, validePar: reponse.adminID?.email },
            client: { _id: client._id, email: client.email, telephone: client.telephone, typeClient: client.typeClient?.typeClientex || 'Standard' },
            local: { _id: local._id, nom: local.nom_boutique, categorie: local.categorie, emplacement: local.emplacement, surface: `${local.surface} m²`, etat: local.etat_boutique },
            infoLoc: { duree: reservation.infoLoc?.dure, prixMensuel, totalContrat: reservation.infoLoc?.dure * prixMensuel, dateDebut: reservation.createdAt, dateFin: (() => { const d = new Date(reservation.createdAt); d.setMonth(d.getMonth() + parseInt(reservation.infoLoc?.dure || 0)); return d; })(), statusReservation: reservation.status },
            boutique: boutique ? { _id: boutique._id, nom: boutique.nom, telephone: boutique.telephone, is_active: boutique.is_active, categories: boutique.categories } : null
        });
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE — Liste tous les locataires (demandes acceptées)
// GET /ResponseDm/locataires
// ─────────────────────────────────────────────────────────────────────────────
router.get('/locataires',authAdmin, async (req, res) => {
    try {
        const reponses = await ReponseDemande
            .find({ statut: 'accepte' })
            .populate({ path: 'demandeID', populate: { path: 'clientID', select: 'email telephone typeClient', populate: { path: 'typeClient', select: 'typeClientex' } } })
            .sort({ createdAt: -1 })
            .lean();

        const locataires = await Promise.all(reponses.map(async (reponse) => {
            const client = reponse.demandeID?.clientID;
            if (!client) return null;

            const reservation = await ReservationLocal
                .findOne({ clientId: client._id, status: 'Confirmée' })
                .populate('localeID', 'nom_boutique emplacement surface categorie etat_boutique')
                .sort({ createdAt: -1 })
                .lean();

            const prixRaw = reservation?.infoLoc?.prix;
            const prixMensuel = prixRaw?.$numberDecimal ? parseFloat(prixRaw.$numberDecimal) : parseFloat(prixRaw) || 0;

            return {
                demandeId: reponse.demandeID?._id,
                reponseId: reponse._id,
                dateAcceptation: reponse.createdAt,
                commentaire: reponse.commentaire,
                contratDisponible: !!reponse.contratPDF,
                contratURL: reponse.contratPDF ?? null,
                client: { _id: client._id, email: client.email, telephone: client.telephone, typeClient: client.typeClient?.typeClientex ?? '—' },
                local: reservation?.localeID ? { nom: reservation.localeID.nom_boutique, emplacement: reservation.localeID.emplacement, surface: reservation.localeID.surface, categorie: reservation.localeID.categorie, etat: reservation.localeID.etat_boutique } : null,
                infoLoc: reservation ? { duree: reservation.infoLoc?.dure, prixMensuel, totalContrat: (reservation.infoLoc?.dure || 0) * prixMensuel, dateDebut: reservation.createdAt, dateFin: (() => { const d = new Date(reservation.createdAt); d.setMonth(d.getMonth() + parseInt(reservation.infoLoc?.dure || 0)); return d; })() } : null
            };
        }));

        return res.json(locataires.filter(Boolean));
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
});
// POST /ResponseDm/apercu-contrat
// Génère un HTML d'aperçu sans sauvegarder
router.post('/apercu-contrat', async (req, res) => {
    try {
        const { demandeId } = req.body;

        const demande = await DemandeClient
            .findById(demandeId)
            .populate({ path: 'clientID', populate: { path: 'typeClient', select: 'typeClientex' } })
            .lean();

        if (!demande) return res.status(404).json({ message: 'Demande introuvable' });

        const reservation = await ReservationLocal
            .findOne({ clientId: demande.clientID._id })
            .populate('localeID')
            .sort({ createdAt: -1 })
            .lean();

        if (!reservation) return res.status(404).json({ message: 'Réservation introuvable' });

        const local = reservation.localeID;
        const client = demande.clientID;
        const prixRaw = reservation.infoLoc?.prix;
        const prixMensuel = prixRaw?.$numberDecimal ? parseFloat(prixRaw.$numberDecimal) : parseFloat(prixRaw) || 0;

        const html = genererHTMLContrat({
            contratNumero: `CTR-APERCU-${Date.now()}`,
            clientEmail: client.email,
            clientTelephone: client.telephone,
            typeClient: client.typeClient?.typeClientex,
            localNom: local.nom_boutique,
            localCategorie: local.categorie,
            localEmplacement: local.emplacement,
            localSurface: local.surface,
            dateDebut: reservation.createdAt,
            duree: reservation.infoLoc?.dure,
            statusReservation: reservation.status,
            prix: prixMensuel,
            commentaire: req.body.commentaire || ''
        });

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);

    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// ROUTE — Mes contrats (client connecté)
// GET /ResponseDm/mon-contrat
// ─────────────────────────────────────────────────────────────────────────────
router.get('/mon-contrat',auth, async (req, res) => {
    try {
        const clientId = req.user.id;

        // On récupère uniquement les réponses acceptées
        // liées aux demandes du client connecté
        const reponses = await ReponseDemande
            .find({ statut: 'accepte' })
            .populate({
                path: 'demandeID',
                match: { clientID: clientId }, // 🔥 filtre ici
                populate: {
                    path: 'clientID',
                    select: 'email telephone typeClient',
                    populate: { path: 'typeClient', select: 'typeClientex' }
                }
            })
            .sort({ createdAt: -1 })
            .lean();

        // On enlève celles qui ne correspondent pas au client
        const filtered = reponses.filter(r => r.demandeID);

        const contrats = await Promise.all(filtered.map(async (reponse) => {

            const client = reponse.demandeID.clientID;

            const reservation = await ReservationLocal
                .findOne({ clientId: client._id, status: 'Confirmée' })
                .populate('localeID', 'nom_boutique emplacement surface categorie etat_boutique')
                .sort({ createdAt: -1 })
                .lean();

            const prixRaw = reservation?.infoLoc?.prix;
            const prixMensuel = prixRaw?.$numberDecimal
                ? parseFloat(prixRaw.$numberDecimal)
                : parseFloat(prixRaw) || 0;

            return {
                demandeId: reponse.demandeID._id,
                reponseId: reponse._id,
                dateAcceptation: reponse.createdAt,
                commentaire: reponse.commentaire,
                contratDisponible: !!reponse.contratPDF,
                contratURL: reponse.contratPDF ?? null,

                client: {
                    _id: client._id,
                    email: client.email,
                    telephone: client.telephone,
                    typeClient: client.typeClient?.typeClientex ?? '—'
                },

                local: reservation?.localeID ? {
                    nom: reservation.localeID.nom_boutique,
                    emplacement: reservation.localeID.emplacement,
                    surface: reservation.localeID.surface,
                    categorie: reservation.localeID.categorie,
                    etat: reservation.localeID.etat_boutique
                } : null,

                infoLoc: reservation ? {
                    duree: reservation.infoLoc?.dure,
                    prixMensuel,
                    totalContrat: (reservation.infoLoc?.dure || 0) * prixMensuel,
                    dateDebut: reservation.createdAt,
                    dateFin: (() => {
                        const d = new Date(reservation.createdAt);
                        d.setMonth(d.getMonth() + parseInt(reservation.infoLoc?.dure || 0));
                        return d;
                    })()
                } : null
            };
        }));

        return res.json(contrats);

    } catch (err) {
        console.error('[GET /mon-contrat]', err);
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
});

module.exports = router;