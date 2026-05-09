const mongoose = require('mongoose');
const slugify = require('slugify'); // Added for Document Middleware

// Added virtuals true so virtual properties show up in JSON and Objects
const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'A product must have a name'],
    unique: true,
    trim: true
  },
  productSlug: String, // Step 3: Added productSlug property
  price: {
    type: Number,
    required: [true, 'A product must have a price']
  },
  priceDiscount: { // Step 7: Custom validator for discount
    type: Number,
    validate: {
      validator: function(val) {
        // 'this' points to current document on NEW document creation
        return val < this.price; 
      },
      message: 'Discount price ({VALUE}) should be below regular price'
    }
  },
  category: {
    type: String,
    required: [true, 'A product must have a category']
  },
  seller: {
    type: String,
    required: [true, 'A product must have a seller']
  },
  location: {
    type: String,
    required: [true, 'A product must have a location']
  },
  image: {
    type: String,
    default: '📦'
  },
  description: {
    type: String,
    required: [true, 'A product must have a description'],
    trim: true,
    maxLength: [300, 'A product description must have less or equal than 300 characters']
  },
  rating: {
    type: Number,
    default: 4.5
  },
  postedDate: { // Step 2: Added posted date property
    type: Date,
    default: Date.now
  },
  premiumProducts: { // Step 4: Added premiumProducts property
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    select: false
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Step 2: Virtual Property - Days Posted
productSchema.virtual('daysPosted').get(function() {
  if (!this.postedDate) return null;
  // Calculate difference in time, then convert to days
  const diffTime = Math.abs(Date.now() - this.postedDate.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
});

// Step 3: Document Middleware - runs BEFORE .save() and .create()
productSchema.pre('save', function() {
  // Slugify and convert to upper case per requirements
  this.productSlug = slugify(this.name, { lower: false }).toUpperCase();
});

// Step 4: Query Middleware - runs BEFORE any find action
productSchema.pre(/^find/, function() {
  // Only get data where premiumProducts is not true
  this.find({ premiumProducts: { $ne: true } });
});

// Step 5: Aggregate Middleware - runs BEFORE aggregation
productSchema.pre('aggregate', function() {
  // Add a match stage at the beginning to exclude premium products
  this.pipeline().unshift({ $match: { premiumProducts: { $ne: true } } });
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
