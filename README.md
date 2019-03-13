# PINK
PINK is not Kubernetes

A simple cloud orchestration tool that allows GUI based access to a cluster of CUDA powered servers. Users can simply upload their docker containers and have their allocated servers process them.

This project requires the following:

1) A control machine with Ansible and NodeJS installed. This will contain the Web GUI and will manage our other servers

2) A server running debian (could be the same as control machine) to be used as DB server. SSH access to this machine must be provided to the control machine.

OR 

A server already running Mariadb (in which case, please read the note at step 1

3) Atleast one debian machine that will act as a processing server with at least one dedicated Nvidia GPU each. Control machine must be provided ssh access to each of these machines.


## Step 1)
**Note:** Skip this step if you want to use an existing DB server. Instead, simply run the schema directly on the mariadb and add the web app user to the db manually. Also, update the user, password, db ssl certs and location of db server directly 


Clone this repo onto the control machine and open the db_server_config folder.
Here, you must update the "servers" file to enter the location, user, ssh port of your database server.
Update db_vars.json to add ssl keys for web and db servers, username and password to be used by the web app

**Note:** It is strongly recommended that you encrypt db_vars.json since it contains passwords using **ansible-vault encrypt**

Once done, simply run the following to install MariaDB at the specified location

ansible-playbook main.yml -i hosts --ask-vault-pass

## Step 2)
The password for the nodeapp user should be specified as an environment variable before execution
To run the web server simply do

```
DB_PASSWORD='passwordfromdbvarsfile' node index.js
```


On the GUI, when a machine is added, a default configuration will be stored in the database

By default SIGINT (ctrl + c) will be sent to client's program 20 minutes before their lease expires. 
kill -SIGINT `pgrep PROGRAMNAME`



https://docs.docker.com/config/containers/resource_constraints/





