const mongoose = require('mongoose');
const { Schema } = mongoose;

const Details = new Schema({
    produitId: {
        type: Schema.Types.ObjectId,
        ref: 'Produit',
        required: true
    },
    quantite: {
        type: Number,
        required: true,
        min: 1
    },
    prixUnitaire: {
        type: Number,
        required: true
    },
    taille: {
        type: String,
        required: false
    }
}, { _id: false });

const PanierSchema = new Schema({
    utilisateurId: {
        type: Schema.Types.ObjectId,
        ref: 'Utilisateur',
        required: true,
        unique: true
    },
    items: [Details],
    total: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model('Panier', PanierSchema);