const mongoose = require('mongoose');

const SousCategorieSchema = new mongoose.Schema({
    nom: {
        type: String,
        required: true,
        trim: true
    },
    categorieId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Categorie',
        required: true
    },
    typesProduits: {
        type: [String],
        default: []
    }
}, {
    timestamps: true
});

SousCategorieSchema.index({ nom: 1, categorieId: 1 }, { unique: true });

module.exports = mongoose.model('SousCategorie', SousCategorieSchema);