const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../model/Admin');

router.post('/inscription', async (req, res) => {
    try {
        const { email, mdp } = req.body;

        const adminExist = await Admin.findOne({ email });
        if (adminExist) {
            return res.status(400).json({ message: 'Cet email est déjà utilisé' });
        }

        const mdpChiffre = await bcrypt.hash(mdp, 10);
        const newAdmin = new Admin({ email, mdp: mdpChiffre });
        await newAdmin.save();

        res.status(201).json({ message: 'Admin créé avec succès' });
    } catch (err) {
        res.status(500).json({ message: 'Erreur: ' + err.message });
    }
});

router.post('/connexion', async (req, res) => {
    try {
        const { email, mdp } = req.body;

        const admin = await Admin.findOne({ email });
        if (!admin) {
            return res.status(400).json({ message: 'Email ou mot de passe incorrect' });
        }

        const mdpValide = await bcrypt.compare(mdp, admin.mdp);
        if (!mdpValide) {
            return res.status(400).json({ message: 'Email ou mot de passe incorrect' });
        }

        const token = jwt.sign(
            { id: admin._id, email: admin.email, role: 'admin' },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.status(200).json({ message: 'Admin connecté', token });
    } catch (err) {
        res.status(500).json({ message: 'Erreur: ' + err.message });
    }
});

module.exports = router;