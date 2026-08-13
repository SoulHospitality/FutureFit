const express = require('express');
const dotenv = require('dotenv');
dotenv.config();

const cors = require('cors');
const compression = require('compression');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const orderRoutes = require('./routes/orderRoutes');
const userRoutes = require('./routes/userRoutes');
const slideRoutes = require('./routes/slideRoutes');
const couponRoutes = require('./routes/couponRoutes');
const problemRoutes = require('./routes/problemRoutes');

const app = express();

app.disable('x-powered-by');
app.use(compression());
app.use(cors());
// Keep JSON small by default; uploads/base64 slides use a higher limit only on those routes
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/slides', slideRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/problems', problemRoutes);

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/', (req, res) => {
  res.send('FutureFit API is running');
});

module.exports = app;
