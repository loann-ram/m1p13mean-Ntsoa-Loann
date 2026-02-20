const express = require('express');
const router = express.Router();
const Categorie = require('../models/Categorie');
const auth = require('../middleware/auth');


router.get('/listeCategories', async (req, res) => {
    try {
        const categories = await Categorie.find().select('-__v');
        res.json(categories);
    } catch (err) {
        res.status(500).json({ message: 'Erreur: ' + err.message });
    }
});


router.get('/infoCategorie/:id', async (req, res) => {
    try {
        const categorie = await Categorie.findById(req.params.id).select('-__v');
        if (!categorie) {
            return res.status(404).json({ message: 'Catégorie non trouvée' });
        }
        res.json(categorie);
    } catch (err) {
        res.status(500).json({ message: 'Erreur: ' + err.message });
    }
});


router.post('/creerCategorie', auth, async (req, res) => {
    try {
        const nomExistant = await Categorie.findOne({ nom: req.body.nom });
        if (nomExistant) {
            return res.status(400).json({ message: 'Ce nom de catégorie existe déjà' });
        }

        const categorie = new Categorie({ nom: req.body.nom });
        await categorie.save();
        res.status(201).json(categorie);
    } catch (err) {
        res.status(500).json({ message: 'Erreur: ' + err.message });
    }
});


router.put('/modifierCategorie/:id', auth, async (req, res) => {
    try {
        const nomExistant = await Categorie.findOne({ nom: req.body.nom });
        if (nomExistant) {
            return res.status(400).json({ message: 'Ce nom de catégorie existe déjà' });
        }

        const categorie = await Categorie.findByIdAndUpdate(
            req.params.id,
            { nom: req.body.nom },
            { new: true, runValidators: true }
        );

        if (!categorie) {
            return res.status(404).json({ message: 'Catégorie non trouvée' });
        }

        res.json(categorie);
    } catch (err) {
        res.status(500).json({ message: 'Erreur: ' + err.message });
    }
});


router.delete('/supprimerCategorie/:id', auth, async (req, res) => {
    try {
        const categorie = await Categorie.findByIdAndDelete(req.params.id);

        if (!categorie) {
            return res.status(404).json({ message: 'Catégorie non trouvée' });
        }

        res.json({ message: 'Catégorie supprimée avec succès' });
    } catch (err) {
        res.status(500).json({ message: 'Erreur: ' + err.message });
    }
});

module.exports = router;