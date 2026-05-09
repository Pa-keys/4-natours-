const express = require('express');
const productController = require('../controllers/productController');
const authController = require('../controllers/authController');

const router = express.Router();

router.route('/top-3-cheapest')
  .get(authController.protect, productController.aliasTop3Cheapest, productController.getAllProducts);

router.route('/product-category')
  .get(productController.getProductCategory);

router.route('/')
  .get(authController.protect, productController.getAllProducts)
  .post(authController.protect, productController.createProduct);

router.route('/:id')
  .get(authController.protect, productController.getProduct)
  .patch(authController.protect, productController.updateProduct)
  .delete(authController.protect, authController.restrictTo('admin'), productController.deleteProduct);

module.exports = router;
