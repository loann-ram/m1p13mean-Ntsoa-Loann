const mongoose = require('mongoose');



const ReservationLocal = new mongoose.Schema({
    localeID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Local',
        required: true
    },
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Utilisateur'
    },
    infoLoc:{
        dure:{
            type: Number,
            required: true,
        },
        prix:{
            type: mongoose.Schema.Types.Decimal128,
            required: true,
        }
    },
    status:{
        type: String,
        required: true,
        enum: ['Confirmée','En attente','Annulée','Demande soumis'],
        default : 'En attente'
    }
},{ timestamps: true });
module.exports = mongoose.model('ReservationLocal', ReservationLocal);
