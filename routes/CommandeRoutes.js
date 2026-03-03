const express = require('express');
const router = express.Router();
const Commande = require('../Model/Commande');
const Panier = require('../Model/Panier');
const Vente = require('../Model/Vente');
const Stock = require('../Model/Stock');
const Utilisateur = require('../Model/Utilisateur');
const auth = require('../middleware/auth');

router.post('/passerCommande', auth, async (req, res) => {
    try {
        const { typeLivraison, adresseLivraison } = req.body;

        const panier = await Panier.findOne({ utilisateurId: req.user.id }).populate({
            path: 'items.produitId',
            populate: { path: 'boutiqueId' }
        });
        if (!panier || panier.items.length === 0) {
            return res.status(400).json({ message: 'Panier vide' });
        }

        for (let item of panier.items) {
            const tailleRecherche = item.taille || '';
            const stock = await Stock.findOne({ produitId: item.produitId._id, taille: tailleRecherche });
            if (!stock || stock.quantite < item.quantite) {
                return res.status(400).json({
                    message: `Stock insuffisant pour ${item.produitId.nom}${item.taille ? ' (taille ' + item.taille + ')' : ''}`
                });
            }
        }

        const utilisateur = await Utilisateur.findById(req.user.id);

        const commande = new Commande({
            utilisateurId: req.user.id,
            articles: panier.items.map(item => ({
                produitId: item.produitId._id,
                quantite: item.quantite,
                prixUnitaire: item.prixUnitaire,
                taille: item.taille || ''
            })),
            total: panier.total,
            typeLivraison,
            ...(typeLivraison === 'livraison' && { adresseLivraison }),
            telephoneContact: utilisateur?.telephone || ''
        });
        await commande.save();

        const ventesParBoutique = {};
        for (let item of panier.items) {
            const boutiqueId = item.produitId.boutiqueId._id.toString();
            if (!ventesParBoutique[boutiqueId]) {
                ventesParBoutique[boutiqueId] = {
                    boutiqueId,
                    items: [],
                    total: 0
                };
            }
            ventesParBoutique[boutiqueId].items.push({
                produitId: item.produitId._id,
                taille: item.taille || '',
                quantite: item.quantite,
                prixUnitaire: item.prixUnitaire
            });
            ventesParBoutique[boutiqueId].total += item.prixUnitaire * item.quantite;
        }

        for (let key in ventesParBoutique) {
            const data = ventesParBoutique[key];
            const count = await Vente.countDocuments();
            const reference = `V${Date.now()}${count}`.slice(0, 20);

            const vente = new Vente({
                reference,
                boutiqueId: data.boutiqueId,
                clientId: req.user.id,
                typeCommande: 'en ligne',
                commandeId: commande._id,
                fraisLivraison: 0,
                items: data.items,
                total: data.total,
                paiement: { methode: 'espèces' },
                statut: 'en cours'
            });
            await vente.save();
        }

        panier.items = [];
        panier.total = 0;
        await panier.save();

        res.status(201).json({ message: 'Commande passée avec succès', commande });
    } catch (err) {
        console.error('Erreur passage commande:', err);
        res.status(500).json({ message: err.message });
    }
});

router.get('/listeMesCommandes', auth, async (req, res) => {
    try {
        const commandes = await Commande.find({ utilisateurId: req.user.id })
            .sort({ dateCommande: -1 })
            .populate('articles.produitId', 'nom images');
        res.json(commandes);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;