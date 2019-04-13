var cookieSession = require('cookie-session')

var https = require('https');
const fs = require('fs');
const express = require('express');
var mariadb = require('mariadb');
const bodyParser = require("body-parser");
var multer = require('multer');
const assert = require('assert')
var Etcd = require('node-etcd');
var curl = require("etcd-lock");
var os = require("os");
const config = JSON.parse(fs.readFileSync(__dirname +'/config.json'));//config stored outside repo for security reasons
var etcd = new Etcd(config.etcd_addresses);
//var sftpStorage = require('multer-sftp');

const statuscodes={
  "uploaded_to_web_server":0,
  "uploaded_to_processing_server":1
}

const app = express();
app.set('trust proxy', 1) // trust first proxy


var cookieSession = require('cookie-session')
app.use(cookieSession({
  name: 'session',
  keys: config.secrets,

  // Cookie Options
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
}))
/*
var storage = sftpStorage({
  sftp: {
    host: config.upload_ip,
    port: config.upload_port,
    username: config.upload_user
  },
  destination: function (req, file, cb) {
    cb(null, '/uploads')
  },
  filename: function (req, file, cb) {
    cb(null, req.session.user + '-' + Date.now())
  }
})*/

var storage = multer.diskStorage({ //multers disk storage settings
      destination: function (req, file, cb) {
         cb(null, __dirname +'/upload');
      },
      filename: function (req, file, cb) {
          var filename=req.session.user + '-' + Date.now();
          
          cb(null, filename);
      } 
});


var upload = multer(
{
  fileFilter: function (req, file, cb) {
       if (!req.session.user) {
               return cb(new Error('you are not authorised to upload'));
        }

       cb(null, true); 
     },
  storage: storage 
  }
)



app.use(bodyParser.urlencoded({
    extended: true
}));

const ssl_details = {//load ssl files
  ca: fs.readFileSync(__dirname + config.ca_ssl),//replace with your ssl key and location
  key: fs.readFileSync(__dirname + config.key_ssl),
  cert: fs.readFileSync(__dirname + config.crt_ssl)
};

const httpsServer = https.createServer(ssl_details, app);//setup https

httpsServer.listen(config.port, config.listen_address ,() => {
	console.log('HTTPS Server running on '+ config.listen_address +' at port '+config.port);
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
    res.send(`
    <html>
    <body>
    Login<br>
    </br>
    <form action="/login" method="post">
    Username:<input type="text" name="user"></input><br> 
    Password:<input type="password" name="password"> </input>
    <button type="submit">Login</button >
    </button>
    </body>
    </html>
    `);
});




app.get('/get_user_active_jobs', (req, res) => {
    res.send("Your jobs running:");
    
});

function login(req){// implement login here
  console.log("body", req.body);
  if(req.session.user || (req.body.user && req.body.password && req.body.password=="abc" && req.body.password=="abc")){
    req.session.user=req.body.user;
    req.session.save();
    return true;
  }
  return false;
}


app.post('/login', (req, res) => {
  
  if(login(req)){
    res.send(`
    <html>
    <body>
    Login<br>
    </br>
    <form action="/upload_job" method="post" enctype="multipart/form-data">
    <input type="file" name="docker_image">
    <button type="submit">Upload</button >
    </button>
    </body>
    </html>
    
    `);    
  }
  else{ 
    res.redirect("/");  
  }

});



app.post('/login_cli', (req, res) => {
  
  if(login(req)){
    res.send("You have logged in\n");    
  }
  else{ 
    res.send("The credentials you entered are not valid\n"+req.body.user);  
  }

});

function update_key(key,subkey,key_val_list,next){//blocking function to update etcd key
  try{
    
    for (var key_v in key_val_list) {
      etcd.setSync(key+"/"+subkey+"/"+key_v,key_val_list[key_v]);
    }
    next(null);
  }
  catch(err){
    next(err);
  }
    
/*
    try{
      var lock = new Lock(etcd, key, config.listen_address, 2);
      lock.lock().then(() => { // lock is now locked, 
        var val= etcd.getSync(key);
        if(!val.body.node.value){
          etcd.setSync(key,{subkey:key_val_list});
        }
        else{
          var current_var=val.body.node.value;
          for (var key_v in key_val_list) {
              if (key_val_list.hasOwnProperty(key_v)) {
                current_var[key][subkey]=key_val_list[key_v];
              }
          }
          
        }
        
        return lock.unlock();
      }).then(() => {
        
        next(null);
      });
    }
    catch(err){
      
      console.log("error at update key"+err);
      next(err);
    }
    */
    
}
  



app.post('/upload_job', upload.single('docker_image'), (req, res) => {
  if(req.session.user && req.file){
    //multer handle
    var filename=req.file.filename;
    var status_value={status:statuscodes.uploaded_to_web_server, web_server_address:httpsServer.address().address};
    
    update_key(req.session.user,filename,status_value,
      function(err){
        if(!err){
           res.send("Upload succeeded, file is being read by server\n"); 
        }
        else{
          console.log("error before res send: "+err);
          res.send("Update failed due to etcd error\n"); 
        }
      }
    );
  }
  else if(req.session.user){
    res.send("Error: Not a valid file\n");
  }
  else{
    res.send("Error: You are not logged in\n"); 
  }
});

var spawn = require('child_process').spawn;
spawn('python', ['upload_daemon.py'], {
    detached: false
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


