const mongoose = require("mongoose");

const TypeClient = new mongoose.Schema({
    typeClient: {
        type: String,
        enum: ["INDIVIDU", "SOCIETE"],
        required: true
    },
});

module.exports = mongoose.model("TypeClient", TypeClient);