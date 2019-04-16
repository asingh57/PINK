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
  "uploaded_to_processing_server":1,
  "process_errored":2 ,
  "process_stopped_backend_unavailable":3,
  "process_running":4,
  "process_completed":5
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
         cb(null, __dirname +'/uploads');
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


var machine_list={}
var user_job_list={}

function machine_list_update(){
  etcd.get("/machines", { recursive: true }, function(err,data){
    machine_list=data;
    console.log("updates detected to machines");
  });
}
function user_list_update(){
  etcd.get("/users", { recursive: true }, function(err,data){
    user_job_list=data;
    console.log("updates detected to users");
  
  });
}
machine_list_update();//get one time lists of users and machines
user_list_update();

server_status_watcher = etcd.watcher("/machines", null,  {recursive: true});
server_status_watcher.on("change", machine_list_update);
job_status_watcher = etcd.watcher("/users", null,  {recursive: true});
job_status_watcher.on("change", user_list_update);

function get_server_status_str(){
  return JSON.stringify(machine_list);
}

function get_job_status_str(req){
  return JSON.stringify(user_job_list);
}


app.post('/login', (req, res) => {
  res.redirect('/dashboard')
  
  
})


app.get('/dashboard', (req, res) => {
  
  
  if(login(req)){
    var server_status_str=get_server_status_str();
    var job_status_str=get_job_status_str(req);
    
    res.send(`
    <html>
    <body>
    Jobs<br>
    </br>
    <a href="/uploads_page">Upload a new job</a>
    </br>
    Your jobs:</br>
    <div id="job_status">
    `
    +job_status_str+
    `
    </div>
    </br>
    Server Status:</br>
    <div id="server_status">
    `
    +server_status_str+
    `
    </div>
    </body>
    </html>
    `);   
  }
  else{
    res.redirect("/");  
  }
  
});



app.get('/get_user_active_jobs', (req, res) => {
    res.send("Your jobs running:");
    
});

function login(req){// IMPORTANT implement your own proper Login here
  console.log("body", req.body, req.session);
  if(req.session.user || (req.body.user && req.body.password && req.body.password=="abc" && req.body.password=="abc")){
    if(!req.session.user){
      req.session.user=req.body.user;
    }
    
    req.session.save();
    return true;
  }
  return false;
}


app.get('/uploads_page', (req, res) => {
  
  if(login(req)){
    res.send(`
    <html>
    <body>
    <a href="/dashboard">dashboard</a><br>
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





function update_key(key,key_val_list,next){//blocking function to update etcd key
  try{
    
    for (var key_v in key_val_list) {
      etcd.setSync(key+"/"+key_v,key_val_list[key_v]);
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
    
    update_key("/users/"+req.session.user+"/"+filename,status_value,
      function(err){
        if(!err){
           res.send(`
           <html>
           <body>
           Upload succeeded, file is being read by server. Redirecting...
           </body>
           
           <script>
           setTimeout(function () {
                    window.location ="/dashboard"
            }, 5000);
           </script>
           </html>
           `)
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
var daemon_child=spawn('python', [__dirname + '/' +'upload_daemon.py'], {
      detached: false
});

daemon_child.stdout.on('data', function(data) {
    console.log('upload daemon stdout: ' + data);
});
daemon_child.stderr.on('data', function(data) {
    console.log('upload daemon stderr: ' + data);
});
daemon_child.on('close', function(code) {
    console.log('upload daemon exit code: ' + code);
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


