const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const Produit = require('../Model/Produit');
const Boutique = require('../Model/Boutique');
const Categorie = require('../Model/Categorie');
const SousCategorie = require('../Model/SousCategorie');
const auth = require('../middleware/auth');

const { createUpload } = require('../config/cloudinary');
const uploadProduit = createUpload({ folder: 'produits' });
router.post('/ajouterProduit', auth, uploadProduit.array('images', 5), async (req, res) => {
    try {
        const { nom, description, prix, categorieId, sousCategorieId, boutiqueId, reference } = req.body;

        if (!nom || !prix || !categorieId || !sousCategorieId || !boutiqueId || !reference) {
            return res.status(400).json({
                message: 'Champs obligatoires manquants : nom, prix, categorieId, sousCategorieId, boutiqueId, reference'
            });
        }

        const boutique = await Boutique.findOne({ _id: boutiqueId, utilisateurId: req.user.id, is_active: true });
        if (!boutique) return res.status(403).json({ message: 'Boutique introuvable ou accès refusé' });

        const categorie = await Categorie.findById(categorieId);
        if (!categorie) return res.status(404).json({ message: 'Catégorie introuvable' });

        const sousCategorie = await SousCategorie.findOne({ _id: sousCategorieId, categorieId: categorieId });
        if (!sousCategorie) return res.status(400).json({ message: 'Sous-catégorie introuvable ou n\'appartient pas à cette catégorie' });

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'Au moins une image est requise' });
        }

        const images = req.files.map(file => file.path);

        const produit = new Produit({
            boutiqueId,
            reference,
            nom,
            description,
            prix,
            images,
            categorieId,
            sousCategorieId
        });

        await produit.save();
        res.status(201).json({ message: 'Produit ajouté avec succès', produit });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: 'Cette référence existe déjà' });
        }
        console.error('Erreur ajout produit:', err);
        res.status(500).json({ message: err.message });
    }
});


router.get('/produitsBoutique/:boutiqueId', async (req, res) => {
    try {
        const produits = await Produit.find({
            boutiqueId: req.params.boutiqueId
        }).populate('boutiqueId', 'nom logo').select('-__v');
        console.log("ity ilay produits: "+produits);

        res.json(produits);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


router.get('/produitsboutiquess', async (req, res) => {
    try {
        console.log("ty produits");
        res.send("test");
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/infoProduit/:id', async (req, res) => {
    try {
        const produit = await Produit.findById(req.params.id)
            .populate('boutiqueId', 'nom logo')
            .select('-__v');

        if (!produit) return res.status(404).json({ message: 'Produit introuvable' });

        // Récupérer la catégorie
        const categorie = await Categorie.findById(produit.categorieId);
        // Récupérer la sous-catégorie directement dans la collection SousCategorie
        const sousCategorie = await SousCategorie.findOne({ _id: produit.sousCategorieId, categorieId: produit.categorieId });

        res.json({
            ...produit.toObject(),
            categorie: categorie ? { _id: categorie._id, nom: categorie.nom } : null,
            sousCategorie: sousCategorie ? { _id: sousCategorie._id, nom: sousCategorie.nom } : null
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});


router.put('/modifierProduit/:id', auth, uploadProduit.array('images', 5), async (req, res) => {
    try {
        const produitId = req.params.id;
        const { nom, description, prix, categorieId, sousCategorieId, reference } = req.body;

        const produit = await Produit.findById(produitId).populate('boutiqueId');
        if (!produit) {
            return res.status(404).json({ message: 'Produit introuvable' });
        }
        if (produit.boutiqueId.utilisateurId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Accès non autorisé' });
        }

        if (reference && reference !== produit.reference) {
            const existant = await Produit.findOne({ reference });
            if (existant && existant._id.toString() !== produitId) {
                return res.status(400).json({ message: 'Cette référence existe déjà' });
            }
        }

        const categorie = await Categorie.findById(categorieId);
        if (!categorie) return res.status(404).json({ message: 'Catégorie introuvable' });
        const sousCategorie = await SousCategorie.findOne({ _id: sousCategorieId, categorieId });
        if (!sousCategorie) return res.status(400).json({ message: 'Sous-catégorie invalide' });

        let nouvellesImages = produit.images;
        if (req.files && req.files.length > 0) {
            const nomBoutiqueClean = produit.boutiqueId.nom.replace(/[^a-zA-Z0-9]/g, '_');
            const nomProduitClean = nom.replace(/[^a-zA-Z0-9]/g, '_');
            const dossierFinal = path.join('uploads', 'produits', nomBoutiqueClean, nomProduitClean);
            if (!fs.existsSync(dossierFinal)) {
                fs.mkdirSync(dossierFinal, { recursive: true });
            }
            nouvellesImages = req.files.map(file => {
                const newPath = path.join(dossierFinal, path.basename(file.path));
                fs.renameSync(file.path, newPath);
                return newPath;
            });
        }

        produit.nom = nom || produit.nom;
        produit.description = description !== undefined ? description : produit.description;
        produit.prix = prix || produit.prix;
        produit.categorieId = categorieId || produit.categorieId;
        produit.sousCategorieId = sousCategorieId || produit.sousCategorieId;
        produit.reference = reference || produit.reference;
        produit.images = nouvellesImages;

        await produit.save();

        res.json({ message: 'Produit modifié avec succès', produit });
    } catch (err) {
        console.error('Erreur modification produit:', err);
        res.status(500).json({ message: err.message });
    }
});


router.get('/rechercherProduits', async (req, res) => {
    try {
        const { nom, boutiqueId, categorieId } = req.query;
        const filtre = { isDispo: true };

        if (nom) filtre.nom = { $regex: nom, $options: 'i' };
        if (boutiqueId) filtre.boutiqueId = boutiqueId;
        if (categorieId) filtre.categorieId = categorieId;

        const produits = await Produit.find(filtre)
            .populate('boutiqueId', 'nom logo')
            .select('-__v');

        res.json(produits);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


router.delete('/supprimerProduit/:id', auth, async (req, res) => {
    try {
        const produit = await Produit.findById(req.params.id);
        if (!produit) return res.status(404).json({ message: 'Produit introuvable' });

        const boutique = await Boutique.findOne({ _id: produit.boutiqueId, utilisateurId: req.user.id });
        if (!boutique) return res.status(403).json({ message: 'Accès refusé' });

        await Produit.findByIdAndDelete(req.params.id);
        res.json({ message: `Produit "${produit.nom}" supprimé avec succès` });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;