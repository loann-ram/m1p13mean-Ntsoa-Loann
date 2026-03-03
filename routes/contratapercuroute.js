const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const path    = require('path');
const fs      = require('fs');
const ReponseDemande = require('../Model/ResponseDm');

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE A — Générer un token temporaire (1 min) pour accéder au PDF
// POST /ResponseDm/contrat-token/:demandeId
// Appelé par le front AVANT d'ouvrir window.open()
// Nécessite auth middleware → monter AVEC auth dans app.js
// ─────────────────────────────────────────────────────────────────────────────
router.post('/contrat-token/:demandeId', async (req, res) => {
    try {
        const { demandeId } = req.params;

        const reponse = await ReponseDemande.findOne({
            demandeID: demandeId,
            statut: 'accepte'
        }).lean();

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

// ROUTE B — Sert le PDF inline (vérification manuelle du tempToken)
// GET /ResponseDm/contrat-apercu/:demandeId?token=xxx
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

        const reponse = await ReponseDemande.findOne({
            demandeID: demandeId,
            statut: 'accepte'
        }).lean();

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
module.exports = router;
