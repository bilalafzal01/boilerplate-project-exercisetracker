const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const moment = require("moment");
const cors = require("cors");

const mongoose = require("mongoose");
mongoose.connect(process.env.MONGO_URI, {
  useUnifiedTopology: true,
  useNewUrlParser: true
});

app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

// Not found middleware
app.use((req, res, next) => {
  return next({ status: 404, message: "not found" });
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;

  if (err.errors) {
    // mongoose validation error
    errCode = 400; // bad request
    const keys = Object.keys(err.errors);
    // report the first validation error
    errMessage = err.errors[keys[0]].message;
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || "Internal Server Error";
  }
  res
    .status(errCode)
    .type("txt")
    .send(errMessage);
});

// schema setup
const Schema = mongoose.Schema;
const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      maxlength: [20, "Username is too long"]
    },
    exercise: [
      {
        _id: false,
        description: String,
        duration: Number,
        date: {}
      }
    ]
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

// end APIs
app.post("/api/exercise/new-user", (req, res, next) => {
  const newUsername = req.body.username;
  const data = new User({
    username: newUsername
  });

  data.save((err, data) => {
    if (err) {
      if (err.code == 11000) {
        // uniqueness error (no custom message)
        return next({
          status: 400,
          message: "This username is already taken."
        });
      } else {
        return next(err);
      }
    }

    res.send({
      username: newUsername,
      id: data._id
    });
  });
});

const handleDate = date => {
  if (!date) {
    return moment().format("YYYY-MM-DD");
  } else if (!moment(date, "YYYY-MM-DD").isValid()) {
    return moment().format("YYYY-MM-DD");
  } else {
    return date;
  }
};

app.get("/api/exercise/users", (req, res, next) => {
  User.find({}, (err, data) => {
    if (err) {
      res.send("Error reading the database.");
      console.log(err);
    } else {
      let nameAndId = data.map(user => {
        return { username: user.username, id: user._id };
      });
      res.send(nameAndId);
      console.log(data);
    }
  });
});

app.post("/api/exercise/add", (req, res, next) => {
  let userId = req.body.userId;
  let exercise = {
    description: req.body.description,
    duration: req.body.duration,
    date: handleDate(req.body.date)
  };

  User.findOneAndUpdate(
    { _id: userId },
    { $push: { exercise: exercise } },
    function(err, data) {
      if (err) return console.log(err);
      console.log(data);
    }
  );

  User.findById(userId, (err, data) => {
    if (!data) {
      res.send({ error: "A user not found" });
      console.log(err);
    } else {
      console.log(data);
      data.save((err, data) => {
        if (err) return next(err);
        console.log(err);
        res.send({
          username: data.username,
          exercise: data.exercise
        });
      });
    }
  });
});

app.get("/api/exercise/log", (req, res, next) => {
  let userId = req.query.userId;
  let queries = {
    from: req.query.from,
    to: req.query.to,
    limit: req.query.limit
  };

  // find the correct user by ID
  // handle all possible variations of provided/not provided optional parameters from and to
  User.findById(userId, (error, user) => {
    if (!user) {
      res.send({ Error: "User not found." });
    } else {
      let results = user.exercise;

      if (queries.from && queries.to) {
        results = results.filter(
          exercise =>
            exercise.date >= queries.from && exercise.date <= queries.to
        );
      } else if (queries.from) {
        results = results.filter(exercise => exercise.date >= queries.from);
      } else if (queries.to) {
        results = results.filter(exercise => exercise.date <= queries.to);
      }

      if (results.length > queries.limit) {
        results = results.slice(0, queries.limit);
      }

      res.send({
        username: user.username,
        totalExercise: results.length,
        exercise: results
      });
    }
  });
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
