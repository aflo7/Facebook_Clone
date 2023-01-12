var express = require("express")
var path = require("path")
var cookieParser = require("cookie-parser")
var mongoose = require("mongoose")
var path = require("path")
var session = require("express-session")
const MemoryStore = require("memorystore")(session)
var bodyParser = require("body-parser")
var { User } = require("./models/schema.js")
var passport = require("passport")
var LocalStrategy = require("passport-local").Strategy
var FacebookStrategy = require("passport-facebook")
var request = require("supertest")
const { faker } = require("@faker-js/faker")

require("dotenv").config()

let livereload = null
let connectLiveReload = null
let liveReloadServer = null
if (process.env.NODE_ENV === "dev") {
  livereload = require("livereload")
  connectLiveReload = require("connect-livereload")
  liveReloadServer = livereload.createServer()
  liveReloadServer.server.once("connection", () => {
    setTimeout(() => {
      liveReloadServer.refresh("/")
    }, 100)
  })
}

var indexRouter = require("./routes/index")
var usersRouter = require("./routes/users")
var postsRouter = require("./routes/posts")
var authRouter = require("./routes/auth")
var imageRouter = require("./routes/image")

mongoose.set("strictQuery", false)
// Set up default mongoose connection
const mongoDB = process.env.MONGO_URI
mongoose.connect(mongoDB, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
const db = mongoose.connection
db.on("error", console.error.bind(console, "MongoDB connection error:"))

var app = express()

if (process.env.NODE_ENV === "dev") {
  app.use(connectLiveReload())
}
// view engine setup
app.set("views", path.join(__dirname, "views"))
app.set("view engine", "ejs")

app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())
app.use(express.static(path.join(__dirname, "public")))

app.use(
  session({
    cookie: { maxAge: 86400000 },
    store: new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    }),
    resave: false,
    secret: process.env.SESSION_SECRET,
    saveUninitialized: true
  })
)
app.use(bodyParser.json())
app.use(function (req, res, next) {
  if (!req.user)
    res.header("Cache-Control", "private, no-cache, no-store, must-revalidate")
  next()
})

passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.CLIENTID,
      clientSecret: process.env.CLIENTSECRET,
      callbackURL:
        process.env.NODE_ENV === "dev"
          ? "http://localhost:4000/auth/facebook/callback"
          : "https://app4.memberssonly.xyz/auth/facebook/callback",

      profileFields: ["id", "displayName", "photos"]
    },
    function (accessToken, refreshToken, profile, cb) {
      // see if the user exists in the database...
      User.find({ facebookId: profile.id }, function (err, foundUser) {
        if (err) return res.render("error")
        if (foundUser.length !== 0) return cb(null, foundUser[0])

        // at this point, we determined that the user doesnt exist, proceed to create a new User.
        const newFacebookUser = new User({
          creationDate: new Date(),
          username: "",
          password: "",
          following: [],
          settings: { darkMode: false },
          name: profile.displayName,
          isFacebookUser: true,
          facebookId: profile.id,
          pfpUrl: profile.photos[0].value
        })

        newFacebookUser.save(function (err, newlyCreatedUser) {
          if (err) return res.render("error")
          return cb(null, newlyCreatedUser)
        })
      })
    }
  )
)

passport.use(
  new LocalStrategy((username, password, done) => {
    User.findOne({ username }, function (err, foundUser) {
      if (err) {
        console.log(err)
        return res.render("error")
      }

      if (foundUser) {
        if (password == foundUser.password) {
          return done(null, foundUser)
        }
        return done(null, false, { message: "Incorrect password" })
      }

      return done(null, false, { message: "Incorrect username" })
    })
  })
)

passport.serializeUser(function (user, done) {
  done(null, user._id)
})

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, foundUser) {
    if (err) {
      return done("error deserializing", false)
    }
    if (foundUser) {
      return done(null, foundUser)
    } else {
      return done("error deserializing", false)
    }
  })
})

app.use(passport.initialize())
app.use(passport.session())

app.use(function (req, res, next) {
  res.locals.currentUser = req.user
  next()
})

app.use("/", indexRouter)
app.use("/users", usersRouter)
app.use("/posts", postsRouter)
app.use("/auth", authRouter)
app.use("/image", imageRouter)

describe("login, register, upload image tests", function () {
  afterAll(async () => {
    await db.close()
  })

  test("login", (done) => {
    request(app)
      .post("/log-in")
      .type("form")
      .send({ username: "sam", password: "pass" })
      .expect(302)
      .expect("Location", "/home")
      .end(done)
  })

  test("register", (done) => {
    request(app)
      .post("/register")
      .type("form")
      .send({
        username: faker.internet.userName(),
        password: "pass",
        name: faker.name.fullName()
      })
      .expect(200)
      .end(done)
  })

  // confirm the image upload functionality
  // start with a normal user that has no profile photo
})