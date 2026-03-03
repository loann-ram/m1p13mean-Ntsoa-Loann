const mongoose = require('mongoose');

const ArticleVenduSchema = new mongoose.Schema({
    produitId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Produit',
        required: true
    },
    taille: {
        type: String,
        required: false,
        trim: true
    },
    quantite: {
        type: Number,
        required: true,
        min: 1
    },
    prixUnitaire: {
        type: Number,
        required: true,
        min: 0
    }
});

const VenteSchema = new mongoose.Schema({
    reference: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    boutiqueId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Boutique',
        required: true
    },
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Utilisateur'
    },
    clientNom: {
        type: String,
        trim: true
    },
    clientEmail: {
        type: String,
        trim: true,
        lowercase: true
    },
    typeCommande: {
        type: String,
        enum: ['en ligne', 'en boutique'],
        required: true
    },
    commandeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Commande',
        required: function() {
            return this.typeCommande === 'en ligne';
        }
    },
    fraisLivraison: {
        type: Number,
        min: 0,
        default: 0,
        required: function() {
            return this.typeCommande === 'en ligne';
        }
    },
    items: [ArticleVenduSchema],
    total: {
        type: Number,
        required: true,
        min: 0
    },
    statut: {
        type: String,
        enum: ['payé', 'annulé', 'en cours'],
        default: 'en cours'
    },
    paiement: {
        methode: {
            type: String,
            enum: ['espèces', 'mobile money'],
            required: true
        },
        refTrans: {
            type: String,
            required: function() {
                return this.methode === 'mobile money';
            }
        }
    },
    notes: {
        type: String,
        trim: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Vente', VenteSchema);