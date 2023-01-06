var express = require("express")
var router = express.Router()
var {
  isAuthenticated,
  getUsersNotFollowing
} = require("../scripts/customMiddleware.js")
var { User, Post, Comment } = require("../models/schema.js")

router.post("/follow", isAuthenticated, (req, res) => {
  if (!req.user._id) {
    return res.sendStatus(400)
  }
  User.findById(req.user._id, (err, foundUser) => {
    if (err) return res.sendStatus(400)

    foundUser.following.push(req.body.userIdToFollow)
    foundUser.save(function (err, result) {
      if (err) {
        return res.sendStatus(400)
      } else {
        return res.sendStatus(200)
      }
    })
  })
})

router.get(
  "/find-friends",
  isAuthenticated,
  getUsersNotFollowing,
  (req, res, next) => {
    // get a list of users currently following
    User.findById(req.user._id)
      .populate("following")
      .exec((err, foundUser) => {
        if (err) return res.redirect("/")

        if (!foundUser.following || foundUser.following.length === 0) {
          res.locals.currentFriendNames = []
          return res.render("find-friends")

        }

        const namesOfPeopleYouAreFollowing = foundUser.following.map(
          (person) => person.name
        )
        res.locals.currentFriendNames = namesOfPeopleYouAreFollowing
        return res.render("find-friends")
      })
  }
)

module.exports = router
