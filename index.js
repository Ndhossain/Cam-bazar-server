const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const jwt =require('jsonwebtoken');
require('dotenv').config();

const app = express();

const Port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER_NAME}:${process.env.DB_USER_PASSWORD}@cluster0.cj5piaf.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        const database = client.db('cam-bazar');
        // jwt
        app.post('/jwt', (req, res) => {
            const uid = req.body;
            const token = jwt.sign({uid}, process.env.SECRET_KEY, {expiresIn: '1d'});
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