const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt =require('jsonwebtoken');
const stripe = require("stripe")(`sk_test_51M9cuNBAUqblELKM2R0E10tNIMFWDYkEM1GTqUgW7ppvMols9BLx6ahjaMzq7qhjMY8SZnRuM0V0mdhqE18T9EVB00iFWfYviQ`);
require('dotenv').config();


const app = express();

const Port = process.env.PORT || 5000;
// middle wares
app.use(cors());
app.use(express.json());
const verifyJwt = (req, res, next) => {
    const bearerToken = req.headers?.authorization;
    if (!bearerToken) {
        return res.status(401).send({message: 'Forbidden Access'});
    }
    const token = bearerToken.split(' ')[1];
    jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
        if(err){
            return res.status(403).send({message: 'Unauthorized Access'});
        }
        req.decoded = decoded;
        next();
    })
}

const uri = `mongodb+srv://${process.env.DB_USER_NAME}:${process.env.DB_USER_PASSWORD}@cluster0.cj5piaf.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        const database = client.db('cam-bazar');
        const bookingsCollection = database.collection('bookings');
        const wishlistCollection = database.collection('wishlist');
        // User Manage
        const userCollection = database.collection('user');
        // admin middleware
        const verifyAdmin = async (req, res, next) => {
            const decodedUid = req.decoded.uid;
            const query = { uid: decodedUid };
            const user = await userCollection.findOne(query);

            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }
        // seller middleware
        const verifySeller = async (req, res, next) => {
            const decodedUid = req.decoded.uid;
            const query = { uid: decodedUid };
            const user = await userCollection.findOne(query);

            if (user?.role === 'buyer') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }
        app.post('/user', async (req, res) => {
            const userData = req.body;
            const isAvailUser = await userCollection.findOne({uid: userData.uid});
            if (isAvailUser) {
                return res.send({acknowledged: true, insertedId: isAvailUser._id})
            }
            const result = await userCollection.insertOne(userData)
            res.send(result);
        })
        app.get('/user/role/:id', verifyJwt, async (req, res) => {
            const currentUserUid = req.query.uid;
            console.log(currentUserUid);
            if(req.decoded.uid !== currentUserUid) {
                return res.status(403).send({message: 'Unauthorized Access'});
            }
            const uid = req.params.id;
            const result = await userCollection.findOne({uid});
            res.send({isAdmin: result?.role === 'admin', isSeller: result?.role === 'seller', isVerifiedSeller: result?.isVerified === 'Verified'})
        })
        app.get('/user/:role', verifyJwt, verifyAdmin, async (req, res) => {
            const query = req.query;
            if(req.decoded.uid !== query.uid) {
                return res.status(403).send({message: 'Unauthorized Access'});
            }
            const role = req.params.role;
            const cursor = await userCollection.find({role}).toArray();
            res.send(cursor)
        })
        app.delete('/user/:id', verifyJwt, verifyAdmin, async (req, res) => {
            const query = req.query;
            if(req.decoded.uid !== query.uid) {
                return res.status(403).send({message: 'Unauthorized Access'});
            }
            const uid = req.params.id;
            const result = await userCollection.deleteOne({uid});
            res.send(result);
        })
        app.put('/user/verify/:id', verifyJwt, verifyAdmin, async (req, res) => {
            const query = req.query;
            if(req.decoded.uid !== query.uid) {
                return res.status(403).send({message: 'Unauthorized Access'});
            };
            const data = req.body;
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    ...data,
                }
            }
            const result = await userCollection.updateOne({uid: req.params.id}, updatedDoc, options);
            res.send(result);
        })
        // jwt
        app.post('/jwt', async (req, res) => {
            const uid = req.body;
            const isAvail = await userCollection.findOne(uid);
            if (!isAvail) {
                return res.status(403).send({message: 'Unauthorized Access'})
            }
            const token = jwt.sign(uid, process.env.SECRET_KEY, {expiresIn: '1d'});
            res.send({token});
        })
        // categories collection api
        const categoryCollection = database.collection('categories');
        app.get('/categories', async (req, res) => {
            const query = {};
            const cursor = await categoryCollection.find(query).toArray();
            res.send(cursor);
        })
        // product collection api
        const productsCollection = database.collection('products')
        app.post('/products', verifyJwt, async (req, res) => {
            const query = req.query;
            if(req.decoded.uid !== query.uid) {
                return res.status(403).send({message: 'Unauthorized Access'});
            }
            const productInfo = req.body;
            productInfo.date = new Date();
            const result = await productsCollection.insertOne(productInfo);
            res.send(result);
        });
        app.get('/products', async (req, res) => {
            const query = req.query;
            query.status = 'unsold';
            const cursor = await productsCollection.find(query, {"sort" : [['date', -1]]}).toArray();
            res.send(cursor);
        });
        app.get('/products/:uid', verifyJwt, verifySeller, async(req, res) => {
            const query = { uid: req.params.uid };
            if(req.decoded.uid !== query.uid) {
                return res.status(403).send({message: 'Unauthorized Access'});
            }
            const cursor = await productsCollection.find(query, {"sort" : [['date', -1]]}).toArray();
            res.send(cursor);
        })
        app.delete('/products/:id', verifyJwt, verifySeller, async (req, res) => {
            const query = req.query;
            if(req.decoded.uid !== query.uid) {
                return res.status(403).send({message: 'Unauthorized Access'});
            }
            const id = req.params.id;
            const result = await productsCollection.deleteOne({_id: ObjectId(id)})
            res.send(result);
        });
        app.put('/products/:id', verifyJwt, async (req, res) => {
            const query = req.query;
            if(req.decoded.uid !== query.uid) {
                return res.status(403).send({message: 'Unauthorized Access'});
            }
            const data = req.body;
            const id = req.params.id;
            const filter = {_id: ObjectId(id)};
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    ...data
                },
            };
            const result = await productsCollection.updateOne(filter, updateDoc, options);
            res.send(result);
        })
        app.get('/productdetails/:id', verifyJwt, async (req, res) => {
            const query = { _id: ObjectId(req.params.id) };
            query.status = 'unsold';
            const result = await productsCollection.findOne(query);
            res.send(result);
        })
        // Bookings
        app.get('/buyer-bookings/:uid', verifyJwt, async (req, res) => {
            const query = req.params.uid;
            if(req.decoded.uid !== query) {
                return res.status(403).send({message: 'Unauthorized Access'});
            };
            const cursor = await bookingsCollection.find({ buyerUid: query, $or: [{status: 'Requested'}, {status: 'Accepted'}] }, {"sort" : [['date', -1]]}).toArray();
            res.send(cursor);
        })
        app.get('/bookings-history/:uid', verifyJwt, async (req, res) => {
            const query = req.params.uid;
            if(req.decoded.uid !== query) {
                return res.status(403).send({message: 'Unauthorized Access'});
            };
            const cursor = await bookingsCollection.find({ buyerUid: query, $or: [{status: 'Canceled'}, {status: 'Paid'}] }, {"sort" : [['date', -1]]}).toArray();
            res.send(cursor);
        })
        app.get('/seller-bookings/:uid', verifyJwt, verifySeller, async (req, res) => {
            const query = req.params.uid;
            if(req.decoded.uid !== query) {
                return res.status(403).send({message: 'Unauthorized Access'});
            };
            const cursor = await bookingsCollection.find({ sellerUid: query }, {"sort" : [['date', -1]]}).toArray();
            res.send(cursor);
        })
        app.get('/bookings/:id/:uid', verifyJwt, async (req, res) => {
            const uid = req.params.uid;
            if(req.decoded.uid !== uid) {
                return res.status(403).send({message: 'Unauthorized Access'});
            }
            const result = await bookingsCollection.findOne({buyerUid: uid, status: 'Accepted', _id: ObjectId(req.params.id)})
            res.send(result);
        })
        app.post('/bookings', verifyJwt, async (req, res) => {
            const query = req.query;
            if(req.decoded.uid !== query.uid) {
                return res.status(403).send({message: 'Unauthorized Access'});
            }
            const bookingInfo = req.body;
            bookingInfo.date = new Date();
            const result = await bookingsCollection.insertOne(bookingInfo);
            res.send(result);
        })
        app.delete('/bookings/:id/:uid', verifyJwt, async (req, res) => {
            const uid = req.params.uid;
            if(req.decoded.uid !== uid) {
                return res.status(403).send({message: 'Unauthorized Access'});
            }
            const bookingQuery = { productId: req.params.id, buyerUid: uid };
            const result = await bookingsCollection.deleteOne(bookingQuery);
            res.send(result);
        })
        app.get('/isBooked/:id/:uid', verifyJwt, async (req, res) => {
            const bookingQuery = {productId: req.params.id, buyerUid: req.params.uid};
            const isBooked = await bookingsCollection.findOne(bookingQuery);
            res.send({isBooked: isBooked ? true : false})
        })
        app.put('/booking/:id/:uid', verifyJwt, verifySeller, async (req, res) => {
            const { uid } = req.query;
            if(req.decoded.uid !== uid) {
                return res.status(403).send({message: 'Unauthorized Access'});
            }
            const productId = req.params.id;
            const buyerUid = req.params.uid;
            const updateAllDoc = {
                $set: {
                  status: `Canceled`,
                },
            };
            const updateBooking = await bookingsCollection.updateMany({productId}, updateAllDoc);
            const productItemDoc = {
                $set: {
                    status: `booked`,
                  },
            }
            const productUpdate = await productsCollection.updateOne({_id: ObjectId(productId)}, productItemDoc);
            console.log(buyerUid)
            const updateApprovedDoc = {
                $set: {
                  status: `Accepted`,
                },
            };
            const result = await bookingsCollection.updateOne({productId, buyerUid}, updateApprovedDoc);
            console.log(result);
            res.send(result);
        })
        // wishlisting
        app.post('/wishlist', verifyJwt, async (req, res) => {
            const query = req.query;
            if(req.decoded.uid !== query.uid) {
                return res.status(403).send({message: 'Unauthorized Access'});
            }
            const wishlistInfo = req.body;
            wishlistInfo.date = new Date();
            const result = await wishlistCollection.insertOne(wishlistInfo);
            res.send(result);
        })
        app.delete('/wishlist/:id/:uid', verifyJwt, async (req, res) => {
            const uid = req.params.uid;
            if(req.decoded.uid !== uid) {
                return res.status(403).send({message: 'Unauthorized Access'});
            }
            const wishlistQuery = { productId: req.params.id, buyerUid: uid };
            const result = await wishlistCollection.deleteOne(wishlistQuery);
            res.send(result);
        })
        app.get('/wishlist/:uid', verifyJwt, async (req, res) => {
            const uid = req.params.uid;
            const result = await wishlistCollection.find({buyerUid: uid}, {"sort" : [['date', -1]]}).toArray();
            res.send(result);
        })
        app.get('/isWishlisted/:id/:uid', verifyJwt, async (req, res) => {
            const wishlistQuery = {productId: req.params.id, buyerUid: req.params.uid};
            const isWishlisted = await wishlistCollection.findOne(wishlistQuery);
            res.send({isWishlisted: isWishlisted ? true : false})
        })
        // payment Api
        const paymentCollection = database.collection('payments');
        app.post('/createpaymentintent', verifyJwt, async (req, res) => {
            const booking = req.body;
            const price = booking.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount,
                currency: "usd",
                "payment_method_types": [
                    "card"
                ],
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })
        app.post('/payments', verifyJwt, async (req, res) => {
            const payment = req.body;
            const paymentResult = await paymentCollection.insertOne(payment);
            const bookingId = payment.bookingId;
            const updatedBookingDoc = {
                $set: {
                    status: 'Paid',
                    transactionId: payment.transactionId
                }
            }
            const bookingPaymentStatus = await bookingsCollection.updateOne({_id: ObjectId(bookingId)}, updatedBookingDoc);
            const productId = payment.productId;
            const updatedProductDoc = {
                $set: {
                    status: 'sold',
                }
            }
            const productStatus = await productsCollection.updateOne({_id: ObjectId(productId)}, updatedProductDoc);
            res.send(paymentResult);
        })
    } catch(err) {
        console.log(err.stack)
    }
}

run().catch(err => console.log(err))

app.get('/', (req, res) => {
    res.send('Cam Bazar server is running')
})

app.listen(Port, () => {
    console.log(`Server is running on port:${Port}`);
})