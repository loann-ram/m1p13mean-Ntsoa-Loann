const mongoose = require('mongoose');


const VisiteSchema = new mongoose.Schema({
    localeID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Local',
        required: true},
    date: {
        type: Date,
        required: true,
    },
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Utilisateur',
        required: true
    },
    heure_debut:{
        type: String,
        required: true,
        validate: {
            validator: function(value){
                return /^([0-1][0-9]|2[0-3])$/.test(value);

            },
        }
    },
    heure_fin:{
        type: String,
        required: true,
        validate: {
            validator: function(value){
                return /^[0-1][0-9]|2[0-3]$/.test(value);
            },
        }
    },
    statut:{
        type: String,
        required: true,
        enum: ['Confirmée','En cours','Annulée','Terminée','en attente de confirmation'],
        default : 'en attente de confirmation'
    }
},{ timestamps: true });
module.exports = mongoose.model('Visite', VisiteSchema);
