const { checkScope, changeStatus } = require('../controllers/organizationController');
const express = require('express');
const router = express.Router();
const { splitHandler } = require('../controllers/hierarchySplitController');

const authenticate = require('../middleware/authenticate');
const { requireRole } = require('../middleware/requireRole');

const {
  UNITS_MODULE_ROLES
}=require('../utils/permissions');


const {
 getUnits,
 getUnit,
 createUnit,
 updateUnit,
 deleteUnit,
 getSubdistricts
}=require('../controllers/unitController');


router.use(authenticate);
router.use(requireRole(UNITS_MODULE_ROLES));


router.get(
 '/lookup/subdistricts',
 getSubdistricts
);


router.get('/',getUnits);
router.get('/:id',checkScope('unit'), getUnit);


router.post('/',createUnit);
router.get('/:id/split-options', checkScope('unit'), splitHandler('unit', true));
router.post('/:id/split', checkScope('unit'), splitHandler('unit'));
router.put('/:id',checkScope('unit'), updateUnit);
router.delete('/:id',checkScope('unit'), deleteUnit);


router.patch('/:id/activate', changeStatus('unit', true));
router.patch('/:id/inactivate', changeStatus('unit', false));

module.exports=router;
