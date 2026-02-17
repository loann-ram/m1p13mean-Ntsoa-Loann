const mongoose = require("mongoose");

const LogoSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    logo: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    isActif: {
        type: Boolean,
        default: true
    }
});

module.exports = mongoose.model('Logo',LogoSchema);