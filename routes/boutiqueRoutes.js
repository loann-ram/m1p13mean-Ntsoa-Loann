const express = require('express');
const router = express.Router();
const Boutique = require('../models/Boutique');
const Utilisateur = require('../models/Utilisateur');
const auth = require('../middleware/auth');


router.get('/listeBoutiques', async (req, res) => {
    try {
        const filtre = { is_active: true };

        if (req.query.nom) {
            filtre.nom = { $regex: req.query.nom, $options: 'i' };
        }

        const boutiques = await Boutique.find(filtre)
            .populate('categories')
            .select('-__v');

        res.json(boutiques);
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur: ' + err.message });
    }
});

router.get('/boutiquesCategorie/:categorieId', async (req, res) => {
    try {
        const boutiques = await Boutique.find({
            is_active: true,
            categories: req.params.categorieId
        }).populate('categories');

        res.json(boutiques);
    } catch (err) {
        res.status(500).json({ message: 'Erreur: ' + err.message });
    }
});

router.get('/infoBoutique/:id', async (req, res) => {
    try {
        const boutique = await Boutique.findById(req.params.id)
            .populate('categories')
            .select('-__v');

        if (!boutique || !boutique.is_active) {
            return res.status(404).json({ message: 'Boutique non trouvée' });
        }

        res.json(boutique);
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur: ' + err.message });
    }
});

router.get('/mesBoutiques', auth, async (req, res) => {
    try {
        if (!req.user.roles.includes('boutique')) {
            return res.status(403).json({ message: 'Accès refusé : vous n\'avez pas de boutiques' });
        }

        const boutiques = await Boutique.find({ utilisateurId: req.user.id, is_active: true })
            .populate('categories');

        res.json(boutiques);
    } catch (err) {
        res.status(500).json({ message: 'Erreur: ' + err.message });
    }
});

router.get('/maBoutique/:id', auth, async (req, res) => {
    try {
        if (!req.user.roles.includes('boutique')) {
            return res.status(403).json({ message: 'Accès refusé : vous n\'avez pas de boutiques' });
        }

        const boutique = await Boutique.findOne({
            _id: req.params.id,
            utilisateurId: req.user.id,
            is_active: true
        }).populate('categories');

        if (!boutique) {
            return res.status(404).json({ message: 'Boutique non trouvée' });
        }

        res.json(boutique);
    } catch (err) {
        res.status(500).json({ message: 'Erreur: ' + err.message });
    }
});

router.post('/ajouterBoutique', auth, async (req, res) => {
    try {
        const { nom, description, telephone, logo, categories, horaires, localId, typeClient } = req.body;

        const nomExistant = await Boutique.findOne({ nom });
        if (nomExistant) {
            return res.status(400).json({ message: 'Nom de boutique déjà utilisé' });
        }

        if (!typeClient) {
            return res.status(400).json({ message: 'Le type de client est indefini' });
        }

        const typeClientExist = await TypeClient.findById(typeClient);
        if (!typeClientExist) {
            return res.status(400).json({ message: 'Type de client non-indentifié' });
        }

        if (!localId) {
            return res.status(400).json({ message: 'Local introuvable' });
        }

        const local = await Local.findById(localId);
        if (!local) {
            return res.status(404).json({ message: 'Local introuvable' });
        }
        if (local.etat_boutique !== 'disponible') {
            return res.status(400).json({ message: 'Ce local n\'est pas disponible' });
        }

        const boutique = new Boutique({
            utilisateurId: req.user.id,
            nom,
            description,
            telephone,
            logo,
            categories,
            horaires,
            local: localId
        });
        await boutique.save();

        local.etat_boutique = 'louée';
        local.nom_boutique = nom;
        await local.save();

        await Utilisateur.findByIdAndUpdate(req.user.id, {
            $addToSet: { roles: 'boutique' },
            $set: { typeClient: typeClient }
        });

        res.status(201).json(boutique);
    } catch (err) {
        res.status(500).json({ message: 'Erreur: ' + err.message });
    }
});

router.put('/modifierInfoBoutique/:id', auth, async (req, res) => {
    try {
        const { nom, description, telephone, logo, categories } = req.body;

        if (nom) {
            const nomExiste = await Boutique.findOne({ nom });
            if (nomExiste) {
                return res.status(400).json({ message: 'Ce nom de boutique est déjà pris' });
            }
        }

        const boutique = await Boutique.findOneAndUpdate(
            { _id: req.params.id, utilisateurId: req.user.id },
            { nom, description, telephone, logo, categories },
            { new: true, runValidators: true }
        ).populate('categories');

        if (!boutique) {
            return res.status(404).json({ message: 'Boutique non trouvée' });
        }

        res.json(boutique);
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur: ' + err.message });
    }
});

router.put('/modifierHoraireBoutique/:id/horaires', auth, async (req, res) => {
    try {
        const { horaires } = req.body;

        const boutique = await Boutique.findOneAndUpdate(
            { _id: req.params.id, utilisateurId: req.user.id },
            { horaires },
            { new: true }
        );

        if (!boutique) {
            return res.status(404).json({ message: 'Boutique non trouvée' });
        }

        res.json(boutique);
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur: ' + err.message });
    }
});

router.put('/desactiverBoutique/:id', auth, async (req, res) => {
    try {
        const boutique = await Boutique.findOneAndUpdate(
            { _id: req.params.id, utilisateurId: req.user.id },
            { is_active: false },
            { new: true }
        );

        if (!boutique) {
            return res.status(404).json({ message: 'Boutique non trouvée' });
        }

        res.json({ message: 'Boutique désactivée avec succès' });
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur: ' + err.message });
    }
});

router.put('/activerBoutique/:id', auth, async (req, res) => {
    try {
        const boutique = await Boutique.findOneAndUpdate(
            { _id: req.params.id },
            { is_active: true },
            { new: true }
        );

        if (!boutique) {
            return res.status(404).json({ message: 'Boutique non trouvée' });
        }

        res.json({ message: 'Boutique activée avec succès' });
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur: ' + err.message });
    }
});

module.exports = router;