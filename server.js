const express = require('express');
const mongoose = require('mongoose');
const CORS = require('cors');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 8080;
<<<<<<< Updated upstream

app.use(CORS())
app.use(express.json());
=======
const createTypeClient= require('./middleware/TypeClient');

app.use(CORS())
app.use(express.json());
app.use(createTypeClient);
>>>>>>> Stashed changes

mongoose.connect(process.env.MONGO_URI)
    .then(() => {console.log("MongoDB Connected")})
    .catch((error) => {
        console.log(error);})
<<<<<<< Updated upstream

=======
app.use(createTypeClient);
>>>>>>> Stashed changes
// Routes
app.use("/LocaleCM", require("./routes/LocaleRoute"));
app.use("/VisiteCM", require("./routes/visiteRoutes"));
app.use("/ReservationCM", require("./routes/ReservationLocalRoute"));
<<<<<<< Updated upstream
=======
app.use('/auth', require('./routes/authRoutes'));
>>>>>>> Stashed changes
app.listen(PORT, () => console.log(`Serveur démarré sur le port 
${PORT}`));



