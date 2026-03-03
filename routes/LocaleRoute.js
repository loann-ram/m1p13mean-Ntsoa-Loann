const express = require('express');
const router = express.Router();
const Local = require('../Model/Local');
const { createUpload, getOptimizedUrl, getThumbnailUrl, extractPublicId, cloudinary } = require('../config/cloudinary');

const upload = createUpload({ folder: 'locaux', maxSizeMB: 5 });

// Créer un local avec images
router.post('/add-newLocal', upload.array('images', 5), async (req, res) => {
    try {
        const images = req.files.map(file => file.path); // ← file.path = URL Cloudinary complète
        const local = new Local({ ...req.body, images });
        await local.save();
        res.status(201).json(local);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Lire tous les locaux avec URLs optimisées
router.get('/All-local', async (req, res) => {
    try {
        const locales = await Local.find().lean();
        res.json(locales); // ← les images sont déjà des URLs Cloudinary complètes en base
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Locaux disponibles avec URLs optimisées
router.get('/local-availaible', async (req, res) => {
    try {
        const locals = await Local.find({ etat_boutique: 'disponible' }).lean();
        const result = locals.map(l => ({
            ...l,
            loyer: l.loyer ? parseFloat(l.loyer.toString()) : 0
        }));
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Locaux non disponibles
router.get('/local-unavailaible', async (req, res) => {
    try {
        const locales = await Local.find({
            etat_boutique: { $in: ['louée', 'maintenance'] }
        }).lean();

        const result = locales.map(local => ({
            ...local,
            images: (local.images || []).map(url => {
                const publicId = extractPublicId(url);
                return {
                    original:  url,
                    optimized: publicId ? getOptimizedUrl(publicId) : url,
                    thumbnail: publicId ? getThumbnailUrl(publicId, 400, 300) : url,
                };
            })
        }));

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Mettre à jour un local
router.put('/:id', async (req, res) => {
    try {
        const local = await Local.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(local);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Supprimer un local + ses images Cloudinary
router.delete('/:id', async (req, res) => {
    try {
        const local = await Local.findById(req.params.id);
        if (!local) return res.status(404).json({ message: 'Local non trouvé' });

        // Supprimer chaque image de Cloudinary
        for (const url of local.images || []) {
            const publicId = extractPublicId(url);
            if (publicId) {
                await cloudinary.uploader.destroy(publicId);
            }
        }

        await Local.findByIdAndDelete(req.params.id);
        res.json({ message: 'Local supprimé' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
