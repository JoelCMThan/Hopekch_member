const authService = require('../services/authService');
const { success, error } = require('../utils/apiResponse');

// handle request and response, delegate business logic to service layer
const register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    return success(res, result, 'Account registered successfully', 201);
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    return success(res, result, 'Login successful');
  } catch (err) {
    next(err);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user.userId);
    return success(res, user, 'User retrieved successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, getMe };