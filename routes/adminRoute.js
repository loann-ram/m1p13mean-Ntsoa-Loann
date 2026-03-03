const express    = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../Model/Admin');
const Typeclientex = require('../model/TypeClientex');

router.post('/inscription', async (req, res) => {
    try {
        const { email, mdp, telephone, roles, typeClient } = req.body;

        const userExist = await Admin.findOne({ email });
        if (userExist) {
            return res.status(400).json({ message: 'Cet email est déjà utilisé' });
        }

        const mdpChiffre = await bcrypt.hash(mdp, 10);

        const newUser = new Admin({
            email,
            mdp: mdpChiffre
        });
        await newUser.save();
        res.status(201).json({ message: 'Inscription réussie' });

    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur: ', error: err.message });
    }
});

router.post('/connexion', async (req, res) => {
    try{
        const {email, mdp} = req.body;

        const userExist = await Admin.findOne({email});
        if(!userExist){
            return res.status(400).json({message: 'Email ou mot de passe incorrect'});
        }

        const mdpValide = await bcrypt.compare(mdp, userExist.mdp);
        if(!mdpValide){
            return res.status(400).json({message: 'Email ou mot de passe incorrect'});
        }

        const token = jwt.sign(
            {id: userExist._id, email: userExist.email, role: 'admin'},
            process.env.JWT_SECRET,
            {expiresIn: '30d'}
        );
        res.status(200).json({
            message: 'Admin connecté',
            token,
            user: {
                id:  userExist._id,
                email: userExist.email,
                role: 'admin'
            },
        });

    }catch (err) {
        res.status(500).json({message: 'Erreur serveur: ', error: err.message});
    }
});
module.exports = router;