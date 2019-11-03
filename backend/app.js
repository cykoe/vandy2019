require('dotenv').config();
var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
var logger = require('morgan');
var cors = require('cors');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

app.use(bodyParser({limit: '50mb'}));
app.use(cors());

app.use('/', indexRouter);
app.use('/users', usersRouter);

module.exports = app;
