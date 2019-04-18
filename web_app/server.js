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
const { spawnSync} = require('child_process');
var processing_server_download_folder="/completed";
//var sftpStorage = require('multer-sftp');

const job_status_codes={
  "uploaded_to_web_server":0,
  "uploaded_to_processing_server":1,
  "process_errored":2 ,
  "process_stopped_backend_unavailable":3,
  "process_running":4,
  "process_completed":5,
  "deleting_job":6
}
const machine_status_codes={
  "server_available":0,
  "server_unavailable":1
}

const delete_signal_codes={
  "dont_delete":0,
  "delete":1
}


const job_status_code_to_error={}
job_status_code_to_error[job_status_codes.uploaded_to_web_server]={"description":"You job has been uploaded to the web server","color":"yellow"};
job_status_code_to_error[job_status_codes.uploaded_to_processing_server]={"description":"Your job has been queued at the processing server","color":"yellow"};
job_status_code_to_error[job_status_codes.process_errored]={"description":"Your job failed","color":"red"};
job_status_code_to_error[job_status_codes.process_stopped_backend_unavailable]={"description":"The backend server processing your job is currently unavailable","color":"orange"};
job_status_code_to_error[job_status_codes.process_running]={"description":"Your job is currently in progress","color":"green"};
job_status_code_to_error[job_status_codes.process_completed]={"description":"Your job has been completed and is available for download","color":"green"};
job_status_code_to_error[job_status_codes.deleting_job]={"description":"Currently deleting job","color":"red"};


const machine_status_code_to_error={}
machine_status_code_to_error[machine_status_codes.server_available]={"description":"Server is running","color":"green"};
machine_status_code_to_error[machine_status_codes.server_unavailable]={"description":"Server is down","color":"red"};




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
    machine_list=parse_etcd_json(data);
  });
}
function user_list_update(){
  etcd.get("/users", { recursive: true }, function(err,data){
    user_job_list=parse_etcd_json(data);
  });
}
machine_list_update();//get one time lists of users and machines
user_list_update();

server_status_watcher = etcd.watcher("/machines", null,  {recursive: true});
server_status_watcher.on("change", machine_list_update);
job_status_watcher = etcd.watcher("/users", null,  {recursive: true});
job_status_watcher.on("change", user_list_update);

function get_server_status_str(){  
  //return JSON.stringify(machine_list);
  var machine_dup=machine_list
  var to_ret="";
  for(var i=0;i<machine_dup.machines.length;i++){
    var machine=Object.keys(machine_dup.machines[i])[0];
    to_ret+="machine name:";
    to_ret+=machine;
    to_ret+="</br>";
    to_ret+="machine status:";
    to_ret+=machine_status_code_to_error[machine_dup.machines[i][machine].status].description;
    to_ret+="</br>";
    to_ret+="number of slots available:";
    to_ret+=machine_dup.machines[i][machine].upload_spots_available;
    to_ret+="</br>";
  }
  
  return to_ret;
  
}



function get_job_status_str(req){
  //return JSON.stringify(user_job_list);
  var job_dup=user_job_list
  var to_ret="";
  var users=user_job_list["users"];
  if(!users){
    return "";
  }
  
  for(var i=0;i<users.length;i++){
    var user_name=Object.keys(users[i])[0];
    if(user_name!=req.session.user){
      continue;
    }
    var jobs=users[i][user_name];  
    if(!jobs){
        return "";
    }
    for(var j=0;j<jobs.length;j++){
      var job_name=Object.keys(jobs[j])[0];
      to_ret+="Job name:";
      to_ret+=job_name;
      to_ret+="</br>";
      to_ret+="Status:";
      to_ret+=job_status_code_to_error[jobs[j][job_name].status].description;
      if(jobs[j][job_name].status==job_status_codes.process_completed){
        to_ret+="<a href=\"/download?job_id="+job_name+"\" download>Download Output</a>";
      }
      if(jobs[j][job_name].status>=job_status_codes.process_errored){
        to_ret+="<a href=\"/delete?job_id="+job_name+"\">Delete Job</a>"
      }
      to_ret+="</br>";
      to_ret+="Machine where job is processed:";
      to_ret+=jobs[j][job_name].processing_machine_address;
      to_ret+="</br>";      
    }
    break;
  }
  
  return to_ret;
  
}
 
app.get('/download', (req, res) => {
  if(!login(req)){
    res.redirect("/");
    return;   
  }
  //check validity of user
  var usr_recv=req.query.job_id.split("-")[0];
  console.log(etcd.getSync("/users/"+usr_recv+"/"+req.query.job_id+"/status"));
  if(usr_recv!=req.session.user || etcd.getSync("/users/"+usr_recv+"/"+req.query.job_id+"/status").body.node.value!=job_status_codes.process_completed){
    res.redirect("/dashboard");
    return;
  }
  var server_name=etcd.getSync("/users/"+usr_recv+"/"+req.query.job_id+"/processing_machine_address").body.node.value;//get processing server name for this job
  
  var local_dir_name=__dirname + "/processing_server_mounts/"+req.query.job_id;
  
  //mount remote fs
  var dir_create = spawnSync('mkdir', ['-p', local_dir_name]);
  
  var mount_remote_fs = spawnSync(
  'sshfs', 
  [
  '-o', 
  'StrictHostKeychecking=no',
  'root@'+server_name+":"+processing_server_download_folder,
  local_dir_name
  ]
  );
  
  var file_path=local_dir_name+"/"+req.query.job_id+".tar.gz";
  
  //now download 
    res.download(file_path, function(err){
      //unmount and delete
      var umount = spawnSync('umount', [local_dir_name]);
    });
  
  
})

app.get('/delete', (req, res) => {
  if(!login(req)){    
    res.redirect("/");
    return;   
  }
  //check validity of user
  var usr_recv=req.query.job_id.split("-")[0];
  if(usr_recv!=req.session.user){
    res.redirect("/dashboard");
    return;
  }
  //set etcd delete signal
  etcd.set("/users"+"/"+usr_recv+"/"+req.query.job_id+"/delete_signal",delete_signal_codes.delete);
  res.redirect("/dashboard");
}) 


app.post('/login', (req, res) => {
  if(login(req)){
    res.redirect('/dashboard')
  }
  else{
    res.redirect('/')
  }
  
})
/*
if (!Array.prototype.last){//method to get last element of array easily
    Array.prototype.last = function(){
        return this[this.length - 1];
    };
};
*/

function parse_etcd_json(etcd_object){//returns a readable json from etcd values

  if(Array.isArray(etcd_object)){
    var ret={"values":[]};
    for(var x=0; x<len(etcd_object);x++){
      ret.values.push(parse_etcd_json(etcd_object[x]));
    }
    return ret;
  }  
  var key="";
  var value="";
  var keys=Object.keys(etcd_object)
  for(var i=0;i<keys.length;i++){
    var item=keys[i];
    if(item=="key"){
      key=etcd_object[item].split("/");
      key=key[key.length-1];
    }
    else if(item=="value"){
      value=etcd_object[item];
    }
    else if(item=="nodes"){
      if(!etcd_object[item][0].value){
        value=[];
        for(var p=0;p<etcd_object[item].length;p++){
          sub_item=etcd_object[item][p]
          value.push(parse_etcd_json(sub_item));
        }
      }
      else{
        value={};
        for(var p=0;p<etcd_object[item].length;p++){
          sub_item=etcd_object[item][p]
          Object.assign(value,parse_etcd_json(sub_item));
        }
      }
    }
    else if(item=="node"){
      value=parse_etcd_json(etcd_object[item]);
    }
  }
  if(key==""){
    return value;
  }
  var ret_val={};
  ret_val[key]=value;
  return ret_val;
}

app.get('/dashboard', (req, res) => {
  
  
  if(login(req)){
    var server_status_str=get_server_status_str();
    var job_status_str=get_job_status_str(req);
   
    res.send(`
    <html>
    <body>
    <a href="/logout">logout</a><br>
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
  if(req.session.user || (req.body.user && req.body.password && req.body.password=="abc" && req.body.password=="abc")){
    if(!req.session.user){
      req.session.user=req.body.user;
    }
    
    req.session.save();
    return true;
  }
  else{
    return false;
  }
  return false;
}

function logout(req){// IMPORTANT implement your own proper Login here
  delete req.session.user;
  return;
}

app.get('/logout', (req, res) => {
  logout(req);
  res.redirect('/');
})


app.get('/uploads_page', (req, res) => {
  
  if(login(req)){
    res.send(`
    <html>
    <body>
    <a href="/dashboard">dashboard</a><br>
    <a href="/logout">logout</a><br>
    </br>
    <form action="/upload_job" method="post" enctype="multipart/form-data">
    Upload file:<input type="file" name="docker_image">
    Entrypoint command:<input type="text" name="container_entrypoint"></input>
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
    var status_value={status:job_status_codes.uploaded_to_web_server, 
    web_server_address:httpsServer.address().address,
    entrypoint:req.body.container_entrypoint};
    console.log(req.body);
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


