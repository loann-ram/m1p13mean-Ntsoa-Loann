const express = require('express');
const router = express.Router();
const Boutique = require('../models/Boutique');
const authenticate = require('../middleware/authMiddleware');

router.post('/addBoutique', authenticate, async (req, res) => {
    try{
        const userId = req.user.id;
        const {nom, description, telephone, categories, horaires}  = req.body;

        const nomExist = await Boutique.findOne({ nom });
        if (nomExist) {
            return res.status(400).json({ message: 'Une boutique avec ce nom existe déjà dans le centre' });
        }
        if (telephone) {
            const telExist = await Boutique.findOne({ telephone });
            if (telExist) {
                return res.status(400).json({ message: 'Ce numéro de téléphone est déjà utilisé par une autre boutique' });
            }
        }

        let categoriesIds = [];
        if (categories && categories.length > 0) {
            const foundCategories = await Categorie.find({
                categorie: { $in: categories }
            });
            if (foundCategories.length !== categories.length) {
                return res.status(400).json({
                    message: 'Une ou plusieurs catégories sont invalides'
                });
            }
            categoriesIds = foundCategories.map(cat => cat._id);
        }

        const newBoutique = new Boutique({
            userId,
            nom,
            description,
            telephone,
            categories: categoriesIds,
            horaires
        })
        await newBoutique.save();
        res.status(201).json({message: 'Boutique créée avec succès'});

    }catch(err){
        res.status(500).json({message: err.message});
    }
})

module.exports = router;