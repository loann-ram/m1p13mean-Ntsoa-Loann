
const mongoose = require('mongoose');

const PaiementCommandeSchema = new mongoose.Schema({
    commandeID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Commande',
        required: true
    },
    clientID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Utilisateur',
        required: true
    },
    montantDu: { type: Number, required: true },
    montantPaye: { type: Number, default: 0 },
    datePaiement: { type: Date, default: null },

    // Mode de paiement
    modePaiement: {
        type: String,
        enum: ['mobile_money', 'cheque', 'especes', null],
        default: null
    },

    // Référence transaction (numéro MVola, numéro chèque, etc.)
    referenceTransaction: { type: String, default: null },

    // Statut du paiement
    statut: {
        type: String,
        enum: ['en attente', 'paye', 'annule'],
        default: 'en attente'
    },

    // Preuve de paiement (option 1 — client upload)
    preuveCheminFichier: { type: String, default: null },
    statutPreuve: {
        type: String,
        enum: ['non_requise', 'en_attente_validation', 'validee', 'rejetee'],
        default: 'non_requise'
    },

    note: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('PaiementCommande', PaiementCommandeSchema);
