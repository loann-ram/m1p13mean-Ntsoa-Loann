const TypeClient = require('../model/TypeClientex');

async function createTypeClient(req, res, next) {
    try {
        const count = await TypeClient.countDocuments();
        if (count === 0) {

            await TypeClient.create({ typeClientex: "INDIVIDU" });
            await TypeClient.create({ typeClientex: "SOCIETE" });
            console.log("TypeClient initialisés !");
        }
        next();
    } catch (err) {
        console.error("Erreur initTypeClient :", err);
        next(err);
    }
}

module.exports = createTypeClient;