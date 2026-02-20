const express = require('express');
const router = express.Router();
const Local = require('../model/Local');
const Resa = require('../model/ReservationLocal');
const Visite = require("../model/Visite");

// Créer reservation
router.post('/add-reservation', async (req, res) => {
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
router.put('/Update-resa/:idResa', async (req, res) => {
    try {
        const resaFaite  = await Resa.findByIdAndUpdate(req.params.idResa,req.body,{new:true});
        res.json(resaFaite);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
//All reservation(filtered)
router.get('/all-Reservation', async (req, res) => {
    try {
            const filtered = req.query.etat_filtered || 'disponible';
            const resa = await Resa.find({ status: filtered });
            res.json(resa);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
//All reservation(filtered)
router.get('/Reservation-client/:id_client', async (req, res) => {
    try {
        const id_client = req.params.id_client;
        const resaClient = await Resa.findById(id_client);
        res.json(resaClient);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;