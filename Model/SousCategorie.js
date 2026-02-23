const mongoose = require('mongoose');

const SousCategorieSchema = new mongoose.Schema({
    nom: {
        type: String,
        required: true,
        unique: true
    },
    categorieId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Categorie',
        required: true
    }
});

module.exports = mongoose.model('SousCategorie', SousCategorieSchema);
