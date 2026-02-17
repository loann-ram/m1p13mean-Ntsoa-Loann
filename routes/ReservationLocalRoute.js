const express = require('express');
const router = express.Router();
const Local = require('../model/Local');
const Resa = require('../model/ReservationLocal');
// Créer reservation
router.post('/add-reservation ', async (req, res) => {
    try {
        const resa = new Resa(req.body);
        await resa.save();
        res.status(201).json(resa);
    }
    catch (error) {
        console.error("erreur sur lors de la reservation");
        res.status(400).json({ message: error.message });
    }
});
// Update reservation
router.get('/:idResa', async (req, res) => {
    try {
        const resaFaite  = await Resa.findByIdAndUpdate(req.params.idResa,req.body,{new:true});
        res.json(locales);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
//All reservation
router.get('/local-availaible', async (req, res) => {
    try {
        const locales  = await Local.find({etat_boutique:'disponible'},undefined,undefined);
        res.json(locales);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
module.exports = router;