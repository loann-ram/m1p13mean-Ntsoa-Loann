const express = require('express');
const router = express.Router();
const Visite = require('../model/Visite');
const Local = require('../model/Local');
const { creerNotification } = require('../utils/notification');

const getDatesDispo = require('../utils/getDateDisp');
const auth = require("../middleware/auth");
//Afficher all visite
router.get('/all-visite', async function (req, res) {
    try {
        const AllVisite = await Visite.find()
            .populate('clientId', 'nom prenom email')
            .populate('localeID', 'nom_boutique');
        res.json(AllVisite);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
//Afficher all visite pour un local donnée
router.get('/visite-local/:localId', async function (req, res) {
    try {
        const visites = await Visite.find({
            local_id: req.params.localId,
            status: { $ne: 'Annulée' }  // Exclure les annulées
        }).sort({ date: 1, heure_debut: 1 });

        res.json(visites);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
//Afficher all visite non annulé
router.get('/all-visite-non-annule', async function (req, res) {
    try{
    const visites = await Visite.find({
        status: { $ne: 'Annulée' }  // Exclure les annulées
    });
    res.json(visites);
    }catch(error){
        res.status(500).json({ message: error.message });
    }
});
//Afficher les dates de visites disponibles
router.get('/date-visite-disponibles/:localId', async (req, res) => {
    try {
        const dateDisp = await getDatesDispo(
            req.params.localId,
            req.query.month,
            req.query.year,
            req.query.day
        );
        console.log( req.query.month,req.query.year,req.query.day);
        res.json(dateDisp);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
//Creation d'une visite de locale
// Réserver une visite
router.post('/Reserved-visit',auth, async (req, res) => {
    try {
        const localID = req.body.localeID;
        const local = await Local.findById(localID);
        console.log("IdClient dia ty",req.user.id);


        if (!local) {
            return res.status(404).json({ message: 'Local non trouvé' });
        }

        if (local.etat_boutique !== 'disponible') {
            return res.status(400).json({ message: 'Ce local n\'est plus disponible' });
        }

        // ✅ Extraire le mois et l'année depuis la date reçue
        const dateRecue = new Date(req.body.date);
        const month = dateRecue.getMonth() + 1;
        const year = dateRecue.getFullYear();
        const day = dateRecue.getDate();

        // ✅ Passer le bon mois/année à getDatesDispo
        const dateDisp = await getDatesDispo(localID, month, year, day);

        const dateDispSet = new Set(dateDisp.map(j => j.date));
        const dateStr = dateRecue.toLocaleDateString('sv-SE');

        if (!dateDispSet.has(dateStr)) {
            return res.status(400).json({ message: 'Date non disponible (jour férié, week-end, ou créneaux complets)' });
        }

        // ✅ Vérifier aussi que le créneau spécifique est libre
        const jourDispo = dateDisp.find(j => j.date === dateStr);
        const creneauDemande = `${String(req.body.heure_debut).padStart(2,'0')}:00-${String(req.body.heure_fin).padStart(2,'0')}:00`;

        if (!jourDispo.creneaux_disponibles.includes(creneauDemande)) {
            return res.status(400).json({ message: 'Ce créneau est déjà réservé' });
        }

        const nouvelleVisite = new Visite({
            localeID: req.body.localeID,
            clientId: req.user.id,
            date: req.body.date,
            heure_debut: req.body.heure_debut,
            heure_fin: req.body.heure_fin,
        });

        const visiteSauvegardee = await nouvelleVisite.save();
        res.status(201).json(visiteSauvegardee);

    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Annuler une visite
router.patch('/:id/annuler', async (req, res) => {
    try {
        const visite = await Visite.findByIdAndUpdate(
            req.params.id,
            { statut: 'annulée' },
            { new: true }
        );

        if (!visite) {
            return res.status(404).json({ message: 'Visite non trouvée' });
        }

        res.json(visite);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// UPDATE VISITE — Valider / Refuser / Reporter
// PATCH /visite/:id/decision
// Body : { statut: 'Validée' | 'Refusée' | 'Reportée', nouvelleDate?, nouvelleHeureDebut?, nouvelleHeureFin?, motif? }
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/decision', async (req, res) => {
    try {
        const { statut, nouvelleDate, nouvelleHeureDebut, nouvelleHeureFin, motif } = req.body;

        const statutsAutorises = ['Validée', 'Refusée', 'Reportée'];
        if (!statutsAutorises.includes(statut)) {
            return res.status(400).json({
                message: `Statut invalide. Valeurs acceptées : ${statutsAutorises.join(', ')}`
            });
        }

        // ── Vérifier que la visite existe ──────────────────────────────────
        const visite = await Visite.findById(req.params.id)
            .populate('clientId', 'email _id')
            .populate('localeID', 'nom_boutique');

        if (!visite) {
            return res.status(404).json({ message: 'Visite non trouvée' });
        }

        // ── Construire les champs à mettre à jour ──────────────────────────
        const miseAJour = { statut };

        if (statut === 'Reportée') {
            if (!nouvelleDate || !nouvelleHeureDebut || !nouvelleHeureFin) {
                return res.status(400).json({
                    message: 'Pour reporter une visite, vous devez fournir : nouvelleDate, nouvelleHeureDebut, nouvelleHeureFin'
                });
            }
            miseAJour.date        = nouvelleDate;
            miseAJour.heure_debut = nouvelleHeureDebut;
            miseAJour.heure_fin   = nouvelleHeureFin;
        }

        const visiteMiseAJour = await Visite.findByIdAndUpdate(
            req.params.id,
            miseAJour,
            { returnDocument: 'after' }
        );

        // ── Préparer les données pour les notifications ───────────────────
        const clientId    = visite.clientId?._id;
        const nomBoutique = visite.localeID?.nom_boutique || 'votre local';
        const dateVisite  = new Date(visite.date).toLocaleDateString('fr-FR');

        let titreClient, messageClient;
        let titreAdmin,  messageAdmin;

        // ── Construire les messages selon la décision ─────────────────────
        switch (statut) {

            case 'Validée':
                titreClient  = '✅ Visite confirmée';
                messageClient = `Votre visite du ${dateVisite} pour le local "${nomBoutique}" a été validée.`
                    + (motif ? ` — ${motif}` : '')
                    + ' Merci de vous présenter à l\'heure prévue.';

                titreAdmin   = '✅ Visite validée';
                messageAdmin  = `La visite du ${dateVisite} pour le local "${nomBoutique}" a été confirmée au client.`;
                break;

            case 'Refusée':
                titreClient  = '❌ Visite refusée';
                messageClient = `Votre demande de visite du ${dateVisite} pour le local "${nomBoutique}" a été refusée.`
                    + (motif ? ` Motif : ${motif}` : ' Aucun motif précisé.');

                titreAdmin   = '❌ Visite refusée';
                messageAdmin  = `La visite du ${dateVisite} pour le local "${nomBoutique}" a été refusée.`
                    + (motif ? ` Motif enregistré : ${motif}` : '');
                break;

            case 'Reportée': {
                const nouvelleDateFormatee = new Date(nouvelleDate).toLocaleDateString('fr-FR');
                titreClient  = '📅 Visite reportée';
                messageClient = `Votre visite prévue le ${dateVisite} pour le local "${nomBoutique}" a été reportée au ${nouvelleDateFormatee}`
                    + ` de ${String(nouvelleHeureDebut).padStart(2,'0')}h00 à ${String(nouvelleHeureFin).padStart(2,'0')}h00.`
                    + (motif ? ` Motif : ${motif}` : '');

                titreAdmin   = '📅 Visite reportée';
                messageAdmin  = `La visite du ${dateVisite} pour le local "${nomBoutique}" a été reportée au ${nouvelleDateFormatee}.`;
                break;
            }
        }

        // ── Envoyer notification au CLIENT ────────────────────────────────
        if (clientId) {
            await creerNotification(
                clientId,
                titreClient,
                messageClient,
                statut === 'Validée' ? 'paiement' : statut === 'Refusée' ? 'retard' : 'info',
                '/mes-visites'
            );
        }

        const Utilisateur = require('../model/Utilisateur');
        const admins = await Utilisateur.find().select('_id').lean();

        for (const admin of admins) {
            await creerNotification(
                admin._id,
                titreAdmin,
                messageAdmin,
                'info',
                `/admin/visites/${req.params.id}`
            );
        }

        res.json({
            message: `Visite ${statut.toLowerCase()} avec succès. Notifications envoyées.`,
            visite: visiteMiseAJour
        });

    } catch (error) {
        console.error('[VISITE] Erreur décision :', error.message);
        res.status(500).json({ message: error.message });
    }
});
module.exports = router;