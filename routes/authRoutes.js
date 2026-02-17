const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt   = require('bcryptjs');
const jwt = require('jsonwebtoken');

router.post('/register', async (req, res) => {
    try{
        const {email, mdp, role} = req.body;

        const userExist = await User.findOne({email});
        if(userExist){
            return res.status(400).json({message: 'Email déjà utilisé'});
        }
        const salt = await bcrypt.genSalt(10);
        const mdpHache = await bcrypt.hash(mdp, salt);

        const newUser = new User({
            email,
            mdp: mdpHache,
            role
        });
        await newUser.save();
        res.status(201).json({message: 'Utilisateur créé avec succès'});
    }catch(err){
        res.status(500).json({message: err.message});
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, mdp } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: "Utilisateur non trouvé, vérifiez votre email" });
        }
        if (!user.is_actif) {
            return res.status(403).json({ message: "Compte désactivé" });
        }
        const isMatch = await bcrypt.compare(mdp, user.mdp);
        if (!isMatch) {
            return res.status(400).json({ message: "Mot de passe incorrect" });
        }

        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.json({
            message: "Connexion réussie",
            token
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


module.exports = router;