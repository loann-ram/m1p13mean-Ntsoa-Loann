const mongoose = require('mongoose');

const ProduitSchema = new mongoose.Schema({
    boutiqueId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Boutique',
        required: true
    },
    reference: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    nom: {
        type: String,
        required: true
    },
    description: String,
    prix: {
        type: Number,
        required: true
    },
    images: {
        type: [String],
        validate: {
            validator: function(v) {
                return v.length >= 1 && v.length <= 5;
            },
            message: 'Un produit doit avoir entre 1 et 5 images'
        }
    },
    categorieId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Categorie',
        required: true
    },
    sousCategorieId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SousCategorie',
        required: true
    },
    isDispo: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('Produit', ProduitSchema);