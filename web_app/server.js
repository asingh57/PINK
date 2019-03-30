var cookieSession = require('cookie-session')

var https = require('https');
const fs = require('fs');
const express = require('express');
var mariadb = require('mariadb');
const bodyParser = require("body-parser");
var multer = require('multer');
const assert = require('assert')
const Locker = require('node-etcd-lock')
var Etcd = require('node-etcd');
const config = JSON.parse(fs.readFileSync(__dirname +'/config.json'));//config stored outside repo for security reasons
var etcd = new Etcd(config.etcd_addresses);
var upload = multer();
const app = express();
app.set('trust proxy', 1) // trust first proxy


var cookieSession = require('cookie-session')
app.use(cookieSession({
  name: 'session',
  keys: config.secrets,

  // Cookie Options
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
}))


app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(upload.array()); 

const ssl_details = {//load ssl files
  ca: fs.readFileSync(__dirname + config.ca_ssl),//replace with your ssl key and location
  key: fs.readFileSync(__dirname + config.key_ssl),
  cert: fs.readFileSync(__dirname + config.crt_ssl)
};

const httpsServer = https.createServer(ssl_details, app);//setup https

httpsServer.listen(config.port, () => {
	console.log('HTTPS Server running on port '+config.port);
});

/*
const serverCert = [fs.readFileSync(config.db_ssl_cert, "utf8")];// load the custom created server cert for mariadb

var pool= mariadb
 .createPool({
   host: database_config.host, 
   ssl: {
	 ca: serverCert
   }, 
   user: database_config.user, 
   password:database_config.password, 
   database:database_config.name,
   connectionLimit: 5
 })
*/


app.get('/', (req, res) => {
    res.send("Web server running");
});



app.get('/get_user_active_jobs', (req, res) => {
    res.send("Your jobs running:");
    
});

function login(req){// implement login here
  console.log("body", req.body);
  if(req.body.user && req.body.password && req.body.password=="abc" && req.body.password=="abc"){
    req.session.user=req.body.user;
    req.session.save();
    return true;
  }
  return false;
}





app.post('/login_cli', (req, res) => {
  
  if(login(req)){
    res.send("You have logged in\n");    
  }
  else{ 
    res.send("The credentials you entered are not valid\n"+req.body.user);  
  }

});

app.post('/upload_job', upload.single('docker_image'), (req, res) => {
  if(req.session.user){
    //multer handle
    res.send("You are logged in\n"); 
  }
  else{
    res.send("You are not logged in\n"); 
  }
  
  
});






/*
req.session.destroy(function(err) {
  // cannot access session here
})
*/
/*
req.session.reload(function(err) {
  // session updated
})
*/
/*
req.session.save(function(err) {
  // session saved
})
*/


