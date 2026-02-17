const express = require('express');
const mongoose = require('mongoose');
const CORS = require('cors');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 8080;

app.use(CORS())
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
    .then(() => {console.log("MongoDB Connected")})
    .catch((error) => {
        console.log(error);})

// Routes
app.use("/LocaleCM", require("./routes/LocaleRoute"));
app.use("/VisiteurCM", require("./routes/visiteRoutes"));
app.use("/ReservationCM", require("./routes/ReservationLocalRoute"));
app.listen(PORT, () => console.log(`Serveur démarré sur le port 
${PORT}`));



