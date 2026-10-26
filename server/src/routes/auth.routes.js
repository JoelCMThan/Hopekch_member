const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authenticate = require('../middleware/authenticate');
const { validateRegister, validateLogin } = require('../validators/authValidator');

// POST /api/auth/register
router.post('/register', validateRegister, authController.register);

// POST /api/auth/login
router.post('/login', validateLogin, authController.login);

// GET /api/auth/me  (protected)
router.get('/me', authenticate, authController.getMe);

module.exports = router;