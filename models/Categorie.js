const mongoose = require('mongoose');

const CategorieSchema = new mongoose.Schema({
    nom: {
        type: String,
        required: true,
        unique: true
    }
});

module.exports = mongoose.model('Categorie', CategorieSchema);