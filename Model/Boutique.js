const mongoose = require('mongoose');

const HoraireSchema = new mongoose.Schema({
    jour: {
        type: String,
        enum: ["Lundi", "Mardi", "Mercredi", "Jeudi",
            "Vendredi", "Samedi", "Dimanche"]
    },
    is_open: {
        type: Boolean,
        default: true
    },
    ouverture: String,
    fermeture: String
});

const BoutiqueSchema = new mongoose.Schema({
    utilisateurId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Utilisateur',
        required: true
    },
    local: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Local',
        required: true,
        unique: true
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
    logo: {
        type: String
    },
    categories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Categorie'
    }],
    horaires: [HoraireSchema],
    is_active: {
        type: Boolean,
        default: false
    },
    inscription: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Boutique', BoutiqueSchema);