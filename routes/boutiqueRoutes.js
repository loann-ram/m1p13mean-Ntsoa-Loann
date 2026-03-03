const express = require('express');
const router = express.Router();
const Boutique = require('../Model/Boutique');
const Utilisateur = require('../Model/Utilisateur');
const Local = require('../Model/Local');
const TypeClientex = require('../Model/TypeClientex');
const Categorie = require('../Model/Categorie');
const auth = require('../middleware/auth');
const authAdmin = require('../middleware/authAdmin');

const { createUpload } = require('../config/cloudinary');
const uploadLogo = createUpload({folder: 'boutiques/logos'});

router.post('/ajouterBoutique', authAdmin, uploadLogo.single('logo'), async (req, res) => {
    try {
        console.log("Body reçu:", req.body);
        console.log("Fichier reçu:", req.file);

        const { nom, description, telephone, local, horaires, categorie, utilisateurId } = req.body;

        if (!nom || !telephone || !local || !categorie) {
            return res.status(400).json({ message: 'Champs obligatoires manquants (nom, telephone, local, categorie)' });
        }

        const existing = await Boutique.findOne({ nom });
        if (existing) {
            return res.status(400).json({ message: 'Nom de boutique déjà utilisé' });
        }

        const utilisateur = await Utilisateur.findById(utilisateurId);
        if (!utilisateur) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        const categorieExist = await Categorie.findById(categorie);
        if (!categorieExist) {
            return res.status(400).json({ message: 'Catégorie invalide' });
        }

        const localDoc = await Local.findById(local);
        if (!localDoc || localDoc.etat_boutique !== 'disponible') {
            return res.status(400).json({ message: 'Local introuvable ou non disponible' });
        }

        const logoUrl = req.file ? req.file.path : null;
        const logoPublicId = req.file ? req.file.filename : null;

        const boutique = new Boutique({
            utilisateurId: utilisateurId,
            nom,
            description,
            telephone,
            logo: logoUrl,
            categorie,
            horaires: horaires,
            local
        });

        await boutique.save();

        localDoc.etat_boutique = 'louée';
        await localDoc.save();

        utilisateur.roles = ['boutique'];
        await utilisateur.save();

        res.status(201).json(boutique);
    } catch (err) {
        console.error(err);
        if (err.code === 11000 && err.keyPattern?.local) {
            return res.status(400).json({ message: 'Ce local est déjà utilisé par une boutique active' });
        }
        res.status(500).json({ message: 'Erreur: ' + err.message });
    }
});

router.get('/listeBoutiques', async (req, res) => {
    try {
        const filtre = { is_active: true };
        if (req.query.nom) {
            filtre.nom = { $regex: req.query.nom, $options: 'i' };
        }
        const boutiques = await Boutique.find(filtre)
            .populate('categorie')
            .select('-__v');
        res.json(boutiques);
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur: ' + err.message });
    }
});

router.get('/boutiques-hors-restauration', async (req, res) => {
    try {
        const boutiques = await Boutique.find({ is_active: true })
            .populate('categorie');

        const result = boutiques.filter(b =>
            !b.categorie || b.categorie.nom !== 'RESTAURATION'
        );

        res.status(200).json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/listeRestaurants', async (req, res) => {
    try {
        const boutiques = await Boutique.aggregate([
            { $match: { is_active: true } },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'categorie',
                    foreignField: '_id',
                    as: 'categorie'
                }
            },
            { $unwind: '$categorie' },
            { $match: { 'categorie.nom': 'RESTAURATION' } }
        ]);
        res.status(200).json(boutiques);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/boutiquesCategorie/:categorieId', async (req, res) => {
    try {
        const boutiques = await Boutique.find({
            is_active: true,
            categorie: req.params.categorieId
        }).populate('categorie');
        res.json(boutiques);
    } catch (err) {
        res.status(500).json({ message: 'Erreur: ' + err.message });
    }
});

router.get('/infoBoutique/:id', async (req, res) => {
    try {
        const boutique = await Boutique.findById(req.params.id)
            .populate('categorie')
            .populate('local')
            .select('-__v');
        if (!boutique || !boutique.is_active) {
            return res.status(404).json({ message: 'Boutique non trouvée' });
        }
        res.json(boutique);
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur: ' + err.message });
    }
});

router.get('/maBoutique', auth, async (req, res) => {
    try {
        if (!req.user.roles.includes('boutique')) {
            return res.status(403).json({ message: 'Accès refusé : vous n\'avez pas de boutique' });
        }
        const boutique = await Boutique.findOne({
            utilisateurId: req.user.id,
            is_active: true
        }).populate('categorie');
        if (!boutique) {
            return res.status(404).json({ message: 'Aucune boutique trouvée pour cet utilisateur' });
        }
        res.json(boutique);
    } catch (err) {
        res.status(500).json({ message: 'Erreur: ' + err.message });
    }
});



router.put('/modifierInfoBoutique/:id', auth, uploadLogo.single('logo'), async (req, res) => {
    try {
        const { nom, description, telephone, categorie } = req.body;

        // Vérifier unicité du nom
        if (nom) {
            const existing = await Boutique.findOne({ nom, _id: { $ne: req.params.id } });
            if (existing) {
                return res.status(400).json({ message: 'Nom déjà utilisé' });
            }
        }

        const ancienneBoutique = await Boutique.findById(req.params.id);
        if (!ancienneBoutique) {
            return res.status(404).json({ message: 'Boutique non trouvée' });
        }

        const updateData = { nom, description, telephone, categorie };

        if (req.file) {
            updateData.logo = req.file.path;
            if (ancienneBoutique.logo) {
                const publicId = extractPublicId(ancienneBoutique.logo);
                if (publicId) {
                    await cloudinary.uploader.destroy(publicId);
                }
            }
        }

        const boutique = await Boutique.findOneAndUpdate(
            { _id: req.params.id, utilisateurId: req.user.id },
            updateData,
            { new: true, runValidators: true }
        ).populate('categorie');

        if (!boutique) {
            return res.status(404).json({ message: 'Boutique non trouvée ou vous n\'êtes pas le propriétaire' });
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
            { new: true, runValidators: true }
        );
        if (!boutique) {
            return res.status(404).json({ message: 'Boutique non trouvée ou vous n\'êtes pas le propriétaire' });
        }
        res.json(boutique);
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur: ' + err.message });
    }
});

router.put('/desactiverBoutique/:id', authAdmin, async (req, res) => {
    try {
        const boutique = await Boutique.findByIdAndUpdate(
            req.params.id,
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

router.put('/activerBoutique/:id', authAdmin, async (req, res) => {
    try {
        const boutique = await Boutique.findById(req.params.id);
        if (!boutique) {
            return res.status(404).json({ message: 'Boutique non trouvée' });
        }

        const localActif = await Boutique.findOne({
            local: boutique.local,
            is_active: true,
            _id: { $ne: boutique._id }
        });
        if (localActif) {
            return res.status(400).json({ message: 'Le local est déjà utilisé par une boutique active' });
        }

        boutique.is_active = true;
        await boutique.save();
        res.json({ message: 'Boutique activée avec succès' });
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur: ' + err.message });
    }
});

module.exports = router;