const express = require('express');
const mongoose = require('mongoose');
const createTypeClient= require('./middleware/TypeClient');

app.use(CORS())
app.use(express.json());
app.use(createTypeClient);

mongoose.connect(process.env.MONGO_URI)
    .then(() => {console.log("MongoDB Connected")})
    .catch((error) => {
        console.log(error);})
app.use(createTypeClient);
// Routes
app.use("/LocaleCM", require("./routes/LocaleRoute"));
app.use("/VisiteCM", require("./routes/visiteRoutes"));
app.use("/ReservationCM", require("./routes/ReservationLocalRoute"));
app.use('/auth', require('./routes/authRoutes'));
app.listen(PORT, () => console.log(`Serveur démarré sur le port 
${PORT}`));



=======
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB connecté avec succès");

        app.use('/auth', require('./routes/authRoutes'));
        app.use('/boutique', require('./routes/boutiqueRoutes'));
        app.use('/categorie', require('./routes/categorieRoutes'));

        app.listen(PORT, () => {
            console.log(`Serveur démarré sur le port ${PORT}`);
        });
    })
    .catch(err => {
        console.error("Erreur de connexion MongoDB:", err.message);
    });

