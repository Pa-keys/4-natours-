class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  filter() {
    const queryObj = { ...this.queryString };
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    excludedFields.forEach(el => delete queryObj[el]);

    const filter = {};

    Object.entries(queryObj).forEach(([key, value]) => {
      const bracketMatch = key.match(/^(.+)\[(gte|gt|lte|lt)\]$/);

      if (bracketMatch) {
        const [, field, operator] = bracketMatch;
        filter[field] = filter[field] || {};
        filter[field][`$${operator}`] = value;
        return;
      }

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        filter[key] = {};
        Object.entries(value).forEach(([operator, nestedValue]) => {
          filter[key][`$${operator}`] = nestedValue;
        });
        return;
      }

      if (value !== '') filter[key] = value;
    });

    this.query = this.query.find(filter);
    
    return this;
  }

  sort() {
    // Strictly following PDF Page 6
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('-createdAt');
    }
    return this;
  }

  limitFields() {
    // Strictly following PDF Page 9
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select('-__v');
    }
    return this;
  }

  paginate() {
    // Strictly following PDF Page 11
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 100; 
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);
    return this;
  }
}

module.exports = APIFeatures;
