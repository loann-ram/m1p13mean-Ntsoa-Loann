const express = require('express');
const router = express.Router();
const Category = require('../models/Categorie');

router.post('/addCategory', async (req, res) => {
    try{
        const { categorie } = req.body;

        const catExist = await Category.findOne({categorie});
        if(catExist){
            return res.status(400).json({message:'Cette catégorie existe déjà'});
        }

        const newCat = new Category({
            categorie
        })
        await newCat.save();
        res.status(201).json({message: 'Catégorie ajoutée avec succès'});
    }catch(err){
        res.status(500).send({message: err.message});
    }
})

module.exports = router;