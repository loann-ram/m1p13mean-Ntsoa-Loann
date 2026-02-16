const express = require('express');
const router = express.Router();
const Article = require('../model/Article');
// Créer un article
router.post('/', async (req, res) => {
    try {
        const article = new Article(req.body);
        await article.save();
        res.status(201).json(article);
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
});
// Lire tous les articles
router.get('/', async (req, res) => {
    try {
        const articles = await Article.find();
        res.json(articles);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Mettre à jour un article
router.put('/:id', async (req, res) => {
    try {
        const article = await Article.findByIdAndUpdate(req.params.id,
            req.body, { new: true });
        res.json(article);
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
});
// Supprimer un article
router.delete('/:id', async (req, res) => {
    try {
        await Article.findByIdAndDelete(req.params.id);
        res.json({ message: "Article supprimé" });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
module.exports = router;