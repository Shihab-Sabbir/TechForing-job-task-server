const express = require('express');
const cors = require('cors');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');
require('dotenv').config()

app.use(cors());
app.use(express.json());


app.get('/', (req, res) => {
    res.send('hello world');
})

function jwtVerification(req, res, next) {
    const authHeaders = req.headers.authorization;
    if (!authHeaders) {
        return res.status(401).send({ message: 'unauthorized access !' })
    }
    const token = authHeaders.split(' ')[1];
    jwt.verify(token, process.env.SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access !' })
        }
        else {
            req.decoded = decoded;
            next();
        }
    });
}

const uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@testing.wbduv4j.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


async function run() {
    try {
        const jobCollection = client.db('job-task').collection('jobs');
        const userCollection = client.db('job-task').collection('users');
        console.log('mongo db connect');

        app.get('/jwt', async (req, res) => {
            const email = req.headers.email;
            const password = req.headers.password;
            const query = { email: email, password: password };
            const matched = await userCollection.findOne(query);
            if (matched) {
                const token = jwt.sign({ email }, process.env.SECRET, { expiresIn: '1h' });
                res.send({ token });
            }
            else {
                const isExist = await userCollection.findOne({ email: email });
                if (isExist) {
                    return res.status(404).send('email/password incorrect');
                }
                else {
                    return res.status(403).send('user not registered');
                }
            }
        });

        app.get('/job', jwtVerification, async (req, res) => {
            const data = await jobCollection.find({}).toArray();
            res.send(data);
        });

        app.delete('/job', jwtVerification, async (req, res) => {
            const id = req.query.category;
            const jobId = req.query.jobId;
            const query = { _id: ObjectId(id) }
            // const update = await jobCollection.updateOne({}, { $pull: { job: { $elemMatch: { id: jobId } } } })
            const jobs = await jobCollection.findOne(query);
            const restValue = jobs.job.filter(item => item.id != jobId);
            const update = await jobCollection.updateOne(query, { $set: { job: [...restValue] } });
            res.send(update)
        })

        app.put('/edit-job', jwtVerification, async (req, res) => {
            const id = req.query.category;
            const job = req.body;
            const jobId = req.query.jobId;
            const query = { _id: ObjectId(id) }
            const jobs = await jobCollection.findOne(query);
            const restValue = jobs.job.filter(item => item.id != jobId);
            const update = await jobCollection.updateOne(query, { $set: { job: [...restValue, job] } });
            res.send(update)
        })
        app.post('/register', async (req, res) => {
            const user = req.body.userData;
            const query = { email: user.email }
            const isExist = await userCollection.findOne(query);
            if (isExist) {
                return res.send('user already exists');
            }
            else {
                const result = await userCollection.insertOne(user);
                res.send(result);
            }
        })
        app.post('/add-job', jwtVerification, async (req, res) => {
            const job = req.body;
            const query = { category: job.category }
            const isExist = await jobCollection.findOne({ category: job.category });
            if (isExist) {
                const result = await jobCollection.updateOne(query, { $push: { job: job } }, { upsert: true });
                res.send(result);
            }
            else {
                const addCategory = await jobCollection.insertOne({ category: job.category });
                const result = await jobCollection.updateOne(query, { $push: { job: job } }, { upsert: true });
                res.send(result);
            }

        })

    } finally {

    }
}
run().catch(err => console.log(err));

app.listen(port, () => {
    console.log('node is running on ', port);
})
