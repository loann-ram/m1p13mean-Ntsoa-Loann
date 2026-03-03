const mongoose = require('mongoose');

const CartItemSchema = new mongoose.Schema({
    clientID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Utilisateur',
        required: true
    },
    produitID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Produit',
        required: true
    },
    quantite: {
        type: Number,
        required: true,
        min: 1,
        default: 1
    },
    prixUnitaire: {
        type: Number,
        required: true
    }
}, { timestamps: true });

// Un client ne peut avoir qu'un seul item par produit dans son panier
CartItemSchema.index({ clientID: 1, produitID: 1 }, { unique: true });

module.exports = mongoose.model('CartItem', CartItemSchema);
