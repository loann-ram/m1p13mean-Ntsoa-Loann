const multer = require('multer');
const path = require('path');
const fs = require('fs');

const createUpload = (destination, maxSize = 5 * 1024 * 1024) => {
    if (!fs.existsSync(destination)) {
        fs.mkdirSync(destination, { recursive: true });
    }

    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, destination);
        },
        filename: function (req, file, cb) {
            const ext = path.extname(file.originalname).toLowerCase();
            const uniqueName = `${Date.now()}-${Math.floor(Math.random() * 10000)}${ext}`;
            cb(null, uniqueName);
        }
    });

    const fileFilter = (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp/;
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.test(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Format non supporté. Utilisez JPEG, JPG, PNG ou WEBP.'), false);
        }
    };

    return multer({ storage, fileFilter, limits: { fileSize: maxSize } });
};

const uploadProduit = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            const nomBoutique = req.nomBoutique || 'inconnu';
            const nomProduit = req.nomProduit || 'produit';
            const dir = path.join('uploads', 'produits', nomBoutique, nomProduit);

            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            cb(null, dir);
        },
        filename: function (req, file, cb) {
            const ext = path.extname(file.originalname).toLowerCase();
            const uniqueName = `${Date.now()}-${Math.floor(Math.random() * 10000)}${ext}`;
            cb(null, uniqueName);
        }
    }),
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp/;
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.test(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Format non supporté.'), false);
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 }
});

const uploadLogo   = createUpload('uploads/logos');
const uploadLocal  = createUpload('uploads/locaux', 2 * 1024 * 1024);

module.exports = { uploadLogo, uploadLocal, uploadProduit };