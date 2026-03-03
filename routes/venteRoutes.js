const express = require('express');
const router = express.Router();
const Vente = require('../Model/Vente');
const Commande = require('../Model/Commande');
const Stock = require('../Model/Stock');
const Boutique = require('../Model/Boutique');
const auth = require('../middleware/auth');

const verifierBoutique = async (req, res, next) => {
    try {
        const vente = await Vente.findById(req.params.id).populate('boutiqueId');
        if (!vente) return res.status(404).json({ message: 'Vente introuvable' });
        if (vente.boutiqueId.utilisateurId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Accès non autorisé' });
        }
        req.vente = vente;
        next();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

router.get('/attente',auth, async (req, res) => {
    try {
        const boutique = await Boutique.findOne({ utilisateurId: req.user.id });
        if (!boutique) return res.status(404).json({ message: 'Aucune boutique trouvée' });

        const ventes = await Vente.find({ boutiqueId: boutique._id, statut: 'en cours' })
            .populate('clientId', 'nom email telephone')
            .populate('items.produitId', 'nom images prix')
            .sort({ date: -1 });
        res.json(ventes);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put('/confirmer/:id', auth, verifierBoutique, async (req, res) => {
    try {
        const vente = req.vente;
        if (vente.statut !== 'en cours') {
            return res.status(400).json({ message: 'Cette vente ne peut pas être confirmée' });
        }

        vente.statut = 'payé';
        await vente.save();

        for (let item of vente.items) {
            await Stock.findOneAndUpdate(
                { produitId: item.produitId, taille: item.taille || '' },
                { $inc: { quantite: -item.quantite } }
            );
        }

        const commande = await Commande.findById(vente.commandeId);
        if (commande) {
            const autresVentes = await Vente.find({ commandeId: commande._id, statut: { $ne: 'payé' } });
            if (autresVentes.length === 0) {
                commande.statut = 'livrée';
                await commande.save();
            }
        }

        res.json({ message: 'Vente confirmée', vente });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put('/annuler/:id', auth, verifierBoutique, async (req, res) => {
    try {
        const vente = req.vente;
        if (vente.statut !== 'en cours') {
            return res.status(400).json({ message: 'Cette vente ne peut pas être annulée' });
        }

        vente.statut = 'annulé';
        await vente.save();

        const commande = await Commande.findById(vente.commandeId);
        if (commande) {
            commande.statut = 'annulée';
            await commande.save();
        }

        res.json({ message: 'Vente annulée', vente });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/faireVente', auth, async (req, res) => {
    try {
        const { items, fraisLivraison, notes } = req.body;
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Aucun article' });
        }

        const boutique = await Boutique.findOne({ utilisateurId: req.user.id });
        if (!boutique) return res.status(403).json({ message: 'Vous n\'avez pas de boutique' });

        let total = 0;
        for (let item of items) {
            const stock = await Stock.findOne({ produitId: item.produitId, taille: item.taille || '' });
            if (!stock || stock.quantite < item.quantite) {
                return res.status(400).json({ message: `Stock insuffisant pour le produit ${item.produitId}` });
            }
            total += item.prixUnitaire * item.quantite;
        }

        const count = await Vente.countDocuments();
        const reference = `V${Date.now()}${count}`.slice(0, 20);

        const vente = new Vente({
            reference,
            boutiqueId: boutique._id,
            typeCommande: 'en boutique',
            items,
            total,
            fraisLivraison: fraisLivraison || 0,
            notes,
            paiement: { methode: 'espèces' },
            statut: 'payé'
        });

        for (let item of items) {
            await Stock.findOneAndUpdate(
                { produitId: item.produitId, taille: item.taille || '' },
                { $inc: { quantite: -item.quantite } }
            );
        }

        await vente.save();

        res.status(201).json({ message: 'Vente enregistrée', vente });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});


router.get('/ticket/:id', auth, async (req, res) => {
    try {
        const vente = await Vente.findById(req.params.id)
            .populate('boutiqueId', 'nom telephone')
            .populate('items.produitId', 'nom');
        if (!vente) return res.status(404).json({ message: 'Vente introuvable' });

        const boutique = await Boutique.findOne({ utilisateurId: req.user.id });
        if (!boutique || boutique._id.toString() !== vente.boutiqueId._id.toString()) {
            // Vérifier si c'est le client
            if (vente.clientId?.toString() !== req.user.id) {
                return res.status(403).json({ message: 'Accès non autorisé' });
            }
        }

        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=ticket-${vente.reference}.pdf`);
        doc.pipe(res);

        doc.fontSize(20).text('Ticket de vente', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Boutique: ${vente.boutiqueId.nom}`);
        doc.text(`Tél: ${vente.boutiqueId.telephone}`);
        doc.text(`Date: ${new Date(vente.date).toLocaleString('fr-FR')}`);
        doc.text(`Référence: ${vente.reference}`);
        doc.moveDown();

        doc.text('Articles:', { underline: true });
        vente.items.forEach(item => {
            const nom = item.produitId?.nom || 'Produit';
            const taille = item.taille ? ` (${item.taille})` : '';
            doc.text(`${nom}${taille} x${item.quantite} @ ${item.prixUnitaire} AR = ${item.prixUnitaire * item.quantite} AR`);
        });

        if (vente.fraisLivraison > 0) {
            doc.text(`Frais de livraison: ${vente.fraisLivraison} AR`);
        }
        doc.moveDown();
        doc.fontSize(14).text(`TOTAL: ${vente.total + (vente.fraisLivraison || 0)} AR`, { align: 'right' });

        doc.end();
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;