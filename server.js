const express = require('express');
const app = express();
const bodyParser = require('body-parser');

const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true });
const Schema = mongoose.Schema;
const UserSchema = new Schema({
    username: {
            type: String,
            required: true
          },
    exercises: [{ description: String, duration: Number, date: String }]
  });
const UserBase = mongoose.model("UserBase", UserSchema);
mongoose.connection.on('error', console.error.bind(console, 'connection error:'));

app.use(bodyParser.urlencoded({extended: false}))

app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});


function addAndSaveUser(username, res) {
  const AddUser = new UserBase ({ username: username });
    AddUser.save(function (err, data) {
    if (err) return console.error(err);
    res.json({"username": username,"_id": data["_id"]}); 
  });
};

function POSTNewUser(req, res) {
  if(req.body.username === "") {
  res.send("Path `username` is required.");   
  }
  const testUsername = /^(\w){1,15}$/gm.exec(req.body.username);
  if(testUsername === null) {
     return res.json({"error":"invalid username"});
  } 
  const username = /^(\w){1,15}$/gm.exec(req.body.username)[0];
  UserBase.findOne({"username": username }, function (err, data) {
          if (err) return console.error(err);
          if(!data) {
            addAndSaveUser(username, res);
          }
          if(data) {
            res.send("username already taken");
          }
       });
};

function POSTAddExercises(req, res) {

  if(req.body.date === "") {
    req.body.date = new Date().toDateString();
  }
  if(new Date(req.body.date).toDateString() == "Invalid Date") {
    return res.send('Cast to Date failed for value "'+req.body.date+'" at path "date"')
  }
  if(Number.isNaN(Number(req.body.duration))) {
    return res.send('Cast to Number failed for value "'+req.body.duration+'" at path "duration"')
  }
  if(req.body.userId === "" || req.body.description === "" || req.body.duration === "" ) {
    req.body.userId === "" ? res.send("Path `userId` is required.") : req.body.description === "" ? res.send("Path `description` is required.") : res.send("Path `duration` is required.")
  } else
  UserBase.findById(req.body.userId, (err, data)=>{
    if (err) {
      res.send("unknown _id");
      return console.error(err);
    }
    if(!data) {
            return res.json({"error":"invalid userID"});
          }
    if(data) {
      data.exercises.push({ description: req.body.description, duration: Number(req.body.duration), date: new Date(req.body.date).toDateString() });
      data.save(function (err, data) {
        if (err) return console.error(err);
        res.json({"username": data.username, description: req.body.description, duration: Number(req.body.duration), "_id": data["_id"], date: new Date(req.body.date).toDateString() }); 
      });
    };
  });

};
function GETExercise(req, res) {

  const userId = req.query.userId;
  const from = req.query.from;
  const to = req.query.to;
  const limit = req.query.limit == 0 ? undefined : req.query.limit;

  const FindUserId = UserBase.findById(userId);
  FindUserId.select("-exercises._id").exec((err, data)=>{
    if (err) {
      res.send("unknown userId");
      return console.error(err);
    }
    if(!data) {
            return res.json({"error":"invalid userID"});
          }
    if(data) {
      const resObject = {"_id": data["_id"], "username": data.username};
      let arrExercises = data.exercises;
      if(from !== undefined) {
        resObject.from = new Date(from).toDateString();
        arrExercises = arrExercises.filter((el)=>{
            return new Date(el.date).getTime() > new Date(from).getTime(); 
        });
      };
      if(to !== undefined) {
        resObject.to = new Date(to).toDateString();
        arrExercises = arrExercises.filter((el)=>{
            return new Date(el.date).getTime() < new Date(to).getTime(); 
        });
      };
      arrExercises.sort(function (a, b) { return new Date(a.date).getTime() - new Date(b.date).getTime(); });
      if(limit !== undefined && limit < arrExercises.length) {
         const length = arrExercises.length;
        arrExercises.splice(arrExercises.length-(arrExercises.length-limit));
      }
      resObject.count = arrExercises.length;
      resObject.log = arrExercises;
      return res.send(resObject);
    }
  });
}

app.route("/api/exercise/new-user").post(POSTNewUser);
app.route("/api/exercise/add").post(POSTAddExercises);
app.route("/api/exercise/log").get(GETExercise);



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
