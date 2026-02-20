const express = require('express');
const router = express.Router();
const Local = require('../model/Local');
// Créer un article
router.post('/add-newLocal', async (req, res) => {
    try {
        const local = new Local(req.body);
        await local.save();
        res.status(201).json(local);
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
});
// Lire tous les local
router.get('/All-local', async (req, res) => {
    try {
        const locales  = await Local.find();
        res.json(locales);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
router.get('/local-availaible', async (req, res) => {
    try {
        const locales  = await Local.find({etat_boutique:'disponible'},undefined,undefined);
        res.json(locales);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
router.get('/local-unavailaible', async (req, res) => {
    try {
        const locales  = await Local.find({etat_boutique: {$in:['louée','maintenance']}},undefined,undefined);
        res.json(locales);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
//Demande de location d'un local

// Mettre à jour un v
router.put('/:id', async (req, res) => {
    try {
       //const bodyToset = req.body;
      // bodyToset.id = req.params.id;
        const locale = await Local.findByIdAndUpdate(req.params.id,
            req.body, { new: true });
        res.json(locale);
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
});
// Supprimer un locale
router.delete('/:id', async (req, res) => {
    try {
        await Local.findByIdAndDelete(req.params.id);
        res.json({ message: "Locale supprimé" });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
module.exports = router;