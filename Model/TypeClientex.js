const mongoose = require("mongoose");

const TypeClientex = new mongoose.Schema({
    typeClientex: {
        type: String,
        enum: ["INDIVIDU", "SOCIETE"],
        required: true
    },
});

module.exports = mongoose.model("TypeClient", TypeClientex);