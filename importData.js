const fs = require('fs');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('./models/productModel');

dotenv.config({ path: './config.env' });

const DB = process.env.DATABASE;

// Read JSON File
const products = JSON.parse(
  fs.readFileSync(`${__dirname}/data/products.json`, 'utf-8')
);

const importData = async () => {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(DB);
    console.log('DB connection successful!');

    // 1. CLEAR THE DATABASE FIRST
    console.log('Clearing old data...');
    await Product.deleteMany(); 
    
    // 2. IMPORT THE FRESH DATA
    console.log('Importing new products...');
    await Product.create(products);
    
    console.log('Data successfully loaded!');
    process.exit();
  } catch (err) {
    console.error('Failed to import data:', err.message);
    process.exit(1);
  }
};

importData();