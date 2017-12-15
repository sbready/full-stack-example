require('dotenv').config()
const express = require('express')
    , bodyParser = require('body-parser')
    , cors = require('cors')
    , session = require('express-session')
    , passport = require('passport')
    , Auth0Strategy = require('passport-auth0')
    , massive = require('massive')

const app = express()

app.use(cors())
app.use(bodyParser.json())

massive(process.env.DB_CONNECTION).then( db => {
    app.set( 'db', db )
})

app.use( session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 50000
    }
}))

app.use(express.static(__dirname+ '/../build'))

app.use(passport.initialize())
app.use(passport.session())

passport.use( new Auth0Strategy({
    //create auth client and put in .env

    domain: process.env.AUTH_DOMAIN,
    clientID: process.env.AUTH_CLIENT_ID,
    clientSecret: process.env.AUTH_CLIENT_SECRET,
    callbackURL: process.env.AUTH_CALLBACK
}, function(accessToken, refreshToken, extraParams, profile, done){
    // console.log(profile)
    const db = app.get('db')
    let userData = profile._json,
    auth_id = userData.user_id.split('|')[1]
    console.log(userData);
    /*
        1: user_name? user.name
        2: email? user.email
        3: img? user.picture
        4: auth_id? user.user_id.split('|')[1]
    */
    db.find_user([auth_id]).then( user => {
        if ( user[0] ) {
            return done(null, user[0].id)
        } else {
            db.create_user([userData.name, userData.email, userData.picture, auth_id])
                .then( user => {
                    return done(null, user[0].id)
                 })
        }
    })

}))

app.get('/auth', passport.authenticate('auth0'))
app.get('/auth/callback', passport.authenticate('auth0', {
    successRedirect: process.env.AUTH_PRIVATE_REDIRECT,
    failureRedirect: process.env.AUTH_LANDING_REDIRECT
}))

passport.serializeUser(function( ID, done ){
    done(null, ID)
})

passport.deserializeUser(function( ID, done ){
    const db = app.get('db')
    db.find_user_by_session([ID]).then ( user => {
        done(null, user[0])
    })
})

app.get('/auth/me', function( req, res, next ){
    if ( !req.user ){
        res.status(401).send('LOG IN REQUIRED')
    } else {
        res.status(200).send(req.user)
    }
})

app.get('/auth/logout', function( req, res, next ){
    req.logout()
    res.redirect(process.env.AUTH_LANDING_REDIRECT)
})

app.listen(process.env.SERVER_PORT, () => {
    console.log(`╭∩╮（︶︿︶）╭∩╮: ${process.env.SERVER_PORT}`)
})


