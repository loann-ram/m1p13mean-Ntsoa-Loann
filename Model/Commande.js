const mongoose = require('mongoose');

const ArticleCommandeSchema = new mongoose.Schema({
    produitId: {
        type: mongoose.Schema.Types.ObjectId,
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

const CommandeSchema = new mongoose.Schema({
    utilisateurId: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', required: true },
    articles: [ArticleCommandeSchema],
    total: { type: Number, required: true },
    statut: {
        type: String,
        enum: ['confirmée', 'livrée', 'annulée'],
        default: 'confirmée'
    },
    typeLivraison: {
        type: String,
        enum: ['retrait', 'livraison'],
        required: true
    },
    adresseLivraison: {
        type: String,
        required: false
    },
    telephoneContact: String,
    dateCommande: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports =mongoose.models.Commande || mongoose.model('Commande', CommandeSchema);