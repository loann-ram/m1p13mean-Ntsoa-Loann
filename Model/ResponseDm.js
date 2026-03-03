const mongoose = require('mongoose');

const ReponseDemande = new mongoose.Schema({
    demandeID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DemandeClient',
        required: true
    },
    adminID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Utilisateur',
        required: true
    },
    statut: {
        type: String,
        enum: ['accepte', 'refuse'],
        required: true
    },
    commentaire: {
        type: String,
        default: null
    },
    contratPDF: {
        type: String, // chemin relatif vers le fichier PDF ex: uploads/contrats/contrat-xxx.pdf
        default: null
    },
    dateReponse: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('ReponseDemande', ReponseDemande);