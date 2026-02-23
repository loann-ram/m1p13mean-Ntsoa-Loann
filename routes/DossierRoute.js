const express = require('express');
const router = express.Router();

const TypeClientex= require('../model/TypeClientex');
const TypeDossier        = require('../model/TypeDossier');
const DossierRequire = require('../model/DossierRequire');


// GET /api/config/type-client
router.get('/type-client', async (req, res) => {
    try {
        const data = await TypeClient.find();
        res.json(data);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// DELETE /api/config/type-client/:id
router.delete('/type-client/:id', async (req, res) => {
    try {
        await TypeClient.findByIdAndDelete(req.params.id);
        res.json({ message: 'TypeClient supprimé' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ══════════════════════════════════════════════════════════════
//  TYPE DOSSIER (documents : CIN, NIF, STAT, etc.)
// ══════════════════════════════════════════════════════════════

// POST /api/config/type-dossier
// body: { "nom": "CIN", "description": "Carte d'Identité Nationale" }
router.post('/type-dossier', async (req, res) => {
    try {
        const { nom, description } = req.body;
        //console.log(req.body);
        if (!nom){
            return res.status(400).json({ message: 'nom requis' });
        }

        const existe = await TypeDossier.findOne({ nom });
        if (existe){
            return res.status(409).json({ message: 'TypeDossier déjà existant', data: existe });
        }

        const typeDossier = await TypeDossier.create({ nom, description });
        res.status(201).json({ message: 'TypeDossier créé', data: typeDossier });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/config/type-dossier
router.get('/Afficher-all-type-dossier', async (req, res) => {
    try {
        const data = await TypeDossier.find();
        res.json(data);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// DELETE /api/config/type-dossier/:id mbola tsy nandramana
router.delete('/type-dossier/:id', async (req, res) => {
    try {
        await TypeDossier.findByIdAndDelete(req.params.id);
        res.json({ message: 'TypeDossier supprimé' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ══════════════════════════════════════════════════════════════
//  DOSSIER REQUIREMENT  (lien typeClient ↔ documents requis)
// ══════════════════════════════════════════════════════════════

// POST /api/config/dossier-requirement
// body: {
//   "typeClient": "<typeClientId>",
//   "typeDocument": ["<typeDossierId1>", "<typeDossierId2>"],
//   "obligatoire": true
// }
router.post('/dossier-requirement-typeClient', async (req, res) => {
    try {
        const { typeClientex, typeDocument, obligatoire } = req.body;


        if (!typeClientex || !typeDocument || !Array.isArray(typeDocument) || typeDocument.length === 0)
            return res.status(400).json({ message: 'typeClient et typeDocument[] requis' });

        // Vérifier que le typeClient existe
        const tc = await TypeClientex.findById(typeClientex);
        if (!tc) return res.status(404).json({ message: 'TypeClient introuvable' });
        // Vérifier que chaque TypeDossier existe
        for (const id of typeDocument) {
            const td = await TypeDossier.findById(id);
            if (!td) return res.status(404).json({ message: `TypeDossier introuvable : ${id}` });
        }

        // Un seul DossierRequirement par typeClient
        const existe = await DossierRequire.findOne({ typeClientex: tc._id });
        if (existe) return res.status(409).json({
            message: 'DossierRequirement déjà existant pour ce typeClient. Utilisez PUT pour modifier.',
            data: existe
        });

        const requirement = await DossierRequire.create({ typeClientex: tc._id, typeDocument, obligatoire });
        const populated = await requirement.populate(['typeClientex', 'typeDocument']);
        res.status(201).json({ message: 'DossierRequire créé', data: populated });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/config/dossier-requirement
router.get('/dossier-requirement', async (req, res) => {
    try {
        const data = await DossierRequirement.find()
            .populate('typeClient', 'typeClientex')
            .populate('typeDocument', 'nom description');
        res.json(data);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/config/dossier-requirement/:id
router.get('/dossier-requirement/:id', async (req, res) => {
    try {
        const data = await DossierRequirement.findById(req.params.id)
            .populate('typeClient', 'typeClientex')
            .populate('typeDocument', 'nom description');
        if (!data) return res.status(404).json({ message: 'Introuvable' });
        res.json(data);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// PUT /api/config/dossier-requirement/:id
// Permet d'ajouter / remplacer les documents requis
// body: { "typeDocument": ["<id1>", "<id2>", ...], "obligatoire": true }
router.put('/update-dossier-requirement/:id', async (req, res) => {
    try {
        const { typeDocument, obligatoire } = req.body;

        if (!typeDocument || !Array.isArray(typeDocument) || typeDocument.length === 0)
            return res.status(400).json({ message: 'typeDocument[] requis' });

        for (const id of typeDocument) {
            const td = await TypeDossier.findById(id);
            if (!td) return res.status(404).json({ message: `TypeDossier introuvable : ${id}` });
        }

        const updated = await DossierRequire.findByIdAndUpdate(
            req.params.id,
            { typeDocument, ...(obligatoire !== undefined && { obligatoire }) },
            { new: true }
        ).populate('typeClientex', 'typeClientex').populate('typeDocument', 'nom description');

        if (!updated) return res.status(404).json({ message: 'DossierRequirement introuvable' });
        res.json({ message: 'DossierRequirement mis à jour', data: updated });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// DELETE /api/config/dossier-requirement/:id
router.delete('/dossier-requirement/:id', async (req, res) => {
    try {
        await DossierRequirement.findByIdAndDelete(req.params.id);
        res.json({ message: 'DossierRequirement supprimé' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;