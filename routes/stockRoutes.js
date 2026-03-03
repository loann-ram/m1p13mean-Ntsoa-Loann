const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Stock = require('../Model/Stock');
const Produit = require('../Model/Produit');
const Boutique = require('../Model/Boutique');
const auth = require('../middleware/auth');


router.post('/ajouterStock', auth, async (req, res) => {
    try {
        const { produitId, taille, quantite } = req.body;

        if (!produitId || quantite === undefined || quantite <= 0) {
            return res.status(400).json({ message: 'Données invalides : produitId et quantite positive requis' });
        }

        const produit = await Produit.findById(produitId).populate({
            path: 'boutiqueId',
            select: 'utilisateurId'
        });
        if (!produit) {
            return res.status(404).json({ message: 'Produit introuvable' });
        }

        if (produit.boutiqueId.utilisateurId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à ajouter du stock pour ce produit' });
        }

        const stock = new Stock({
            produitId,
            taille: taille || undefined,
            quantite
        });

        await stock.save();

        res.status(201).json({ message: 'Stock ajouté avec succès', stock });
    } catch (err) {
        console.error('Erreur ajout stock:', err);
        res.status(500).json({ message: err.message });
    }
});

router.get('/infoStockProduit/:id', async (req, res) => {
    try {
        const produit = await Produit.findById(req.params.id)
            .populate('categorieId')
            .populate('sousCategorieId')
            .lean();

        if (!produit) {
            return res.status(404).json({ message: 'Produit introuvable' });
        }

        const stockTotal = await Stock.aggregate([
            { $match: { produitId: produit._id } },
            { $group: { _id: null, total: { $sum: '$quantite' } } }
        ]);

        const stockParTaille = await Stock.aggregate([
            { $match: { produitId: produit._id } },
            { $group: { _id: '$taille', total: { $sum: '$quantite' } } }
        ]);

        produit.stockTotal = stockTotal.length > 0 ? stockTotal[0].total : 0;
        produit.stockParTaille = stockParTaille; // tableau d'objets { _id: taille, total: nombre }

        res.json(produit);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


router.get('/mouvementProduit/:produitId', auth, async (req, res) => {
    try {
        const { produitId } = req.params;

        const produit = await Produit.findById(produitId).populate('boutiqueId');
        if (!produit) {
            return res.status(404).json({ message: 'Produit introuvable' });
        }
        if (produit.boutiqueId.utilisateurId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Accès refusé' });
        }

        const historique = await Stock.find({ produitId })
            .sort({ date: -1 })
            .select('-__v');

        res.json(historique);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


router.put('/modifier/:id', auth, async (req, res) => {
    try {
        const stock = await Stock.findById(req.params.id).populate({
            path: 'produitId',
            populate: { path: 'boutiqueId' }
        });

        if (!stock) {
            return res.status(404).json({ message: 'Entrée de stock introuvable' });
        }


        if (stock.produitId.boutiqueId.utilisateurId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Accès refusé' });
        }


        const { taille, quantite, date } = req.body;
        if (taille !== undefined) stock.taille = taille;
        if (quantite !== undefined) stock.quantite = quantite;
        if (date !== undefined) stock.date = date;

        await stock.save();

        res.json({ message: 'Stock modifié', stock });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


router.delete('/supprimer/:id', auth, async (req, res) => {
    try {
        const stock = await Stock.findById(req.params.id).populate({
            path: 'produitId',
            populate: { path: 'boutiqueId' }
        });

        if (!stock) {
            return res.status(404).json({ message: 'Entrée de stock introuvable' });
        }

        if (stock.produitId.boutiqueId.utilisateurId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Accès refusé' });
        }

        await stock.remove();

        res.json({ message: 'Entrée de stock supprimée' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;