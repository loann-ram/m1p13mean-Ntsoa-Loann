const mongoose = require('mongoose');

const PaiementLoyerSchema = new mongoose.Schema({
    reponseDemande: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ReponseDemande',
        required: true
    },
    clientID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Utilisateur',
        required: true
    },
    localID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Local',
        required: true
    },

    // Mois concerné ex: "2025-01"
    moisConcerne: {
        type: String,
        required: true
    },

    // Date limite de paiement (le 5 du mois)
    dateEcheance: {
        type: Date,
        required: true
    },

    // Montant attendu
    montantDu: {
        type: Number,
        required: true
    },

    // Montant réellement payé
    montantPaye: {
        type: Number,
        default: 0
    },

    // Date effective du paiement
    datePaiement: {
        type: Date,
        default: null
    },

    // Statut du paiement
    statut: {
        type: String,
        enum: ['en attente', 'paye', 'en retard', 'impaye'],
        default: 'en attente'
    },

    // Mode de paiement
    modePaiement: {
        type: String,
        enum: ['mvola', 'orange_money', 'especes', null],
        default: null
    },

    // Référence de la transaction (numéro MVola / Orange Money)
    referenceTransaction: {
        type: String,
        default: null
    },

    // ── SOLUTION 1 : Preuve de paiement ──
    // Chemin vers la capture d'écran uploadée par le client
    preuveCheminFichier: {
        type: String,
        default: null
    },

    // Statut de la preuve soumise
    statutPreuve: {
        type: String,
        enum: ['non_requise', 'en_attente_validation', 'validee', 'rejetee'],
        default: 'non_requise'
    },

    // Notes admin
    note: {
        type: String,
        default: null
    },

    // Notification retard envoyée ?
    notificationEnvoyee: {
        type: Boolean,
        default: false
    }

}, { timestamps: true });

// Un seul paiement par mois par client
PaiementLoyerSchema.index({ clientID: 1, moisConcerne: 1 }, { unique: true });

module.exports = mongoose.model('PaiementLoyer', PaiementLoyerSchema);
