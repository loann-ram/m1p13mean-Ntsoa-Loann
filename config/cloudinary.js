// config/cloudinary.js
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Factory upload ──────────────────────────────────────────────
function createUpload({ folder, allowedFormats = ['jpg', 'jpeg', 'png', 'pdf'], maxSizeMB = 5 }) {
    const storage = new CloudinaryStorage({
        cloudinary,
        params: async (req, file) => ({
            folder,
            allowed_formats: allowedFormats,
            resource_type: file.mimetype === 'application/pdf' ? 'raw' : 'image',
            public_id: `${Date.now()}-${Math.round(Math.random() * 1e9)}`,
            // ✅ Optimisation auto dès l'upload
            quality: 'auto',
            fetch_format: 'auto',
        }),
    });

    return multer({
        storage,
        limits: { fileSize: maxSizeMB * 1024 * 1024 },
    });
}

// ── Helpers URL ─────────────────────────────────────────────────

// Image normale optimisée (qualité + format auto)
function getOptimizedUrl(publicId) {
    return cloudinary.url(publicId, {
        fetch_format: 'auto',   // WebP sur Chrome, AVIF si supporté
        quality: 'auto',        // compresse sans perte visible
    });
}

// Thumbnail carré (pour les cards de locaux par ex.)
function getThumbnailUrl(publicId, width = 400, height = 300) {
    return cloudinary.url(publicId, {
        crop: 'auto',
        gravity: 'auto',        // détecte le sujet principal
        width,
        height,
        fetch_format: 'auto',
        quality: 'auto',
    });
}

// Extrait le public_id depuis une URL Cloudinary
function extractPublicId(url) {
    try {
        // ex: https://res.cloudinary.com/cloud/image/upload/v123/locaux/1234.jpg
        const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/);
        return match ? match[1] : null;
    } catch { return null; }
}

module.exports = { cloudinary, createUpload, getOptimizedUrl, getThumbnailUrl, extractPublicId };