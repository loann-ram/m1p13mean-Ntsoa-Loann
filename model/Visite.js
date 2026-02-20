const mongoose = require('mongoose');


const VisiteSchema = new mongoose.Schema({
    localeID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Locale',
        required: true},
    date: {
        type: Date,
        required: true,
    },
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client'
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
    status:{
        type: String,
        required: true,
        enum: ['Confirmée','En cours','Annulée'],
        default : 'Confirmée'
    }
},{ timestamps: true });
module.exports = mongoose.model('Visite', VisiteSchema);
