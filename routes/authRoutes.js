const express    = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Utilisateur = require('../model/Utilisateur');
const Typeclientex = require('../model/TypeClientex');

router.post('/inscription', async (req, res) => {
    try {
        const { email, mdp, telephone, roles, typeClient } = req.body;

        const userExist = await Utilisateur.findOne({ email });
        if (userExist) {
            return res.status(400).json({ message: 'Cet email est déjà utilisé' });
        }

        if (roles && roles.includes('boutique')) {
            if (!typeClient) {
                return res.status(400).json({ message: 'Le type de client est requis pour une boutique' });
            }

            const typeClientExist = await Typeclientex.findById(typeClient);
            if (!typeClientExist) {
                return res.status(400).json({ message: 'Type de client invalide' });
            }
        }

        const mdpChiffre = await bcrypt.hash(mdp, 10);

        const newUser = new Utilisateur({
            email,
            mdp: mdpChiffre,
            telephone,
            roles,
            typeClient: roles && roles.includes('boutique') ? typeClient : undefined
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

        const userExist = await Utilisateur.findOne({email});
        if(!userExist){
            return res.status(400).json({message: 'Email ou mot de passe incorrect'});
        }

        const mdpValide = await bcrypt.compare(mdp, userExist.mdp);
        if(!mdpValide){
            return res.status(400).json({message: 'Email ou mot de passe incorrect'});
        }

        const token = jwt.sign(
            {id: userExist._id, email: userExist.email, roles: userExist.roles},
            process.env.JWT_SECRET,
            {expiresIn: '1d'}
        );

        res.status(200).json({
            message: 'Utilisateur connecté',
            token,
            user: {
                id: userExist._id,
                email: userExist.email,
                roles: userExist.roles
            },
        });

    }catch (err) {
        res.status(500).json({message: 'Erreur serveur: ', error: err.message});
    }
});

module.exports = router;