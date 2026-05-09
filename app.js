const express = require('express');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const productRouter = require('./routes/productRoutes');
const userRouter = require('./routes/userRoutes');
const authController = require('./controllers/authController');
const userController = require('./controllers/userController');
const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorControler');

const app = express();

app.set('query parser', 'extended');

app.use(helmet());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour!',
  standardHeaders: 'draft-6',
  legacyHeaders: false
});

app.use('/api', limiter);

app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// express-mongo-sanitize and xss-clean predate Express 5's read-only query getter.
app.use((req, res, next) => {
  Object.defineProperty(req, 'query', {
    value: { ...req.query },
    writable: true,
    enumerable: true,
    configurable: true
  });
  next();
});

app.use(mongoSanitize());
app.use(xss());
app.use(
  hpp({
    whitelist: ['price', 'rating', 'category', 'seller', 'location']
  })
);

app.use(express.static(`${__dirname}/public`));

app.post('/api/v1/signup', authController.signup);
app.post('/api/v1/login', authController.login);
app.get('/api/v1/logout', authController.logout);
app.post('/api/v1/forgotPassword', authController.forgotPassword);
app.patch('/api/v1/resetPassword/:token', authController.resetPassword);
app.patch('/api/v1/updateMyPassword', authController.protect, authController.updatePassword);
app.get('/api/v1/me', authController.protect, userController.getMe);
app.patch('/api/v1/updateMe', authController.protect, userController.updateMe);
app.delete('/api/v1/deleteMe', authController.protect, userController.deleteMe);

app.use('/api/v1/products', productRouter);
app.use('/api/v1/users', userRouter);

app.get('/', (req, res) => res.status(200).sendFile(`${__dirname}/public/index.html`));
app.get('/overview', (req, res) => res.status(200).sendFile(`${__dirname}/public/overview.html`));
app.get('/item', (req, res) => res.status(200).sendFile(`${__dirname}/public/item.html`));
app.get('/add-item', (req, res) => res.status(200).sendFile(`${__dirname}/public/add-item.html`));
app.get('/login', (req, res) => res.status(200).sendFile(`${__dirname}/public/login.html`));
app.get('/signup', (req, res) => res.status(200).sendFile(`${__dirname}/public/signup.html`));
app.get('/stats', (req, res) => res.status(200).sendFile(`${__dirname}/public/stats.html`));

app.all(/(.*)/, (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
