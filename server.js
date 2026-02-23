const express = require('express');
const mongoose = require('mongoose');
const createTypeClient= require('./middleware/TypeClient');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();
const auth = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(createTypeClient);

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB connecté avec succès");

        app.use('/auth', require('./routes/authRoutes'));
        app.use('/boutique', require('./routes/boutiqueRoutes'));
        app.use('/categorie', require('./routes/categorieRoutes'));
        app.use("/LocaleCM",auth,require("./routes/LocaleRoute"));
        app.use("/VisiteCM",auth,require("./routes/visiteRoutes"));
        app.use("/ReservationCM",auth, require("./routes/ReservationLocalRoute"));
        app.use("/DemandeLocationCM",auth, require("./routes/DemandeLocRoute"));
        app.use("/DossierCM",auth,require("./routes/DossierRoute"));

        app.listen(PORT, () => {
            console.log(`Serveur démarré sur le port ${PORT}`);
        });
    })
    .catch(err => {
        console.error("Erreur de connexion MongoDB:", err.message);
    });

