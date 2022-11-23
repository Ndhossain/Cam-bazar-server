const express = require('express');
const cors = require('cors');
const jwt =require('jsonwebtoken');
require('dotenv').config();

const app = express();

const Port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json())

app.listen(Port, () => {
    console.log(`Server is running on port:${Port}`);
})