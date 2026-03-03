const express = require('express');
const router = express.Router();
const TypeClientex = require('../model/TypeClientex');

router.get('/listeTypeClient', async (req, res) => {
    try {
        const types = await TypeClientex.find();
        res.json(types);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;