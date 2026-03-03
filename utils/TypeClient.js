const TypeClient = require('../model/TypeClientex');

async function createTypeClient() {
    try {
        const count = await TypeClient.countDocuments();
        if (count === 0) {
            await TypeClient.create({ typeClientex: "INDIVIDU" });
            await TypeClient.create({ typeClientex: "SOCIETE" });
            console.log("TypeClient initialisés !");
        } else {
            console.log("TypeClient déjà initialisés.");
        }
    } catch (err) {
        console.error("Erreur initTypeClient :", err);
    }
}

module.exports = createTypeClient;