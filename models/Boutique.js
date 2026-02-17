const mongoose = require('mongoose');

const HoraireSchema = new mongoose.Schema({
    jour: {
        type: String,
        enum: [
            "Lundi",
            "Mardi",
            "Mercredi",
            "Jeudi",
            "Vendredi",
            "Samedi",
            "Dimanche"
        ]
    },
    is_open: {
        type: Boolean,
        default: true
    },
    ouverture: String,
    fermeture: String
});

const BoutiqueSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    nom: {
        type: String,
        required: true,
        unique: true
    },
    description: String,
    telephone: {
        type: String,
        required: true,
        unique: true
    },
    categories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Categorie',
    }],
    horaires: [HoraireSchema]
});

module.exports = mongoose.model('Boutique', BoutiqueSchema);