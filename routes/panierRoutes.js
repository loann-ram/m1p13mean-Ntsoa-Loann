const express = require('express');
const router = express.Router();
const Panier = require('../Model/Panier');
const Produit = require('../Model/Produit');
const auth = require('../middleware/auth');

router.get('/voirPanier', auth, async (req, res) => {
    try {
        let panier = await Panier.findOne({ utilisateurId: req.user.id })
            .populate({
                path: 'items.produitId',
                select: 'nom images'
            });
        if (!panier) {
            panier = new Panier({ utilisateurId: req.user.id, items: [] });
            await panier.save();
        }
        res.json(panier);
    } catch (err) {
        console.error('Erreur voirPanier:', err);
        res.status(500).json({ message: err.message });
    }
});

router.post('/ajouterPanier', auth, async (req, res) => {
    try {
        console.log('Données reçues:', req.body);
        const { produitId, quantite, prixUnitaire, taille } = req.body;

        if (!produitId || !quantite || !prixUnitaire || quantite <= 0) {
            return res.status(400).json({ message: 'Données invalides' });
        }

        let panier = await Panier.findOne({ utilisateurId: req.user.id });
        if (!panier) {
            panier = new Panier({ utilisateurId: req.user.id, items: [] });
        }

        const existingItemIndex = panier.items.findIndex(item =>
            item.produitId.toString() === produitId &&
            (item.taille || '') === (taille || '')
        );

        if (existingItemIndex !== -1) {
            panier.items[existingItemIndex].quantite += quantite;
        } else {
            panier.items.push({ produitId, quantite, prixUnitaire, taille: taille || undefined });
        }

        panier.total = panier.items.reduce((acc, item) => acc + (item.prixUnitaire * item.quantite), 0);

        await panier.save();
        res.json(panier);
    } catch (err) {
        console.error('Erreur ajoutPanier:', err);
        res.status(500).json({ message: err.message });
    }
});

router.put('/modifier/:produitId', auth, async (req, res) => {
    try {
        const { quantite } = req.body;
        const produitId = req.params.produitId;
        if (quantite < 1) {
            return res.status(400).json({ message: 'Quantité doit être >= 1' });
        }

        const panier = await Panier.findOne({ utilisateurId: req.user.id });
        if (!panier) return res.status(404).json({ message: 'Panier introuvable' });

        const item = panier.items.find(item => item.produitId.toString() === produitId);
        if (!item) return res.status(404).json({ message: 'Article introuvable dans le panier' });

        item.quantite = quantite;

        // Recalcul du total
        panier.total = panier.items.reduce((acc, item) => acc + (item.prixUnitaire * item.quantite), 0);

        await panier.save();
        res.json(panier);
    } catch (err) {
        console.error('Erreur modifier:', err);
        res.status(500).json({ message: err.message });
    }
});

router.delete('/supprimer/:produitId', auth, async (req, res) => {
    try {
        const panier = await Panier.findOne({ utilisateurId: req.user.id });
        if (!panier) return res.status(404).json({ message: 'Panier introuvable' });

        panier.items = panier.items.filter(item => item.produitId.toString() !== req.params.produitId);

        panier.total = panier.items.reduce((acc, item) => acc + (item.prixUnitaire * item.quantite), 0);

        await panier.save();
        res.json(panier);
    } catch (err) {
        console.error('Erreur supprimer:', err);
        res.status(500).json({ message: err.message });
    }
});

router.delete('/vider', auth, async (req, res) => {
    try {
        const panier = await Panier.findOne({ utilisateurId: req.user.id });
        if (panier) {
            panier.items = [];
            panier.total = 0;
            await panier.save();
        }
        res.json({ message: 'Panier vidé' });
    } catch (err) {
        console.error('Erreur vider:', err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;