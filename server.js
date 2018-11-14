const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track' )

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

/********************* SCHEMA SETUP ***************************/

var exerciseSchema = new mongoose.Schema({
  'description': {'type': String, 'required': false},
  'duration': {'type': String, 'required': true},
  'date': {'type': Date, 'required': true}
});

var userSchema = new mongoose.Schema({
  'username': {'type': String, 'required': true},
  'exercises': [exerciseSchema]
});


var User = mongoose.model('User', userSchema);
var Exercise = mongoose.model('Excercise', exerciseSchema);

/********************* HELPER FNs *****************************/
var addUser = (data, done) => {
  var user = new User(data)
  user.save((err, data) => {
    if (err) return done(err)
    
    return done(null, data)
  })
};


/********************* ROUTES ********************************/

// New user
app.post('/api/exercise/new-user', (req, res) => {
  addUser({'username': req.body.username}, (err, data) => {
    if (err) return res.json({error: 'Something went wrong', 'debug': err});
    
    res.json({_id: data._id, username: data.username});
  });
});

// List users
app.get('/api/exercise/users', (req, res) => {

  User.find({}, {_id: 1, username: 1}, function(err, users) {
    if (err) return res.json({error: 'There was an error', 'debug': err})
    
    res.json(users);
  })  
  
});

// New exercise
app.post('/api/exercise/add', (req, res) => {        
      
    var ex = {
          'description': req.body.description,
          'duration': req.body.duration,
          'date': '' !== req.body.date ? new Date(req.body.date) : new Date()
    };
  
    User.findByIdAndUpdate(req.body.userId, {$push: {exercises: ex}}, {new: true})
      .select('username  exercises.description exercises.duration exercises.date')
      .exec((err, data) => {
          if (err) return res.json({error: 'Error', 'debug': err});

          // Return user and exercise fields
          res.json(data);
      }
    );
});

// Exercise logs
app.get('/api/exercise/log', (req, res) => {
    
  // TODO: Check for required params
  if (!req.query.hasOwnProperty('userId')) {
    res.status(400).json({error: '{userId} required!'});
    return;
  }

  var q = User.find({'_id': req.query.userId}, {username: 1, exercises: 1})
  
  // [from] 
  if (req.query.hasOwnProperty('from') ) q = q.where('exercises.date').gt(new Date(req.query.from))
  
  // [to]
  if (req.query.hasOwnProperty('to') ) q = q.where('exercises.date').lt(new Date(req.query.to))
  
  // [limit]
  if (req.query.hasOwnProperty('limit') ) q = q.limit(parseInt(req.query.limit))
  
  
  q.select('username  exercises.description exercises.duration exercises.date').exec(function(err, data) {
      if (err) return res.json({error: 'There was an error', 'debug': err})
    
      res.json(data.map((u) => { return { _id: u._id, username: u.username, count: u.exercises.length, log: u.exercises } }))
  })  
  
});




// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
