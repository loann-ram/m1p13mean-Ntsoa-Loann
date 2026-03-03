const express = require('express');
const router = express.Router();
const Categorie = require('../Model/Categorie');
const auth = require('../middleware/authAdmin');


router.get('/listeCategories', async (req, res) => {
    try {
        const categories = await Categorie.find().select('-__v');
        res.json(categories);
    } catch (err) {
        res.status(500).json({ message: 'Erreur: ' + err.message });
    }
});

router.get('/listeCategoriesHorsRestauration', async (req, res) => {
    try {
        const categories = await Categorie.find({ nom: { $ne: 'RESTAURATION' } })
            .select('-__v');
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
        const nomExistant = await Categorie.findOne({ nom: req.body.nom, _id: { $ne: req.params.id } });
        if (nomExistant) {
            return res.status(400).json({ message: 'Ce nom de catégorie existe déjà' });
        }

        const categorie = await Categorie.findByIdAndUpdate(
            req.params.id,
            { nom: req.body.nom },
            { returnDocument: 'after', runValidators: true }
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

router.post('/ajouterSousCategorie/:id', auth, async (req, res) => {
    try {
        const { nom } = req.body;

        const categorie = await Categorie.findById(req.params.id);
        if (!categorie) {
            return res.status(404).json({ message: 'Catégorie introuvable' });
        }

        const existe = categorie.sousCategories.some(
            sc => sc.nom.toLowerCase() === nom.toLowerCase()
        );
        if (existe) {
            return res.status(400).json({ message: 'Sous-catégorie déjà existante' });
        }

        categorie.sousCategories.push({ nom });
        await categorie.save();

        res.status(201).json({ message: 'Sous-catégorie ajoutée', categorie });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


router.get('/listeSousCategories/:id', async (req, res) => {
    try {
        const categorie = await Categorie.findById(req.params.id).select('-__v');
        if (!categorie) {
            return res.status(404).json({ message: 'Catégorie introuvable' });
        }
        res.json(categorie.sousCategories);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


router.put('/modifierSousCategorie/:id/:sousCategorieId', auth, async (req, res) => {
    try {
        const { nom } = req.body;

        const categorie = await Categorie.findById(req.params.id);
        if (!categorie) {
            return res.status(404).json({ message: 'Catégorie introuvable' });
        }

        const sousCategorie = categorie.sousCategories.id(req.params.sousCategorieId);
        if (!sousCategorie) {
            return res.status(404).json({ message: 'Sous-catégorie introuvable' });
        }

        sousCategorie.nom = nom;
        await categorie.save();

        res.json({ message: 'Sous-catégorie modifiée', categorie });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


router.delete('/supprimerSousCategorie/:id/:sousCategorieId', auth, async (req, res) => {
    try {
        const categorie = await Categorie.findById(req.params.id);
        if (!categorie) {
            return res.status(404).json({ message: 'Catégorie introuvable' });
        }

        const sousCategorie = categorie.sousCategories.id(req.params.sousCategorieId);
        if (!sousCategorie) {
            return res.status(404).json({ message: 'Sous-catégorie introuvable' });
        }

        categorie.sousCategories = categorie.sousCategories.filter(
            sc => sc._id.toString() !== req.params.sousCategorieId
        );
        await categorie.save();

        res.json({ message: 'Sous-catégorie supprimée', categorie });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


module.exports = router;