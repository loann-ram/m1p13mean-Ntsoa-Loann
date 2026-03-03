const express = require('express');
const router = express.Router();
const Categorie = require('../Model/Categorie');
const SousCategorie = require('../Model/SousCategorie');
const auth = require('../middleware/authAdmin');

router.post('/creerSousCategorie', auth, async (req, res) => {
    try {
        const { nom, categorieId, typesProduits } = req.body;

        const categorieExiste = await Categorie.findById(categorieId);
        if (!categorieExiste) {
            return res.status(404).json({ message: "Catégorie introuvable" });
        }

        const nomExistant = await SousCategorie.findOne({ nom, categorieId });
        if (nomExistant) {
            return res.status(400).json({ message: "Cette sous-catégorie existe déjà dans cette catégorie" });
        }

        const sousCategorie = new SousCategorie({
            nom,
            categorieId,
            typesProduits: typesProduits || []
        });

        await sousCategorie.save();

        res.status(201).json(sousCategorie);

    } catch (err) {
        res.status(500).json({ message: "Erreur: " + err.message });
    }
});

router.post('/creerSousCategoriesBulk', auth, async (req, res) => {
    try {
        const sousCategories = await SousCategorie.insertMany(req.body, { ordered: false });
        res.status(201).json(sousCategories);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/sousCategoriesCat/:categorieId', async (req, res) => {
    try {
        const { categorieId } = req.params;
        if (!categorieId) {
            return res.status(400).json({ message: 'ID de catégorie manquant' });
        }
        const sousCategories = await SousCategorie.find({ categorieId })
            .select('nom _id')
            .sort({ nom: 1 });
        res.json(sousCategories);
    } catch (err) {
        console.error('Erreur lors de la récupération des sous-catégories:', err);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

module.exports = router;