const mongoose = require('mongoose');



const ReservationLocal = new mongoose.Schema({
    localeID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Locale',
        required: true},
    nom: {
        type: String,
        required: true,
    },
    email:{
        type: String,
        required: true,
    },
    infoLoc:{
        dure:{
            type: Number,
            required: true,
        },
        prixPropose:{
            type: mongoose.Schema.Types.Decimal128,
            required: true,
        }
    },
    status:{
        type: String,
        required: true,
        enum: ['Confirmée','En attente','Annulée'],
        default : 'En attente'
    }
},{ timestamps: true });
module.exports = mongoose.model('ReservationLocal', ReservationLocal);
