const express = require('express');
const router = express.Router();
const Local = require('../model/Local');
const authCli = require('../middleware/auth');
const Reservation  = require('../model/ReservationLocal');

router.post('/demande-location', async (req, res) => {
    try {
        const local = new Local(req.body);
        await local.save();
        res.status(201).json(local);
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
});

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
module.exports = router;