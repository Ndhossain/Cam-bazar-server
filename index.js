const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const jwt =require('jsonwebtoken');
require('dotenv').config();

const app = express();

const Port = process.env.PORT || 5000;
// middle wares
app.use(cors());
app.use(express.json());
const verfyJwt = (req, res, next) => {
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
        // User Manage
        const userCollection = database.collection('user');
        app.post('/user', async (req, res) => {
            const userData = req.body;
            const isAvailUser = await userCollection.findOne({uid: userData.uid});
            if (isAvailUser) {
                return res.send({acknowledged: true, insertedId: isAvailUser._id})
            }
            const result = await userCollection.insertOne(userData)
            res.send(result);
        })
        app.get('/users', verfyJwt, async (req, res) => {
            const query = req.query;
            if(req.decoded.uid !== query.uid) {
                return res.status(403).send({message: 'Unauthorized Access'});
            }
            const result = await userCollection.findOne(query);
            res.send({isAdmin: result?.role === 'admin', isSeller: result?.role === 'seller'})
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
    } finally {}
}

run().catch(err => console.log(err))

app.get('/', (req, res) => {
    res.send('Cam Bazar server is running')
})

app.listen(Port, () => {
    console.log(`Server is running on port:${Port}`);
})